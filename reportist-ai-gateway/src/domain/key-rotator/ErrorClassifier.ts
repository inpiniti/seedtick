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
    // 어댑터가 빈 content(추론이 출력 예산을 소진)를 422로 표시해 보낸다.
    // 서버 과부하(500)로 뭉개지면 같은 모델의 11개 키를 낭비하므로 별도 카테고리로 분리한다.
    if (httpStatus === 422) {
      if (/reasoning|output tokens|empty content/i.test(errorBody)) return 'reasoning_exhausted';
      return 'unknown';
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
      if (/model is unavailable|model_not_found|unknown model/i.test(errorBody)) {
        return 'model_not_found';
      }
      return 'unknown';
    }
    if (httpStatus === 401) return 'unauthorized';
    if (httpStatus === 403) return 'forbidden';
    if (httpStatus === 404) {
      if (GUARDRAIL_REJECTED_PATTERN.test(errorBody)) return 'provider_rejected';
      return 'model_not_found';
    }
    if (httpStatus === 502 || httpStatus === 503) {
      // OpenCode 브리지가 502로 감싼 403/모델 비가용은 키/정책 문제이므로 즉시 차단한다.
      if (/workspace access denied|"status"\s*:\s*403|\b403\b/i.test(errorBody)) return 'forbidden';
      if (/model is unavailable|model_not_found/i.test(errorBody)) return 'model_not_found';
      return 'server_overloaded';
    }
    if (httpStatus === 504) return 'timeout';
    if (httpStatus === 408) return 'timeout';
    if (httpStatus === 0) return 'network_error';
    return 'unknown';
  }
}
