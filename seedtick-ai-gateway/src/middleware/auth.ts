// auth.ts - Bearer 토큰 검증 미들웨어

import { Elysia } from 'elysia';
import { env } from '../config/env.ts';

export const authMiddleware = new Elysia().onBeforeHandle(({ headers, set }) => {
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
});
