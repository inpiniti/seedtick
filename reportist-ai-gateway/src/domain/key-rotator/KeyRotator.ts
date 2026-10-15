// KeyRotator.ts - 핵심 도메인 로직: FIFO 순환 큐 기반 키 로테이션 및 동시성(In-Flight) 관리

import type { ApiKeyPool, LLMProvider } from '../types.ts';

export class KeyRotator {
  private readonly initialPools: Map<LLMProvider, string[]>;
  private readonly queues: Map<LLMProvider, string[]>;
  private readonly activeCounts = new Map<string, number>();

  constructor(keyPools: ApiKeyPool[]) {
    this.initialPools = new Map(keyPools.map((p) => [p.provider, [...p.keys]]));
    this.queues = new Map(keyPools.map((p) => [p.provider, [...p.keys]]));
  }

  private buildKey(provider: LLMProvider, apiKey: string): string {
    return `${provider}:${apiKey}`;
  }

  /**
   * 해당 키의 사용 시작을 기록 (동시 요청 카운트 증가 및 큐 순환)
   */
  acquireKey(provider: LLMProvider, apiKey: string): void {
    const key = this.buildKey(provider, apiKey);
    const current = this.activeCounts.get(key) ?? 0;
    this.activeCounts.set(key, current + 1);

    // 사용 시작 시점에도 큐의 맨 뒤로 이동시켜 다음 요청이 다음 유휴 키를 우선 선택하도록 순환
    this.moveToBack(provider, apiKey);
  }

  /**
   * 해당 키의 사용 완료를 기록 (다 쓰면 큐의 맨 마지막에 집어넣음)
   */
  releaseKey(provider: LLMProvider, apiKey: string): void {
    const key = this.buildKey(provider, apiKey);
    const current = this.activeCounts.get(key) ?? 0;
    this.activeCounts.set(key, Math.max(0, current - 1));

    // 다 썼을 때도 큐의 맨 마지막으로 재배치 (FIFO 순환 큐)
    this.moveToBack(provider, apiKey);
  }

  private moveToBack(provider: LLMProvider, apiKey: string): void {
    const queue = this.queues.get(provider);
    if (!queue || queue.length <= 1) return;
    const idx = queue.indexOf(apiKey);
    if (idx !== -1) {
      queue.splice(idx, 1);
      queue.push(apiKey);
    }
  }

  /**
   * 해당 키의 현재 활성(처리 중) 요청 수 반환
   */
  getActiveCount(provider: LLMProvider, apiKey: string): number {
    return this.activeCounts.get(this.buildKey(provider, apiKey)) ?? 0;
  }

  /**
   * 제공사의 키 목록을 FIFO 순환 큐 상태 및 동시성에 따라 정렬하여 반환:
   * 1순위: 현재 사용 중이지 않은(active === 0) 키 (큐 앞쪽 키 우선)
   * 2순위: 사용 중인 키 중 활성 요청 수가 적은 순
   * 3순위: 동률 시 큐의 현재 순서 우선 (순환 순서 보장)
   */
  getKeysForProvider(provider: LLMProvider): string[] {
    const queue = this.queues.get(provider) ?? [];
    if (queue.length === 0) return [];

    const keyWithMeta = queue.map((key, queueIndex) => ({
      key,
      queueIndex,
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

      // 3. active가 같으면 현재 큐에서의 순서 (앞쪽 큐 우선)
      return a.queueIndex - b.queueIndex;
    });

    return keyWithMeta.map((item) => item.key);
  }

  hasKeys(provider: LLMProvider): boolean {
    const keys = this.queues.get(provider);
    return keys !== undefined && keys.length > 0;
  }

  getAllProviders(): LLMProvider[] {
    return Array.from(this.queues.keys());
  }

  /**
   * 디버그 및 모니터링용 키 상태 조회 (등록된 고정 인덱스 순서 유지)
   */
  getKeyStates(
    provider: LLMProvider
  ): Array<{ index: number; apiKeyHash: string; active: number }> {
    const originalKeys = this.initialPools.get(provider) ?? [];
    return originalKeys.map((key, index) => ({
      index: index + 1,
      apiKeyHash: key.slice(-8),
      active: this.getActiveCount(provider, key),
    }));
  }
}
