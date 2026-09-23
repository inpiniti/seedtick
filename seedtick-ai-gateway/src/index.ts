// index.ts - Bun / Vercel 엔트리포인트

import { app } from './app.ts';
import { validateEnv } from './config/env.ts';
import { proxyService } from './domain/proxy/ProxyService.ts';

declare const Bun: {
  serve: (options: { fetch: (req: Request) => Response | Promise<Response>; port: number }) => {
    port: number;
  };
};

// 환경변수 검증
const envErrors = validateEnv();
if (envErrors.length > 0) {
  console.warn('[Gateway] Environment validation warning:');
  for (const err of envErrors) {
    console.warn(`  - ${err}`);
  }
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// 프록시 서비스 초기화 (Supabase 캐시 로드)
try {
  await proxyService.initialize();
} catch (err) {
  console.error('[Gateway] Failed to initialize proxyService:', err);
}

// 로컬 Bun 직접 실행 시 (Vercel 환경이 아닌 경우)
if (!process.env.VERCEL && typeof Bun !== 'undefined') {
  const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 3000;
  const server = Bun.serve({
    fetch: app.fetch,
    port,
  });
  console.info(`[Gateway] Server running on http://localhost:${server.port}`);
  console.info('[Gateway] Ready to accept requests');
}

// Vercel Serverless Function 배포를 위해 Elysia 인스턴스를 default export
export default app;
