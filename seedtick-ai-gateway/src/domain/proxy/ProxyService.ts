// ProxyService.ts - LLM 요청 프록시 핵심 엔진

import { env } from '../../config/env.ts';
import { CooldownManager } from '../key-rotator/CooldownManager.ts';
import { ErrorClassifier } from '../key-rotator/ErrorClassifier.ts';
import { KeyRotator } from '../key-rotator/KeyRotator.ts';
import { QuotaManager } from '../key-rotator/QuotaManager.ts';
import type {
  ChatRequest,
  ChatResponse,
  ErrorCategory,
  GatewayAttempt,
  GatewayError,
  LLMProvider,
} from '../types.ts';
import { FALLBACK_CHAIN } from '../types.ts';
import { GeminiAdapter } from './adapters/GeminiAdapter.ts';
import type { ILLMAdapter } from './adapters/ILLMAdapter.ts';
import { OpenAICompatAdapter } from './adapters/OpenAICompatAdapter.ts';

export class ProxyService {
  private readonly rotator: KeyRotator;
  private readonly cooldown: CooldownManager;
  private readonly classifier: ErrorClassifier;
  private readonly quota: QuotaManager;
  private readonly adapters: Map<LLMProvider, ILLMAdapter>;
  // 콜드 스타트 재시도 추적 (provider:modelId)
  private readonly coldStartTried = new Set<string>();

  constructor() {
    this.rotator = new KeyRotator([
      { provider: 'cline', keys: env.clineKeys },
      { provider: 'kilo', keys: env.kiloKeys },
      { provider: 'openrouter', keys: env.openrouterKeys },
      { provider: 'gemini', keys: env.geminiKeys },
    ]);

    this.cooldown = new CooldownManager();
    this.classifier = new ErrorClassifier();
    this.quota = new QuotaManager();

    this.adapters = new Map();
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    // OpenRouter (Primary)
    this.adapters.set(
      'openrouter',
      new OpenAICompatAdapter({
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKeys: env.openrouterKeys,
        defaultHeaders: {
          'HTTP-Referer': 'https://seedtick.app',
          'X-Title': 'SeedTick',
        },
      })
    );

    // Cline (Optional)
    if (env.clineKeys.length > 0) {
      this.adapters.set(
        'cline',
        new OpenAICompatAdapter({
          baseUrl: 'https://api.cline.bot/api/v1/chat/completions',
          apiKeys: env.clineKeys,
        })
      );
    }

    // Kilo (Optional)
    if (env.kiloKeys.length > 0) {
      this.adapters.set(
        'kilo',
        new OpenAICompatAdapter({
          baseUrl: 'https://api.kilo.ai/api/gateway/chat/completions',
          apiKeys: env.kiloKeys,
        })
      );
    }

    // Gemini (Optional)
    if (env.geminiKeys.length > 0) {
      this.adapters.set(
        'gemini',
        new GeminiAdapter({
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
          apiKeys: env.geminiKeys,
          queryAuth: true,
        })
      );
    }
  }

  async initialize(): Promise<void> {
    await this.quota.initialize();
  }

  async chat(request: ChatRequest): Promise<ChatResponse | GatewayError> {
    const attempts: GatewayAttempt[] = [];

    console.info('[Gateway] Chat request received, starting fallback chain');

    for (const modelConfig of FALLBACK_CHAIN) {
      const { provider, modelId } = modelConfig;
      const keys = this.rotator.getKeysForProvider(provider);

      if (keys.length === 0) {
        console.info(`[Gateway] No keys for ${provider}, skipping`);
        continue;
      }

      console.info(`[Gateway] Trying provider=${provider} model=${modelId} keys=${keys.length}`);

      for (const apiKey of keys) {
        // 1. 인메모리 쿨다운 확인 (0ms)
        if (this.cooldown.isCoolingDown(provider, modelId, apiKey)) {
          console.info(`[Gateway] Skipping ${provider}:${modelId}:${apiKey.slice(-8)} (cooldown)`);
          continue;
        }

        // 2. 일일 소진 Supabase 확인 (인메모리 캐시 경유, 0ms)
        if (this.quota.isExhaustedLocal(provider, modelId, apiKey)) {
          console.info(
            `[Gateway] Skipping ${provider}:${modelId}:${apiKey.slice(-8)} (daily exhausted)`
          );
          continue;
        }

        // 3. API 호출
        const adapter = this.adapters.get(provider);
        if (!adapter) {
          console.error(`[Gateway] No adapter for provider: ${provider}`);
          continue;
        }

        // 동시성 추적: 키 점유 시작
        this.rotator.acquireKey(provider, apiKey);
        console.info(
          `[Gateway] Acquired key ${provider}:${apiKey.slice(-8)} (in-flight=${this.rotator.getActiveCount(provider, apiKey)})`
        );

        let result;
        try {
          // 콜드 스타트 재시도 로직 포함 호출
          result = await this.callWithColdStartRetry(
            adapter,
            request,
            modelId,
            apiKey,
            provider,
            attempts
          );
        } finally {
          // 동시성 추적: 키 반환
          this.rotator.releaseKey(provider, apiKey);
          console.info(
            `[Gateway] Released key ${provider}:${apiKey.slice(-8)} (in-flight=${this.rotator.getActiveCount(provider, apiKey)})`
          );
        }

        if (result.ok && result.response) {
          console.info(`[Gateway] Success: ${provider}:${modelId}:${apiKey.slice(-8)}`);
          return result.response;
        }

        // 4. 에러 분류 및 처리
        const category = this.classifier.classify(result.status, result.errorBody);
        console.warn(
          `[Gateway] Error: ${provider}:${modelId}:${apiKey.slice(-8)} status=${result.status} category=${category} body=${result.errorBody.slice(0, 100)}`
        );
        const attempt: GatewayAttempt = {
          provider,
          modelId,
          apiKeyHash: apiKey.slice(-8),
          httpStatus: result.status,
          errorCategory: category,
          errorSnippet: result.errorBody.slice(0, 200),
          attemptedAt: new Date().toISOString(),
        };
        attempts.push(attempt);

        await this.handleError(category, provider, modelId, apiKey, keys);

        // 카테고리에 따른 break/continue 로직
        if (this.shouldBreakModelLoop(category)) {
          break; // 내부 break → 모델 루프의 다음 모델로
        }
        // continue → 다음 키 시도
      }
    }

    // 모든 제공사/모델/키 소진
    return {
      error: {
        code: 'GATEWAY_ALL_EXHAUSTED',
        message: '모든 LLM 제공사의 키와 모델이 소진되었습니다',
        type: 'gateway_error',
        attempts,
      },
    } as GatewayError;
  }

  // 콜드 스타트 재시도 로직 (첫 요청 타임아웃 시 한 번만 재시도)
  private async callWithColdStartRetry(
    adapter: ILLMAdapter,
    request: ChatRequest,
    modelId: string,
    apiKey: string,
    provider: LLMProvider,
    attempts: GatewayAttempt[]
  ): Promise<{
    ok: boolean;
    status: number;
    response?: ChatResponse;
    errorBody: string;
  }> {
    const coldStartKey = `${provider}:${modelId}`;
    const isFirstCall = !this.coldStartTried.has(coldStartKey);

    // 첫 호출: 기본 60초 타임아웃
    let result = await adapter.call(request, modelId, apiKey, 60_000);

    // 타임아웃/네트워크 에러이고 첫 호출인 경우 한 번 재시도 (120초)
    const isTimeoutOrNetwork = result.status === 408 || result.status === 0;
    if (isFirstCall && isTimeoutOrNetwork) {
      console.info(
        `[Gateway] Cold start timeout/network error for ${provider}:${modelId}:${apiKey.slice(-8)}, retrying with 120s timeout...`
      );
      this.coldStartTried.add(coldStartKey);

      // 재시도 기록 (unknown으로 분류)
      const retryAttempt: GatewayAttempt = {
        provider,
        modelId,
        apiKeyHash: apiKey.slice(-8),
        httpStatus: result.status,
        errorCategory: 'unknown',
        errorSnippet: `Cold start retry: ${result.errorBody}`,
        attemptedAt: new Date().toISOString(),
      };
      attempts.push(retryAttempt);

      result = await adapter.call(request, modelId, apiKey, 120_000);

      if (result.ok && result.response) {
        console.info(
          `[Gateway] Cold start retry success: ${provider}:${modelId}:${apiKey.slice(-8)}`
        );
        return result;
      }

      console.warn(
        `[Gateway] Cold start retry failed: ${provider}:${modelId}:${apiKey.slice(-8)} status=${result.status}`
      );
    }

    // 첫 호출이 아닌 경우도 기록 (다음 요청부터는 재시도 안 함)
    if (isFirstCall) {
      this.coldStartTried.add(coldStartKey);
    }

    return result;
  }

  private async handleError(
    category: ErrorCategory,
    provider: LLMProvider,
    modelId: string,
    apiKey: string,
    allKeys: string[]
  ): Promise<void> {
    console.info(
      `[Gateway] Handling error: ${category} for ${provider}:${modelId}:${apiKey.slice(-8)}`
    );

    switch (category) {
      case 'rpm_exceeded':
      case 'tpm_exceeded':
        this.cooldown.setCooldown(provider, modelId, apiKey, 60_000, category);
        console.info(
          `[Gateway] Set cooldown 60s for ${provider}:${modelId}:${apiKey.slice(-8)} (${category})`
        );
        break;

      case 'daily_exhausted':
        this.quota.markExhausted(provider, modelId, apiKey);
        console.info(
          `[Gateway] Marked daily exhausted for ${provider}:${modelId}:${apiKey.slice(-8)}`
        );
        break;

      case 'forbidden':
      case 'unauthorized':
        this.cooldown.setCooldown(provider, modelId, apiKey, 3_600_000, category);
        console.info(
          `[Gateway] Set cooldown 1h for ${provider}:${modelId}:${apiKey.slice(-8)} (${category})`
        );
        break;

      case 'model_not_found':
        this.cooldown.setModelCooldownAllKeys(provider, modelId, allKeys, 86_400_000, category);
        console.info(
          `[Gateway] Set cooldown 24h for ALL keys of ${provider}:${modelId} (${category})`
        );
        break;

      case 'server_overloaded':
        this.cooldown.setCooldown(provider, modelId, apiKey, 30_000, category);
        console.info(
          `[Gateway] Set cooldown 30s for ${provider}:${modelId}:${apiKey.slice(-8)} (${category})`
        );
        break;

      case 'timeout':
      case 'network_error':
        this.cooldown.setCooldown(provider, modelId, apiKey, 30_000, category);
        console.info(
          `[Gateway] Set cooldown 30s for ${provider}:${modelId}:${apiKey.slice(-8)} (${category})`
        );
        break;

      default:
        // context_too_long, safety_filter, unknown 등
        // 키 바꿔도 무의미하므로 다음 모델로
        console.info(`[Gateway] Breaking model loop for ${provider}:${modelId} (${category})`);
        break;
    }
  }

  private shouldBreakModelLoop(category: ErrorCategory): boolean {
    // 다음 모델로 이동해야 하는 케이스
    // timeout, network_error는 다음 키로 재시도하도록 break하지 않음
    return [
      'model_not_found',
      'context_too_long',
      'output_too_long',
      'safety_filter',
      'unknown',
    ].includes(category);
  }

  // 디버그용 getter
  getCooldownMap(): Map<string, number> {
    return this.cooldown.getMap();
  }

  getExhaustedKeys(): Set<string> {
    return this.quota.getExhaustedSet();
  }

  getKeyStates(provider: LLMProvider = 'openrouter') {
    return this.rotator.getKeyStates(provider);
  }
}

export const proxyService = new ProxyService();
