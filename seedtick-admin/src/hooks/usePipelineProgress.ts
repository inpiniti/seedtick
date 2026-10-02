"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPipelineProgress } from "@/lib/api-client";
import type { PipelineProgress } from "@/types/api";

/**
 * 13인 거장 파이프라인 진행 상태 폴링 훅.
 *
 * - 실행 중이면 짧은 간격(기본 2초), 대기/완료 상태면 긴 간격으로 자동 조절합니다.
 * - 화면을 새로고침하거나 껐다 켜도 서버 메모리 상태를 다시 받아와 이어서 표시합니다.
 */
export function usePipelineProgress(pollIntervalMs = 2000) {
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<PipelineProgress | null> => {
    try {
      const data = await fetchPipelineProgress();
      setProgress(data);
      setError(null);
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "파이프라인 진행 상태를 불러오지 못했어요."
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 최초 1회 + 상태에 따른 적응형 폴링
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(tick, 5000);
        return;
      }
      const data = await load();
      if (cancelled) return;
      const delay =
        data?.status === "running"
          ? pollIntervalMs
          : Math.max(pollIntervalMs * 5, 10000);
      timer = setTimeout(tick, delay);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, pollIntervalMs]);

  // 브라우저 탭으로 복귀하면 즉시 최신 상태를 가져온다
  useEffect(() => {
    const handleVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [load]);

  return { progress, isLoading, error, refresh: load };
}