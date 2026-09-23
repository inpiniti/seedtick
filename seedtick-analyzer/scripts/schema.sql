-- ==============================================================================
-- SeedTick Supabase Database Schema
--
-- 1. guru_reports : 리포트 전문, 데이터팩, 13인 요약, 원탁 토론 저장 (추후 어날리시스 조회용)
-- 2. guru_votes   : 스크리너 대시보드 랭킹 및 13인 거장 표결 점수 (g0~g13) 저장
--
-- Supabase 대시보드 > SQL Editor에 복사하여 실행하세요.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. guru_reports: 심층 투자 보고서 마스터 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.guru_reports (
  id            text        not null primary key, -- {date}_{ticker} (예: 2026-09-23_NVDA)
  d             date        not null,             -- 분석 일자
  ticker        text        not null,             -- 종목 티커 (예: NVDA)
  company_name  text,                             -- 기업명
  current_price numeric,                          -- 분석 당시 주가 (USD)
  verdict       text        not null,             -- 종합 의견 (매수 / 보유 / 관망 / 매도)
  overall_score smallint    not null,             -- 종합 점수 (0: 매수, 1: 보유, 2: 관망, 3: 매도)
  vote_summary  text,                             -- 표결 요약 (예: 매수 8 · 보유 3 · 관망 1 · 매도 1)
  datapack      jsonb,                            -- 공용 심층 팩트 (재무제표 시계열, 밸류에이션, 지표)
  summaries     jsonb,                            -- 13인 거장 개별 요약 블록 배열
  discussion    text,                             -- 거장 원탁 토론 전문 마크다운
  final_report  text,                             -- 최종 마스터 종합 투자 보고서 마크다운
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists guru_reports_d_idx on public.guru_reports (d desc);
create index if not exists guru_reports_ticker_idx on public.guru_reports (ticker);
create index if not exists guru_reports_score_idx on public.guru_reports (overall_score);

-- RLS 정책 설정 (공개 읽기, 서비스 롤 쓰기)
alter table public.guru_reports enable row level security;
drop policy if exists guru_reports_read on public.guru_reports;
create policy guru_reports_read on public.guru_reports for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 2. guru_votes: 13인의 거장 표결 점수 집계 테이블 (스크리너 랭킹 연동)
-- ------------------------------------------------------------------------------
create table if not exists public.guru_votes (
  d           date        not null,       -- 분석 일자
  ticker      text        not null,       -- 티커 (예: NVDA)
  name        text,                       -- 종목명
  nation      text        not null default 'us',
  screeners   text[],                     -- 통과한 스크리너 목록 (기본: ['공통'])
  g0  smallint,                           -- 종합 점수 (0: 매수, 1: 보유, 2: 관망, 3: 매도)
  g1  smallint, -- 벤저민 그레이엄
  g2  smallint, -- 세스 클라먼
  g3  smallint, -- 모니시 파브라이
  g4  smallint, -- 조엘 그린블라트
  g5  smallint, -- 앙드레 코스톨라니
  g6  smallint, -- 잭 슈웨거
  g7  smallint, -- 워런 버핏
  g8  smallint, -- 필립 피셔
  g9  smallint, -- 뉴욕주민 / 찰리 멍거
  g10 smallint, -- 피터 린치
  g11 smallint, -- 애스워스 다모다란
  g12 smallint, -- 존 템플턴
  g13 smallint, -- 마이클 버리
  updated_at  timestamptz not null default now(),
  primary key (d, ticker),
  constraint guru_votes_score_range check (
    coalesce(g0,0)  between 0 and 3 and coalesce(g1,0)  between 0 and 3 and
    coalesce(g2,0)  between 0 and 3 and coalesce(g3,0)  between 0 and 3 and
    coalesce(g4,0)  between 0 and 3 and coalesce(g5,0)  between 0 and 3 and
    coalesce(g6,0)  between 0 and 3 and coalesce(g7,0)  between 0 and 3 and
    coalesce(g8,0)  between 0 and 3 and coalesce(g9,0)  between 0 and 3 and
    coalesce(g10,0) between 0 and 3 and coalesce(g11,0) between 0 and 3 and
    coalesce(g12,0) between 0 and 3 and coalesce(g13,0) between 0 and 3
  )
);

create index if not exists guru_votes_d_idx on public.guru_votes (d desc);
create index if not exists guru_votes_g0_idx on public.guru_votes (g0);

-- RLS 정책 설정 (공개 읽기, 서비스 롤 쓰기)
alter table public.guru_votes enable row level security;
drop policy if exists guru_votes_read on public.guru_votes;
create policy guru_votes_read on public.guru_votes for select to anon, authenticated using (true);
