-- ==============================================================================
-- SeedTick Supabase Database Schema
--
-- 1. guru_reports : 리포트 전문, 데이터팩, 13인 요약, 원탁 토론 저장 (추후 어날리시스 조회용)
-- 2. guru_votes   : 스크리너 대시보드 랭킹 및 13인 거장 표결 점수 (g0~g13) 저장
-- 3. error_logs   : 시스템 이벤트(INFO/WARNING) 및 에러/장애(ERROR/CRITICAL) 통합 로그 저장
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
  -- ── 구조화 검색/정렬 컬럼 ──
  fair_value         numeric,                     -- 종합 적정 내재가치 ($)
  band_low           numeric,                     -- 적정 밴드 하단 ($)
  band_high          numeric,                     -- 적정 밴드 상단 ($)
  safety_entry       numeric,                     -- 안전마진 매수가 ($)
  target_sell        numeric,                     -- 목표 매도가 ($)
  upside_pct         numeric,                     -- 적정가 대비 상승여력 (%)
  votes_buy          smallint,                    -- 매수 표수
  votes_hold         smallint,                    -- 보유 표수
  votes_watch        smallint,                    -- 관망 표수
  votes_sell         smallint,                    -- 매도 표수
  avg_confidence     numeric,                     -- 거장 평균 확신도 (1~10)
  conclusion         text,                        -- 종합 결론 핵심 문장
  hot_topics         text[],                      -- 핵심 쟁점 목록
  bull_points        text[],                      -- 강세론 핵심 논거 목록
  bear_points        text[],                      -- 약세론 핵심 논거 목록
  key_drivers        text[],                      -- 핵심 가치 드라이버 목록
  action_guide       jsonb,                       -- 실전 투자 실행 가이드 (가격대/손익비 등)
  valuation_flags    text[],                      -- 밸류에이션 검증 플래그
  parse_mode         text,                        -- 파싱 모드 (json / regex)
  prompt_version     text,                        -- 프롬프트 버전
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists guru_reports_d_idx on public.guru_reports (d desc);
create index if not exists guru_reports_ticker_idx on public.guru_reports (ticker);
create index if not exists guru_reports_score_idx on public.guru_reports (overall_score);
create index if not exists guru_reports_fair_value_idx on public.guru_reports (fair_value);
create index if not exists guru_reports_upside_pct_idx on public.guru_reports (upside_pct desc);
create index if not exists guru_reports_votes_buy_idx  on public.guru_reports (votes_buy desc);

-- RLS 정책 설정 (공개 읽기, 서비스 롤 쓰기)
alter table public.guru_reports enable row level security;
drop policy if exists guru_reports_read on public.guru_reports;
create policy guru_reports_read on public.guru_reports for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 1-1. guru_opinions: 13인 거장 개별 평가 상세 (리포트 1건당 13행)
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

alter table public.guru_opinions enable row level security;
drop policy if exists guru_opinions_read on public.guru_opinions;
create policy guru_opinions_read on public.guru_opinions for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 1-2. report_metrics: 데이터팩 재무/시장/밸류에이션 핵심 지표 숫자 컬럼 (리포트당 1행)
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

alter table public.report_metrics enable row level security;
drop policy if exists report_metrics_read on public.report_metrics;
create policy report_metrics_read on public.report_metrics for select to anon, authenticated using (true);


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


-- ------------------------------------------------------------------------------
-- 3. error_logs: 시스템 이벤트 및 에러/장애 로그 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.error_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  level       text        not null,             -- INFO, WARNING, ERROR, CRITICAL
  logger_name text,                             -- 발신 로거 이름 (예: scheduler_jobs, guru_report_service)
  code        text        not null default 'LOG', -- 이벤트/에러 코드
  message     text        not null,             -- 로그/에러 메시지
  context     jsonb       not null default '{}'::jsonb -- 추가 메타데이터
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_level_idx on public.error_logs (level);
create index if not exists error_logs_code_idx on public.error_logs (code);

-- RLS 정책 설정 (공개 읽기, 서비스 롤 쓰기)
alter table public.error_logs enable row level security;
drop policy if exists error_logs_read on public.error_logs;
create policy error_logs_read on public.error_logs for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 4. ticker_logos: 티커별 로고 URL 캐시 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.ticker_logos (
  ticker         text        not null primary key, -- 티커 (예: AAPL)
  stock_code     text,                             -- 토스 종목 코드 (예: US0378331005)
  logo_image_url text        not null,             -- 토스 로고 URL
  source         text        not null default 'toss_screener', -- toss_screener | toss_lookup
  updated_at     timestamptz not null default now()
);

create index if not exists ticker_logos_stock_code_idx on public.ticker_logos (stock_code);
create index if not exists ticker_logos_updated_at_idx on public.ticker_logos (updated_at desc);

-- RLS 정책 설정 (공개 읽기, 서비스 롤 쓰기)
alter table public.ticker_logos enable row level security;
drop policy if exists ticker_logos_read on public.ticker_logos;
create policy ticker_logos_read on public.ticker_logos for select to anon, authenticated using (true);


-- ------------------------------------------------------------------------------
-- 5. grid_trades: 실시간 고정 갭(3%) 무한 그리드 분할 매매 상태 테이블
-- ------------------------------------------------------------------------------
create table if not exists public.grid_trades (
  ticker            text        not null primary key, -- 종목 티커 (예: NVDA)
  initial_price     numeric     not null,             -- 처음매수주가 ($)
  gap               numeric     not null,             -- 고정 갭 ($) = initial_price * 0.03
  last_trade_price  numeric     not null,             -- 마지막매매주가 ($)
  order_amount_krw  integer     not null default 1000,-- 1회 주문금액 (1,000원 고정)
  status            text        not null default 'ACTIVE', -- ACTIVE(감지중), FINISHED(종료)
  holdings_qty      numeric     not null default 0,   -- 현재 추적 보유 수량
  total_buy_count   integer     not null default 1,   -- 누적 매수 횟수
  total_sell_count  integer     not null default 0,   -- 누적 매도 횟수
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists grid_trades_status_idx on public.grid_trades (status);

-- RLS 정책 설정 (공개 읽기, 서비스 롤 쓰기)
alter table public.grid_trades enable row level security;
drop policy if exists grid_trades_read on public.grid_trades;
create policy grid_trades_read on public.grid_trades for select to anon, authenticated using (true);

