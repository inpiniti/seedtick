// error-classifier.test.ts
import { describe, expect, test } from 'bun:test';
import { ErrorClassifier } from '../src/domain/key-rotator/ErrorClassifier';
import type { ErrorCategory } from '../src/domain/types';

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  const testCases: [number, string, ErrorCategory][] = [
    [429, 'PerDay quota exceeded', 'daily_exhausted'],
    [429, 'per day limit reached', 'daily_exhausted'],
    [429, 'insufficient_quota', 'daily_exhausted'],
    [429, 'quota_limit_value exceeded', 'daily_exhausted'],
    [429, 'Rate limit exceeded RPM', 'rpm_exceeded'],
    [429, 'RPM limit exceeded', 'rpm_exceeded'],
    [429, 'TPM token per minute', 'tpm_exceeded'],
    [429, 'tokens per minute exceeded', 'tpm_exceeded'],
    [400, 'context_length_exceeded', 'context_too_long'],
    [400, 'maximum context length exceeded', 'context_too_long'],
    [400, 'max output tokens exceeded', 'output_too_long'],
    [400, 'max_tokens limit reached', 'output_too_long'],
    [400, 'content_filter violation', 'safety_filter'],
    [400, 'safety settings triggered', 'safety_filter'],
    [401, 'Unauthorized', 'unauthorized'],
    [401, 'Invalid API key', 'unauthorized'],
    [403, 'Forbidden', 'forbidden'],
    [403, 'Access denied', 'forbidden'],
    [404, 'Model not found', 'model_not_found'],
    [404, 'The model does not exist', 'model_not_found'],
    [503, 'Service unavailable', 'server_overloaded'],
    [503, 'Server overloaded', 'server_overloaded'],
    [504, 'Gateway timeout', 'timeout'],
    [504, 'Request timeout', 'timeout'],
  ];

  test.each(testCases)('HTTP %i + "%s" → %s', (status, body, expected) => {
    expect(classifier.classify(status, body)).toBe(expected);
  });

  test('알 수 없는 에러는 unknown 반환', () => {
    expect(classifier.classify(418, 'teapot')).toBe('unknown');
    expect(classifier.classify(500, 'internal error')).toBe('unknown');
  });
});
