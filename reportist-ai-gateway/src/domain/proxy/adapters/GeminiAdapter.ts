// GeminiAdapter.ts - Gemini API 어댑터 (OpenAI 규격 변환)

import type { ChatMessage, ChatRequest, ChatResponse, ProviderConfig } from '../../types.ts';
import type { ILLMAdapter } from './ILLMAdapter.ts';

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

  private extractText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter((part: any) => part?.type === 'text' && typeof part?.text === 'string')
        .map((part: any) => part.text)
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
        for (const item of msg.content as any[]) {
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
