// chat.ts - POST /v1/chat/completions

import { Elysia, t } from 'elysia';
import { proxyService } from '../domain/proxy/ProxyService.ts';

export const chatRoute = new Elysia().post(
  '/v1/chat/completions',
  async ({ body, set }) => {
    const result = await proxyService.chat(body);

    // GatewayError인 경우 503 반환
    if ('error' in result) {
      set.status = 503;
    }

    return result as unknown as Response;
  },
  {
    body: t.Object({
      model: t.Optional(t.String()),
      messages: t.Array(
        t.Object({
          role: t.Union([t.Literal('system'), t.Literal('user'), t.Literal('assistant')]),
          content: t.String(),
        })
      ),
      temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
      max_tokens: t.Optional(t.Integer({ minimum: 1, maximum: 8192 })),
      stream: t.Optional(t.Boolean()),
    }),
    response: t.Union([
      t.Object({
        id: t.String(),
        object: t.Literal('chat.completion'),
        model: t.String(),
        choices: t.Array(
          t.Object({
            index: t.Integer(),
            message: t.Object({
              role: t.Union([t.Literal('system'), t.Literal('user'), t.Literal('assistant')]),
              content: t.String(),
            }),
            finish_reason: t.Union([
              t.Literal('stop'),
              t.Literal('length'),
              t.Literal('content_filter'),
              t.Literal('error'),
            ]),
          })
        ),
        usage: t.Object({
          prompt_tokens: t.Integer(),
          completion_tokens: t.Integer(),
          total_tokens: t.Integer(),
        }),
      }),
      t.Object({
        error: t.Object({
          code: t.Literal('GATEWAY_ALL_EXHAUSTED'),
          message: t.String(),
          type: t.Literal('gateway_error'),
          attempts: t.Array(
            t.Object({
              provider: t.String(),
              modelId: t.String(),
              apiKeyHash: t.String(),
              httpStatus: t.Integer(),
              errorCategory: t.String(),
              errorSnippet: t.String(),
              attemptedAt: t.String(),
            })
          ),
        }),
      }),
    ]),
    detail: {
      summary: 'Chat Completions',
      description: 'OpenAI 호환 채팅 완성 엔드포인트. 멀티 제공사 키 로테이션 및 폴백 자동 처리.',
      tags: ['Chat'],
    },
  }
);
