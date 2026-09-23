// KeyRotator.ts - 핵심 도메인 로직: 키 로테이션

import type { ApiKeyPool, LLMProvider } from '../types.ts';

export class KeyRotator {
  private readonly pools: Map<LLMProvider, string[]>;

  constructor(keyPools: ApiKeyPool[]) {
    this.pools = new Map(keyPools.map((p) => [p.provider, p.keys]));
  }

  getKeysForProvider(provider: LLMProvider): string[] {
    const keys = this.pools.get(provider) ?? [];
    if (keys.length === 0) return [];

    const startIdx = Math.floor(Math.random() * keys.length);
    return [...keys.slice(startIdx), ...keys.slice(0, startIdx)];
  }

  hasKeys(provider: LLMProvider): boolean {
    const keys = this.pools.get(provider);
    return keys !== undefined && keys.length > 0;
  }

  getAllProviders(): LLMProvider[] {
    return Array.from(this.pools.keys());
  }
}
