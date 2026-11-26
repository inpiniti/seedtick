// CooldownManager.ts - 인메모리 쿨다운 관리

export class CooldownManager {
  private readonly map = new Map<string, { expiresAt: number | null; reason: string }>();

  private buildKey(provider: string, modelId: string, apiKeyHash: string): string {
    return `${provider}:${modelId}:${apiKeyHash}`;
  }

  /** 인증 실패(401/403) 시 사용 — 모델과 무관하게 해당 제공사의 키 전체를 막는 와일드카드 키. */
  private buildProviderKey(provider: string, apiKeyHash: string): string {
    return `${provider}:*:${apiKeyHash}`;
  }

  private getApiKeyHash(apiKey: string): string {
    return apiKey.slice(-8);
  }

  private isActive(key: string): boolean {
    const state = this.map.get(key);
    if (!state) return false;
    if (state.expiresAt === null) return true;
    if (Date.now() > state.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  isCoolingDown(provider: string, modelId: string, apiKey: string): boolean {
    const hash = this.getApiKeyHash(apiKey);
    return (
      this.isActive(this.buildKey(provider, modelId, hash)) ||
      this.isActive(this.buildProviderKey(provider, hash))
    );
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

  /** 401/403 — 모델이 바뀌어도 같은 키를 다시 시도하지 않도록 제공사 전체에 적용한다. */
  setProviderKeyCooldown(
    provider: string,
    apiKey: string,
    durationMs: number,
    reason: string
  ): void {
    const key = this.buildProviderKey(provider, this.getApiKeyHash(apiKey));
    if (reason === 'unknown') {
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
