"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTossIpStatus, retryTossIpConnection } from "@/lib/api-client";
import type { TossIpStatus } from "@/types/api";

/**
 * 토스 허용 IP 차단 상태 폴링 훅.
 *
 * - 서버가 403(허용 IP 미등록)을 감지하면 차단 상태를 메모리에 기억하고,
 *   이 훅이 그 상태를 주기적으로 확인해 관리 화면 배너로 보여준다.
 * - `retry()` 는 사용자가 IP를 등록한 뒤 호출하며, 서버에 1회 실제 연결을 요청한다.
 */
export function useTossIpStatus(pollIntervalMs = 30000) {
  const [status, setStatus] = useState<TossIpStatus | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(async (): Promise<TossIpStatus | null> => {
    try {
      const next = await fetchTossIpStatus();
      setStatus(next);
      return next;
    } catch {
      // 서버 점검 중에는 마지막 상태를 유지한다
      return null;
    }
  }, []);

  const retry = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsRetrying(true);
    try {
      const res = await retryTossIpConnection();
      await load();
      return { success: res.success, message: res.message };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "연결을 다시 시도하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
      };
    } finally {
      setIsRetrying(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      let blocked = false;
      if (!(typeof document !== "undefined" && document.hidden)) {
        const next = await load();
        blocked = next?.blocked ?? false;
      }
      if (cancelled) return;
      // 차단 중일 때만 짧게 확인하고, 정상일 때는 느리게 확인해 서버 부담을 줄인다.
      timer = setTimeout(tick, blocked ? 5000 : pollIntervalMs);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, pollIntervalMs]);

  return { status, isRetrying, retry, refresh: load };
}
