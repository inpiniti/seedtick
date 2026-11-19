// services/chunkLoadRecovery.ts - 배포 후 만료된 코드 청크를 물고 있는 탭을 자동 복구한다.
// Vite는 동적 import/프리로드가 실패하면 vite:preloadError를 발생시키고, 일반 브라우저는
// "Failed to fetch dynamically imported module" 형태의 TypeError를 unhandled rejection으로 남긴다.
// 이때 새 배포의 HTML·청크를 다시 받도록 한 번만 새로고침해 흰 화면으로 남는 것을 막는다.

const RELOAD_STORAGE_KEY = 'penguincut_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return CHUNK_LOAD_ERROR_PATTERN.test(error.message) || error.name === 'ChunkLoadError';
  }
  return typeof error === 'string' && CHUNK_LOAD_ERROR_PATTERN.test(error);
}

function reloadOnceForFreshChunks(): void {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_STORAGE_KEY) || 0);
    if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) {
      return;
    }
    window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage를 쓸 수 없는 환경에서는 무한 새로고침을 막을 수 없으므로
    // 자동 복구를 건너뛰고 ErrorBoundary의 수동 새로고침 버튼으로 넘긴다.
    return;
  }
  window.location.reload();
}

/**
 * 청크 로드 실패라면 새 배포를 받아오도록 새로고침을 예약하고 true를 반환한다.
 * 청크 실패가 아니면 아무것도 하지 않고 false를 반환한다.
 */
export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  reloadOnceForFreshChunks();
  return true;
}

/** 앱 부트스트랩 전에 한 번 호출해 동적 import 실패를 전역에서 감지한다. */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;

  // Vite가 프리로드/동적 import 실패 시 보내는 이벤트. payload에는 원래 오류가 담긴다.
  window.addEventListener('vite:preloadError', (event) => {
    recoverFromChunkLoadError(event.payload);
  });

  // 이벤트를 놓친 브라우저·경로를 위한 안전망. 동적 import 실패일 때만 반응한다.
  window.addEventListener('unhandledrejection', (event) => {
    if (recoverFromChunkLoadError(event.reason)) {
      event.preventDefault();
    }
  });
}
