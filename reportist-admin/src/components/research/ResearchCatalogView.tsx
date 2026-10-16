"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  GuruReportRow,
  StockCandidate,
  SystemLogItem,
  PipelineProgress,
} from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TallyBar, TallyCounts } from "@/components/ui/TallyBar";
import { PipelineProgressCard } from "@/components/tabs/PipelineProgressCard";
import { LogsTab } from "@/components/tabs/LogsTab";
import { SidebarSectionId } from "@/components/sidebar/ResearchSidebar";
import { OutcomesView } from "@/components/outcomes/OutcomesView";
import { GURU_PERSONAS, GuruPersona } from "@/lib/guruPersonas";
import { GuruDetailModal } from "@/components/research/GuruDetailModal";
import { StockListItem, StockItemInsight } from "@/components/research/StockListItem";
import {
  chartTickerKey,
  extractValuationConsensus,
  getVoteAgreementPercent,
  buildIntrinsicStability,
  getIntrinsicStabilityMeta,
  isValidChartTicker,
  parseSafetyPrice,
  IntrinsicStability,
} from "@/lib/insightUtils";
import {
  Search,
  Sparkles,
  Activity,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  RefreshCw,
  ArrowRight,
  Users,
  TrendingUp,
  Award,
  Calendar,
} from "lucide-react";
import { formatPriceByNation, formatMarketCap } from "@/lib/utils";
import { fetchTickerLogos, fetchTickerNames, fetchStockChart } from "@/lib/api-client";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { isReportRestricted, getDefaultReportDate } from "@/lib/subscription/subscriptionPolicy";
import { DataCache } from "@/lib/dataCache";
import { matchesTickerAlias } from "@/lib/tickerAliases";

const KR_STEP_5_INFO = {
  label: "5단계 (추천 알짜)",
  desc: "고수익·저부채 핵심 알짜 기업",
  mcap: "5,000억↑",
  debt: "80%↓",
  interest: "5.0배↑",
  op: "15%↑",
  roe: "15%↑",
};

// ── 종목 리스트 스켈레톤 (로딩 중 표시, StockListItem 행 모방) ──
function StockListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-[#f1f5f9] -my-2" aria-label="목록을 불러오는 중">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="py-3.5 px-3 -mx-3 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded bg-[#f1f5f9] animate-pulse shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
            <div className="h-3.5 w-2/3 rounded bg-[#f1f5f9] animate-pulse" />
            <div className="h-3 w-full rounded bg-[#f8fafc] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[#f8fafc] animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ResearchCatalogViewProps {
  guruReports: GuruReportRow[];
  liveCandidates: StockCandidate[];
  krCandidates?: StockCandidate[];
  romaCandidates: StockCandidate[];
  systemLogs: SystemLogItem[];
  pipelineProgress: PipelineProgress | null;
  isLoading: boolean;
  tickerNameMap?: Record<string, string>;
  isKrLoading?: boolean;
  isRomaLoading: boolean;
  krTightenStep?: number;
  percentBByTicker: Record<string, number | null>;
  /** 보이는 행의 %B 조회 결과를 부모 캐시에 반영하는 콜백 */
  onPercentBUpdate?: (next: Record<string, number | null>) => void;
  onRefreshLive: () => void;
  onRefreshKr?: (step?: number) => void;
  onRefreshRoma: () => void;
  onRefreshPipeline: () => void;
  onRefreshLogs: (level?: string) => void;
  onSelectReport: (report: GuruReportRow) => void;
  onSelectCandidate: (candidate: StockCandidate) => void;
  activeSectionFilter: SidebarSectionId;
  onSelectSection?: (sectionId: SidebarSectionId) => void;
  availableDates?: string[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isReportsLoading?: boolean;
  /** 대시보드 초기 로드 중 여부 (리포트 섹션 리스트 자리 스켈레톤용) */
  isDashboardLoading?: boolean;
  onSelectGuru?: (guruSlug: string) => void;
  intrinsicStabilityMap?: Map<string, IntrinsicStability>;
  onOpenPipelineModal?: () => void;
  isPipelineRunning?: boolean;
  /** 화면 표시분 한글명 보충 결과를 부모 캐시에 반영하는 콜백 */
  onSupplementTickerNames?: (names: Record<string, string>) => void;
}

export function ResearchCatalogView({
  guruReports,
  liveCandidates,
  krCandidates = [],
  romaCandidates,
  systemLogs,
  pipelineProgress,
  isLoading,
  tickerNameMap = {},
  isKrLoading = false,
  isRomaLoading,
  krTightenStep = 5,
  percentBByTicker,
  onRefreshLive,
  onRefreshKr,
  onRefreshRoma,
  onRefreshPipeline,
  onRefreshLogs,
  onSelectReport,
  onSelectCandidate,
  activeSectionFilter,
  onSelectSection,
  availableDates = [],
  selectedDate,
  onSelectDate,
  isReportsLoading = false,
  isDashboardLoading = false,
  onSelectGuru,
  intrinsicStabilityMap,
  onOpenPipelineModal,
  isPipelineRunning = false,
  onSupplementTickerNames,
  onPercentBUpdate,
}: ResearchCatalogViewProps) {
  const { tier, isTrialActive, isAdmin } = useSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [reportVerdictFilter, setReportVerdictFilter] = useState<string>("ALL");
  const [reportSortBy, setReportSortBy] = useState<
    "RATIO_DESC" | "SCORE_DESC" | "DATE_DESC" | "TICKER_ASC"
  >("RATIO_DESC");
  const [selectedGuruForModal, setSelectedGuruForModal] =
    useState<GuruPersona | null>(null);

  // 실시간 발굴 후보군 마켓(미국장 vs 한국장)
  const [candidateMarket, setCandidateMarket] = useState<"us" | "kr">("us");

  // ── %B 보이는 행만 지연 로딩 (정렬/필터 이후 화면 기준) ──
  // 부모 prop + 로컬 즉시 반영분을 합쳐 렌더. DataCache(5분 TTL)가 진실이며
  // once-loaded는 세션 유지, 만료 시에만 재조회한다.
  const [localPercentB, setLocalPercentB] = useState<Record<string, number | null>>({});
  const mergedPercentB = useMemo(
    () => ({ ...percentBByTicker, ...localPercentB }),
    [percentBByTicker, localPercentB]
  );
  const pbPendingRef = useRef<Set<string>>(new Set());
  const pbInflightRef = useRef(0);
  const pbQueueRef = useRef<string[]>([]);
  const onPercentBUpdateRef = useRef(onPercentBUpdate);
  useEffect(() => {
    onPercentBUpdateRef.current = onPercentBUpdate;
  }, [onPercentBUpdate]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- 동시 4개 수동 큐라 컴파일러 메모화로 대체 불가
  const pumpPbQueue = useCallback(() => {
    while (pbInflightRef.current < 4 && pbQueueRef.current.length > 0) {
      const key = pbQueueRef.current.shift()!;
      if (pbPendingRef.current.has(key)) continue;
      pbPendingRef.current.add(key);
      pbInflightRef.current += 1;
      void (async () => {
        try {
          if (!isValidChartTicker(key)) {
            DataCache.setPercentB(key, null);
          } else {
            const chart = await fetchStockChart(key, "6mo", "1d");
            DataCache.setPercentB(key, chart.summary?.percent_b ?? null);
          }
        } catch {
          DataCache.setPercentB(key, null);
        } finally {
          pbInflightRef.current -= 1;
          pbPendingRef.current.delete(key);
          const snap = DataCache.getAllPercentB();
          setLocalPercentB((prev) =>
            prev[key] === snap[key] ? prev : { ...prev, [key]: snap[key] ?? null }
          );
          onPercentBUpdateRef.current?.(snap);
          pumpPbQueue();
        }
      })();
    }
  }, []);

  const ensurePercentB = useCallback(
    (rawTicker: string) => {
      const key = chartTickerKey(rawTicker || "");
      if (!key) return;
      // 캐시 적중이면 로컬/부모로 승격만 (상세 헤더도 즉시 표시)
      const cached = DataCache.getPercentB(key);
      if (cached !== undefined) {
        const snap = DataCache.getAllPercentB();
        setLocalPercentB((prev) => {
          let changed = false;
          for (const k of Object.keys(snap)) {
            if (prev[k] !== snap[k]) {
              changed = true;
              break;
            }
          }
          return changed ? { ...prev, ...snap } : prev;
        });
        onPercentBUpdateRef.current?.(snap);
        return;
      }
      if (pbPendingRef.current.has(key) || pbQueueRef.current.includes(key)) return;
      pbQueueRef.current.push(key);
      pumpPbQueue();
    },
    [pumpPbQueue]
  );

  const pbObserverRef = useRef<IntersectionObserver | null>(null);
  const getPbObserver = useCallback(() => {
    if (pbObserverRef.current) return pbObserverRef.current;
    pbObserverRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const raw = el.getAttribute("data-pb-raw") || el.getAttribute("data-pb-ticker") || "";
          pbObserverRef.current?.unobserve(el);
          if (raw) {
            // data-pb-raw는 원 티커, 없으면 키를 그대로 사용
            ensurePercentB(raw);
          }
        }
      },
      { rootMargin: "300px 0px", threshold: 0.01 }
    );
    return pbObserverRef.current;
  }, [ensurePercentB]);

  useEffect(
    () => () => {
      pbObserverRef.current?.disconnect();
      pbObserverRef.current = null;
    },
    []
  );

  // 행 ref 콜백: 화면에 보이는 순간 ensurePercentB 발동
  const observePbRow = useCallback(
    (rawTicker: string, key: string) => (el: HTMLLIElement | null) => {
      if (!el) return;
      el.setAttribute("data-pb-raw", rawTicker);
      el.setAttribute("data-pb-ticker", key);
      // 이미 캐시에 있으면 조회 생략
      if (DataCache.getPercentB(key) !== undefined) return;
      getPbObserver().observe(el);
    },
    [getPbObserver]
  );

  const isAll = activeSectionFilter === "all";
  const isAdminSection =
    activeSectionFilter === "sec-pipeline" || activeSectionFilter === "sec-audit";

  // ── 권한별 열람 가능 리포트 필터 (02/03 리스트 인사이트용) ──
  // Free(체험 만료) 유저는 최근 30일 리포트 기반 인사이트를 리스트에 노출하지 않는다.
  // permittedReports = 과거(열람 허용) 리포트만. 최근 리포트만 있는 종목은
  // 인사이트 없음(잠금) 처리하여 데이터 정보가 표시되지 않게 한다.
  // 01 섹션의 날짜 게이팅(handleUserSelectCatalogDate)과 동일한 판정 기준을 사용한다.
  const isRestrictedUser = tier === "free" && !isTrialActive;
  const allowedFreeDate = useMemo(
    () => getDefaultReportDate(availableDates, "free"),
    [availableDates]
  );
  const permittedReports = useMemo(() => {
    if (!isRestrictedUser) return guruReports;
    return guruReports.filter(
      (r) => !isReportRestricted(r.d, tier, new Date(), allowedFreeDate, isTrialActive)
    );
  }, [guruReports, isRestrictedUser, tier, allowedFreeDate, isTrialActive]);

  // 티커별 최신 리포트 맵 (권한 필터 적용: Free는 과거 리포트 기준)
  const latestReportByTicker = useMemo(() => {
    const map = new Map<string, GuruReportRow>();
    for (const r of permittedReports) {
      const key = r.ticker.toUpperCase();
      if (!map.has(key)) map.set(key, r);
    }
    return map;
  }, [permittedReports]);

  // 후보군 맵 (로고 조회용 + 그림3과 동일한 한글명 폴백 소스)
  const candidateByTicker = useMemo(() => {
    const map = new Map<string, StockCandidate>();
    for (const c of liveCandidates) map.set(c.ticker.toUpperCase(), c);
    for (const c of krCandidates) {
      if (!map.has(c.ticker.toUpperCase())) map.set(c.ticker.toUpperCase(), c);
    }
    for (const c of romaCandidates) {
      if (!map.has(c.ticker.toUpperCase())) map.set(c.ticker.toUpperCase(), c);
    }
    return map;
  }, [liveCandidates, krCandidates, romaCandidates]);

  // 한글명 렌더링 규칙: 캐시 한글명 우선 -> 실시간 후보군명(한글, 그림3과 동일 소스) -> 원본 이름(영문) -> 티커 폴백
  // 그림1(리포트)은 DB 저장 company_name이 티커와 동일하게 적재된 행이 있어
  // tickerNameMap 미적중 시 "383220 383220"처럼 중복 표시되므로,
  // 같은 화면의 후보군(그림3 소스)을 폴백으로 먼저 사용한다.
  const displayNameOf = (ticker: string, fallback?: string | null): string => {
    const key = (ticker || "").trim().toUpperCase();
    const korean = tickerNameMap?.[key];
    if (korean) return korean;
    const candidateName = candidateByTicker.get(key)?.name?.trim();
    if (candidateName && candidateName.toUpperCase() !== key) return candidateName;
    const fb = (fallback || "").trim();
    if (fb && fb.toUpperCase() !== key) return fb;
    return key;
  };

  // 내재가치 안정성 맵 (부모 주입 우선, 없을 시 자체 리포트 기반 폴백)
  // 단, 제한 유저(Free/체험만료)는 부모 맵이 전 기간(최근 포함) 기준이므로 사용하지 않고
  // 과거 허용 리포트만으로 자체 계산한다. 최근 적정가 분산이 리스트에 새지 않게 하기 위함.
  const intrinsicStabilityByTicker = useMemo(() => {
    if (!isRestrictedUser && intrinsicStabilityMap && intrinsicStabilityMap.size > 0) {
      return intrinsicStabilityMap;
    }
    const fairValuesByTicker = new Map<string, number[]>();
    const sourceReports = isRestrictedUser ? permittedReports : guruReports;
    for (const report of sourceReports) {
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
  }, [intrinsicStabilityMap, guruReports, permittedReports, isRestrictedUser]);

  // 종목 인사이트 계산 헬퍼
  const getInsight = (ticker: string, stockPrice?: number | null) => {
    const report = latestReportByTicker.get(ticker.toUpperCase());
    const consensus = extractValuationConsensus(report);
    const fairValue = consensus?.fair_value_price ?? null;
    const confidenceSamples = (report?.summaries || [])
      .filter((s) => s.parse_mode !== "fallback")
      .map((s) => s.confidence)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const confidence =
      confidenceSamples.length > 0
        ? confidenceSamples.reduce((sum, v) => sum + v, 0) /
          confidenceSamples.length
        : null;
    const price = stockPrice || report?.current_price || null;
    const intrinsicRatioPct =
      fairValue != null && price != null && price > 0
        ? (fairValue / price) * 100
        : null;
    const safetyPriceValue =
      consensus?.safety_entry_value ??
      parseSafetyPrice(consensus?.safety_entry_price) ??
      parseSafetyPrice(report?.safety_entry);
    const safetyRatioPct =
      safetyPriceValue != null && price != null && price > 0
        ? (safetyPriceValue / price) * 100
        : null;
    const intrinsicStability =
      intrinsicStabilityByTicker.get(ticker.toUpperCase()) ||
      buildIntrinsicStability([]);
    const stabilityMeta = getIntrinsicStabilityMeta(intrinsicStability);

    return {
      report,
      verdict: report?.verdict ?? null,
      confidence,
      fairValue,
      price,
      intrinsicRatioPct,
      intrinsicStability,
      stabilityMeta,
      safetyPrice: consensus?.safety_entry_price ?? null,
      safetyPriceValue,
      safetyRatioPct,
      dispersionPct: consensus?.dispersion_pct ?? null,
      priceEstimateCount: consensus?.price_estimate_count ?? null,
      voteAgreementPct: getVoteAgreementPercent(report),
    };
  };

  // 1. 리포트 필터링 (날짜 & 검색 & 의견 + 권한)
  // 캐시/선행 로드로 제한 일자 리포트가 섞여 들어와도 리스트에 노출하지 않는다.
  const filteredReports = useMemo(() => {
    const list = permittedReports.filter((r) => {
      // 날짜 필터링 (선택된 날짜가 있고 "ALL"이 아닐 때)
      if (selectedDate && selectedDate !== "ALL" && r.d !== selectedDate) {
        return false;
      }

      const matchesSearch =
        !searchQuery.trim() ||
        r.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.company_name &&
          r.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tickerNameMap?.[r.ticker.toUpperCase()] &&
          tickerNameMap[r.ticker.toUpperCase()].toLowerCase().includes(searchQuery.toLowerCase())) ||
        matchesTickerAlias(searchQuery, r.ticker, r.company_name) ||
        (r.verdict &&
          r.verdict.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (reportVerdictFilter === "ALL") return true;
      const v = (r.verdict || "").toLowerCase();
      if (reportVerdictFilter === "BUY")
        return v.includes("매수") || v.includes("buy");
      if (reportVerdictFilter === "HOLD")
        return (
          v.includes("보유") || v.includes("관망") || v.includes("hold")
        );
      if (reportVerdictFilter === "SELL")
        return v.includes("매도") || v.includes("sell");
      return true;
    });

    // 종목 리스트 정렬 (내재가치/종가 가 높은 거 부터 디폴트 정렬)
    return list.slice().sort((a, b) => {
      if (reportSortBy === "RATIO_DESC") {
        const fairA = extractValuationConsensus(a)?.fair_value_price ?? 0;
        const priceA = a.current_price ?? 0;
        const ratioA = fairA > 0 && priceA > 0 ? (fairA / priceA) * 100 : -1;

        const fairB = extractValuationConsensus(b)?.fair_value_price ?? 0;
        const priceB = b.current_price ?? 0;
        const ratioB = fairB > 0 && priceB > 0 ? (fairB / priceB) * 100 : -1;

        if (ratioB !== ratioA) {
          return ratioB - ratioA; // 내재가치/종가 높은순
        }
        return (b.overall_score || 0) - (a.overall_score || 0);
      }

      if (reportSortBy === "SCORE_DESC") {
        return (b.overall_score || 0) - (a.overall_score || 0);
      }

      if (reportSortBy === "DATE_DESC") {
        return (b.d || "").localeCompare(a.d || "");
      }

      if (reportSortBy === "TICKER_ASC") {
        return a.ticker.localeCompare(b.ticker);
      }

      return 0;
    });
  }, [permittedReports, selectedDate, searchQuery, reportVerdictFilter, reportSortBy, tickerNameMap]);

  // 2. DataRoma 후보군 전체 필터링
  const filteredRoma = useMemo(() => {
    if (!searchQuery.trim()) return romaCandidates;
    const q = searchQuery.toLowerCase();
    return romaCandidates.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (tickerNameMap?.[c.ticker.toUpperCase()] &&
          tickerNameMap[c.ticker.toUpperCase()].toLowerCase().includes(q)) ||
        matchesTickerAlias(q, c.ticker, c.name)
    );
  }, [romaCandidates, searchQuery, tickerNameMap]);

  // 3. 실시간 후보군 전체 필터링 (미국장 / 한국장 분기)
  const activeCandidatesList = useMemo(() => {
    return candidateMarket === "us" ? liveCandidates : krCandidates;
  }, [candidateMarket, liveCandidates, krCandidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return activeCandidatesList;
    const q = searchQuery.toLowerCase();
    return activeCandidatesList.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (tickerNameMap?.[c.ticker.toUpperCase()] &&
          tickerNameMap[c.ticker.toUpperCase()].toLowerCase().includes(q)) ||
        matchesTickerAlias(q, c.ticker, c.name)
    );
  }, [activeCandidatesList, searchQuery, tickerNameMap]);

  // [리스트 수 조절] 전체 홈일 때는 10개만, 개별 메뉴 선택 시 전체 표시
  const displayedReports = isAll
    ? filteredReports.slice(0, 10)
    : filteredReports;
  const displayedRoma = isAll ? filteredRoma.slice(0, 10) : filteredRoma;
  const displayedCandidates = isAll
    ? filteredCandidates.slice(0, 10)
    : filteredCandidates;

  // 리포트 티커 로고 맵 (후보군 목록과 무관하게 배치 API로 직접 조회, 메모리 캐시 유지)
  const [logoMap, setLogoMap] = useState<Record<string, string>>(() =>
    DataCache.getAllTickerLogos()
  );
  // 세션 내 중복 조회 방지 (조회 실패분 포함, 마운트 유지)
  const requestedLogosRef = useRef<Set<string>>(new Set());
  // 화면 표시분 한글명 보충 (로고와 별도, 세션 내 중복 조회 방지)
  const requestedNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    // 화면 표시분이 아닌 필터 전체를 대상으로 조회 (홈 상위 10건 밖 티커도 커버)
    const missing = Array.from(
      new Set(
        filteredReports
          .map((r) => (r.ticker || "").trim().toUpperCase())
          .filter(
            (t) =>
              Boolean(t) &&
              !candidateByTicker.get(t)?.logo_image_url &&
              !DataCache.getTickerLogo(t) &&
              !requestedLogosRef.current.has(t)
          )
      )
    ).slice(0, 60);
    if (missing.length === 0) return;
    for (const t of missing) requestedLogosRef.current.add(t);

    const chunkSize = 30; // 백엔드 배치 상한과 동일
    void (async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < missing.length; i += chunkSize) {
        chunks.push(missing.slice(i, i + chunkSize));
      }
      // 청크 병렬 조회 (백엔드 세마포어가 Toss 동시 호출 상한)
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          if (cancelled) return null;
          try {
            return await fetchTickerLogos(chunk, chunkSize);
          } catch (err) {
            console.warn("리포트 로고 일괄 조회 실패:", err);
            return null;
          }
        })
      );
      if (cancelled) return;
      const found: Record<string, string> = {};
      for (const res of results) {
        for (const item of res?.items || []) {
          const url = (item.logo_image_url || "").trim();
          if (url && /^https?:\/\//i.test(url)) {
            const key = (item.ticker || "").trim().toUpperCase();
            DataCache.setTickerLogo(key, url);
            found[key] = url;
          }
        }
      }
      if (Object.keys(found).length > 0) {
        setLogoMap((prev) => ({ ...prev, ...found }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredReports, candidateByTicker]);

  // 그림1 리포트 한글명 보충: tickerNameMap/후보군에도 없는 화면 표시분만
  // /api/screener/names 배치 조회로 채워 부모 캐시(tickerNameMap)에 반영한다.
  // 예: "383220"처럼 DB company_name=티커로 적재된 국장 행.
  useEffect(() => {
    if (!onSupplementTickerNames) return;
    let cancelled = false;
    const missing = Array.from(
      new Set(
        filteredReports
          .map((r) => (r.ticker || "").trim().toUpperCase())
          .filter((t) => {
            if (!t || requestedNamesRef.current.has(t)) return false;
            if (tickerNameMap?.[t]) return false;
            const candidateName = candidateByTicker.get(t)?.name?.trim();
            if (candidateName && candidateName.toUpperCase() !== t) return false;
            return true;
          })
      )
    ).slice(0, 30);
    if (missing.length === 0) return;
    for (const t of missing) requestedNamesRef.current.add(t);

    void (async () => {
      try {
        const res = await fetchTickerNames(missing, missing.length);
        if (cancelled) return;
        const found: Record<string, string> = {};
        for (const item of res?.items || []) {
          const name = (item.korean_name || "").trim();
          if (!name) continue;
          const key = (item.ticker || "").trim().toUpperCase();
          if (key && name.toUpperCase() !== key) found[key] = name;
        }
        if (Object.keys(found).length > 0) onSupplementTickerNames(found);
      } catch (err) {
        console.warn("리포트 한글명 일괄 조회 실패:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredReports, candidateByTicker, tickerNameMap, onSupplementTickerNames]);

  // 전체 리포트 대상 종합 표결 탈리 집계 (권한 필터 적용)
  const aggregateTally = useMemo<TallyCounts>(() => {
    const counts: TallyCounts = { buy: 0, hold: 0, watch: 0, sell: 0 };
    for (const r of permittedReports) {
      const v = (r.verdict || "").toLowerCase();
      if (v.includes("매수") || v.includes("buy")) counts.buy += 1;
      else if (v.includes("매도") || v.includes("sell")) counts.sell += 1;
      else if (v.includes("관망") || v.includes("watch")) counts.watch += 1;
      else counts.hold += 1;
    }
    return counts;
  }, [permittedReports]);

  // 내재가치 저평가 기회 상위 3종목 (괴리율 Top 3, 권한 필터 적용)
  const topDiscountOpportunities = useMemo(() => {
    return permittedReports
      .map((r) => {
        const insight = getInsight(r.ticker, r.current_price);
        return {
          report: r,
          ticker: r.ticker,
          companyName: displayNameOf(r.ticker, r.company_name),
          fairValue: insight.fairValue,
          currentPrice: insight.price,
          ratio: insight.intrinsicRatioPct,
        };
      })
      .filter(
        (item): item is typeof item & { ratio: number } =>
          item.ratio != null && item.ratio > 100
      )
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3);
  }, [permittedReports]);

  const isVisible = (secId: string) => {
    if (activeSectionFilter === "all") return true;
    return activeSectionFilter === secId;
  };

  // 로고 렌더러 (원색 표시)
  const renderLogo = (ticker: string, candidateLogo?: string | null) => {
    const key = ticker.toUpperCase();
    const logoUrl =
      candidateLogo ||
      candidateByTicker.get(key)?.logo_image_url ||
      logoMap[key];

    if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={ticker}
          className="w-10 h-10 rounded object-contain border border-[#e2e8f0] p-0.5 bg-white shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }

    return (
      <div className="w-10 h-10 rounded bg-[#0f172a] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
        {ticker.slice(0, 3)}
      </div>
    );
  };

  // getInsight 결과를 StockListItem용 insight로 변환
  const toItemInsight = (raw: ReturnType<typeof getInsight>): StockItemInsight => ({
    verdict: raw.verdict,
    confidence: raw.confidence,
    fairValue: raw.fairValue,
    intrinsicRatioPct: raw.intrinsicRatioPct,
    safetyRatioPct: raw.safetyRatioPct,
    intrinsicStability: raw.intrinsicStability,
    fairValueDeferred: !!raw.report && raw.fairValue == null,
    dispersionPct: raw.dispersionPct,
    priceEstimateCount: raw.priceEstimateCount,
    voteAgreementPct: raw.voteAgreementPct,
    safetyPrice: raw.safetyPrice,
  });

  return (
    <div className="flex-1 min-w-0 bg-white font-sans divide-y divide-[#e2e8f0]">
      {/* ── 관리자 전용 섹션 직접 접근 차단 (클라이언트 게이팅 — API는 별도 403) ── */}
      {isAdminSection && !isAdmin && (
        <section className="px-6 lg:px-12 py-16">
          <div className="max-w-md mx-auto p-6 rounded-md border border-[#e2e8f0] bg-[#f8fafc] text-center space-y-3">
            <div className="font-mono text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              Admin Only
            </div>
            <h1 className="text-lg font-bold text-[#0f172a]">
              관리자 전용 화면이에요
            </h1>
            <p className="text-xs text-[#64748b] leading-relaxed">
              파이프라인과 감사 로그는 관리자 계정으로 로그인해야 볼 수 있어요.
              관리자 계정으로 로그인한 뒤 다시 시도해 주세요.
            </p>
            <button
              onClick={() => onSelectSection?.("all")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#0f172a] text-white text-xs font-mono font-medium hover:bg-slate-800 transition-colors cursor-pointer"
            >
              카탈로그 홈으로 돌아가기
            </button>
          </div>
        </section>
      )}
      {/* ── 1. HERO SECTION (전체 보기일 때 표시) 또는 섹션 브레드크럼 바 ── */}
      {isAll ? (
        <section
          id="hero"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-gradient-to-b from-[#ffffff] via-[#fafafa] to-white"
        >
          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#e2e8f0] bg-white font-mono text-xs text-[#64748b]">
              <Sparkles className="w-3.5 h-3.5 text-[#0f172a]" />
              <span>AI VALUE INVESTING RESEARCH SYSTEM</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-[40px] font-bold text-[#0f172a] tracking-tight leading-[1.15]">
              13인 투자 거장의 AI 가치평가 및 미국 주식 리포트 아카이브
            </h1>

            <p className="text-sm sm:text-base text-[#64748b] leading-relaxed max-w-3xl">
              단순한 주가 시세판이 아닌, 13인 투자 거장의 원전 철학으로 분석한 미국 주식 리포트와 내재가치
              합의를 정제된 문서로 제공합니다. 보고서를 클릭하면 즉시
              심층 리서치 브리프로 전환되어 적정주가 표결과 전문 가치평가 내역을 열람할 수 있습니다.
            </p>

            {/* 메타데이터 요약 DL */}
            <dl className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-[#64748b]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a]">
                  {permittedReports.length}
                </span>
                <span>REPORTS ISSUED</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a]">
                  {romaCandidates.length}
                </span>
                <span>SUPERINVESTOR STOCKS</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a]">
                  {liveCandidates.length}
                </span>
                <span>DISCOVERY CANDIDATES</span>
              </div>
            </dl>

            {/* 빠른 검색창 */}
            <div className="pt-3 max-w-xl">
              <div className="relative">
                <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tickers (e.g. AAPL, NVDA), company names, or verdicts... [ / ]"
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] shadow-xs text-[#0f172a] placeholder-[#94a3b8]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8] hover:text-[#0f172a]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="px-6 lg:px-12 py-5 bg-[#fafafa] border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-mono text-xs text-[#64748b]">
              <button
                onClick={() => onSelectSection?.("all")}
                className="inline-flex items-center gap-1 text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-slate-200/60"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>카탈로그 홈</span>
              </button>
              <span className="text-[#cbd5e1]">/</span>
              <span className="text-[#0f172a] font-semibold">
                {activeSectionFilter === "sec-reports" &&
                  "01. 가치평가 및 거장 리포트"}
                {activeSectionFilter === "sec-roma" &&
                  "02. 슈퍼인베스터 포트폴리오 (DataRoma)"}
                {activeSectionFilter === "sec-screener" &&
                  "03. 실시간 발굴 후보군"}
                {activeSectionFilter === "sec-pipeline" &&
                  "04. 파이프라인"}
                {activeSectionFilter === "sec-audit" &&
                  "05. 감사 로그"}
                {activeSectionFilter === "sec-gurus" &&
                  "06. 13인 투자 거장 철학"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              {activeSectionFilter === "sec-reports" &&
                "가치평가 및 거장 리포트 전체 아카이브"}
              {activeSectionFilter === "sec-roma" &&
                "슈퍼인베스터 포트폴리오 (DataRoma) 전체"}
              {activeSectionFilter === "sec-screener" &&
                "실시간 발굴 후보군 전체"}
              {activeSectionFilter === "sec-pipeline" &&
                "파이프라인 모니터"}
              {activeSectionFilter === "sec-audit" &&
                "감사 로그 모니터"}
              {activeSectionFilter === "sec-gurus" &&
                "13인 투자 거장 철학 및 밸류에이션 가이드"}
            </h1>
          </div>

          <div className="w-full sm:w-80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색... (티커, 종목명)"
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] shadow-xs text-[#0f172a] placeholder-[#94a3b8]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── [거장 인사이트 & 탈리 요약 배너] (전체 홈 또는 리포트 뷰일 때 표시) ── */}
      {(isAll || activeSectionFilter === "sec-reports") &&
        (guruReports.length > 0 ? (
          <section className="px-6 lg:px-12 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-xs">
              {/* 1. 전체 표결 탈리 바 */}
              <div className="p-4 rounded-md bg-white border border-[#e2e8f0] space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#0f172a]" />
                    <span>13 GURU ROUND-TABLE TALLY</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#64748b]">
                      분석 종목 {guruReports.length}건 종합
                    </span>
                  </div>
                </div>
                <TallyBar tally={aggregateTally} size="sm" />
              </div>

              {/* 2. 최고 저평가 기회 종목 Top 3 */}
              <div className="p-4 rounded-md bg-white border border-[#e2e8f0] space-y-2 shadow-xs">
                <span className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#0f172a]" />
                  <span>TOP VALUE DISCOUNTS</span>
                </span>
                {topDiscountOpportunities.length === 0 ? (
                  <p className="text-[#64748b] text-[11px] pt-1">
                    현재 적정가 대비 100% 초과 저평가 종목 산출 중
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-0.5">
                    {topDiscountOpportunities.map((item) => (
                      <div
                        key={item.ticker}
                        onClick={() => onSelectReport(item.report)}
                        className="flex items-center justify-between hover:bg-[#f8fafc] p-1 rounded cursor-pointer transition-colors"
                      >
                        <span className="font-bold text-[#0f172a]">
                          {item.ticker}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#64748b] text-[11px]">
                            {formatPriceByNation(item.currentPrice, undefined, item.ticker)} →{" "}
                            {formatPriceByNation(item.fairValue, undefined, item.ticker)}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-bold text-[10px]">
                            +{Math.round(item.ratio - 100)}% 괴리
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. 13인 거장 철학 가이드 바로가기 */}
              <div className="p-4 rounded-md bg-white border border-[#e2e8f0] flex flex-col justify-between space-y-2 shadow-xs">
                <div>
                  <span className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#0f172a]" />
                    <span>13 GURU METHODOLOGIES</span>
                  </span>
                  <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">
                    버핏(해자·ROE), 그레이엄(안전마진), 린치(PEG), 다모다란(DCF)
                    등 13인의 독자적 심사 기준.
                  </p>
                </div>
                <button
                  onClick={() => onSelectSection?.("sec-gurus")}
                  className="inline-flex items-center justify-between w-full pt-1.5 text-xs text-[#0f172a] font-semibold hover:underline cursor-pointer group"
                >
                  <span>거장별 심사 가이드 열람</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </section>
        ) : isDashboardLoading || isReportsLoading ? (
          <section
            aria-label="요약 정보를 불러오는 중"
            className="px-6 lg:px-12 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-md bg-white border border-[#e2e8f0] space-y-2.5 shadow-xs"
                >
                  <div className="h-3.5 w-1/2 rounded bg-[#f1f5f9] animate-pulse" />
                  <div className="h-3 w-full rounded bg-[#f8fafc] animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-[#f8fafc] animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        ) : null)}

      {/* ── 2. SECTION 01: 가치평가 및 거장 심층 분석 보고서 전체 (1+2 통합) ── */}
      {isVisible("sec-reports") && (
        <section
          id="sec-reports"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측: 타이틀 & 설명 & 날짜선택 & 필터 */}
            <div className="space-y-4 md:sticky md:top-[72px] md:self-start">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  01
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  가치평가 및 거장 리서치 보고서
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                13인 거장의 독립 표결과 종합 적정 내재가치, 안전마진 밴드를 도출한
                분석 보고서입니다. {isAll && `(홈에서는 상위 10건만 요약 표시)`}
              </p>

              {/* 1. 분석 일자 선택 (날짜별 선택, 디폴트: 최신 작성 일자) */}
              {availableDates && availableDates.length > 0 && (() => {
                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-[#94a3b8] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#0f172a]" />
                        <span>Report Date (분석 일자)</span>
                      </span>
                      {selectedDate && selectedDate !== "ALL" && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            isReportRestricted(selectedDate, tier, new Date(), allowedFreeDate, isTrialActive)
                              ? "bg-[#0f172a] text-white border-[#0f172a]"
                              : tier === "free" && !isTrialActive
                              ? "bg-[#f8fafc] text-[#0f172a] border-[#cbd5e1]"
                              : "bg-[#0f172a] text-white border-[#0f172a]"
                          }`}
                        >
                          {selectedDate === availableDates[0]
                            ? isTrialActive
                              ? "★ 최신 분석 (24H TRIAL)"
                              : "★ 최신 분석일"
                            : tier === "free" && !isTrialActive
                            ? "FREE 아카이브 (과거)"
                            : "선택 일자"}
                        </span>
                      )}
                    </div>

                  {/* 일자 선택 셀렉트 박스 */}
                  <div className="relative">
                    <select
                      value={selectedDate || availableDates[0]}
                      onChange={(e) => onSelectDate?.(e.target.value)}
                      className="w-full pl-3 pr-8 py-1.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded text-[#0f172a] focus:outline-hidden focus:border-[#0f172a] cursor-pointer shadow-2xs"
                    >
                      {availableDates.map((d, idx) => {
                        const restricted = isReportRestricted(d, tier, new Date(), allowedFreeDate, isTrialActive);
                        return (
                          <option key={d} value={d}>
                            {d} {idx === 0 ? "★ (최신 분석)" : ""} {restricted ? "[PRO]" : ""}
                          </option>
                        );
                      })}
                      <option value="ALL">
                        전체 일자 (최근 200건 통합) {tier === "free" && !isTrialActive ? "[PRO]" : ""}
                      </option>
                    </select>
                  </div>

                  {/* 빠른 날짜 선택 칩 (최근 3~4개 일자) */}
                  <div className="flex items-center gap-1 font-mono text-[11px] overflow-x-auto whitespace-nowrap scrollbar-none pt-0.5">
                    {availableDates.slice(0, 4).map((d, idx) => {
                      const isSelected =
                        selectedDate === d || (!selectedDate && idx === 0);
                      const restricted = isReportRestricted(d, tier, new Date(), allowedFreeDate, isTrialActive);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => onSelectDate?.(d)}
                          className={`shrink-0 px-2 py-0.5 rounded border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                            isSelected
                              ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                              : restricted
                              ? "bg-slate-100 text-[#0f172a] border-[#cbd5e1] hover:bg-slate-200"
                              : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a]"
                          }`}
                        >
                          {restricted && <span className="text-[9px] text-[#64748b] font-mono">[PRO]</span>}
                          <span>{d}</span>
                          {idx === 0 && (
                            <span className="text-[9px] font-bold text-[#0f172a]">★</span>
                          )}
                        </button>
                      );
                    })}
                    {availableDates.length > 4 && (
                      <button
                        type="button"
                        onClick={() => onSelectDate?.("ALL")}
                        className={`shrink-0 px-2 py-0.5 rounded border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          selectedDate === "ALL"
                            ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                            : tier === "free" && !isTrialActive
                            ? "bg-slate-100 text-[#0f172a] border-[#cbd5e1] hover:bg-slate-200"
                            : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a]"
                        }`}
                      >
                        {tier === "free" && !isTrialActive && <span className="text-[9px] text-[#64748b] font-mono">[PRO]</span>}
                        <span>전체</span>
                      </button>
                    )}
                  </div>
                </div>
              ); })()}

              {/* 투자의견 빠른 필터 칩 (줄바꿈 방지) */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-mono uppercase text-[#94a3b8] block">
                  Filter by Verdict
                </span>
                <div className="flex items-center gap-1 font-mono text-xs overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
                  {[
                    { id: "ALL", label: `전체 (${guruReports.length})` },
                    { id: "BUY", label: "매수 합의" },
                    { id: "HOLD", label: "보유·관망" },
                    { id: "SELL", label: "매도" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setReportVerdictFilter(chip.id)}
                      className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                        reportVerdictFilter === chip.id
                          ? "bg-[#0f172a] text-white border-[#0f172a]"
                          : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a]"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 우측: 보고서 리스트 */}
            <div className="min-w-0 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0] font-mono text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#0f172a]">
                    분석 기준일: {selectedDate || availableDates[0] || "최신"}
                  </span>
                  <span className="text-[#64748b]">
                    (총 {displayedReports.length}건
                    {isAll && filteredReports.length > 10 ? " 중 상위 10건" : ""}
                    )
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isReportsLoading && (
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-[#0f172a]" />
                      <span>조회 중...</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[#94a3b8] uppercase">정렬:</span>
                    <select
                      value={reportSortBy}
                      onChange={(e) =>
                        setReportSortBy(
                          e.target.value as
                            | "RATIO_DESC"
                            | "SCORE_DESC"
                            | "DATE_DESC"
                            | "TICKER_ASC"
                        )
                      }
                      className="bg-white border border-[#cbd5e1] rounded px-2 py-0.5 text-xs font-mono text-[#0f172a] focus:outline-hidden cursor-pointer shadow-2xs"
                    >
                      <option value="RATIO_DESC">내재가치/종가 높은순 (기본)</option>
                      <option value="SCORE_DESC">거장 종합점수순</option>
                      <option value="DATE_DESC">최신 분석일순</option>
                      <option value="TICKER_ASC">티커 알파벳순</option>
                    </select>
                  </div>
                </div>
              </div>
              {(isReportsLoading || isDashboardLoading) &&
              displayedReports.length === 0 ? (
                <StockListSkeleton rows={isAll ? 5 : 8} />
              ) : displayedReports.length === 0 ? (
                <EmptyState
                  icon="📄"
                  title="해당 조건의 분석 보고서가 없습니다"
                  description="검색어나 필터를 변경하거나 상단 파이프라인 버튼으로 보고서를 생성하세요."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {displayedReports.map((report) => {
                    const insight = getInsight(
                      report.ticker,
                      report.current_price
                    );
                    const ticker = report.ticker;
                    const pbKey = chartTickerKey(ticker);
                    const percentB = mergedPercentB[pbKey];

                    return (
                      <StockListItem
                        key={report.id || ticker}
                        ticker={ticker}
                        companyName={displayNameOf(ticker, report.company_name)}
                        logo={renderLogo(ticker)}
                        insight={toItemInsight(insight)}
                        percentB={percentB}
                        rowRef={observePbRow(ticker, pbKey)}
                        rowKey={pbKey}
                        onClick={() => onSelectReport(report)}
                        badges={
                          <span className="text-[11px] text-[#64748b] ml-auto sm:ml-0 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#94a3b8]" />
                            <span>{report.d}</span>
                          </span>
                        }
                        summary={
                          (report.vote_summary || "13인 표결 요약") +
                          (insight.safetyPrice
                            ? ` · 안전마진 매수가: ${insight.safetyPrice}`
                            : "")
                        }
                      />
                    );
                  })}
                </ul>
              )}

              {/* [리스트 수 조절] 전체 홈에서 10개 초과 시 전체 보기 링크 */}
              {isAll && filteredReports.length > 10 && (
                <div className="pt-2 border-t border-[#f1f5f9] flex justify-end">
                  <button
                    onClick={() => onSelectSection?.("sec-reports")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-xs font-mono font-medium text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                  >
                    <span>
                      전체 가치평가 리포트 보기 ({filteredReports.length}건)
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. SECTION 02: 슈퍼인베스터 포트폴리오 (DataRoma) ── */}
      {isVisible("sec-roma") && (
        <section
          id="sec-roma"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-4 md:sticky md:top-[72px] md:self-start">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  02
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  슈퍼인베스터 포트폴리오
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                미국 탑 슈퍼인베스터 10명 이상이 동시 보유하고 있는 DataRoma 그랜드
                포트폴리오 종목 브리프입니다.{" "}
                {isAll && `(홈에서는 상위 10개만 요약 표시)`}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshRoma}
                isLoading={isRomaLoading}
                leftIcon={<RefreshCw className="w-3 h-3 text-[#64748b]" />}
                className="font-mono text-xs"
              >
                DataRoma 피드 갱신
              </Button>
            </div>

            {/* 우측: DataRoma 종목 리스트 */}
            <div className="min-w-0 space-y-4">
              {isRomaLoading && displayedRoma.length === 0 ? (
                <StockListSkeleton rows={isAll ? 5 : 8} />
              ) : displayedRoma.length === 0 ? (
                <EmptyState
                  icon="🏛️"
                  title="DataRoma 슈퍼인베스터 데이터가 없습니다"
                  description="좌측 'DataRoma 피드 갱신' 버튼을 누르면 그랜드 포트폴리오를 불러옵니다."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {displayedRoma.map((c, idx) => {
                    const insight = getInsight(c.ticker, c.price);
                    const pbKey = chartTickerKey(c.ticker);
                    const percentB = mergedPercentB[pbKey];
                    const isInsightLocked = isRestrictedUser && !insight.report;

                    return (
                      <StockListItem
                        key={`roma-${c.ticker}-${idx}`}
                        ticker={c.ticker}
                        companyName={displayNameOf(c.ticker, c.name)}
                        logo={renderLogo(c.ticker, c.logo_image_url)}
                        insight={toItemInsight(insight)}
                        isLocked={isInsightLocked}
                        percentB={percentB}
                        rowRef={observePbRow(c.ticker, pbKey)}
                        rowKey={pbKey}
                        onClick={() => onSelectCandidate(c)}
                        priceText={formatPriceByNation(c.price, undefined, c.ticker)}
                        badges={
                          <>
                            {c.holders != null && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#cbd5e1] bg-white text-[#0f172a] font-semibold">
                                {c.holders}인 보유
                              </span>
                            )}
                            {c.weight_pct != null && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
                                비중: {c.weight_pct.toFixed(2)}%
                              </span>
                            )}
                          </>
                        }
                        extraMetrics={
                          c.roe != null ? (
                            <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#64748b] font-mono text-[11px]">
                              ROE: {(c.roe * 100).toFixed(1)}%
                            </span>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </ul>
              )}

              {/* [리스트 수 조절] 전체 홈에서 10개 초과 시 전체 보기 링크 */}
              {isAll && filteredRoma.length > 10 && (
                <div className="pt-2 border-t border-[#f1f5f9] flex justify-end">
                  <button
                    onClick={() => onSelectSection?.("sec-roma")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-xs font-mono font-medium text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                  >
                    <span>
                      전체 슈퍼인베스터 포트폴리오 보기 ({filteredRoma.length}개)
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. SECTION 03: 실시간 발굴 후보군 ── */}
      {isVisible("sec-screener") && (
        <section
          id="sec-screener"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-4 md:sticky md:top-[72px] md:self-start">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  03
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  실시간 발굴 후보군
                </h2>
              </div>

              {/* 마켓 전환 탭: 미국장 (13인 종합) vs 한국장 (공통 + 조건강화) */}
              <div className="flex items-center gap-1.5 p-1 bg-[#f1f5f9] rounded-lg font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setCandidateMarket("us")}
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                    candidateMarket === "us"
                      ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <span>🇺🇸 미국장</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#e2e8f0] text-[#334155]">
                    {liveCandidates.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateMarket("kr")}
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                    candidateMarket === "kr"
                      ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <span>🇰🇷 한국장</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#e2e8f0] text-[#334155]">
                    {krCandidates.length}
                  </span>
                </button>
              </div>

              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                {candidateMarket === "us"
                  ? "13인 거장 스크리닝 조건을 충족하여 분석 파이프라인 진입 대기 중인 후보 종목 브리프입니다."
                  : "단일 공통 재무 기준을 통과한 한국 핵심 알짜(5단계) 기업 발굴 목록입니다."}
                {" "}
                {isAll && `(홈에서는 상위 10개만 요약 표시)`}
              </p>

              {/* 한국장 전용: 5단계 고정 핵심 알짜 정보 카드 */}
              {candidateMarket === "kr" && (
                <div className="p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-2.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0f172a] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#3182f6]" />
                      <span>한국장 우량주 필터</span>
                    </span>
                    <span className="text-[11px] text-[#3182f6] font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      5단계 고정 (알짜)
                    </span>
                  </div>

                  <div className="text-[11px] bg-white p-2.5 rounded-lg border border-[#e2e8f0] text-[#475569] space-y-1.5">
                    <div className="text-[#0f172a] font-semibold flex items-center justify-between">
                      <span>{KR_STEP_5_INFO.desc}</span>
                      <span className="text-[#3182f6] font-bold">
                        {krCandidates.length}개 포착
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-[#64748b] pt-1 border-t border-[#f1f5f9]">
                      <span>시총: {KR_STEP_5_INFO.mcap}</span>
                      <span>부채비율: {KR_STEP_5_INFO.debt}</span>
                      <span>이자보상: {KR_STEP_5_INFO.interest}</span>
                      <span>영업익률: {KR_STEP_5_INFO.op}</span>
                      <span className="col-span-2">ROE: {KR_STEP_5_INFO.roe}</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (candidateMarket === "us") {
                    onRefreshLive();
                  } else {
                    onRefreshKr?.(5);
                  }
                }}
                isLoading={candidateMarket === "us" ? isLoading : isKrLoading}
                leftIcon={<RefreshCw className="w-3 h-3 text-[#64748b]" />}
                className="font-mono text-xs w-full"
              >
                {candidateMarket === "us" ? "미국장 스크리너 갱신" : "한국장 스크리너 갱신 (5단계)"}
              </Button>
            </div>

            {/* 우측: 후보군 종목 리스트 */}
            <div className="min-w-0 space-y-4">
              {(candidateMarket === "us" ? isLoading : isKrLoading) &&
              displayedCandidates.length === 0 ? (
                <StockListSkeleton rows={isAll ? 5 : 8} />
              ) : displayedCandidates.length === 0 ? (
                <EmptyState
                  icon="🧭"
                  title="포착된 스크리닝 후보군이 없습니다"
                  description={
                    candidateMarket === "us"
                      ? "'미국장 스크리너 갱신' 버튼을 눌러 실시간 스크리닝을 수행하세요."
                      : "'한국장 스크리너 갱신' 버튼을 눌러 5단계 우량주를 조회하세요."
                  }
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {displayedCandidates.map((c, idx) => {
                    const insight = getInsight(c.ticker, c.price);
                    const pbKey = chartTickerKey(c.ticker);
                    const percentB = mergedPercentB[pbKey];
                    const isKr = c.nation === "kr" || candidateMarket === "kr";
                    const isInsightLocked = isRestrictedUser && !insight.report;

                    return (
                      <StockListItem
                        key={`candidate-${c.ticker}-${idx}`}
                        ticker={c.ticker}
                        companyName={displayNameOf(c.ticker, c.name)}
                        logo={renderLogo(c.ticker, c.logo_image_url)}
                        insight={toItemInsight(insight)}
                        isLocked={isInsightLocked}
                        percentB={percentB}
                        rowRef={observePbRow(c.ticker, pbKey)}
                        rowKey={pbKey}
                        onClick={() => onSelectCandidate(c)}
                        rankPrefix={`#${c.rank || idx + 1}`}
                        priceText={formatPriceByNation(c.price, c.nation || candidateMarket, c.ticker)}
                        changeRate={c.change_rate}
                        marketCapText={
                          c.market_cap != null
                            ? formatMarketCap(c.market_cap, c.nation || candidateMarket, c.ticker)
                            : undefined
                        }
                        badges={
                          <>
                            {c.category && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                                {c.category}
                              </span>
                            )}
                            <Badge
                              variant="primary"
                              className="font-mono text-[10px]"
                            >
                              {isKr
                                ? "알짜 5단계"
                                : `SCORE: ${c.guru_score || 0}`}
                            </Badge>
                          </>
                        }
                        extraMetrics={
                          <>
                            {c.roe != null && (
                              <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#64748b] font-mono text-[11px]">
                                ROE: {(c.roe * 100).toFixed(1)}%
                              </span>
                            )}
                            {c.operating_margin != null && (
                              <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#64748b] font-mono text-[11px]">
                                영업익: {(c.operating_margin * 100).toFixed(1)}%
                              </span>
                            )}
                            {c.debt_ratio != null && (
                              <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#64748b] font-mono text-[11px]">
                                부채: {(c.debt_ratio * 100).toFixed(0)}%
                              </span>
                            )}
                          </>
                        }
                      />
                    );
                  })}
                </ul>
              )}

              {/* [리스트 수 조절] 전체 홈에서 10개 초과 시 전체 보기 링크 */}
              {isAll && filteredCandidates.length > 10 && (
                <div className="pt-2 border-t border-[#f1f5f9] flex justify-end">
                  <button
                    onClick={() => onSelectSection?.("sec-screener")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-xs font-mono font-medium text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                  >
                    <span>
                      전체 실시간 발굴 후보군 보기 (
                      {filteredCandidates.length}개)
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. SECTION 04: 성과 및 거장 적중률 (Track Record) ── */}
      {isVisible("sec-outcomes") && (
        <section
          id="sec-outcomes"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <OutcomesView
            isAdmin={isAdmin}
            onSelectReport={(_id, ticker, date) => {
              const found =
                guruReports.find((r) => r.ticker === ticker && r.d === date) ||
                guruReports.find((r) => r.ticker === ticker);
              if (found) {
                onSelectReport(found);
              }
            }}
          />
        </section>
      )}

      {/* ── 5. SECTION 05: 13인 투자 거장 철학 & 심층 가이드 (my/financial 연동) ── */}
      {isVisible("sec-gurus") && (
        <section
          id="sec-gurus"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="space-y-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                05
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                13인 투자 거장 철학 및 밸류에이션 가이드
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
              Reportist 리서치 파이프라인에서 실제 독립 평가를 수행하는 13인 투자
              거장의 고유한 심사 철학, 체크리스트 및 핵심 정량 지표 기준입니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 font-sans">
              {Object.values(GURU_PERSONAS).map((guru) => (
                <div
                  key={guru.slug}
                  onClick={() => {
                    if (onSelectGuru) {
                      onSelectGuru(guru.slug);
                    } else {
                      setSelectedGuruForModal(guru);
                    }
                  }}
                  className="p-4 rounded-md border border-[#e2e8f0] bg-white space-y-3 hover:border-[#0f172a] hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-bold text-sm text-[#0f172a] group-hover:underline underline-offset-2">
                          {guru.name}
                        </h3>
                        <span className="text-[10px] font-mono text-[#94a3b8] shrink-0">
                          {guru.englishName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded font-medium shrink-0">
                        {guru.style.split("/")[0].trim()}
                      </span>
                    </div>

                    <p className="text-xs text-[#334155] font-medium leading-snug">
                      {guru.oneLiner}
                    </p>

                    {guru.bookTitle && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                        <BookOpen className="w-3 h-3 text-[#94a3b8] shrink-0" />
                        <span className="truncate">{guru.bookTitle}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-[#f1f5f9] pt-2">
                    <div className="flex items-center justify-between pt-1 font-mono text-[10px]">
                      <div className="flex flex-wrap gap-1">
                        {guru.focusMetrics.slice(0, 3).map((metric) => (
                          <span
                            key={metric}
                            className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-[#0f172a] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        철학 열람
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. SECTION 06: PIPELINE (관리자 전용) ── */}
      {isAdmin && isVisible("sec-pipeline") && (
        <section
          id="sec-pipeline"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-4 md:sticky md:top-[72px] md:self-start">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  06
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  파이프라인
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                12:00 정기 배치 파이프라인의 실시간 진행 현황과 단계별 소요
                시간을 모니터링합니다.
              </p>
              {onOpenPipelineModal && (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onOpenPipelineModal}
                    disabled={isPipelineRunning}
                    leftIcon={
                      isPipelineRunning ? (
                        <Activity className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )
                    }
                    className="font-mono text-xs font-medium"
                  >
                    <span className="hidden sm:inline">
                      {isPipelineRunning ? "분석 파이프라인 가동 중" : "파이프라인 실행"}
                    </span>
                    <span className="sm:hidden">
                      {isPipelineRunning ? "가동 중" : "파이프라인"}
                    </span>
                  </Button>
                </div>
              )}
            </div>

            {/* 우측 */}
            <div className="min-w-0">
              <PipelineProgressCard
                progress={pipelineProgress}
                isLoading={isLoading}
                onRefresh={onRefreshPipeline}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 7. SECTION 07: SYSTEM AUDIT (관리자 전용) ── */}
      {isAdmin && isVisible("sec-audit") && (
        <section
          id="sec-audit"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-4 md:sticky md:top-[72px] md:self-start">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  07
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  감사 로그
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                시스템 감사 오류 로그를 레벨별로 필터링하고 세부 원인을
                추적합니다.
              </p>
            </div>

            {/* 우측 */}
            <div className="min-w-0">
              <LogsTab
                logs={systemLogs}
                isLoading={isLoading}
                onRefresh={onRefreshLogs}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 13인 거장 심층 철학 및 표결 종목 모달 ── */}
      {selectedGuruForModal && (
        <GuruDetailModal
          guru={selectedGuruForModal}
          reports={guruReports}
          onClose={() => setSelectedGuruForModal(null)}
          onSelectReport={(report) => {
            setSelectedGuruForModal(null);
            onSelectReport(report);
          }}
        />
      )}
    </div>
  );
}
