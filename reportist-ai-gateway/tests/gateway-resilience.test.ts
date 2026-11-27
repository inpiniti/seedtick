// gateway-resilience.test.ts - 반복 오류 방어(CORS/가드레일/스테일 모델) 테스트
import { describe, expect, test, vi } from 'bun:test';
import { app } from '../src/app.ts';
import { ModelService, modelService } from '../src/domain/models/ModelService.ts';
import { ProxyService } from '../src/domain/proxy/ProxyService.ts';
import type { FreeModelMeta } from '../src/domain/types.ts';

type ModelServiceInternals = {
  markModelUnavailable(id: string): void;
  isModelUnavailable(id: string): boolean;
  filterForConsumer<T extends { id: string }>(models: T[], includeAllOutputs: boolean): T[];
};

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

type ProxyServiceInternals = {
  handleError(
    category: 'provider_rejected',
    provider: 'openrouter',
    modelId: string,
    apiKey: string,
    allKeys: string[]
  ): Promise<void>;
};

describe('가드레일 거부(404) 처리', () => {
  test('모델을 제외하지 않고 해당 키만 건너뛴다', async () => {
    const stubLogger = {
      critical: async () => {},
      warning: async () => {},
      info: () => {},
    } as unknown as NonNullable<ConstructorParameters<typeof ProxyService>[0]>;
    const service = new ProxyService(stubLogger, [
      { provider: 'openrouter', keys: ['guardrail-test-key'] },
    ]) as unknown as ProxyServiceInternals;
    const modelId = 'test/guardrail-model:free';

    await service.handleError('provider_rejected', 'openrouter', modelId, 'guardrail-test-key', [
      'guardrail-test-key',
    ]);

    expect(modelService.isModelUnavailable(modelId)).toBe(false);
  });
});

type ResolveInternals = {
  resolveTargetModels(
    requestedModel: string | undefined,
    requiredInputs: Array<'text' | 'image' | 'audio' | 'video'>,
    outputModality: 'text' | 'image' | 'audio' | 'video',
    textOnlyModels?: boolean
  ): Promise<string[]>;
};

describe('명시 모델 실패 시 자동 대체', () => {
  test('요청 모델 뒤에 자동 후보가 이어져 실패 시 다음 모델로 넘어간다', async () => {
    const stubLogger = {
      critical: async () => {},
      warning: async () => {},
      info: () => {},
    } as unknown as NonNullable<ConstructorParameters<typeof ProxyService>[0]>;
    const service = new ProxyService(stubLogger, []) as unknown as ResolveInternals;
    const pool = ['auto/a:free', 'auto/b:free'];
    const spy = vi
      .spyOn(modelService, 'selectBestModel')
      .mockImplementation(async ({ excludeIds }) => {
        const next = pool.find((id) => !excludeIds?.includes(id));
        return next ? ({ id: next } as FreeModelMeta) : null;
      });

    try {
      const models = await service.resolveTargetModels(
        'explicit/model:free',
        ['text'],
        'text',
        true
      );
      expect(models[0]).toBe('explicit/model:free');
      expect(models.slice(1)).toEqual(pool);
    } finally {
      spy.mockRestore();
    }
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
