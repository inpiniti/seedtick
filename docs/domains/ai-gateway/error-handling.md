# AI-Gateway 에러 처리 전략

> **참고**: 실제 구현은 `bitcoin-simulation/api/simple/gemini.js`의 cooldownMap 패턴을 기반으로 확장합니다.

---

## 에러 유형 분류

### 1. 요청 빈도 및 한도 관련 (HTTP 429)

| 에러 세부 유형 | 식별 방법 | 처리 방법 |
|:---|:---|:---|
| **RPM 초과** (분당 요청 수 초과) | 응답 body에 `RPM`, `rate_limit` 미포함 | 해당 키+모델 **60초 쿨다운** 후 다음 키/모델 |
| **TPM 초과** (분당 토큰 수 초과) | 응답 body에 `TPM`, `token` 포함 | 해당 키+모델 **60초 쿨다운** |
| **RPD 소진** (일일 할당량 소진) | 응답 body에 `PerDay`, `per day`, `quota_limit_value`, `insufficient_quota` 포함 | 해당 키+모델 **Supabase에 소진 기록** (자정 자동 초기화), 당일 해당 키 사용 금지 |

> **핵심**: RPD 소진은 Supabase에 영구 기록. 나머지는 인메모리 cooldownMap으로 충분.

---

### 2. 컨텍스트 및 토큰 초과 (HTTP 400)

| 에러 세부 유형 | 식별 방법 | 처리 방법 |
|:---|:---|:---|
| **컨텍스트 길이 초과** | `context_length_exceeded`, `maximum context` | 다음 모델로 이동 (키 변경 의미 없음) |
| **출력 토큰 초과** | `max_tokens`, `output tokens` | 다음 모델로 이동 |
| **안전 필터 차단** | `content_filter`, `safety` | 다음 모델로 이동 (요청 자체 문제) |
| **기타 요청 오류** | 그 외 400 | 다음 모델로 이동 (키 변경 무의미) |

---

### 3. 인증 및 접근 권한 (HTTP 401, 403)

| 코드 | 에러 세부 유형 | 처리 방법 |
|:---:|:---|:---|
| **401** | 키 만료, 잘못된 키 | 해당 키 **1시간 쿨다운** + 다음 키 시도 |
| **403** | 모델 접근 불가, 프로모션 만료 | 해당 키+모델 **1시간 쿨다운** |

---

### 4. 모델 미존재 (HTTP 404)

| 에러 세부 유형 | 처리 방법 |
|:---|:---|
| 모델 이름 오타, 서비스 종료 | **모든 키**에 대해 해당 모델 **24시간 쿨다운** (키 변경 무의미) |

---

### 5. 서버 과부하 (HTTP 503, 504)

| 코드 | 에러 세부 유형 | 처리 방법 |
|:---:|:---|:---|
| **503** | 무료 서버 트래픽 폭주, 일시 차단 | 해당 키+모델 **30초 쿨다운** 후 다음 시도 |
| **504** | 응답 타임아웃 | 다음 키+모델로 즉시 이동 |

---

## 폴백 흐름 다이어그램

```
요청 수신
  │
  ▼
[제공사 순회: Cline → Kilo → OpenRouter → Gemini]
  │
  ├─[모델 순회: 제공사 내 첫 번째 모델부터]
  │   │
  │   ├─[키 순회: 랜덤 시작점으로 순환]
  │   │   │
  │   │   ├─ cooldown 중? → 즉시 스킵 (0ms)
  │   │   │
  │   │   ├─ API 호출
  │   │   │   │
  │   │   │   ├─ 200 OK → ✅ 응답 반환
  │   │   │   │
  │   │   │   ├─ 429 RPM/TPM → cooldown 60s → 다음 키
  │   │   │   ├─ 429 RPD 소진 → Supabase 기록 → 다음 키
  │   │   │   ├─ 401/403 → cooldown 1h → 다음 키
  │   │   │   │
  │   │   │   ├─ 400/기타 → 다음 모델 (키 변경 무의미)
  │   │   │   └─ 404 → 모든 키에 24h cooldown → 다음 모델
  │   │   │
  │   │   └─ 모든 키 소진 → 다음 모델
  │   │
  │   └─ 모든 모델 소진 → 다음 제공사
  │
  └─ 모든 제공사 소진 → 503 반환 (lastError 포함)
```

---

## cooldownMap 구조 (인메모리)

```typescript
// Key 형식: "{apiKey 끝 8자}:{provider}:{model}"
// Value: 쿨다운 만료 타임스탬프 (ms)
const cooldownMap = new Map<string, number>()

function isCoolingDown(apiKey: string, provider: string, model: string): boolean {
  const key = `${apiKey.slice(-8)}:${provider}:${model}`
  const expireAt = cooldownMap.get(key)
  if (!expireAt) return false
  if (Date.now() > expireAt) {
    cooldownMap.delete(key)
    return false
  }
  return true
}

function setCooldown(apiKey: string, provider: string, model: string, durationMs: number, reason: string) {
  const key = `${apiKey.slice(-8)}:${provider}:${model}`
  cooldownMap.set(key, Date.now() + durationMs)
  console.log(`[Gateway] Cooldown ${key} (${reason}): ${durationMs / 1000}s`)
}
```

> **주의**: cooldownMap은 인메모리이므로 서버 재시작 시 리셋됩니다.
> RPD 소진만 Supabase에 영구 기록합니다 (아래 [quota-management.md](./quota-management.md) 참조).

---

## 쿨다운 시간 요약표

| 에러 | 범위 | 쿨다운 |
|:---|:---|:---|
| RPM/TPM 429 | 키+모델 | 60초 |
| RPD 소진 429 | 키+모델 | Supabase 기록 (자정까지) |
| 403 Forbidden | 키+모델 | 1시간 |
| 401 Unauthorized | 키 전체 | 1시간 |
| 404 Not Found | 모델 전체 | 24시간 |
| 503 Overloaded | 키+모델 | 30초 |
| 504 Timeout | 키+모델 | 즉시 다음 (cooldown 없음) |
