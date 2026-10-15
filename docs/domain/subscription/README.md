# Subscription & Auth 도메인 (구독 및 인증)

## 1. 도메인 정의
Reportist Research 서비스의 사용자 인증(Supabase Auth)과 멤버십 요금제(Free vs Pro), 결제 게이트웨이(PortOne V2) 및 구독 라이프사이클을 총괄하는 도메인입니다.

---

## 2. DDD 핵심 모델

### A. 엔티티 (Entities)
- **`UserProfile`** (`id`: UUID, `email`: String, `auth_provider`: String, `created_at`: Timestamp)
  - Supabase Auth의 유저와 1:1 매핑되는 프로필 엔티티.
- **`Subscription`** (`id`: UUID, `user_id`: UUID, `tier`: 'free' | 'pro', `plan_type`: 'monthly' | 'yearly' | 'none', `status`: 'active' | 'canceled' | 'expired', `current_period_start`: Timestamp, `current_period_end`: Timestamp, `billing_key`: String?)
  - 유저의 멤버십 및 결제 상태, 구독 유효기간을 관리하는 Root Entity.
- **`PaymentTransaction`** (`id`: UUID, `subscription_id`: UUID, `imp_uid`: String, `merchant_uid`: String, `amount`: Number, `pay_method`: String, `status`: 'paid' | 'failed' | 'refunded', `paid_at`: Timestamp)
  - 포트원 결제 시도 및 완료 트랜잭션 기록.

### B. 값 객체 (Value Objects)
- **`PlanPricing`**: 월간 2,900원 / 연간 29,000원 (불변 가격 모델).
- **`SubscriptionPeriod`**: 시작일(`start`)과 종료일(`end`), 만료 여부(`isExpired()`) 판정.
- **`ReportAccessGuard`**: 특정 보고서 일자가 현재 시점 기준 30일 이내인지 검증하는 가드 VO.

### C. 도메인 서비스 (Domain Services)
- **`SubscriptionBillingService`**: 포트원 결제 완료 웹훅/응답 검증 및 만료일 계산 갱신.
- **`ReportAuthorizationPolicy`**: 사용자 등급(Free/Pro)에 따라 허용 가능한 보고서 일자 및 기본 디폴트 선택 날짜 계산.
- **`CancellationPolicy`** (`decideCancellation`): 최근 결제일 기준 환불(즉시 만료) / 기간 만료 시 종료 여부 결정. 포트원 호출은 서버(`/api/billing/cancel`)에서만 수행.

---

## 3. 핵심 비즈니스 불변식 (Invariants)

1. **최신 리포트 접근 제어**:
   - Free 사용자는 `Report Date >= (Today - 30일)`인 보고서의 상세 본문을 직접 열람할 수 없다.
   - Free 사용자가 리포트 뷰어/카탈로그 진입 시, **기본 선택 일자(Default Date)**는 항상 "30일 이전(과거) 중 가장 최신 발행일"로 자동 세팅된다.
2. **구독 기간 보장**:
   - 사용자가 정기 결제를 중도 해지(`status = 'canceled'`)하더라도, 이미 결제된 마감일(`current_period_end`)까지는 Pro 권한이 완전히 유지된다.
   - 만료일이 지난 시점(`now() > current_period_end`)에서 차기 결제가 없으면 자동으로 Free 티어로 강등된다.
3. **만료일 연장 공식**:
   - 신규/갱신 결제 성공 시:
     - 기존 Pro 기간이 남아있다면: `새 만료일 = 기존 current_period_end + (월간 1개월 | 연간 1년)`
     - 기존 Pro 기간이 만료되었거나 신규라면: `새 만료일 = 결제 시점(now) + (월간 1개월 | 연간 1년)`
4. **정기 결제 수단 한정**:
   - 자동 갱신(정기 결제)은 신용/체크카드 등록(포트원 빌링키)을 통해서만 가능하며, 계좌이체/간편결제 단건 결제는 1회성 기간권(연간 등)으로 동작한다.
5. **신규 가입 24시간 무료 체험 (Welcome Trial)**:
   - 신규 가입 유저(`created_at` 기준 24시간 이내)는 별도 유료 결제 없이 24시간 동안 Pro와 동일하게 최신 리포트 및 SEC 데이터팩을 전체 열람할 수 있다.
   - 비로그인 사용자가 최신 리포트에 접근할 경우, 즉각적인 유료 결제 유도 대신 "1초 만에 로그인하고 24시간 무료 체험 시작하기" 웰컴 퍼널을 우선 제공한다.
   - 24시간 체험 기간 중에는 결제 유도를 최소화하고 웰컴 배지 및 잔여 시간을 안내하며, 24시간 경과 후 일반 Free 티어로 전환되어 Pro 구독 유료 전환 안내가 개시된다.
6. **멱등성 보장**:
   - 포트원의 중복 웹훅이나 클라이언트 재시도 요청이 발생하더라도 동일한 `merchant_uid` / `payment_id`에 대해 기간이 중복으로 연장되지 않는다.
7. **해지 및 일할 계산 부분 환불 (7일 청약철회 & 일할 공제)**:
   - 최근 결제(`status = 'paid'`) 후 **7일 이내**에 해지하면 사용 일수(최소 1일)만큼의 이용료를 공제하고 나머지 잔여 금액을 포트원 부분 취소 API로 **부분 환불**한다.
   - 부분 환불 실행 시 구독은 즉시 만료(`status = 'expired'`, `tier = 'free'`)되며 결제 내역은 `partial_refunded`(전액 시 `refunded`)로 갱신된다.
   - **7일 이후** 해지는 자동갱신만 중단한다: 포트원 빌링키를 삭제하고 `status = 'canceled'`로 바꾸되, `current_period_end`까지 Pro를 유지한다(불변식 2).
   - 모든 결제 검증(`POST /api/billing/confirm`)과 취소/환불(`POST /api/billing/cancel`)은 **서버에서만 수행**하며, 클라이언트는 결제 승인/환불/DB 직접 수정을 수행하지 않는다.
   - 포트원 API Secret(`PORTONE_API_SECRET`)은 서버에서만 사용한다.
