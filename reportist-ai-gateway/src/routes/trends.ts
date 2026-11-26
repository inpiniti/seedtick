// trends.ts - GET /v1/trends (실시간 화제 + 12종 동물 MBTI 대본 단일 캐시 응답)

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
          lines: t.Array(
            t.Object({
              speaker: t.String(),
              mbti: t.String(),
              text: t.String(),
            })
          ),
        })
      ),
      updatedAt: t.String(),
      source: t.Union([t.Literal('rss+llm'), t.Literal('rss'), t.Literal('fallback')]),
    }),
    detail: {
      summary: 'Trending topics with animal MBTI scripts',
      description:
        '실시간 화제와 동물별 MBTI 티키타카 대본을 함께 반환합니다. 30분 캐시, 인증 불필요.',
      tags: ['Trends'],
    },
  }
);
