/**
 * API 및 시스템 데이터 모델 타입 정의
 */

// 0. 현재 활성 AI 모델 및 순위 체인 (/debug/ai-model)
export interface AiModelStatus {
  ok: boolean;
  /** 현재 실제 사용 중인 모델 */
  active_model: string;
  /** 0부터 시작하는 현재 순위 인덱스 */
  active_index: number;
  /** 1순위(=환경변수 기본 모델) 상태인지 여부 */
  is_first: boolean;
  /** 전체 순위 체인 (앞쪽이 1순위) */
  chain: string[];
  /** 오늘 순위가 전환된 횟수 */
  switch_count: number;
  /** 마지막 전환 시각 (ISO, 미전환 시 null) */
  switched_at: string | null;
  /** 마지막 전환 사유 */
  last_reason: string | null;
  /** 모델별 누적 실패 사유 */
  failures: Record<string, string>;
  /** 다음 자동 초기화 시각 (KST 자정 이후) */
  next_reset_at: string;
  /** 환경변수에 설정된 원본 모델 */
  configured_model: string;
}

// 1. 서버 상태 (/health)
export interface HealthStatus {
  status: "healthy" | "unhealthy" | "down";
  timestamp: string;
  env: string;
  dry_run: boolean;
  default_broker: string;
  us_market_today: {
    is_open: boolean;
    status_text: string;
  };
}

// 2. 서버 IP (/api/ip)
export interface IpStatus {
  client_ip: string;
  server_public_ip: string;
  is_local_request: boolean;
  guide: string;
}

// 3. 스크리너 결과 (/api/screener/run)
export interface StockCandidate {
  ticker: string;
  name: string;
  price: number;
  prev_close?: number | null;
  change_rate?: number;
  market_cap?: number | null;
  debt_ratio?: number | null;
  interest_coverage?: number | null;
  operating_margin?: number | null;
  roe?: number | null;
  logo_image_url?: string | null;
  rank?: number;
  preset?: string;
  guru_score?: number;
  screeners?: string[];

  // DataRoma 슈퍼인베스터 포트폴리오(두번째 스크리너) 전용 선택 필드
  /** 해당 종목을 보유한 슈퍼인베스터 수 */
  holders?: number | null;
  /** Grand Portfolio 내 비중 (%) */
  weight_pct?: number | null;
  /** 최종 보유 시점 가격 (Hold Price*) */
  hold_price?: number | null;
  /** 52주 최저가 */
  week52_low?: number | null;
  /** 52주 최고가 */
  week52_high?: number | null;
}

export interface ScreenerCriteria {
  preset: string;
  nation: string;
  size: number;
  page?: number;
  exclude_tickers?: string[];
}

export interface ScreenerResponse {
  tickers?: StockCandidate[];
  items?: StockCandidate[];
  total_count: number;
  count?: number;
  criteria?: ScreenerCriteria;
  fetched_at?: string;
  source?: string;
}

// 4. Supabase 리포트 (guru_reports)
export interface GuruSummaryItem {
  persona?: string;
  guru_name?: string;
  verdict?: string;
  stance?: string;
  confidence?: number;
  core_arguments?: string[];
  rationale?: string;
  target_price_range?: string | null;
  trigger_conditions?: string[];
  quote?: string;
}

export interface ValuationConsensus {
  fair_value_price?: number | null;
  target_price_band?: string | null;
  safety_entry_price?: string | null;
  optimistic_target_price?: string | null;
}

export interface GuruReportRow {
  id: string;
  d: string;
  ticker: string;
  company_name: string | null;
  current_price: number | null;
  verdict: string;
  overall_score: number;
  vote_summary: string | null;
  datapack: (Record<string, any> & { valuation_consensus?: ValuationConsensus }) | null;
  summaries: GuruSummaryItem[] | null;
  discussion: string | null;
  final_report: string | null;
  created_at: string;
}

// 5. Supabase 시스템 로그 (error_logs)
export interface SystemLogItem {
  id: number;
  created_at: string;
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  logger_name: string | null;
  code: string;
  message: string;
  context: Record<string, unknown>;
}

// 6. 종목 차트 및 볼린저 밴드 (/api/screener/chart/:ticker)
export interface CandleItem {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface BollingerPoint {
  time: string; // YYYY-MM-DD
  upper: number | null;
  middle: number | null;
  lower: number | null;
  percent_b: number | null;
}

export interface BollingerSummary {
  current_price: number;
  upper: number;
  middle: number;
  lower: number;
  percent_b: number;
  bandwidth: number;
  status: "LOWER_BREAK" | "LOWER_NEAR" | "MIDDLE" | "UPPER_NEAR" | "UPPER_BREAK";
  status_label: string;
  status_description: string;
}

export interface StockChartResponse {
  ticker: string;
  period: string;
  interval: string;
  candles: CandleItem[];
  bollinger: BollingerPoint[];
  summary: BollingerSummary | null;
}

// 7. 실시간 고정 갭(3%) 그리드 매매 (/api/grid-trading)
export interface GridTradeItem {
  id?: string;
  ticker: string;
  initial_price: number;
  gap: number;
  last_trade_price: number;
  order_amount_krw: number;
  status: "ACTIVE" | "FINISHED";
  holdings_qty: number;
  total_buy_count: number;
  total_sell_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface GridTradingMarketStatus {
  is_market_open: boolean;
  is_ws_connected: boolean;
  active_count: number;
  active_tickers: string[];
}

// 8. 13인 거장 파이프라인 실시간 진행 상태 (/api/scheduler/progress)
export type PipelineStageKey =
  | "screening"
  | "datapack"
  | "value_driver"
  | "summaries"
  | "discussion"
  | "master"
  | "sync";

export interface PipelineStageMeta {
  key: PipelineStageKey;
  label: string;
}

export type PipelineStageTimingStatus = "pending" | "running" | "done" | "failed";

export interface PipelineStageTiming {
  key: PipelineStageKey;
  label: string;
  elapsed_seconds: number;
  status: PipelineStageTimingStatus;
}

export type PipelineTickerStatus = "pending" | "processing" | "done" | "failed";

export interface PipelineTickerProgress {
  ticker: string;
  status: PipelineTickerStatus;
  verdict: string | null;
}

export interface PipelineEvent {
  time: string;
  message: string;
}

export interface PipelineProgress {
  status: "idle" | "running" | "completed" | "failed" | "skipped";
  started_at: string | null;
  finished_at: string | null;
  elapsed_seconds: number;
  date: string | null;
  triggered_by: string | null;
  stage: PipelineStageKey | null;
  stage_index: number;
  stage_label: string | null;
  stage_started_at?: string | null;
  stage_elapsed_seconds?: Record<string, number>;
  stage_timings?: PipelineStageTiming[];
  stage_total: number;
  stages: PipelineStageMeta[];
  gurus_done: number;
  gurus_total: number;
  total_tickers: number;
  completed_tickers: number;
  failed_tickers: number;
  current_ticker: string | null;
  current_ticker_index: number;
  tickers: PipelineTickerProgress[];
  events: PipelineEvent[];
  error: string | null;
  summary: Record<string, unknown> | null;
}
