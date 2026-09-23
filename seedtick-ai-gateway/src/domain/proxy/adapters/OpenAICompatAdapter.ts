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
    timeoutMs = 60_000
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

    const body = {
      model: modelId,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2000,
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

      // OpenAI 규격 안전 정규화
      const choicesRaw = Array.isArray(rawData.choices) ? rawData.choices : [];
      const choices = choicesRaw.map((c: Record<string, unknown>, i: number) => {
        const msg = (c?.message as Record<string, unknown>) ?? {};
        return {
          index: typeof c?.index === 'number' ? c.index : i,
          message: {
            role: (msg.role as 'system' | 'user' | 'assistant') || 'assistant',
            content: typeof msg.content === 'string' ? msg.content : '',
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
