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
import { DataCache } from "@/lib/dataCache";
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
  initialReport?: GuruReportRow | null;
  initialTab?: ResearchDocTab;
  initialDate?: string;
  initialGuru?: string;
}

export function DashboardView({
  initialSection = "all",
  initialTicker,
  initialReport,
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
  const [isLoading, setIsLoading] = useState(!initialReport);
  const [isScreenerLoading, setIsScreenerLoading] = useState(false);
  const [isRomaLoading, setIsRomaLoading] = useState(false);

  // 3. 상태 데이터 (캐시 우선 초기화)
  const [health, setHealth] = useState<HealthStatus | null>(
    () => DataCache.getHealth() || buildOfflineHealth()
  );
  const [aiModel, setAiModel] = useState<AiModelStatus | null>(null);
  const [isResettingModel, setIsResettingModel] = useState(false);

  // 4. 리포트 & 로그 데이터
  const [guruReports, setGuruReports] = useState<GuruReportRow[]>(
    () => DataCache.getReports("LATEST") || []
  );
  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([]);
  const [liveCandidates, setLiveCandidates] = useState<StockCandidate[]>(
    () => DataCache.getLiveCandidates() || []
  );
  const [krCandidates, setKrCandidates] = useState<StockCandidate[]>(
    () => DataCache.getKrCandidates() || []
  );
  const [isKrLoading, setIsKrLoading] = useState(false);
  const [krTightenStep, setKrTightenStep] = useState<number>(5);
  const [romaCandidates, setRomaCandidates] = useState<StockCandidate[]>(
    () => DataCache.getRomaCandidates() || []
  );

  // 4-1. 날짜 선택 상태
  const [availableCatalogDates, setAvailableCatalogDates] = useState<string[]>(
    () => DataCache.getCatalogDates() || []
  );
  const [selectedCatalogDate, setSelectedCatalogDate] = useState<string>("");
  const [isCatalogDateLoading, setIsCatalogDateLoading] = useState(false);
  const selectedCatalogDateRef = useRef<string>("");

  // 4-2. 전 기간 내재가치 히스토리
  const [historicalValuations, setHistoricalValuations] = useState<
    HistoricalValuationRecord[]
  >(() => DataCache.getHistoricalValuations() || []);

  // 5. 종목별 %B 캐시
  const [percentBByTicker, setPercentBByTicker] = useState<
    Record<string, number | null>
  >(() => DataCache.getAllPercentB());
  const percentBByTickerRef = useRef<Record<string, number | null>>({});
  percentBByTickerRef.current = percentBByTicker;

  // 6. 파이프라인 진행 상태
  const { progress: pipelineProgress, refresh: refreshPipelineProgress } =
    usePipelineProgress();
  const isPipelineRunning = pipelineProgress?.status === "running";

  // 7. 파이프라인 수동 실행 모달
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [pipelineMarket, setPipelineMarket] = useState<"us" | "kr" | "all">("us");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [forceMarket, setForceMarket] = useState(false);
  const [skipAlreadyReported, setSkipAlreadyReported] = useState(true);

  // 8. 상세 리포트 뷰어 상태 (initialReport로 즉각 초기화: SSR 완벽 지원)
  const [selectedDocReport, setSelectedDocReport] =
    useState<GuruReportRow | null>(initialReport ?? null);
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
  >(initialDate || initialReport?.d);
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

    const currentReports = selectedDocReport ? [selectedDocReport, ...guruReports] : guruReports;
    for (const report of currentReports) {
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
  }, [historicalValuations, guruReports, selectedDocReport]);

  // 데이터 로드 (캐시 우선 확인으로 불필요한 반복 쿼리 방지)
  const loadDashboardData = useCallback(async (force = false) => {
    const cachedHealth = DataCache.getHealth();
    const cachedDates = DataCache.getCatalogDates();
    const cachedReports = DataCache.getReports(selectedCatalogDateRef.current || "LATEST");
    const cachedValuations = DataCache.getHistoricalValuations();

    if (!force && cachedHealth && cachedDates && cachedReports) {
      setHealth(cachedHealth);
      setAvailableCatalogDates(cachedDates);
      setGuruReports(cachedReports);
      if (cachedValuations) setHistoricalValuations(cachedValuations);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [healthRes, datesRes, logsRes, aiModelRes, valuationsRes] = await Promise.all([
        withTimeout(fetchHealth(), buildOfflineHealth()),
        withTimeout(fetchGuruReportDates(), []),
        withTimeout(fetchSystemLogs(60), []),
        withTimeout(fetchAiModelStatus(), null),
        withTimeout(fetchHistoricalValuations(), []),
      ]);

      const finalHealth = healthRes || buildOfflineHealth();
      setHealth(finalHealth);
      DataCache.setHealth(finalHealth);

      if (aiModelRes) setAiModel(aiModelRes);
      setSystemLogs(logsRes);

      if (valuationsRes) {
        setHistoricalValuations(valuationsRes);
        DataCache.setHistoricalValuations(valuationsRes);
      }

      const dates = datesRes || [];
      setAvailableCatalogDates(dates);
      DataCache.setCatalogDates(dates);

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
      DataCache.setReports(activeDate || "LATEST", reportsRes);
    } catch (err) {
      console.error("대시보드 데이터 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectCatalogDate = useCallback(async (targetDate: string) => {
    selectedCatalogDateRef.current = targetDate;
    setSelectedCatalogDate(targetDate);

    const cached = DataCache.getReports(targetDate);
    if (cached) {
      setGuruReports(cached);
      return;
    }

    setIsCatalogDateLoading(true);
    try {
      const reports = await fetchGuruReports(
        200,
        targetDate === "ALL" ? undefined : targetDate
      );
      DataCache.setReports(targetDate, reports);
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

  const loadLiveScreener = useCallback(async (force = false) => {
    const cached = DataCache.getLiveCandidates();
    if (!force && cached) {
      setLiveCandidates(cached);
      return;
    }

    setIsScreenerLoading(true);
    try {
      const res = await fetchScreener("공통", "us", 100);
      const items = res.items || res.tickers || [];
      DataCache.setLiveCandidates(items);
      setLiveCandidates(items);
    } catch (err) {
      console.warn("미국장 스크리너 조회 실패:", err);
    } finally {
      setIsScreenerLoading(false);
    }
  }, []);

  const loadKrScreener = useCallback(async (force = false) => {
    const cached = DataCache.getKrCandidates();
    if (!force && cached) {
      setKrCandidates(cached);
      return;
    }

    setIsKrLoading(true);
    try {
      const res = await fetchScreener("공통", "kr", 100, 5);
      const items = res.items || res.tickers || [];
      DataCache.setKrCandidates(items);
      setKrCandidates(items);
    } catch (err) {
      console.warn("한국장 스크리너 조회 실패:", err);
    } finally {
      setIsKrLoading(false);
    }
  }, []);

  const loadRomaScreener = useCallback(async (force = false) => {
    const cached = DataCache.getRomaCandidates();
    if (!force && cached) {
      setRomaCandidates(cached);
      return;
    }

    setIsRomaLoading(true);
    try {
      const res = await fetchRomaScreener(10, 0);
      const items = res.items || res.tickers || [];
      DataCache.setRomaCandidates(items);
      setRomaCandidates(items);
    } catch (err) {
      console.warn("DataRoma 스크리너 조회 실패:", err);
    } finally {
      setIsRomaLoading(false);
    }
  }, []);

  // %B 비동기 우선순위 로딩 (상세 뷰 모드에서는 실행하지 않음)
  useEffect(() => {
    if (initialTicker) return;

    const priorityTickers = Array.from(
      new Set([
        ...guruReports.slice(0, 20).map((r) => r.ticker),
        ...liveCandidates.slice(0, 10).map((c) => c.ticker),
        ...krCandidates.slice(0, 5).map((c) => c.ticker),
        ...romaCandidates.slice(0, 10).map((c) => c.ticker),
      ])
    )
      .map((t) => chartTickerKey(t))
      .filter((t) => Boolean(t) && DataCache.getPercentB(t) === undefined);

    if (priorityTickers.length === 0) return;

    const invalidTickers = priorityTickers.filter((t) => !isValidChartTicker(t));
    const validTickers = priorityTickers.filter((t) => isValidChartTicker(t));

    if (invalidTickers.length > 0) {
      for (const t of invalidTickers) {
        DataCache.setPercentB(t, null);
      }
      setPercentBByTicker(DataCache.getAllPercentB());
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
        for (const res of results) {
          DataCache.setPercentB(res.ticker, res.percentB);
        }
        setPercentBByTicker(DataCache.getAllPercentB());

        if (i + chunkSize < validTickers.length) {
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }
    };

    loadPercentB();
    return () => {
      cancelled = true;
    };
  }, [initialTicker, guruReports, liveCandidates, krCandidates, romaCandidates]);

  const handleTriggerPipeline = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await triggerPipeline({
        dryRun: false,
        force: forceMarket,
        market: pipelineMarket,
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

  // 문서 뷰에서 카탈로그 목록으로 복귀 (직전 방문 화면으로 정확히 복귀!)
  const handleBackToCatalog = useCallback(() => {
    setSelectedDocReport(null);
    setSelectedGuruSlug(null);
    setIsMobileMenuOpen(false);

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/stocks");
    }
  }, [router]);

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

  // initialTicker가 있을 때 날짜 목록 보강
  useEffect(() => {
    if (initialTicker) {
      const tickerClean = initialTicker.toUpperCase();
      fetchReportDatesByTicker(tickerClean).then((dates) => {
        if (dates.length > 0) setAvailableReportDates(dates);
      });
    }
  }, [initialTicker]);

  // 페이지/섹션에 맞춘 타겟 데이터 로드 (필요한 데이터만 스마트 로딩)
  useEffect(() => {
    // 상세 페이지일 때는 무거운 스크리너들을 조회하지 않음
    if (initialTicker) return;

    loadDashboardData();

    // 스크리너 탭이거나 홈일 때만 스크리너 로드
    if (activeSidebarSection === "all" || activeSidebarSection === "sec-screener") {
      loadLiveScreener();
      loadKrScreener();
    }
    if (activeSidebarSection === "all" || activeSidebarSection === "sec-roma") {
      loadRomaScreener();
    }
  }, [
    initialTicker,
    activeSidebarSection,
    loadDashboardData,
    loadLiveScreener,
    loadKrScreener,
    loadRomaScreener,
  ]);

  // 파이프라인 완료 시 데이터 자동 리프레시
  const prevPipelineStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = pipelineProgress?.status ?? null;
    const prev = prevPipelineStatus.current;
    prevPipelineStatus.current = status;
    if (prev === "running" && (status === "completed" || status === "failed")) {
      loadDashboardData(true);
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
          onRefresh={() => loadDashboardData(true)}
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
                onRefreshLive={() => loadLiveScreener(true)}
                onRefreshKr={() => loadKrScreener(true)}
                onRefreshRoma={() => loadRomaScreener(true)}
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
            title="일일 분석 파이프라인을 실행할까요?"
            description="선별된 스크리닝 종목에 대해 13인 심층 분석 보고서를 백그라운드로 생성해요."
          />
          <Modal.Body>
            <div className="space-y-4 text-xs font-mono">
              {/* 시장 선택 */}
              <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded space-y-2">
                <div className="text-[11px] font-semibold text-[#0f172a] uppercase tracking-wider mb-1.5">
                  대상 시장 선택
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPipelineMarket("us")}
                    className={`py-2 px-2.5 rounded border text-left transition-all cursor-pointer ${
                      pipelineMarket === "us"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-xs"
                        : "bg-white border-[#e2e8f0] text-[#475569] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    <div className="text-xs">미국장 (US)</div>
                    <div className="text-[10px] text-[#64748b] mt-0.5 font-normal">오전 09:00 배치</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipelineMarket("kr")}
                    className={`py-2 px-2.5 rounded border text-left transition-all cursor-pointer ${
                      pipelineMarket === "kr"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-xs"
                        : "bg-white border-[#e2e8f0] text-[#475569] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    <div className="text-xs">한국장 (KR)</div>
                    <div className="text-[10px] text-[#64748b] mt-0.5 font-normal">오후 16:00 배치</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipelineMarket("all")}
                    className={`py-2 px-2.5 rounded border text-left transition-all cursor-pointer ${
                      pipelineMarket === "all"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-semibold shadow-xs"
                        : "bg-white border-[#e2e8f0] text-[#475569] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    <div className="text-xs">전체 (US+KR)</div>
                    <div className="text-[10px] text-[#64748b] mt-0.5 font-normal">한/미 동시 분석</div>
                  </button>
                </div>
                <p className="text-[11px] text-[#64748b] pt-1">
                  {pipelineMarket === "us" && "미국 NYSE 정규장 개장 여부를 검사하고 토스200·DataRoma 종목을 분석해요."}
                  {pipelineMarket === "kr" && "한국 KRX 정규장 개장 여부를 검사하고 국장 실시간 발굴 종목을 분석해요."}
                  {pipelineMarket === "all" && "한/미 정규장 개장 여부를 각각 검사하고 전체 대상 종목을 분석해요."}
                </p>
              </div>

              {/* 강제 실행 옵션 */}
              <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-[#0f172a]">
                  <input
                    type="checkbox"
                    checked={forceMarket}
                    onChange={(e) => setForceMarket(e.target.checked)}
                    className="rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0"
                  />
                  <span>휴장 여부 무시하고 강제 실행 (force=true)</span>
                </label>
                <p className="text-[11px] text-[#64748b] pl-5">
                  선택한 시장이 휴장일이거나 주말이어도 가드를 건너뛰고 리포트를 생성해요.
                </p>
              </div>

              {/* 오늘 기분석 종목 제외 */}
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
                  이미 오늘 날짜로 발행된 보고서가 있는 종목은 토큰 절약을 위해 재분석하지 않아요.
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
