// ILLMAdapter.ts - 어댑터 인터페이스

import type { ChatRequest, ChatResponse } from '../../types.ts';

export interface ILLMAdapter {
  call(
    request: ChatRequest,
    modelId: string,
    apiKey: string,
    timeoutMs?: number
  ): Promise<{
    ok: boolean;
    status: number;
    response?: ChatResponse;
    errorBody: string;
  }>;
}
