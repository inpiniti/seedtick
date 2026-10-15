-- ==============================================================================
-- Reportist Subscription & Membership DB Schema (Supabase)
-- ==============================================================================

-- 1. 사용자 프로필 테이블 (auth.users 연동)
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
  billing_key TEXT,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 3. 결제 내역 트랜잭션 테이블
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  merchant_uid TEXT NOT NULL UNIQUE,
  imp_uid TEXT,
  amount NUMERIC NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  pay_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'refunded')),
  receipt_url TEXT,
  error_message TEXT,
  paid_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_tier ON public.subscriptions(user_id, tier, current_period_end);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_uid ON public.payment_transactions(merchant_uid);

-- 5. RLS (Row Level Security) 활성화 및 정책 설정
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- 유저는 본인 프로필 및 구독 정보만 조회 가능
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update own subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 6. 신규 회원가입(카카오/구글/이메일) 시 자동 프로필 및 기본 Free 구독 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1) user_profiles에 유저 생성
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url, auth_provider)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2) subscriptions에 기본 Free 구독 생성
  INSERT INTO public.subscriptions (user_id, tier, plan_type, status, current_period_start)
  VALUES (new.id, 'free', 'none', 'active', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 트리거 등록
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
