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

// 3. 오토트레이딩 상태 (/api/auto-trading/status)
export interface AutoTradingStatus {
  current_date: string;
  today_ordered_tickers: string[];
  today_spent_krw: number;
  max_daily_limit_krw: number;
  order_amount_per_ticker_krw: number;
  order_action: string;
  strategy_rule: string;
  dry_run: boolean;
  active_broker: string;
}

// 4. 증권사 브릿지 상태 및 잔고 (/api/bridge/status, /api/bridge/balance)
export interface BridgeStatus {
  default_broker: string;
  dry_run: boolean;
  configured_adapters: {
    mock: boolean;
    toss: boolean;
    kis: boolean;
  };
}

export interface BrokerPosition {
  ticker: string;
  name?: string;
  quantity: number;
  purchase_price?: number;
  current_price?: number;
  return_rate?: number;
}

export interface BrokerBalance {
  broker: string;
  available_krw: number;
  available_usd: number;
  positions?: BrokerPosition[];
  error?: string;
  hint?: string;
}

// 6. 스크리너 결과 (/api/screener/run)
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

// 7. Supabase 13인 거장 표결 (guru_votes)
export interface GuruVoteRow {
  d: string;
  ticker: string;
  name: string | null;
  nation: string;
  screeners: string[];
  g0: number | null; // 종합 점수 (0: 매수, 1: 보유, 2: 관망, 3: 매도)
  g1?: number | null;
  g2?: number | null;
  g3?: number | null;
  g4?: number | null;
  g5?: number | null;
  g6?: number | null;
  g7?: number | null;
  g8?: number | null;
  g9?: number | null;
  g10?: number | null;
  g11?: number | null;
  g12?: number | null;
  g13?: number | null;
  updated_at: string;
}

// 8. Supabase 리포트 (guru_reports)
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

// 9. Supabase 시스템 로그 (error_logs)
export interface SystemLogItem {
  id: number;
  created_at: string;
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  logger_name: string | null;
  code: string;
  message: string;
  context: Record<string, unknown>;
}

// 10. 종목 차트 및 볼린저 밴드 (/api/screener/chart/:ticker)
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

// 10. 실시간 고정 갭(3%) 그리드 매매 (/api/grid-trading)
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


