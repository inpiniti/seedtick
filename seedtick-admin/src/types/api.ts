/**
 * API 및 시스템 데이터 모델 타입 정의
 */

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

// 4. 대기 중인 예약 주문 (/api/auto-trading/pending-orders)
export interface PendingOrder {
  ticker: string;
  amount_krw: number;
  reason?: string;
  created_at: string;
  status: string;
  broker?: string;
}

export interface PendingOrdersResponse {
  pending_count: number;
  orders: PendingOrder[];
}

// 5. 증권사 브릿지 상태 및 잔고 (/api/bridge/status, /api/bridge/balance)
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
export interface GuruReportRow {
  id: string;
  d: string;
  ticker: string;
  company_name: string | null;
  current_price: number | null;
  verdict: string;
  overall_score: number;
  vote_summary: string | null;
  datapack: Record<string, unknown> | null;
  summaries: Array<{ guru_id: number; guru_name: string; stance: string; rationale: string }> | null;
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
