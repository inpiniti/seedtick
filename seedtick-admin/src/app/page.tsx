"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fetchStockChart,
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
import { ResearchDocumentView } from "@/components/research/ResearchDocumentView";
import { ScreenerTab } from "@/components/tabs/ScreenerTab";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  chartTickerKey,
  buildIntrinsicStability,
  extractValuationConsensus,
  IntrinsicStability,
} from "@/lib/insightUtils";
import { LayoutGrid, BookOpen } from "lucide-react";

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

  // 5. 종목별 %B 캐시 (비동기 청크 로딩)
  const [percentBByTicker, setPercentBByTicker] = useState<
    Record<string, number | null>
  >({});

  // 6. 13인 거장 파이프라인 진행 상태
  const { progress: pipelineProgress, refresh: refreshPipelineProgress } =
    usePipelineProgress();
  const isPipelineRunning = pipelineProgress?.status === "running";

  // 7. 파이프라인 수동 실행 모달 상태
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [forceMarket, setForceMarket] = useState(false);
  const [skipAlreadyReported, setSkipAlreadyReported] = useState(true);

  // 8. 상세 리포트 인플레이스(in-place) 문서 뷰어 상태 (팝업창 X -> 화면 전환 O)
  const [selectedDocReport, setSelectedDocReport] =
    useState<GuruReportRow | null>(null);
  const [availableReportDates, setAvailableReportDates] = useState<string[]>([]);
  const [selectedReportDate, setSelectedReportDate] = useState<
    string | undefined
  >();
  const [isLoadingReportDate, setIsLoadingReportDate] = useState(false);

  // 후보군 로고 맵
  const candidateLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of liveCandidates) {
      if (c.logo_image_url) map.set(c.ticker.toUpperCase(), c.logo_image_url);
    }
    for (const c of romaCandidates) {
      if (c.logo_image_url && !map.has(c.ticker.toUpperCase())) {
        map.set(c.ticker.toUpperCase(), c.logo_image_url);
      }
    }
    return map;
  }, [liveCandidates, romaCandidates]);

  // 내재가치 안정성 맵
  const intrinsicStabilityByTicker = useMemo(() => {
    const fairValuesByTicker = new Map<string, number[]>();
    for (const report of guruReports) {
      const fairValue = extractValuationConsensus(report)?.fair_value_price;
      if (fairValue == null || !Number.isFinite(fairValue) || fairValue <= 0)
        continue;
      const key = report.ticker.toUpperCase();
      const series = fairValuesByTicker.get(key) || [];
      series.push(fairValue);
      fairValuesByTicker.set(key, series);
    }

    const stabilityMap = new Map<string, IntrinsicStability>();
    for (const [ticker, fairValues] of fairValuesByTicker.entries()) {
      stabilityMap.set(ticker, buildIntrinsicStability(fairValues));
    }
    return stabilityMap;
  }, [guruReports]);

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
      // 10개 제한 없이 최대 100개까지 전체 발굴 후보 조회
      const res = await fetchScreener("공통", "us", 100);
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
      // size=0은 DataRoma 전체 그랜드 포트폴리오를 의미
      const res = await fetchRomaScreener(10, 0);
      setRomaCandidates(res.items || res.tickers || []);
    } catch (err) {
      console.warn("DataRoma 스크리너 조회 실패:", err);
    } finally {
      setIsRomaLoading(false);
    }
  }, []);

  // %B 비동기 청크 로딩 (백그라운드에서 한 번에 6개씩 일봉 데이터 조회 후 캐싱)
  useEffect(() => {
    const allTickers = Array.from(
      new Set([
        ...guruReports.map((r) => r.ticker),
        ...liveCandidates.map((c) => c.ticker),
        ...romaCandidates.map((c) => c.ticker),
      ])
    )
      .map((t) => chartTickerKey(t))
      .filter((t) => Boolean(t) && percentBByTicker[t] === undefined);

    if (allTickers.length === 0) return;

    let cancelled = false;
    const chunkSize = 6;

    const loadPercentB = async () => {
      for (let i = 0; i < allTickers.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = allTickers.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (ticker) => {
            try {
              const chart = await fetchStockChart(ticker, "6mo", "1d");
              return { ticker, percentB: chart.summary?.percent_b ?? null };
            } catch {
              return { ticker, percentB: null };
            }
          })
        );

        if (cancelled) return;
        setPercentBByTicker((prev) => {
          const next = { ...prev };
          for (const res of results) {
            next[res.ticker] = res.percentB;
          }
          return next;
        });
      }
    };

    loadPercentB();

    return () => {
      cancelled = true;
    };
  }, [guruReports, liveCandidates, romaCandidates, percentBByTicker]);

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

  // 상세 리포트 열기 (인플레이스 레이아웃 전환)
  const handleOpenReport = useCallback((report: GuruReportRow) => {
    setSelectedDocReport(report);
    setSelectedReportDate(report.d);

    // 브라우저 주소창 파라미터 동기화 (뒤로가기 지원)
    if (typeof window !== "undefined") {
      window.history.pushState(
        { ticker: report.ticker },
        "",
        `?ticker=${encodeURIComponent(report.ticker)}`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

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
  }, [guruReports]);

  // 후보군 종목을 문서 모드로 열기
  const handleOpenCandidateAsReport = useCallback((candidate: StockCandidate) => {
    const existing = guruReports.find((r) => r.ticker === candidate.ticker);
    if (existing) {
      handleOpenReport(existing);
      return;
    }

    // 보고서 미생성 종목도 임시 구조로 열어 일봉 및 밸류에이션 탭 즉시 열람
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
    setSelectedDocReport(fallback);
    setSelectedReportDate(fallback.d);
    setAvailableReportDates([fallback.d]);

    if (typeof window !== "undefined") {
      window.history.pushState(
        { ticker: candidate.ticker },
        "",
        `?ticker=${encodeURIComponent(candidate.ticker)}`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [guruReports, handleOpenReport]);

  // 문서 뷰에서 카탈로그 목록으로 복귀
  const handleBackToCatalog = useCallback(() => {
    setSelectedDocReport(null);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", window.location.pathname);
    }
  }, []);

  const handleSelectReportDate = async (targetDate: string) => {
    if (!selectedDocReport || selectedDocReport.d === targetDate) return;
    setIsLoadingReportDate(true);
    try {
      const cached = guruReports.find(
        (r) => r.ticker === selectedDocReport.ticker && r.d === targetDate
      );
      if (cached) {
        setSelectedDocReport(cached);
        setSelectedReportDate(targetDate);
        return;
      }
      const fetched = await fetchReportByDateAndTicker(
        targetDate,
        selectedDocReport.ticker
      );
      if (fetched) {
        setSelectedDocReport(fetched);
        setSelectedReportDate(targetDate);
      }
    } catch (e) {
      console.error("보고서 날짜 조회 오류:", e);
    } finally {
      setIsLoadingReportDate(false);
    }
  };

  // 브라우저 뒤로가기(popstate) 시 문서 모드 -> 카탈로그 모드 자동 동기화
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const ticker = params.get("ticker");
      if (!ticker) {
        setSelectedDocReport(null);
      } else {
        const found = guruReports.find(
          (r) => r.ticker.toUpperCase() === ticker.toUpperCase()
        );
        if (found) {
          setSelectedDocReport(found);
          setSelectedReportDate(found.d);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [guruReports]);

  // 초기 마운트 시 쿼리스트링에 ?ticker= 있으면 해당 보고서 즉시 오픈
  useEffect(() => {
    if (guruReports.length > 0 && !selectedDocReport) {
      const params = new URLSearchParams(window.location.search);
      const ticker = params.get("ticker");
      if (ticker) {
        const found = guruReports.find(
          (r) => r.ticker.toUpperCase() === ticker.toUpperCase()
        );
        if (found) {
          handleOpenReport(found);
        }
      }
    }
  }, [guruReports, selectedDocReport, handleOpenReport]);

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

  // 사이드바 클릭 시 스크롤 이동 및 문서 열람 중일 경우 카탈로그로 복귀
  const handleSelectSidebarSection = (sec: SidebarSectionId) => {
    if (selectedDocReport) {
      handleBackToCatalog();
    }
    setActiveSidebarSection(sec);
    if (sec !== "all") {
      setTimeout(() => {
        const el = document.getElementById(sec);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 50);
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
            activeDocTicker={selectedDocReport?.ticker || null}
            onBackToCatalog={handleBackToCatalog}
          />

          {/* 우측 메인 영역 */}
          <main className="flex-1 min-w-0 flex flex-col">
            {/* 열람 중인 보고서가 있으면 [인플레이스 상세 문서 뷰어] 표시 */}
            {selectedDocReport ? (
              <ResearchDocumentView
                report={selectedDocReport}
                onBack={handleBackToCatalog}
                availableDates={availableReportDates}
                selectedDate={selectedReportDate}
                onSelectDate={handleSelectReportDate}
                isLoadingDate={isLoadingReportDate}
                percentB={
                  selectedDocReport
                    ? percentBByTicker[chartTickerKey(selectedDocReport.ticker)]
                    : null
                }
                logoUrl={
                  selectedDocReport
                    ? candidateLogoMap.get(
                        selectedDocReport.ticker.toUpperCase()
                      ) || null
                    : null
                }
                intrinsicStability={
                  selectedDocReport
                    ? intrinsicStabilityByTicker.get(
                        selectedDocReport.ticker.toUpperCase()
                      )
                    : undefined
                }
              />
            ) : (
              <>
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
                    percentBByTicker={percentBByTicker}
                    onRefreshLive={loadLiveScreener}
                    onRefreshRoma={loadRomaScreener}
                    onRefreshPipeline={refreshPipelineProgress}
                    onRefreshLogs={handleRefreshLogs}
                    onSelectReport={handleOpenReport}
                    onSelectCandidate={handleOpenCandidateAsReport}
                    activeSectionFilter={activeSidebarSection}
                    onSelectSection={handleSelectSidebarSection}
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
              </>
            )}
          </main>
        </div>

        {/* 3. 일일 파이프라인 수동 실행 모달 */}
        <Modal
          isOpen={isPipelineModalOpen}
          onClose={() => setIsPipelineModalOpen(false)}
        >
          <Modal.Header
            title="12:00 일일 분석 파이프라인을 실행하시겠습니까?"
            description="스크리닝 통과 종목 전체에 대해 13인 심층 분석 보고서를 백그라운드로 생성합니다."
          />
          <Modal.Body>
            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-[#0f172a]">
                  <input
                    type="checkbox"
                    checked={forceMarket}
                    onChange={(e) => setForceMarket(e.target.checked)}
                    className="rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0"
                  />
                  <span>장 마감 여부 무시하고 강제 실행 (force=true)</span>
                </label>
                <p className="text-[11px] text-[#64748b] pl-5">
                  미국 장이 열리지 않은 주말이나 휴일에도 강제로 리서치를 수행합니다.
                </p>
              </div>

              <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-[#0f172a]">
                  <input
                    type="checkbox"
                    checked={skipAlreadyReported}
                    onChange={(e) => setSkipAlreadyReported(e.target.checked)}
                    className="rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0"
                  />
                  <span>오늘 이미 분석 완료된 종목 건너뛰기</span>
                </label>
                <p className="text-[11px] text-[#64748b] pl-5">
                  이미 오늘 날짜로 발행된 보고서가 있는 종목은 토큰 절약을 위해 재분석하지 않습니다.
                </p>
              </div>

              {actionMessage && (
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs">
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
              isLoading={isActionLoading}
            >
              파이프라인 실행
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}
