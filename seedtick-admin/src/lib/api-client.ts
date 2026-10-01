import {
  AutoTradingStatus,
  BridgeStatus,
  BrokerBalance,
  GridTradeItem,
  GridTradingMarketStatus,
  HealthStatus,
  IpStatus,
  PendingOrdersResponse,
  ScreenerResponse,
  StockCandidate,
  StockChartResponse,
} from "@/types/api";

const BASE_URL =
  process.env.NEXT_PUBLIC_ANALYZER_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    // 캐시 방지 (실시간 관제)
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `API 요청 실패 (${res.status} ${res.statusText}): ${errorText || "오류가 발생했습니다."}`
    );
  }

  return res.json();
}

/** 1. 서버 헬스체크 및 미장 개장 여부 */
export async function fetchHealth(): Promise<HealthStatus> {
  try {
    return await request<HealthStatus>("/health");
  } catch (err) {
    return {
      status: "down",
      timestamp: new Date().toISOString(),
      env: "unknown",
      dry_run: true,
      default_broker: "none",
      us_market_today: {
        is_open: false,
        status_text: "서버와 연결할 수 없어요",
      },
    };
  }
}

/** 2. 서버 아웃바운드 공인 IP 확인 */
export async function fetchIp(): Promise<IpStatus> {
  try {
    return await request<IpStatus>("/api/ip");
  } catch {
    return {
      client_ip: "unknown",
      server_public_ip: "조회 불가 (서버 점검 필요)",
      is_local_request: false,
      guide: "서버가 구동 중이지 않거나 네트워크 연결이 원활하지 않아요.",
    };
  }
}

/** 3. 오토트레이딩 상태 및 금일 주문 현황 */
export async function fetchAutoTradingStatus(): Promise<AutoTradingStatus> {
  return request<AutoTradingStatus>("/api/auto-trading/status");
}

/** 4. 대기 중인 예약 주문 목록 */
export async function fetchPendingOrders(): Promise<PendingOrdersResponse> {
  return request<PendingOrdersResponse>("/api/auto-trading/pending-orders");
}

/** 5. 대기 중인 예약 주문 즉시 수동 발주 */
export async function executePendingOrders(dryRun?: boolean): Promise<{
  success: boolean;
  total_orders: number;
  executed_count: number;
  failed_count: number;
  message?: string;
}> {
  const query = dryRun !== undefined ? `?dry_run=${dryRun}` : "";
  return request(`/api/auto-trading/execute-pending${query}`, {
    method: "POST",
  });
}

/** 6. 일일 파이프라인 수동 즉시 트리거 */
export async function triggerPipeline(params: {
  dryRun?: boolean;
  force?: boolean;
  maxCount?: number;
  skipAlreadyReported?: boolean;
}): Promise<Record<string, unknown>> {
  const queryParams = new URLSearchParams();
  if (params.dryRun !== undefined) queryParams.append("dry_run", String(params.dryRun));
  if (params.force !== undefined) queryParams.append("force", String(params.force));
  if (params.maxCount) queryParams.append("max_count", String(params.maxCount));
  if (params.skipAlreadyReported !== undefined)
    queryParams.append("skip_already_reported", String(params.skipAlreadyReported));

  return request(`/api/scheduler/trigger?${queryParams.toString()}`, {
    method: "POST",
  });
}

/** 7. 토스 공통/해외 스크리너 실행 결과 */
export async function fetchScreener(
  preset = "공통",
  nation = "us",
  size = 50
): Promise<ScreenerResponse> {
  const data = await request<ScreenerResponse>(
    `/api/screener/run?preset=${encodeURIComponent(preset)}&nation=${nation}&size=${size}`
  );

  const rawList = data.tickers || data.items || [];
  const normalizedItems: StockCandidate[] = rawList.map((item, idx) => {
    let change_rate = item.change_rate;
    if (change_rate === undefined && item.price != null && item.prev_close) {
      change_rate = ((item.price - item.prev_close) / item.prev_close) * 100;
    }
    return {
      ...item,
      rank: item.rank ?? idx + 1,
      change_rate: change_rate !== undefined ? Number(change_rate) : undefined,
    };
  });

  return {
    ...data,
    items: normalizedItems,
    tickers: normalizedItems,
  };
}

/** 8. 증권사 브릿지 상태 */
export async function fetchBridgeStatus(): Promise<BridgeStatus> {
  return request<BridgeStatus>("/api/bridge/status");
}

/** 9. 증권사 계좌 잔고 */
export async function fetchBridgeBalance(broker?: string): Promise<BrokerBalance> {
  const query = broker ? `?broker_type=${broker}` : "";
  return request<BrokerBalance>(`/api/bridge/balance${query}`);
}

/** 10. 종목 일봉 캔들 및 볼린저 밴드 조회 */
export async function fetchStockChart(
  ticker: string,
  range = "6mo",
  interval = "1d"
): Promise<StockChartResponse> {
  return request<StockChartResponse>(
    `/api/screener/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`
  );
}

/** 11. 실시간 그리드 매매 정규장 및 상태 조회 */
export async function fetchGridMarketStatus(): Promise<GridTradingMarketStatus> {
  return request<GridTradingMarketStatus>("/api/grid-trading/market-status");
}

/** 12. 등록된 그리드 종목 목록 조회 */
export async function fetchGridItems(): Promise<{ items: GridTradeItem[]; count: number }> {
  return request<{ items: GridTradeItem[]; count: number }>("/api/grid-trading/items");
}

/** 13. 정규장 1,000원 수동 매수 및 그리드 등록 */
export async function manualBuyGrid(ticker: string): Promise<{
  success: boolean;
  message: string;
  item: GridTradeItem;
}> {
  return request("/api/grid-trading/buy", {
    method: "POST",
    body: JSON.stringify({ ticker }),
  });
}

/** 14. 그리드 종목 수동 종료 */
export async function closeGridItem(ticker: string): Promise<{
  success: boolean;
  message: string;
}> {
  return request(`/api/grid-trading/items/${encodeURIComponent(ticker)}/close`, {
    method: "POST",
  });
}


