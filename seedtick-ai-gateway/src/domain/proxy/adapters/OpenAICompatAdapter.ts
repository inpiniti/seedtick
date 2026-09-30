// OpenAICompatAdapter.ts - OpenAI 호환 제공사 어댑터 (Cline, Kilo, OpenRouter)

import type { ChatRequest, ChatResponse, ProviderConfig } from '../../types.ts';
import type { ILLMAdapter } from './ILLMAdapter.ts';

export class OpenAICompatAdapter implements ILLMAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async call(
    request: ChatRequest,
    modelId: string,
    apiKey: string,
    timeoutMs = 120_000
  ): Promise<{
    ok: boolean;
    status: number;
    response?: ChatResponse;
    errorBody: string;
  }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...this.config.defaultHeaders,
    };

    const requestedOutputTokens = request.max_tokens ?? 32768;
    const body = {
      model: modelId,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      // max_tokens: reasoning + output 전체 예산 (thinking 모델 대응)
      max_tokens: 32768,
      // max_completion_tokens: output 전용 한도 (OpenRouter/dots-3-note 등 thinking 모델 지원)
      // reasoning 토큰은 이 한도와 별개로 처리됨
      max_completion_tokens: requestedOutputTokens,
      stream: request.stream ?? false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          errorBody: responseText,
        };
      }

      let rawData: Record<string, unknown> = {};
      try {
        rawData = JSON.parse(responseText);
      } catch {
        return {
          ok: false,
          status: 502,
          errorBody: `Invalid JSON response: ${responseText.slice(0, 200)}`,
        };
      }

      // 0) Cline 등 일부 제공자가 {"data": {"choices": [...]}} 형태로 감싸서 반환한 경우 언래핑
      if (
        rawData.data &&
        typeof rawData.data === 'object' &&
        !Array.isArray(rawData.data) &&
        ('choices' in (rawData.data as Record<string, unknown>) ||
          'error' in (rawData.data as Record<string, unknown>))
      ) {
        rawData = rawData.data as Record<string, unknown>;
      }

      // OpenRouter 등 상위 제공자가 HTTP 200 안에 error 객체를 반환하는 경우 방어
      if (rawData.error && typeof rawData.error === 'object') {
        const errObj = rawData.error as Record<string, unknown>;
        const errCode = typeof errObj.code === 'number' ? errObj.code : 503;
        const errMsg = typeof errObj.message === 'string' ? errObj.message : responseText;
        return {
          ok: false,
          status: errCode,
          errorBody: errMsg,
        };
      }

      // OpenAI 규격 안전 정규화
      const choicesRaw = Array.isArray(rawData.choices) ? rawData.choices : [];
      const choices = choicesRaw.map((c: Record<string, unknown>, i: number) => {
        const msg = (c?.message as Record<string, unknown>) ?? {};
        let content = typeof msg.content === 'string' ? msg.content : '';
        // 만약 content가 비어있고 reasoning 또는 reasoning_content가 있다면 대체
        if (!content.trim() && typeof msg.reasoning === 'string' && msg.reasoning.trim()) {
          content = msg.reasoning;
        } else if (!content.trim() && typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
          content = msg.reasoning_content;
        }
        return {
          index: typeof c?.index === 'number' ? c.index : i,
          message: {
            role: (msg.role as 'system' | 'user' | 'assistant') || 'assistant',
            content,
          },
          finish_reason: (typeof c?.finish_reason === 'string' && c.finish_reason
            ? c.finish_reason
            : 'stop') as 'stop' | 'length' | 'content_filter' | 'error',
        };
      });

      const usageRaw = (rawData.usage as Record<string, unknown>) ?? {};
      const usage = {
        prompt_tokens:
          typeof usageRaw.prompt_tokens === 'number' ? Math.round(usageRaw.prompt_tokens) : 0,
        completion_tokens:
          typeof usageRaw.completion_tokens === 'number'
            ? Math.round(usageRaw.completion_tokens)
            : 0,
        total_tokens:
          typeof usageRaw.total_tokens === 'number' ? Math.round(usageRaw.total_tokens) : 0,
      };

      // choices가 비어있거나 모든 choices의 content가 비어있으면 모델 오류로 처리 → 다음 키/모델로 폴백
      const hasValidContent = choices.some((c) => c.message.content.trim().length > 0);
      if (choices.length === 0 || !hasValidContent) {
        return {
          ok: false,
          status: 500,
          errorBody: `Empty choices or empty content in response (model exhausted output tokens during reasoning or returned empty): ${responseText.slice(0, 200)}`,
        };
      }

      const normalizedResponse: ChatResponse = {
        id: (rawData.id as string) || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        model: modelId,
        choices,
        usage,
      };

      return {
        ok: true,
        status: response.status,
        response: normalizedResponse,
        errorBody: '',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : 'Network error';
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return {
        ok: false,
        status: isTimeout ? 408 : 0,
        errorBody: isTimeout ? `Timeout after ${timeoutMs}ms` : message,
      };
    }
  }
}
