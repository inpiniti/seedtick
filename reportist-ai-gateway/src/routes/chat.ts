// chat.ts - POST /v1/chat/completions

import { Elysia, t } from 'elysia';
import { proxyService } from '../domain/proxy/ProxyService.ts';
import type { ChatRequest } from '../domain/types.ts';

export const chatRoute = new Elysia().post(
  '/v1/chat/completions',
  async ({ body, headers, set }) => {
    const chatReq = body as unknown as ChatRequest;

    // 사용자 직접 입력 API 키(BYOK) 패스스루 확인
    const userApiKey = headers['x-user-api-key'];
    const userProvider = headers['x-user-provider'];
    const userModel = headers['x-user-model'];
    const userBaseUrl = headers['x-user-base-url'];

    if (userApiKey && typeof userApiKey === 'string' && userApiKey.trim()) {
      const passConfig = {
        apiKey: userApiKey.trim(),
        provider: typeof userProvider === 'string' ? userProvider : 'openai',
        model: typeof userModel === 'string' && userModel.trim() ? userModel.trim() : chatReq.model,
        baseUrl: typeof userBaseUrl === 'string' && userBaseUrl.trim() ? userBaseUrl.trim() : undefined,
      };

      if (chatReq.stream) {
        const streamResult = await proxyService.chatStreamPassThrough(chatReq, passConfig);
        if ('error' in streamResult) {
          set.status = 503;
          return streamResult as unknown as Response;
        }
        return new Response(streamResult.stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }

      const result = await proxyService.chatPassThrough(chatReq, passConfig);
      if ('error' in result) {
        set.status = 503;
      }
      return result as unknown as Response;
    }

    // 1. 스트리밍 요청 (기본 게이트웨이 로테이션)
    if (chatReq.stream) {
      const streamResult = await proxyService.chatStream(chatReq);
      if ('error' in streamResult) {
        set.status = 503;
        return streamResult as unknown as Response;
      }
      return new Response(streamResult.stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // 2. 논스트리밍 요청 (기본 게이트웨이 로테이션)
    const result = await proxyService.chat(chatReq);

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
          role: t.String(),
          content: t.Any(),
        })
      ),
      temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
      max_tokens: t.Optional(t.Integer({ minimum: 1, maximum: 32768 })),
      stream: t.Optional(t.Boolean()),
      reasoning_effort: t.Optional(t.String()),
      data_collection: t.Optional(t.String()),
      zdr: t.Optional(t.Boolean()),
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
