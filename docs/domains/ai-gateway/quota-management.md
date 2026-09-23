# AI-Gateway 일일 소진 키 관리 (Supabase)

> RPM/TPM 등 일시적 에러는 인메모리 cooldownMap으로 충분하지만,
> **일일 할당량(RPD) 소진**은 자정까지 유효하므로 Supabase에 영구 기록합니다.

---

## Supabase 테이블 스키마

```sql
CREATE TABLE gateway_quota_exhausted (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider    TEXT NOT NULL,           -- 'gemini', 'cline', 'kilo', 'openrouter'
  model       TEXT NOT NULL,           -- 모델 ID
  api_key_hash TEXT NOT NULL,          -- API 키 끝 8자 (보안상 전체 저장 금지)
  exhausted_at TIMESTAMPTZ DEFAULT NOW(),
  reset_at    TIMESTAMPTZ NOT NULL,    -- 초기화 예정 시각 (제공사 기준 자정)
  UNIQUE(provider, model, api_key_hash)
);

-- 초기화된 항목 자동 제거 (선택적: 매일 새벽 배치로 실행)
DELETE FROM gateway_quota_exhausted WHERE reset_at < NOW();
```

---

## reset_at 계산 (제공사별 자정 기준)

| 제공사 | 기준 자정 | reset_at 계산 |
|:---|:---|:---|
| **Gemini** | 태평양 자정 (PT) | 다음 날 UTC 07:00 (PST) 또는 08:00 (PDT) |
| **Cline** | UTC 자정 | 다음 날 UTC 00:00 |
| **Kilo** | UTC 자정 | 다음 날 UTC 00:00 |
| **OpenRouter** | UTC 자정 | 다음 날 UTC 00:00 |

```typescript
function calcResetAt(provider: string): Date {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  if (provider === 'gemini') {
    // 태평양 자정 = UTC 08:00 (PDT 기준, 동절기 07:00)
    tomorrow.setUTCHours(8, 0, 0, 0)
  } else {
    // 나머지: UTC 자정
    tomorrow.setUTCHours(0, 0, 0, 0)
  }
  return tomorrow
}
```

---

## 구현 흐름

### 1. RPD 소진 감지 시 기록

```typescript
async function markKeyExhausted(
  provider: string,
  model: string,
  apiKey: string
): Promise<void> {
  const hash = apiKey.slice(-8)
  const resetAt = calcResetAt(provider)

  await supabase.from('gateway_quota_exhausted').upsert({
    provider,
    model,
    api_key_hash: hash,
    exhausted_at: new Date().toISOString(),
    reset_at: resetAt.toISOString(),
  }, {
    onConflict: 'provider,model,api_key_hash'
  })
}
```

### 2. 요청 시작 시 소진 여부 확인

```typescript
async function isKeyExhausted(
  provider: string,
  model: string,
  apiKey: string
): Promise<boolean> {
  const hash = apiKey.slice(-8)
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('gateway_quota_exhausted')
    .select('id')
    .eq('provider', provider)
    .eq('model', model)
    .eq('api_key_hash', hash)
    .gt('reset_at', now)   // 아직 리셋 시각 미도래
    .single()

  return !!data
}
```

### 3. 자정 자동 초기화 (Supabase Edge Function 또는 배치)

```typescript
// Supabase Edge Function: /functions/cleanup-gateway-quota
// cron: '0 0,8 * * *' (UTC 자정 + 08:00 두 번 실행)
const { error } = await supabase
  .from('gateway_quota_exhausted')
  .delete()
  .lt('reset_at', new Date().toISOString())
```

---

## 성능 최적화: 인메모리 캐시 + Supabase 이중 구조

Supabase 조회는 매 요청마다 하면 비용/지연이 발생합니다.
앱 시작 시 소진 목록을 로드하고, 인메모리에서 1차 확인합니다.

```typescript
// 시작 시 한 번 로드
const exhaustedSet = new Set<string>()  // "{provider}:{model}:{key_hash}"

async function loadExhaustedKeys() {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('gateway_quota_exhausted')
    .select('provider, model, api_key_hash')
    .gt('reset_at', now)

  exhaustedSet.clear()
  for (const row of data ?? []) {
    exhaustedSet.add(`${row.provider}:${row.model}:${row.api_key_hash}`)
  }
}

// 소진 감지 시
function markExhaustedLocal(provider: string, model: string, apiKey: string) {
  exhaustedSet.add(`${provider}:${model}:${apiKey.slice(-8)}`)
  // 비동기로 Supabase에도 기록 (응답 지연 없음)
  markKeyExhausted(provider, model, apiKey).catch(console.error)
}

// 확인 (0ms, Supabase 조회 없음)
function isExhaustedLocal(provider: string, model: string, apiKey: string): boolean {
  return exhaustedSet.has(`${provider}:${model}:${apiKey.slice(-8)}`)
}
```

---

## 환경변수 설정

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # 서비스 롤 키 (RLS 우회 필요)
```

> RLS(Row Level Security): `gateway_quota_exhausted` 테이블은 서비스 롤에서만 읽기/쓰기 허용
