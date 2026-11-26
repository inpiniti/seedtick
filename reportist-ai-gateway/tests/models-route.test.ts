// tests/models-route.test.ts - 모델 목록 엔드포인트 및 ModelService 테스트
//
// 주의: 이 테스트는 실제 OpenRouter API를 호출하지 않는다. 라이브 무료 모델 수는
// 시시각각 변하므로(예: 2026-11 기준 11개) 개수 가정이 담긴 테스트가 자주 깨졌다.
// 대신 고정된 픽스처로 fetch를 대체해 변환 로직·메타데이터·이미지 모델 병합을 검증한다.

import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { app } from '../src/app.ts';
import { modelService } from '../src/domain/models/ModelService.ts';

// OpenRouter /api/v1/models 응답과 동일한 형태의 텍스트 무료 모델 16개.
const FIXTURE_MODELS = Array.from({ length: 16 }, (_, i) => ({
  id: `test/fixture-model-${i}:free`,
  name: `Fixture Model ${i}`,
  created: 1792627200 - i * 86_400,
  context_length: 262_144,
  description: `Fixture model ${i}: a coding agent with 2.5B active parameters out of 40B total.`,
  architecture: {
    modality: 'text->text',
    input_modalities: ['text'],
    output_modalities: ['text'],
  },
  supported_parameters: ['temperature', 'tools'],
  benchmarks: {},
  reasoning: {},
}));
FIXTURE_MODELS.push({
  id: 'test/fixture-speech-model:free',
  name: 'Fixture Speech Model',
  created: 1792627200,
  context_length: 131072,
  description: 'Fixture speech model',
  architecture: {
    modality: 'text->audio',
    input_modalities: ['text'],
    output_modalities: ['audio'],
  },
  supported_parameters: ['temperature'],
  benchmarks: {},
  reasoning: {},
});

let fetchSpy: ReturnType<typeof spyOn> | null = null;

// 싱글턴이 다른 테스트 파일의 라이브 호출로 캐시된 상태여도 항상 픽스처에서 시작하도록
// 테스트 범위에서만 내부 캐시를 초기화한다 (프로덕션 코드 변경 없음).
type CacheState = { cache: unknown; lastFetchTime: number };
const resetModelCache = () => {
  const state = modelService as unknown as CacheState;
  state.cache = null;
  state.lastFetchTime = 0;
};

describe('ModelService & Models Route', () => {
  beforeEach(() => {
    resetModelCache();
    const mockFetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/frontend/v1/models/find')) {
        return new Response(
          JSON.stringify({
            data: {
              endpoint_perf: {
                ep_0: { p50_throughput: 120, p50_latency: 420 },
              },
              models: [
                {
                  slug: 'test/fixture-model-0',
                  endpoint: {
                    id: 'ep_0',
                    provider_info: { dataPolicy: { training: false, retainsPrompts: false } },
                  },
                },
                {
                  slug: 'test/frontend-speech-model',
                  name: 'Fixture Speech Model (free)',
                  description: 'Text to speech test model',
                  created_at: '2026-11-18T03:54:16.556Z',
                  input_modalities: ['text'],
                  output_modalities: ['speech'],
                  context_length: 0,
                  endpoint: {
                    id: 'ep_0',
                    model_variant_slug: 'test/frontend-speech-model:free',
                    provider_display_name: 'Fixture Speech',
                    provider_info: { dataPolicy: { training: false, retainsPrompts: true } },
                    supported_parameters: [],
                  },
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
      return new Response(JSON.stringify({ data: FIXTURE_MODELS }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
  });

  afterAll(() => {
    fetchSpy?.mockRestore();
  });

  it('ModelService.getFreeModels() should return list of free models with metadata', async () => {
    const models = await modelService.getFreeModels();
    expect(models.length).toBeGreaterThanOrEqual(15);

    const first = models[0];
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.createdDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.contextLengthFormatted).toBeDefined();
    expect(first.intelligenceTier).toBeDefined();
    expect(first.parametersSummary).toBeDefined();
  });

  it('GET /v1/models should return 200 and json with free models', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/models', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { object: string; data: unknown[]; total: number };
    expect(json.object).toBe('list');
    expect(json.total).toBeGreaterThanOrEqual(15);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('ModelService.selectBestModel() should prefer non-training policy model', async () => {
    const best = await modelService.selectBestModel({
      outputModality: 'text',
      requiredInputs: ['text'],
    });

    expect(best).toBeDefined();
    expect(best?.id).toBe('test/fixture-model-0:free');
    expect(best?.dataPolicy?.training).toBe(false);
  });

  it('GET /v1/models/status should include policy summary', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/models/status?refresh=1', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      total: number;
      trainingPolicy: { nonTraining: number; unknown: number; training: number };
    };
    expect(json.total).toBeGreaterThan(0);
    expect(json.trainingPolicy.nonTraining).toBeGreaterThan(0);
  });

  it('GET /v1/models/status?scope=all should include non-text output modalities', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/models/status?scope=all&refresh=1', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      outputModalities: Record<string, number>;
      data: Array<{ id: string; outputModalities?: string[] }>;
    };
    expect(json.outputModalities.audio).toBeGreaterThanOrEqual(1);
    expect(json.outputModalities.speech).toBeGreaterThanOrEqual(1);
    expect(json.data.some((model) => model.id === 'test/frontend-speech-model:free')).toBeTruthy();
  });

  it('GET /v1/models/key-matrix should return provider matrix payload', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost/v1/models/key-matrix?provider=openrouter&modelLimit=3&refresh=1',
        {
          method: 'GET',
        }
      )
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      modelLimit: number;
      providers: Array<{ provider: string; modelColumns: string[]; rows: unknown[] }>;
    };

    expect(json.modelLimit).toBe(3);
    expect(Array.isArray(json.providers)).toBe(true);
    expect(json.providers[0]?.provider).toBe('openrouter');
    expect(json.providers[0]?.modelColumns.length).toBeLessThanOrEqual(3);
  });
});
