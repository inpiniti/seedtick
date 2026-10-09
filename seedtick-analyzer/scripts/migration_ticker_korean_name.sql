-- ==============================================================================
-- SeedTick Migration: ticker_logos 테이블에 종목 한글명(korean_name) 캐시 추가
--
-- 배경:
--   - 관리자 화면의 모든 메뉴(가치평가/거장 리포트, 슈퍼인베스트, 실시간 발굴)에서
--     종목명을 한글명으로 통일 표시하기 위해 ticker_logos에 한글명을 캐시한다.
--   - 로고(logo_image_url)는 토스 로고 워밍업으로 채워지며, 한글명은 동일 사이클에서
--     토스 검색/상세 응답의 한글 표기를 함께 저장한다.
--   - 로고가 없는 종목도 한글명만 캐시할 수 있도록 logo_image_url NOT NULL 제약을 완화한다.
--
-- 실행 방법:
--   Supabase 대시보드 > SQL Editor 에서 아래 문장을 실행하세요. (멱등 실행 가능)
--
-- 미적용 시 증상:
--   - 앱 로그에 "[Supabase] ticker_logos.korean_name 컬럼이 없습니다" 경고가 1회 찍히고,
--     이후 한글명 캐시는 자동 비활성화(서킷브레이커)되어 로고 기능만 동작한다.
-- ==============================================================================

-- 1. 로고 URL NOT NULL 제약 완화 (한글명만 캐시된 행 유지를 위해)
alter table public.ticker_logos
  alter column logo_image_url drop not null;

-- 2. 종목 한글명 컬럼 추가 (예: AAPL -> 애플, 007660 -> 이수페타시스)
alter table public.ticker_logos
  add column if not exists korean_name text;

-- 3. (선택) 한글명 부분 검색/정렬 보조 인덱스 — 종목명 검색 성능이 필요할 때 주석 해제
-- create index if not exists ticker_logos_korean_name_idx
--   on public.ticker_logos (korean_name);
