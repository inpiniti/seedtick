import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { DataCache } from "@/lib/dataCache";

export const CACHE_TIMES = {
  SHORT_5M: 5 * 60 * 1000,
  MEDIUM_15M: 15 * 60 * 1000,
  LONG_24H: 24 * 60 * 60 * 1000,
} as const;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIMES.SHORT_5M,
        gcTime: CACHE_TIMES.LONG_24H,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function createQueryPersister(userId?: string | null) {
  if (typeof window === "undefined") return undefined;
  const key = `reportist_qc_v1_${userId || "anon"}`;
  try {
    return createSyncStoragePersister({
      storage: window.localStorage,
      key,
    });
  } catch {
    return undefined;
  }
}

/**
 * 로그아웃 또는 계정 변경 시 모든 캐시(React Query + LocalStorage + DataCache 메모리) 전면 파기
 */
export function clearAllUserCache() {
  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith("reportist_qc_") ||
            key.startsWith("REACT_QUERY_OFFLINE_CACHE"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch (e) {
      console.warn("LocalStorage clear error:", e);
    }
  }

  DataCache.clearAll();

  if (browserQueryClient) {
    browserQueryClient.clear();
  }
}
