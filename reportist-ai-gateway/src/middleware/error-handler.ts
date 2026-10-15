// error-handler.ts - 글로벌 에러 핸들러

import { Elysia } from 'elysia';
import { errorLogService } from '../domain/error-log/ErrorLogService.ts';

export const errorHandler = new Elysia().onError(({ code, error, set }) => {
  console.error(`[Gateway] Error [${code}]:`, error);

  if (code === 'VALIDATION') {
    set.status = 400;
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request format',
        type: 'validation_error',
        details: error instanceof Error ? error.message : 'Unknown validation error',
      },
    };
  }

  if (code === 'NOT_FOUND') {
    set.status = 404;
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        type: 'not_found_error',
      },
    };
  }

  // 500 서버 장애 발생 시 error_logs 테이블에 비차단 적재
  errorLogService
    .error(
      'GATEWAY_INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      {
        code,
        stack: error instanceof Error ? error.stack : undefined,
      }
    )
    .catch(() => {});

  set.status = 500;
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      type: 'internal_error',
    },
  };
});

