"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  fetchGuruReportDates,
  fetchHistoricalValuations,
  HistoricalValuationRecord,
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
import { ResearchDocumentView, ResearchDocTab } from "@/components/research/ResearchDocumentView";
import { GuruDocumentView } from "@/components/research/GuruDocumentView";
import { GURU_PERSONAS } from "@/lib/guruPersonas";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  chartTickerKey,
  isValidChartTicker,
  buildIntrinsicStability,
  extractValuationConsensus,
  IntrinsicStability,
} from "@/lib/insightUtils";

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

export interface DashboardViewProps {
  initialSection?: SidebarSectionId;
  initialTicker?: string;
  initialTab?: ResearchDocTab;
  initialDate?: string;
  initialGuru?: string;
}

export function DashboardView({
  initialSection = "all",
  initialTicker,
  initialTab,
  initialDate,
  initialGuru,
}: DashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. 네비게이션 상태
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>(initialSection);

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
  const [krCandidates, setKrCandidates] = useState<StockCandidate[]>([]);
  const [isKrLoading, setIsKrLoading] = useState(false);
  const [krTightenStep, setKrTightenStep] = useState<number>(5);
  const [romaCandidates, setRomaCandidates] = useState<StockCandidate[]>([]);

  // 4-1. 가치평가 및 거장 리포트 날짜별 선택 상태 (디폴트: 가장 최근 작성일)
  const [availableCatalogDates, setAvailableCatalogDates] = useState<string[]>([]);
  const [selectedCatalogDate, setSelectedCatalogDate] = useState<string>("");
  const [isCatalogDateLoading, setIsCatalogDateLoading] = useState(false);
  const selectedCatalogDateRef = useRef<string>("");

  // 4-2. 전 기간 내재가치 히스토리
  const [historicalValuations, setHistoricalValuations] = useState<
    HistoricalValuationRecord[]
  >([]);

  // 5. 종목별 %B 캐시
  const [percentBByTicker, setPercentBByTicker] = useState<
    Record<string, number | null>
  >({});
  const percentBByTickerRef = useRef<Record<string, number | null>>({});
  percentBByTickerRef.current = percentBByTicker;

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

  // 8. 상세 리포트 뷰어 상태
  const [selectedDocReport, setSelectedDocReport] =
    useState<GuruReportRow | null>(null);
  const [selectedGuruSlug, setSelectedGuruSlug] = useState<string | null>(
    initialGuru || null
  );
  const [activeDocTab, setActiveDocTab] = useState<ResearchDocTab | undefined>(
    initialTab
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [availableReportDates, setAvailableReportDates] = useState<string[]>([]);
  const [selectedReportDate, setSelectedReportDate] = useState<
    string | undefined
  >(initialDate);
  const [isLoadingReportDate, setIsLoadingReportDate] = useState(false);

  // 후보군 로고 맵
  const candidateLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of liveCandidates) {
      if (c.logo_image_url) map.set(c.ticker.toUpperCase(), c.logo_image_url);
    }
    for (const c of krCandidates) {
      if (c.logo_image_url && !map.has(c.ticker.toUpperCase())) {
        map.set(c.ticker.toUpperCase(), c.logo_image_url);
      }
    }
    for (const c of romaCandidates) {
      if (c.logo_image_url && !map.has(c.ticker.toUpperCase())) {
        map.set(c.ticker.toUpperCase(), c.logo_image_url);
      }
    }
    return map;
  }, [liveCandidates, krCandidates, romaCandidates]);

  // 내재가치 안정성 맵
  const intrinsicStabilityByTicker = useMemo(() => {
    const fairValuesByTickerDate = new Map<string, Map<string, number>>();

    for (const record of historicalValuations) {
      const ticker = record.ticker.toUpperCase();
      if (!fairValuesByTickerDate.has(ticker)) {
        fairValuesByTickerDate.set(ticker, new Map());
      }
      fairValuesByTickerDate.get(ticker)!.set(record.d, record.fair_value_price);
    }

    for (const report of guruReports) {
      const fairValue = extractValuationConsensus(report)?.fair_value_price;
      if (fairValue == null || !Number.isFinite(fairValue) || fairValue <= 0)
        continue;
      const ticker = report.ticker.toUpperCase();
      if (!fairValuesByTickerDate.has(ticker)) {
        fairValuesByTickerDate.set(ticker, new Map());
      }
      fairValuesByTickerDate.get(ticker)!.set(report.d, fairValue);
    }

    const stabilityMap = new Map<string, IntrinsicStability>();
    for (const [ticker, dateMap] of fairValuesByTickerDate.entries()) {
      const fairValues = Array.from(dateMap.values());
      stabilityMap.set(ticker, buildIntrinsicStability(fairValues));
    }
    return stabilityMap;
  }, [historicalValuations, guruReports]);

  // 데이터 로드
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [healthRes, datesRes, logsRes, aiModelRes, valuationsRes] = await Promise.all([
        withTimeout(fetchHealth(), buildOfflineHealth()),
        withTimeout(fetchGuruReportDates(), []),
        withTimeout(fetchSystemLogs(60), []),
        withTimeout(fetchAiModelStatus(), null),
        withTimeout(fetchHistoricalValuations(), []),
      ]);

      setHealth(healthRes || buildOfflineHealth());
      if (aiModelRes) setAiModel(aiModelRes);
      setSystemLogs(logsRes);
      if (valuationsRes) setHistoricalValuations(valuationsRes);

      const dates = datesRes || [];
      setAvailableCatalogDates(dates);

      const activeDate =
        selectedCatalogDateRef.current || (dates.length > 0 ? dates[0] : "");
      if (activeDate && !selectedCatalogDateRef.current) {
        selectedCatalogDateRef.current = activeDate;
        setSelectedCatalogDate(activeDate);
      }

      const reportsRes = await withTimeout(
        fetchGuruReports(
          200,
          activeDate && activeDate !== "ALL" ? activeDate : undefined
        ),
        []
      );
      setGuruReports(reportsRes);
    } catch (err) {
      console.error("대시보드 데이터 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectCatalogDate = useCallback(async (targetDate: string) => {
    selectedCatalogDateRef.current = targetDate;
    setSelectedCatalogDate(targetDate);
    setIsCatalogDateLoading(true);
    try {
      const reports = await fetchGuruReports(
        200,
        targetDate === "ALL" ? undefined : targetDate
      );
      setGuruReports(reports);
    } catch (e) {
      console.error("카탈로그 일자별 리포트 조회 오류:", e);
    } finally {
      setIsCatalogDateLoading(false);
    }
  }, []);

  const handleRefreshLogs = useCallback(async (level?: string) => {
    const logs = await fetchSystemLogs(60, level);
    setSystemLogs(logs);
  }, []);

  const handleResetAiModel = async () => {
    setIsResettingModel(true);
    try {
      await resetAiModelRotation();
      const status = await fetchAiModelStatus();
      setAiModel(status);
    } catch (err) {
      console.error("AI 모델 로테이션 리셋 실패:", err);
    } finally {
      setIsResettingModel(false);
    }
  };

  const loadLiveScreener = useCallback(async () => {
    setIsScreenerLoading(true);
    try {
      const res = await fetchScreener("공통", "us", 100);
      setLiveCandidates(res.items || res.tickers || []);
    } catch (err) {
      console.warn("미국장 스크리너 조회 실패:", err);
    } finally {
      setIsScreenerLoading(false);
    }
  }, []);

  const loadKrScreener = useCallback(async () => {
    setIsKrLoading(true);
    try {
      const res = await fetchScreener("공통", "kr", 100, 5);
      setKrCandidates(res.items || res.tickers || []);
    } catch (err) {
      console.warn("한국장 스크리너 조회 실패:", err);
    } finally {
      setIsKrLoading(false);
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

  // %B 비동기 우선순위 로딩
  useEffect(() => {
    const priorityTickers = Array.from(
      new Set([
        ...guruReports.slice(0, 25).map((r) => r.ticker),
        ...liveCandidates.slice(0, 15).map((c) => c.ticker),
        ...krCandidates.slice(0, 5).map((c) => c.ticker),
        ...romaCandidates.slice(0, 15).map((c) => c.ticker),
      ])
    )
      .map((t) => chartTickerKey(t))
      .filter((t) => Boolean(t) && percentBByTickerRef.current[t] === undefined);

    if (priorityTickers.length === 0) return;

    const invalidTickers = priorityTickers.filter((t) => !isValidChartTicker(t));
    const validTickers = priorityTickers.filter((t) => isValidChartTicker(t));

    if (invalidTickers.length > 0) {
      setPercentBByTicker((prev) => {
        const next = { ...prev };
        for (const t of invalidTickers) {
          next[t] = null;
        }
        return next;
      });
    }

    if (validTickers.length === 0) return;

    let cancelled = false;
    const chunkSize = 4;

    const loadPercentB = async () => {
      for (let i = 0; i < validTickers.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = validTickers.slice(i, i + chunkSize);

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

        if (i + chunkSize < validTickers.length) {
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }
    };

    loadPercentB();
    return () => {
      cancelled = true;
    };
  }, [guruReports, liveCandidates, krCandidates, romaCandidates]);

  const handleTriggerPipeline = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await triggerPipeline({
        dryRun: false,
        force: forceMarket,
        skipAlreadyReported: skipAlreadyReported,
      });
      if ((res as any).status === "skipped") {
        setActionMessage(`스킵됨: ${(res as any).reason || "휴장일 또는 실행 조건 미충족"}`);
      } else {
        setActionMessage(
          `파이프라인 실행 시작: [${(res as any).run_id || "RUN"}] (총 ${(res as any).tickers_queued || 0}개 종목)`
        );
        setTimeout(() => {
          setIsPipelineModalOpen(false);
          setActionMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "파이프라인 트리거 중 오류 발생";
      setActionMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 상세 리포트 열기 (URL 동기화)
  const handleOpenReport = useCallback((report: GuruReportRow, tab?: ResearchDocTab) => {
    setSelectedDocReport(report);
    setSelectedReportDate(report.d);
    if (tab) setActiveDocTab(tab);

    const targetUrl = `/stocks/${encodeURIComponent(report.ticker)}${tab ? `?tab=${tab}` : ""}`;
    if (pathname !== `/stocks/${encodeURIComponent(report.ticker)}`) {
      router.push(targetUrl);
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
  }, [guruReports, pathname, router]);

  // 후보군 종목을 문서 모드로 열기
  const handleOpenCandidateAsReport = useCallback((candidate: StockCandidate) => {
    const existing = guruReports.find((r) => r.ticker === candidate.ticker);
    if (existing) {
      handleOpenReport(existing);
      return;
    }

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

    router.push(`/stocks/${encodeURIComponent(candidate.ticker)}`);
  }, [guruReports, handleOpenReport, router]);

  // 탭 변경 시 URL 쿼리 파라미터 동기화 (?tab=...)
  const handleTabChange = useCallback((tab: ResearchDocTab) => {
    setActiveDocTab(tab);
    if (selectedDocReport) {
      const search = new URLSearchParams(searchParams?.toString() || "");
      search.set("tab", tab);
      router.replace(`/stocks/${encodeURIComponent(selectedDocReport.ticker)}?${search.toString()}`, {
        scroll: false,
      });
    }
  }, [selectedDocReport, searchParams, router]);

  // 날짜 변경 시 URL 쿼리 파라미터 동기화 (?date=...)
  const handleSelectReportDate = async (targetDate: string) => {
    if (!selectedDocReport || selectedDocReport.d === targetDate) return;
    setIsLoadingReportDate(true);
    try {
      const search = new URLSearchParams(searchParams?.toString() || "");
      search.set("date", targetDate);
      router.replace(`/stocks/${encodeURIComponent(selectedDocReport.ticker)}?${search.toString()}`, {
        scroll: false,
      });

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

  // 거장 심층 철학 문서 뷰로 이동
  const handleOpenGuru = useCallback((slug: string) => {
    setSelectedGuruSlug(slug);
    setSelectedDocReport(null);
    setIsMobileMenuOpen(false);
    router.push(`/gurus/${encodeURIComponent(slug)}`);
  }, [router]);

  // 문서 뷰에서 카탈로그 목록으로 복귀
  const handleBackToCatalog = useCallback(() => {
    setSelectedDocReport(null);
    setSelectedGuruSlug(null);
    setIsMobileMenuOpen(false);
    if (activeSidebarSection === "sec-reports") {
      router.push("/stocks");
    } else if (activeSidebarSection === "sec-screener" || activeSidebarSection === "sec-roma") {
      router.push("/screener");
    } else if (activeSidebarSection === "sec-gurus") {
      router.push("/gurus");
    } else {
      router.push("/");
    }
  }, [activeSidebarSection, router]);

  // 사이드바 섹션 클릭 시 실제 URL 라우팅
  const handleSelectSidebarSection = (sec: SidebarSectionId) => {
    setActiveSidebarSection(sec);
    setSelectedDocReport(null);
    setSelectedGuruSlug(null);
    setIsMobileMenuOpen(false);

    if (sec === "all") router.push("/");
    else if (sec === "sec-reports") router.push("/stocks");
    else if (sec === "sec-screener") router.push("/screener");
    else if (sec === "sec-roma") router.push("/screener?tab=roma");
    else if (sec === "sec-gurus") router.push("/gurus");
    else if (sec === "sec-audit") router.push("/admin");
  };

  // initialTicker가 전달되었을 때 보고서 로드
  useEffect(() => {
    if (initialTicker) {
      const tickerClean = initialTicker.toUpperCase();
      const targetDate = initialDate || selectedReportDate;
      const cached = guruReports.find(
        (r) => r.ticker.toUpperCase() === tickerClean && (!targetDate || r.d === targetDate)
      );
      if (cached) {
        setSelectedDocReport(cached);
        setSelectedReportDate(cached.d);
      } else {
        fetchGuruReports(50).then((reports) => {
          const match = reports.find((r) => r.ticker.toUpperCase() === tickerClean);
          if (match) {
            setSelectedDocReport(match);
            setSelectedReportDate(match.d);
          } else {
            // 미생성 폴백
            handleOpenCandidateAsReport({
              ticker: tickerClean,
              name: tickerClean,
              price: 0,
            });
          }
        });
      }

      fetchReportDatesByTicker(tickerClean).then((dates) => {
        if (dates.length > 0) setAvailableReportDates(dates);
      });
    }
  }, [initialTicker, initialDate, guruReports, handleOpenCandidateAsReport]);

  // 초기 마운트
  useEffect(() => {
    loadDashboardData();
    loadLiveScreener();
    loadKrScreener();
    loadRomaScreener();
  }, [loadDashboardData, loadLiveScreener, loadKrScreener, loadRomaScreener]);

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

  return (
    <div className="min-h-screen bg-[color:var(--page-background)] flex flex-col font-sans">
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
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* 2. 바디 영역: 좌측 사이드바 + 우측 메인 콘텐츠 */}
        <div className="flex-1 flex w-full min-h-0">
          <ResearchSidebar
            activeSection={activeSidebarSection}
            onSelectSection={handleSelectSidebarSection}
            reportCount={guruReports.length}
            candidateCount={liveCandidates.length}
            krCandidateCount={krCandidates.length}
            romaCount={romaCandidates.length}
            logCount={systemLogs.length}
            activeDocTicker={selectedDocReport?.ticker || initialTicker || null}
            activeGuruName={
              selectedGuruSlug ? GURU_PERSONAS[selectedGuruSlug]?.name : null
            }
            onBackToCatalog={handleBackToCatalog}
            isOpenOnMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          <main className="flex-1 min-w-0 flex flex-col">
            {selectedDocReport ? (
              <ResearchDocumentView
                report={selectedDocReport}
                onBack={handleBackToCatalog}
                availableDates={availableReportDates}
                selectedDate={selectedReportDate}
                onSelectDate={handleSelectReportDate}
                isLoadingDate={isLoadingReportDate}
                activeTab={activeDocTab}
                onTabChange={handleTabChange}
                percentB={
                  selectedDocReport
                    ? percentBByTicker[chartTickerKey(selectedDocReport.ticker)]
                    : null
                }
                logoUrl={
                  selectedDocReport
                    ? candidateLogoMap.get(selectedDocReport.ticker.toUpperCase()) || null
                    : null
                }
                intrinsicStability={
                  selectedDocReport
                    ? intrinsicStabilityByTicker.get(selectedDocReport.ticker.toUpperCase())
                    : undefined
                }
              />
            ) : selectedGuruSlug ? (
              <GuruDocumentView
                guruSlug={selectedGuruSlug}
                guruReports={guruReports}
                onBack={handleBackToCatalog}
                onSelectReport={(report) => {
                  setSelectedGuruSlug(null);
                  handleOpenReport(report);
                }}
              />
            ) : isLoading && !health ? (
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <ResearchCatalogView
                guruReports={guruReports}
                liveCandidates={liveCandidates}
                krCandidates={krCandidates}
                romaCandidates={romaCandidates}
                systemLogs={systemLogs}
                pipelineProgress={pipelineProgress}
                isLoading={isScreenerLoading}
                isKrLoading={isKrLoading}
                isRomaLoading={isRomaLoading}
                krTightenStep={krTightenStep}
                percentBByTicker={percentBByTicker}
                onRefreshLive={loadLiveScreener}
                onRefreshKr={loadKrScreener}
                onRefreshRoma={loadRomaScreener}
                onRefreshPipeline={refreshPipelineProgress}
                onRefreshLogs={handleRefreshLogs}
                onSelectReport={handleOpenReport}
                onSelectCandidate={handleOpenCandidateAsReport}
                activeSectionFilter={activeSidebarSection}
                onSelectSection={handleSelectSidebarSection}
                availableDates={availableCatalogDates}
                selectedDate={selectedCatalogDate}
                onSelectDate={handleSelectCatalogDate}
                isReportsLoading={isCatalogDateLoading}
                onSelectGuru={handleOpenGuru}
                intrinsicStabilityMap={intrinsicStabilityByTicker}
              />
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

        {/* 4. 에디토리얼 푸터 */}
        <footer className="mt-auto py-6 border-t border-[#e2e8f0] px-6 lg:px-12 bg-[#fafafa] text-xs font-mono text-[#64748b]">
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
