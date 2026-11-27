// error-log.test.ts - ErrorLogService 단위 테스트 (콘솔 로깅)
import { afterEach, describe, expect, test, vi } from 'bun:test';
import { ErrorLogService } from '../src/domain/error-log/ErrorLogService.ts';

describe('ErrorLogService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('로그 레벨에 맞는 콘솔 메서드로 구조화된 이벤트를 남긴다', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {});
    errors.mockClear();
    warns.mockClear();
    infos.mockClear();

    const service = new ErrorLogService();
    await service.critical('GATEWAY_ALL_KEYS_EXHAUSTED', '모든 키 소진', { attempts: 3 });
    await service.warning('TEST_WARN', '경고');
    await service.info('TEST_INFO', '정보');

    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0]?.[0]).toContain('CRITICAL GATEWAY_ALL_KEYS_EXHAUSTED');
    expect(errors.mock.calls[0]?.[1]).toEqual({ attempts: 3 });
    expect(warns.mock.calls[0]?.[0]).toContain('WARNING TEST_WARN');
    expect(infos.mock.calls[0]?.[0]).toContain('INFO TEST_INFO');
  });

  test('warning/error/critical 헬퍼가 각 레벨을 유지한다', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errors.mockClear();
    warns.mockClear();

    const service = new ErrorLogService();
    await service.error('TEST_ERR', '에러');
    await service.warning('TEST_WARN', '경고');
    await service.critical('TEST_CRIT', '치명적');

    expect(errors).toHaveBeenCalledTimes(2);
    expect(warns).toHaveBeenCalledTimes(1);
  });
});
