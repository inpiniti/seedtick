// app.ts - Elysia 앱 인스턴스

import { Elysia } from 'elysia';
import { authMiddleware } from './middleware/auth.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { chatRoute } from './routes/chat.ts';
import { debugRoute } from './routes/debug.ts';
import { healthRoute } from './routes/health.ts';

export const app = new Elysia()
  .use(errorHandler)
  .use(authMiddleware)
  .use(healthRoute)
  .use(chatRoute)
  .use(debugRoute);
