// trends.ts - GET /v1/trends (실시간 트렌드 기반 동물 토론 주제 목록)

import { Elysia, t } from 'elysia';
import { trendsService } from '../domain/trends/TrendsService.ts';

export const trendsRoute = new Elysia().get(
  '/v1/trends',
  async ({ set }) => {
    set.headers['cache-control'] = 'public, s-maxage=1800, stale-while-revalidate=3600';
    return trendsService.getTrends();
  },
  {
    response: t.Object({
      items: t.Array(
        t.Object({
          keyword: t.String(),
          topic: t.String(),
          context: t.String(),
        })
      ),
      updatedAt: t.String(),
      source: t.Union([t.Literal('rss+llm'), t.Literal('rss'), t.Literal('fallback')]),
    }),
    detail: {
      summary: 'Trending topics',
      description: '실시간 한국 화제 목록을 반환합니다. 30분 캐시, 인증 불필요.',
      tags: ['Trends'],
    },
  }
);
