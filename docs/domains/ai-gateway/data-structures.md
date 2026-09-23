# AI-Gateway 데이터 구조

```typescript
// types.ts

// ─────────────────────────────────────────────
// 제공사 및 모델 정의
// ─────────────────────────────────────────────

export type LLMProvider = 'openrouter' | 'cline' | 'kilo' | 'gemini'

export interface ModelConfig {
  provider: LLMProvider
  modelId: string       // API에 실제로 전달하는 모델 문자열
  displayName: string   // 로깅용 이름
}

// 폴백 체인 정의 (OpenRouter → Cline → Kilo, 모델: inclusionai/ling-3.0-flash-fin:free)
export const FALLBACK_CHAIN: ModelConfig[] = [
  { provider: 'openrouter', modelId: 'inclusionai/ling-3.0-flash-fin:free', displayName: 'OpenRouter/Ling-3.0-Flash-Fin' },
  { provider: 'cline', modelId: 'inclusionai/ling-3.0-flash-fin:free', displayName: 'Cline/Ling-3.0-Flash-Fin' },
  { provider: 'kilo', modelId: 'inclusionai/ling-3.0-flash-fin:free', displayName: 'Kilo/Ling-3.0-Flash-Fin' },
]

// ─────────────────────────────────────────────
// API 키 관리 및 동시성 상태
// ─────────────────────────────────────────────

export interface ApiKeyPool {
  provider: LLMProvider
  keys: string[]
}

export interface KeyStateInfo {
  index: number         // 등록된 1-based 인덱스
  apiKeyHash: string    // 키 끝 8자리
  active: number        // 현재 처리 중인 인플라이트 요청 수
}

// ─────────────────────────────────────────────
// OpenAI 규격 입출력 (공통 인터페이스)
// ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model?: string          // 무시됨 (gateway가 자동 선택)
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ChatChoice {
  index: number
  message: ChatMessage
  finish_reason: 'stop' | 'length' | 'content_filter' | 'error'
}

export interface ChatResponse {
  id: string
  object: 'chat.completion'
  model: string           // 실제 사용된 모델 ID (디버깅용)
  choices: ChatChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ─────────────────────────────────────────────
// 에러 관련
// ─────────────────────────────────────────────

export type ErrorCategory =
  | 'rpm_exceeded'        // 429, 분당 제한
  | 'tpm_exceeded'        // 429, 분당 토큰 제한
  | 'daily_exhausted'     // 429, 일일 할당량 소진 → Supabase 기록
  | 'context_too_long'    // 400, 컨텍스트 초과
  | 'output_too_long'     // 400, 출력 초과
  | 'safety_filter'       // 400/200, 안전 필터 차단
  | 'unauthorized'        // 401
  | 'forbidden'           // 403
  | 'model_not_found'     // 404
  | 'server_overloaded'   // 503
  | 'timeout'             // 504
  | 'unknown'             // 그 외

export interface GatewayAttempt {
  provider: LLMProvider
  modelId: string
  apiKeyHash: string      // 끝 8자
  httpStatus: number
  errorCategory: ErrorCategory
  errorSnippet: string    // 에러 메시지 앞 200자
  attemptedAt: string     // ISO 8601
}

export interface GatewayError {
  error: {
    code: 'GATEWAY_ALL_EXHAUSTED' | 'GATEWAY_AUTH_FAILED' | 'GATEWAY_MODEL_NOT_SUPPORTED'
    message: string
    type: 'gateway_error'
    attempts: GatewayAttempt[]  // 시도 이력 (디버깅용)
  }
}

// ─────────────────────────────────────────────
// Supabase: 일일 소진 키 관리
// ─────────────────────────────────────────────

export interface QuotaExhaustedRecord {
  provider: LLMProvider
  model: string
  api_key_hash: string
  exhausted_at: string    // ISO 8601
  reset_at: string        // ISO 8601 (제공사 기준 자정)
}
```
