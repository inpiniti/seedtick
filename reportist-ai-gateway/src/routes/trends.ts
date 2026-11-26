// trends.ts - GET /v1/trends (실시간 트렌드 기반 동물 토론 주제 목록)

import { Elysia } from 'elysia';
import { trendsService } from '../domain/trends/TrendsService.ts';

export const trendsRoute = new Elysia().get('/v1/trends', async ({ set }) => {
  set.headers['cache-control'] = 'public, s-maxage=900, stale-while-revalidate=1800';
  return trendsService.getTrends();
});
