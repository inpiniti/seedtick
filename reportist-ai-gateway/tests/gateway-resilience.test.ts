// gateway-resilience.test.ts - 반복 오류 방어(CORS/Supabase 인증/스테일 모델) 테스트
import { describe, expect, test } from 'bun:test';
import { app } from '../src/app.ts';
import { isSupabaseAuthError } from '../src/config/supabase.ts';
import { ModelService } from '../src/domain/models/ModelService.ts';

type ModelServiceInternals = {
  markModelUnavailable(id: string): void;
  isModelUnavailable(id: string): boolean;
  filterForConsumer<T extends { id: string }>(models: T[], includeAllOutputs: boolean): T[];
};

describe('Supabase 인증 오류 분류', () => {
  test('Invalid API key / 401 / 403은 인증 실패로 분류한다', () => {
    expect(isSupabaseAuthError({ message: 'Invalid API key' })).toBe(true);
    expect(isSupabaseAuthError({ code: '401', message: 'Unauthorized' })).toBe(true);
    expect(isSupabaseAuthError(new Error('JWT expired'))).toBe(true);
  });

  test('테이블 없음/네트워크 오류는 인증 실패가 아니다', () => {
    expect(isSupabaseAuthError({ code: '42P01', message: 'Could not find the table' })).toBe(false);
    expect(isSupabaseAuthError(new Error('fetch failed'))).toBe(false);
    expect(isSupabaseAuthError(null)).toBe(false);
  });
});

describe('CORS 프리플라이트', () => {
  test('브라우저가 요청한 헤더를 허용 목록에 반영한다', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/chat/completions', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://video.example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type, authorization, x-text-only-models',
        },
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-text-only-models');
    expect(response.headers.get('access-control-max-age')).toBe('600');
  });
});

describe('스테일 모델 제외', () => {
  test('404 모델을 표시하면 후보 목록에서 즉시 제거된다', () => {
    const service = new ModelService() as unknown as ModelServiceInternals;
    service.markModelUnavailable('recursive/flint-v1.0:free');

    expect(service.isModelUnavailable('recursive/flint-v1.0:free')).toBe(true);
    expect(
      service
        .filterForConsumer([{ id: 'recursive/flint-v1.0:free' }, { id: 'ok/model:free' }], true)
        .map((model) => model.id)
    ).toEqual(['ok/model:free']);
  });
});
