// images.ts - POST /v1/images (텍스트 → 이미지 생성)

import { Elysia, t } from 'elysia';
import { proxyService } from '../domain/proxy/ProxyService.ts';
import type { ImageGenerationRequest } from '../domain/types.ts';

export const imagesRoute = new Elysia().post(
  '/v1/images',
  async ({ body, set }) => {
    const result = await proxyService.generateImage(body as unknown as ImageGenerationRequest);

    if ('error' in result) {
      set.status = 503;
      return result;
    }

    return result;
  },
  {
    body: t.Object({
      model: t.Optional(t.String()),
      prompt: t.String({ minLength: 1 }),
      n: t.Optional(t.Integer({ minimum: 1, maximum: 6 })),
      aspect_ratio: t.Optional(
        t.Union([
          t.Literal('1:1'),
          t.Literal('2:1'),
          t.Literal('1:2'),
          t.Literal('3:2'),
          t.Literal('2:3'),
          t.Literal('4:3'),
          t.Literal('3:4'),
          t.Literal('5:4'),
          t.Literal('4:5'),
          t.Literal('16:9'),
          t.Literal('9:16'),
          t.Literal('auto'),
        ])
      ),
    }),
    detail: {
      summary: 'Generate Image',
      description: 'OpenRouter Image API를 통한 텍스트→이미지 생성. 생성된 이미지는 data URL로 반환됩니다.',
      tags: ['Images'],
    },
  }
);
