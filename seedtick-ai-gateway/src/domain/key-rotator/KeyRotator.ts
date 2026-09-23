// KeyRotator.ts - 핵심 도메인 로직: 키 로테이션 및 동시성(In-Flight) 관리

import type { ApiKeyPool, LLMProvider } from '../types.ts';

export class KeyRotator {
  private readonly pools: Map<LLMProvider, string[]>;
  private readonly activeCounts = new Map<string, number>();

  constructor(keyPools: ApiKeyPool[]) {
    this.pools = new Map(keyPools.map((p) => [p.provider, p.keys]));
  }

  private buildKey(provider: LLMProvider, apiKey: string): string {
    return `${provider}:${apiKey}`;
  }

  /**
   * 해당 키의 사용 시작을 기록 (동시 요청 카운트 증가)
   */
  acquireKey(provider: LLMProvider, apiKey: string): void {
    const key = this.buildKey(provider, apiKey);
    const current = this.activeCounts.get(key) ?? 0;
    this.activeCounts.set(key, current + 1);
  }

  /**
   * 해당 키의 사용 완료를 기록 (동시 요청 카운트 감소)
   */
  releaseKey(provider: LLMProvider, apiKey: string): void {
    const key = this.buildKey(provider, apiKey);
    const current = this.activeCounts.get(key) ?? 0;
    this.activeCounts.set(key, Math.max(0, current - 1));
  }

  /**
   * 해당 키의 현재 활성(처리 중) 요청 수 반환
   */
  getActiveCount(provider: LLMProvider, apiKey: string): number {
    return this.activeCounts.get(this.buildKey(provider, apiKey)) ?? 0;
  }

  /**
   * 제공사의 키 목록을 동시성 상태에 따라 정렬하여 반환:
   * 1순위: 현재 사용 중이지 않은(active === 0) 키 (등록 순서: 1번키 → 2번키 → 3번키 ...)
   * 2순위: 사용 중인 키 중 활성 요청 수가 적은 순 (동률 시 등록 순서 우선)
   */
  getKeysForProvider(provider: LLMProvider): string[] {
    const keys = this.pools.get(provider) ?? [];
    if (keys.length === 0) return [];

    const keyWithMeta = keys.map((key, index) => ({
      key,
      index,
      active: this.getActiveCount(provider, key),
    }));

    keyWithMeta.sort((a, b) => {
      // 1. 미사용 키(active == 0) 최우선
      if (a.active === 0 && b.active > 0) return -1;
      if (a.active > 0 && b.active === 0) return 1;

      // 2. 둘 다 사용 중이면 active가 적은 순
      if (a.active !== b.active) {
        return a.active - b.active;
      }

      // 3. active가 같으면 등록된 인덱스 순서 (1번키 우선)
      return a.index - b.index;
    });

    return keyWithMeta.map((item) => item.key);
  }

  hasKeys(provider: LLMProvider): boolean {
    const keys = this.pools.get(provider);
    return keys !== undefined && keys.length > 0;
  }

  getAllProviders(): LLMProvider[] {
    return Array.from(this.pools.keys());
  }

  /**
   * 디버그 및 모니터링용 키 상태 조회
   */
  getKeyStates(
    provider: LLMProvider
  ): Array<{ index: number; apiKeyHash: string; active: number }> {
    const keys = this.pools.get(provider) ?? [];
    return keys.map((key, index) => ({
      index: index + 1,
      apiKeyHash: key.slice(-8),
      active: this.getActiveCount(provider, key),
    }));
  }
}
