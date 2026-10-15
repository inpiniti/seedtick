-- ==============================================================================
-- Migration: 과금 테이블 클라이언트 직접 쓰기 차단 + 결제 멱등성 강화
-- 적용: Supabase SQL Editor에서 1회 실행
-- 전제: 서버 API는 service_role로 동작하므로 RLS 정책과 무관하게 쓰기 가능.
--       아래 정책은 anon/authenticated(브라우저) 키의 직접 쓰기만 막습니다.
-- ==============================================================================

-- 1) 구독 테이블: 남아 있을 수 있는 클라이언트 쓰기 정책 제거
DROP POLICY IF EXISTS "Users can insert/update own subscriptions" ON public.subscriptions;

-- 2) 결제 테이블: 혹시 존재하는 쓰기 정책 제거 (SELECT 전용으로 유지)
DROP POLICY IF EXISTS "Users can insert own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can update own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can insert/update own payment transactions" ON public.payment_transactions;

-- 3) 본인 조회 정책 보장 (없으면 생성)
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 4) 결제 메타 컬럼 (이미 있으면 무시)
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;

-- 5) 부분 환불 상태 허용
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('paid', 'failed', 'refunded', 'partial_refunded'));

-- 6) 동일 PortOne 결제의 중복 기록 방지 (리플레이 방지, NULL 제외)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_imp_uid_unique
  ON public.payment_transactions(imp_uid) WHERE imp_uid IS NOT NULL;

-- 7) 다음 회차 예약 결제 ID (해지 시 예약 취소용)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS next_payment_id TEXT;
