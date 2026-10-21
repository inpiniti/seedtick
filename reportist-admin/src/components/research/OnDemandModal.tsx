"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  FileText,
  Brain,
  Database,
  Search,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  requestOnDemandReport,
  fetchOnDemandProgress,
} from "@/lib/api-client";
import type { OnDemandProgress } from "@/types/api";

interface OnDemandModalProps {
  isOpen: boolean;
  ticker: string;
  displayName?: string;
  onClose: () => void;
  onCompleted?: (ticker: string) => void;
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  datapack: <Database className="w-4 h-4" />,
  value_driver: <Search className="w-4 h-4" />,
  summaries: <Brain className="w-4 h-4" />,
  master: <FileText className="w-4 h-4" />,
  sync: <CheckCircle2 className="w-4 h-4" />,
};

export function OnDemandModal({
  isOpen,
  ticker,
  displayName,
  onClose,
  onCompleted,
}: OnDemandModalProps) {
  const router = useRouter();
  const cleanTicker = ticker.trim().toUpperCase();
  const nameLabel = displayName || cleanTicker;

  const [progress, setProgress] = useState<OnDemandProgress | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  // 1. 분석 요청 트리거
  const handleStartAnalysis = useCallback(async (force = false) => {
    if (!cleanTicker) return;
    setIsStarting(true);
    setError(null);
    try {
      const res = await requestOnDemandReport(cleanTicker, force);
      if (res.already_completed) {
        // 이미 당일 리포트가 있으면 바로 이동
        if (onCompleted) {
          onCompleted(cleanTicker);
        } else {
          router.push(`/stocks/${cleanTicker}`);
        }
        onClose();
        return;
      }
      if (res.progress) {
        setProgress(res.progress);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "분석 요청에 실패했어요.";
      setError(msg);
    } finally {
      setIsStarting(false);
    }
  }, [cleanTicker, onCompleted, onClose, router]);

  // 모달 열릴 때 자동 시작 및 기존 진행 상태 확인
  useEffect(() => {
    if (!isOpen || !cleanTicker) {
      setProgress(null);
      setError(null);
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      return;
    }

    let isMounted = true;
    isNavigatingRef.current = false;

    // 초기 상태 확인 후 없으면 시작
    fetchOnDemandProgress(cleanTicker)
      .then((curr) => {
        if (!isMounted) return;
        if (curr.status === "running" || curr.status === "pending") {
          setProgress(curr);
        } else if (curr.status === "completed") {
          setProgress(curr);
        } else {
          // 신규 시작
          handleStartAnalysis();
        }
      })
      .catch(() => {
        if (isMounted) handleStartAnalysis();
      });

    // 1초 단위 실시간 폴링
    pollingTimerRef.current = setInterval(async () => {
      if (!isMounted || isNavigatingRef.current) return;
      try {
        const snap = await fetchOnDemandProgress(cleanTicker);
        if (!isMounted) return;
        setProgress(snap);

        if (snap.status === "completed") {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          isNavigatingRef.current = true;
          // 완료 후 1.5초 뒤 페이지 이동
          setTimeout(() => {
            if (onCompleted) {
              onCompleted(cleanTicker);
            } else {
              router.push(`/stocks/${cleanTicker}`);
            }
            onClose();
          }, 1500);
        } else if (snap.status === "failed") {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setError(snap.error || "분석 도중 오류가 발생했어요.");
        }
      } catch {
        // 일시적 폴링 에러 무시
      }
    }, 1200);

    return () => {
      isMounted = false;
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isOpen, cleanTicker, handleStartAnalysis, onCompleted, onClose, router]);

  if (!isOpen) return null;

  const currentPercent = progress?.progress_percent ?? (isStarting ? 8 : 5);
  const status = progress?.status ?? (isStarting ? "running" : "pending");
  const isCompleted = status === "completed";
  const isFailed = status === "failed" || !!error;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="wide">
      <div className="p-6 sm:p-8 space-y-6">
        {/* ── 헤더 ── */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e8f3ff] text-[#3182f6]">
                <Sparkles className="w-3.5 h-3.5" />
                13인 거장 AI 즉시 분석
              </span>
              <span className="text-xs font-mono text-[#8b95a1]">{cleanTicker}</span>
            </div>
            <h2 className="text-xl font-bold text-[#191f28]">
              {nameLabel} 심층 가치평가
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8b95a1] hover:text-[#191f28] rounded-md transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 실시간 프로그레스 게이지 ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-[#333d4b] flex items-center gap-1.5">
              {!isCompleted && !isFailed && (
                <RefreshCw className="w-3 h-3 text-[#3182f6] animate-spin" />
              )}
              {isCompleted ? (
                <span className="text-[#059669] font-semibold">분석이 모두 완료되었어요! 🎉</span>
              ) : isFailed ? (
                <span className="text-[#e11d48] font-semibold">분석 중 문제가 발생했어요</span>
              ) : (
                <span>{progress?.message || "분석을 준비하고 있어요..."}</span>
              )}
            </span>
            <span className="font-mono font-semibold text-[#3182f6]">
              {currentPercent}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#f2f4f6] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isCompleted
                  ? "bg-[#059669]"
                  : isFailed
                  ? "bg-[#e11d48]"
                  : "bg-[#3182f6]"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, currentPercent))}%` }}
            />
          </div>
        </div>

        {/* ── 5단계 파이프라인 진행 상태 리스트 ── */}
        <div className="bg-[#f9fafb] border border-[#e5e8eb] rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-[#6b7684] uppercase tracking-wider mb-2">
            AI 심층 분석 단계
          </div>

          <div className="space-y-2 text-xs">
            {[
              { key: "datapack", label: "재무제표 및 지표 데이터팩 수집", step: 1 },
              { key: "value_driver", label: "최신 시장 촉매 및 가치 드라이버 발굴", step: 2 },
              {
                key: "summaries",
                label: `13인의 투자 거장 개별 심층 채점 (${progress?.gurus_done ?? 0}/13)`,
                step: 3,
              },
              { key: "master", label: "거장 라운드테이블 토론 & 마스터 보고서 작성", step: 4 },
              { key: "sync", label: "데이터베이스 동기화 및 발행", step: 5 },
            ].map((s) => {
              const currentStep = progress?.stage_index ?? 1;
              const isStepDone = isCompleted || currentStep > s.step;
              const isStepCurrent = !isCompleted && currentStep === s.step;

              return (
                <div
                  key={s.key}
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                    isStepCurrent
                      ? "bg-white border border-[#3182f6]/30 shadow-xs text-[#191f28] font-semibold"
                      : isStepDone
                      ? "text-[#4e5968]"
                      : "text-[#8b95a1]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                        isStepDone
                          ? "bg-[#059669] text-white"
                          : isStepCurrent
                          ? "bg-[#3182f6] text-white animate-pulse"
                          : "bg-[#e5e8eb] text-[#8b95a1]"
                      }`}
                    >
                      {isStepDone ? "✓" : s.step}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {STAGE_ICONS[s.key]}
                      {s.label}
                    </span>
                  </div>

                  {isStepCurrent && (
                    <span className="text-[11px] text-[#3182f6] font-normal">
                      진행 중
                    </span>
                  )}
                  {isStepDone && (
                    <span className="text-[11px] text-[#059669] font-normal">
                      완료
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 친절한 안내 문구 (지루함 방지) ── */}
        {!isCompleted && !isFailed && (
          <div className="flex items-start gap-2.5 p-3.5 bg-[#f2f4f6] rounded-xl text-xs text-[#4e5968] leading-relaxed">
            <Clock className="w-4 h-4 text-[#3182f6] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#191f28]">
                13인의 거장 AI가 정밀 분석 중이에요 (약 1~2분 소요)
              </p>
              <p className="text-[#6b7684] mt-0.5">
                이 창을 닫거나 다른 화면을 둘러보셔도 백그라운드에서 분석이 멈추지 않고 완료돼요.
                <strong> 10분 뒤에 다시 방문</strong>하시면 정식 보고서를 바로 확인하실 수 있어요.
              </p>
            </div>
          </div>
        )}

        {/* ── 에러 안내 ── */}
        {isFailed && (
          <div className="flex items-start gap-2.5 p-3.5 bg-[#fef2f2] border border-[#fecdd3] rounded-xl text-xs text-[#9f1239]">
            <AlertCircle className="w-4 h-4 text-[#e11d48] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">분석을 완료하지 못했어요</p>
              <p className="text-[#be123c]">{error || progress?.error}</p>
            </div>
          </div>
        )}

        {/* ── 하단 액션 버튼 ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isCompleted ? (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                if (onCompleted) {
                  onCompleted(cleanTicker);
                } else {
                  router.push(`/stocks/${cleanTicker}`);
                }
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
            >
              <span>보고서 보러가기</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : isFailed ? (
            <>
              <Button variant="secondary" size="md" onClick={onClose}>
                닫기
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => handleStartAnalysis(true)}
                className="inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                다시 시도하기
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="text-[#4e5968]"
            >
              백그라운드에서 계속 진행하고 창 닫기
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
