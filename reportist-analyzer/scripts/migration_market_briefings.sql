-- ==============================================================================
-- 마이그레이션: 일일 커뮤니티 & 뉴스 큐레이터 브리핑 테이블 (market_briefings)
--
-- 매일 자정 00:05 KST에 수집·분석된 글로벌 커뮤니티 및 24시간 주요 뉴스의
-- 종합 마켓 브리핑(중복 배제)을 적재하는 테이블입니다.
-- ==============================================================================

create table if not exists public.market_briefings (
  id             text        not null primary key, -- {d} (예: 2026-10-23)
  d              date        not null unique,      -- 발행 일자
  title          text        not null,             -- 메인 헤드라인
  content        text        not null,             -- 마크다운 브리핑 뉴스레터 전문
  summary_3lines jsonb       default '[]'::jsonb,  -- 오늘의 시장 3줄 요약
  topics         text[],                           -- 선정된 핵심 이슈 제목 목록
  tickers        text[],                           -- 관련 종목 티커 배열 (예: ['NVDA', 'TSLA'])
  keywords       text[],                           -- 중복 배제 및 검색용 핵심 키워드 배열
  sources        jsonb       default '{}'::jsonb,  -- 채널별 수집 건수 통계
  raw_count      integer     default 0,            -- 전체 원천 수집 데이터 수
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS 정책 설정 (공개 조회 허용)
alter table public.market_briefings enable row level security;

create policy "Allow public read-only access for market_briefings"
  on public.market_briefings for select
  using (true);

create policy "Allow service_role full access for market_briefings"
  on public.market_briefings for all
  using (auth.role() = 'service_role');

-- 일자 역순 정렬 색인
create index if not exists idx_market_briefings_d on public.market_briefings (d desc);
