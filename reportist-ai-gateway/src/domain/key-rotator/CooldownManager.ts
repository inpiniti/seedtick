// CooldownManager.ts - 인메모리 쿨다운 관리

// 가드레일 거부는 같은 모델/키 조합이 반복되므로, 서로 다른 키가 짧은 시간 안에
// 연달아 거부되면 해당 모델 자체의 정책 문제로 보고 모델 단위로 올려서 차단한다.
const GUARDRAIL_HIT_WINDOW_MS = 60 * 60_000;

export class CooldownManager {
  private readonly map = new Map<string, { expiresAt: number | null; reason: string }>();
  // provider:model → (키 해시 → { 최근 거부 시각, 윈도우 내 거부 횟수 })
  private readonly guardrailHits = new Map<string, Map<string, { at: number; count: number }>>();
  // provider:model → 모델 단위 가드레일 차단 만료 시각
  private readonly guardrailBlockedUntil = new Map<string, number>();

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

  /**
   * 가드레일 거부를 기록하고 윈도우 내 통계를 반환한다.
   * - distinctKeys: 같은 모델에서 거부된 서로 다른 키 수 (모델 단위 차단 판단용)
   * - keyRejections: 같은 키가 반복 거부된 횟수 (키 단위 장기 차단 판단용)
   */
  recordGuardrailRejection(
    provider: string,
    modelId: string,
    apiKey: string
  ): { distinctKeys: number; keyRejections: number } {
    const modelKey = `${provider}:${modelId}`;
    const hash = this.getApiKeyHash(apiKey);
    const now = Date.now();
    let hits = this.guardrailHits.get(modelKey);
    if (!hits) {
      hits = new Map();
      this.guardrailHits.set(modelKey, hits);
    }
    for (const [keyHash, state] of hits) {
      if (now - state.at > GUARDRAIL_HIT_WINDOW_MS) hits.delete(keyHash);
    }
    const keyRejections = (hits.get(hash)?.count ?? 0) + 1;
    hits.set(hash, { at: now, count: keyRejections });
    return { distinctKeys: hits.size, keyRejections };
  }

  /** 모델 단위 가드레일 차단 — 모든 키가 해당 모델을 건너뛰도록 표시한다. */
  blockModelForGuardrail(provider: string, modelId: string, durationMs: number): void {
    this.guardrailBlockedUntil.set(`${provider}:${modelId}`, Date.now() + durationMs);
  }

  isModelGuardrailBlocked(provider: string, modelId: string): boolean {
    const key = `${provider}:${modelId}`;
    const until = this.guardrailBlockedUntil.get(key);
    if (until === undefined) return false;
    if (Date.now() > until) {
      this.guardrailBlockedUntil.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.map.clear();
    this.guardrailHits.clear();
    this.guardrailBlockedUntil.clear();
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
