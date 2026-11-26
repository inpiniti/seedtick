// CooldownManager.ts - 인메모리 쿨다운 관리

export class CooldownManager {
  private readonly map = new Map<string, { expiresAt: number | null; reason: string }>();

  private buildKey(provider: string, modelId: string, apiKeyHash: string): string {
    return `${provider}:${modelId}:${apiKeyHash}`;
  }

  private getApiKeyHash(apiKey: string): string {
    return apiKey.slice(-8);
  }

  isCoolingDown(provider: string, modelId: string, apiKey: string): boolean {
    const key = this.buildKey(provider, modelId, this.getApiKeyHash(apiKey));
    const state = this.map.get(key);
    if (!state) return false;
    if (state.expiresAt === null) return true;
    if (Date.now() > state.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  setCooldown(
    provider: string,
    modelId: string,
    apiKey: string,
    durationMs: number,
    reason: string
  ): void {
    const key = this.buildKey(provider, modelId, this.getApiKeyHash(apiKey));
    if (reason === 'unknown') {
      // 미확인 오류는 자동 복구하지 않고 고정 차단해 원인 파악이 가능하게 유지
      this.map.set(key, { expiresAt: null, reason });
      return;
    }
    this.map.set(key, { expiresAt: Date.now() + durationMs, reason });
  }

  setModelCooldownAllKeys(
    provider: string,
    modelId: string,
    allKeys: string[],
    durationMs: number,
    reason: string
  ): void {
    for (const key of allKeys) {
      this.setCooldown(provider, modelId, key, durationMs, reason);
    }
  }

  clear(): void {
    this.map.clear();
  }

  // 디버그용
  getMap(): Map<string, { expiresAt: number | null; reason: string }> {
    const now = Date.now();
    for (const [key, state] of this.map.entries()) {
      if (state.expiresAt !== null && state.expiresAt <= now) {
        this.map.delete(key);
      }
    }
    return this.map;
  }
}
