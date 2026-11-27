// trends.ts - GET /v1/trends (실시간 트렌드 기반 동물 토론 주제 목록)

import { Elysia, t } from 'elysia';
import { trendsService } from '../domain/trends/TrendsService.ts';

export const trendsRoute = new Elysia().get(
  '/v1/trends',
  async ({ set, query }) => {
    const excluded = (query.exclude ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 40);
    if (excluded.length > 0) {
      // 토론 완료 주제를 제외한 배치는 요청마다 달라지므로 CDN 캐시를 쓰지 않는다.
      set.headers['cache-control'] = 'no-store';
      return trendsService.getTrendsExcluding(excluded);
    }
    const payload = await trendsService.getTrends();
    set.headers['cache-control'] =
      payload.source === 'rss+llm'
        ? 'public, s-maxage=1800, stale-while-revalidate=3600'
        : 'public, s-maxage=15, stale-while-revalidate=60';
    return payload;
  },
  {
    query: t.Object({
      exclude: t.Optional(t.String()),
    }),
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
      description:
        '실시간 한국 화제 목록을 반환합니다. exclude=키워드1,키워드2 로 이미 토론한 주제를 제외한 새 배치를 요청할 수 있습니다. 기본 30분 캐시, 인증 불필요.',
      tags: ['Trends'],
    },
  }
);
