-- ==============================================================================
-- Migration: 다국어(한국어/영어) 지원을 위한 영문 컬럼 추가
-- 1. ticker_logos: 영문 기업명 (english_name) 컬럼 추가
-- 2. guru_reports: 영문 기업명 및 영문 리포트 요약/본문 컬럼 추가
-- ==============================================================================

-- 1. ticker_logos 테이블에 영문 기업명 컬럼 추가
ALTER TABLE IF EXISTS public.ticker_logos
ADD COLUMN IF NOT EXISTS english_name TEXT NULL;

COMMENT ON COLUMN public.ticker_logos.english_name IS '정식 영문 기업명 (예: Apple Inc., Alphabet Inc., NVIDIA Corporation)';

-- 2. guru_reports 테이블에 영문 컬럼 추가
ALTER TABLE IF EXISTS public.guru_reports
ADD COLUMN IF NOT EXISTS company_name_en TEXT NULL,
ADD COLUMN IF NOT EXISTS final_report_en TEXT NULL,
ADD COLUMN IF NOT EXISTS conclusion_en TEXT NULL,
ADD COLUMN IF NOT EXISTS bull_points_en JSONB NULL,
ADD COLUMN IF NOT EXISTS bear_points_en JSONB NULL,
ADD COLUMN IF NOT EXISTS hot_topics_en JSONB NULL,
ADD COLUMN IF NOT EXISTS key_drivers_en JSONB NULL;

COMMENT ON COLUMN public.guru_reports.company_name_en IS '영문 기업명 (Yahoo Finance 공식 longName/shortName)';
COMMENT ON COLUMN public.guru_reports.final_report_en IS '영문 마스터 리포트 마크다운 본문';
COMMENT ON COLUMN public.guru_reports.conclusion_en IS '영문 종합 결론 서술';
COMMENT ON COLUMN public.guru_reports.bull_points_en IS '영문 매수/상승 근거 목록 (JSON 배열)';
COMMENT ON COLUMN public.guru_reports.bear_points_en IS '영문 리스크/하방 요인 목록 (JSON 배열)';
COMMENT ON COLUMN public.guru_reports.hot_topics_en IS '영문 핵심 쟁점 목록 (JSON 배열)';
COMMENT ON COLUMN public.guru_reports.key_drivers_en IS '영문 주요 트리거/드라이버 목록 (JSON 배열)';

-- 3. 빠른 영문 검색 및 조회를 위한 인덱스 생성 (옵션)
CREATE INDEX IF NOT EXISTS idx_ticker_logos_english_name
ON public.ticker_logos (english_name)
WHERE english_name IS NOT NULL;
