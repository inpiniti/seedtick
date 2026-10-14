-- ==============================================================================
-- SeedTick Reports Lockdown Migration
-- guru_reports / guru_opinions / report_metrics / guru_votes 직접 읽기 전면 차단
--
-- 이후 리포트 조회는 Next.js /api/reports/* 게이트웨이(service_role)만 허용.
-- anon/authenticated가 anon 키로 직접 select하면 0건(deny) 반환됩니다.
-- Supabase Dashboard > SQL Editor에 복사하여 실행하세요.
-- ==============================================================================

-- 1. 민감 테이블의 기존 공개 읽기 정책 제거 (default deny)
DROP POLICY IF EXISTS guru_reports_read ON public.guru_reports;
DROP POLICY IF EXISTS guru_opinions_read ON public.guru_opinions;
DROP POLICY IF EXISTS report_metrics_read ON public.report_metrics;
DROP POLICY IF EXISTS guru_votes_read ON public.guru_votes;

-- 2. RLS 유지 (service_role은 RLS를 우회하므로 게이트웨이는 정상 동작)
ALTER TABLE public.guru_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_votes ENABLE ROW LEVEL SECURITY;

-- 3. PostgREST 역할의 직접 SELECT 권한 회수 (이중 잠금)
REVOKE SELECT ON public.guru_reports FROM anon, authenticated;
REVOKE SELECT ON public.guru_opinions FROM anon, authenticated;
REVOKE SELECT ON public.report_metrics FROM anon, authenticated;
REVOKE SELECT ON public.guru_votes FROM anon, authenticated;

-- 참고: 쓰기는 기존대로 service_role(analyzer 파이프라인)만 수행.
-- 비민감 테이블(ticker_logos, error_logs)은 공개 유지를 원하면 손대지 마세요.
