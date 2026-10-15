// CooldownManager.ts - 인메모리 쿨다운 관리

export class CooldownManager {
  private readonly map = new Map<string, number>();

  private buildKey(provider: string, modelId: string, apiKeyHash: string): string {
    return `${provider}:${modelId}:${apiKeyHash}`;
  }

  private getApiKeyHash(apiKey: string): string {
    return apiKey.slice(-8);
  }

  isCoolingDown(provider: string, modelId: string, apiKey: string): boolean {
    const key = this.buildKey(provider, modelId, this.getApiKeyHash(apiKey));
    const expireAt = this.map.get(key);
    if (!expireAt) return false;
    if (Date.now() > expireAt) {
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
    _reason: string
  ): void {
    const key = this.buildKey(provider, modelId, this.getApiKeyHash(apiKey));
    this.map.set(key, Date.now() + durationMs);
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
  getMap(): Map<string, number> {
    return this.map;
  }
}
