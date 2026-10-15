# Subscription & Auth 아키텍처 (architecture.md)

## 1. 시스템 구조 및 상호작용 (Mermaid)

```mermaid
graph TD
    Client["Next.js Web Client<br/>(reportist-admin)"]
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

---

## 4. 해지 및 일할 부분 환불 흐름도 (Prorated Cancel Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant AccountUI as 멤버십 관리 (/account)
    participant CancelApi as Next.js API (/api/billing/cancel)
    participant PortOne as PortOne REST API
    participant DB as Supabase DB (subscriptions / payments)

    User->>AccountUI: "구독 해지" 클릭
    AccountUI->>AccountUI: 일할 계산 프리뷰 (사용 일수 공제액 & 환불 예상액 안내)
    User->>AccountUI: 해지 확정 클릭
    AccountUI->>CancelApi: POST /api/billing/cancel (Bearer JWT)
    CancelApi->>DB: 최근 결제(payment_transactions) 및 구독 상태 조회
    CancelApi->>CancelApi: calculateProratedRefund (결제일시 대비 사용 일수 계산)
    alt 결제 후 7일 이내 (일할 계산 부분 환불)
        CancelApi->>PortOne: POST /payments/{id}/cancel (amount: refundAmount)
        CancelApi->>DB: payments 상태를 'partial_refunded'로 갱신
        CancelApi->>DB: subscriptions 상태를 'expired', tier를 'free'로 즉시 만료
    else 결제 후 7일 초과 (자동갱신 해지)
        CancelApi->>PortOne: DELETE /billing-keys/{key} (빌링키 삭제)
        CancelApi->>DB: subscriptions 상태를 'canceled'로 갱신 (만료일까지 Pro 유지)
    end
    CancelApi-->>AccountUI: 해지 결과 및 환불 안내 반환
    AccountUI-->>User: 상태 변경 토스트 및 화면 즉시 갱신
```

