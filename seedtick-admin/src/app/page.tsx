"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AiModelStatus,
  GuruReportRow,
  HealthStatus,
  StockCandidate,
  SystemLogItem,
} from "@/types/api";
import {
  fetchAiModelStatus,
  fetchHealth,
  fetchRomaScreener,
  fetchScreener,
  resetAiModelRotation,
  triggerPipeline,
} from "@/lib/api-client";
import {
  fetchGuruReports,
  fetchSystemLogs,
  fetchReportByDateAndTicker,
  fetchReportDatesByTicker,
} from "@/lib/supabase";
import { usePipelineProgress } from "@/hooks/usePipelineProgress";
import { LiveStatusBar } from "@/components/header/LiveStatusBar";
import {
  ResearchSidebar,
  SidebarSectionId,
} from "@/components/sidebar/ResearchSidebar";
import { ResearchCatalogView } from "@/components/research/ResearchCatalogView";
import { ResearchDocumentModal } from "@/components/research/ResearchDocumentModal";
import { ScreenerTab } from "@/components/tabs/ScreenerTab";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Sparkles, Activity, LayoutGrid, BookOpen } from "lucide-react";

const DASHBOARD_FETCH_TIMEOUT_MS = 5000;

async function withTimeout<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs = DASHBOARD_FETCH_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    task
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

function buildOfflineHealth(): HealthStatus {
  return {
    status: "down",
    timestamp: new Date().toISOString(),
    env: "unknown",
    dry_run: true,
    default_broker: "none",
    us_market_today: {
      is_open: false,
      status_text: "서버와 연결을 확인하고 있습니다",
    },
  };
}

export default function AdminDashboardPage() {
  // 1. 네비게이션 & 뷰 모드 ("doc" = aihero 문서 카탈로그 스타일 [기본], "table" = 클래식 테이블)
  const [viewFormat, setViewFormat] = useState<"doc" | "table">("doc");
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>("all");

  // 2. 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isScreenerLoading, setIsScreenerLoading] = useState(false);
  const [isRomaLoading, setIsRomaLoading] = useState(false);

  // 3. 상태 데이터
  const [health, setHealth] = useState<HealthStatus | null>(buildOfflineHealth());
  const [aiModel, setAiModel] = useState<AiModelStatus | null>(null);
  const [isResettingModel, setIsResettingModel] = useState(false);

  // 4. 리포트 & 로그 데이터
  const [guruReports, setGuruReports] = useState<GuruReportRow[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([]);
  const [liveCandidates, setLiveCandidates] = useState<StockCandidate[]>([]);
  const [romaCandidates, setRomaCandidates] = useState<StockCandidate[]>([]);

  // 5. 13인 거장 파이프라인 진행 상태
  const { progress: pipelineProgress, refresh: refreshPipelineProgress } =
    usePipelineProgress();
  const isPipelineRunning = pipelineProgress?.status === "running";

  // 6. 파이프라인 수동 실행 모달 상태
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [forceMarket, setForceMarket] = useState(false);
  const [skipAlreadyReported, setSkipAlreadyReported] = useState(true);

  // 7. 리포트 상세 문서 모달 상태
  const [selectedReport, setSelectedReport] = useState<GuruReportRow | null>(
    null
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [availableReportDates, setAvailableReportDates] = useState<string[]>([]);
  const [selectedReportDate, setSelectedReportDate] = useState<string | undefined>();
  const [isLoadingReportDate, setIsLoadingReportDate] = useState(false);

  // 데이터 로드
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [healthRes, reportsRes, logsRes, aiModelRes] = await Promise.all([
        withTimeout(fetchHealth(), buildOfflineHealth()),
        withTimeout(fetchGuruReports(200), []),
        withTimeout(fetchSystemLogs(60), []),
        withTimeout(fetchAiModelStatus(), null),
      ]);

      setHealth(healthRes || buildOfflineHealth());
      if (aiModelRes) setAiModel(aiModelRes);
      setGuruReports(reportsRes);
      setSystemLogs(logsRes);
    } catch (err) {
      console.error("대시보드 데이터 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const loadRomaScreener = useCallback(async () => {
    setIsRomaLoading(true);
    try {
      const res = await fetchRomaScreener(10, 0);
      setRomaCandidates(res.items || res.tickers || []);
    } catch (err) {
      console.warn("DataRoma 스크리너 조회 실패:", err);
    } finally {
      setIsRomaLoading(false);
    }
  }, []);

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

  const handleRefreshLogs = async (level?: string) => {
    try {
      const logs = await fetchSystemLogs(60, level);
      setSystemLogs(logs);
    } catch (err) {
      console.warn("로그 새로고침 오류:", err);
    }
  };

  const handleTriggerPipeline = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await triggerPipeline({
        force: forceMarket,
        skipAlreadyReported: skipAlreadyReported,
      });
      if (res?.status === "skipped") {
        setActionMessage(
          "이미 파이프라인이 실행 중입니다. 진행 상황을 확인해 주세요."
        );
      } else {
        setActionMessage(
          "파이프라인을 시작했습니다. 백그라운드에서 분석이 진행됩니다."
        );
      }
      await refreshPipelineProgress();
      setTimeout(() => {
        setIsPipelineModalOpen(false);
        setActionMessage(null);
        loadDashboardData();
      }, 1500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "파이프라인 실행 중 오류가 발생했습니다.";
      setActionMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 리포트 열기 핸들러
  const handleOpenReport = async (report: GuruReportRow) => {
    setSelectedReport(report);
    setSelectedReportDate(report.d);
    setIsReportModalOpen(true);

    if (report.ticker) {
      const localDates = guruReports
        .filter((r) => r.ticker === report.ticker)
        .map((r) => r.d);
      fetchReportDatesByTicker(report.ticker).then((dbDates) => {
        const merged = Array.from(new Set([...localDates, ...dbDates]))
          .sort()
          .reverse();
        setAvailableReportDates(merged);
      });
    }
  };

  const handleOpenCandidateAsReport = (candidate: StockCandidate) => {
    const existing = guruReports.find((r) => r.ticker === candidate.ticker);
    if (existing) {
      handleOpenReport(existing);
      return;
    }

    // 후보군 임시 리포트 구조 생성
    const fallback: GuruReportRow = {
      id: `live-${candidate.ticker}`,
      d: new Date().toISOString().split("T")[0],
      ticker: candidate.ticker,
      company_name: candidate.name || null,
      current_price: candidate.price || null,
      verdict: "분석 대기 중",
      overall_score: candidate.guru_score || 0,
      vote_summary: candidate.holders
        ? `DataRoma 슈퍼인베스터 ${candidate.holders}인 보유 종목`
        : "스크리너 발굴 종목",
      datapack: null,
      summaries: null,
      discussion: null,
      final_report: null,
      created_at: new Date().toISOString(),
    };
    setSelectedReport(fallback);
    setSelectedReportDate(fallback.d);
    setAvailableReportDates([fallback.d]);
    setIsReportModalOpen(true);
  };

  const handleSelectReportDate = async (targetDate: string) => {
    if (!selectedReport || selectedReport.d === targetDate) return;
    setIsLoadingReportDate(true);
    try {
      const cached = guruReports.find(
        (r) => r.ticker === selectedReport.ticker && r.d === targetDate
      );
      if (cached) {
        setSelectedReport(cached);
        setSelectedReportDate(targetDate);
        return;
      }
      const fetched = await fetchReportByDateAndTicker(
        targetDate,
        selectedReport.ticker
      );
      if (fetched) {
        setSelectedReport(fetched);
        setSelectedReportDate(targetDate);
      }
    } catch (e) {
      console.error("보고서 날짜 조회 오류:", e);
    } finally {
      setIsLoadingReportDate(false);
    }
  };

  // 초기 마운트
  useEffect(() => {
    loadDashboardData();
    loadLiveScreener();
    loadRomaScreener();
  }, [loadDashboardData, loadLiveScreener, loadRomaScreener]);

  // 파이프라인 완료 시 데이터 자동 리프레시
  const prevPipelineStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = pipelineProgress?.status ?? null;
    const prev = prevPipelineStatus.current;
    prevPipelineStatus.current = status;
    if (prev === "running" && (status === "completed" || status === "failed")) {
      loadDashboardData();
    }
  }, [pipelineProgress?.status, loadDashboardData]);

  // 사이드바 클릭 시 스크롤 이동
  const handleSelectSidebarSection = (sec: SidebarSectionId) => {
    setActiveSidebarSection(sec);
    if (sec !== "all") {
      const el = document.getElementById(sec);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--page-background)] flex flex-col font-sans">
      {/* ── 프레임 컨테이너: max-w-[1456px] 및 border-x ── */}
      <div className="relative mx-auto w-full max-w-[1456px] min-h-screen flex flex-col bg-white border-x border-[#e2e8f0] shadow-xs">
        {/* 1. 상단 Sticky 헤더 */}
        <LiveStatusBar
          health={health}
          aiModel={aiModel}
          isResettingModel={isResettingModel}
          onResetModel={handleResetAiModel}
          isLoading={isLoading}
          onRefresh={loadDashboardData}
          onOpenPipelineModal={() => setIsPipelineModalOpen(true)}
          isPipelineRunning={isPipelineRunning}
        />

        {/* 2. 바디 영역: 좌측 사이드바 + 우측 메인 콘텐츠 */}
        <div className="flex-1 flex w-full min-h-0">
          {/* 좌측 사이드바 (데스크톱 고정) */}
          <ResearchSidebar
            activeSection={activeSidebarSection}
            onSelectSection={handleSelectSidebarSection}
            reportCount={guruReports.length}
            candidateCount={liveCandidates.length}
            romaCount={romaCandidates.length}
            logCount={systemLogs.length}
          />

          {/* 우측 메인 영역 */}
          <main className="flex-1 min-w-0 flex flex-col">
            {/* 뷰 포맷 토글 바 (문서 카탈로그 vs 고급 테이블) */}
            <div className="border-b border-[#e2e8f0] px-6 lg:px-12 py-2.5 bg-[#f8fafc] flex items-center justify-between text-xs font-mono">
              <span className="text-[#64748b]">
                {viewFormat === "doc"
                  ? "VIEW MODE: DOCUMENTATION & INSIGHT CATALOG"
                  : "VIEW MODE: ADVANCED TABLE & SCREENER"}
              </span>

              <div className="flex items-center gap-1 bg-white border border-[#e2e8f0] p-0.5 rounded">
                <button
                  onClick={() => setViewFormat("doc")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    viewFormat === "doc"
                      ? "bg-[#0f172a] text-white font-medium"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>문서 카탈로그 (aihero)</span>
                </button>
                <button
                  onClick={() => setViewFormat("table")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    viewFormat === "table"
                      ? "bg-[#0f172a] text-white font-medium"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>고급 테이블 보기</span>
                </button>
              </div>
            </div>

            {/* 초기 로딩 스켈레톤 */}
            {isLoading && !health ? (
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : viewFormat === "doc" ? (
              /* [A] aihero.dev/skills 스타일 번호 매김형 문서 카탈로그 */
              <ResearchCatalogView
                guruReports={guruReports}
                liveCandidates={liveCandidates}
                romaCandidates={romaCandidates}
                systemLogs={systemLogs}
                pipelineProgress={pipelineProgress}
                isLoading={isScreenerLoading}
                isRomaLoading={isRomaLoading}
                onRefreshLive={loadLiveScreener}
                onRefreshRoma={loadRomaScreener}
                onRefreshPipeline={refreshPipelineProgress}
                onRefreshLogs={handleRefreshLogs}
                onSelectReport={handleOpenReport}
                onSelectCandidate={handleOpenCandidateAsReport}
                activeSectionFilter={activeSidebarSection}
              />
            ) : (
              /* [B] 고급 세부 테이블 뷰 (ScreenerTab) */
              <div className="p-6 lg:p-8">
                <ScreenerTab
                  guruReports={guruReports}
                  liveCandidates={liveCandidates}
                  romaCandidates={romaCandidates}
                  isRomaLoading={isRomaLoading}
                  isLoading={isScreenerLoading}
                  pipelineProgress={pipelineProgress}
                  onRefreshLive={loadLiveScreener}
                  onRefreshRoma={loadRomaScreener}
                  onRefreshPipeline={refreshPipelineProgress}
                />
              </div>
            )}
          </main>
        </div>

        {/* 3. 리포트 상세 문서 모달 (화이트페이퍼 뷰어) */}
        <ResearchDocumentModal
          report={selectedReport}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          availableDates={availableReportDates}
          selectedDate={selectedReportDate}
          onSelectDate={handleSelectReportDate}
          isLoadingDate={isLoadingReportDate}
        />

        {/* 4. 일일 파이프라인 수동 실행 모달 */}
        <Modal
          isOpen={isPipelineModalOpen}
          onClose={() => setIsPipelineModalOpen(false)}
        >
          <Modal.Header
            title="12:00 일일 분석 파이프라인을 실행하시겠습니까?"
            description="스크리닝 통과 종목 전체에 대해 13인 심층 분석 보고서를 백그라운드로 생성합니다."
          />
          <Modal.Body>
            <div className="space-y-4 font-mono text-xs">
              <label className="flex items-center gap-2 text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipAlreadyReported}
                  onChange={(e) => setSkipAlreadyReported(e.target.checked)}
                  className="w-4 h-4 rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0"
                />
                <span className="font-medium">
                  오늘 이미 리포트 등록된 종목은 제외하고 작성 (추천)
                </span>
              </label>
              <label className="flex items-center gap-2 text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceMarket}
                  onChange={(e) => setForceMarket(e.target.checked)}
                  className="w-4 h-4 rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0"
                />
                <span>휴장일/주말 가드를 건너뛰고 강제 실행</span>
              </label>
              {actionMessage && (
                <div className="p-3 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs">
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
              {isPipelineRunning ? "이미 실행 중입니다" : "파이프라인 실행"}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* 5. 에디토리얼 푸터 */}
        <footer className="py-6 border-t border-[#e2e8f0] px-6 lg:px-12 bg-[#fafafa] text-xs font-mono text-[#64748b]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>
              SeedTick Research Console · 13 Gurus AI Valuation & Insight Archive
            </span>
            <span className="text-[#94a3b8]">
              API Gateway: seedtick-ai-gateway · Engine: seedtick-analyzer
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
