// app.ts - Elysia 앱 인스턴스

import { Elysia } from 'elysia';
import { authMiddleware } from './middleware/auth.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { chatRoute } from './routes/chat.ts';
import { debugRoute } from './routes/debug.ts';
import { decisionsRoute } from './routes/decisions.ts';
import { discussionsRoute } from './routes/discussions.ts';
import { healthRoute } from './routes/health.ts';
import { imagesRoute } from './routes/images.ts';
import { modelsRoute } from './routes/models.ts';
import { trendsRoute } from './routes/trends.ts';
import { yahooRoute } from './routes/yahoo.ts';

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Title',
  'HTTP-Referer',
  'X-User-Api-Key',
  'X-User-Provider',
  'X-User-Model',
  'X-User-Base-Url',
  'X-OpenCode-Api-Key',
  'X-Text-Only-Models',
];

export const app = new Elysia()
  .onRequest(({ set, request }) => {
    set.headers['access-control-allow-origin'] = '*';
    set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['access-control-max-age'] = '600';

    // 클라이언트가 새 헤더를 추가할 때마다 CORS 프리플라이트가 깨지지 않도록
    // 브라우저가 요청한 헤더를 그대로 허용 목록에 반영한다.
    const requested = request.headers.get('access-control-request-headers');
    const allowed = new Set(ALLOWED_HEADERS.map((header) => header.toLowerCase()));
    if (requested) {
      for (const header of requested.split(',')) {
        const trimmed = header.trim();
        if (trimmed) allowed.add(trimmed.toLowerCase());
      }
    }
    set.headers['access-control-allow-headers'] = [...allowed].join(', ');
  })
  .options('/*', ({ set }) => {
    set.status = 204;
    return '';
  })
  .use(errorHandler)
  .use(authMiddleware)
  .use(healthRoute)
  .use(modelsRoute)
  .use(imagesRoute)
  .use(chatRoute)
  .use(discussionsRoute)
  .use(decisionsRoute)
  .use(yahooRoute)
  .use(trendsRoute)
  .use(debugRoute);
