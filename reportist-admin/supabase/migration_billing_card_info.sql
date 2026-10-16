-- ==============================================================================
-- Migration: subscriptions 및 payment_transactions에 카드 식별 정보 컬럼 추가
-- 적용: Supabase SQL Editor에서 1회 실행
-- 목적:
--   1) 사용자에게 "어떤 카드로 결제되는지" 명확히 안내 (예: 신한카드 끝 4자리 5678)
--   2) 법적/보안상 안전한 마스킹 정보(카드사명, 끝 4자리)만 저장 (전체 번호/CVC/비번 절대 저장 안함)
-- ==============================================================================

-- 1) 구독 테이블에 카드 식별 컬럼 추가
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS card_name TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT;

-- 2) 결제 내역 테이블에 카드사명 컬럼 추가 (card_last4는 이전 마이그레이션에서 이미 존재)
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS card_name TEXT;
