// error-handler.ts - 글로벌 에러 핸들러

import { Elysia } from 'elysia';

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

  set.status = 500;
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      type: 'internal_error',
    },
  };
});
