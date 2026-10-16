import {
  AiModelStatus,
  HealthStatus,
  PipelineProgress,
  ScreenerResponse,
  StockCandidate,
  StockChartResponse,
  TickerLogoBatchResponse,
  TickerLogoResponse,
  TickerNameBatchResponse,
  TickerNameResponse,
  OutcomesOverview,
} from "@/types/api";
import { supabase } from "@/lib/supabase";

const BASE_URL =
  process.env.NEXT_PUBLIC_ANALYZER_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function request<T>(
  endpoint: string,
  options?: RequestInit,
  retries = 2
): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
        // 서버 배포/재기동 또는 Hugging Face 프록시 재시작 중 502/503/504 발생 시 짧게 대기 후 재시도
        if ([502, 503, 504].includes(res.status) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        const errorText = await res.text().catch(() => "");
        // 관리자 전용 API의 인가 실패는 즉시 종료 (재시도 무의미)
        if (res.status === 401) {
          throw new Error(`로그인이 필요합니다. ${errorText || ""}`.trim());
        }
        if (res.status === 403) {
          throw new Error(`관리자 권한이 필요합니다. ${errorText || ""}`.trim());
        }
        throw new Error(
          `API 요청 실패 (${res.status} ${res.statusText}): ${errorText || "오류가 발생했습니다."}`
        );
      }

      return await res.json();
    } catch (err) {
      // 인가 실패는 재시도하지 않음
      if (
        err instanceof Error &&
        (err.message.startsWith("로그인이 필요합니다") ||
          err.message.startsWith("관리자 권한이 필요합니다"))
      ) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  throw new Error("요청이 완료되지 않았습니다.");
}

/** 관리자 전용 analyzer 호출용 Bearer 토큰 (Supabase 세션) */
async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
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
      us_market_today: {
        is_open: false,
        status_text: "서버와 연결할 수 없어요",
      },
      kr_market_today: {
        is_open: false,
        status_text: "서버와 연결할 수 없어요",
      },
    };
  }
}

/** 2. 일일 파이프라인 수동 즉시 트리거 (관리자 전용) */
export async function triggerPipeline(params: {
  dryRun?: boolean;
  force?: boolean;
  market?: "us" | "kr" | "all";
  maxCount?: number;
  skipAlreadyReported?: boolean;
}): Promise<Record<string, unknown>> {
  const queryParams = new URLSearchParams();
  if (params.dryRun !== undefined) queryParams.append("dry_run", String(params.dryRun));
  if (params.force !== undefined) queryParams.append("force", String(params.force));
  if (params.market) queryParams.append("market", params.market);
  if (params.maxCount) queryParams.append("max_count", String(params.maxCount));
  if (params.skipAlreadyReported !== undefined)
    queryParams.append("skip_already_reported", String(params.skipAlreadyReported));

  return request(`/api/scheduler/trigger?${queryParams.toString()}`, {
    method: "POST",
    headers: await getAdminAuthHeaders(),
  });
}

/** 3. 토스 스크리너 실행 결과 (미국장 / 한국장 + 조건강화 단계 지원) */
export async function fetchScreener(
  preset = "공통",
  nation = "us",
  size = 50,
  tightenStep = 5
): Promise<ScreenerResponse> {
  const query = new URLSearchParams({
    preset,
    nation,
    size: String(size),
    tighten_step: String(tightenStep),
  });
  const data = await request<ScreenerResponse>(
    `/api/screener/run?${query.toString()}`
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
      nation: item.nation || nation,
      tighten_step: item.tighten_step ?? tightenStep,
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

/** 3-3. 티커별 로고 조회 (Supabase 캐시 + Toss 폴백) */
export async function fetchTickerLogo(ticker: string): Promise<TickerLogoResponse> {
  const normalized = ticker.trim().toUpperCase();
  return request<TickerLogoResponse>(`/api/screener/logo/${encodeURIComponent(normalized)}`);
}

/** 3-4. 티커별 로고 일괄 조회 (1회 요청으로 여러 티커 조회) */
export async function fetchTickerLogos(tickers: string[], maxCount = 12): Promise<TickerLogoBatchResponse> {
  return request<TickerLogoBatchResponse>("/api/screener/logos", {
    method: "POST",
    body: JSON.stringify({
      tickers: tickers.map((ticker) => ticker.trim().toUpperCase()),
      max_count: maxCount,
    }),
  });
}

/** 3-5. 티커별 한글명 조회 (Supabase 캐시 + Toss 폴백, 그림1 리포트명 보충용) */
export async function fetchTickerName(ticker: string): Promise<TickerNameResponse> {
  const normalized = ticker.trim().toUpperCase();
  return request<TickerNameResponse>(`/api/screener/name/${encodeURIComponent(normalized)}`);
}

/** 3-6. 티커별 한글명 일괄 조회 (화면 표시분 대상, 1회 요청으로 여러 티커 조회) */
export async function fetchTickerNames(tickers: string[], maxCount = 30): Promise<TickerNameBatchResponse> {
  return request<TickerNameBatchResponse>("/api/screener/names", {
    method: "POST",
    body: JSON.stringify({
      tickers: tickers.map((ticker) => ticker.trim().toUpperCase()),
      max_count: maxCount,
    }),
  });
}

import { isValidChartTicker } from "@/lib/insightUtils";

export function normalizeTickerForChart(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

export async function fetchStockChart(
  ticker: string,
  range = "6mo",
  interval = "1d"
): Promise<StockChartResponse> {
  const normalizedTicker = normalizeTickerForChart(ticker);
  if (!isValidChartTicker(normalizedTicker)) {
    throw new Error(`유효하지 않은 차트 티커입니다: ${ticker}`);
  }
  return request<StockChartResponse>(
    `/api/screener/chart/${encodeURIComponent(normalizedTicker)}?range=${range}&interval=${interval}`
  );
}

/** 5. 현재 활성 AI 모델 및 순위 체인 상태 (관리자 전용) */
export async function fetchAiModelStatus(): Promise<AiModelStatus> {
  return request<AiModelStatus>("/debug/ai-model", {
    headers: await getAdminAuthHeaders(),
  }, 0);
}

/** 6. 13인 거장 파이프라인 실시간 진행 상태 (관리자 전용) */
export async function fetchPipelineProgress(): Promise<PipelineProgress> {
  return request<PipelineProgress>("/api/scheduler/progress", {
    headers: await getAdminAuthHeaders(),
  }, 0);
}

/** 7. AI 모델 순위 1순위 수동 초기화 (관리자 전용) */
export async function resetAiModelRotation(): Promise<{
  ok: boolean;
  previous_model: string;
  active_model: string;
  chain: string[];
}> {
  return request("/debug/ai-model/reset", {
    method: "POST",
    headers: await getAdminAuthHeaders(),
  }, 0);
}

/** 8. 성과 추적 데이터 및 통계 요약 조회 */
export async function fetchOutcomes(horizon?: number | "all"): Promise<OutcomesOverview> {
  const params = new URLSearchParams();
  if (horizon && horizon !== "all") {
    params.set("horizon", String(horizon));
  }
  const url = `/api/outcomes${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "성과 추적 데이터 조회에 실패했어요.");
  }
  return json.data as OutcomesOverview;
}

/** 9. 성과 추적 배치 수동 실행 (관리자 전용) */
export async function triggerOutcomeTracking(asOf?: string): Promise<{
  success: boolean;
  message: string;
  evaluated?: number;
  duration_sec?: number;
}> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch("/api/outcomes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(asOf ? { as_of: asOf } : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "성과 추적 배치 실행에 실패했어요.");
  }
  return json;
}
