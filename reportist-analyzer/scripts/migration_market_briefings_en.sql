-- ==============================================================================
-- 마이그레이션: 일일 마켓 브리핑 영문화 다국어 지원 컬럼 추가 (market_briefings)
--
-- Reportist 글로벌/영문 서비스(/en/briefings, /en/briefings/[date]) 지원을 위해
-- AI 마켓 브리핑의 영문 헤드라인, 영문 마크다운 전문, 영문 3줄 요약, 토픽, 키워드 컬럼을 추가합니다.
-- ==============================================================================

ALTER TABLE IF EXISTS public.market_briefings
ADD COLUMN IF NOT EXISTS title_en TEXT NULL,
ADD COLUMN IF NOT EXISTS content_en TEXT NULL,
ADD COLUMN IF NOT EXISTS summary_3lines_en JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS topics_en TEXT[] NULL,
ADD COLUMN IF NOT EXISTS keywords_en TEXT[] NULL;

COMMENT ON COLUMN public.market_briefings.title_en IS '영문 메인 헤드라인 (Daily Market Briefing Headline in English)';
COMMENT ON COLUMN public.market_briefings.content_en IS '영문 마크다운 브리핑 뉴스레터 전문 (Full English Markdown Article)';
COMMENT ON COLUMN public.market_briefings.summary_3lines_en IS '오늘의 시장 3줄 요약 영문 (3-Line Market Summary in English, JSON 배열)';
COMMENT ON COLUMN public.market_briefings.topics_en IS '영문 핵심 이슈 제목 목록 (Top Issues in English)';
COMMENT ON COLUMN public.market_briefings.keywords_en IS '영문 검색 및 메타태그 키워드 배열 (English Search & SEO Keywords)';
