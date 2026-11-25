// services/chunkLoadRecovery.ts - 배포 후 만료된 코드 청크를 물고 있는 탭을 자동 복구한다.
// Vite는 동적 import/프리로드가 실패하면 vite:preloadError를 발생시키고, 일반 브라우저는
// "Failed to fetch dynamically imported module" 형태의 TypeError를 unhandled rejection으로 남긴다.
// 이때 새 배포의 HTML·청크를 다시 받도록 한 번만 새로고침해 흰 화면으로 남는 것을 막는다.

const RELOAD_STORAGE_KEY = 'penguincut_chunk_reload_at';
const ATTEMPT_STORAGE_KEY = 'penguincut_chunk_reload_count';
const RELOAD_COOLDOWN_MS = 10_000;
// 탭 하나당 자동 새로고침은 딱 한 번만. 계속 실패하면 ErrorBoundary의 수동 복구로 넘긴다.
// (쿨다운만 두면 10초 간격으로 무한 새로고침이 돌아 Chrome의 "Throttling navigation" 경고가 뜬다.)
const MAX_RELOAD_ATTEMPTS = 1;
// 마지막 자동 새로고침이 오래전이라면 정상적으로 서비스 중이던 탭으로 본다.
// 이 기록을 지워야 며칠 열어둔 탭이 다음 배포에서도 한 번 복구될 수 있다.
// 반대로 빠르게 재로드가 반복되는 탭은 기록이 남아 무한 루프를 막는다.
const RECOVERY_RESET_MS = 60_000;

// 같은 틱에 vite:preloadError와 unhandledrejection이 모두 들어와도 한 번만 예약한다.
let reloadScheduled = false;

const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return CHUNK_LOAD_ERROR_PATTERN.test(error.message) || error.name === 'ChunkLoadError';
  }
  return typeof error === 'string' && CHUNK_LOAD_ERROR_PATTERN.test(error);
}

/** 실제로 새로고침을 예약했을 때만 true를 반환한다. */
function reloadOnceForFreshChunks(): boolean {
  if (reloadScheduled) return false;
  try {
    const attempts = Number(window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY) || 0);
    if (!Number.isFinite(attempts) || attempts >= MAX_RELOAD_ATTEMPTS) {
      return false;
    }
    const lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_STORAGE_KEY) || 0);
    if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(Date.now()));
    window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, String(attempts + 1));
  } catch {
    // sessionStorage를 쓸 수 없는 환경에서는 무한 새로고침을 막을 수 없으므로
    // 자동 복구를 건너뛰고 ErrorBoundary의 수동 새로고침 버튼으로 넘긴다.
    return false;
  }
  reloadScheduled = true;
  window.location.reload();
  return true;
}

/**
 * 청크 로드 실패라면 새 배포를 받아오도록 새로고침을 예약하고 true를 반환한다.
 * 청크 실패가 아니거나 이미 복구 시도를 소진했다면 false를 반환한다.
 */
export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  return reloadOnceForFreshChunks();
}

/** 앱 부트스트랩 전에 한 번 호출해 동적 import 실패를 전역에서 감지한다. */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;

  // 오래된 자동 새로고침 기록을 지워, 정상적으로 쓰이던 탭이 다음 배포에서도 복구되게 한다.
  // 재로드 직후라면 기록을 남겨 연속 실패 시 무한 새로고침에 빠지지 않도록 한다.
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_STORAGE_KEY) || 0);
    if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt > RECOVERY_RESET_MS) {
      window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
      window.sessionStorage.removeItem(RELOAD_STORAGE_KEY);
    }
  } catch {
    // sessionStorage가 막힌 환경에서는 자동 복구도 동작하지 않으므로 무시한다.
  }

  // Vite가 프리로드/동적 import 실패 시 보내는 이벤트. payload에는 원래 오류가 담긴다.
  // 복구 새로고침을 예약했다면 defaultPrevented로 Vite의 재throw를 막아
  // React.lazy까지 에러가 전파되지 않게 한다. (새로고침 전 깜빡임 방지)
  window.addEventListener('vite:preloadError', (event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (recoverFromChunkLoadError(payload)) {
      event.preventDefault();
    }
  });

  // 이벤트를 놓친 브라우저·경로를 위한 안전망. 동적 import 실패일 때만 반응한다.
  window.addEventListener('unhandledrejection', (event) => {
    if (recoverFromChunkLoadError(event.reason)) {
      event.preventDefault();
    }
  });
}
