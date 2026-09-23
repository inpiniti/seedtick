// ErrorClassifier.ts - 에러 분류 로직

import type { ErrorCategory } from '../types';

export class ErrorClassifier {
  classify(httpStatus: number, errorBody: string): ErrorCategory {
    if (httpStatus === 429) {
      const isDaily = /PerDay|per day|quota_limit_value|insufficient_quota/i.test(errorBody);
      const isTPM = /TPM|token.*minute/i.test(errorBody);
      if (isDaily) return 'daily_exhausted';
      if (isTPM) return 'tpm_exceeded';
      return 'rpm_exceeded';
    }
    if (httpStatus === 400) {
      if (/context.length|maximum.context/i.test(errorBody)) return 'context_too_long';
      if (/max.output|output.token/i.test(errorBody)) return 'output_too_long';
      if (/content.filter|safety/i.test(errorBody)) return 'safety_filter';
      return 'unknown';
    }
    if (httpStatus === 401) return 'unauthorized';
    if (httpStatus === 403) return 'forbidden';
    if (httpStatus === 404) return 'model_not_found';
    if (httpStatus === 503) return 'server_overloaded';
    if (httpStatus === 504) return 'timeout';
    if (httpStatus === 408) return 'timeout';
    if (httpStatus === 0) return 'network_error';
    return 'unknown';
  }
}
