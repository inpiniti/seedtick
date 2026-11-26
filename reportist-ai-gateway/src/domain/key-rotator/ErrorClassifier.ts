// ErrorClassifier.ts - 에러 분류 로직

import type { ErrorCategory } from '../types.ts';

// OpenRouter free 티어는 PerDay 대신 자체 문구로 일일 한도를 알린다.
// 논스트림 응답에서도 스트림 어댑터와 같은 문구를 인식해야 키를 리셋 시각까지 쉬게 할 수 있다.
const DAILY_EXHAUSTED_PATTERN =
  /PerDay|per day|daily (?:limit|quota)|quota_limit_value|insufficient_quota|FreeUsageLimitError|Free usage limit reached|free.?usage.?limit|provider\.free-limit|BudgetLimitError|GoUsageLimitError/i;

// 404라도 모델이 삭제된 게 아니라 키/계정의 가드레일 정책으로 거부된 경우가 있다.
const GUARDRAIL_REJECTED_PATTERN =
  /guardrail|no endpoints .* available|matching your guardrail restrictions/i;

export class ErrorClassifier {
  classify(httpStatus: number, errorBody: string): ErrorCategory {
    if (httpStatus === 429) {
      const isDaily = DAILY_EXHAUSTED_PATTERN.test(errorBody);
      const isTPM = /TPM|token.*minute/i.test(errorBody);
      if (isDaily) return 'daily_exhausted';
      if (isTPM) return 'tpm_exceeded';
      return 'rpm_exceeded';
    }
    if (httpStatus === 400) {
      if (/context.length|maximum.context/i.test(errorBody)) return 'context_too_long';
      if (/max.output|output.token|max_tokens/i.test(errorBody)) return 'output_too_long';
      // 추론이 필수인 모델에 reasoning_effort=none을 보내면 키와 무관하게 400이 난다.
      if (
        /reasoning.*(mandatory|required|cannot be disabled)|cannot be disabled/i.test(errorBody)
      ) {
        return 'reasoning_mandatory';
      }
      if (/content.filter|safety/i.test(errorBody)) return 'safety_filter';
      return 'unknown';
    }
    if (httpStatus === 401) return 'unauthorized';
    if (httpStatus === 403) return 'forbidden';
    if (httpStatus === 404) {
      if (GUARDRAIL_REJECTED_PATTERN.test(errorBody)) return 'provider_rejected';
      return 'model_not_found';
    }
    if (httpStatus === 503) return 'server_overloaded';
    if (httpStatus === 504) return 'timeout';
    if (httpStatus === 408) return 'timeout';
    if (httpStatus === 0) return 'network_error';
    return 'unknown';
  }
}
