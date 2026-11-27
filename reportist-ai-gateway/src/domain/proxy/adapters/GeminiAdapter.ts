// GeminiAdapter.ts - Gemini API 어댑터 (OpenAI 규격 변환)

import { readResetAtHeader } from '../../key-rotator/ResetAtParser.ts';
import type { ChatMessage, ChatRequest, ChatResponse, ProviderConfig } from '../../types.ts';
import type { ILLMAdapter } from './ILLMAdapter.ts';

// ChatMessage.content는 unknown이라 어댑터에서 읽는 최소 형태로 좁혀 사용한다.
interface ContentPart {
  type?: string;
  text?: string;
  image_url?: { url?: string };
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiRawResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
}

export class GeminiAdapter implements ILLMAdapter {
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl.replace('{model}', '');
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
    resetAt?: string | null;
  }> {
    const geminiRequest = this.transformRequest(request);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.baseUrl}${modelId}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          errorBody: responseText,
          resetAt: readResetAtHeader(response.headers),
        };
      }

      const rawData = JSON.parse(responseText) as GeminiRawResponse;

      // candidates가 비어있으면 오류로 처리 → 다음 키/모델로 폴백
      if (!rawData.candidates || rawData.candidates.length === 0) {
        return {
          ok: false,
          status: 500,
          errorBody: `Empty candidates in Gemini response: ${responseText.slice(0, 200)}`,
        };
      }

      const chatResponse = this.transformResponse(rawData, modelId);

      return {
        ok: true,
        status: response.status,
        response: chatResponse,
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
    resetAt?: string | null;
  }> {
    const geminiRequest = this.transformRequest(request);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.baseUrl}${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(geminiRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          ok: false,
          status: response.status,
          errorBody,
          resetAt: readResetAtHeader(response.headers),
        };
      }

      if (!response.body) {
        return {
          ok: false,
          status: 500,
          errorBody: 'No response body received from Gemini',
        };
      }

      const reader = response.body.getReader();
      const firstChunkTimeoutMs = 60_000;
      let firstTimer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<{ done: true; value: undefined; timedOut: true }>(
        (resolve) => {
          firstTimer = setTimeout(
            () => resolve({ done: true, value: undefined, timedOut: true }),
            firstChunkTimeoutMs
          );
        }
      );
      const firstResult = await Promise.race([
        reader.read().then((res) => ({ ...res, timedOut: false })),
        timeoutPromise,
      ]);
      clearTimeout(firstTimer);

      if (firstResult.timedOut) {
        try {
          await reader.cancel('First token timeout');
        } catch {}
        return {
          ok: false,
          status: 408,
          errorBody: `Gemini first token timeout after ${firstChunkTimeoutMs}ms`,
        };
      }

      if (firstResult.done || !firstResult.value || firstResult.value.byteLength === 0) {
        try {
          await reader.cancel('Empty stream');
        } catch {}
        return {
          ok: false,
          status: 502,
          errorBody: 'Empty stream received from Gemini',
        };
      }

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const firstText = decoder.decode(firstResult.value, { stream: true });
      if (firstText.includes('"error":') || firstText.includes('"error" :')) {
        try {
          await reader.cancel('Gemini stream error');
        } catch {}
        const status = firstText.includes('429') ? 429 : 502;
        return {
          ok: false,
          status,
          errorBody: firstText,
          resetAt: readResetAtHeader(response.headers),
        };
      }

      const streamId = `chatcmpl-gemini-${Date.now()}`;
      let sentRole = false;
      let buffer = firstText;

      const emitLine = (
        line: string,
        streamController: ReadableStreamDefaultController<Uint8Array>
      ) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;

        let parsed: GeminiRawResponse;
        try {
          parsed = JSON.parse(payload) as GeminiRawResponse;
        } catch {
          return;
        }

        const candidate = parsed.candidates?.[0];
        if (!candidate) return;
        const text = (candidate.content?.parts ?? [])
          .map((p) => (typeof p.text === 'string' ? p.text : ''))
          .join('');
        const finishReason = candidate.finishReason
          ? this.mapFinishReason(candidate.finishReason)
          : null;

        if (!text && !finishReason) return;

        const delta: Record<string, string> = {};
        if (!sentRole) {
          delta.role = 'assistant';
          sentRole = true;
        }
        if (text) delta.content = text;

        const openAiChunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          model: modelId,
          choices: [
            {
              index: 0,
              delta,
              finish_reason: finishReason,
            },
          ],
        };
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
      };

      const transformedStream = new ReadableStream<Uint8Array>({
        async start(streamController) {
          try {
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) emitLine(line, streamController);

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!value) continue;
              buffer += decoder.decode(value, { stream: true });
              const nextLines = buffer.split(/\r?\n/);
              buffer = nextLines.pop() ?? '';
              for (const line of nextLines) emitLine(line, streamController);
            }

            buffer += decoder.decode();
            if (buffer.trim()) emitLine(buffer, streamController);
            streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
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
        stream: transformedStream,
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

  private extractText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return (content as ContentPart[])
        .filter((part): part is ContentPart & { text: string } => typeof part?.text === 'string')
        .map((part) => part.text)
        .join('\n');
    }
    return String(content ?? '');
  }

  private transformRequest(request: ChatRequest): GeminiRequest {
    const contents: GeminiContent[] = [];

    // 시스템 메시지 추출
    const systemMsg = request.messages.find((m: ChatMessage) => m.role === 'system');
    const systemText = systemMsg ? this.extractText(systemMsg.content) : '';

    let isFirstUser = true;

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        continue;
      }
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: GeminiPart[] = [];

      if (typeof msg.content === 'string') {
        const text = isFirstUser && systemText ? `${systemText}\n\n${msg.content}` : msg.content;
        parts.push({ text });
        if (role === 'user') isFirstUser = false;
      } else if (Array.isArray(msg.content)) {
        let prependedSystem = false;
        for (const item of msg.content as ContentPart[]) {
          if (item?.type === 'text' && typeof item.text === 'string') {
            const text =
              isFirstUser && !prependedSystem && systemText
                ? `${systemText}\n\n${item.text}`
                : item.text;
            parts.push({ text });
            prependedSystem = true;
          } else if (item?.type === 'image_url' && typeof item.image_url?.url === 'string') {
            const dataUrl = item.image_url.url;
            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              });
            }
          }
        }
        if (role === 'user') isFirstUser = false;
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    return {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens ?? 32768,
      },
    };
  }

  private transformResponse(raw: GeminiRawResponse, modelId: string): ChatResponse {
    const candidate = raw.candidates[0];
    const content = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = this.mapFinishReason(candidate?.finishReason);
    const usage = raw.usageMetadata;

    return {
      id: `chatcmpl-gemini-${Date.now()}`,
      object: 'chat.completion',
      model: modelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: usage?.promptTokenCount ?? 0,
        completion_tokens: usage?.candidatesTokenCount ?? 0,
        total_tokens: usage?.totalTokenCount ?? 0,
      },
    };
  }

  private mapFinishReason(reason?: string): 'stop' | 'length' | 'content_filter' | 'error' {
    if (!reason) return 'stop';
    const lower = reason.toLowerCase();
    if (lower.includes('max_token') || lower.includes('length')) return 'length';
    if (lower.includes('safety') || lower.includes('filter')) return 'content_filter';
    if (lower.includes('error') || lower.includes('fail')) return 'error';
    return 'stop';
  }
}
