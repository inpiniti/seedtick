-- ==============================================================================
-- Migration: 결제/구독 쓰기를 서버 전용으로 전환 + 결제 메타 컬럼 추가
-- 적용: Supabase SQL Editor에서 1회 실행
-- ==============================================================================

-- 1) 클라이언트가 직접 구독을 수정(=스스로 PRO 승격)할 수 있던 정책 제거.
--    이후 subscriptions / payment_transactions 쓰기는 service_role(서버 API)만 가능.
DROP POLICY IF EXISTS "Users can insert/update own subscriptions" ON public.subscriptions;

-- 2) 결제 메타 컬럼
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;

-- 부분 환불 상태 허용
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('paid', 'failed', 'refunded', 'partial_refunded'));

-- 3) 다음 회차 예약 결제 ID (해지 시 예약 취소용)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS next_payment_id TEXT;
