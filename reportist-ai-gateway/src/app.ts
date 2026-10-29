// app.ts - Elysia 앱 인스턴스

import { Elysia } from 'elysia';
import { authMiddleware } from './middleware/auth.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { chatRoute } from './routes/chat.ts';
import { debugRoute } from './routes/debug.ts';
import { decisionsRoute } from './routes/decisions.ts';
import { healthRoute } from './routes/health.ts';
import { modelsRoute } from './routes/models.ts';
import { yahooRoute } from './routes/yahoo.ts';
import { youtubeRoute } from './routes/youtube.ts';

export const app = new Elysia()
  .onRequest(({ set }) => {
    set.headers['access-control-allow-origin'] = '*';
    set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['access-control-allow-headers'] =
      'Content-Type, Authorization, X-Title, HTTP-Referer';
    set.headers['access-control-expose-headers'] =
      'Content-Length, Content-Type, Content-Disposition, X-Youtube-Video-Id, X-Youtube-Title, X-Youtube-Filename, X-Youtube-Duration, X-Youtube-Itag, X-Youtube-Total-Bytes, X-Youtube-Audio-Bytes, X-Youtube-Audio-Seconds, X-Youtube-Truncated';
  })
  .options('/*', ({ set }) => {
    set.status = 204;
    return '';
  })
  .use(errorHandler)
  .use(authMiddleware)
  .use(healthRoute)
  .use(modelsRoute)
  .use(chatRoute)
  .use(decisionsRoute)
  .use(yahooRoute)
  .use(youtubeRoute)
  .use(debugRoute);
