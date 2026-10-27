"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  GuruReportRow,
  StockCandidate,
  SystemLogItem,
  PipelineProgress,
  OutcomesOverview,
} from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TallyBar, TallyCounts } from "@/components/ui/TallyBar";
import { PipelineProgressCard } from "@/components/tabs/PipelineProgressCard";
import { LogsTab } from "@/components/tabs/LogsTab";
import { TweetGeneratorTab } from "@/components/tabs/TweetGeneratorTab";
import { MarketBriefingTab } from "@/components/tabs/MarketBriefingTab";
import { SidebarSectionId } from "@/components/sidebar/ResearchSidebar";
import { OutcomesView } from "@/components/outcomes/OutcomesView";
import { StatsRankingView } from "@/components/stats/StatsRankingView";
import { FeedbackView } from "@/components/feedback/FeedbackView";
import { GURU_PERSONAS, GuruPersona, getGuruPersonaBilingual } from "@/lib/guruPersonas";
import { GuruDetailModal } from "@/components/research/GuruDetailModal";
import { OnDemandModal } from "@/components/research/OnDemandModal";
import { StockListItem, StockItemInsight } from "@/components/research/StockListItem";
import { HomeServiceIntro } from "@/components/home/HomeServiceIntro";
import type { ResearchDocTab } from "@/components/research/ResearchDocumentView";
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
  ShieldAlert,
  Newspaper,
} from "lucide-react";
import { formatPriceByNation, formatMarketCap } from "@/lib/utils";
import { fetchTickerLogos, fetchTickerNames, fetchStockChart } from "@/lib/api-client";
import { fetchReportByDateAndTicker } from "@/lib/supabase";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { isReportRestricted, getDefaultReportDate } from "@/lib/subscription/subscriptionPolicy";
import { DataCache } from "@/lib/dataCache";
import { matchesTickerAlias, getEnglishCompanyName } from "@/lib/tickerAliases";
import type { TickerDirectoryEntry } from "@/lib/server/publicCatalog";
import {
  getPreviousAvailableDate,
  deduplicateReportsByLatestDate,
} from "@/lib/reportUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSectionLabel } from "@/lib/sectionNav";

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
  onSelectReport: (
    report: GuruReportRow,
    tab?: ResearchDocTab,
    options?: { navigate?: boolean }
  ) => void;
  onSelectCandidate: (
    candidate: StockCandidate,
    options?: { navigate?: boolean }
  ) => void;
  activeSectionFilter: SidebarSectionId;
  onSelectSection?: (sectionId: SidebarSectionId) => void;
  availableDates?: string[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isReportsLoading?: boolean;
  /** 대시보드 초기 로드 중 여부 (리포트 섹션 리스트 자리 스켈레톤용) */
  isDashboardLoading?: boolean;
  onSelectGuru?: (guruSlug: string, options?: { navigate?: boolean }) => void;
  intrinsicStabilityMap?: Map<string, IntrinsicStability>;
  onOpenPipelineModal?: () => void;
  isPipelineRunning?: boolean;
  /** 화면 표시분 한글명 보충 결과를 부모 캐시에 반영하는 콜백 */
  onSupplementTickerNames?: (names: Record<string, string>) => void;
  /**
   * 전체 종목 디렉터리 (서버 프리페치).
   * 목록에 노출되지 않는 종목까지 포함해 모든 상세 페이지로의
   * 크롤링 가능한 링크를 보장한다.
   */
  tickerDirectory?: TickerDirectoryEntry[];
  /** SSR용 성과 추적(트랙 레코드) 데이터 */
  initialOutcomes?: OutcomesOverview | null;
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
  tickerDirectory = [],
  initialOutcomes = null,
}: ResearchCatalogViewProps) {
  const { tier, isTrialActive, isAdmin } = useSubscription();
  const { isEn } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [onDemandTicker, setOnDemandTicker] = useState<string | null>(null);
  const [reportVerdictFilter, setReportVerdictFilter] = useState<string>("ALL");
  const [reportSortBy, setReportSortBy] = useState<
    "RATIO_DESC" | "SCORE_DESC" | "DATE_DESC" | "TICKER_ASC"
  >("RATIO_DESC");
  const [selectedGuruForModal, setSelectedGuruForModal] =
    useState<GuruPersona | null>(null);

  // 실시간 발굴 후보군 마켓(미국장 vs 한국장)
  const [candidateMarket, setCandidateMarket] = useState<"us" | "kr">("us");

  // 관리자 섹션 하위 탭 (마켓 브리핑 vs 트윗 생성기 vs 감사 로그)
  const [adminSubTab, setAdminSubTab] = useState<"briefing" | "tweet" | "logs">("briefing");

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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- 동시 2개 수동 큐로 대역폭 보호
  const pumpPbQueue = useCallback(() => {
    while (pbInflightRef.current < 2 && pbQueueRef.current.length > 0) {
      const key = pbQueueRef.current.shift()!;
      if (pbPendingRef.current.has(key)) continue;

      // 이미 캐시에 있으면 네트워크 요청 생략
      if (DataCache.getPercentB(key) !== undefined) {
        continue;
      }

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

  // 한글명 렌더링 규칙: 영문 모드 시 정식 영문 기업명 우선, 한국어 텍스트 배제. 한글 모드 시 캐시 한글명 -> 후보군명 -> 영문 fallback -> 티커
  const displayNameOf = (ticker: string, fallback?: string | null): string => {
    const key = (ticker || "").trim().toUpperCase();
    if (isEn) {
      const alias = getEnglishCompanyName(key);
      if (alias && alias.toUpperCase() !== key) return alias;
      const candidateName = candidateByTicker.get(key)?.name?.trim();
      if (candidateName && !/[\uac00-\ud7a3]/.test(candidateName) && candidateName.toUpperCase() !== key) {
        return candidateName;
      }
      const fb = (fallback || "").trim();
      if (fb && !/[\uac00-\ud7a3]/.test(fb) && fb.toUpperCase() !== key) {
        return fb;
      }
      return key;
    }
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
    const confidence =
      typeof report?.avg_confidence === "number" && Number.isFinite(report.avg_confidence)
        ? report.avg_confidence
        : (() => {
            const confidenceSamples = (report?.summaries || [])
              .filter((s) => s.parse_mode !== "fallback")
              .map((s) => s.confidence)
              .filter((v): v is number => v != null && Number.isFinite(v));
            return confidenceSamples.length > 0
              ? confidenceSamples.reduce((sum, v) => sum + v, 0) /
                  confidenceSamples.length
              : null;
          })();
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

  // 현재 유효한 분석 일자 (selectedDate가 없으면 최신 분석일 availableDates[0] 기준)
  const effectiveDate = selectedDate || availableDates[0] || "";

  // 선택 일자의 직전 분석 일자 (주말/공휴일 반영 실제 존재하는 이전 분석일)
  const prevDate = useMemo(
    () => getPreviousAvailableDate(effectiveDate, availableDates),
    [effectiveDate, availableDates]
  );

  // 1. 리포트 필터링 (날짜 & 검색 & 의견 + 권한)
  // 캐시/선행 로드로 제한 일자 리포트가 섞여 들어와도 리스트에 노출하지 않는다.
  const filteredReports = useMemo(() => {
    const list = permittedReports.filter((r) => {
      // 날짜 필터링 (유효한 날짜가 있고 "ALL"이 아닐 때: 당일 분석일 및 직전 분석일 허용)
      if (effectiveDate && effectiveDate !== "ALL") {
        const isCurrent = r.d === effectiveDate;
        const isPrev = prevDate ? r.d === prevDate : false;
        if (!isCurrent && !isPrev) {
          return false;
        }
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

    // 중복 종목코드가 있는 경우 최신 날짜 리포트 우선으로 중복 제거
    const dedupedList = deduplicateReportsByLatestDate(list);

    // 종목 리스트 정렬 (내재가치/종가 가 높은 거 부터 디폴트 정렬)
    return dedupedList.slice().sort((a, b) => {
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
  }, [permittedReports, effectiveDate, prevDate, searchQuery, reportVerdictFilter, reportSortBy, tickerNameMap]);

  // 직전 분석일 데이터로 보완된 종목이 현재 표시 목록에 포함되어 있는지 여부
  const hasSupplementedReports = useMemo(() => {
    if (!effectiveDate || effectiveDate === "ALL" || !prevDate) return false;
    return filteredReports.some((r) => r.d === prevDate);
  }, [filteredReports, effectiveDate, prevDate]);

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

  // 점진적 렌더링 (초기 20개 즉시 렌더 후 스크롤 시 20개씩 추가 렌더)
  const [reportPageLimit, setReportPageLimit] = useState(20);
  const loadMoreReportsRef = useRef<HTMLDivElement | null>(null);

  // 검색어/필터/정렬/날짜 변경 시 페이지 리밋 초기화
  useEffect(() => {
    setReportPageLimit(20);
  }, [searchQuery, reportVerdictFilter, reportSortBy, selectedDate]);

  useEffect(() => {
    if (isAll) return;
    const target = loadMoreReportsRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setReportPageLimit((prev) => {
            if (prev >= filteredReports.length) return prev;
            return prev + 20;
          });
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isAll, filteredReports.length]);

  // 후보군 점진적 렌더링 (초기 20개 즉시 렌더 후 스크롤 시 20개씩 추가 렌더)
  const [candidatePageLimit, setCandidatePageLimit] = useState(20);
  const loadMoreCandidatesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCandidatePageLimit(20);
  }, [searchQuery, candidateMarket]);

  useEffect(() => {
    if (isAll) return;
    const target = loadMoreCandidatesRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCandidatePageLimit((prev) => {
            if (prev >= filteredCandidates.length) return prev;
            return prev + 20;
          });
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isAll, filteredCandidates.length]);

  // [리스트 수 조절] 전체 홈일 때는 10개만, 개별 메뉴 선택 시 점진 렌더링(기본 20개 + 스크롤)
  const displayedReports = isAll
    ? filteredReports.slice(0, 10)
    : filteredReports.slice(0, reportPageLimit);
  const displayedRoma = isAll ? filteredRoma.slice(0, 10) : filteredRoma;
  const displayedCandidates = isAll
    ? filteredCandidates.slice(0, 10)
    : filteredCandidates.slice(0, candidatePageLimit);

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
      .slice(0, 6);
  }, [permittedReports]);

  const isVisible = (secId: string) => {
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

  /**
   * 종목 상세 페이지 크롤링 링크.
   * 출처 섹션(?from=)을 함께 기록해 상세에서 뒤로가기가 목록으로 정확히 복귀한다.
   */
  const stockDetailHref = (ticker: string) => {
    const params = new URLSearchParams();
    params.set("from", activeSectionFilter);
    const base = isEn ? `/en/stocks/${encodeURIComponent(ticker)}` : `/stocks/${encodeURIComponent(ticker)}`;
    return `${base}?${params.toString()}`;
  };

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
              {isEn ? "Administrator Access Required" : "관리자 전용 화면이에요"}
            </h1>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "The pipeline monitor and audit logs require an administrator login. Please log in with an admin account."
                : "파이프라인과 감사 로그는 관리자 계정으로 로그인해야 볼 수 있어요. 관리자 계정으로 로그인한 뒤 다시 시도해 주세요."}
            </p>
            <button
              onClick={() => onSelectSection?.("all")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#0f172a] text-white text-xs font-mono font-medium hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isEn ? "Back to Catalog Home" : "카탈로그 홈으로 돌아가기"}
            </button>
          </div>
        </section>
      )}
      {/* ── 1. HERO & 서비스 본질 소개 (전체 카탈로그 홈일 때 표시) 또는 개별 섹션 헤더 바 ── */}
      {isAll ? (
        <section className="px-6 lg:px-12 py-6 sm:py-8 bg-white">
          <HomeServiceIntro
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectSection={onSelectSection}
            topDiscountReports={topDiscountOpportunities}
            topRomaCandidates={romaCandidates.slice(0, 6)}
            topLiveCandidates={liveCandidates.slice(0, 6)}
            topKrCandidates={krCandidates.slice(0, 6)}
            outcomesOverview={initialOutcomes}
            totalReportCount={permittedReports.length}
            totalRomaCount={romaCandidates.length}
            totalCandidateCount={liveCandidates.length + krCandidates.length}
            onSelectReport={onSelectReport}
            onSelectCandidate={onSelectCandidate}
            onRequestOnDemandAnalysis={(ticker) => setOnDemandTicker(ticker)}
          />
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
                <span>{isEn ? "Catalog Home" : "카탈로그 홈"}</span>
              </button>
              <span className="text-[#cbd5e1]">/</span>
              <span className="text-[#0f172a] font-semibold">
                {getSectionLabel(activeSectionFilter, isEn)}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              {activeSectionFilter === "sec-reports" &&
                (isEn ? "13-Guru Valuation Rankings & Stock Archive" : "거장 가치평가 랭킹 & 리포트 전체 아카이브")}
              {activeSectionFilter === "sec-roma" &&
                (isEn ? "Superinvestor Portfolio (DataRoma)" : "슈퍼인베스터 포트폴리오 (DataRoma) 전체")}
              {activeSectionFilter === "sec-screener" &&
                (isEn ? "Real-time Discovery Candidates" : "실시간 발굴 후보군 전체")}
              {activeSectionFilter === "sec-outcomes" &&
                (isEn ? "Track Record & Accuracy" : "성과 및 거장 적중률")}
              {activeSectionFilter === "sec-stats" &&
                (isEn ? "Guru Vote Statistics" : "거장 표결 통계 랭킹")}
              {activeSectionFilter === "sec-briefings" &&
                (isEn ? "Daily Market Briefing & 24h News" : "데일리 마켓 브리핑 & 24시간 뉴스")}
              {activeSectionFilter === "sec-gurus" &&
                (isEn ? "13 Guru Philosophies & Valuation Guide" : "13인 투자 거장 철학 및 밸류에이션 가이드")}
              {activeSectionFilter === "sec-feedback" &&
                (isEn ? "Feedback & Feature Requests" : "의견 및 기능 제안함")}
              {activeSectionFilter === "sec-pipeline" &&
                (isEn ? "Pipeline Monitor" : "파이프라인 모니터")}
              {activeSectionFilter === "sec-audit" &&
                (isEn ? "Audit Log Monitor" : "감사 로그 모니터")}
            </h1>
          </div>

          <div className="w-full sm:w-80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? "Search... (ticker, company name)" : "검색... (티커, 종목명)"}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] shadow-xs text-[#0f172a] placeholder-[#94a3b8]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── [거장 인사이트 & 탈리 요약 배너] (리포트 랭킹 전용 뷰일 때 표시) ── */}
      {activeSectionFilter === "sec-reports" &&
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
                      <Link
                        key={item.ticker}
                        href={stockDetailHref(item.ticker)}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                          e.preventDefault();
                          onSelectReport(item.report);
                        }}
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
                      </Link>
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
                    {isEn
                      ? "Distinctive valuation criteria of 13 legendary investors including Buffett (Moat & ROE), Graham (Margin of Safety), Lynch (PEG), and Damodaran (DCF)."
                      : "버핏(해자·ROE), 그레이엄(안전마진), 린치(PEG), 다모다란(DCF) 등 13인의 독자적 심사 기준."}
                  </p>
                </div>
                <button
                  onClick={() => onSelectSection?.("sec-gurus")}
                  className="inline-flex items-center justify-between w-full pt-1.5 text-xs text-[#0f172a] font-semibold hover:underline cursor-pointer group"
                >
                  <span>{isEn ? "Read Guru Valuation Guides" : "거장별 심사 가이드 열람"}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </section>
        ) : isDashboardLoading || isReportsLoading ? (
          <section
            aria-label={isEn ? "Loading summary..." : "요약 정보를 불러오는 중"}
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

      {/* ── 2. SECTION 01: 거장 가치평가 랭킹 및 심층 분석 보고서 (1+2 통합) ── */}
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
                  {isEn ? "Guru Valuation Rankings" : "거장 가치평가 랭킹"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                {isEn
                  ? "Rankings sorted by intrinsic upside potential (undervaluation) derived from 13 legendary guru models. Click any stock to view detailed votes and research reports."
                  : "13인 거장의 분석으로 도출한 적정 내재가치 대비 상승여력(저평가율) 순위 차트입니다. 각 종목을 클릭하여 거장 표결과 심층 리포트를 확인하세요."}{" "}
                {isAll && (isEn ? `(Showing TOP 10 summary on home)` : `(홈에서는 랭킹 TOP 10만 요약 표시)`)}
              </p>

              {/* 1. 분석 일자 선택 (날짜별 선택, 디폴트: 최신 작성 일자) */}
              {availableDates && availableDates.length > 0 && (() => {
                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-[#94a3b8] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#0f172a]" />
                        <span>{isEn ? "Report Date" : "Report Date (분석 일자)"}</span>
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
                              ? (isEn ? "★ Latest Report (24H TRIAL)" : "★ 최신 분석 (24H TRIAL)")
                              : (isEn ? "★ Latest Report" : "★ 최신 분석일")
                            : tier === "free" && !isTrialActive
                            ? (isEn ? "FREE Archive" : "FREE 아카이브 (과거)")
                            : (isEn ? "Selected Date" : "선택 일자")}
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
                            {d} {idx === 0 ? (isEn ? "★ (Latest)" : "★ (최신 분석)") : ""} {restricted ? "[PRO]" : ""}
                          </option>
                        );
                      })}
                      <option value="ALL">
                        {isEn ? "All Dates (Recent 200 combined)" : "전체 일자 (최근 200건 통합)"} {tier === "free" && !isTrialActive ? "[PRO]" : ""}
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
                        <span>{isEn ? "All" : "전체"}</span>
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
                    { id: "ALL", label: isEn ? `All (${guruReports.length})` : `전체 (${guruReports.length})` },
                    { id: "BUY", label: isEn ? "Consensus Buy" : "매수 합의" },
                    { id: "HOLD", label: isEn ? "Hold · Watch" : "보유·관망" },
                    { id: "SELL", label: isEn ? "Sell" : "매도" },
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
                    {isEn ? "Effective Date: " : "분석 기준일: "}
                    {effectiveDate || (isEn ? "Latest" : "최신")}
                  </span>
                  {hasSupplementedReports && prevDate && (
                    <span
                      title={
                        isEn
                          ? `Stocks before market close were automatically supplemented with previous report data (${prevDate}).`
                          : `당일 장 마감 전 국장 종목 등은 직전 분석일(${prevDate}) 데이터로 자동 보완되었습니다.`
                      }
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569] inline-flex items-center gap-1"
                    >
                      <span>{isEn ? `Supplemented (${prevDate})` : `직전 분석일(${prevDate}) 보완`}</span>
                    </span>
                  )}
                  <span className="text-[#64748b]">
                    ({isEn ? `Total ${displayedReports.length}` : `총 ${displayedReports.length}건`}
                    {isAll && filteredReports.length > 10 ? (isEn ? ", top 10 shown" : " 중 상위 10건") : ""}
                    )
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isReportsLoading && (
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-[#0f172a]" />
                      <span>{isEn ? "Loading..." : "조회 중..."}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[#94a3b8] uppercase">{isEn ? "Sort:" : "정렬:"}</span>
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
                      <option value="RATIO_DESC">{isEn ? "Upside Potential (Rank #1~)" : "내재가치 상승여력순 (랭킹 1위~)"}</option>
                      <option value="SCORE_DESC">{isEn ? "Guru Score" : "거장 종합점수 랭킹순"}</option>
                      <option value="DATE_DESC">{isEn ? "Report Date" : "최신 분석일순"}</option>
                      <option value="TICKER_ASC">{isEn ? "Ticker (A-Z)" : "티커 알파벳순"}</option>
                    </select>
                  </div>
                </div>
              </div>
              {(isReportsLoading || isDashboardLoading) &&
              displayedReports.length === 0 ? (
                <StockListSkeleton rows={isAll ? 5 : 8} />
              ) : displayedReports.length === 0 ? (
                searchQuery.trim() ? (
                  <div className="py-12 px-6 text-center bg-white border border-[#e2e8f0] rounded-xl shadow-xs space-y-4 my-2">
                    <div className="w-12 h-12 rounded-full bg-[#e8f3ff] text-[#3182f6] flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1.5">
                      <h3 className="text-base font-bold text-[#191f28]">
                        {isEn
                          ? `'${searchQuery.trim()}' is not in the regular screening list`
                          : `‘${searchQuery.trim()}’ 종목은 정기 스크리닝 목록에 없어요`}
                      </h3>
                      <p className="text-xs text-[#6b7684] leading-relaxed">
                        {isEn ? (
                          <>
                            Only stocks matching 13 legendary value investor criteria (high profitability, low debt, safety margin) are published daily.
                            <br />
                            Want honest valuation for <strong>&lsquo;{searchQuery.trim()}&rsquo;</strong>? Request an instant analysis now!
                          </>
                        ) : (
                          <>
                            13인의 투자 거장 기준(고수익·저부채·안전마진)에 부합하는 종목만 매일 자동 발행돼요.
                            <br />
                            <strong>&lsquo;{searchQuery.trim()}&rsquo;</strong>에 대해 13인의 솔직한 가치평가가 궁금하시다면 지금 분석을 요청해보세요!
                          </>
                        )}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => setOnDemandTicker(searchQuery.trim().toUpperCase())}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold shadow-xs"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>
                          {isEn
                            ? `Request Instant 13-Guru AI Analysis for '${searchQuery.trim()}'`
                            : `‘${searchQuery.trim()}’ 13인 거장 AI 즉시 분석 요청`}
                        </span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon="📄"
                    title={isEn ? "No research reports match your criteria" : "해당 조건의 분석 보고서가 없습니다"}
                    description={
                      isEn
                        ? "Try changing your search terms or filter options."
                        : "검색어나 필터를 변경하거나 상단 파이프라인 버튼으로 보고서를 생성하세요."
                    }
                  />
                )
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {displayedReports.map((report, idx) => {
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
                        rankPrefix={`#${idx + 1}`}
                        companyName={displayNameOf(ticker, report.company_name)}
                        logo={renderLogo(ticker)}
                        insight={toItemInsight(insight)}
                        percentB={percentB}
                        rowRef={observePbRow(ticker, pbKey)}
                        rowKey={pbKey}
                        href={stockDetailHref(ticker)}
                        onClick={() => onSelectReport(report)}
                        badges={
                          <span className="text-[11px] text-[#64748b] ml-auto sm:ml-0 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#94a3b8]" />
                            <span>{report.d}</span>
                            {effectiveDate && effectiveDate !== "ALL" && report.d !== effectiveDate && (
                              <span
                                title={
                                  isEn
                                    ? "Supplemented with data from the previous analysis date."
                                    : "당일 분석 전 직전 분석일 데이터로 보완된 리포트입니다."
                                }
                                className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-[#475569] border border-[#cbd5e1]"
                              >
                                {isEn ? "Prev Date" : "직전일"}
                              </span>
                            )}
                          </span>
                        }
                        summary={
                          (isEn
                            ? (report.vote_summary
                                ? report.vote_summary
                                    .replace(/매수/g, "Buy")
                                    .replace(/보유/g, "Hold")
                                    .replace(/관망/g, "Watch")
                                    .replace(/매도/g, "Sell")
                                    .replace(/유효\s*의견/g, "Valid Votes")
                                : "13-Guru Consensus Summary")
                            : (report.vote_summary || "13인 표결 요약")) +
                          (insight.safetyPrice
                            ? ` · ${isEn ? "Margin of Safety Entry: " : "안전마진 매수가: "}${
                                isEn
                                  ? insight.safetyPrice.replace(/이하/g, "or below").replace(/이상/g, "or above")
                                  : insight.safetyPrice
                              }`
                            : "")
                        }
                      />
                    );
                  })}
                </ul>
              )}

              {!isAll && displayedReports.length < filteredReports.length && (
                <div
                  ref={loadMoreReportsRef}
                  className="py-3 text-center text-xs text-[#94a3b8] flex items-center justify-center gap-2 border-t border-[#f1f5f9]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                  <span>
                    {isEn
                      ? `Loading more reports... (${displayedReports.length} / ${filteredReports.length})`
                      : `더 많은 분석 보고서 로드 중... (${displayedReports.length} / ${filteredReports.length})`}
                  </span>
                </div>
              )}

              {/* [리스트 수 조절] 전체 홈에서 10개 초과 시 전체 보기 링크 */}
              {isAll && filteredReports.length > 10 && (
                <div className="pt-2 border-t border-[#f1f5f9] flex justify-end">
                  <button
                    onClick={() => onSelectSection?.("sec-reports")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-xs font-mono font-medium text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                  >
                    <span>
                      {isEn
                        ? `View All Valuation Rankings (${filteredReports.length})`
                        : `전체 가치평가 랭킹 보기 (${filteredReports.length}건)`}
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
                  {isEn ? "Superinvestor Portfolio" : "슈퍼인베스터 포트폴리오"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                {isEn
                  ? "Brief of DataRoma Grand Portfolio stocks held simultaneously by 10+ top US superinvestors."
                  : "미국 탑 슈퍼인베스터 10명 이상이 동시 보유하고 있는 DataRoma 그랜드 포트폴리오 종목 브리프입니다."}{" "}
                {isAll && (isEn ? `(Showing TOP 10 on home)` : `(홈에서는 상위 10개만 요약 표시)`)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshRoma}
                isLoading={isRomaLoading}
                leftIcon={<RefreshCw className="w-3 h-3 text-[#64748b]" />}
                className="font-mono text-xs"
              >
                {isEn ? "Refresh DataRoma Feed" : "DataRoma 피드 갱신"}
              </Button>
            </div>

            {/* 우측: DataRoma 종목 리스트 */}
            <div className="min-w-0 space-y-4">
              {isRomaLoading && displayedRoma.length === 0 ? (
                <StockListSkeleton rows={isAll ? 5 : 8} />
              ) : displayedRoma.length === 0 ? (
                <EmptyState
                  icon="🏛️"
                  title={isEn ? "No DataRoma superinvestor data available" : "DataRoma 슈퍼인베스터 데이터가 없습니다"}
                  description={
                    isEn
                      ? "Click 'Refresh DataRoma Feed' to load the grand portfolio."
                      : "좌측 'DataRoma 피드 갱신' 버튼을 누르면 그랜드 포트폴리오를 불러옵니다."
                  }
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
                        href={stockDetailHref(c.ticker)}
                        onClick={() => onSelectCandidate(c)}
                        priceText={formatPriceByNation(c.price, undefined, c.ticker)}
                        badges={
                          <>
                            {c.holders != null && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#cbd5e1] bg-white text-[#0f172a] font-semibold">
                                {isEn ? `${c.holders} holders` : `${c.holders}인 보유`}
                              </span>
                            )}
                            {c.weight_pct != null && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
                                {isEn ? `Weight: ${c.weight_pct.toFixed(2)}%` : `비중: ${c.weight_pct.toFixed(2)}%`}
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
                      {isEn
                        ? `View All Superinvestor Portfolios (${filteredRoma.length})`
                        : `전체 슈퍼인베스터 포트폴리오 보기 (${filteredRoma.length}개)`}
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
                  {isEn ? "Real-time Discovery Candidates" : "실시간 발굴 후보군"}
                </h2>
              </div>

              {/* 마켓 전환 탭: 미국장 (13인 종합) vs 한국장 (공통 + 조건강화) */}
              <div className="flex items-center gap-1.5 p-1 bg-[#f1f5f9] rounded-lg font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCandidateMarket("us");
                    if ((!liveCandidates || liveCandidates.length === 0) && !isLoading) {
                      onRefreshLive();
                    }
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                    candidateMarket === "us"
                      ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <span>{isEn ? "🇺🇸 US Stocks" : "🇺🇸 미국장"}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#e2e8f0] text-[#334155]">
                    {liveCandidates.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCandidateMarket("kr");
                    if ((!krCandidates || krCandidates.length === 0) && !isKrLoading) {
                      onRefreshKr?.(5);
                    }
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                    candidateMarket === "kr"
                      ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <span>{isEn ? "🇰🇷 KR Stocks" : "🇰🇷 한국장"}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#e2e8f0] text-[#334155]">
                    {krCandidates.length}
                  </span>
                </button>
              </div>

              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                {isEn
                  ? candidateMarket === "us"
                    ? "Candidate stocks meeting 13-guru screening filters, queued for pipeline research."
                    : "High-quality core Korean companies (Stage 5) meeting unified fundamental benchmarks."
                  : candidateMarket === "us"
                  ? "13인 거장 스크리닝 조건을 충족하여 분석 파이프라인 진입 대기 중인 후보 종목 브리프입니다."
                  : "단일 공통 재무 기준을 통과한 한국 핵심 알짜(5단계) 기업 발굴 목록입니다."}
                {" "}
                {isAll && (isEn ? `(Showing TOP 10 on home)` : `(홈에서는 상위 10개만 요약 표시)`)}
              </p>

              {/* 한국장 전용: 5단계 고정 핵심 알짜 정보 카드 */}
              {candidateMarket === "kr" && (
                <div className="p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-2.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0f172a] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#3182f6]" />
                      <span>{isEn ? "KR Blue-Chip Filter" : "한국장 우량주 필터"}</span>
                    </span>
                    <span className="text-[11px] text-[#3182f6] font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {isEn ? "Stage 5 Fixed (Core)" : "5단계 고정 (알짜)"}
                    </span>
                  </div>

                  <div className="text-[11px] bg-white p-2.5 rounded-lg border border-[#e2e8f0] text-[#475569] space-y-1.5">
                    <div className="text-[#0f172a] font-semibold flex items-center justify-between">
                      <span>{isEn ? "High Profitability · Low Debt · Sound Balance" : KR_STEP_5_INFO.desc}</span>
                      <span className="text-[#3182f6] font-bold">
                        {isEn ? `${krCandidates.length} detected` : `${krCandidates.length}개 포착`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-[#64748b] pt-1 border-t border-[#f1f5f9]">
                      <span>{isEn ? "MCap: " : "시총: "}{KR_STEP_5_INFO.mcap}</span>
                      <span>{isEn ? "Debt: " : "부채비율: "}{KR_STEP_5_INFO.debt}</span>
                      <span>{isEn ? "Interest: " : "이자보상: "}{KR_STEP_5_INFO.interest}</span>
                      <span>{isEn ? "Op Margin: " : "영업익률: "}{KR_STEP_5_INFO.op}</span>
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
                {isEn
                  ? candidateMarket === "us"
                    ? "Refresh US Screener"
                    : "Refresh KR Screener (Stage 5)"
                  : candidateMarket === "us"
                  ? "미국장 스크리너 갱신"
                  : "한국장 스크리너 갱신 (5단계)"}
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
                  title={isEn ? "No screening candidates detected" : "포착된 스크리닝 후보군이 없습니다"}
                  description={
                    isEn
                      ? candidateMarket === "us"
                        ? "Click 'Refresh US Screener' to run real-time screening."
                        : "Click 'Refresh KR Screener' to find Stage 5 blue chips."
                      : candidateMarket === "us"
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
                        href={stockDetailHref(c.ticker)}
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
                                ? (isEn ? "Stage 5 Core" : "알짜 5단계")
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
                                {isEn ? "Op Margin: " : "영업익: "}{(c.operating_margin * 100).toFixed(1)}%
                              </span>
                            )}
                            {c.debt_ratio != null && (
                              <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#64748b] font-mono text-[11px]">
                                {isEn ? "Debt: " : "부채: "}{(c.debt_ratio * 100).toFixed(0)}%
                              </span>
                            )}
                          </>
                        }
                      />
                    );
                  })}
                </ul>
              )}

              {!isAll && displayedCandidates.length < filteredCandidates.length && (
                <div
                  ref={loadMoreCandidatesRef}
                  className="py-3 text-center text-xs text-[#94a3b8] flex items-center justify-center gap-2 border-t border-[#f1f5f9]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                  <span>
                    {isEn
                      ? `Loading more candidates... (${displayedCandidates.length} / ${filteredCandidates.length})`
                      : `더 많은 후보 종목 불러오는 중... (${displayedCandidates.length} / ${filteredCandidates.length})`}
                  </span>
                </div>
              )}

              {/* [리스트 수 조절] 전체 홈에서 10개 초과 시 전체 보기 링크 */}
              {isAll && filteredCandidates.length > 10 && (
                <div className="pt-2 border-t border-[#f1f5f9] flex justify-end">
                  <button
                    onClick={() => onSelectSection?.("sec-screener")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-xs font-mono font-medium text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                  >
                    <span>
                      {isEn
                        ? `View All Discovery Candidates (${filteredCandidates.length})`
                        : `전체 실시간 발굴 후보군 보기 (${filteredCandidates.length}개)`}
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
            initialData={initialOutcomes}
            onSelectReport={(_id, ticker, date) => {
              const found =
                guruReports.find((r) => r.ticker === ticker && r.d === date) ||
                guruReports.find((r) => r.ticker === ticker);
              if (found) {
                onSelectReport(found);
              } else {
                // 캐시에 없는 과거 성과 리포트도 단건 조회 후 상세로 진입 (빈 클릭 방지)
                void fetchReportByDateAndTicker(date, ticker).then((fetched) => {
                  if (fetched) onSelectReport(fetched);
                });
              }
            }}
          />
        </section>
      )}

      {/* ── 5. SECTION 05: 거장 표결 통계 랭킹 (Stats Hub) ── */}
      {isVisible("sec-stats") && (
        <section
          id="sec-stats"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <StatsRankingView
            guruReports={guruReports}
            onSelectReport={onSelectReport}
            tickerNameMap={tickerNameMap}
          />
        </section>
      )}

      {/* ── 6. SECTION 06: 데일리 마켓 브리핑 (Daily Market Briefing) ── */}
      {isVisible("sec-briefings") && (
        <section
          id="sec-briefings"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="space-y-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                06
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                {isEn ? "Daily Market Briefing" : "데일리 마켓 브리핑"}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
              {isEn
                ? "Daily AI journalistic intelligence synthesized from WallStreetBets, financial communities, and 24-hour financial news at 00:05 KST."
                : "매일 자정 00:05 KST에 수집된 글로벌 레딧, 국내 주식 커뮤니티, 24시간 주요 뉴스를 종합한 AI 마켓 저널리즘 브리핑입니다."}
            </p>

            <div className="pt-2">
              <MarketBriefingTab isEn={isEn} />
            </div>
          </div>
        </section>
      )}

      {/* ── 7. SECTION 07: 13인 투자 거장 철학 & 심층 가이드 (my/financial 연동) ── */}
      {isVisible("sec-gurus") && (
        <section
          id="sec-gurus"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="space-y-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                07
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                {isEn ? "13 Guru Philosophies & Valuation Guide" : "13인 투자 거장 철학 및 밸류에이션 가이드"}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
              {isEn
                ? "Core investment philosophies, checklists, and key quantitative benchmarks of the 13 legendary value investors powering the Reportist research engine."
                : "Reportist 리서치 파이프라인에서 실제 독립 평가를 수행하는 13인 투자 거장의 고유한 심사 철학, 체크리스트 및 핵심 정량 지표 기준입니다."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 font-sans">
              {Object.values(GURU_PERSONAS).map((rawGuru) => {
                const guru = getGuruPersonaBilingual(rawGuru, isEn) || rawGuru;
                const styleTag = (isEn ? (rawGuru.styleEn || rawGuru.style) : rawGuru.style).split("/")[0].trim();
                return (
                  <Link
                    key={rawGuru.slug}
                    href={isEn ? `/en/gurus/${encodeURIComponent(rawGuru.slug)}?from=sec-gurus` : `/gurus/${encodeURIComponent(rawGuru.slug)}?from=sec-gurus`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      if (onSelectGuru) {
                        onSelectGuru(rawGuru.slug);
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
                            {isEn ? rawGuru.englishName : rawGuru.name}
                          </h3>
                          {!isEn && (
                            <span className="text-[10px] font-mono text-[#94a3b8] shrink-0">
                              {rawGuru.englishName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded font-medium shrink-0">
                          {styleTag}
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
                          {isEn ? "View Philosophy" : "철학 열람"}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. SECTION 08: 의견 및 기능 제안함 ── */}
      {isVisible("sec-feedback") && (
        <section
          id="sec-feedback"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <FeedbackView isAdmin={isAdmin} />
        </section>
      )}

      {/* ── 9. SECTION 09: PIPELINE (관리자 전용) ── */}
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
                  09
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  {isEn ? "Pipeline Monitor" : "파이프라인"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                {isEn
                  ? "Monitor real-time execution status and stage durations for the scheduled batch pipeline."
                  : "12:00 정기 배치 파이프라인의 실시간 진행 현황과 단계별 소요 시간을 모니터링합니다."}
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
                      {isPipelineRunning
                        ? (isEn ? "Pipeline Running" : "분석 파이프라인 가동 중")
                        : (isEn ? "Run Pipeline" : "파이프라인 실행")}
                    </span>
                    <span className="sm:hidden">
                      {isPipelineRunning ? (isEn ? "Running" : "가동 중") : (isEn ? "Pipeline" : "파이프라인")}
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

      {/* ── 10. SECTION 10: ADMIN (트윗 생성기 & 시스템 감사 로그) ── */}
      {isAdmin && isVisible("sec-audit") && (
        <section
          id="sec-audit"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-5 md:sticky md:top-[72px] md:self-start">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                    10
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    {adminSubTab === "briefing"
                      ? isEn
                        ? "Daily Market & Community Briefing"
                        : "데일리 마켓 브리핑"
                      : adminSubTab === "tweet"
                      ? isEn
                        ? "X / Twitter Post Generator"
                        : "X (트위터) 트윗 생성기"
                      : isEn
                      ? "Audit Log Monitor"
                      : "감사 로그"}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md mt-2">
                  {adminSubTab === "briefing"
                    ? isEn
                      ? "Daily AI journalistic newsletter synthesized from Reddit, stock forums, and 24-hour financial news."
                      : "매일 자정 00:05 KST에 수집된 글로벌 레딧, 국내 주식 커뮤니티, 24시간 주요 뉴스를 종합한 AI 마켓 브리핑 뉴스레터입니다."
                    : adminSubTab === "tweet"
                    ? isEn
                      ? "Select any stock to generate an optimized English tweet with guru consensus, fair value, and one-click copy."
                      : "13인 거장 AI 표결과 적정가를 담은 고품질 트윗을 생성하고, 원클릭 복사 또는 X(트위터) 작성창으로 바로 열어 게시합니다."
                    : isEn
                    ? "Filter system audit error logs by severity level and inspect root causes."
                    : "시스템 감사 오류 로그를 레벨별로 필터링하고 세부 원인을 추적합니다."}
                </p>
              </div>

              {/* 관리자 서브 탭 전환 메뉴 */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdminSubTab("briefing")}
                  className={`w-full px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-3 text-left cursor-pointer ${
                    adminSubTab === "briefing"
                      ? "bg-[#0f172a] text-white shadow-sm"
                      : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] border border-[#e2e8f0]"
                  }`}
                >
                  <Newspaper className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">{isEn ? "Market Briefing" : "데일리 마켓 브리핑"}</div>
                    <div className={`text-[11px] ${adminSubTab === "briefing" ? "text-slate-300" : "text-[#94a3b8]"}`}>
                      {isEn ? "Community & 24h News" : "커뮤니티 & 24시간 뉴스"}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminSubTab("tweet")}
                  className={`w-full px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-3 text-left cursor-pointer ${
                    adminSubTab === "tweet"
                      ? "bg-[#0f172a] text-white shadow-sm"
                      : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] border border-[#e2e8f0]"
                  }`}
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <div>
                    <div className="font-bold">{isEn ? "X Post Generator" : "X 트윗 생성기"}</div>
                    <div className={`text-[11px] ${adminSubTab === "tweet" ? "text-slate-300" : "text-[#94a3b8]"}`}>
                      {isEn ? "Instant copy & post" : "원클릭 복사 및 즉시 작성"}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminSubTab("logs")}
                  className={`w-full px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-3 text-left cursor-pointer ${
                    adminSubTab === "logs"
                      ? "bg-[#0f172a] text-white shadow-sm"
                      : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] border border-[#e2e8f0]"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">{isEn ? "Audit Logs" : "시스템 감사 로그"}</div>
                    <div className={`text-[11px] ${adminSubTab === "logs" ? "text-slate-300" : "text-[#94a3b8]"}`}>
                      {isEn ? "Error monitor & trace" : "오류 모니터링 및 추적"}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 우측 */}
            <div className="min-w-0">
              {adminSubTab === "briefing" ? (
                <MarketBriefingTab isEn={isEn} />
              ) : adminSubTab === "tweet" ? (
                <TweetGeneratorTab reports={guruReports} isEn={isEn} />
              ) : (
                <LogsTab
                  logs={systemLogs}
                  isLoading={isLoading}
                  onRefresh={onRefreshLogs}
                />
              )}
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

      {/* ── 온디맨드 13인 거장 AI 즉시 분석 모달 ── */}
      <OnDemandModal
        isOpen={!!onDemandTicker}
        ticker={onDemandTicker || ""}
        onClose={() => setOnDemandTicker(null)}
      />

      {/* ── 전체 종목 디렉터리 ──────────────────────────────────────────
          목록 화면(날짜/권한 필터)에 잡히지 않는 종목까지 포함해
          모든 종목 상세 페이지로의 크롤링 가능한 링크를 보장한다.
          서버에서 프리페치한 tickerDirectory가 있을 때만 렌더한다. */}
      {tickerDirectory.length > 0 && (
        <nav
          aria-label={isEn ? "All stock research reports directory" : "전체 종목 주식 리포트 목록"}
          className="px-6 lg:px-12 py-8 lg:py-10 bg-[#fafafa] border-t border-[#e2e8f0]"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-semibold text-[#94a3b8]">
              INDEX
            </span>
            <h2 className="text-base font-bold text-[#0f172a] tracking-tight">
              {isEn
                ? `All Stocks Research Directory (${tickerDirectory.length} Stocks)`
                : `전체 종목 주식 리포트 목록 (${tickerDirectory.length}종목)`}
            </h2>
          </div>
          <p className="text-xs text-[#64748b] mt-1.5 mb-4 leading-relaxed max-w-3xl">
            {isEn
              ? "Explore 13-guru AI valuation reports, fair price, and margin of safety bands across global and domestic markets. Select any stock to visit its report archive."
              : "국내·미국 전 종목의 13인 투자 거장 AI 가치평가 리포트, 적정주가와 내재가치 밴드를 확인하세요. 종목을 선택하면 해당 종목의 리포트 아카이브로 이동합니다."}
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-5 gap-y-1">
            {tickerDirectory.map((entry) => {
              const displayName = isEn
                ? getEnglishCompanyName(entry.ticker, entry.name)
                : entry.name;
              return (
                <li key={entry.ticker}>
                  <Link
                    href={isEn ? `/en/stocks/${encodeURIComponent(entry.ticker)}` : `/stocks/${encodeURIComponent(entry.ticker)}`}
                    className="flex items-baseline gap-1.5 text-[11px] font-mono text-[#475569] hover:text-[#0f172a] hover:underline underline-offset-2 py-0.5 min-w-0"
                  >
                    <span className="font-bold text-[#0f172a] shrink-0">
                      {entry.ticker}
                    </span>
                    {displayName &&
                      displayName.toUpperCase() !== entry.ticker.toUpperCase() && (
                        <span className="truncate">{displayName}</span>
                      )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
