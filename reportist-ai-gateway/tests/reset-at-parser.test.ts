// reset-at-parser.test.ts - 일일 소진 리셋 시각 파싱 및 24시간 폴백 검증
import { describe, expect, it } from 'bun:test';
import { QuotaManager } from '../src/domain/key-rotator/QuotaManager.ts';
import {
  DAILY_QUOTA_WINDOW_MS,
  fallbackResetAt,
  parseResetAt,
  readResetAtHeader,
} from '../src/domain/key-rotator/ResetAtParser.ts';

const NOW = Date.parse('2026-11-27T05:00:00.000Z');

describe('parseResetAt', () => {
  it('힌트가 없으면 null을 반환한다', () => {
    expect(parseResetAt(undefined, NOW)).toBeNull();
    expect(parseResetAt('', NOW)).toBeNull();
  });

  it('유닉스 초 헤더 값을 밀리초로 변환한다', () => {
    const targetSec = (NOW + 3 * 3_600_000) / 1000;
    expect(parseResetAt(String(targetSec), NOW)).toBe(NOW + 3 * 3_600_000);
  });

  it('ISO 8601 문자열을 읽는다', () => {
    const iso = '2026-11-28T00:00:00Z';
    expect(parseResetAt(`"message":"Rate limit exceeded. Resets at ${iso}"`, NOW)).toBe(
      Date.parse(iso)
    );
  });

  it('에러 메시지의 상대 시간을 읽는다', () => {
    expect(parseResetAt('daily quota exceeded. Try again in 3h 12m', NOW)).toBe(
      NOW + 3 * 3_600_000 + 12 * 60_000
    );
    expect(parseResetAt('free usage limit reached, retry after 90 seconds', NOW)).toBe(
      NOW + 90_000
    );
    expect(parseResetAt('일일 소진, 1시간 30분 후 사용 가능', NOW)).toBe(
      NOW + 3_600_000 + 30 * 60_000
    );
  });

  it('이미 지난 시각이나 비정상적으로 먼 미래는 무시한다', () => {
    expect(parseResetAt('2026-11-26T00:00:00Z', NOW)).toBeNull();
    expect(parseResetAt('2099-01-01T00:00:00Z', NOW)).toBeNull();
    expect(parseResetAt('try again in 999h', NOW)).toBeNull();
  });

  it('readResetAtHeader는 정의된 헤더를 우선순위대로 읽는다', () => {
    const headers = new Headers({
      'x-ratelimit-reset': '1764230400',
      'retry-after': '120',
    });
    expect(readResetAtHeader(headers)).toBe('1764230400');
    expect(readResetAtHeader(new Headers())).toBeNull();
  });

  it('폴백은 소진 시점 + 24시간이다', () => {
    expect(fallbackResetAt(NOW)).toBe(NOW + DAILY_QUOTA_WINDOW_MS);
  });
});

describe('QuotaManager 리셋 시각 기록', () => {
  it('힌트가 없으면 소진 시점 + 24시간을 기록한다', async () => {
    const manager = new QuotaManager();
    const before = Date.now();
    await manager.markExhausted('openrouter', 'test-model', 'sk-or-v1-abcdefgh');
    const after = Date.now();

    const map = manager.getExhaustedMap();
    const resetAt = map.get('openrouter:test-model:abcdefgh');
    expect(resetAt).toBeDefined();
    expect(resetAt ?? 0).toBeGreaterThanOrEqual(before + DAILY_QUOTA_WINDOW_MS);
    expect(resetAt ?? 0).toBeLessThanOrEqual(after + DAILY_QUOTA_WINDOW_MS);
  });

  it('제공사가 알려준 리셋 시각이 있으면 그 값을 사용한다', async () => {
    const manager = new QuotaManager();
    const header = String(Math.floor((Date.now() + 5 * 3_600_000) / 1000));
    await manager.markExhausted('openrouter', 'test-model', 'sk-or-v1-abcdefgh', {
      header,
      errorBody: '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}',
    });

    const resetAt = manager.getExhaustedMap().get('openrouter:test-model:abcdefgh');
    expect(Math.abs((resetAt ?? 0) - Number(header) * 1000)).toBeLessThan(2000);
  });

  it('계정 전체 일일 한도(free-models-per-day)면 같은 제공사의 다른 모델도 소진으로 본다', async () => {
    const manager = new QuotaManager();
    await manager.markExhausted('openrouter', 'model-a:free', 'sk-or-v1-abcdefgh', {
      errorBody: '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}',
    });

    expect(manager.isExhaustedLocal('openrouter', 'model-a:free', 'sk-or-v1-abcdefgh')).toBe(true);
    expect(manager.isExhaustedLocal('openrouter', 'model-b:free', 'sk-or-v1-abcdefgh')).toBe(true);
  });
});
