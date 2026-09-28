// error-log.test.ts - ErrorLogService 단위 테스트
import { describe, expect, test, vi } from 'bun:test';
import { ErrorLogService } from '../src/domain/error-log/ErrorLogService.ts';

describe('ErrorLogService', () => {
  test('로그 호출 시 error_logs 테이블에 올바른 row를 insert한다', async () => {
    let insertedRow: unknown = null;
    const mockClient = {
      from: vi.fn((table: string) => ({
        insert: vi.fn(async (row: unknown) => {
          insertedRow = row;
          return { error: null };
        }),
      })),
    };

    const service = new ErrorLogService(mockClient as any);

    await service.critical('GATEWAY_ALL_KEYS_EXHAUSTED', '모든 키 소진', {
      attempts: 3,
    });

    expect(mockClient.from).toHaveBeenCalledWith('error_logs');
    expect(insertedRow).toEqual({
      level: 'CRITICAL',
      logger_name: 'ai_gateway',
      code: 'GATEWAY_ALL_KEYS_EXHAUSTED',
      message: '모든 키 소진',
      context: { attempts: 3 },
    });
  });

  test('warning, error, info 헬퍼 메서드가 각 레벨로 정상 호출된다', async () => {
    const insertedLevels: string[] = [];
    const mockClient = {
      from: vi.fn(() => ({
        insert: vi.fn(async (row: any) => {
          insertedLevels.push(row.level);
          return { error: null };
        }),
      })),
    };

    const service = new ErrorLogService(mockClient as any);

    await service.info('TEST_INFO', '정보');
    await service.warning('TEST_WARN', '경고');
    await service.error('TEST_ERR', '에러');

    expect(insertedLevels).toEqual(['INFO', 'WARNING', 'ERROR']);
  });
});
