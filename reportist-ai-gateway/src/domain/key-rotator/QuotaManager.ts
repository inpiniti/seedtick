// QuotaManager.ts - 인메모리 일일 소진 키 관리
import type { LLMProvider } from '../types.ts';
import { fallbackResetAt, parseResetAt } from './ResetAtParser.ts';

/** 원격 DB 없이 인스턴스 메모리에서만 소진 상태를 추적한다. */
export class QuotaManager {
  private exhaustedMap = new Map<string, number>();

  private buildKey(provider: string, model: string, apiKeyHash: string): string {
    return `${provider}:${model}:${apiKeyHash}`;
  }

  private getApiKeyHash(apiKey: string): string {
    return apiKey.slice(-8);
  }

  async initialize(): Promise<void> {
    this.pruneExpiredLocal();
  }

  /**
   * 소진 시점부터 24시간 뒤를 기본 리셋 시각으로 쓴다.
   * 제공사가 응답 헤더/에러 메시지에 알려준 시각이 있으면 그것을 우선한다.
   */
  private resolveResetAt(hint?: { header?: string | null; errorBody?: string }): Date {
    const now = Date.now();
    const resetAtMs =
      parseResetAt(hint?.header, now) ?? parseResetAt(hint?.errorBody, now) ?? fallbackResetAt(now);
    return new Date(resetAtMs);
  }

  async markExhausted(
    provider: LLMProvider,
    model: string,
    apiKey: string,
    hint?: { header?: string | null; errorBody?: string }
  ): Promise<void> {
    const hash = this.getApiKeyHash(apiKey);
    const resetAt = this.resolveResetAt(hint);
    this.exhaustedMap.set(this.buildKey(provider, model, hash), resetAt.getTime());
    console.info(
      `[Gateway] Marked daily exhausted for ${provider}:${model}:${hash} until ${resetAt.toISOString()} (in-memory)`
    );
  }

  isExhaustedLocal(provider: LLMProvider, model: string, apiKey: string): boolean {
    this.pruneExpiredLocal();
    const hash = this.getApiKeyHash(apiKey);
    return this.exhaustedMap.has(this.buildKey(provider, model, hash));
  }

  async isExhausted(provider: LLMProvider, model: string, apiKey: string): Promise<boolean> {
    return this.isExhaustedLocal(provider, model, apiKey);
  }

  async cleanupExpired(): Promise<number> {
    const before = this.exhaustedMap.size;
    this.pruneExpiredLocal();
    return before - this.exhaustedMap.size;
  }

  private pruneExpiredLocal(): void {
    const now = Date.now();
    for (const [key, resetAtMs] of this.exhaustedMap.entries()) {
      if (resetAtMs <= now) this.exhaustedMap.delete(key);
    }
  }

  // 디버그용
  getExhaustedSet(): Set<string> {
    this.pruneExpiredLocal();
    return new Set(this.exhaustedMap.keys());
  }

  getExhaustedMap(): Map<string, number> {
    this.pruneExpiredLocal();
    return new Map(this.exhaustedMap);
  }
}

export const quotaManager = new QuotaManager();
