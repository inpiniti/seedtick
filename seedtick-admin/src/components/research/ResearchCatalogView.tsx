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
import { extractValuationConsensus } from "@/components/research/ResearchDocumentModal";
import {
  Search,
  ArrowRight,
  TrendingUp,
  Target,
  Users,
  Compass,
  Layers,
  Terminal,
  ChevronRight,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  FileText,
} from "lucide-react";

interface ResearchCatalogViewProps {
  guruReports: GuruReportRow[];
  liveCandidates: StockCandidate[];
  romaCandidates: StockCandidate[];
  systemLogs: SystemLogItem[];
  pipelineProgress: PipelineProgress | null;
  isLoading: boolean;
  isRomaLoading: boolean;
  onRefreshLive: () => void;
  onRefreshRoma: () => void;
  onRefreshPipeline: () => void;
  onRefreshLogs: (level?: string) => void;
  onSelectReport: (report: GuruReportRow) => void;
  onSelectCandidate: (candidate: StockCandidate) => void;
  activeSectionFilter: string;
}

export function ResearchCatalogView({
  guruReports,
  liveCandidates,
  romaCandidates,
  systemLogs,
  pipelineProgress,
  isLoading,
  isRomaLoading,
  onRefreshLive,
  onRefreshRoma,
  onRefreshPipeline,
  onRefreshLogs,
  onSelectReport,
  onSelectCandidate,
  activeSectionFilter,
}: ResearchCatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");

  // 검색 필터링
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return guruReports;
    const q = searchQuery.toLowerCase();
    return guruReports.filter(
      (r) =>
        r.ticker.toLowerCase().includes(q) ||
        (r.company_name && r.company_name.toLowerCase().includes(q)) ||
        (r.verdict && r.verdict.toLowerCase().includes(q)) ||
        (r.final_report && r.final_report.toLowerCase().includes(q))
    );
  }, [guruReports, searchQuery]);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return liveCandidates;
    const q = searchQuery.toLowerCase();
    return liveCandidates.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [liveCandidates, searchQuery]);

  const filteredRoma = useMemo(() => {
    if (!searchQuery.trim()) return romaCandidates;
    const q = searchQuery.toLowerCase();
    return romaCandidates.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [romaCandidates, searchQuery]);

  // 상위 합의 보고서 (매수 또는 고확신도 순)
  const topConsensusReports = useMemo(() => {
    return filteredReports.slice(0, 8);
  }, [filteredReports]);

  const isVisible = (secId: string) => {
    if (activeSectionFilter === "all") return true;
    return activeSectionFilter === secId;
  };

  const getVerdictBadge = (verdict?: string | null) => {
    const v = (verdict || "").toLowerCase();
    if (v.includes("매수") || v.includes("buy")) {
      return (
        <Badge variant="success" className="font-mono text-[10px] uppercase">
          {verdict || "BUY"}
        </Badge>
      );
    }
    if (v.includes("매도") || v.includes("sell")) {
      return (
        <Badge variant="danger" className="font-mono text-[10px] uppercase">
          {verdict || "SELL"}
        </Badge>
      );
    }
    if (v.includes("보유") || v.includes("hold")) {
      return (
        <Badge variant="primary" className="font-mono text-[10px] uppercase">
          {verdict || "HOLD"}
        </Badge>
      );
    }
    return (
      <Badge variant="neutral" className="font-mono text-[10px] uppercase">
        {verdict || "REVIEW"}
      </Badge>
    );
  };

  return (
    <div className="flex-1 min-w-0 bg-white font-sans divide-y divide-[#e2e8f0]">
      {/* ── 1. HERO SECTION (aihero.dev Inspired Editorial Banner) ── */}
      <section
        id="hero"
        className="px-6 lg:px-12 py-10 lg:py-14 bg-gradient-to-b from-[#ffffff] via-[#fafafa] to-white"
      >
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#e2e8f0] bg-white font-mono text-xs text-[#64748b]">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>AI VALUE INVESTING RESEARCH SYSTEM</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-bold text-[#0f172a] tracking-tight leading-[1.15]">
            13인 투자 거장의 AI 가치평가 및 심층 리서치 보고서
          </h1>

          <p className="text-sm sm:text-base text-[#64748b] leading-relaxed max-w-3xl">
            단순한 주가 시세판이 아닌, 투자 거장들의 정량·정성 분석과 내재가치
            합의를 정제된 문서로 아카이빙합니다. 최우선 가치평가 합의서부터
            슈퍼인베스터 포트폴리오까지 일관된 문서 브리프로 탐색하세요.
          </p>

          {/* 메타데이터 요약 DL */}
          <dl className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-[#64748b]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#0f172a]">{guruReports.length}+</span>
              <span>REPORTS ARCHIVED</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#0f172a]">13 GURUS</span>
              <span>INDEPENDENT CONSENSUS</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#0f172a]">DAILY 12:00 KST</span>
              <span>AUTOMATED BATCH</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
              <span className="text-emerald-700 font-semibold">AI ENGINE READY</span>
            </div>
          </dl>

          {/* 빠른 검색창 (aihero 슬래시 검색) */}
          <div className="pt-3 max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickers (e.g. AAPL, NVDA), gurus, or keywords... [ / ]"
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] shadow-xs text-[#0f172a] placeholder-[#94a3b8]"
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

      {/* ── 2. SECTION 01: TOP CONSENSUS (가치평가 합의서) ── */}
      {isVisible("sec-consensus") && (
        <section
          id="sec-consensus"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-8 lg:gap-12">
            {/* 좌측: 섹션 타이틀 & 설명 */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  01
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  가치평가 합의서
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                13인의 투자 거장이 각자의 철학과 정량 모델로 독립 표결을 거친 후,
                최종 도출한 종합 적정 내재가치 및 안전마진 밴드 핵심 합의 문서입니다.
              </p>
              {topConsensusReports.length > 0 && (
                <div className="pt-1 font-mono text-xs">
                  <span className="text-[#94a3b8]">Start with: </span>
                  <button
                    onClick={() => onSelectReport(topConsensusReports[0])}
                    className="text-[#0f172a] font-semibold underline underline-offset-4 hover:text-blue-600 cursor-pointer"
                  >
                    /consensus-{topConsensusReports[0].ticker.toLowerCase()}
                  </button>
                </div>
              )}
            </div>

            {/* 우측: 문서 리스트 */}
            <div className="min-w-0">
              {topConsensusReports.length === 0 ? (
                <EmptyState
                  icon="📄"
                  title="합의 보고서가 없습니다"
                  description="12:00 정기 배치 파이프라인을 실행하면 분석 합의서가 생성됩니다."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2 font-sans">
                  {topConsensusReports.map((report) => {
                    const consensus = extractValuationConsensus(report);
                    const fairPrice = consensus?.fair_value_price;
                    const ticker = report.ticker;

                    return (
                      <li key={report.id || ticker}>
                        <div
                          onClick={() => onSelectReport(report)}
                          className="py-3.5 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-4 justify-between"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {/* 티커 아바타 / 배지 */}
                            <div className="w-10 h-10 rounded-md bg-[#0f172a] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              {ticker.slice(0, 3)}
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-[#64748b] group-hover:text-blue-600 transition-colors">
                                  /consensus-{ticker.toLowerCase()}
                                </span>
                                {getVerdictBadge(report.verdict)}
                                {fairPrice && (
                                  <span className="font-mono text-[11px] px-1.5 py-0.2 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-semibold">
                                    FAIR: ${fairPrice.toFixed(2)}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors truncate">
                                {report.company_name || ticker} ({ticker}) 13인 거장 종합 가치평가 보고서
                              </h3>

                              <p className="text-xs text-[#64748b] line-clamp-1 leading-relaxed">
                                {report.vote_summary || "13인 표결 및 종합 적정가 산출 완료"}
                                {consensus?.safety_entry_price
                                  ? ` · 안전마진 매수가: ${consensus.safety_entry_price}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 pt-1 font-mono text-xs text-[#94a3b8] group-hover:text-[#0f172a]">
                            <span className="hidden sm:inline text-[11px]">
                              {report.d}
                            </span>
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

      {/* ── 3. SECTION 02: MASTER RESEARCH ARCHIVE (13인 거장 심층 분석) ── */}
      {isVisible("sec-guru") && (
        <section
          id="sec-guru"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  02
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  13인 거장 심층 리서치
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                워런 버핏의 경제적 해자, 벤저민 그레이엄의 청산가치, 피터 린치의
                성장률 대비 밸류에이션(PEG) 등 13인 거장의 개별 시각이 상세히
                담긴 리서치 아카이브입니다.
              </p>
              <div className="flex flex-wrap gap-1 font-mono text-[10px] text-[#64748b] pt-1">
                {[
                  "버핏",
                  "그레이엄",
                  "린치",
                  "멍거",
                  "클라먼",
                  "그린블라트",
                  "파브라이",
                  "막스",
                ].map((name) => (
                  <span
                    key={name}
                    className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc]"
                  >
                    #{name}
                  </span>
                ))}
              </div>
            </div>

            {/* 우측 */}
            <div className="min-w-0">
              {filteredReports.length === 0 ? (
                <EmptyState
                  icon="📚"
                  title="등록된 거장 리포트가 없습니다"
                  description="상단 파이프라인 버튼을 눌러 새 분석 보고서를 생성할 수 있습니다."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2 font-sans">
                  {filteredReports.slice(0, 10).map((report) => (
                    <li key={`guru-${report.id || report.ticker}`}>
                      <div
                        onClick={() => onSelectReport(report)}
                        className="py-3 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-4 justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#0f172a]">
                              {report.ticker}
                            </span>
                            <span className="font-mono text-xs text-[#94a3b8]">
                              · {report.company_name || "미국 상장사"}
                            </span>
                            {getVerdictBadge(report.verdict)}
                          </div>
                          <p className="text-xs text-[#64748b] line-clamp-1">
                            {report.summaries && report.summaries.length > 0
                              ? `13인 중 ${report.summaries.length}인 개별 코멘트 등록 · 대표 의견: "${report.summaries[0].quote || report.vote_summary}"`
                              : report.vote_summary || "심층 리서치 문서 열람 가능"}
                          </p>
                        </div>

                        <ChevronRight className="w-4 h-4 text-[#94a3b8] transition-transform group-hover:translate-x-1 shrink-0 mt-1" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. SECTION 03: SUPERINVESTORS (DataRoma 포트폴리오) ── */}
      {isVisible("sec-roma") && (
        <section
          id="sec-roma"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  03
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  슈퍼인베스터 포트폴리오
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                미국 탑 슈퍼인베스터 10명 이상이 동시 보유하고 있는 DataRoma 그랜드
                포트폴리오 종목 브리프입니다. 거물들의 최근 13F 지분 증감 현황을 추적합니다.
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

            {/* 우측 */}
            <div className="min-w-0">
              {filteredRoma.length === 0 ? (
                <EmptyState
                  icon="🏛️"
                  title="DataRoma 슈퍼인베스터 데이터가 없습니다"
                  description="좌측 'DataRoma 피드 갱신' 버튼을 누르면 그랜드 포트폴리오를 불러옵니다."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2 font-sans">
                  {filteredRoma.slice(0, 10).map((c, idx) => (
                    <li key={`roma-${c.ticker}-${idx}`}>
                      <div
                        onClick={() => onSelectCandidate(c)}
                        className="py-3 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-4 justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#0f172a]">
                              {c.ticker}
                            </span>
                            <span className="text-xs text-[#64748b] truncate max-w-[180px]">
                              {c.name}
                            </span>
                            {c.holders != null && (
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded border border-blue-200 bg-blue-50/60 text-blue-700">
                                {c.holders}인 보유
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono text-[#64748b]">
                            <span>PRICE: ${c.price?.toFixed(2) || "-"}</span>
                            {c.weight_pct != null && <span>WEIGHT: {c.weight_pct.toFixed(2)}%</span>}
                            {c.roe != null && <span>ROE: {(c.roe * 100).toFixed(1)}%</span>}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-[#94a3b8] transition-transform group-hover:translate-x-1 shrink-0 mt-1" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 5. SECTION 04: DISCOVERY SCREENER (실시간 발굴 후보군) ── */}
      {isVisible("sec-screener") && (
        <section
          id="sec-screener"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  04
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  실시간 발굴 후보군
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
                13인 거장 스크리닝 필터를 통과하여 오늘 정기 파이프라인 분석
                대상으로 포착된 후보 종목 브리프입니다.
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

            {/* 우측 */}
            <div className="min-w-0">
              {filteredCandidates.length === 0 ? (
                <EmptyState
                  icon="🧭"
                  title="포착된 스크리닝 후보군이 없습니다"
                  description="'스크리너 실시간 갱신' 버튼을 눌러 시장 실시간 스크리닝을 수행하세요."
                />
              ) : (
                <ul className="divide-y divide-[#f1f5f9] -my-2 font-sans">
                  {filteredCandidates.slice(0, 10).map((c, idx) => (
                    <li key={`candidate-${c.ticker}-${idx}`}>
                      <div
                        onClick={() => onSelectCandidate(c)}
                        className="py-3 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-4 justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#0f172a]">
                              #{c.rank || idx + 1} {c.ticker}
                            </span>
                            <span className="text-xs text-[#64748b] truncate max-w-[180px]">
                              {c.name}
                            </span>
                            <Badge variant="primary" className="font-mono text-[10px]">
                              SCORE: {c.guru_score || 0}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono text-[#64748b]">
                            <span>PRICE: ${c.price?.toFixed(2) || "-"}</span>
                            {c.change_rate != null && (
                              <span
                                className={
                                  c.change_rate >= 0 ? "text-rose-600" : "text-emerald-600"
                                }
                              >
                                {c.change_rate >= 0 ? "+" : ""}
                                {c.change_rate.toFixed(2)}%
                              </span>
                            )}
                            {c.roe != null && <span>ROE: {(c.roe * 100).toFixed(1)}%</span>}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-[#94a3b8] transition-transform group-hover:translate-x-1 shrink-0 mt-1" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. SECTION 05: PIPELINE & SYSTEM AUDIT (관제 및 감사 로그) ── */}
      {isVisible("sec-audit") && (
        <section
          id="sec-audit"
          className="px-6 lg:px-12 py-10 lg:py-12 bg-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-8 lg:gap-12">
            {/* 좌측 */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                  05
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

            {/* 우측: 파이프라인 카드 + 시스템 로그 */}
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
