"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPipelineProgress } from "@/lib/api-client";
import type { PipelineProgress } from "@/types/api";

/**
 * 13인 거장 파이프라인 진행 상태 초경량 훅.
 *
 * - 과도한 2초 주기 자동 폴링을 전면 제거하여 서버 부하를 0으로 만듭니다.
 * - 마운트 시 1회 확인하며, 파이프라인이 실행 중('running')일 때만 30초 간격으로 완만하게 확인합니다.
 * - 사용자가 수동 새로고침(`refresh()`)을 누르면 즉시 1회 확인합니다.
 */
export function usePipelineProgress() {
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

  // 1. 컴포넌트 마운트 시 1회만 상태 조회
  useEffect(() => {
    load();
  }, [load]);

  // 2. 실행 중('running')일 때만 30초 주기로 완만하게 초경량 확인
  useEffect(() => {
    if (progress?.status !== "running") return;

    const timer = setInterval(() => {
      load();
    }, 30000);

    return () => clearInterval(timer);
  }, [progress?.status, load]);

  return { progress, isLoading, error, refresh: load };
}