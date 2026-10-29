// auth.ts - Bearer 토큰 검증 미들웨어

import { Elysia } from 'elysia';
import { env } from '../config/env.ts';

/**
 * Elysia 플러그인의 beforeHandle 훅은 기본적으로 해당 플러그인 스코프에만 적용된다.
 * 여러 라우트에서 동일한 검증을 재사용할 수 있도록 순수 함수로 분리한다.
 */
export interface GatewayAuthContext {
  request: Request;
  headers: { authorization?: string };
  set: { status?: number | string };
}

export function verifyGatewayAuth({ request, headers, set }: GatewayAuthContext) {
  if (request.method === 'OPTIONS') {
    return;
  }

  const url = new URL(request.url);
  if (
    url.pathname === '/health' ||
    url.pathname === '/v1/models' ||
    url.pathname.startsWith('/v1/yahoo')
  ) {
    return;
  }

  const authHeader = headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    set.status = 401;
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header missing or invalid',
        type: 'auth_error',
      },
    };
  }

  const token = authHeader.slice(7);
  if (token !== env.gatewaySecret) {
    set.status = 401;
    return {
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid gateway secret',
        type: 'auth_error',
      },
    };
  }
}

export const authMiddleware = new Elysia().onBeforeHandle(verifyGatewayAuth);
