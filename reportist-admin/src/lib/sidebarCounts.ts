export interface SidebarCountsSnapshot {
  reportCount: number;
  romaCount: number;
  liveCount: number;
  krCount: number;
  updatedAt: number;
}

const SIDEBAR_COUNTS_KEY = "reportist_sidebar_counts_v1";
const SIDEBAR_COUNTS_TTL_MS = 24 * 60 * 60 * 1000;

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 쿼터 초과 시 무시
  }
}

/** 앱 진입 즉시 사이드바 뱃지 숫자 표시용 스냅샷 복원 (24h TTL) */
export function loadSidebarCountsSnapshot(): SidebarCountsSnapshot | null {
  const stored = safeGet<SidebarCountsSnapshot>(SIDEBAR_COUNTS_KEY);
  if (!stored) return null;
  if (typeof stored.updatedAt !== "number") return null;
  if (typeof stored.reportCount !== "number") return null;
  if (Date.now() - stored.updatedAt > SIDEBAR_COUNTS_TTL_MS) return null;
  return stored;
}

export function saveSidebarCountsSnapshot(
  next: Omit<SidebarCountsSnapshot, "updatedAt">
): void {
  const payload: SidebarCountsSnapshot = { ...next, updatedAt: Date.now() };
  safeSet(SIDEBAR_COUNTS_KEY, JSON.stringify(payload));
}
