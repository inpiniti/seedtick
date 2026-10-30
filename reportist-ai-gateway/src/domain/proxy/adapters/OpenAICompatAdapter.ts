// OpenAICompatAdapter.ts - OpenAI 호환 제공사 어댑터 (Cline, Kilo, OpenRouter)

import type { ChatRequest, ChatResponse, ProviderConfig } from '../../types.ts';
import type { ILLMAdapter } from './ILLMAdapter.ts';

function normalizeReasoningEffort(effort?: string): string | null {
  if (!effort) return null;
  const lower = effort.toLowerCase().trim();
  if (lower === 'none' || lower === 'off' || lower === '기본' || lower === '끄기') return null;
  if (lower === 'low' || lower === '낮음') return 'low';
  if (lower === 'medium' || lower === '중간') return 'medium';
  if (lower === 'high' || lower === '높음') return 'high';
  if (lower === 'extra' || lower === '엑스트라') return 'extra';
  if (lower === 'max' || lower === '최대') return 'max';
  return lower;
}

export class OpenAICompatAdapter implements ILLMAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  private buildRequestBody(request: ChatRequest, modelId: string, isStream: boolean) {
    const requestedOutputTokens = request.max_tokens ?? 32768;
    const normalizedEffort = normalizeReasoningEffort(request.reasoning_effort);

    const body: Record<string, unknown> = {
      model: modelId,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: 32768,
      max_completion_tokens: requestedOutputTokens,
      stream: isStream,
    };

    if (normalizedEffort) {
      body.reasoning = { effort: normalizedEffort };
      body.reasoning_effort = normalizedEffort;
    }

    return body;
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

    const body = this.buildRequestBody(request, modelId, false);

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
        } else if (
          !content.trim() &&
          typeof msg.reasoning_content === 'string' &&
          msg.reasoning_content.trim()
        ) {
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

  async callStream(
    request: ChatRequest,
    modelId: string,
    apiKey: string,
    timeoutMs = 120_000
  ): Promise<{
    ok: boolean;
    status: number;
    stream?: ReadableStream<Uint8Array>;
    errorBody: string;
  }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...this.config.defaultHeaders,
    };

    const body = this.buildRequestBody(request, modelId, true);

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

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          ok: false,
          status: response.status,
          errorBody,
        };
      }

      if (!response.body) {
        return {
          ok: false,
          status: 500,
          errorBody: 'No response body received from provider',
        };
      }

      // 첫 번째 청크 사전 검증 (Peek & Validate)
      // 상위 제공자가 HTTP 200을 줬더라도 첫 청크로 429 에러나 빈 스트림을 뱉는 경우 다음 슬롯으로 전환할 수 있게 방어
      const reader = response.body.getReader();
      const firstChunkTimeoutMs = 15_000;
      let firstChunkTimer: ReturnType<typeof setTimeout> | undefined;

      const timeoutPromise = new Promise<{ done: true; value: undefined; timedOut: true }>((resolve) => {
        firstChunkTimer = setTimeout(
          () => resolve({ done: true, value: undefined, timedOut: true }),
          firstChunkTimeoutMs
        );
      });

      const readPromise = reader.read().then((res) => ({ ...res, timedOut: false }));
      const firstResult = await Promise.race([readPromise, timeoutPromise]);
      clearTimeout(firstChunkTimer);

      if (firstResult.timedOut) {
        try {
          await reader.cancel('First token timeout');
        } catch {}
        return {
          ok: false,
          status: 408,
          errorBody: `First token timeout after ${firstChunkTimeoutMs}ms (model hung/cold)`,
        };
      }

      if (firstResult.done || !firstResult.value || firstResult.value.byteLength === 0) {
        try {
          await reader.cancel('Empty stream');
        } catch {}
        return {
          ok: false,
          status: 502,
          errorBody: 'Empty stream received from provider (0 bytes before stream completion)',
        };
      }

      // 첫 청크 디코딩 및 에러 검사
      const decoder = new TextDecoder();
      const firstChunkText = decoder.decode(firstResult.value, { stream: true });

      let isStreamError = false;
      let errorStatus = 500;
      let errorMessage = '';

      if (firstChunkText.includes('"error":') || firstChunkText.includes('"error" :')) {
        isStreamError = true;
        errorMessage = firstChunkText;
        if (
          firstChunkText.includes('429') ||
          firstChunkText.includes('rate-limited') ||
          firstChunkText.includes('RateLimit') ||
          firstChunkText.includes('quota')
        ) {
          errorStatus = 429;
        } else if (
          firstChunkText.includes('503') ||
          firstChunkText.includes('overloaded') ||
          firstChunkText.includes('temporarily unavailable')
        ) {
          errorStatus = 503;
        } else if (firstChunkText.includes('stream_initialization_failed')) {
          errorStatus = firstChunkText.includes('429') ? 429 : 502;
        }
      } else if (firstChunkText.trim() === 'data: [DONE]' || firstChunkText.trim() === '[DONE]') {
        isStreamError = true;
        errorStatus = 502;
        errorMessage = 'Provider sent immediate [DONE] without any completion tokens';
      }

      if (isStreamError) {
        try {
          await reader.cancel('Stream initialization error');
        } catch {}
        return {
          ok: false,
          status: errorStatus,
          errorBody: errorMessage,
        };
      }

      // 정상 청크 확인 완료: 첫 청크를 프리펜드(Prepend)한 새 ReadableStream 생성
      const firstChunkValue = firstResult.value;
      const prependedStream = new ReadableStream<Uint8Array>({
        async start(streamController) {
          try {
            // 1. 검증된 첫 번째 청크 먼저 방출
            streamController.enqueue(firstChunkValue);

            // 2. 이후 청크 계속 파이프
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                streamController.enqueue(value);
              }
            }
            streamController.close();
          } catch (streamErr) {
            streamController.error(streamErr);
          }
        },
        cancel(reason) {
          try {
            reader.cancel(reason);
          } catch {}
        },
      });

      return {
        ok: true,
        status: 200,
        stream: prependedStream,
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
