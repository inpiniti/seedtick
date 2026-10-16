"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  fetchTickerNameMap,
} from "@/lib/supabase";
import { usePipelineProgress } from "@/hooks/usePipelineProgress";
import { LiveStatusBar } from "@/components/header/LiveStatusBar";
import { AiModelWidget } from "@/components/header/AiModelWidget";
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
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import {
  isDateWithinDays,
  isReportRestricted,
  getDefaultReportDate,
} from "@/lib/subscription/subscriptionPolicy";

const DASHBOARD_FETCH_TIMEOUT_MS = 5000;

// 열린 상세 문서별 탭 기억 (SPA 라우트 이동 시 DashboardView가 remount되며
// SSR 티저(원문 없음)로 초기화되어 탭이 final→chart→final로 깜빡이는 것 방지.
// 탭 이름만 보관하므로 민감정보 없음, 같은 문서 id에만 적용)
const lastOpenedDocTabById: Record<string, ResearchDocTab> = {};

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
  const { user, tier, isTrialActive, openUpgradeModal, isAdmin, isAdminLoading, isLoading: isSubscriptionLoading } = useSubscription();
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const isTrialActiveRef = useRef(isTrialActive);
  isTrialActiveRef.current = isTrialActive;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  // 구독 확정 전 free 스냅샷 조회와 권한 변경 후 구 조회가 최신 조회를 덮어쓰지 않게 세대 가드
  const dashboardSeqRef = useRef(0);
  // 사용자가 탭을 직접 고른 적 있는지 (?tab=·클릭이 있으면 메모리 핀 폴백을 적용하지 않음)
  const userSelectedTabRef = useRef(false);

  // 1. 네비게이션 상태
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>(initialSection);

  useEffect(() => {
    setActiveSidebarSection(initialSection);
  }, [initialSection]);

  // 2. 로딩 상태 (캐시 미보유 시 마운트 조회가 실행되므로 초기값 반영)
  const [isLoading, setIsLoading] = useState(!initialReport);
  const [isScreenerLoading, setIsScreenerLoading] = useState(
    () => !DataCache.getLiveCandidates()
  );
  const [isRomaLoading, setIsRomaLoading] = useState(
    () => !DataCache.getRomaCandidates()
  );

  // 3. 상태 데이터 (캐시 우선 초기화)
  const [health, setHealth] = useState<HealthStatus | null>(
    () => DataCache.getHealth() || buildOfflineHealth()
  );
  // 4-2. 티커 -> 한글 종목명 캐시 (30분 TTL, 로고 워밍업 동기화)
  const [tickerNameMap, setTickerNameMap] = useState<Record<string, string>>(
    () => DataCache.getTickerNameMap() || {}
  );

  // 그림1 화면 표시분 한글명 보충 결과를 전역 캐시에 합침
  const handleSupplementTickerNames = useCallback((names: Record<string, string>) => {
    setTickerNameMap((prev) => {
      const merged = { ...prev, ...names };
      DataCache.setTickerNameMap(merged);
      return merged;
    });
  }, []);

  // 4-3. 티커 한글명 프리페치 (관리자 진입 시 1회, 30분 TTL)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = DataCache.getTickerNameMap();
      if (cached && Object.keys(cached).length > 0) {
        setTickerNameMap(cached);
        return;
      }
      if (cancelled) return;
      try {
        const map = await fetchTickerNameMap();
        if (cancelled) return;
        if (map && Object.keys(map).length > 0) {
          setTickerNameMap(map);
          DataCache.setTickerNameMap(map);
        }
      } catch {
        // 한글명 미보유/네트워크 실패는 후속 캐시 복구로 처리
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const [isKrLoading, setIsKrLoading] = useState(
    () => !DataCache.getKrCandidates()
  );
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

  // 6. 파이프라인 진행 상태 (관리자 전용 — 비관리자는 네트워크 호출 없음)
  const { progress: pipelineProgress, refresh: refreshPipelineProgress } =
    usePipelineProgress(isAdmin);
  const isPipelineRunning = pipelineProgress?.status === "running";
  const isUsMarketOpen = health?.us_market_today?.is_open ?? false;
  const isKrMarketOpen = health?.kr_market_today?.is_open ?? false;

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
  const [activeDocTab, setActiveDocTab] = useState<ResearchDocTab | undefined>(() => {
    // ?tab=이 있으면 우선, 없으면 직전 화면에서 연 동일 문서의 탭을 이어받아
    // SSR 티저 구간에도 마스터 탭을 유지 (remount 시 final→chart→final 깜빡임 방지)
    if (initialTab) return initialTab;
    const remembered = initialReport ? lastOpenedDocTabById[initialReport.id] : undefined;
    if (remembered) return remembered;
    return undefined;
  });
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

  // 내재가치 안정성 맵 (Free/체험만료 유저는 최근 30일 데이터 제외)
  // 02/03 리스트의 안정성 뱃지가 최신 적정가 분산을 유출하지 않게 하기 위함.
  // ResearchCatalogView는 제한 유저일 때 이 부모 맵을 무시하고 과거 리포트만으로
  // 자체 계산하므로, 상세 문서 헤더용으로만 최근치가 섞이지 않게 여기서도 필터한다.
  const intrinsicStabilityByTicker = useMemo(() => {
    const isRestrictedUser = tier === "free" && !isTrialActive;
    const fairValuesByTickerDate = new Map<string, Map<string, number>>();

    for (const record of historicalValuations) {
      if (isRestrictedUser && isDateWithinDays(record.d)) continue;
      const ticker = record.ticker.toUpperCase();
      if (!fairValuesByTickerDate.has(ticker)) {
        fairValuesByTickerDate.set(ticker, new Map());
      }
      fairValuesByTickerDate.get(ticker)!.set(record.d, record.fair_value_price);
    }

    const currentReports = selectedDocReport ? [selectedDocReport, ...guruReports] : guruReports;
    for (const report of currentReports) {
      if (isRestrictedUser && isDateWithinDays(report.d)) continue;
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
  }, [historicalValuations, guruReports, selectedDocReport, tier, isTrialActive]);

  // 데이터 로드 (캐시 우선 확인으로 불필요한 반복 쿼리 방지)
  const loadDashboardData = useCallback(async (force = false) => {
    const mySeq = ++dashboardSeqRef.current;
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
      // 감사 로그 + AI 모델 상태는 관리자 전용 (비관리자는 호출 자체를 생략)
      const logsPromise = isAdminRef.current
        ? withTimeout(fetchSystemLogs(60), [])
        : Promise.resolve([] as SystemLogItem[]);
      const aiModelPromise = isAdminRef.current
        ? withTimeout(fetchAiModelStatus(), null)
        : Promise.resolve(null);
      const [healthRes, datesRes, logsRes, aiModelRes, valuationsRes] = await Promise.all([
        withTimeout(fetchHealth(), buildOfflineHealth()),
        withTimeout(fetchGuruReportDates(), []),
        logsPromise,
        aiModelPromise,
        withTimeout(fetchHistoricalValuations(), []),
      ]);
      if (mySeq !== dashboardSeqRef.current) return;

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

      const defaultDate = getDefaultReportDate(
        dates,
        tierRef.current,
        new Date(),
        isTrialActiveRef.current
      );
      const activeDate =
        selectedCatalogDateRef.current || defaultDate || (dates.length > 0 ? dates[0] : "");
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
      if (mySeq !== dashboardSeqRef.current) return;
      setGuruReports(reportsRes);
      // 실패/타임아웃 빈 배열은 캐시 오염 방지로 저장하지 않음
      if (reportsRes.length > 0) DataCache.setReports(activeDate || "LATEST", reportsRes);
    } catch (err) {
      console.error("대시보드 데이터 로드 오류:", err);
    } finally {
      if (mySeq === dashboardSeqRef.current) setIsLoading(false);
    }
  }, []);

  // 순수 카탈로그 일자 적용 및 데이터 로더 (팝업을 띄우지 않음)
  const applyCatalogDate = useCallback(async (targetDate: string) => {
    const mySeq = ++dashboardSeqRef.current;
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
      // 일자 변경 후 도착한 구 응답은 버림
      if (mySeq !== dashboardSeqRef.current) return;
      if (selectedCatalogDateRef.current !== targetDate) return;
      setGuruReports(reports);
      // 실패/타임아웃 빈 배열은 캐시 오염 방지로 저장하지 않음
      if (reports.length > 0) DataCache.setReports(targetDate, reports);
    } catch (e) {
      console.error("카탈로그 일자별 리포트 조회 오류:", e);
    } finally {
      if (mySeq === dashboardSeqRef.current) setIsCatalogDateLoading(false);
    }
  }, []);

  // 사용자가 카탈로그 드롭다운이나 빠른 날짜 버튼을 직접 클릭했을 때의 이벤트 핸들러
  const handleUserSelectCatalogDate = useCallback(
    async (targetDate: string) => {
      const allowedFreeDate = getDefaultReportDate(availableCatalogDates, "free");

      // 1일 무료 체험 활성 유저나 Pro 회원은 어떤 날짜든 무제한 열람 가능
      if (tierRef.current === "pro" || isTrialActiveRef.current) {
        applyCatalogDate(targetDate);
        return;
      }

      // Free 티어 사용자(체험 만료 또는 비로그인): 최근 30일 이내 보고서(또는 ALL) 선택 시
      if (
        tierRef.current === "free" &&
        (targetDate === "ALL" ||
          isReportRestricted(
            targetDate,
            tierRef.current,
            new Date(),
            allowedFreeDate,
            isTrialActiveRef.current
          ))
      ) {
        if (!user) {
          openUpgradeModal(
            "로그인하면 24시간 동안 모든 최신 13인 거장 AI 리서치 보고서를 무료로 열람하실 수 있어요."
          );
        } else {
          openUpgradeModal(
            "1일 무료 체험이 종료되었어요. 매일 실시간으로 업데이트되는 13인 거장 AI 리포트를 계속 받아보시려면 Pro로 시작해보세요."
          );
        }
        return;
      }

      applyCatalogDate(targetDate);
    },
    [availableCatalogDates, openUpgradeModal, applyCatalogDate, user]
  );

  // 티어 및 체험 상태 변경 시(Free <-> Trial <-> Pro) 마스킹 캐시 파기 후
  // 카탈로그 디폴트 일자 자동 동기화 (순수 applyCatalogDate 호출로 모달 방지).
  // 게이트웨이가 권한별로 다른 내용(티저/원문)을 반환하므로 캐시 키가 아닌 파기로 정합성 보장.
  const accessKey = `${user?.id ?? "anon"}:${tier}:${isTrialActive ? "trial" : "notrial"}`;
  const prevAccessKeyRef = useRef(accessKey);
  useEffect(() => {
    if (prevAccessKeyRef.current !== accessKey) {
      prevAccessKeyRef.current = accessKey;
      // 진행 중 구 권한 조회 무효화 + 민감 캐시만 파기 (일자 목록 유지)
      dashboardSeqRef.current += 1;
      DataCache.clearReports();
      setHistoricalValuations([]);
      // 기존 리스트를 빈 배열로 지우지 않음: 신 조회 완료 전까지 구 리스트 유지로 빈 상태 깜빡임 방지
    }
    if (availableCatalogDates.length > 0) {
      const targetDefault = getDefaultReportDate(
        availableCatalogDates,
        tier,
        new Date(),
        isTrialActive
      );
      if (targetDefault && targetDefault !== selectedCatalogDateRef.current) {
        applyCatalogDate(targetDefault);
      }
    }
  }, [accessKey, tier, isTrialActive, availableCatalogDates, applyCatalogDate]);

  const handleRefreshLogs = useCallback(async (level?: string) => {
    if (!isAdminRef.current) return;
    const logs = await fetchSystemLogs(60, level);
    setSystemLogs(logs);
  }, []);

  const handleResetAiModel = async () => {
    if (!isAdminRef.current) return;
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

  // %B는 목록(ResearchCatalogView)에서 보이는 행만 지연 로딩한다.
  // 여기는 상세 문서 헤더용 단일 티커만 보장한다.
  const handlePercentBUpdate = useCallback((next: Record<string, number | null>) => {
    setPercentBByTicker(next);
  }, []);

  useEffect(() => {
    const target = selectedDocReport?.ticker || initialTicker;
    if (!target) return;
    const key = chartTickerKey(target);
    if (!key) return;
    // 마운트 스냅샷에 이미 있으면 동기 setState 생략 (캐시=진실, 목록 콜백이 갱신)
    if (DataCache.getPercentB(key) !== undefined) return;
    if (!isValidChartTicker(key)) {
      DataCache.setPercentB(key, null);
      queueMicrotask(() => setPercentBByTicker(DataCache.getAllPercentB()));
      return;
    }
    let cancelled = false;
    fetchStockChart(key, "6mo", "1d")
      .then((chart) => {
        if (cancelled) return;
        DataCache.setPercentB(key, chart.summary?.percent_b ?? null);
        setPercentBByTicker(DataCache.getAllPercentB());
      })
      .catch(() => {
        if (cancelled) return;
        DataCache.setPercentB(key, null);
        setPercentBByTicker(DataCache.getAllPercentB());
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDocReport?.ticker, initialTicker]);

  const handleTriggerPipeline = async () => {
    if (!isAdminRef.current) {
      setActionMessage("관리자 권한이 필요합니다.");
      return;
    }
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
  // - 탭 결정: 명시 탭 > 원문 있으면 마스터 > 없으면 차트. remount 후 SSR 티저 구간에도
  //   같은 탭을 유지하도록 lastOpenedDocTabById에 기억 (final→chart→final 깜빡임 방지)
  // - 원문 동기화는 아래 서버-진실 동기화 effect가 전담 (단일 경로)
  const handleOpenReport = useCallback((report: GuruReportRow, tab?: ResearchDocTab) => {
    const effectiveTab = tab ?? (report.final_report ? "final" : "chart");
    lastOpenedDocTabById[report.id] = effectiveTab;
    setSelectedDocReport(report);
    setSelectedReportDate(report.d);
    setActiveDocTab(tab ?? undefined);

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

  // 후보군 종목을 문서 모드로 열기 (Free/체험만료는 과거 허용 리포트 우선)
  const handleOpenCandidateAsReport = useCallback((candidate: StockCandidate) => {
    const tickerUpper = candidate.ticker.toUpperCase();
    const sameTicker = guruReports.filter((r) => r.ticker.toUpperCase() === tickerUpper);
    const isRestrictedUser = tierRef.current === "free" && !isTrialActiveRef.current;
    const existing = isRestrictedUser
      ? sameTicker.find((r) => !isDateWithinDays(r.d)) || sameTicker[sameTicker.length - 1]
      : sameTicker[0];
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
    // 원문 없는 실시간 후보는 차트 탭이 기본. 이전 문서의 제어 탭이 잔류하지 않게 초기화
    lastOpenedDocTabById[fallback.id] = "chart";
    setActiveDocTab(undefined);

    router.push(`/stocks/${encodeURIComponent(candidate.ticker)}`);
  }, [guruReports, handleOpenReport, router]);

  // 탭 변경 시 URL 쿼리 파라미터 동기화 (?tab=...)
  const handleTabChange = useCallback((tab: ResearchDocTab) => {
    setActiveDocTab(tab);
    userSelectedTabRef.current = true;
    if (selectedDocReport) {
      lastOpenedDocTabById[selectedDocReport.id] = tab;
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

    // 1일 무료 체험 중이거나 Pro 회원은 제한 없이 날짜 변경 가능
    if (tierRef.current === "pro" || isTrialActiveRef.current) {
      // 통과
    } else if (
      tierRef.current === "free" &&
      isReportRestricted(
        targetDate,
        tierRef.current,
        new Date(),
        undefined,
        isTrialActiveRef.current
      )
    ) {
      if (!user) {
        openUpgradeModal(
          "로그인하면 24시간 동안 모든 최신 13인 거장 AI 리서치 보고서를 무료로 열람하실 수 있어요."
        );
      } else {
        openUpgradeModal(
          "1일 무료 체험이 종료되었어요. 매일 실시간으로 업데이트되는 13인 거장 AI 리포트를 계속 받아보시려면 Pro로 시작해보세요."
        );
      }
      return;
    }

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
  // 파이프라인/감사로그는 관리자 전용 — 비관리자는 홈으로 돌려보냄
  const handleSelectSidebarSection = (sec: SidebarSectionId) => {
    if ((sec === "sec-pipeline" || sec === "sec-audit") && !isAdminRef.current) {
      setActiveSidebarSection("all");
      setSelectedDocReport(null);
      setSelectedGuruSlug(null);
      setIsMobileMenuOpen(false);
      router.push("/");
      return;
    }
    setActiveSidebarSection(sec);
    setSelectedDocReport(null);
    setSelectedGuruSlug(null);
    setIsMobileMenuOpen(false);

    if (sec === "all") router.push("/");
    else if (sec === "sec-reports") router.push("/stocks");
    else if (sec === "sec-screener") router.push("/screener");
    else if (sec === "sec-roma") router.push("/screener?tab=roma");
    else if (sec === "sec-outcomes") router.push("/outcomes");
    else if (sec === "sec-gurus") router.push("/gurus");
    else if (sec === "sec-pipeline") router.push("/pipeline");
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

  // 상세 문서 서버-진실 동기화 (유일한 단건 조회 경로).
  // 목록 객체·SSR initialReport가 마스킹된 티저일 수 있으므로, 문서나 권한이
  // 바뀔 때마다 게이트웨이 응답을 그대로 진실로 반영합니다.
  // 서버가 권한별로 마스킹을 이미 적용하므로 업그레이드/다운그레이드 판정이
  // 불필요하고, 마지막 요청의 응답만 반영해 경합을 방지합니다.
  // (id가 같으면 effect가 재발동하지 않으므로 무한 루프 없음)
  const detailSeqRef = useRef(0);
  useEffect(() => {
    const current = selectedDocReport;
    if (!current || current.id.startsWith("live-")) return;
    const docId = current.id;
    const docDate = current.d;
    const docTicker = current.ticker;
    const seq = ++detailSeqRef.current;
    let cancelled = false;
    fetchReportByDateAndTicker(docDate, docTicker)
      .then((fetched) => {
        if (cancelled || !fetched || seq !== detailSeqRef.current) return;
        setSelectedDocReport((prev) =>
          prev && prev.id === fetched.id ? fetched : prev
        );
        // 메모리 핀으로 마스터 탭에 머물렀는데 원문 확정 후에도 볼 게 없으면 차트로 폴백.
        // 단, ?tab= 공유나 직접 클릭으로 정한 탭은 존중하고 로딩 실패(조회 불가)는 유지.
        if (
          !fetched.final_report &&
          !userSelectedTabRef.current &&
          !initialTab &&
          activeDocTab === "final"
        ) {
          setActiveDocTab(undefined);
        }
      })
      .catch((e) => console.warn("상세 리포트 동기화 실패:", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessKey, selectedDocReport?.id]);

  // 관리자 전용 URL(/pipeline, /admin) 직접 접근 차단 — 비관리자는 홈으로
  useEffect(() => {
    if (isAdminLoading) return;
    if (
      (activeSidebarSection === "sec-pipeline" || activeSidebarSection === "sec-audit") &&
      !isAdmin
    ) {
      setActiveSidebarSection("all");
      router.replace("/");
    }
  }, [activeSidebarSection, isAdmin, isAdminLoading, router]);

  // 관리자 판정이 늦게 확정되면(로그인 직후) 관리자 데이터를 뒤늦게 적재
  const didAdminBackfillRef = useRef(false);
  useEffect(() => {
    if (isAdminLoading || !isAdmin || didAdminBackfillRef.current) return;
    didAdminBackfillRef.current = true;
    void (async () => {
      try {
        const [logsRes, aiModelRes] = await Promise.all([
          withTimeout(fetchSystemLogs(60), []),
          withTimeout(fetchAiModelStatus(), null),
        ]);
        setSystemLogs(logsRes);
        if (aiModelRes) setAiModel(aiModelRes);
      } catch {
        // 관리자 백필 실패는 조용히 무시 (수동 새로고침으로 복구 가능)
      }
      refreshPipelineProgress();
    })();
  }, [isAdmin, isAdminLoading, refreshPipelineProgress]);

  // 페이지/섹션에 맞춘 타겟 데이터 로드 (필요한 데이터만 스마트 로딩)
  useEffect(() => {
    // 상세 페이지일 때는 무거운 스크리너들을 조회하지 않음
    if (initialTicker) return;
    // 구독 등급 확정 전 free 스냅샷으로 디폴트 일자를 잡으면 Pro 최신 리포트가 비어 보임
    if (isSubscriptionLoading) return;

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
    isSubscriptionLoading,
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
          isLoading={isLoading}
          onRefresh={() => loadDashboardData(true)}
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
                onPercentBUpdate={handlePercentBUpdate}
                onRefreshLive={() => loadLiveScreener(true)}
                onRefreshKr={() => loadKrScreener(true)}
                onRefreshRoma={() => loadRomaScreener(true)}
                onRefreshPipeline={refreshPipelineProgress}
                onRefreshLogs={handleRefreshLogs}
                onSelectReport={handleOpenReport}
                onSelectCandidate={handleOpenCandidateAsReport}
                isDashboardLoading={isLoading}
                activeSectionFilter={activeSidebarSection}
                onSelectSection={handleSelectSidebarSection}
                availableDates={availableCatalogDates}
                selectedDate={selectedCatalogDate}
                onSelectDate={handleUserSelectCatalogDate}
                isReportsLoading={isCatalogDateLoading}
                onOpenPipelineModal={() => {
                  if (isAdminRef.current) setIsPipelineModalOpen(true);
                }}
                isPipelineRunning={isPipelineRunning}
                onSelectGuru={handleOpenGuru}
                intrinsicStabilityMap={intrinsicStabilityByTicker}
                tickerNameMap={tickerNameMap}
                onSupplementTickerNames={handleSupplementTickerNames}
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
                        ? "bg-[#0f172a] border-[#0f172a] text-white font-semibold shadow-xs"
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
                        ? "bg-[#0f172a] border-[#0f172a] text-white font-semibold shadow-xs"
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
                        ? "bg-[#0f172a] border-[#0f172a] text-white font-semibold shadow-xs"
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
                <div className="p-2.5 rounded bg-[#f8fafc] border border-[#0f172a] text-[#0f172a] text-xs">
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

        {/* 4. 메타데이터 & 액션 푸터 */}
        <footer className="mt-auto py-5 border-t border-[#e2e8f0] px-6 lg:px-12 bg-[#fafafa] text-xs font-mono text-[#64748b]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* 좌측: 시장 개장 상태 뱃지 및 AI 모델 위젯 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 한/미 증시 개장 상태 뱃지 */}
              <div className="inline-flex items-center gap-2 border border-[#e2e8f0] bg-white px-2.5 py-1 rounded-md text-xs font-mono shadow-2xs">
                <div className="flex items-center gap-1.5" title={health?.kr_market_today?.status_text || "한국 증시"}>
                  <span className="text-[#64748b]">KR MKT:</span>
                  <span
                    className={`font-semibold ${
                      isKrMarketOpen ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {isKrMarketOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <span className="text-[#cbd5e1]">|</span>
                <div className="flex items-center gap-1.5" title={health?.us_market_today?.status_text || "미국 증시"}>
                  <span className="text-[#64748b]">US MKT:</span>
                  <span
                    className={`font-semibold ${
                      isUsMarketOpen ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {isUsMarketOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
              </div>

              {/* AI 모델 위젯 (관리자 전용) */}
              {isAdmin && (
                <AiModelWidget
                  aiModel={aiModel}
                  isResetting={isResettingModel}
                  onReset={handleResetAiModel}
                />
              )}
            </div>

            {/* 우측: 콘솔 정보 & 법적 고지 링크 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 text-[#94a3b8] text-[11px]">
              <div className="flex items-center gap-2">
                <Link
                  href="/privacy"
                  className="hover:text-[#0f172a] underline decoration-slate-300 transition-colors"
                >
                  개인정보처리방침
                </Link>
                <span>·</span>
                <Link
                  href="/terms"
                  className="hover:text-[#0f172a] underline decoration-slate-300 transition-colors"
                >
                  서비스 이용약관
                </Link>
              </div>
              <span className="hidden sm:inline">·</span>
              <span>Reportist Research Console</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
