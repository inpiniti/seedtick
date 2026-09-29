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
  // 1순위: Dots Studio Dots3-Note Preview — 무료, 512K context, 57 t/s (빠르고 안정적)
  {
    provider: 'openrouter',
    modelId: 'dots-studio/dots-3-note-preview:free',
    displayName: 'OpenRouter/Dots3-Note-Preview',
  },
  {
    provider: 'cline',
    modelId: 'dots-studio/dots-3-note-preview:free',
    displayName: 'Cline/Dots3-Note-Preview',
  },
  {
    provider: 'kilo',
    modelId: 'dots-studio/dots-3-note-preview:free',
    displayName: 'Kilo/Dots3-Note-Preview',
  },
  // 2순위: NVIDIA Nemotron 3 Super (120B/A12B) — 무료, 262K context, 69 t/s 초고속
  {
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'OpenRouter/Nemotron-3-Super-120B',
  },
  {
    provider: 'cline',
    modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'Cline/Nemotron-3-Super-120B',
  },
  {
    provider: 'kilo',
    modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'Kilo/Nemotron-3-Super-120B',
  },
  // 3순위: Ling 3.0 Flash Fin — 121 t/s 초고속 최후 fallback
  {
    provider: 'openrouter',
    modelId: 'inclusionai/ling-3.0-flash-fin:free',
    displayName: 'OpenRouter/Ling-3.0-Flash-Fin',
  },
  {
    provider: 'cline',
    modelId: 'inclusionai/ling-3.0-flash-fin:free',
    displayName: 'Cline/Ling-3.0-Flash-Fin',
  },
  {
    provider: 'kilo',
    modelId: 'inclusionai/ling-3.0-flash-fin:free',
    displayName: 'Kilo/Ling-3.0-Flash-Fin',
  },
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
