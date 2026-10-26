// tests/models-route.test.ts - 모델 목록 엔드포인트 및 ModelService 테스트

import { describe, expect, it } from 'bun:test';
import { app } from '../src/app.ts';
import { modelService } from '../src/domain/models/ModelService.ts';

describe('ModelService & Models Route', () => {
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
});
