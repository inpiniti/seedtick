// tests/image-model.test.ts - 무료 이미지 생성 모델 노출 테스트

import { describe, expect, it } from 'bun:test';
import { app } from '../src/app.ts';
import { modelService } from '../src/domain/models/ModelService.ts';

const IMAGE_MODEL_ID = 'recraft/recraft-v4.1-flash-v2:free';

describe('Free image generation model', () => {
  it('ModelService exposes the free Recraft text-to-image model', async () => {
    const models = await modelService.getFreeModels();
    const recraft = models.find((m) => m.id === IMAGE_MODEL_ID);

    expect(recraft).toBeDefined();
    expect(recraft?.isImageGenerationModel).toBe(true);
    expect(recraft?.outputModalities).toContain('image');
    expect(recraft?.inputModalities).toContain('text');
    expect(recraft?.modality).toBe('text->image');
  });

  it('GET /v1/models includes the image model', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/models', { method: 'GET' })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: Array<{ id: string }> };
    expect(json.data.some((m) => m.id === IMAGE_MODEL_ID)).toBe(true);
  });
});
