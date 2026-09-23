# AI-Gateway 함수 명세

## KeyRotator

```typescript
class KeyRotator {
  private readonly pools: Map<LLMProvider, string[]>

  constructor(keyPools: ApiKeyPool[]) {
    this.pools = new Map(keyPools.map(p => [p.provider, p.keys]))
  }

  /**
   * 지정 제공사의 키를 랜덤 시작점으로 순환 반환
   * 소진/쿨다운 키는 자동 건너뜀
   */
  getKeysForProvider(provider: LLMProvider): string[] {
    const keys = this.pools.get(provider) ?? []
    const startIdx = Math.floor(Math.random() * keys.length)
    return [...keys.slice(startIdx), ...keys.slice(0, startIdx)]
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
        const result = await adapter.call(request, modelId, apiKey)

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
            continue  // 다음 키 시도

          case 'daily_exhausted':
            this.quota.markExhaustedLocal(provider, modelId, apiKey)  // Supabase 비동기 기록
            continue  // 다음 키 시도

          case 'forbidden':
          case 'unauthorized':
            this.cooldown.setCooldown(provider, modelId, apiKey, 3_600_000, category)
            continue  // 다음 키 시도

          case 'model_not_found':
            this.cooldown.setModelCooldownAllKeys(provider, modelId, keys, 86_400_000, category)
            break  // 다음 모델로

          case 'server_overloaded':
            this.cooldown.setCooldown(provider, modelId, apiKey, 30_000, category)
            continue  // 다음 키 시도

          default:  // context_too_long, safety_filter 등
            break  // 다음 모델로 (키 바꿔도 무의미)
        }
        break  // 내부 break → 모델 루프의 다음 모델로
      }
    }

    // 모든 제공사/모델/키 소진
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

## LLM 어댑터

```typescript
interface ILLMAdapter {
  call(request: ChatRequest, modelId: string, apiKey: string): Promise<{
    ok: boolean
    status: number
    response?: ChatResponse
    errorBody: string
  }>
}

// Cline, Kilo, OpenRouter: OpenAI 호환이라 거의 동일
class OpenAICompatAdapter implements ILLMAdapter { ... }

// Gemini: 고유 형식 → OpenAI 규격 변환 필요
class GeminiAdapter implements ILLMAdapter {
  // Gemini API 호출 후 응답을 ChatResponse 형식으로 변환
  private transform(geminiResponse: GeminiRawResponse): ChatResponse { ... }
}
```
