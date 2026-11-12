// AnthropicAdapter.ts - Anthropic Claude Messages API 어댑터 (OpenAI 규격 양방향 변환)

import type { ChatMessage, ChatRequest, ChatResponse, ProviderConfig } from '../../types.ts';
import type { ILLMAdapter } from './ILLMAdapter.ts';

export class AnthropicAdapter implements ILLMAdapter {
  private readonly baseUrl: string;

  constructor(config?: Partial<ProviderConfig>) {
    this.baseUrl = config?.baseUrl || 'https://api.anthropic.com/v1/messages';
  }

  private transformRequest(request: ChatRequest, modelId: string, isStream: boolean) {
    let systemPrompt = '';
    const anthropicMessages: Array<{
      role: 'user' | 'assistant';
      content: Array<
        | { type: 'text'; text: string }
        | {
            type: 'image';
            source: {
              type: 'base64';
              media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | string;
              data: string;
            };
          }
      >;
    }> = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        const sysText = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${sysText}` : sysText;
        continue;
      }

      const role: 'user' | 'assistant' = msg.role === 'assistant' ? 'assistant' : 'user';
      const parts: Array<
        | { type: 'text'; text: string }
        | {
            type: 'image';
            source: {
              type: 'base64';
              media_type: string;
              data: string;
            };
          }
      > = [];

      if (typeof msg.content === 'string') {
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (!item) continue;
          if (typeof item === 'string') {
            parts.push({ type: 'text', text: item });
          } else if (item.type === 'text' && typeof item.text === 'string') {
            parts.push({ type: 'text', text: item.text });
          } else if (item.type === 'image_url' && item.image_url?.url) {
            const url = item.image_url.url;
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: match[1],
                  data: match[2],
                },
              });
            }
          }
        }
      }

      if (parts.length > 0) {
        anthropicMessages.push({ role, content: parts });
      }
    }

    const maxTokens = request.max_tokens ?? 8192;
    const resolvedModel = modelId || 'claude-3-5-sonnet-20241022';

    const body: Record<string, unknown> = {
      model: resolvedModel,
      max_tokens: Math.min(maxTokens, 8192),
      messages: anthropicMessages,
      stream: isStream,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (typeof request.temperature === 'number') {
      body.temperature = Math.max(0, Math.min(1, request.temperature));
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
    const body = this.transformRequest(request, modelId, false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
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

      const rawData = JSON.parse(responseText);
      const textBlocks = Array.isArray(rawData.content)
        ? rawData.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('')
        : '';

      const normalizedResponse: ChatResponse = {
        id: rawData.id || `chatcmpl-claude-${Date.now()}`,
        object: 'chat.completion',
        model: modelId,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: textBlocks,
            },
            finish_reason: rawData.stop_reason === 'end_turn' ? 'stop' : (rawData.stop_reason || 'stop'),
          },
        ],
        usage: {
          prompt_tokens: rawData.usage?.input_tokens ?? 0,
          completion_tokens: rawData.usage?.output_tokens ?? 0,
          total_tokens: (rawData.usage?.input_tokens ?? 0) + (rawData.usage?.output_tokens ?? 0),
        },
      };

      return {
        ok: true,
        status: 200,
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
    const body = this.transformRequest(request, modelId, true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          Accept: 'text/event-stream',
        },
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
          errorBody: 'No response body from Anthropic',
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      // Anthropic SSE 스트림을 OpenAI 호환 SSE 스트림으로 실시간 변환
      const transformedStream = new ReadableStream<Uint8Array>({
        async start(streamController) {
          let buffer = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload) continue;

                try {
                  const parsed = JSON.parse(payload);
                  // 1) 텍스트 델타 감지
                  if (
                    parsed.type === 'content_block_delta' &&
                    parsed.delta?.type === 'text_delta' &&
                    typeof parsed.delta.text === 'string'
                  ) {
                    const openAiChunk = {
                      id: `chatcmpl-claude-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      choices: [
                        {
                          index: 0,
                          delta: {
                            content: parsed.delta.text,
                          },
                          finish_reason: null,
                        },
                      ],
                    };
                    streamController.enqueue(
                      encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`)
                    );
                  } else if (
                    parsed.type === 'content_block_delta' &&
                    parsed.delta?.type === 'thinking_delta' &&
                    typeof parsed.delta.thinking === 'string'
                  ) {
                    // Claude reasoning/thinking
                    const openAiChunk = {
                      id: `chatcmpl-claude-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      choices: [
                        {
                          index: 0,
                          delta: {
                            reasoning: parsed.delta.thinking,
                          },
                          finish_reason: null,
                        },
                      ],
                    };
                    streamController.enqueue(
                      encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`)
                    );
                  } else if (parsed.type === 'message_stop') {
                    streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
                  }
                } catch {
                  // 파싱 불가 라인 무시
                }
              }
            }

            // 남은 버퍼 처리
            if (buffer.trim().startsWith('data:')) {
              try {
                const payload = buffer.trim().slice(5).trim();
                const parsed = JSON.parse(payload);
                if (parsed.type === 'message_stop') {
                  streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
                }
              } catch {}
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
}
