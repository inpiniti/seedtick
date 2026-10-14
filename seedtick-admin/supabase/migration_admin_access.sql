-- ==============================================================================
-- SeedTick Admin Access Migration
-- 파이프라인(/pipeline) + 감사로그(/admin) 찐 어드민 전용화
--
-- 1) user_profiles.is_admin 플래그 추가 (관리자 판별 단일 진실)
-- 2) 일반 유저의 is_admin 셀프 승격 차단 (UPDATE 트리거)
-- 3) error_logs 직접 읽기 전면 차단 (Next /api/admin/logs 게이트웨이만 허용)
--
-- Supabase Dashboard > SQL Editor에 복사하여 실행하세요.
-- 적용 후, 실제 관리자 계정을 아래 SQL로 지정하세요:
--   UPDATE public.user_profiles SET is_admin = true WHERE email IN ('admin@example.com');
-- ==============================================================================

-- ── 1. is_admin 컬럼 ──
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
  ON public.user_profiles(is_admin) WHERE is_admin = true;

-- ── 2. 셀프 승격 차단 트리거 ──
-- "Users can update own profile" 정책이 있어도 is_admin만은 바꿀 수 없게 한다.
-- service_role 경유(서버 게이트웨이, auth.uid()가 NULL)는 우회하므로 정상 동작.
CREATE OR REPLACE FUNCTION public.prevent_is_admin_self_escalation()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'is_admin flag can only be changed by server administrators';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_is_admin_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_is_admin_escalation
  BEFORE UPDATE OF is_admin ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_is_admin_self_escalation();

-- 본인 프로필 읽기 정책이 is_admin까지 노출하는지 보장
-- (기존 "Users can view own profile"이 있으면 그대로 유지, 없으면 생성)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.user_profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END
$$;

-- ── 3. error_logs 직접 읽기 차단 (default deny) ──
-- 이후 감사로그 조회는 Next.js /api/admin/logs 게이트웨이(service_role)만 허용.
-- anon/authenticated가 anon 키로 직접 select하면 0건(deny) 반환됩니다.
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 기존에 열려 있던 공개 읽기 정책이 있으면 제거
DROP POLICY IF EXISTS error_logs_read ON public.error_logs;
DROP POLICY IF EXISTS "error_logs read" ON public.error_logs;
DROP POLICY IF EXISTS "Allow read error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "public read error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.error_logs;

-- PostgREST 역할의 직접 SELECT 권한 회수 (이중 잠금)
-- 테이블이 없으면 실패하므로 가드 처리
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'error_logs'
  ) THEN
    REVOKE SELECT ON public.error_logs FROM anon, authenticated;
  END IF;
END
$$;

-- 참고: service_role은 RLS를 우회하므로 /api/admin/logs 게이트웨이는 정상 동작.
-- 쓰기는 기존대로 service_role(analyzer 파이프라인 로그 핸들러)만 수행.
