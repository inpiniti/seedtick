import { GuruReportRow, HealthStatus, StockCandidate, SystemLogItem, AiModelStatus } from "@/types/api";
import { HistoricalValuationRecord } from "@/lib/supabase";

/**
 * 전역 메모리 캐시 저장소
 * 페이지 라우트 이동 시 불필요한 반복 네트워크 요청을 방지하여
 * 0ms 즉각적인 화면 전환(Instant Navigation)을 제공합니다.
 */
interface GlobalMemoryCache {
  health?: { data: HealthStatus; expiresAt: number };
  aiModel?: { data: AiModelStatus; expiresAt: number };
  catalogDates?: { data: string[]; expiresAt: number };
  reportsByDate: Map<string, { data: GuruReportRow[]; expiresAt: number }>;
  historicalValuations?: { data: HistoricalValuationRecord[]; expiresAt: number };
  liveCandidates?: { data: StockCandidate[]; expiresAt: number };
  krCandidates?: { data: StockCandidate[]; expiresAt: number };
  romaCandidates?: { data: StockCandidate[]; expiresAt: number };
  systemLogs?: { data: SystemLogItem[]; expiresAt: number };
  percentB: Map<string, number | null>;
}

const CACHE_TTL_MS = 3 * 60 * 1000; // 3분간 캐시 유지

const cache: GlobalMemoryCache = {
  reportsByDate: new Map(),
  percentB: new Map(),
};

export const DataCache = {
  getHealth: () => {
    if (cache.health && cache.health.expiresAt > Date.now()) return cache.health.data;
    return null;
  },
  setHealth: (data: HealthStatus) => {
    cache.health = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  },

  getCatalogDates: () => {
    if (cache.catalogDates && cache.catalogDates.expiresAt > Date.now()) return cache.catalogDates.data;
    return null;
  },
  setCatalogDates: (data: string[]) => {
    cache.catalogDates = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  },

  getReports: (dateKey: string) => {
    const item = cache.reportsByDate.get(dateKey);
    if (item && item.expiresAt > Date.now()) return item.data;
    return null;
  },
  setReports: (dateKey: string, data: GuruReportRow[]) => {
    cache.reportsByDate.set(dateKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  },

  getHistoricalValuations: () => {
    if (cache.historicalValuations && cache.historicalValuations.expiresAt > Date.now())
      return cache.historicalValuations.data;
    return null;
  },
  setHistoricalValuations: (data: HistoricalValuationRecord[]) => {
    cache.historicalValuations = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  },

  getLiveCandidates: () => {
    if (cache.liveCandidates && cache.liveCandidates.expiresAt > Date.now())
      return cache.liveCandidates.data;
    return null;
  },
  setLiveCandidates: (data: StockCandidate[]) => {
    cache.liveCandidates = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  },

  getKrCandidates: () => {
    if (cache.krCandidates && cache.krCandidates.expiresAt > Date.now())
      return cache.krCandidates.data;
    return null;
  },
  setKrCandidates: (data: StockCandidate[]) => {
    cache.krCandidates = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  },

  getRomaCandidates: () => {
    if (cache.romaCandidates && cache.romaCandidates.expiresAt > Date.now())
      return cache.romaCandidates.data;
    return null;
  },
  setRomaCandidates: (data: StockCandidate[]) => {
    cache.romaCandidates = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  },

  getPercentB: (ticker: string): number | null | undefined => {
    return cache.percentB.get(ticker);
  },
  setPercentB: (ticker: string, val: number | null) => {
    cache.percentB.set(ticker, val);
  },
  getAllPercentB: () => {
    const obj: Record<string, number | null> = {};
    for (const [k, v] of cache.percentB.entries()) {
      obj[k] = v;
    }
    return obj;
  },

  clearAll: () => {
    cache.health = undefined;
    cache.aiModel = undefined;
    cache.catalogDates = undefined;
    cache.reportsByDate.clear();
    cache.historicalValuations = undefined;
    cache.liveCandidates = undefined;
    cache.krCandidates = undefined;
    cache.romaCandidates = undefined;
    cache.systemLogs = undefined;
  },
};
