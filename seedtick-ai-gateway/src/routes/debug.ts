// debug.ts - 디버그 엔드포인트 (운영 시 제거 권장)

import { Elysia } from 'elysia';
import { proxyService } from '../domain/proxy/ProxyService.ts';
import { authMiddleware } from '../middleware/auth.ts';

export const debugRoute = new Elysia()
  .use(authMiddleware)
  .get('/debug/state', () => {
    // Private 필드 접근을 위한 getter 추가 필요
    return {
      message: 'Use /debug/cooldown and /debug/quota instead',
      timestamp: new Date().toISOString(),
    };
  })
  .get('/debug/cooldown', () => ({
    cooldownMap: Object.fromEntries(proxyService.getCooldownMap?.() ?? []),
    timestamp: new Date().toISOString(),
  }))
  .get('/debug/quota', () => ({
    exhaustedKeys: Array.from(proxyService.getExhaustedKeys?.() ?? []),
    timestamp: new Date().toISOString(),
  }))
  .get('/debug/keys', () => ({
    openrouterKeys: proxyService.getKeyStates?.('openrouter') ?? [],
    timestamp: new Date().toISOString(),
  }));
