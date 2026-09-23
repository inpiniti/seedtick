// index.ts - Bun.serve() 엔트리포인트

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
  console.error('[Gateway] Environment validation failed:');
  for (const err of envErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

// 프록시 서비스 초기화 (Supabase 캐시 로드)
await proxyService.initialize();

// Bun 서버 시작
const server = Bun.serve({
  fetch: app.fetch,
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
});

console.info(`[Gateway] Server running on http://localhost:${server.port}`);
console.info('[Gateway] Ready to accept requests');

export default server;
