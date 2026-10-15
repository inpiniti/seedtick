// health.ts - GET /health

import { Elysia, t } from 'elysia';
import { env } from '../config/env.ts';

export const healthRoute = new Elysia().get(
  '/health',
  () => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    providers: {
      cline: env.clineKeys.length > 0,
      kilo: env.kiloKeys.length > 0,
      openrouter: env.openrouterKeys.length > 0,
      gemini: env.geminiKeys.length > 0,
    },
    supabase: env.supabaseUrl ? 'configured' : 'not_configured',
  }),
  {
    response: {
      200: t.Object({
        status: t.Literal('ok'),
        timestamp: t.String(),
        providers: t.Object({
          cline: t.Boolean(),
          kilo: t.Boolean(),
          openrouter: t.Boolean(),
          gemini: t.Boolean(),
        }),
        supabase: t.String(),
      }),
    },
    detail: {
      summary: 'Health Check',
      description: '서비스 상태 확인',
      tags: ['Health'],
    },
  }
);
