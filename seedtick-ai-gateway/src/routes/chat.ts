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
        object: t.String(),
        model: t.String(),
        choices: t.Array(
          t.Object({
            index: t.Optional(t.Integer()),
            message: t.Object({
              role: t.String(),
              content: t.String(),
            }),
            finish_reason: t.Optional(t.Nullable(t.String())),
          })
        ),
        usage: t.Optional(
          t.Object({
            prompt_tokens: t.Optional(t.Number()),
            completion_tokens: t.Optional(t.Number()),
            total_tokens: t.Optional(t.Number()),
          })
        ),
      }),
      t.Object({
        error: t.Object({
          code: t.String(),
          message: t.String(),
          type: t.String(),
          attempts: t.Optional(
            t.Array(
              t.Object({
                provider: t.String(),
                modelId: t.String(),
                apiKeyHash: t.String(),
                httpStatus: t.Integer(),
                errorCategory: t.String(),
                errorSnippet: t.String(),
                attemptedAt: t.String(),
              })
            )
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
