# Subscription & Auth 아키텍처 (architecture.md)

## 1. 시스템 구조 및 상호작용 (Mermaid)

```mermaid
graph TD
    Client["Next.js Web Client<br/>(seedtick-admin)"]
    SupabaseAuth["Supabase Auth<br/>(Google / Email)"]
    PortOne["PortOne V2 SDK<br/>(결제창 & 빌링키)"]
    SupabaseDB[("Supabase DB<br/>(subscriptions / payments)")]
    NextApi["Next.js API Routes<br/>(/api/billing /api/auth)"]

    Client -->|1. 소셜 로그인| SupabaseAuth
    SupabaseAuth -->|2. JWT 세션 & 프로필| Client
    Client -->|3. 최근 30일 리포트 가드| Client
    Client -->|4. 결제 요청| PortOne
    PortOne -->|5. 결제/빌링키 완료| Client
    Client -->|6. 결제 검증 및 구독 갱신| NextApi
    NextApi -->|7. 결제 검증 API 호출| PortOne
    NextApi -->|8. 구독 활성화 & 마감일 갱신| SupabaseDB
    Client -->|9. 구독 상태 실시간 반영| Client
```

---

## 2. 권한 판정 흐름도 (Date Guard)

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant UI as 리포트 뷰어 / 날짜 선택기
    participant Guard as ReportAccessGuard (정책)
    participant Modal as ProUpgradeModal

    User->>UI: 날짜 선택 드롭다운 오픈
    Note over UI: Free 유저는 30일 이전 최신일이 기본 선택됨
    User->>UI: 최근 30일 이내 날짜 클릭
    UI->>Guard: isDateRestricted(selectedDate, userTier)
    alt userTier == 'free' AND date >= 30일 전
        Guard-->>UI: 접근 불가 (Restricted)
        UI->>Modal: Pro 전용 알림 모달 팝업
        alt 사용자가 '취소' 클릭
            Modal-->>UI: 기존 과거 날짜 상태 유지
        else 사용자가 'Pro 업그레이드' 클릭
            Modal->>UI: 요금제 비교 및 결제창 호출
        end
    else userTier == 'pro' OR date < 30일 전
        Guard-->>UI: 접근 허용 (Allowed)
        UI->>UI: 해당 날짜의 리포트 로드
    end
```

---

## 3. 정기 결제(빌링키) 및 마감일 산출 로직

```typescript
export function calculateSubscriptionExpiry(
  currentPeriodEnd: Date | null,
  planType: 'monthly' | 'yearly',
  baseDate: Date = new Date()
): Date {
  // 기존 Pro 유효기간이 미래로 남아있으면 그 날짜 기준으로 연장, 아니면 현재 결제 시점 기준
  const startFrom = currentPeriodEnd && currentPeriodEnd > baseDate ? currentPeriodEnd : baseDate;
  const expiry = new Date(startFrom);

  if (planType === 'monthly') {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (planType === 'yearly') {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  return expiry;
}
```
