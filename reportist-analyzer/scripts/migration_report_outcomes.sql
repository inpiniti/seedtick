-- ==============================================================================
-- Reportist Migration: 보고서 및 거장 페르소나별 투자 성과(Outcome) 추적 테이블
-- 
-- 1. report_outcomes: 리포트 종합 의견별 N일 후 실제 수익률 및 벤치마크(SPY) 대비 초과수익률 추적
-- 2. guru_opinion_outcomes: 13인 거장 페르소나별 예측 적중률(Hit Rate) 및 신뢰도 보정도 추적
-- 
-- Supabase 대시보드 > SQL Editor 에서 실행하세요. (멱등 실행 가능)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. report_outcomes: 리포트 종합 성과 추적 (21일=1개월, 63일=3개월, 126일=6개월, 252일=1년)
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
-- 2. guru_opinion_outcomes: 거장 페르소나별 예측 성과 및 적중률 추적
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
  is_correct        boolean,                           -- 예측 적중 여부 (매수: 수익 > 0, 매도: 수익 < 0 등)
  measured_at       timestamptz not null default now(),
  primary key (opinion_id, horizon_days)
);

create index if not exists guru_opinion_outcomes_persona_idx on public.guru_opinion_outcomes (persona);
create index if not exists guru_opinion_outcomes_horizon_idx on public.guru_opinion_outcomes (horizon_days);
create index if not exists guru_opinion_outcomes_correct_idx on public.guru_opinion_outcomes (is_correct);

alter table public.guru_opinion_outcomes enable row level security;
drop policy if exists guru_opinion_outcomes_read on public.guru_opinion_outcomes;
create policy guru_opinion_outcomes_read on public.guru_opinion_outcomes for select to anon, authenticated using (true);
