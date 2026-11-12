// ProxyService.ts - LLM 요청 프록시 핵심 엔진

import { env } from '../../config/env.ts';
import { type ErrorLogService, errorLogService } from '../error-log/ErrorLogService.ts';
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
  KeySlot,
  LLMProvider,
  ModelConfig,
  UserPassThroughConfig,
} from '../types.ts';
import { FALLBACK_CHAIN } from '../types.ts';
import { AnthropicAdapter } from './adapters/AnthropicAdapter.ts';
import { GeminiAdapter } from './adapters/GeminiAdapter.ts';
import type { ILLMAdapter } from './adapters/ILLMAdapter.ts';
import { OpenAICompatAdapter } from './adapters/OpenAICompatAdapter.ts';

export class ProxyService {
  private readonly rotator: KeyRotator;
  private readonly cooldown: CooldownManager;
  private readonly classifier: ErrorClassifier;
  private readonly quota: QuotaManager;
  private readonly errorLogger: ErrorLogService;
  private readonly adapters: Map<LLMProvider, ILLMAdapter>;
  // 교차(Interleaving) 통합 슬롯 풀
  private readonly slots: KeySlot[];
  private slotIndex = 0;
  // 콜드 스타트 재시도 추적 (provider:modelId)
  private readonly coldStartTried = new Set<string>();

  constructor(
    errorLogger?: ErrorLogService,
    customProviders?: Array<{ provider: LLMProvider; keys: string[] }>
  ) {
    this.errorLogger = errorLogger ?? errorLogService;
    this.rotator = new KeyRotator(
      customProviders ?? [
        { provider: 'openrouter', keys: env.openrouterKeys },
        { provider: 'kilo', keys: env.kiloKeys },
        { provider: 'gemini', keys: env.geminiKeys },
      ]
    );

    this.cooldown = new CooldownManager();
    this.classifier = new ErrorClassifier();
    this.quota = new QuotaManager();

    this.adapters = new Map();
    this.initializeAdapters();

    // 2개 제공사(OpenRouter, Kilo)의 키들을 교차 배치한 통합 슬롯 풀 구성 (Cline은 스트리밍 불안정으로 제외)
    this.slots = this.buildInterleavedSlots(customProviders);
  }

  private buildInterleavedSlots(
    customProviders?: Array<{ provider: LLMProvider; keys: string[] }>
  ): KeySlot[] {
    const providers: Array<{ provider: LLMProvider; keys: string[] }> = customProviders ?? [
      { provider: 'openrouter', keys: env.openrouterKeys },
      { provider: 'kilo', keys: env.kiloKeys },
    ];
    const filtered = providers.filter((p) => p.keys.length > 0);

    if (filtered.length === 0) return [];
    if (filtered.length === 1) {
      return filtered[0].keys.map((k) => ({ provider: filtered[0].provider, key: k }));
    }

    // 각 제공사 중 가장 많은 키 수를 기준으로 교차(Interleaving) 슬롯 풀 구성
    // 키 수가 적은 제공사는 순환(modulo)하여 모든 슬롯에 고르게 교차되도록 배치
    const maxLen = Math.max(...providers.map((p) => p.keys.length));
    const slots: KeySlot[] = [];
    for (let i = 0; i < maxLen; i++) {
      for (const p of providers) {
        slots.push({
          provider: p.provider,
          key: p.keys[i % p.keys.length],
        });
      }
    }
    return slots;
  }

  private getNextSlot(): KeySlot | null {
    if (this.slots.length === 0) return null;
    const slot = this.slots[this.slotIndex % this.slots.length];
    this.slotIndex = (this.slotIndex + 1) % this.slots.length;
    return slot;
  }

  private initializeAdapters(): void {
    // OpenRouter (Primary)
    this.adapters.set(
      'openrouter',
      new OpenAICompatAdapter({
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKeys: env.openrouterKeys,
        defaultHeaders: {
          'HTTP-Referer': 'https://reportist.kr',
          'X-Title': 'Reportist',
          'User-Agent': 'OpenCode/1.0.0',
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

  private getTargetChain(requestedModel?: string): ModelConfig[] {
    const chain: ModelConfig[] = [];
    if (requestedModel) {
      chain.push({
        provider: 'openrouter',
        modelId: requestedModel,
        displayName: `OpenRouter/${requestedModel}`,
      });
    }
    for (const item of FALLBACK_CHAIN) {
      if (!chain.some((t) => t.provider === item.provider && t.modelId === item.modelId)) {
        chain.push(item);
      }
    }
    return chain;
  }

  async chat(request: ChatRequest): Promise<ChatResponse | GatewayError> {
    const attempts: GatewayAttempt[] = [];
    const targetModel = request.model ?? 'nvidia/nemotron-3.5-super-vl:free';
    const isGeminiDirect = targetModel.startsWith('gemini');

    // 1. OpenRouter / Kilo / Cline 통합 슬롯 풀 (교차 라운드로빈 로테이션)
    if (!isGeminiDirect && this.slots.length > 0) {
      const maxAttempts = Math.max(6, this.slots.length * 2);
      console.info(
        `[Gateway] 🚀 통합 풀 호출 시작 (총 ${this.slots.length}개 슬롯 교차 로테이션, 최대 ${maxAttempts}회 시도, 모델=${targetModel})`
      );

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const slot = this.getNextSlot();
        if (!slot) break;

        const { provider, key } = slot;
        const keyMasked = key.length > 12 ? `${key.slice(0, 8)}...${key.slice(-4)}` : '***';

        if (this.cooldown.isCoolingDown(provider, targetModel, key)) {
          continue;
        }

        const adapter = this.adapters.get(provider);
        if (!adapter) continue;

        this.rotator.acquireKey(provider, key);
        try {
          const result = await this.callWithColdStartRetry(
            adapter,
            request,
            targetModel,
            key,
            provider,
            attempts
          );

          if (result.ok && result.response) {
            console.info(`[Gateway] Success: [${provider}] ${targetModel} (키: ${keyMasked})`);
            return result.response;
          }

          const category = this.classifier.classify(result.status, result.errorBody);
          attempts.push({
            provider,
            modelId: targetModel,
            apiKeyHash: key.slice(-8),
            httpStatus: result.status,
            errorCategory: category,
            errorSnippet: result.errorBody.slice(0, 200),
            attemptedAt: new Date().toISOString(),
          });

          if (result.status === 429) {
            console.warn(
              `[Gateway] 429 RateLimit 감지 ([${provider}], 키: ${keyMasked}) -> 다음 슬롯으로 전환 (시도 ${attempt}/${maxAttempts})`
            );
            this.cooldown.setCooldown(provider, targetModel, key, 30_000, 'rpm_exceeded');
          } else if (result.status === 500 || result.status === 502 || result.status === 503 || result.status === 504) {
            console.warn(
              `[Gateway] ⚠️ [${provider}] HTTP ${result.status} -> 다음 슬롯으로 전환 (키: ${keyMasked}) (시도 ${attempt}/${maxAttempts})`
            );
            this.cooldown.setCooldown(provider, targetModel, key, 15_000, 'server_overloaded');
          } else {
            console.warn(
              `[Gateway] HTTP ${result.status} ([${provider}], 키: ${keyMasked}): ${result.errorBody.slice(0, 180)} (시도 ${attempt}/${maxAttempts})`
            );
            await this.handleError(category, provider, targetModel, key, [key]);
          }

          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400));
          }
        } finally {
          this.rotator.releaseKey(provider, key);
        }
      }
    }

    // 2. Gemini 직통 또는 통합 풀 소진 시 Gemini 폴백
    const geminiAdapter = this.adapters.get('gemini');
    if (geminiAdapter && env.geminiKeys.length > 0) {
      const geminiModel = isGeminiDirect ? targetModel : 'gemini-3.5-flash-lite';
      for (const apiKey of env.geminiKeys) {
        if (this.cooldown.isCoolingDown('gemini', geminiModel, apiKey)) continue;
        this.rotator.acquireKey('gemini', apiKey);
        try {
          const result = await this.callWithColdStartRetry(
            geminiAdapter,
            request,
            geminiModel,
            apiKey,
            'gemini',
            attempts
          );
          if (result.ok && result.response) {
            console.info(`[Gateway] Fallback success: [gemini] ${geminiModel}`);
            return result.response;
          }
          const category = this.classifier.classify(result.status, result.errorBody);
          attempts.push({
            provider: 'gemini',
            modelId: geminiModel,
            apiKeyHash: apiKey.slice(-8),
            httpStatus: result.status,
            errorCategory: category,
            errorSnippet: result.errorBody.slice(0, 200),
            attemptedAt: new Date().toISOString(),
          });
          await this.handleError(category, 'gemini', geminiModel, apiKey, env.geminiKeys);
        } finally {
          this.rotator.releaseKey('gemini', apiKey);
        }
      }
    }

    // 모든 제공사/모델/키 소진
    await this.errorLogger.critical(
      'GATEWAY_ALL_KEYS_EXHAUSTED',
      '모든 LLM 제공사의 키와 모델이 소진되었습니다',
      {
        attemptsCount: attempts.length,
        modelRequested: request.model,
        lastAttempts: attempts.slice(-5),
      }
    );

    return {
      error: {
        code: 'GATEWAY_ALL_EXHAUSTED',
        message: '모든 LLM 제공사의 키와 모델이 소진되었습니다',
        type: 'gateway_error',
        attempts,
      },
    } as GatewayError;
  }

  async chatStream(
    request: ChatRequest
  ): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | GatewayError> {
    const attempts: GatewayAttempt[] = [];
    const targetModel = request.model ?? 'nvidia/nemotron-3.5-super-vl:free';
    const isGeminiDirect = targetModel.startsWith('gemini');

    // 1. OpenRouter / Kilo / Cline 통합 슬롯 풀 (교차 라운드로빈 로테이션)
    if (!isGeminiDirect && this.slots.length > 0) {
      const maxAttempts = Math.max(6, this.slots.length * 2);
      console.info(
        `[Gateway] 🚀 통합 풀 호출 시작 (총 ${this.slots.length}개 슬롯 교차 로테이션, 최대 ${maxAttempts}회 시도, 모델=${targetModel})`
      );

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const slot = this.getNextSlot();
        if (!slot) break;

        const { provider, key } = slot;
        const keyMasked = key.length > 12 ? `${key.slice(0, 8)}...${key.slice(-4)}` : '***';

        if (this.cooldown.isCoolingDown(provider, targetModel, key)) {
          continue;
        }

        const adapter = this.adapters.get(provider);
        if (!adapter || !adapter.callStream) {
          continue;
        }

        this.rotator.acquireKey(provider, key);
        try {
          const result = await adapter.callStream(request, targetModel, key, 120_000);
          if (result.ok && result.stream) {
            console.info(`[Gateway] Stream success: [${provider}] ${targetModel} (키: ${keyMasked})`);
            return { ok: true, stream: result.stream };
          }

          const category = this.classifier.classify(result.status, result.errorBody);
          attempts.push({
            provider,
            modelId: targetModel,
            apiKeyHash: key.slice(-8),
            httpStatus: result.status,
            errorCategory: category,
            errorSnippet: result.errorBody.slice(0, 200),
            attemptedAt: new Date().toISOString(),
          });

          if (result.status === 429) {
            console.warn(
              `[Gateway] 429 RateLimit 감지 ([${provider}], 키: ${keyMasked}) -> 다음 슬롯으로 전환 (시도 ${attempt}/${maxAttempts})`
            );
            this.cooldown.setCooldown(provider, targetModel, key, 30_000, 'rpm_exceeded');
          } else if (result.status === 500 || result.status === 502 || result.status === 503 || result.status === 504) {
            console.warn(
              `[Gateway] ⚠️ [${provider}] HTTP ${result.status} -> 다음 슬롯으로 전환 (키: ${keyMasked}) (시도 ${attempt}/${maxAttempts})`
            );
            this.cooldown.setCooldown(provider, targetModel, key, 15_000, 'server_overloaded');
          } else {
            console.warn(
              `[Gateway] HTTP ${result.status} ([${provider}], 키: ${keyMasked}): ${result.errorBody.slice(0, 180)} (시도 ${attempt}/${maxAttempts})`
            );
            await this.handleError(category, provider, targetModel, key, [key]);
          }

          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400));
          }
        } finally {
          this.rotator.releaseKey(provider, key);
        }
      }
    }

    // 2. Gemini 직통 또는 통합 풀 소진 시 Gemini 폴백
    const geminiAdapter = this.adapters.get('gemini');
    if (geminiAdapter && geminiAdapter.callStream && env.geminiKeys.length > 0) {
      const geminiModel = isGeminiDirect ? targetModel : 'gemini-3.5-flash-lite';
      for (const apiKey of env.geminiKeys) {
        if (this.cooldown.isCoolingDown('gemini', geminiModel, apiKey)) continue;
        this.rotator.acquireKey('gemini', apiKey);
        try {
          const result = await geminiAdapter.callStream(request, geminiModel, apiKey, 120_000);
          if (result.ok && result.stream) {
            console.info(`[Gateway] Stream fallback success: [gemini] ${geminiModel}`);
            return { ok: true, stream: result.stream };
          }
          const category = this.classifier.classify(result.status, result.errorBody);
          attempts.push({
            provider: 'gemini',
            modelId: geminiModel,
            apiKeyHash: apiKey.slice(-8),
            httpStatus: result.status,
            errorCategory: category,
            errorSnippet: result.errorBody.slice(0, 200),
            attemptedAt: new Date().toISOString(),
          });
          await this.handleError(category, 'gemini', geminiModel, apiKey, env.geminiKeys);
        } finally {
          this.rotator.releaseKey('gemini', apiKey);
        }
      }
    }

    // 모든 제공사/키 소진
    await this.errorLogger.critical(
      'GATEWAY_ALL_KEYS_EXHAUSTED',
      '모든 LLM 제공사의 키와 모델이 소진되었습니다',
      {
        attemptsCount: attempts.length,
        modelRequested: request.model,
        lastAttempts: attempts.slice(-5),
      }
    );

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

    // 첫 호출: 기본 120초 타임아웃 (긴 토큰 생성 지원)
    let result = await adapter.call(request, modelId, apiKey, 120_000);

    // 타임아웃/네트워크 에러이고 첫 호출인 경우 한 번 재시도 (180초)
    const isTimeoutOrNetwork = result.status === 408 || result.status === 0;
    if (isFirstCall && isTimeoutOrNetwork) {
      console.info(
        `[Gateway] Cold start timeout/network error for ${provider}:${modelId}:${apiKey.slice(-8)}, retrying with 180s timeout...`
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

      result = await adapter.call(request, modelId, apiKey, 180_000);

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
        await this.errorLogger.warning(
          'GATEWAY_DAILY_EXHAUSTED',
          `${provider}:${modelId} 키(${apiKey.slice(-8)}) 일일 할당량(RPD) 소진`,
          { provider, modelId, apiKeyHash: apiKey.slice(-8) }
        );
        break;

      case 'forbidden':
      case 'unauthorized':
        this.cooldown.setCooldown(provider, modelId, apiKey, 3_600_000, category);
        console.info(
          `[Gateway] Set cooldown 1h for ${provider}:${modelId}:${apiKey.slice(-8)} (${category})`
        );
        await this.errorLogger.warning(
          'GATEWAY_AUTH_FAILED',
          `${provider}:${modelId} 키(${apiKey.slice(-8)}) 인증 실패 (${category})`,
          { provider, modelId, apiKeyHash: apiKey.slice(-8), category }
        );
        break;

      case 'model_not_found':
        this.cooldown.setModelCooldownAllKeys(provider, modelId, allKeys, 86_400_000, category);
        console.info(
          `[Gateway] Set cooldown 24h for ALL keys of ${provider}:${modelId} (${category})`
        );
        await this.errorLogger.warning(
          'GATEWAY_MODEL_NOT_FOUND',
          `${provider}:${modelId} 모델 미존재 (404) — 전 키 24시간 쿨다운`,
          { provider, modelId }
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

  getSlots(): KeySlot[] {
    return [...this.slots];
  }

  private sanitizeCustomBaseUrl(rawUrl: string | undefined): string | undefined {
    if (!rawUrl) return undefined;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return undefined;
      }
      const host = parsed.hostname.toLowerCase();
      // 사설망 및 로컬호스트 / 클라우드 메타데이터 IP 접근 차단 (SSRF 방어)
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '0.0.0.0' ||
        host === '169.254.169.254' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
        /^192\.168\./.test(host)
      ) {
        return undefined;
      }
      return parsed.toString();
    } catch {
      return undefined;
    }
  }

  // === 사용자 직접 입력 API 키(BYOK) 패스스루 처리 ===
  private resolvePassThroughAdapter(config: UserPassThroughConfig): {
    adapter: ILLMAdapter;
    model: string;
    provider: string;
  } {
    const rawProvider = (config.provider || 'openai').toLowerCase().trim();
    let baseUrl = this.sanitizeCustomBaseUrl(config.baseUrl?.trim());
    let resolvedModel = config.model?.trim();

    if (rawProvider === 'claude' || rawProvider === 'anthropic') {
      return {
        adapter: new AnthropicAdapter({
          baseUrl: baseUrl || 'https://api.anthropic.com/v1/messages',
        }),
        model: resolvedModel || 'claude-sonnet-5-5',
        provider: 'anthropic',
      };
    }

    let defaultHeaders: Record<string, string> | undefined;

    switch (rawProvider) {
      case 'openai':
        baseUrl = baseUrl || 'https://api.openai.com/v1/chat/completions';
        resolvedModel = resolvedModel || 'gpt-6.1-sol';
        break;
      case 'gemini':
      case 'google':
        baseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        resolvedModel = resolvedModel || 'gemini-4-carbon';
        break;
      case 'openrouter':
        baseUrl = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
        resolvedModel = resolvedModel || 'anthropic/claude-sonnet-5.5';
        defaultHeaders = {
          'HTTP-Referer': 'https://reportist.kr',
          'X-Title': 'Reportist',
        };
        break;
      case 'deepseek':
        baseUrl = baseUrl || 'https://api.deepseek.com/chat/completions';
        resolvedModel = resolvedModel || 'deepseek-v4.1-flash';
        break;
      case 'grok':
      case 'xai':
        baseUrl = baseUrl || 'https://api.x.ai/v1/chat/completions';
        resolvedModel = resolvedModel || 'grok-4.7';
        break;
      case 'qwen':
      case 'dashscope':
        baseUrl = baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
        resolvedModel = resolvedModel || 'qwen-3.8-max';
        break;
      case 'glm':
      case 'zhipu':
        baseUrl = baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        resolvedModel = resolvedModel || 'glm-5.3';
        break;
      case 'kimi':
      case 'moonshot':
        baseUrl = baseUrl || 'https://api.moonshot.cn/v1/chat/completions';
        resolvedModel = resolvedModel || 'kimi-k3.1-pro';
        break;
      case 'minimax':
      case 'mimo':
        baseUrl = baseUrl || 'https://api.minimax.chat/v1/text/chatcompletion_v2';
        resolvedModel = resolvedModel || 'mimo-v2.6-pro';
        break;
      case 'muse':
        baseUrl = baseUrl || 'https://api.muse.ai/v1/chat/completions';
        resolvedModel = resolvedModel || 'muse-wonder-full';
        break;
      default:
        baseUrl = baseUrl || 'https://api.openai.com/v1/chat/completions';
        resolvedModel = resolvedModel || 'gpt-6.1-sol';
        break;
    }

    return {
      adapter: new OpenAICompatAdapter({
        baseUrl,
        apiKeys: [config.apiKey],
        defaultHeaders,
      }),
      model: resolvedModel,
      provider: rawProvider,
    };
  }

  async chatPassThrough(
    request: ChatRequest,
    config: UserPassThroughConfig
  ): Promise<ChatResponse | GatewayError> {
    const { adapter, model, provider } = this.resolvePassThroughAdapter(config);
    const targetModel = request.model || model;
    const keyMasked = config.apiKey.length > 8 ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : '***';

    console.info(`[Gateway PassThrough] 호출 시작: provider=${provider}, model=${targetModel}, key=${keyMasked}`);

    try {
      const result = await adapter.call(request, targetModel, config.apiKey, 120_000);
      if (result.ok && result.response) {
        console.info(`[Gateway PassThrough] 성공: provider=${provider}, model=${targetModel}`);
        return result.response;
      }

      console.warn(`[Gateway PassThrough] 실패 (${result.status}): ${result.errorBody.slice(0, 200)}`);
      return {
        error: {
          code: 'GATEWAY_MODEL_NOT_SUPPORTED',
          message: `사용자 지정 공급자(${provider}) 호출 실패 (${result.status}): ${result.errorBody.slice(0, 300)}`,
          type: 'gateway_error',
          attempts: [
            {
              provider: provider as any,
              modelId: targetModel,
              apiKeyHash: config.apiKey.slice(-6),
              httpStatus: result.status,
              errorCategory: 'unknown',
              errorSnippet: result.errorBody.slice(0, 200),
              attemptedAt: new Date().toISOString(),
            },
          ],
        },
      } as GatewayError;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: {
          code: 'GATEWAY_MODEL_NOT_SUPPORTED',
          message: `사용자 지정 공급자 통신 오류: ${msg}`,
          type: 'gateway_error',
        },
      } as GatewayError;
    }
  }

  async chatStreamPassThrough(
    request: ChatRequest,
    config: UserPassThroughConfig
  ): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | GatewayError> {
    const { adapter, model, provider } = this.resolvePassThroughAdapter(config);
    const targetModel = request.model || model;
    const keyMasked = config.apiKey.length > 8 ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : '***';

    console.info(`[Gateway PassThrough Stream] 호출 시작: provider=${provider}, model=${targetModel}, key=${keyMasked}`);

    if (!adapter.callStream) {
      return {
        error: {
          code: 'GATEWAY_MODEL_NOT_SUPPORTED',
          message: `해당 어댑터(${provider})는 스트리밍을 지원하지 않습니다.`,
          type: 'gateway_error',
        },
      } as GatewayError;
    }

    try {
      const result = await adapter.callStream(request, targetModel, config.apiKey, 120_000);
      if (result.ok && result.stream) {
        console.info(`[Gateway PassThrough Stream] 성공: provider=${provider}, model=${targetModel}`);
        return { ok: true, stream: result.stream };
      }

      console.warn(`[Gateway PassThrough Stream] 실패 (${result.status}): ${result.errorBody.slice(0, 200)}`);
      return {
        error: {
          code: 'GATEWAY_MODEL_NOT_SUPPORTED',
          message: `사용자 지정 공급자(${provider}) 스트리밍 실패 (${result.status}): ${result.errorBody.slice(0, 300)}`,
          type: 'gateway_error',
          attempts: [
            {
              provider: provider as any,
              modelId: targetModel,
              apiKeyHash: config.apiKey.slice(-6),
              httpStatus: result.status,
              errorCategory: 'unknown',
              errorSnippet: result.errorBody.slice(0, 200),
              attemptedAt: new Date().toISOString(),
            },
          ],
        },
      } as GatewayError;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: {
          code: 'GATEWAY_MODEL_NOT_SUPPORTED',
          message: `사용자 지정 공급자 스트리밍 통신 오류: ${msg}`,
          type: 'gateway_error',
        },
      } as GatewayError;
    }
  }
}

export const proxyService = new ProxyService();
