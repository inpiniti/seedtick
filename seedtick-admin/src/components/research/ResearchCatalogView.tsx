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
import { PipelineProgressCard } from "@/components/tabs/PipelineProgressCard";
import { LogsTab } from "@/components/tabs/LogsTab";
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
  RefreshCw,
  Layers,
  Compass,
  Target,
  Terminal,
  Filter,
} from "lucide-react";

import { SidebarSectionId } from "@/components/sidebar/ResearchSidebar";

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
}: ResearchCatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [reportVerdictFilter, setReportVerdictFilter] = useState<string>("ALL");

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

  // 내재가치 안정성 맵
  const intrinsicStabilityByTicker = useMemo(() => {
    const fairValuesByTicker = new Map<string, number[]>();
    for (const report of guruReports) {
      const fairValue = extractValuationConsensus(report)?.fair_value_price;
      if (fairValue == null || !Number.isFinite(fairValue) || fairValue <= 0) continue;
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
        ? confidenceSamples.reduce((sum, v) => sum + v, 0) / confidenceSamples.length
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

  // 1. 리포트 필터링 (검색 & 의견)
  const filteredReports = useMemo(() => {
    return guruReports.filter((r) => {
      const matchesSearch =
        !searchQuery.trim() ||
        r.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.company_name && r.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.verdict && r.verdict.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (reportVerdictFilter === "ALL") return true;
      const v = (r.verdict || "").toLowerCase();
      if (reportVerdictFilter === "BUY") return v.includes("매수") || v.includes("buy");
      if (reportVerdictFilter === "HOLD") return v.includes("보유") || v.includes("관망") || v.includes("hold");
      if (reportVerdictFilter === "SELL") return v.includes("매도") || v.includes("sell");
      return true;
    });
  }, [guruReports, searchQuery, reportVerdictFilter]);

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

  const isVisible = (secId: string) => {
    if (activeSectionFilter === "all") return true;
    return activeSectionFilter === secId;
  };

  const getVerdictBadgeVariant = (v?: string | null): "success" | "danger" | "warning" | "primary" | "neutral" => {
    if (!v) return "neutral";
    const lower = v.toLowerCase();
    if (lower.includes("매수") || lower.includes("buy")) return "success";
    if (lower.includes("매도") || lower.includes("sell")) return "danger";
    if (lower.includes("보유") || lower.includes("hold")) return "primary";
    return "neutral";
  };

  // 로고 렌더러
  const renderLogo = (ticker: string, candidateLogo?: string | null) => {
    const logoUrl =
      candidateLogo || candidateByTicker.get(ticker.toUpperCase())?.logo_image_url;

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

  return (
    <div className="flex-1 min-w-0 bg-white font-sans divide-y divide-[#e2e8f0]">
      {/* ── 1. HERO SECTION (전체 보기일 때 표시) 또는 섹션 브레드크럼 바 ── */}
      {activeSectionFilter === "all" ? (
        <section
          id="hero"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-gradient-to-b from-[#ffffff] via-[#fafafa] to-white"
        >
          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#e2e8f0] bg-white font-mono text-xs text-[#64748b]">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
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
                <span className="font-bold text-[#0f172a]">{guruReports.length}</span>
                <span>REPORTS ISSUED</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a]">{romaCandidates.length}</span>
                <span>SUPERINVESTOR STOCKS</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a]">{liveCandidates.length}</span>
                <span>DISCOVERY CANDIDATES</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
                <span className="text-emerald-700 font-semibold">12:00 BATCH ENGINE READY</span>
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
            <div className="flex items-center gap-2 font-mono text-xs text-[#64748b]">
              <button
                onClick={() => onSelectSection?.("all")}
                className="hover:text-[#0f172a] underline cursor-pointer"
              >
                ← 카탈로그 홈 (전체)
              </button>
              <span>/</span>
              <span className="text-[#0f172a] font-semibold">
                {activeSectionFilter === "sec-reports" && "01. 가치평가 및 거장 리포트"}
                {activeSectionFilter === "sec-roma" && "02. 슈퍼인베스터 포트폴리오 (DataRoma)"}
                {activeSectionFilter === "sec-screener" && "03. 실시간 발굴 후보군"}
                {activeSectionFilter === "sec-audit" && "04. 파이프라인 & 감사 로그"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              {activeSectionFilter === "sec-reports" && "가치평가 및 거장 리포트 전체"}
              {activeSectionFilter === "sec-roma" && "슈퍼인베스터 포트폴리오 (DataRoma) 전체"}
              {activeSectionFilter === "sec-screener" && "실시간 발굴 후보군 전체"}
              {activeSectionFilter === "sec-audit" && "파이프라인 & 감사 로그 모니터"}
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

      {/* ── 2. SECTION 01: 가치평가 및 거장 심층 분석 보고서 전체 (1+2 통합) ── */}
      {isVisible("sec-reports") && (
        <section
          id="sec-reports"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
            {/* 좌측: 타이틀 & 설명 & 필터 */}
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
                전체 분석 보고서 아카이브입니다. (총 {filteredReports.length}건)
              </p>

              {/* 투자의견 빠른 필터 칩 */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-mono uppercase text-[#94a3b8] block">
                  Filter by Verdict
                </span>
                <div className="flex flex-wrap gap-1 font-mono text-xs">
                  {[
                    { id: "ALL", label: `전체 (${guruReports.length})` },
                    { id: "BUY", label: "매수 합의" },
                    { id: "HOLD", label: "보유·관망" },
                    { id: "SELL", label: "매도" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setReportVerdictFilter(chip.id)}
                      className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
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

            {/* 우측: 전체 보고서 리스트 */}
            <div className="min-w-0">
              {filteredReports.length === 0 ? (
                <EmptyState
                  icon="📄"
                  title="해당 조건의 분석 보고서가 없습니다"
                  description="검색어나 필터를 변경하거나 상단 파이프라인 버튼으로 보고서를 생성하세요."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {filteredReports.map((report) => {
                    const insight = getInsight(report.ticker, report.current_price);
                    const ticker = report.ticker;
                    const percentB = percentBByTicker[chartTickerKey(ticker)];
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);

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
                                <span className="font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors">
                                  ${ticker}
                                </span>
                                <span className="text-[#94a3b8]">/report-{ticker.toLowerCase()}</span>
                                <Badge variant={getVerdictBadgeVariant(report.verdict)}>
                                  {report.verdict || "리포트 완료"}
                                </Badge>
                                <span className="text-[11px] text-[#94a3b8] ml-auto sm:ml-0">
                                  {report.d}
                                </span>
                              </div>

                              {/* 회사명 & 타이틀 */}
                              <h3 className="text-sm font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors truncate">
                                {report.company_name || ticker} ({ticker}) 13인 거장 가치평가 및 적정주가 보고서
                              </h3>

                              {/* 핵심 지표 뱃지 라인 (로고, 종합의견, %B, 확신도, 내재가치/종가, 내재가치 안정성) */}
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px] pt-0.5">
                                {percentB !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    %B: <strong>{formatPercentB(percentB)}</strong>
                                  </span>
                                )}

                                {insight.confidence != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    확신도: <strong>{insight.confidence.toFixed(1)}/10</strong>
                                  </span>
                                )}

                                {ratioText && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    내재가치/종가:{" "}
                                    <strong
                                      className={
                                        insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100
                                          ? "text-emerald-700"
                                          : "text-[#0f172a]"
                                      }
                                    >
                                      {ratioText}
                                    </strong>
                                  </span>
                                )}

                                {insight.fairValue != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-blue-200 bg-blue-50/60 text-blue-700 font-semibold">
                                    적정가: ${insight.fairValue.toFixed(2)}
                                  </span>
                                )}

                                <Badge variant={insight.stabilityMeta.variant}>
                                  안정성: {insight.stabilityMeta.text}
                                </Badge>
                              </div>

                              {/* 요약 텍스트 */}
                              <p className="text-xs text-[#64748b] line-clamp-1 leading-relaxed pt-0.5">
                                {report.vote_summary || "13인 독립 표결 및 적정가 산출 완료"}
                                {insight.safetyPrice ? ` · 안전마진 매수가: ${insight.safetyPrice}` : ""}
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
            </div>
          </div>
        </section>
      )}

      {/* ── 3. SECTION 02: 슈퍼인베스터 포트폴리오 (DataRoma 전체) ── */}
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
                포트폴리오 종목 전체 브리프입니다. (총 {filteredRoma.length}개 종목)
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

            {/* 우측: 전체 DataRoma 종목 리스트 */}
            <div className="min-w-0">
              {filteredRoma.length === 0 ? (
                <EmptyState
                  icon="🏛️"
                  title="DataRoma 슈퍼인베스터 데이터가 없습니다"
                  description="좌측 'DataRoma 피드 갱신' 버튼을 누르면 그랜드 포트폴리오를 불러옵니다."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {filteredRoma.map((c, idx) => {
                    const insight = getInsight(c.ticker, c.price);
                    const percentB = percentBByTicker[chartTickerKey(c.ticker)];
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);

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
                                <span className="font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors">
                                  ${c.ticker}
                                </span>
                                <span className="text-[#64748b] truncate max-w-[200px]">{c.name}</span>
                                {c.holders != null && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border border-blue-200 bg-blue-50/60 text-blue-700 font-semibold">
                                    {c.holders}인 보유
                                  </span>
                                )}
                                {c.weight_pct != null && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border border-slate-200 bg-slate-50 text-slate-700">
                                    비중: {c.weight_pct.toFixed(2)}%
                                  </span>
                                )}
                                <Badge variant={getVerdictBadgeVariant(insight.verdict)}>
                                  {insight.verdict || "리포트 준비 중"}
                                </Badge>
                              </div>

                              {/* 지표 라인 */}
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                                <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#0f172a] font-semibold">
                                  PRICE: ${c.price?.toFixed(2) || "-"}
                                </span>

                                {percentB !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    %B: <strong>{formatPercentB(percentB)}</strong>
                                  </span>
                                )}

                                {insight.confidence != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    확신도: <strong>{insight.confidence.toFixed(1)}/10</strong>
                                  </span>
                                )}

                                {ratioText && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    내재가치/종가:{" "}
                                    <strong
                                      className={
                                        insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100
                                          ? "text-emerald-700"
                                          : "text-[#0f172a]"
                                      }
                                    >
                                      {ratioText}
                                    </strong>
                                  </span>
                                )}

                                <Badge variant={insight.stabilityMeta.variant}>
                                  안정성: {insight.stabilityMeta.text}
                                </Badge>

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
            </div>
          </div>
        </section>
      )}

      {/* ── 4. SECTION 03: 실시간 발굴 후보군 (전체 목록) ── */}
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
                전체 후보 종목 브리프입니다. (총 {filteredCandidates.length}개 종목)
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

            {/* 우측: 전체 실시간 후보군 종목 리스트 */}
            <div className="min-w-0">
              {filteredCandidates.length === 0 ? (
                <EmptyState
                  icon="🧭"
                  title="포착된 스크리닝 후보군이 없습니다"
                  description="'스크리너 실시간 갱신' 버튼을 눌러 실시간 스크리닝을 수행하세요."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2">
                  {filteredCandidates.map((c, idx) => {
                    const insight = getInsight(c.ticker, c.price);
                    const percentB = percentBByTicker[chartTickerKey(c.ticker)];
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);

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
                                <span className="font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors">
                                  #{c.rank || idx + 1} ${c.ticker}
                                </span>
                                <span className="text-[#64748b] truncate max-w-[200px]">{c.name}</span>
                                <Badge variant="primary" className="font-mono text-[10px]">
                                  SCORE: {c.guru_score || 0}
                                </Badge>
                                <Badge variant={getVerdictBadgeVariant(insight.verdict)}>
                                  {insight.verdict || "분석 대기"}
                                </Badge>
                              </div>

                              {/* 지표 라인 */}
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                                <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#0f172a] font-semibold">
                                  PRICE: ${c.price?.toFixed(2) || "-"}
                                  {c.change_rate != null && (
                                    <span
                                      className={`ml-1 font-semibold ${
                                        c.change_rate >= 0 ? "text-rose-600" : "text-emerald-600"
                                      }`}
                                    >
                                      ({c.change_rate >= 0 ? "+" : ""}
                                      {c.change_rate.toFixed(2)}%)
                                    </span>
                                  )}
                                </span>

                                {percentB !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    %B: <strong>{formatPercentB(percentB)}</strong>
                                  </span>
                                )}

                                {insight.confidence != null && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    확신도: <strong>{insight.confidence.toFixed(1)}/10</strong>
                                  </span>
                                )}

                                {ratioText && (
                                  <span className="px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-white text-[#475569]">
                                    내재가치/종가:{" "}
                                    <strong
                                      className={
                                        insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100
                                          ? "text-emerald-700"
                                          : "text-[#0f172a]"
                                      }
                                    >
                                      {ratioText}
                                    </strong>
                                  </span>
                                )}

                                <Badge variant={insight.stabilityMeta.variant}>
                                  안정성: {insight.stabilityMeta.text}
                                </Badge>

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
    </div>
  );
}
