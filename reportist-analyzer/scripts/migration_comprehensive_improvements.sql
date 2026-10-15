-- ==============================================================================
-- Reportist Comprehensive Migration: 보고서 파이프라인 전면 고도화 DDL
-- (P0 데이터 오염 차단, P1 가격 의미 분리 및 연속 점수 통계, P2 정규화 및 성과 추적)
--
-- 이 스크립트는 멱등적(Idempotent)으로 작성되어 여러 번 실행해도 안전합니다.
-- Supabase 대시보드 > SQL Editor 에서 전체를 복사하여 1회 실행하시면 됩니다.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. gurus: 13인 투자 거장 페르소나 마스터 차원 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.gurus (
  id          smallint     primary key,               -- 1~13 (guru_votes g1~g13 일치)
  key         text         not null unique,           -- '워런-버핏'
  name_ko     text         not null,                  -- '워런 버핏'
  name_en     text         not null,                  -- 'Warren Buffett'
  school      text         not null,                  -- '가치/딥밸류', '성장', '모멘텀', etc.
  horizon     text         default '장기',            -- '장기', '중기', '사이클'
  active      boolean      not null default true,
  prompt_hash text,
  created_at  timestamptz  not null default now()
);

-- 13인 초기 시드 데이터 적재
insert into public.gurus (id, key, name_ko, name_en, school, horizon)
values
  (1,  '벤저민-그레이엄', '벤저민 그레이엄', 'Benjamin Graham', '가치/딥밸류', '장기'),
  (2,  '세스-클라먼',     '세스 클라먼',     'Seth Klarman',     '가치/딥밸류', '장기'),
  (3,  '모니시-파브라이', '모니시 파브라이', 'Mohnish Pabrai',   '가치/딥밸류', '장기'),
  (4,  '조엘-그린블라트', '조엘 그린블라트', 'Joel Greenblatt',   '퀀트/마법공식', '중장기'),
  (5,  '앙드레-코스톨라니', '앙드레 코스톨라니', 'André Kostolany', '매크로/심리', '사이클'),
  (6,  '잭-슈웨거',       '잭 슈웨거',       'Jack Schwager',     '모멘텀/추세', '단중기'),
  (7,  '워런-버핏',       '워런 버핏',       'Warren Buffett',   '퀄리티 가치', '장기'),
  (8,  '필립-피셔',       '필립 피셔',       'Philip Fisher',     '성장/초우량', '초장기'),
  (9,  '찰리-멍거',       '찰리 멍거',       'Charlie Munger',   '퀄리티/역발상', '장기'),
  (10, '피터-린치',       '피터 린치',       'Peter Lynch',       '성장/PEG', '중장기'),
  (11, '애스워스-다모다란', '애스워스 다모다란', 'Aswath Damodaran', '내재가치/DCF', '장기'),
  (12, '존-템플턴',       '존 템플턴',       'John Templeton',    '역발상 가치', '사이클'),
  (13, '마이클-버리',     '마이클 버리',     'Michael Burry',     '포렌식/딥밸류', '중기')
on conflict (id) do update set
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  school  = excluded.school,
  horizon = excluded.horizon;

alter table public.gurus enable row level security;
drop policy if exists gurus_read on public.gurus;
create policy gurus_read on public.gurus for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 2. guru_reports: 통계·버킷·세분화 컬럼 추가
-- ------------------------------------------------------------------------------
alter table public.guru_reports add column if not exists dispersion_pct numeric;
alter table public.guru_reports add column if not exists price_estimate_count smallint;
alter table public.guru_reports add column if not exists mean_score numeric;
alter table public.guru_reports add column if not exists score_std numeric;
alter table public.guru_reports add column if not exists net_buy_ratio numeric;
alter table public.guru_reports add column if not exists style_breakdown jsonb default '{}'::jsonb;
alter table public.guru_reports add column if not exists data_gap_watch_count smallint default 0;
alter table public.guru_reports add column if not exists model text;
alter table public.guru_reports add column if not exists bull_arguments jsonb default '[]'::jsonb;
alter table public.guru_reports add column if not exists bear_arguments jsonb default '[]'::jsonb;


-- ------------------------------------------------------------------------------
-- 3. guru_opinions: 미응답 NULL 허용, 정규화 FK 및 가격 의미 분리 컬럼 추가
-- ------------------------------------------------------------------------------
alter table public.guru_opinions alter column score drop not null;
alter table public.guru_opinions add column if not exists guru_id smallint references public.gurus(id);
alter table public.guru_opinions add column if not exists model text;
alter table public.guru_opinions add column if not exists prompt_hash text;
alter table public.guru_opinions add column if not exists fair_value numeric;
alter table public.guru_opinions add column if not exists buy_below numeric;
alter table public.guru_opinions add column if not exists sell_above numeric;
alter table public.guru_opinions add column if not exists valuation_method text;
alter table public.guru_opinions add column if not exists horizon text;
alter table public.guru_opinions add column if not exists data_gaps text[];
alter table public.guru_opinions add column if not exists checklist jsonb default '[]'::jsonb;
alter table public.guru_opinions add column if not exists key_metrics_used jsonb default '[]'::jsonb;

create index if not exists guru_opinions_guru_id_idx on public.guru_opinions (guru_id);


-- ------------------------------------------------------------------------------
-- 4. guru_opinion_checks: 거장별 체크리스트 평가 항목 세부 감사 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.guru_opinion_checks (
  id          bigint       generated always as identity primary key,
  report_id   text         not null references public.guru_reports(id) on delete cascade,
  persona     text         not null,
  criterion   text         not null,
  value       text,
  passed      boolean,
  created_at  timestamptz  not null default now()
);

create index if not exists guru_opinion_checks_report_id_idx on public.guru_opinion_checks (report_id);
create index if not exists guru_opinion_checks_persona_idx   on public.guru_opinion_checks (persona);
create index if not exists guru_opinion_checks_passed_idx    on public.guru_opinion_checks (passed);

alter table public.guru_opinion_checks enable row level security;
drop policy if exists guru_opinion_checks_read on public.guru_opinion_checks;
create policy guru_opinion_checks_read on public.guru_opinion_checks for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 5. report_runs: 다회 실행/버전 비교 및 A/B 테스트 지원 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.report_runs (
  id              uuid         primary key default gen_random_uuid(),
  report_id       text         not null references public.guru_reports(id) on delete cascade,
  ticker          text         not null,
  d               date         not null,
  model           text,
  prompt_version  text,
  overall_verdict text,
  overall_score   smallint,
  mean_score      numeric,
  net_buy_ratio   numeric,
  is_latest       boolean      not null default true,
  created_at      timestamptz  not null default now()
);

create index if not exists report_runs_report_id_idx on public.report_runs (report_id);
create index if not exists report_runs_ticker_d_idx  on public.report_runs (ticker, d desc);

alter table public.report_runs enable row level security;
drop policy if exists report_runs_read on public.report_runs;
create policy report_runs_read on public.report_runs for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 6. report_outcomes: 리포트 종합 성과 추적 (21일, 63일, 126일, 252일 경과분)
-- ------------------------------------------------------------------------------
create table if not exists public.report_outcomes (
  report_id         text        not null references public.guru_reports(id) on delete cascade,
  ticker            text        not null,
  d                 date        not null,              -- 리포트 분석 기준일
  horizon_days      smallint    not null,              -- 관측 시계 (21, 63, 126, 252)
  verdict           text        not null,              -- 당시 종합 판정 (매수 / 보유 / 관망 / 매도)
  price_then        numeric     not null,              -- 분석 당시 주가 (USD)
  price_target      numeric,                           -- 분석 당시 종합 적정가
  price_after       numeric,                           -- N일 경과 시점 주가
  return_pct        numeric,                           -- 종목 수익률 (%) = (price_after / price_then - 1) * 100
  bench_return_pct  numeric,                           -- 벤치마크(SPY) 동일 기간 수익률 (%)
  excess_return_pct numeric,                           -- 벤치마크 대비 초과 수익률 (%) = return_pct - bench_return_pct
  hit_fair_value    boolean,                           -- 관측 기간 내 적정가 도달(터치) 여부
  measured_at       timestamptz not null default now(),
  primary key (report_id, horizon_days)
);

create index if not exists report_outcomes_ticker_idx       on public.report_outcomes (ticker);
create index if not exists report_outcomes_d_idx            on public.report_outcomes (d desc);
create index if not exists report_outcomes_horizon_idx      on public.report_outcomes (horizon_days);
create index if not exists report_outcomes_verdict_idx      on public.report_outcomes (verdict);
create index if not exists report_outcomes_excess_ret_idx   on public.report_outcomes (excess_return_pct desc);

alter table public.report_outcomes enable row level security;
drop policy if exists report_outcomes_read on public.report_outcomes;
create policy report_outcomes_read on public.report_outcomes for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 7. guru_opinion_outcomes: 13인 거장 페르소나별 성과 및 적중률(Hit Rate) 추적
-- ------------------------------------------------------------------------------
create table if not exists public.guru_opinion_outcomes (
  opinion_id        bigint      not null references public.guru_opinions(id) on delete cascade,
  report_id         text        not null,
  ticker            text        not null,
  persona           text        not null,              -- 예: '워런-버핏'
  horizon_days      smallint    not null,              -- 21, 63, 126, 252
  verdict           text        not null,              -- 당시 의견 (매수 / 보유 / 관망 / 매도 / 미응답)
  confidence        smallint,                          -- 당시 확신도 (1~10)
  price_then        numeric     not null,
  price_after       numeric,
  return_pct        numeric,
  is_correct        boolean,                           -- 예측 적중 여부
  measured_at       timestamptz not null default now(),
  primary key (opinion_id, horizon_days)
);

create index if not exists guru_opinion_outcomes_persona_idx on public.guru_opinion_outcomes (persona);
create index if not exists guru_opinion_outcomes_horizon_idx on public.guru_opinion_outcomes (horizon_days);
create index if not exists guru_opinion_outcomes_correct_idx on public.guru_opinion_outcomes (is_correct);

alter table public.guru_opinion_outcomes enable row level security;
drop policy if exists guru_opinion_outcomes_read on public.guru_opinion_outcomes;
create policy guru_opinion_outcomes_read on public.guru_opinion_outcomes for select to anon, authenticated using (true);
