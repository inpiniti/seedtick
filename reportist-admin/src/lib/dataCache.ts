import { GuruReportRow, HealthStatus, StockCandidate, SystemLogItem, AiModelStatus } from "@/types/api";
import { HistoricalValuationRecord } from "@/lib/supabase";

/**
 * 전역 메모리 + LocalStorage 2단계 캐시 저장소
 * 페이지 라우트 이동 및 브라우저 새로고침 시 불필요한 반복 네트워크 요청을 방지하여
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
  percentB: Map<string, { value: number | null; expiresAt: number }>;
  /** 티커 -> 로고 URL 맵 (배치 조회 결과, 메모리 유지) */
  tickerLogos: Map<string, string>;
  /** 티커 -> 한글 종목명 맵 (ticker_logos 캐시) */
  tickerNameMap?: { data: Record<string, string>; expiresAt: number };
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 후보군/기본 15분 캐시
const PERCENTB_TTL_MS = 30 * 60 * 1000; // %B 30분 TTL (일봉 기준 지표)
const PERCENTB_NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000; // 미지원/실패 티커 24시간 재요청 차단

const PERCENTB_STORAGE_KEY = "reportist_pb_cache_v1";
const SCREENER_STORAGE_KEY = "reportist_screener_cache_v1";

function safeLocalStorageGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeLocalStorageSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 쿼터 초과 시 무시
  }
}

function safeLocalStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

// 0. 사이드바 뱃지용 카운트 스냅샷 복원 (앱 진입 즉시 숫자 표시용)
// 실제 구현은 @/lib/sidebarCounts 에 분리 (dataCache ↔ sidebarCounts 순환참조 방지)
export type { SidebarCountsSnapshot } from "@/lib/sidebarCounts";
export { loadSidebarCountsSnapshot, saveSidebarCountsSnapshot } from "@/lib/sidebarCounts";

// 1. LocalStorage에서 %B 영속 캐시 초기 복원
function loadInitialPercentBCache(): Map<string, { value: number | null; expiresAt: number }> {
  const map = new Map<string, { value: number | null; expiresAt: number }>();
  const stored = safeLocalStorageGet<Record<string, { value: number | null; expiresAt: number }>>(
    PERCENTB_STORAGE_KEY
  );
  if (stored) {
    const now = Date.now();
    for (const [k, v] of Object.entries(stored)) {
      if (v && v.expiresAt > now) {
        map.set(k, v);
      }
    }
  }
  return map;
}

const cache: GlobalMemoryCache = {
  reportsByDate: new Map(),
  percentB: loadInitialPercentBCache(),
  tickerLogos: new Map(),
};

function persistPercentBCache() {
  const now = Date.now();
  const obj: Record<string, { value: number | null; expiresAt: number }> = {};
  for (const [k, v] of cache.percentB.entries()) {
    if (v.expiresAt > now) {
      obj[k] = v;
    }
  }
  safeLocalStorageSet(PERCENTB_STORAGE_KEY, obj);
}

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

  /** 권한 변경(로그인/체험/Pro) 시 마스킹된 구 리포트 캐시 파기 */
  clearReports: () => {
    cache.reportsByDate.clear();
    cache.historicalValuations = undefined;
  },

  getLiveCandidates: () => {
    if (cache.liveCandidates && cache.liveCandidates.expiresAt > Date.now())
      return cache.liveCandidates.data;
    // LocalStorage 폴백 복원 (새로고침 직후에도 0ms 즉시 표시)
    const stored = safeLocalStorageGet<{ us?: { data: StockCandidate[]; expiresAt: number } }>(
      SCREENER_STORAGE_KEY
    );
    if (stored?.us && stored.us.expiresAt > Date.now()) {
      cache.liveCandidates = stored.us;
      return stored.us.data;
    }
    return null;
  },
  setLiveCandidates: (data: StockCandidate[]) => {
    const entry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    cache.liveCandidates = entry;
    const stored = safeLocalStorageGet<Record<string, any>>(SCREENER_STORAGE_KEY) || {};
    stored.us = entry;
    safeLocalStorageSet(SCREENER_STORAGE_KEY, stored);
  },

  getKrCandidates: () => {
    if (cache.krCandidates && cache.krCandidates.expiresAt > Date.now())
      return cache.krCandidates.data;
    const stored = safeLocalStorageGet<{ kr?: { data: StockCandidate[]; expiresAt: number } }>(
      SCREENER_STORAGE_KEY
    );
    if (stored?.kr && stored.kr.expiresAt > Date.now()) {
      cache.krCandidates = stored.kr;
      return stored.kr.data;
    }
    return null;
  },
  setKrCandidates: (data: StockCandidate[]) => {
    const entry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    cache.krCandidates = entry;
    const stored = safeLocalStorageGet<Record<string, any>>(SCREENER_STORAGE_KEY) || {};
    stored.kr = entry;
    safeLocalStorageSet(SCREENER_STORAGE_KEY, stored);
  },

  getRomaCandidates: () => {
    if (cache.romaCandidates && cache.romaCandidates.expiresAt > Date.now())
      return cache.romaCandidates.data;
    const stored = safeLocalStorageGet<{ roma?: { data: StockCandidate[]; expiresAt: number } }>(
      SCREENER_STORAGE_KEY
    );
    if (stored?.roma && stored.roma.expiresAt > Date.now()) {
      cache.romaCandidates = stored.roma;
      return stored.roma.data;
    }
    return null;
  },
  setRomaCandidates: (data: StockCandidate[]) => {
    const entry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    cache.romaCandidates = entry;
    const stored = safeLocalStorageGet<Record<string, any>>(SCREENER_STORAGE_KEY) || {};
    stored.roma = entry;
    safeLocalStorageSet(SCREENER_STORAGE_KEY, stored);
  },

  getPercentB: (ticker: string): number | null | undefined => {
    const cleanKey = ticker.trim().toUpperCase();
    const entry = cache.percentB.get(cleanKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      cache.percentB.delete(cleanKey);
      return undefined;
    }
    return entry.value;
  },
  setPercentB: (ticker: string, val: number | null) => {
    const cleanKey = ticker.trim().toUpperCase();
    const ttl = val === null ? PERCENTB_NEGATIVE_TTL_MS : PERCENTB_TTL_MS;
    cache.percentB.set(cleanKey, { value: val, expiresAt: Date.now() + ttl });
    persistPercentBCache();
  },
  getAllPercentB: () => {
    const obj: Record<string, number | null> = {};
    const now = Date.now();
    for (const [k, entry] of cache.percentB.entries()) {
      if (entry.expiresAt <= now) {
        cache.percentB.delete(k);
        continue;
      }
      obj[k] = entry.value;
    }
    return obj;
  },

  getTickerNameMap: () => {
    if (cache.tickerNameMap && cache.tickerNameMap.expiresAt > Date.now())
      return cache.tickerNameMap.data;
    return null;
  },
  setTickerNameMap: (data: Record<string, string>) => {
    cache.tickerNameMap = { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
  },

  getTickerLogo: (ticker: string): string | undefined => {
    return cache.tickerLogos.get(ticker.trim().toUpperCase());
  },
  setTickerLogo: (ticker: string, url: string) => {
    cache.tickerLogos.set(ticker.trim().toUpperCase(), url);
  },
  getAllTickerLogos: () => {
    const obj: Record<string, string> = {};
    for (const [k, v] of cache.tickerLogos.entries()) {
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
    cache.tickerNameMap = undefined;
    cache.percentB.clear();
    safeLocalStorageRemove(PERCENTB_STORAGE_KEY);
    safeLocalStorageRemove(SCREENER_STORAGE_KEY);
  },
};
