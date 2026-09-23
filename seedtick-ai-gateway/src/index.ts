// index.ts - Bun / Vercel 엔트리포인트

import { app } from './app.ts';
import { validateEnv } from './config/env.ts';
import { proxyService } from './domain/proxy/ProxyService.ts';

declare const Bun: {
  serve: (options: { fetch: (req: Request) => Response | Promise<Response>; port: number }) => {
    port: number;
  };
};

// 환경변수 검증 로그 (서버리스 환경에서 프로세스가 죽지 않도록 warn만 로깅)
const envErrors = validateEnv();
if (envErrors.length > 0) {
  console.warn('[Gateway] Environment validation warning:');
  for (const err of envErrors) {
    console.warn(`  - ${err}`);
  }
}

// 프록시 서비스 초기화 (Supabase 캐시 로드)
try {
  await proxyService.initialize();
} catch (err) {
  console.error('[Gateway] Failed to initialize proxyService:', err);
}

// 로컬에서 직접 메인 파일로 실행할 때만 포트 리슨 (Vercel 함수 환경에서는 실행되지 않음)
if (import.meta.main) {
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
