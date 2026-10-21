import { getQueryClient, CACHE_TIMES } from "@/lib/queryClient";
import {
  fetchGuruReports,
  fetchGuruReportDates,
  fetchHistoricalValuations,
  fetchTickerNameMap,
  HistoricalValuationRecord,
} from "@/lib/supabase";
import { fetchHealth, fetchScreener, fetchRomaScreener } from "@/lib/api-client";
import { GuruReportRow, HealthStatus, StockCandidate } from "@/types/api";
import { DataCache } from "@/lib/dataCache";

export const queryKeys = {
  dates: () => ["reports", "dates"] as const,
  reports: (dateKey: string, accessKey: string) =>
    ["reports", "list", dateKey, accessKey] as const,
  valuations: (accessKey: string) => ["reports", "valuations", accessKey] as const,
  tickerNames: () => ["tickers", "nameMap"] as const,
  health: () => ["system", "health"] as const,
  screener: (preset: string, nation: string) =>
    ["screener", "live", preset, nation] as const,
  roma: (minHolders: number) => ["screener", "roma", minHolders] as const,
};

function isTodayDate(dateStr?: string | null): boolean {
  if (!dateStr || dateStr === "ALL" || dateStr === "LATEST") return true;
  const todayStr = new Date().toISOString().split("T")[0];
  return dateStr === todayStr;
}

/**
 * 보고서 고유 일자 목록 조회 (15분 캐시)
 */
export async function getCachedReportDates(force = false): Promise<string[]> {
  const qc = getQueryClient();
  const key = queryKeys.dates();

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const dates = await fetchGuruReportDates();
      if (dates.length > 0) DataCache.setCatalogDates(dates);
      return dates;
    },
    staleTime: CACHE_TIMES.MEDIUM_15M,
  });
}

/**
 * 일자별 심층 리포트 목록 조회
 * - 과거 일자: 24시간 캐시 (불변 데이터)
 * - 오늘/최신 일자: 5분 캐시
 */
export async function getCachedGuruReports(
  date: string,
  accessKey: string,
  force = false,
  prevDate?: string
): Promise<GuruReportRow[]> {
  const qc = getQueryClient();
  const dateKey = date || "LATEST";
  const key = queryKeys.reports(dateKey, accessKey);

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  const isToday = isTodayDate(date);
  const staleTime = isToday ? CACHE_TIMES.SHORT_5M : CACHE_TIMES.LONG_24H;

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const reports = await fetchGuruReports(
        200,
        dateKey === "ALL" ? undefined : dateKey,
        prevDate
      );
      if (reports.length > 0) {
        DataCache.setReports(dateKey, reports);
      }
      return reports;
    },
    staleTime,
  });
}

/**
 * 전 기간 내재가치 히스토리 조회 (15분 캐시)
 */
export async function getCachedHistoricalValuations(
  accessKey: string,
  force = false
): Promise<HistoricalValuationRecord[]> {
  const qc = getQueryClient();
  const key = queryKeys.valuations(accessKey);

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const records = await fetchHistoricalValuations();
      if (records.length > 0) {
        DataCache.setHistoricalValuations(records);
      }
      return records;
    },
    staleTime: CACHE_TIMES.MEDIUM_15M,
  });
}

/**
 * 티커 한글명 맵 조회 (24시간 캐시)
 */
export async function getCachedTickerNameMap(
  force = false
): Promise<Record<string, string>> {
  const qc = getQueryClient();
  const key = queryKeys.tickerNames();

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const map = await fetchTickerNameMap();
      if (Object.keys(map).length > 0) {
        DataCache.setTickerNameMap(map);
      }
      return map;
    },
    staleTime: CACHE_TIMES.LONG_24H,
  });
}

/**
 * 서버 헬스체크 (5분 캐시)
 */
export async function getCachedHealth(force = false): Promise<HealthStatus> {
  const qc = getQueryClient();
  const key = queryKeys.health();

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const health = await fetchHealth();
      DataCache.setHealth(health);
      return health;
    },
    staleTime: CACHE_TIMES.SHORT_5M,
  });
}

/**
 * 스크리너 후보군 조회 (15분 캐시)
 */
export async function getCachedScreener(
  nation: "us" | "kr",
  force = false
): Promise<StockCandidate[]> {
  const qc = getQueryClient();
  const key = queryKeys.screener("공통", nation);

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetchScreener("공통", nation, 100, nation === "kr" ? 5 : undefined);
      const items = res.items || res.tickers || [];
      if (nation === "us") DataCache.setLiveCandidates(items);
      else DataCache.setKrCandidates(items);
      return items;
    },
    staleTime: CACHE_TIMES.MEDIUM_15M,
  });
}

/**
 * DataRoma 후보군 조회 (15분 캐시)
 */
export async function getCachedRoma(force = false): Promise<StockCandidate[]> {
  const qc = getQueryClient();
  const key = queryKeys.roma(10);

  if (force) {
    await qc.invalidateQueries({ queryKey: key });
  }

  return qc.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetchRomaScreener(10, 0);
      const items = res.items || res.tickers || [];
      DataCache.setRomaCandidates(items);
      return items;
    },
    staleTime: CACHE_TIMES.MEDIUM_15M,
  });
}
