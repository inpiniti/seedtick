// src/services/storageQuotaService.ts - 브라우저 저장소 쿼터 감시, 영구 보존(Persist) 요청 및 모드 관리

export type StorageMode = 'auto' | 'full' | 'lightweight';

export interface StorageEstimateInfo {
  quotaBytes: number;
  usageBytes: number;
  availableBytes: number;
  percentUsed: number;
  isLowStorage: boolean; // 남은 공간 100MB 미만 또는 90% 이상 사용
  isPersisted: boolean;
  isSupported: boolean;
}

const STORAGE_MODE_KEY = 'reportist_video_storage_mode';

/**
 * 바이트 단위를 사람이 읽기 쉬운 문자열(KB, MB, GB)로 변환
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 현재 브라우저의 저장소 사용량 및 잔여 쿼터 측정
 */
export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  const defaultRes: StorageEstimateInfo = {
    quotaBytes: 0,
    usageBytes: 0,
    availableBytes: 0,
    percentUsed: 0,
    isLowStorage: false,
    isPersisted: false,
    isSupported: false,
  };

  if (typeof navigator === 'undefined' || !navigator.storage) {
    return defaultRes;
  }

  try {
    const isSupported = Boolean(navigator.storage.estimate);
    const estimate = isSupported ? await navigator.storage.estimate() : null;
    const isPersisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;

    const quota = estimate?.quota || 0;
    const usage = estimate?.usage || 0;
    const available = Math.max(0, quota - usage);
    const percentUsed = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;

    // 모바일 환경 안전 마진: 잔여 용량이 120MB 미만이거나 사용률이 90%를 넘으면 저용량 상태로 판정
    const isLowStorage = available > 0 && (available < 120 * 1024 * 1024 || percentUsed >= 90);

    return {
      quotaBytes: quota,
      usageBytes: usage,
      availableBytes: available,
      percentUsed,
      isLowStorage,
      isPersisted,
      isSupported: true,
    };
  } catch (err) {
    console.warn('[storageQuotaService] Failed to estimate storage:', err);
    return defaultRes;
  }
}

/**
 * 브라우저에 영구 저장소(Eviction 방지) 권한 요청
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    console.log('[storageQuotaService] Persistent storage granted:', isPersisted);
    return isPersisted;
  } catch (err) {
    console.warn('[storageQuotaService] Persistent storage request failed:', err);
    return false;
  }
}

/**
 * 사용자 설정 저장 모드 조회 ('auto' | 'full' | 'lightweight')
 */
export function getStoredStorageMode(): StorageMode {
  try {
    const val = localStorage.getItem(STORAGE_MODE_KEY);
    if (val === 'full' || val === 'lightweight' || val === 'auto') {
      return val;
    }
  } catch {}
  return 'auto';
}

/**
 * 사용자 설정 저장 모드 변경
 */
export function setStoredStorageMode(mode: StorageMode): void {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {}
}
