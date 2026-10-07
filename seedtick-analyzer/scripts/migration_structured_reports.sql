-- ==============================================================================
-- SeedTick Migration: 보고서 데이터 세분화 및 정규 컬럼/하위 테이블 확장
-- 
-- 1. guru_reports 테이블에 정규 검색/정렬 컬럼 추가 (적정가, 밴드, 표결수, 확신도 등)
-- 2. guru_opinions 테이블 신설: 13인 거장 개별 평가 롱 포맷 저장
-- 3. report_metrics 테이블 신설: 재무/밸류에이션/시장 핵심 지표 숫자 컬럼화
-- 
-- Supabase 대시보드 > SQL Editor 에서 실행하세요. (멱등 실행 가능)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. guru_reports 정규 검색/정렬 컬럼 추가
-- ------------------------------------------------------------------------------
alter table public.guru_reports
  add column if not exists fair_value         numeric,
  add column if not exists band_low           numeric,
  add column if not exists band_high          numeric,
  add column if not exists safety_entry       numeric,
  add column if not exists target_sell        numeric,
  add column if not exists upside_pct         numeric,
  add column if not exists votes_buy          smallint,
  add column if not exists votes_hold         smallint,
  add column if not exists votes_watch        smallint,
  add column if not exists votes_sell         smallint,
  add column if not exists avg_confidence     numeric,
  add column if not exists conclusion         text,
  add column if not exists hot_topics         text[],
  add column if not exists bull_points        text[],
  add column if not exists bear_points        text[],
  add column if not exists key_drivers        text[],
  add column if not exists action_guide       jsonb,
  add column if not exists valuation_flags    text[],
  add column if not exists parse_mode         text,
  add column if not exists prompt_version     text;

create index if not exists guru_reports_fair_value_idx on public.guru_reports (fair_value);
create index if not exists guru_reports_upside_pct_idx on public.guru_reports (upside_pct desc);
create index if not exists guru_reports_votes_buy_idx  on public.guru_reports (votes_buy desc);


-- ------------------------------------------------------------------------------
-- 2. guru_opinions: 13인 거장 개별 평가 상세 (리포트 1건당 13행)
-- ------------------------------------------------------------------------------
create table if not exists public.guru_opinions (
  id              bigint generated always as identity primary key,
  report_id       text        not null references public.guru_reports(id) on delete cascade,
  d               date        not null,
  ticker          text        not null,
  persona         text        not null,            -- 예: '워런-버핏'
  guru_idx        smallint,                        -- 1~13 (guru_votes g1~g13 대응)
  verdict         text        not null,            -- 매수 / 보유 / 관망 / 매도
  score           smallint    not null,            -- 0: 매수, 1: 보유, 2: 관망, 3: 매도
  confidence      smallint,                        -- 1~10
  target_low      numeric,                         -- 적정가/매수가 하단
  target_high     numeric,                         -- 적정가/매수가 상단
  target_text     text,                            -- 원본 가격 텍스트 (예: "$150~$175")
  upside_pct      numeric,                         -- (중간적정가 / 현재가 - 1) * 100
  arguments       text[],                          -- 핵심 논거 불릿 리스트
  triggers        text[],                          -- 트리거 조건 리스트
  quote           text,                            -- 대표 발언
  parse_mode      text,                            -- json / regex / fallback / legacy
  prompt_version  text,                            -- 프롬프트 버전
  raw_text        text,                            -- AI 모델 원문 응답
  created_at      timestamptz not null default now(),
  constraint guru_opinions_report_persona_unique unique (report_id, persona)
);

create index if not exists guru_opinions_d_idx       on public.guru_opinions (d desc);
create index if not exists guru_opinions_ticker_idx  on public.guru_opinions (ticker);
create index if not exists guru_opinions_persona_idx on public.guru_opinions (persona);
create index if not exists guru_opinions_verdict_idx on public.guru_opinions (verdict);
create index if not exists guru_opinions_score_idx   on public.guru_opinions (score);

alter table public.guru_opinions enable row level security;
drop policy if exists guru_opinions_read on public.guru_opinions;
create policy guru_opinions_read on public.guru_opinions for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 3. report_metrics: 데이터팩 재무/시장/밸류에이션 핵심 지표 숫자 컬럼 (리포트당 1행)
-- ------------------------------------------------------------------------------
create table if not exists public.report_metrics (
  report_id           text        primary key references public.guru_reports(id) on delete cascade,
  d                   date        not null,
  ticker              text        not null,
  current_price       numeric,
  market_cap          numeric,
  enterprise_value    numeric,
  per                 numeric,
  fwd_per             numeric,
  peg                 numeric,
  pbr                 numeric,
  psr                 numeric,
  pfcf                numeric,
  ev_ebitda           numeric,
  dividend_yield_pct  numeric,
  roe_pct             numeric,
  roa_pct             numeric,
  roic_pct            numeric,
  debt_ratio          numeric,
  current_ratio       numeric,
  net_debt            numeric,
  fiscal_year         text,
  revenue             numeric,
  revenue_growth_pct  numeric,
  gross_margin_pct    numeric,
  operating_margin_pct numeric,
  net_margin_pct      numeric,
  eps                 numeric,
  fcf                 numeric,
  fcf_margin_pct      numeric,
  high_52w            numeric,
  low_52w             numeric,
  from_52w_high_pct   numeric,
  ma50                numeric,
  ma200               numeric,
  short_float_pct     numeric,
  insider_pct         numeric,
  institution_pct     numeric,
  analyst_target_mean numeric,
  analyst_target_high numeric,
  analyst_target_low  numeric,
  analyst_upside_pct  numeric,
  analyst_rating      text,
  created_at          timestamptz not null default now()
);

create index if not exists report_metrics_d_idx      on public.report_metrics (d desc);
create index if not exists report_metrics_ticker_idx on public.report_metrics (ticker);
create index if not exists report_metrics_per_idx    on public.report_metrics (per);
create index if not exists report_metrics_roe_idx    on public.report_metrics (roe_pct desc);

alter table public.report_metrics enable row level security;
drop policy if exists report_metrics_read on public.report_metrics;
create policy report_metrics_read on public.report_metrics for select to anon, authenticated using (true);
