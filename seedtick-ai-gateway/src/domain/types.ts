// types.ts

// ─────────────────────────────────────────────
// 제공사 및 모델 정의
// ─────────────────────────────────────────────

export type LLMProvider = 'cline' | 'kilo' | 'openrouter' | 'gemini';

export interface ModelConfig {
  provider: LLMProvider;
  modelId: string;
  displayName: string;
}

export const FALLBACK_CHAIN: ModelConfig[] = [
  {
    provider: 'cline',
    modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    displayName: 'Cline/Nemotron',
  },
  { provider: 'kilo', modelId: 'kilo-auto/free', displayName: 'Kilo/Auto' },
  { provider: 'openrouter', modelId: 'openrouter/free', displayName: 'OpenRouter/Free' },
  { provider: 'gemini', modelId: 'gemini-3.5-flash-lite', displayName: 'Gemini/3.5Lite' },
  { provider: 'gemini', modelId: 'gemini-3.1-flash-lite', displayName: 'Gemini/3.1Lite' },
];

// ─────────────────────────────────────────────
// API 키 관리
// ─────────────────────────────────────────────

export interface ApiKeyPool {
  provider: LLMProvider;
  keys: string[];
}

// ─────────────────────────────────────────────
// OpenAI 규격 입출력 (공통 인터페이스)
// ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface ChatResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: ChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─────────────────────────────────────────────
// 에러 관련
// ─────────────────────────────────────────────

export type ErrorCategory =
  | 'rpm_exceeded'
  | 'tpm_exceeded'
  | 'daily_exhausted'
  | 'context_too_long'
  | 'output_too_long'
  | 'safety_filter'
  | 'unauthorized'
  | 'forbidden'
  | 'model_not_found'
  | 'server_overloaded'
  | 'timeout'
  | 'network_error'
  | 'unknown';

export interface GatewayAttempt {
  provider: LLMProvider;
  modelId: string;
  apiKeyHash: string;
  httpStatus: number;
  errorCategory: ErrorCategory;
  errorSnippet: string;
  attemptedAt: string;
}

export interface GatewayError {
  error: {
    code: 'GATEWAY_ALL_EXHAUSTED' | 'GATEWAY_AUTH_FAILED' | 'GATEWAY_MODEL_NOT_SUPPORTED';
    message: string;
    type: 'gateway_error';
    attempts: GatewayAttempt[];
  };
}

// ─────────────────────────────────────────────
// Supabase: 일일 소진 키 관리
// ─────────────────────────────────────────────

export interface QuotaExhaustedRecord {
  provider: LLMProvider;
  model: string;
  api_key_hash: string;
  exhausted_at: string;
  reset_at: string;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKeys: string[];
  defaultHeaders?: Record<string, string>;
  queryAuth?: boolean;
  transformResponse?: (raw: unknown) => ChatResponse;
}
