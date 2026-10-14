# Subscription & Auth 데이터베이스 스키마 (schema.md)

## 1. Supabase PostgreSQL 테이블 정의

```sql
-- 1. 사용자 프로필 테이블 (auth.users 확장)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  auth_provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. 구독 정보 테이블
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  plan_type TEXT NOT NULL DEFAULT 'none' CHECK (plan_type IN ('none', 'monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  current_period_end TIMESTAMPTZ,
  billing_key TEXT, -- 포트원 카드 빌링키 (정기 결제용)
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 3. 결제 트랜잭션 내역 테이블
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  merchant_uid TEXT NOT NULL UNIQUE, -- 주문 고유 번호
  imp_uid TEXT,                      -- 포트원 고유 결제 ID
  amount NUMERIC NOT NULL,           -- 결제 금액 (2900 or 29000)
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  pay_method TEXT NOT NULL,          -- 'card', 'kakaopay', etc.
  status TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'refunded')),
  receipt_url TEXT,
  error_message TEXT,
  paid_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 인덱스 설정
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_tier ON public.subscriptions(user_id, tier, current_period_end);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_uid ON public.payment_transactions(merchant_uid);
```

## 2. Row Level Security (RLS) 정책
- 유저는 자신의 프로필 및 본인 소유의 구독 정보만 조회 가능 (`auth.uid() = user_id`).
- 구독 생성 및 결제 처리는 Service Role API(서버리스 함수 또는 API 엔드포인트)를 통해 갱신.
