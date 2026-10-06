import {
  AiModelStatus,
  HealthStatus,
  PipelineProgress,
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
  } catch {
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

/** 2. 일일 파이프라인 수동 즉시 트리거 */
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

/** 3. 토스 공통/해외 스크리너 실행 결과 */
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

/** 3-2. DataRoma 슈퍼인베스터 그랜드 포트폴리오 스크리너 (두번째 스크리너) */
export async function fetchRomaScreener(
  minHolders = 10,
  size = 0
): Promise<ScreenerResponse> {
  const data = await request<ScreenerResponse>(
    `/api/screener/roma?min_holders=${minHolders}&size=${size}`
  );

  const rawList = data.tickers || data.items || [];
  const normalizedItems: StockCandidate[] = rawList.map((item, idx) => ({
    ...item,
    price: item.price ?? 0,
    rank: item.rank ?? idx + 1,
    screeners: item.screeners?.length ? item.screeners : ["roma"],
  }));

  return {
    ...data,
    items: normalizedItems,
    tickers: normalizedItems,
  };
}

/** 4. 종목 일봉 캔들 및 볼린저 밴드 조회 */
export async function fetchStockChart(
  ticker: string,
  range = "6mo",
  interval = "1d"
): Promise<StockChartResponse> {
  return request<StockChartResponse>(
    `/api/screener/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`
  );
}

/** 5. 현재 활성 AI 모델 및 순위 체인 상태 */
export async function fetchAiModelStatus(): Promise<AiModelStatus> {
  return request<AiModelStatus>("/debug/ai-model");
}

/** 6. 13인 거장 파이프라인 실시간 진행 상태 */
export async function fetchPipelineProgress(): Promise<PipelineProgress> {
  return request<PipelineProgress>("/api/scheduler/progress");
}

/** 7. AI 모델 순위 1순위 수동 초기화 */
export async function resetAiModelRotation(): Promise<{
  ok: boolean;
  previous_model: string;
  active_model: string;
  chain: string[];
}> {
  return request("/debug/ai-model/reset", { method: "POST" });
}



