// models.ts - GET /v1/models

import { Elysia } from 'elysia';
import { modelService } from '../domain/models/ModelService.ts';

export const modelsRoute = new Elysia().get(
  '/v1/models',
  async () => {
    const models = await modelService.getFreeModels();
    return {
      object: 'list',
      data: models,
      total: models.length,
    };
  },
  {
    detail: {
      summary: 'List Free Models',
      description: 'OpenRouter의 무료 텍스트 모델 목록 및 출시일, 지능, 파라미터 메타데이터 반환',
      tags: ['Models'],
    },
  }
);
