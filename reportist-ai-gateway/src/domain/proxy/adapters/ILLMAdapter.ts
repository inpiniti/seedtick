// ILLMAdapter.ts - 어댑터 인터페이스

import type { ChatRequest, ChatResponse } from '../../types.ts';

export interface ILLMAdapter {
  call(
    request: ChatRequest,
    modelId: string,
    apiKey: string,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<{
    ok: boolean;
    status: number;
    response?: ChatResponse;
    errorBody: string;
    /** 제공사가 응답에 알려준 리셋 시각 힌트 (x-ratelimit-reset / retry-after 헤더 값) */
    resetAt?: string | null;
  }>;

  callStream?(
    request: ChatRequest,
    modelId: string,
    apiKey: string,
    timeoutMs?: number
  ): Promise<{
    ok: boolean;
    status: number;
    stream?: ReadableStream<Uint8Array>;
    errorBody: string;
    /** 제공사가 응답에 알려준 리셋 시각 힌트 (x-ratelimit-reset / retry-after 헤더 값) */
    resetAt?: string | null;
  }>;
}
