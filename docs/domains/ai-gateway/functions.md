# AI-Gateway 함수 명세

## KeyRotator

```typescript
class KeyRotator {
  private readonly pools: Map<LLMProvider, string[]>
  private readonly activeCounts = new Map<string, number>()

  constructor(keyPools: ApiKeyPool[]) {
    this.pools = new Map(keyPools.map(p => [p.provider, p.keys]))
  }

  /**
   * 해당 키의 사용 시작 기록 (인플라이트 카운트 증가)
   */
  acquireKey(provider: LLMProvider, apiKey: string): void {
    const k = `${provider}:${apiKey}`
    this.activeCounts.set(k, (this.activeCounts.get(k) ?? 0) + 1)
  }

  /**
   * 해당 키의 사용 완료 기록 (인플라이트 카운트 감소)
   */
  releaseKey(provider: LLMProvider, apiKey: string): void {
    const k = `${provider}:${apiKey}`
    const cur = this.activeCounts.get(k) ?? 0
    this.activeCounts.set(k, Math.max(0, cur - 1))
  }

  /**
   * 유휴 키 우선(Idle-First) 정렬 반환:
   * 1순위: 미사용 키(active == 0)를 등록된 순서(1번 → 2번 → 3번 ...)대로 배치
   * 2순위: 사용 중인 키는 active 적은 순(동률 시 등록 순서)으로 뒤에 배치
   */
  getKeysForProvider(provider: LLMProvider): string[] {
    const keys = this.pools.get(provider) ?? []
    return [...keys].sort((a, b) => {
      const activeA = this.getActiveCount(provider, a)
      const activeB = this.getActiveCount(provider, b)
      if (activeA === 0 && activeB > 0) return -1
      if (activeA > 0 && activeB === 0) return 1
      if (activeA !== activeB) return activeA - activeB
      return keys.indexOf(a) - keys.indexOf(b)
    })
  }

  /**
   * 디버그/모니터링용 키 상태 목록
   */
  getKeyStates(provider: LLMProvider) {
    const keys = this.pools.get(provider) ?? []
    return keys.map((key, i) => ({
      index: i + 1,
      apiKeyHash: key.slice(-8),
      active: this.getActiveCount(provider, key),
    }))
  }
}
```

---

## CooldownManager (인메모리)

```typescript
class CooldownManager {
  private readonly map = new Map<string, number>()  // key → 만료 타임스탬프 ms

  private buildKey(provider: string, modelId: string, apiKeyHash: string): string {
    return `${provider}:${modelId}:${apiKeyHash}`
  }

  isCoolingDown(provider: string, modelId: string, apiKey: string): boolean {
    const k = this.buildKey(provider, modelId, apiKey.slice(-8))
    const expireAt = this.map.get(k)
    if (!expireAt) return false
    if (Date.now() > expireAt) { this.map.delete(k); return false }
    return true
  }

  setCooldown(provider: string, modelId: string, apiKey: string, durationMs: number, reason: string) {
    const k = this.buildKey(provider, modelId, apiKey.slice(-8))
    this.map.set(k, Date.now() + durationMs)
    console.log(`[Gateway] Cooldown ${k} (${reason}): ${durationMs / 1000}s`)
  }

  setModelCooldownAllKeys(provider: string, modelId: string, allKeys: string[], durationMs: number, reason: string) {
    for (const key of allKeys) {
      this.setCooldown(provider, modelId, key, durationMs, reason)
    }
  }
}
```

---

## ErrorClassifier

```typescript
class ErrorClassifier {
  classify(httpStatus: number, errorBody: string): ErrorCategory {
    if (httpStatus === 429) {
      const isDaily = /PerDay|per day|quota_limit_value|insufficient_quota/i.test(errorBody)
      const isTPM = /TPM|token.*minute/i.test(errorBody)
      if (isDaily) return 'daily_exhausted'
      if (isTPM) return 'tpm_exceeded'
      return 'rpm_exceeded'
    }
    if (httpStatus === 400) {
      if (/context.length|maximum.context/i.test(errorBody)) return 'context_too_long'
      if (/max.output|output.token/i.test(errorBody)) return 'output_too_long'
      if (/content.filter|safety/i.test(errorBody)) return 'safety_filter'
      return 'unknown'
    }
    if (httpStatus === 401) return 'unauthorized'
    if (httpStatus === 403) return 'forbidden'
    if (httpStatus === 404) return 'model_not_found'
    if (httpStatus === 503) return 'server_overloaded'
    if (httpStatus === 504) return 'timeout'
    return 'unknown'
  }
}
```

---

## ProxyService (핵심 엔진)

```typescript
class ProxyService {
  async chat(request: ChatRequest): Promise<ChatResponse | GatewayError> {
    const attempts: GatewayAttempt[] = []

    for (const modelConfig of FALLBACK_CHAIN) {
      const { provider, modelId } = modelConfig
      const keys = this.rotator.getKeysForProvider(provider)

      for (const apiKey of keys) {
        // 1. 인메모리 쿨다운 확인 (0ms)
        if (this.cooldown.isCoolingDown(provider, modelId, apiKey)) continue

        // 2. 일일 소진 Supabase 확인 (인메모리 캐시 경유, 0ms)
        if (this.quota.isExhaustedLocal(provider, modelId, apiKey)) continue

        // 3. API 호출
        const adapter = this.getAdapter(provider)
        
        // 동시성 추적: 키 점유 시작
        this.rotator.acquireKey(provider, apiKey)
        let result
        try {
          result = await adapter.call(request, modelId, apiKey)
        } finally {
          // 동시성 추적: 키 반환
          this.rotator.releaseKey(provider, apiKey)
        }

        if (result.ok) {
          return result.response
        }

        // 4. 에러 분류 및 처리
        const category = this.classifier.classify(result.status, result.errorBody)
        attempts.push({ provider, modelId, apiKeyHash: apiKey.slice(-8), httpStatus: result.status, errorCategory: category, errorSnippet: result.errorBody.slice(0, 200), attemptedAt: new Date().toISOString() })

        switch (category) {
          case 'rpm_exceeded':
          case 'tpm_exceeded':
            this.cooldown.setCooldown(provider, modelId, apiKey, 60_000, category)
            continue  // 다음 유휴 키로 즉시 재시도

          case 'daily_exhausted':
            this.quota.markExhausted(provider, modelId, apiKey)  // Supabase 비동기 기록
            continue  // 다음 유휴 키로 즉시 재시도

          case 'forbidden':
          case 'unauthorized':
            this.cooldown.setCooldown(provider, modelId, apiKey, 3_600_000, category)
            continue  // 다음 유휴 키로 즉시 재시도

          case 'server_overloaded':
          case 'timeout':
          case 'network_error':
            this.cooldown.setCooldown(provider, modelId, apiKey, 30_000, category)
            continue  // 다음 유휴 키로 즉시 재시도

          default:  // context_too_long, safety_filter 등
            break  // 다음 모델로 (키 바꿔도 무의미)
        }
        break  // 내부 break → 모델 루프의 다음 모델로
      }
    }

    // 모든 키 소진
    return {
      error: {
        code: 'GATEWAY_ALL_EXHAUSTED',
        message: '모든 LLM 제공사의 키와 모델이 소진되었습니다',
        type: 'gateway_error',
        attempts,
      }
    }
  }
}
```

---

## LLM 어댑터 (OpenAICompatAdapter)

```typescript
class OpenAICompatAdapter implements ILLMAdapter {
  async call(request: ChatRequest, modelId: string, apiKey: string): Promise<AdapterResult> {
    // 1. HTTP 호출 (타임아웃 제어)
    // 2. 응답 수신 후 OpenAI 규격 정규화 (choices, usage, finish_reason 안전 보정)
    // 3. Normalized ChatResponse 반환 (Elysia 422 에러 원천 차단)
  }
}
```
