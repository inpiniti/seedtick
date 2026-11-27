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
    allKeys: string[],
    resetHint?: { errorBody?: string }
  ): Promise<void>;
  shouldBreakModelLoop(
    category: 'provider_rejected',
    provider: 'openrouter',
    modelId: string
  ): boolean;
  getCooldownMap(): Map<string, { expiresAt: number | null; reason: string }>;
};

function createStubLogger(
  warnings: Array<{ code: string; context?: Record<string, unknown> }> = []
): NonNullable<ConstructorParameters<typeof ProxyService>[0]> {
  return {
    critical: async () => {},
    warning: async (code: string, _message: string, context?: Record<string, unknown>) => {
      warnings.push({ code, context });
    },
    info: () => {},
  } as unknown as NonNullable<ConstructorParameters<typeof ProxyService>[0]>;
}

describe('가드레일 거부(404) 처리', () => {
  test('모델을 제외하지 않고 해당 키만 건너뛴다', async () => {
    const service = new ProxyService(createStubLogger(), [
      { provider: 'openrouter', keys: ['guardrail-test-key'] },
    ]) as unknown as ProxyServiceInternals;
    const modelId = 'test/guardrail-model:free';

    await service.handleError('provider_rejected', 'openrouter', modelId, 'guardrail-test-key', [
      'guardrail-test-key',
    ]);

    expect(modelService.isModelUnavailable(modelId)).toBe(false);
    expect(service.shouldBreakModelLoop('provider_rejected', 'openrouter', modelId)).toBe(false);
  });

  test('거부 사유 스니펫을 로그에 남겨 원인을 확인할 수 있다', async () => {
    const warnings: Array<{ code: string; context?: Record<string, unknown> }> = [];
    const service = new ProxyService(createStubLogger(warnings), [
      { provider: 'openrouter', keys: ['guardrail-test-key'] },
    ]) as unknown as ProxyServiceInternals;

    await service.handleError(
      'provider_rejected',
      'openrouter',
      'test/snippet-model:free',
      'guardrail-test-key',
      ['guardrail-test-key'],
      {
        errorBody:
          '0 endpoints out of 1 requested are available matching your guardrail restrictions',
      }
    );

    expect(warnings[0]?.code).toBe('GATEWAY_PROVIDER_REJECTED');
    expect(warnings[0]?.context?.errorSnippet).toContain('guardrail restrictions');
  });

  test('같은 키가 반복 거부되면 키 쿨다운을 하루로 늘린다', async () => {
    const warnings: Array<{ code: string; context?: Record<string, unknown> }> = [];
    const key = 'key-repeat1234';
    const service = new ProxyService(createStubLogger(warnings), [
      { provider: 'openrouter', keys: [key] },
    ]) as unknown as ProxyServiceInternals;
    const modelId = 'test/repeat-key-model:free';

    await service.handleError('provider_rejected', 'openrouter', modelId, key, [key]);
    expect(
      service.getCooldownMap().get(`openrouter:${modelId}:${key.slice(-8)}`)?.expiresAt
    ).toBeLessThan(Date.now() + 11 * 60_000);

    for (let attempt = 2; attempt <= 3; attempt++) {
      await service.handleError('provider_rejected', 'openrouter', modelId, key, [key]);
      expect(warnings.at(-1)?.context?.keyRejections).toBe(attempt);
    }

    const expiresAt = service
      .getCooldownMap()
      .get(`openrouter:${modelId}:${key.slice(-8)}`)?.expiresAt;
    expect(expiresAt).toBeGreaterThan(Date.now() + 23 * 60 * 60_000);
  });

  test('서로 다른 키에서 반복되면 모델 단위로 차단하고 다음 모델로 넘어간다', async () => {
    const warnings: Array<{ code: string; context?: Record<string, unknown> }> = [];
    const firstKey = 'key-aaa11111';
    const secondKey = 'key-bbb22222';
    const keys = [firstKey, secondKey];
    const service = new ProxyService(createStubLogger(warnings), [
      { provider: 'openrouter', keys },
    ]) as unknown as ProxyServiceInternals;
    const modelId = 'test/escalating-model:free';

    await service.handleError('provider_rejected', 'openrouter', modelId, firstKey, keys);
    expect(service.shouldBreakModelLoop('provider_rejected', 'openrouter', modelId)).toBe(false);

    await service.handleError('provider_rejected', 'openrouter', modelId, secondKey, keys);
    expect(modelService.isModelUnavailable(modelId)).toBe(false);
    expect(service.shouldBreakModelLoop('provider_rejected', 'openrouter', modelId)).toBe(true);
    expect(service.getCooldownMap().get(`openrouter:${modelId}:bbb22222`)?.reason).toBe(
      'provider_rejected'
    );
    expect(warnings.at(-1)?.context?.distinctKeys).toBe(2);
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
