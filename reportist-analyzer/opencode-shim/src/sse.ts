/**
 * Bun.serve의 기본 idle timeout(10초)은 OpenCode 콜드 스타트 중 아무 바이트도
 * 안 나가는 스트림을 끊어버린다. 실제 생성 제한은 timeoutMs(180초)가 관리하므로
 * HTTP 레벨 idle timeout은 비활성화한다.
 */
export const SHIM_IDLE_TIMEOUT = 0

/** 첫 토큰이 올 때까지 SSE 주석으로 연결을 유지하는 간격. */
export const SSE_HEARTBEAT_MS = 10_000

/**
 * SSE 주석(`:`으로 시작하는 라인)은 규격상 클라이언트가 무시한다. 게이트웨이와 브라우저 모두
 * `data:`가 아닌 라인을 건너뛰므로 실제 토큰 전에 보내도 응답을 오염시키지 않는다.
 */
export function startSseHeartbeat(
  emit: (chunk: Uint8Array) => void,
  intervalMs: number = SSE_HEARTBEAT_MS,
): () => void {
  const encoder = new TextEncoder()
  const timer = setInterval(() => emit(encoder.encode(": ping\n\n")), intervalMs)
  return () => clearInterval(timer)
}
