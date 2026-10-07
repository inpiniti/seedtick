"use client";

import React, { useState, useMemo } from "react";
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
import { GURU_PERSONAS, GuruPersona } from "@/lib/guruPersonas";
import { GuruDetailModal } from "@/components/research/GuruDetailModal";
import {
  chartTickerKey,
  extractValuationConsensus,
  buildIntrinsicStability,
  getIntrinsicStabilityMeta,
  formatPercentB,
  formatIntrinsicRatio,
  IntrinsicStability,
} from "@/lib/insightUtils";
import {
  Search,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  RefreshCw,
  ArrowRight,
  Users,
  Target,
  TrendingUp,
  Award,
  Calendar,
} from "lucide-react";

interface ResearchCatalogViewProps {
  guruReports: GuruReportRow[];
  liveCandidates: StockCandidate[];
  romaCandidates: StockCandidate[];
  systemLogs: SystemLogItem[];
  pipelineProgress: PipelineProgress | null;
  isLoading: boolean;
  isRomaLoading: boolean;
  percentBByTicker: Record<string, number | null>;
  onRefreshLive: () => void;
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
  onSelectGuru?: (guruSlug: string) => void;
  intrinsicStabilityMap?: Map<string, IntrinsicStability>;
}

export function ResearchCatalogView({
  guruReports,
  liveCandidates,
  romaCandidates,
  systemLogs,
  pipelineProgress,
  isLoading,
  isRomaLoading,
  percentBByTicker,
  onRefreshLive,
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
  onSelectGuru,
  intrinsicStabilityMap,
}: ResearchCatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [reportVerdictFilter, setReportVerdictFilter] = useState<string>("ALL");
  const [reportSortBy, setReportSortBy] = useState<
    "RATIO_DESC" | "SCORE_DESC" | "DATE_DESC" | "TICKER_ASC"
  >("RATIO_DESC");
  const [selectedGuruForModal, setSelectedGuruForModal] =
    useState<GuruPersona | null>(null);

  const isAll = activeSectionFilter === "all";

  // 티커별 최신 리포트 맵
  const latestReportByTicker = useMemo(() => {
    const map = new Map<string, GuruReportRow>();
    for (const r of guruReports) {
      const key = r.ticker.toUpperCase();
      if (!map.has(key)) map.set(key, r);
    }
    return map;
  }, [guruReports]);

  // 후보군 맵 (로고 조회용)
  const candidateByTicker = useMemo(() => {
    const map = new Map<string, StockCandidate>();
    for (const c of liveCandidates) map.set(c.ticker.toUpperCase(), c);
    for (const c of romaCandidates) {
      if (!map.has(c.ticker.toUpperCase())) map.set(c.ticker.toUpperCase(), c);
    }
    return map;
  }, [liveCandidates, romaCandidates]);

  // 내재가치 안정성 맵 (부모 주입 우선, 없을 시 자체 리포트 기반 폴백)
  const intrinsicStabilityByTicker = useMemo(() => {
    if (intrinsicStabilityMap && intrinsicStabilityMap.size > 0) {
      return intrinsicStabilityMap;
    }
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
  }, [intrinsicStabilityMap, guruReports]);

  // 종목 인사이트 계산 헬퍼
  const getInsight = (ticker: string, stockPrice?: number | null) => {
    const report = latestReportByTicker.get(ticker.toUpperCase());
    const consensus = extractValuationConsensus(report);
    const fairValue = consensus?.fair_value_price ?? null;
    const confidenceSamples = (report?.summaries || [])
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
    };
  };

  // 1. 리포트 필터링 (날짜 & 검색 & 의견)
  const filteredReports = useMemo(() => {
    const list = guruReports.filter((r) => {
      // 날짜 필터링 (선택된 날짜가 있고 "ALL"이 아닐 때)
      if (selectedDate && selectedDate !== "ALL" && r.d !== selectedDate) {
        return false;
      }

      const matchesSearch =
        !searchQuery.trim() ||
        r.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.company_name &&
          r.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
  }, [guruReports, selectedDate, searchQuery, reportVerdictFilter, reportSortBy]);

  // 2. DataRoma 후보군 전체 필터링
  const filteredRoma = useMemo(() => {
    if (!searchQuery.trim()) return romaCandidates;
    const q = searchQuery.toLowerCase();
    return romaCandidates.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [romaCandidates, searchQuery]);

  // 3. 실시간 후보군 전체 필터링
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return liveCandidates;
    const q = searchQuery.toLowerCase();
    return liveCandidates.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [liveCandidates, searchQuery]);

  // [리스트 수 조절] 전체 홈일 때는 10개만, 개별 메뉴 선택 시 전체 표시
  const displayedReports = isAll
    ? filteredReports.slice(0, 10)
    : filteredReports;
  const displayedRoma = isAll ? filteredRoma.slice(0, 10) : filteredRoma;
  const displayedCandidates = isAll
    ? filteredCandidates.slice(0, 10)
    : filteredCandidates;

  // 전체 리포트 대상 종합 표결 탈리 집계
  const aggregateTally = useMemo<TallyCounts>(() => {
    const counts: TallyCounts = { buy: 0, hold: 0, watch: 0, sell: 0 };
    for (const r of guruReports) {
      const v = (r.verdict || "").toLowerCase();
      if (v.includes("매수") || v.includes("buy")) counts.buy += 1;
      else if (v.includes("매도") || v.includes("sell")) counts.sell += 1;
      else if (v.includes("관망") || v.includes("watch")) counts.watch += 1;
      else counts.hold += 1;
    }
    return counts;
  }, [guruReports]);

  // 내재가치 저평가 기회 상위 3종목 (괴리율 Top 3)
  const topDiscountOpportunities = useMemo(() => {
    return guruReports
      .map((r) => {
        const insight = getInsight(r.ticker, r.current_price);
        return {
          report: r,
          ticker: r.ticker,
          companyName: r.company_name || r.ticker,
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
  }, [guruReports]);

  const isVisible = (secId: string) => {
    if (activeSectionFilter === "all") return true;
    return activeSectionFilter === secId;
  };

  // [컬러 톤다운] 흑백 로고 렌더러
  const renderLogo = (ticker: string, candidateLogo?: string | null) => {
    const logoUrl =
      candidateLogo ||
      candidateByTicker.get(ticker.toUpperCase())?.logo_image_url;

    if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={ticker}
          className="w-10 h-10 rounded object-contain border border-[#e2e8f0] p-0.5 bg-white shrink-0 grayscale opacity-90 contrast-125"
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

  // [컬러 톤다운] 흑백 투자의견 뱃지
  const renderMonochromeVerdict = (v?: string | null) => {
    if (!v) {
      return (
        <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
          대기 중
        </span>
      );
    }
    const lower = v.toLowerCase();
    if (lower.includes("매수") || lower.includes("buy")) {
      return (
        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#0f172a] text-white border border-[#0f172a] shrink-0">
          {v}
        </span>
      );
    }
    if (lower.includes("매도") || lower.includes("sell")) {
      return (
        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-white text-[#0f172a] border border-[#64748b] shrink-0">
          {v}
        </span>
      );
    }
    return (
      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] shrink-0">
        {v}
      </span>
    );
  };

  // [컬러 톤다운] 흑백 안정성 뱃지
  const renderStabilityBadge = (stability: IntrinsicStability) => {
    switch (stability.level) {
      case "stable":
        return (
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-white border border-slate-900">
            안정성: 안정
          </span>
        );
      case "watch":
        return (
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 border border-slate-300">
            안정성: 주의
          </span>
        );
      case "unstable":
        return (
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white text-slate-900 border border-slate-400 font-semibold">
            안정성: 불안정
          </span>
        );
      default:
        return (
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-50 text-slate-500 border border-slate-200">
            안정성: 표본 부족
          </span>
        );
    }
  };

  return (
    <div className="flex-1 min-w-0 bg-white font-sans divide-y divide-[#e2e8f0]">
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
              13인 투자 거장의 AI 가치평가 및 심층 리서치 아카이브
            </h1>

            <p className="text-sm sm:text-base text-[#64748b] leading-relaxed max-w-3xl">
              단순한 주가 시세판이 아닌, 투자 거장들의 정량·정성 분석과 내재가치
              합의를 정제된 문서로 제공합니다. 보고서를 클릭하면 해당 화면에서 즉시
              연구 브리프 문서로 전환되어 전문 가치평가 내역을 열람할 수 있습니다.
            </p>

            {/* 메타데이터 요약 DL */}
            <dl className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-[#64748b]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a]">
                  {guruReports.length}
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
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a] live-dot" />
                <span className="text-[#0f172a] font-semibold">
                  12:00 BATCH ENGINE READY
                </span>
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
                {activeSectionFilter === "sec-gurus" &&
                  "13인 투자 거장 철학"}
                {activeSectionFilter === "sec-audit" &&
                  "파이프라인 & 감사 로그"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              {activeSectionFilter === "sec-reports" &&
                "가치평가 및 거장 리포트 전체 아카이브"}
              {activeSectionFilter === "sec-roma" &&
                "슈퍼인베스터 포트폴리오 (DataRoma) 전체"}
              {activeSectionFilter === "sec-screener" &&
                "실시간 발굴 후보군 전체"}
              {activeSectionFilter === "sec-gurus" &&
                "13인 투자 거장 철학 및 밸류에이션 가이드"}
              {activeSectionFilter === "sec-audit" &&
                "파이프라인 & 감사 로그 모니터"}
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
        guruReports.length > 0 && (
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
                          ${item.ticker}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#64748b] text-[11px]">
                            ${item.currentPrice?.toFixed(1)} → $
                            {item.fairValue?.toFixed(1)}
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
        )}

      {/* ── 2. SECTION 01: 가치평가 및 거장 심층 분석 보고서 전체 (1+2 통합) ── */}
      {isVisible("sec-reports") && (
        <section
          id="sec-reports"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측: 타이틀 & 설명 & 날짜선택 & 필터 */}
            <div className="space-y-4">
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
              {availableDates && availableDates.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-[#94a3b8] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#0f172a]" />
                      <span>Report Date (분석 일자)</span>
                    </span>
                    {selectedDate && selectedDate !== "ALL" && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0f172a] text-white">
                        {selectedDate === availableDates[0] ? "★ 최신 분석일" : "선택 일자"}
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
                      {availableDates.map((d, idx) => (
                        <option key={d} value={d}>
                          {d} {idx === 0 ? "★ (가장 최근 분석)" : ""}
                        </option>
                      ))}
                      <option value="ALL">전체 일자 (최근 200건 통합)</option>
                    </select>
                  </div>

                  {/* 빠른 날짜 선택 칩 (최근 3~4개 일자) */}
                  <div className="flex items-center gap-1 font-mono text-[11px] overflow-x-auto whitespace-nowrap scrollbar-none pt-0.5">
                    {availableDates.slice(0, 4).map((d, idx) => {
                      const isSelected =
                        selectedDate === d || (!selectedDate && idx === 0);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => onSelectDate?.(d)}
                          className={`shrink-0 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                              : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a]"
                          }`}
                        >
                          {d} {idx === 0 ? "(최신)" : ""}
                        </button>
                      );
                    })}
                    {availableDates.length > 4 && (
                      <button
                        type="button"
                        onClick={() => onSelectDate?.("ALL")}
                        className={`shrink-0 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          selectedDate === "ALL"
                            ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                            : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a]"
                        }`}
                      >
                        전체
                      </button>
                    )}
                  </div>
                </div>
              )}

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
                      onChange={(e) => setReportSortBy(e.target.value as any)}
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
              {displayedReports.length === 0 ? (
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
                    const percentB = percentBByTicker[chartTickerKey(ticker)];
                    const ratioText = formatIntrinsicRatio(
                      insight.intrinsicRatioPct
                    );

                    return (
                      <li key={report.id || ticker}>
                        <div
                          onClick={() => onSelectReport(report)}
                          className="py-3.5 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-3.5 justify-between"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {renderLogo(ticker)}

                            <div className="min-w-0 flex-1 space-y-1.5">
                              {/* 상단 라인: 슬러그, 투자의견, 발행일자 */}
                              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                                <span className="font-bold text-[#0f172a] group-hover:text-black transition-colors">
                                  ${ticker}
                                </span>
                                <span className="text-[#94a3b8]">
                                  /report-{ticker.toLowerCase()}
                                </span>
                                {renderMonochromeVerdict(report.verdict)}
                                <span className="text-[11px] text-[#64748b] ml-auto sm:ml-0 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#94a3b8]" />
                                  <span>{report.d}</span>
                                </span>
                              </div>

                              {/* 회사명 & 타이틀 */}
                              <h3 className="text-sm font-bold text-[#0f172a] truncate">
                                {report.company_name || ticker} ({ticker}) 13인
                                거장 가치평가 및 적정주가 보고서
                              </h3>

                              {/* 핵심 지표 뱃지 라인 (%B, 확신도, 내재가치/종가, 안정성) */}
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px] pt-0.5">
                                {percentB !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    %B:{" "}
                                    <strong className="text-[#0f172a]">
                                      {formatPercentB(percentB)}
                                    </strong>
                                  </span>
                                )}

                                {insight.confidence != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    확신도:{" "}
                                    <strong className="text-[#0f172a]">
                                      {insight.confidence.toFixed(1)}/10
                                    </strong>
                                  </span>
                                )}

                                {ratioText && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#0f172a] bg-[#0f172a] text-white">
                                    내재가치/종가:{" "}
                                    <strong className="font-bold">
                                      {ratioText}
                                    </strong>
                                  </span>
                                )}

                                {insight.fairValue != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#cbd5e1] bg-white text-[#0f172a] font-semibold">
                                    적정가: ${insight.fairValue.toFixed(2)}
                                  </span>
                                )}

                                {renderStabilityBadge(
                                  insight.intrinsicStability
                                )}
                              </div>

                              {/* 요약 텍스트 */}
                              <p className="text-xs text-[#64748b] line-clamp-1 leading-relaxed pt-0.5">
                                {report.vote_summary ||
                                  "13인 독립 표결 및 적정가 산출 완료"}
                                {insight.safetyPrice
                                  ? ` · 안전마진 매수가: ${insight.safetyPrice}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 pt-2 text-[#94a3b8] group-hover:text-[#0f172a]">
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </li>
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
            <div className="space-y-4">
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
              {displayedRoma.length === 0 ? (
                <EmptyState
                  icon="🏛️"
                  title="DataRoma 슈퍼인베스터 데이터가 없습니다"
                  description="좌측 'DataRoma 피드 갱신' 버튼을 누르면 그랜드 포트폴리오를 불러옵니다."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {displayedRoma.map((c, idx) => {
                    const insight = getInsight(c.ticker, c.price);
                    const percentB =
                      percentBByTicker[chartTickerKey(c.ticker)];
                    const ratioText = formatIntrinsicRatio(
                      insight.intrinsicRatioPct
                    );

                    return (
                      <li key={`roma-${c.ticker}-${idx}`}>
                        <div
                          onClick={() => onSelectCandidate(c)}
                          className="py-3.5 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-3.5 justify-between"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {renderLogo(c.ticker, c.logo_image_url)}

                            <div className="min-w-0 flex-1 space-y-1.5">
                              {/* 상단 라인 */}
                              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                                <span className="font-bold text-[#0f172a] group-hover:text-black transition-colors">
                                  ${c.ticker}
                                </span>
                                <span className="text-[#64748b] truncate max-w-[200px]">
                                  {c.name}
                                </span>
                                {c.holders != null && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border border-[#cbd5e1] bg-white text-[#0f172a] font-semibold">
                                    {c.holders}인 보유
                                  </span>
                                )}
                                {c.weight_pct != null && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border border-slate-200 bg-slate-50 text-slate-700">
                                    비중: {c.weight_pct.toFixed(2)}%
                                  </span>
                                )}
                                {renderMonochromeVerdict(insight.verdict)}
                              </div>

                              {/* 지표 라인 */}
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                                <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#0f172a] font-semibold">
                                  PRICE: ${c.price?.toFixed(2) || "-"}
                                </span>

                                {percentB !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    %B:{" "}
                                    <strong className="text-[#0f172a]">
                                      {formatPercentB(percentB)}
                                    </strong>
                                  </span>
                                )}

                                {insight.confidence != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    확신도:{" "}
                                    <strong className="text-[#0f172a]">
                                      {insight.confidence.toFixed(1)}/10
                                    </strong>
                                  </span>
                                )}

                                {ratioText && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    내재가치/종가:{" "}
                                    <strong className="text-[#0f172a] font-bold">
                                      {ratioText}
                                    </strong>
                                  </span>
                                )}

                                {renderStabilityBadge(
                                  insight.intrinsicStability
                                )}

                                {c.roe != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#64748b]">
                                    ROE: {(c.roe * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pt-2 text-[#94a3b8] group-hover:text-[#0f172a]">
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </li>
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
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  03
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  실시간 발굴 후보군
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                13인 거장 스크리닝 조건을 충족하여 분석 파이프라인 진입 대기 중인
                후보 종목 브리프입니다.{" "}
                {isAll && `(홈에서는 상위 10개만 요약 표시)`}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshLive}
                isLoading={isLoading}
                leftIcon={<RefreshCw className="w-3 h-3 text-[#64748b]" />}
                className="font-mono text-xs"
              >
                스크리너 실시간 갱신
              </Button>
            </div>

            {/* 우측: 후보군 종목 리스트 */}
            <div className="min-w-0 space-y-4">
              {displayedCandidates.length === 0 ? (
                <EmptyState
                  icon="🧭"
                  title="포착된 스크리닝 후보군이 없습니다"
                  description="'스크리너 실시간 갱신' 버튼을 눌러 실시간 스크리닝을 수행하세요."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {displayedCandidates.map((c, idx) => {
                    const insight = getInsight(c.ticker, c.price);
                    const percentB =
                      percentBByTicker[chartTickerKey(c.ticker)];
                    const ratioText = formatIntrinsicRatio(
                      insight.intrinsicRatioPct
                    );

                    return (
                      <li key={`candidate-${c.ticker}-${idx}`}>
                        <div
                          onClick={() => onSelectCandidate(c)}
                          className="py-3.5 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-3.5 justify-between"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {renderLogo(c.ticker, c.logo_image_url)}

                            <div className="min-w-0 flex-1 space-y-1.5">
                              {/* 상단 라인 */}
                              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                                <span className="font-bold text-[#0f172a] group-hover:text-black transition-colors">
                                  #{c.rank || idx + 1} ${c.ticker}
                                </span>
                                <span className="text-[#64748b] truncate max-w-[200px]">
                                  {c.name}
                                </span>
                                <Badge
                                  variant="primary"
                                  className="font-mono text-[10px]"
                                >
                                  SCORE: {c.guru_score || 0}
                                </Badge>
                                {renderMonochromeVerdict(insight.verdict)}
                              </div>

                              {/* 지표 라인 */}
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                                <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#0f172a] font-semibold">
                                  PRICE: ${c.price?.toFixed(2) || "-"}
                                  {c.change_rate != null && (
                                    <span className="ml-1 text-[#64748b] font-normal">
                                      ({c.change_rate >= 0 ? "+" : ""}
                                      {c.change_rate.toFixed(2)}%)
                                    </span>
                                  )}
                                </span>

                                {percentB !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    %B:{" "}
                                    <strong className="text-[#0f172a]">
                                      {formatPercentB(percentB)}
                                    </strong>
                                  </span>
                                )}

                                {insight.confidence != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    확신도:{" "}
                                    <strong className="text-[#0f172a]">
                                      {insight.confidence.toFixed(1)}/10
                                    </strong>
                                  </span>
                                )}

                                {ratioText && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    내재가치/종가:{" "}
                                    <strong className="text-[#0f172a] font-bold">
                                      {ratioText}
                                    </strong>
                                  </span>
                                )}

                                {renderStabilityBadge(
                                  insight.intrinsicStability
                                )}

                                {c.roe != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#64748b]">
                                    ROE: {(c.roe * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pt-2 text-[#94a3b8] group-hover:text-[#0f172a]">
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </li>
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

      {/* ── 5. SECTION 04: PIPELINE & SYSTEM AUDIT ── */}
      {isVisible("sec-audit") && (
        <section
          id="sec-audit"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  04
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  파이프라인 & 감사 로그
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                12:00 정기 배치 파이프라인의 실시간 진행 현황, 단계별 소요 시간 및
                시스템 감사 오류 로그를 통합 모니터링합니다.
              </p>
            </div>

            {/* 우측 */}
            <div className="min-w-0 space-y-6">
              <PipelineProgressCard
                progress={pipelineProgress}
                isLoading={isLoading}
                onRefresh={onRefreshPipeline}
              />

              <div className="pt-4 border-t border-[#f1f5f9]">
                <LogsTab
                  logs={systemLogs}
                  isLoading={isLoading}
                  onRefresh={onRefreshLogs}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. SECTION 05: 13인 투자 거장 철학 & 심층 가이드 (my/financial 연동) ── */}
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
              SeedTick 리서치 파이프라인에서 실제 독립 평가를 수행하는 13인 투자
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
