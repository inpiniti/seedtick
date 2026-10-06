"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AiModelStatus,
  GuruReportRow,
  GuruVoteRow,
  HealthStatus,
  StockCandidate,
  SystemLogItem,
} from "@/types/api";
import {
  fetchAiModelStatus,
  fetchHealth,
  fetchScreener,
  resetAiModelRotation,
  triggerPipeline,
} from "@/lib/api-client";
import {
  fetchGuruReports,
  fetchGuruVotes,
  fetchSystemLogs,
} from "@/lib/supabase";
import { usePipelineProgress } from "@/hooks/usePipelineProgress";
import { LiveStatusBar } from "@/components/header/LiveStatusBar";
import { ScreenerTab } from "@/components/tabs/ScreenerTab";
import { LogsTab } from "@/components/tabs/LogsTab";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { BarChart2, Terminal, Play, Sparkles, Activity } from "lucide-react";

export default function AdminDashboardPage() {
  // 활성 탭 (1: 스크리너 & 거장 리포트, 2: 로그)
  const [activeTab, setActiveTab] = useState<"screener" | "logs">("screener");

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isScreenerLoading, setIsScreenerLoading] = useState(false);

  // 상태 데이터
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [aiModel, setAiModel] = useState<AiModelStatus | null>(null);
  const [isResettingModel, setIsResettingModel] = useState(false);

  // Supabase 데이터
  const [guruVotes, setGuruVotes] = useState<GuruVoteRow[]>([]);
  const [guruReports, setGuruReports] = useState<GuruReportRow[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([]);
  const [liveCandidates, setLiveCandidates] = useState<StockCandidate[]>([]);

  // 13인 거장 파이프라인 진행 상태 (초경량: 마운트 시 1회 및 running 시 30초 간격)
  const { progress: pipelineProgress, refresh: refreshPipelineProgress } =
    usePipelineProgress();
  const isPipelineRunning = pipelineProgress?.status === "running";

  // 파이프라인 수동 실행 모달 상태
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [forceMarket, setForceMarket] = useState(false);
  const [skipAlreadyReported, setSkipAlreadyReported] = useState(true);

  // 1. 전체 핵심 데이터 병렬 로드 (증권사 외부 API 제거로 초고속 로딩)
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [healthRes, votesRes, reportsRes, logsRes, aiModelRes] =
        await Promise.all([
          fetchHealth().catch(() => null),
          fetchGuruVotes(200).catch(() => []),
          fetchGuruReports(200).catch(() => []),
          fetchSystemLogs(60).catch(() => []),
          fetchAiModelStatus().catch(() => null),
        ]);

      if (healthRes) setHealth(healthRes);
      if (aiModelRes) setAiModel(aiModelRes);
      setGuruVotes(votesRes);
      setGuruReports(reportsRes);
      setSystemLogs(logsRes);
    } catch (err) {
      console.error("대시보드 데이터 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. 실시간 스크리너 별도 조회
  const loadLiveScreener = useCallback(async () => {
    setIsScreenerLoading(true);
    try {
      const res = await fetchScreener("공통", "us", 50);
      setLiveCandidates(res.items || res.tickers || []);
    } catch (err) {
      console.warn("실시간 스크리너 조회 실패:", err);
    } finally {
      setIsScreenerLoading(false);
    }
  }, []);

  // 3. AI 모델 순위 1순위 수동 초기화
  const handleResetAiModel = async () => {
    setIsResettingModel(true);
    try {
      await resetAiModelRotation();
      const fresh = await fetchAiModelStatus().catch(() => null);
      if (fresh) setAiModel(fresh);
    } catch (err) {
      console.warn("AI 모델 순위 초기화 오류:", err);
    } finally {
      setIsResettingModel(false);
    }
  };

  // 4. 로그 필터 새로고침
  const handleRefreshLogs = async (level?: string) => {
    try {
      const logs = await fetchSystemLogs(60, level);
      setSystemLogs(logs);
    } catch (err) {
      console.warn("로그 새로고침 오류:", err);
    }
  };

  // 5. 파이프라인 수동 실행 핸들러
  const handleTriggerPipeline = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await triggerPipeline({
        force: forceMarket,
        skipAlreadyReported: skipAlreadyReported,
      });
      if (res?.status === "skipped") {
        setActionMessage("이미 파이프라인이 실행 중이에요. 진행 상황을 확인해 주세요.");
      } else {
        setActionMessage("파이프라인을 시작했어요. 백그라운드에서 분석이 진행됩니다.");
      }
      await refreshPipelineProgress();
      setTimeout(() => {
        setIsPipelineModalOpen(false);
        setActionMessage(null);
        loadDashboardData();
      }, 1500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
      setActionMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 파이프라인 완료/실패 시 리포트·표결 목록 자동 갱신
  const prevPipelineStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = pipelineProgress?.status ?? null;
    const prev = prevPipelineStatus.current;
    prevPipelineStatus.current = status;
    if (prev === "running" && (status === "completed" || status === "failed")) {
      loadDashboardData();
    }
  }, [pipelineProgress?.status, loadDashboardData]);

  // 스크리너 탭 진입 시 실시간 데이터가 없으면 자동 페칭
  useEffect(() => {
    if (activeTab === "screener" && liveCandidates.length === 0 && !isScreenerLoading) {
      loadLiveScreener();
    }
  }, [activeTab, liveCandidates.length, isScreenerLoading, loadLiveScreener]);

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col font-sans">
      {/* 1. 상단 라이브 헤더 바 */}
      <LiveStatusBar
        health={health}
        aiModel={aiModel}
        isResettingModel={isResettingModel}
        onResetModel={handleResetAiModel}
        isLoading={isLoading}
        onRefresh={loadDashboardData}
      />

      {/* 2. 메인 컨테이너 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-8 py-4 sm:py-6 space-y-5 pb-24 md:pb-8">
        {/* 상단 액션 바: 세그먼트 탭 & 13인 거장 파이프라인 즉시 실행 버튼 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* [데스크톱 전용] 상단 세그먼트 탭 바 */}
          <div className="hidden md:flex items-center gap-2 p-1.5 bg-white rounded-3xl border border-[#f2f4f6] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <button
              onClick={() => setActiveTab("screener")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "screener"
                  ? "bg-[#3182f6] text-white shadow-sm"
                  : "text-[#6b7684] hover:text-[#191f28] hover:bg-[#f9fafb]"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>1. 스크리너 & 13인 거장 리포트</span>
              {guruVotes.length > 0 ? (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === "screener"
                      ? "bg-white text-[#3182f6]"
                      : "bg-[#f2f4f6] text-[#6b7684]"
                  }`}
                >
                  {guruVotes.length}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "logs"
                  ? "bg-[#3182f6] text-white shadow-sm"
                  : "text-[#6b7684] hover:text-[#191f28] hover:bg-[#f9fafb]"
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>2. 시스템 & 에러 로그</span>
              {systemLogs.length > 0 ? (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === "logs"
                      ? "bg-white text-[#3182f6]"
                      : "bg-[#f2f4f6] text-[#6b7684]"
                  }`}
                >
                  {systemLogs.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* 파이프라인 수동 실행 버튼 */}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPipelineModalOpen(true)}
              disabled={isPipelineRunning}
              leftIcon={
                isPipelineRunning ? (
                  <Activity className="w-4 h-4 animate-pulse" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )
              }
              className="w-full sm:w-auto justify-center font-bold text-xs sm:text-sm rounded-2xl shadow-xs"
            >
              {isPipelineRunning ? "13인 분석 실행 중..." : "12:00 파이프라인 지금 실행"}
            </Button>
          </div>
        </div>

        {/* 탭 콘텐츠 렌더링 (도허티 임계 스켈레톤 적용) */}
        {isLoading && !health ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {activeTab === "screener" ? (
              <ScreenerTab
                guruVotes={guruVotes}
                guruReports={guruReports}
                liveCandidates={liveCandidates}
                isLoading={isScreenerLoading}
                pipelineProgress={pipelineProgress}
                onRefreshLive={loadLiveScreener}
                onRefreshPipeline={refreshPipelineProgress}
              />
            ) : null}

            {activeTab === "logs" ? (
              <LogsTab
                logs={systemLogs}
                isLoading={isLoading}
                onRefresh={handleRefreshLogs}
              />
            ) : null}
          </>
        )}
      </main>

      {/* [모바일 전용] 하단 고정 네비게이션 바 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#f2f4f6] z-40 px-4 py-1.5 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab("screener")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === "screener"
                ? "text-[#3182f6] font-bold"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">스크리너 & 리포트</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === "logs"
                ? "text-[#3182f6] font-bold"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            <Terminal className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">시스템 로그</span>
          </button>
        </div>
      </nav>

      {/* 모달: 일일 파이프라인 수동 즉시 실행 모달 */}
      <Modal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
      >
        <Modal.Header
          title="12:00 일일 분석 파이프라인을 실행할까요?"
          description="토스 거장 통합 스크리닝 통과 종목 전체에 대해 13인 심층 분석 보고서를 백그라운드로 생성합니다."
        />
        <Modal.Body>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-[#191f28] cursor-pointer">
              <input
                type="checkbox"
                checked={skipAlreadyReported}
                onChange={(e) => setSkipAlreadyReported(e.target.checked)}
                className="w-4 h-4 rounded text-[#3182f6] focus:ring-0"
              />
              <span className="font-medium">
                오늘 이미 리포트 등록된 종목은 제외하고 작성{" "}
                <span className="text-[#3182f6] text-xs font-semibold">(추천)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#191f28] cursor-pointer">
              <input
                type="checkbox"
                checked={forceMarket}
                onChange={(e) => setForceMarket(e.target.checked)}
                className="w-4 h-4 rounded text-[#3182f6] focus:ring-0"
              />
              <span>휴장일/주말 가드를 건너뛰고 강제 실행</span>
            </label>
            {actionMessage && (
              <div className="p-3 rounded-2xl bg-[#e8f3ff] text-[#3182f6] text-sm font-medium">
                {actionMessage}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setIsPipelineModalOpen(false)}
            disabled={isActionLoading}
          >
            닫기
          </Button>
          <Button
            variant="primary"
            onClick={handleTriggerPipeline}
            disabled={isPipelineRunning}
            isLoading={isActionLoading}
          >
            {isPipelineRunning ? "이미 실행 중이에요" : "파이프라인 실행하기"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 데스크톱 푸터 */}
      <footer className="hidden md:block mt-auto py-6 border-t border-[#f2f4f6] text-center text-xs text-[#8b95a1]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SeedTick Admin Console · 13인 거장 AI 스크리닝 & 심층 분석 관제센터</span>
          <span className="font-mono text-[11px]">
            API Gateway: seedtick-ai-gateway · Engine: seedtick-analyzer
          </span>
        </div>
      </footer>
    </div>
  );
}

