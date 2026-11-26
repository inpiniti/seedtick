// discussions.ts - POST /v1/discussions/prepare (토론 공통 자료)

import { Elysia, t } from 'elysia';
import { discussionPrepService } from '../domain/discussions/DiscussionPrepService.ts';
import { isSafeTopicText } from '../domain/trends/TrendsService.ts';

export const discussionsRoute = new Elysia().post(
  '/v1/discussions/prepare',
  async ({ body, set }) => {
    const topic = body.topic.trim().slice(0, 80);
    if (topic.length < 4 || !isSafeTopicText(`${topic} ${body.context ?? ''}`)) {
      set.status = 400;
      return { error: { code: 'UNSAFE_TOPIC', message: '토론에 부적합한 주제예요.' } };
    }

    return discussionPrepService.prepare(topic, body.context?.trim().slice(0, 200));
  },
  {
    body: t.Object({
      topic: t.String({ minLength: 4, maxLength: 80 }),
      context: t.Optional(t.String({ maxLength: 200 })),
    }),
    response: t.Union([
      t.Object({
        topic: t.String(),
        briefing: t.Object({
          background: t.String(),
          facts: t.Array(
            t.Object({
              claim: t.String(),
              source: t.String(),
              url: t.Optional(t.String()),
            })
          ),
          questions: t.Array(t.String()),
          limitation: t.Optional(t.String()),
        }),
        source: t.Union([t.Literal('rss+llm'), t.Literal('rss'), t.Literal('fallback')]),
        preparedAt: t.String(),
      }),
      t.Object({
        error: t.Object({ code: t.String(), message: t.String() }),
      }),
    ]),
    detail: {
      summary: 'Prepare discussion briefing',
      description: '주제에 대한 공통 배경·출처를 조사해 캐시합니다.',
      tags: ['Discussions'],
    },
  }
);
