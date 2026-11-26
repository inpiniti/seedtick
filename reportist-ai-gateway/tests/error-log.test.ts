// error-log.test.ts - ErrorLogService 단위 테스트
import { describe, expect, test, vi } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorLogService } from '../src/domain/error-log/ErrorLogService.ts';

describe('ErrorLogService', () => {
  test('로그 호출 시 error_logs 테이블에 올바른 row를 insert한다', async () => {
    let insertedRow: unknown = null;
    const mockClient = {
      from: vi.fn((_table: string) => ({
        insert: vi.fn(async (row: unknown) => {
          insertedRow = row;
          return { error: null };
        }),
      })),
    };

    const service = new ErrorLogService(mockClient as unknown as SupabaseClient);

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
        insert: vi.fn(async (row: { level?: string }) => {
          insertedLevels.push(row.level ?? '');
          return { error: null };
        }),
      })),
    };

    const service = new ErrorLogService(mockClient as unknown as SupabaseClient);

    await service.info('TEST_INFO', '정보');
    await service.warning('TEST_WARN', '경고');
    await service.error('TEST_ERR', '에러');

    expect(insertedLevels).toEqual(['INFO', 'WARNING', 'ERROR']);
  });

  test('Supabase 연결 실패 시 서킷브레이커로 5분간 재시도하지 않는다', async () => {
    let insertCalls = 0;
    const mockClient = {
      from: vi.fn(() => ({
        insert: vi.fn(async () => {
          insertCalls += 1;
          throw new Error('Unable to connect to Supabase');
        }),
      })),
    };

    const service = new ErrorLogService(mockClient as unknown as SupabaseClient);
    await service.warning('NETWORK_FAIL', '연결 실패');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await service.warning('NETWORK_FAIL', '또 다른 로그');

    expect(insertCalls).toBe(1);
  });

  test('Invalid API key 오류는 원격 로깅을 중단하고 반복 insert하지 않는다', async () => {
    let insertCalls = 0;
    const mockClient = {
      from: vi.fn(() => ({
        insert: vi.fn(async () => {
          insertCalls += 1;
          return { error: { message: 'Invalid API key' } };
        }),
      })),
    };

    const service = new ErrorLogService(mockClient as unknown as SupabaseClient);
    await service.warning('AUTH_FAIL', '첫 로그');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await service.warning('AUTH_FAIL', '두 번째 로그');

    expect(insertCalls).toBe(1);
  });
});
