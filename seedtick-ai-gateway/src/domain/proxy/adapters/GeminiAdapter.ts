// GeminiAdapter.ts - Gemini API 어댑터 (OpenAI 규격 변환)

import type { ChatMessage, ChatRequest, ChatResponse, ProviderConfig } from '../../types.ts';
import type { ILLMAdapter } from './ILLMAdapter.ts';

interface GeminiPart {
  text: string;
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
    timeoutMs = 60_000
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

  private transformRequest(request: ChatRequest): GeminiRequest {
    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // 시스템 메시지는 첫 user 메시지에 합치거나 별도 처리
        // 여기서는 첫 user 메시지 앞에 프리펜드로 처리
        continue;
      }
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // 시스템 메시지가 있다면 첫 user 메시지에 합치기
    const systemMsg = request.messages.find((m: ChatMessage) => m.role === 'system');
    if (systemMsg && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
    }

    return {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens ?? 2000,
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
