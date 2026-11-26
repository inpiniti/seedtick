// types.ts

// ─────────────────────────────────────────────
// 제공사 및 모델 정의
// ─────────────────────────────────────────────

export type LLMProvider = 'cline' | 'kilo' | 'openrouter' | 'gemini' | 'opencode';

export type UserPassThroughProvider =
  | 'openai'
  | 'claude'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'grok'
  | 'xai'
  | 'qwen'
  | 'glm'
  | 'kimi'
  | 'moonshot'
  | 'minimax'
  | 'mimo'
  | 'muse'
  | 'custom';

export interface UserPassThroughConfig {
  provider: UserPassThroughProvider | string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface ModelConfig {
  provider: LLMProvider;
  modelId: string;
  displayName: string;
}

export const FALLBACK_CHAIN: ModelConfig[] = [
  // 1순위: Ling 3.0 Flash Fin — 금융 특화, 121 t/s 초고속, thinking 없이 깔끔한 output
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
  // 3순위 (fallback): Dots3-Note Preview — thinking 모델, 응급 fallback용
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
];

// ─────────────────────────────────────────────
// API 키 관리
// ─────────────────────────────────────────────

export interface ApiKeyPool {
  provider: LLMProvider;
  keys: string[];
}

export interface KeySlot {
  provider: LLMProvider;
  key: string;
}

// ─────────────────────────────────────────────
// OpenAI 규격 입출력 (공통 인터페이스)
// ─────────────────────────────────────────────

export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } }
  | { type: 'video_url'; video_url: { url: string } }
  | { type: string; [key: string]: unknown };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | (string & {});
  content: string | MessageContentPart[] | unknown;
}

export type ReasoningEffortLevel =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'extra'
  | 'max'
  | '낮음'
  | '중간'
  | '높음'
  | '엑스트라'
  | '최대';

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  reasoning_effort?: ReasoningEffortLevel | string;
  data_collection?: 'allow' | 'deny';
  zdr?: boolean;
}

// ─────────────────────────────────────────────
// 이미지 생성 (OpenRouter /api/v1/images)
// ─────────────────────────────────────────────

export interface ImageGenerationRequest {
  model?: string;
  prompt: string;
  n?: number;
  aspect_ratio?: string;
  data_collection?: 'allow' | 'deny';
  zdr?: boolean;
}

export interface GeneratedImageData {
  /** 화면에 바로 표시할 수 있는 data URL (data:image/...;base64,...) */
  url: string;
  mediaType: string;
}

export interface ImageGenerationResponse {
  created: number;
  data: GeneratedImageData[];
  usage?: Record<string, unknown>;
}

export interface FreeModelMeta {
  id: string;
  name: string;
  providerName: string;
  created: number;
  createdDate: string;
  daysAgo: number;
  contextLength: number;
  contextLengthFormatted: string;
  description: string;
  modality: string;
  inputModalities?: string[];
  /** 모델이 생성하는 출력 모달리티 (예: ['image'], ['text']) */
  outputModalities?: string[];
  /** 텍스트 프롬프트로 이미지를 생성하는 모델 여부 */
  isImageGenerationModel?: boolean;
  intelligenceIndex?: number | null;
  codingIndex?: number | null;
  agenticIndex?: number | null;
  supportedEfforts?: string[];
  defaultEffort?: string | null;
  reasoningMandatory?: boolean;
  /** 추론(thinking) 지원 여부 */
  supportsReasoning?: boolean;
  /** 도구 호출 지원 여부 */
  supportsTools?: boolean;
  /** 구조화 출력 지원 여부 */
  supportsStructuredOutput?: boolean;
  /** 추론 on/off 토글 지원 여부 */
  reasoningToggle?: boolean;
  /** 모델 상세 스펙 문서 URL */
  docsUrl?: string;
  /** OpenRouter 제공사 데이터 정책 (학습/보관 관련) */
  dataPolicy?: ModelDataPolicy;
  /** p50 기준 추론 속도(tokens/sec) */
  speedTokensPerSecond?: number | null;
  /** p50 기준 첫 토큰 지연(ms) */
  latencyMs?: number | null;
  intelligenceTier: string;
  parametersSummary: string;
  supportedParameters: string[];
}

export interface ModelDataPolicy {
  training?: boolean;
  trainingOpenRouter?: boolean;
  retainsPrompts?: boolean;
  retentionDays?: number | null;
  safetyRetention?: boolean;
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
  | 'reasoning_mandatory'
  | 'safety_filter'
  | 'unauthorized'
  | 'forbidden'
  | 'model_not_found'
  | 'provider_rejected'
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
    code:
      | 'GATEWAY_ALL_EXHAUSTED'
      | 'GATEWAY_AUTH_FAILED'
      | 'GATEWAY_MODEL_NOT_SUPPORTED'
      | 'GATEWAY_OPENCODE_EXHAUSTED';
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
  /** 키를 Authorization 대신 지정한 헤더로 전달할 때 사용 (브릿지의 X-OpenCode-Api-Key). */
  keyHeaderName?: string;
  queryAuth?: boolean;
  transformResponse?: (raw: unknown) => ChatResponse;
}
