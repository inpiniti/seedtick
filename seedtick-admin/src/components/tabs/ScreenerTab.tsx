"use client";

import React, { useState } from "react";
import { GuruReportRow, PipelineProgress, StockCandidate, ValuationConsensus } from "@/types/api";
import { fetchStockChart } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { ReportSummariesView } from "@/components/tabs/ReportSummariesView";
import { ReportDatapackView } from "@/components/tabs/ReportDatapackView";
import { StockChartView } from "@/components/tabs/StockChartView";
import { PipelineProgressCard } from "@/components/tabs/PipelineProgressCard";
import { getScoreBadge, formatTime } from "@/lib/utils";
import {
  FileText,
  Search,
  Users,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
} from "lucide-react";
import {
  fetchReportByDateAndTicker,
  fetchReportDatesByTicker,
} from "@/lib/supabase";

function extractValuationConsensus(report?: GuruReportRow | null): ValuationConsensus | null {
  if (!report) return null;

  // 1. datapack.valuation_consensus 확인
  const consensus = report.datapack?.valuation_consensus;
  if (consensus && (consensus.fair_value_price || consensus.target_price_band || consensus.safety_entry_price)) {
    return consensus;
  }

  // 2. final_report 마크다운에서 정규식으로 실시간 파싱 (과거 리포트 또는 폴백)
  const md = report.final_report;
  if (!md) return null;

  let fairValuePrice: number | null = null;
  const fvMatch = md.match(/(?:종합\s*적정\s*내재가치|종합\s*적정가|적정\s*내재가치|적정가)[:\s\*]*[$₩]?\s*([\d,]+(?:\.\d+)?)/);
  if (fvMatch) {
    const raw = fvMatch[1].replace(/,/g, "").trim();
    const val = parseFloat(raw);
    if (!isNaN(val)) fairValuePrice = val;
  }

  let targetPriceBand: string | null = null;
  const bandMatch = md.match(/(?:적정\s*밴드|목표\s*밴드|밸류에이션\s*밴드)[:\s\*]*([^\n\)|]+)/);
  if (bandMatch) {
    targetPriceBand = bandMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let safetyEntryPrice: string | null = null;
  const safeMatch = md.match(/(?:\[안전마진\s*매수가\]|안전마진\s*매수가|안전마진\s*가격)[:\s\*]*([^\n|]+)/);
  if (safeMatch) {
    safetyEntryPrice = safeMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let optimisticTargetPrice: string | null = null;
  const targetMatch = md.match(/(?:\[목표\s*매도가\]|목표\s*매도가|낙관적\s*목표주가|목표가)[:\s\*]*([^\n|]+)/);
  if (targetMatch) {
    optimisticTargetPrice = targetMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  if (fairValuePrice || targetPriceBand || safetyEntryPrice || optimisticTargetPrice) {
    return {
      fair_value_price: fairValuePrice,
      target_price_band: targetPriceBand,
      safety_entry_price: safetyEntryPrice,
      optimistic_target_price: optimisticTargetPrice,
    };
  }

  return null;
}

interface ScreenerTabProps {
  guruReports: GuruReportRow[];
  liveCandidates: StockCandidate[];
  /** 두번째 스크리너: DataRoma 슈퍼인베스터 그랜드 포트폴리오 종목 */
  romaCandidates?: StockCandidate[];
  isLoading: boolean;
  isRomaLoading?: boolean;
  pipelineProgress: PipelineProgress | null;
  onRefreshLive: () => void;
  onRefreshRoma?: () => void;
  onRefreshPipeline?: () => Promise<PipelineProgress | null> | void;
}

const GURU_NAMES = [
  "종합",
  "그레이엄",
  "클라먼",
  "파브라이",
  "그린블라트",
  "코스톨라니",
  "슈웨거",
  "버핏",
  "피셔",
  "멍거",
  "린치",
  "다모다란",
  "템플턴",
  "버리",
];

export function ScreenerTab({
  guruReports,
  liveCandidates,
  romaCandidates = [],
  isLoading,
  isRomaLoading = false,
  pipelineProgress,
  onRefreshLive,
  onRefreshRoma,
  onRefreshPipeline,
}: ScreenerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"all" | "live" | "roma">("all");
  const [selectedReport, setSelectedReport] = useState<GuruReportRow | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<"final" | "discussion" | "summaries" | "datapack" | "chart">("final");
  const [searchTerm, setSearchTerm] = useState("");
  const [percentBByTicker, setPercentBByTicker] = useState<Record<string, number | null>>({});
  const [availableDatesForTicker, setAvailableDatesForTicker] = useState<string[]>([]);
  const [isLoadingReportDate, setIsLoadingReportDate] = useState(false);
  const hasAutoRequestedRoma = React.useRef(false);

  // 특정 종목의 과거 날짜 목록 동기화
  React.useEffect(() => {
    if (!selectedReport || selectedReport.id.startsWith("live-")) {
      setAvailableDatesForTicker([]);
      return;
    }

    const ticker = selectedReport.ticker;
    const localDates = guruReports
      .filter((r) => r.ticker === ticker)
      .map((r) => r.d);

    let isMounted = true;
    fetchReportDatesByTicker(ticker).then((dbDates) => {
      if (isMounted) {
        const merged = Array.from(new Set([...localDates, ...dbDates])).sort().reverse();
        setAvailableDatesForTicker(merged);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedReport?.ticker, guruReports]);

  // 특정 티커 클릭 시 저장된 리포트 열기 (targetDate 지원)
  const handleOpenReportByTicker = async (
    ticker: string,
    candidate?: StockCandidate,
    targetDate?: string
  ) => {
    let report: GuruReportRow | undefined = undefined;

    if (targetDate) {
      report = guruReports.find((r) => r.ticker === ticker && r.d === targetDate);
      if (!report) {
        setIsLoadingReportDate(true);
        const fetched = await fetchReportByDateAndTicker(targetDate, ticker);
        setIsLoadingReportDate(false);
        if (fetched) report = fetched;
      }
    }

    if (!report) {
      // 최신 리포트 탐색
      report = guruReports.find((r) => r.ticker === ticker);
    }

    if (report) {
      setSelectedReport(report);
      setReportModalOpen(true);
      setReportViewMode("final");
    } else {
      // 리포트가 아직 생성되지 않은 종목도 모달을 열고 바로 일봉 & 볼린저밴드 차트 표시
      const fallbackReport: GuruReportRow = {
        id: `live-${ticker}`,
        d: targetDate || new Date().toISOString().split("T")[0],
        ticker,
        company_name: candidate?.name || null,
        current_price: candidate?.price || null,
        verdict: "리포트 준비 중",
        overall_score: candidate?.guru_score || 0,
        vote_summary:
          candidate?.holders != null
            ? `DataRoma 슈퍼인베스터 보유 종목 (${candidate.holders}인)`
            : "실시간 스크리너 발굴 종목",
        datapack: null,
        summaries: null,
        discussion: null,
        final_report: null,
        created_at: new Date().toISOString(),
      };
      setSelectedReport(fallbackReport);
      setReportModalOpen(true);
      setReportViewMode("chart");
    }
  };

  // 모달 내에서 다른 분석 날짜 선택 시 리포트 전환
  const handleSelectReportDate = async (targetDate: string) => {
    if (!selectedReport || selectedReport.d === targetDate) return;

    setIsLoadingReportDate(true);
    try {
      const cached = guruReports.find(
        (r) => r.ticker === selectedReport.ticker && r.d === targetDate
      );
      if (cached) {
        setSelectedReport(cached);
        return;
      }

      const fetched = await fetchReportByDateAndTicker(targetDate, selectedReport.ticker);
      if (fetched) {
        setSelectedReport(fetched);
      } else {
        alert(`${targetDate} 날짜의 보고서를 불러오지 못했어요.`);
      }
    } catch (e) {
      console.error("보고서 날짜 변경 오류:", e);
    } finally {
      setIsLoadingReportDate(false);
    }
  };

  const latestReportByTicker = React.useMemo(() => {
    const map = new Map<string, GuruReportRow>();
    for (const report of guruReports) {
      const key = report.ticker.toUpperCase();
      if (!map.has(key)) {
        map.set(key, report);
      }
    }
    return map;
  }, [guruReports]);

  const getCandidateInsight = React.useCallback(
    (stock: StockCandidate) => {
      const report = latestReportByTicker.get(stock.ticker.toUpperCase());
      const consensus = extractValuationConsensus(report);
      const fairValue = consensus?.fair_value_price ?? null;
      const intrinsicRatioPct =
        fairValue != null && Number.isFinite(stock.price) && stock.price > 0
          ? (fairValue / stock.price) * 100
          : null;
      return {
        verdict: report?.verdict ?? null,
        fairValue,
        intrinsicRatioPct,
      };
    },
    [latestReportByTicker]
  );

  const matchesSearch = (stock: StockCandidate) =>
    searchTerm
      ? stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.name && stock.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;

  const sortByIntrinsicRatio = React.useCallback(
    (a: StockCandidate, b: StockCandidate) => {
      const ratioA = getCandidateInsight(a).intrinsicRatioPct;
      const ratioB = getCandidateInsight(b).intrinsicRatioPct;
      if (ratioA == null) return ratioB == null ? 0 : 1;
      if (ratioB == null) return -1;
      return ratioB - ratioA;
    },
    [getCandidateInsight]
  );

  const filteredLiveCandidates = [...liveCandidates]
    .filter(matchesSearch)
    .sort(sortByIntrinsicRatio);

  const filteredRomaCandidates = [...romaCandidates]
    .filter(matchesSearch)
    .sort(sortByIntrinsicRatio);

  type AllCandidateEntry = {
    stock: StockCandidate;
    sources: Array<"실시간" | "roma">;
  };

  const allCandidates = React.useMemo<AllCandidateEntry[]>(() => {
    const entries = new Map<string, { stock: StockCandidate; sources: Set<"실시간" | "roma"> }>();

    const addCandidates = (candidates: StockCandidate[], source: "실시간" | "roma") => {
      for (const stock of candidates) {
        const key = stock.ticker.trim().toUpperCase();
        const existing = entries.get(key);
        if (!existing) {
          entries.set(key, { stock, sources: new Set([source]) });
          continue;
        }

        existing.sources.add(source);
        existing.stock = {
          ...existing.stock,
          holders: existing.stock.holders ?? stock.holders,
          weight_pct: existing.stock.weight_pct ?? stock.weight_pct,
          hold_price: existing.stock.hold_price ?? stock.hold_price,
          week52_low: existing.stock.week52_low ?? stock.week52_low,
          week52_high: existing.stock.week52_high ?? stock.week52_high,
        };
      }
    };

    addCandidates(liveCandidates, "실시간");
    addCandidates(romaCandidates, "roma");

    return [...entries.values()]
      .sort((a, b) => sortByIntrinsicRatio(a.stock, b.stock))
      .map(({ stock, sources }) => ({ stock, sources: Array.from(sources) }));
  }, [liveCandidates, romaCandidates, sortByIntrinsicRatio]);

  const filteredAllCandidates = allCandidates.filter(({ stock }) => matchesSearch(stock));

  const chartTickerKey = (ticker: string) => ticker.trim().toUpperCase().replace(/\./g, "-");

  const formatPercentB = (percentB: number | null | undefined) => {
    if (percentB === undefined) return "계산 중";
    if (percentB === null || !Number.isFinite(percentB)) return "조회 불가";
    return `${(percentB * 100).toFixed(1)}%`;
  };

  const formatIntrinsicRatio = (ratio: number | null) => {
    if (ratio == null || !Number.isFinite(ratio)) return null;
    return `${Math.round(ratio)}%`;
  };

  React.useEffect(() => {
    if (activeSubTab !== "all" && activeSubTab !== "live" && activeSubTab !== "roma") return;

    const activeSources =
      activeSubTab === "all"
        ? [...liveCandidates, ...romaCandidates]
        : activeSubTab === "live"
          ? liveCandidates
          : romaCandidates;

    const uniqueTickers = Array.from(
      new Set(
        activeSources
          .map((s) => chartTickerKey(s.ticker))
          .filter((ticker) => Boolean(ticker) && percentBByTicker[ticker] === undefined)
      )
    );

    if (uniqueTickers.length === 0) return;

    let cancelled = false;
    const chunkSize = 6;

    const loadPercentB = async () => {
      for (let i = 0; i < uniqueTickers.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = uniqueTickers.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (ticker) => {
            try {
              const chart = await fetchStockChart(ticker, "6mo", "1d");
              return { ticker, percentB: chart.summary?.percent_b ?? null };
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (message.includes("404") || message.includes("Not Found")) {
                return { ticker, percentB: null };
              }
              console.warn(`[${ticker}] %B 조회 실패:`, err);
              return { ticker, percentB: null };
            }
          })
        );

        if (cancelled) return;
        setPercentBByTicker((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.ticker] = result.percentB;
          }
          return next;
        });
      }
    };

    loadPercentB();

    return () => {
      cancelled = true;
    };
  }, [activeSubTab, liveCandidates, romaCandidates, percentBByTicker]);

  React.useEffect(() => {
    if (
      activeSubTab === "all" &&
      romaCandidates.length === 0 &&
      !isRomaLoading &&
      onRefreshRoma &&
      !hasAutoRequestedRoma.current
    ) {
      hasAutoRequestedRoma.current = true;
      onRefreshRoma();
    }
  }, [activeSubTab, romaCandidates.length, isRomaLoading, onRefreshRoma]);

  return (
    <div className="space-y-5">
      {/* 13인 거장 파이프라인 진행 상황 (초경량 상태 표시) */}
      {pipelineProgress && pipelineProgress.status !== "idle" ? (
        <PipelineProgressCard
          progress={pipelineProgress}
          onRefresh={onRefreshPipeline}
        />
      ) : null}

      {/* 서브 탭 & 검색 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#f2f4f6] rounded-2xl w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveSubTab("all")}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "all"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            전체 ({allCandidates.length})
          </button>
          <button
            onClick={() => {
              setActiveSubTab("live");
              if (liveCandidates.length === 0 && !isLoading) {
                onRefreshLive();
              }
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "live"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            실시간 스크리너 ({liveCandidates.length})
          </button>
          <button
            onClick={() => {
              setActiveSubTab("roma");
              if (romaCandidates.length === 0 && !isRomaLoading && onRefreshRoma) {
                onRefreshRoma();
              }
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "roma"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            roma ({romaCandidates.length})
          </button>
        </div>

        {/* 검색 인풋 */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#8b95a1] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="티커 또는 종목명 검색..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e5e8eb] rounded-2xl focus:outline-hidden focus:border-[#3182f6] text-[#191f28]"
          />
        </div>
      </div>

      {/* 전체 스크리너 통합 뷰 */}
      {activeSubTab === "all" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>전체 스크리너 종목</Card.Title>
                <Card.Description>
                  실시간 스크리너와 roma 종목을 티커 중복 없이 모았어요. 내재가치/종가가 높은 순으로 보여요.
                </Card.Description>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefreshLive}
                  isLoading={isLoading}
                >
                  실시간 갱신
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefreshRoma}
                  isLoading={isRomaLoading}
                >
                  roma 갱신
                </Button>
              </div>
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {filteredAllCandidates.length === 0 && (isLoading || isRomaLoading) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] animate-pulse h-24"
                  />
                ))}
              </div>
            ) : filteredAllCandidates.length === 0 ? (
              <EmptyState
                icon={<Search className="w-8 h-8 text-[#8b95a1]" />}
                title="조회된 종목이 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 종목이 없어요.`
                    : "실시간 스크리너와 roma를 갱신하면 종목을 함께 확인할 수 있어요."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {filteredAllCandidates.map(({ stock, sources }, i) => {
                  const insight = getCandidateInsight(stock);
                  const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);
                  const percentB = percentBByTicker[stock.ticker.toUpperCase()];
                  const changeRate =
                    typeof stock.change_rate === "number" && Number.isFinite(stock.change_rate)
                      ? stock.change_rate
                      : null;

                  return (
                    <div
                      key={stock.ticker.toUpperCase()}
                      className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] hover:border-[#3182f6] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
                      onClick={() => handleOpenReportByTicker(stock.ticker, stock)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#e8f3ff] text-[#3182f6] font-bold text-xs flex items-center justify-center shrink-0">
                            {stock.ticker.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#191f28] text-sm group-hover:text-[#3182f6] transition-colors truncate">
                                {stock.ticker}
                              </span>
                              <Badge variant="primary">#{stock.rank || i + 1}</Badge>
                            </div>
                            <p className="text-xs text-[#8b95a1] truncate max-w-[150px] mt-0.5" title={stock.name}>
                              {stock.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[#191f28]">
                            ${Number.isFinite(stock.price) ? stock.price.toFixed(2) : "-"}
                          </div>
                          {changeRate !== null && (
                            <div className={`text-xs font-semibold ${changeRate >= 0 ? "text-[#f04452]" : "text-[#03b26c]"}`}>
                              {changeRate >= 0 ? "+" : ""}{changeRate.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#4e5968] pt-1.5 border-t border-[#f2f4f6]">
                        {sources.map((source) => (
                          <Badge key={source} variant="primary">{source}</Badge>
                        ))}
                        <Badge variant={insight.verdict === "매수" ? "success" : insight.verdict === "매도" ? "danger" : "neutral"}>
                          종합의견: {insight.verdict || "리포트 준비 중"}
                        </Badge>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                          %B: <strong>{formatPercentB(percentB)}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                          내재가치/종가: <strong className={insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100 ? "text-[#03b26c]" : "text-[#4e5968]"}>
                            {ratioText || "리포트 준비 중"}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#8b95a1]">
                        <span>
                          {stock.roe != null ? <>ROE: <strong className="text-[#4e5968]">{(stock.roe * 100).toFixed(1)}%</strong></> : null}
                          {stock.holders != null ? <>{stock.roe != null ? " · " : ""}보유 <strong className="text-[#4e5968]">{stock.holders}명</strong></> : null}
                        </span>
                        <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                          리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 토스 공통 스크리너 실시간 뷰 */}
      {activeSubTab === "live" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>토스 거장 공통 필터 통과 종목</Card.Title>
                <Card.Description>
                  13인의 거장 기준을 동시에 만족하는 미국 상위 200개 우량주 스크리닝 목록이에요.
                </Card.Description>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshLive}
                isLoading={isLoading}
              >
                스크리너 재실행
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] animate-pulse h-24 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200"></div>
                      <div className="space-y-1.5">
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-4 w-14 bg-gray-200 rounded ml-auto"></div>
                      <div className="h-3 w-10 bg-gray-100 rounded ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLiveCandidates.length === 0 ? (
              <EmptyState
                icon={<Search className="w-8 h-8 text-[#8b95a1]" />}
                title="스크리너 조회 결과가 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 종목이 없어요.`
                    : "상단의 [스크리너 재실행] 버튼을 누르면 실시간으로 토스 공통 스크리닝을 시작해요."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {filteredLiveCandidates.map((stock, i) => (
                  (() => {
                    const insight = getCandidateInsight(stock);
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);
                    const percentB = percentBByTicker[stock.ticker.toUpperCase()];
                    const changeRate =
                      typeof stock.change_rate === "number" && Number.isFinite(stock.change_rate)
                        ? stock.change_rate
                        : null;
                    return (
                      <div
                        key={`${stock.ticker}-${i}`}
                        className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] hover:border-[#3182f6] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
                        onClick={() => handleOpenReportByTicker(stock.ticker, stock)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {stock.logo_image_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={stock.logo_image_url}
                                alt={stock.ticker}
                                className="w-9 h-9 rounded-full object-contain bg-white border border-[#e5e8eb] p-0.5 shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#e8f3ff] text-[#3182f6] font-bold text-xs flex items-center justify-center shrink-0">
                                {stock.ticker.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#191f28] text-sm group-hover:text-[#3182f6] transition-colors truncate">
                                  {stock.ticker}
                                </span>
                                <Badge variant="primary">#{stock.rank || i + 1}</Badge>
                              </div>
                              <p className="text-xs text-[#8b95a1] truncate max-w-[130px] mt-0.5" title={stock.name}>
                                {stock.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-[#191f28]">
                              ${stock.price?.toFixed(2) || "0.00"}
                            </div>
                            {changeRate !== null && (
                              <div
                                className={`text-xs font-semibold ${
                                  changeRate >= 0
                                    ? "text-[#f04452]"
                                    : "text-[#03b26c]"
                                }`}
                              >
                                {changeRate >= 0 ? "+" : ""}
                                {changeRate.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#4e5968] pt-1.5 border-t border-[#f2f4f6]">
                          <Badge variant={insight.verdict === "매수" ? "success" : insight.verdict === "매도" ? "danger" : "neutral"}>
                            종합의견: {insight.verdict || "리포트 준비 중"}
                          </Badge>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            %B: <strong>{formatPercentB(percentB)}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            내재가치/종가:{" "}
                            <strong className={ratioText && insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100 ? "text-[#03b26c]" : "text-[#4e5968]"}>
                              {ratioText || "리포트 준비 중"}
                            </strong>
                          </span>
                        </div>

                        {stock.roe != null && (
                          <div className="flex items-center justify-between text-[11px] text-[#8b95a1]">
                            <span>
                              ROE: <strong className="text-[#4e5968]">{(stock.roe * 100).toFixed(1)}%</strong>
                            </span>
                            <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                              리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 2-2. DataRoma 슈퍼인베스터 스크리너(roma) 뷰 */}
      {activeSubTab === "roma" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>DataRoma 슈퍼인베스터 보유 종목</Card.Title>
                <Card.Description>
                  미국 슈퍼인베스터 10명 이상이 공동 보유한 종목이에요. 종목을 클릭하면
                  실시간 스크리너와 동일하게 5단계 리포트를 확인할 수 있어요.
                </Card.Description>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshRoma}
                isLoading={isRomaLoading}
              >
                roma 재실행
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {isRomaLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] animate-pulse h-24 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200"></div>
                      <div className="space-y-1.5">
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-4 w-14 bg-gray-200 rounded ml-auto"></div>
                      <div className="h-3 w-10 bg-gray-100 rounded ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRomaCandidates.length === 0 ? (
              <EmptyState
                icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                title="roma 스크리너 조회 결과가 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 종목이 없어요.`
                    : "상단의 [roma 재실행] 버튼을 누르면 DataRoma 그랜드 포트폴리오를 다시 조회해요."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {filteredRomaCandidates.map((stock, i) => (
                  (() => {
                    const insight = getCandidateInsight(stock);
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);
                    const percentB = percentBByTicker[stock.ticker.toUpperCase()];
                    return (
                      <div
                        key={`roma-${stock.ticker}-${i}`}
                        className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] hover:border-[#3182f6] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
                        onClick={() => handleOpenReportByTicker(stock.ticker, stock)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#e8f3ff] text-[#3182f6] font-bold text-xs flex items-center justify-center shrink-0">
                              {stock.ticker.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#191f28] text-sm group-hover:text-[#3182f6] transition-colors truncate">
                                  {stock.ticker}
                                </span>
                                <Badge variant="primary">
                                  {stock.holders != null ? `${stock.holders}인` : `#${i + 1}`}
                                </Badge>
                              </div>
                              <p
                                className="text-xs text-[#8b95a1] truncate max-w-[130px] mt-0.5"
                                title={stock.name}
                              >
                                {stock.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-[#191f28]">
                              ${stock.price?.toFixed(2) || "0.00"}
                            </div>
                            {stock.weight_pct != null && (
                              <div className="text-xs font-semibold text-[#8b95a1]">
                                {stock.weight_pct}%
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#4e5968] pt-1.5 border-t border-[#f2f4f6]">
                          <Badge variant={insight.verdict === "매수" ? "success" : insight.verdict === "매도" ? "danger" : "neutral"}>
                            종합의견: {insight.verdict || "리포트 준비 중"}
                          </Badge>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            %B: <strong>{formatPercentB(percentB)}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            내재가치/종가:{" "}
                            <strong className={ratioText && insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100 ? "text-[#03b26c]" : "text-[#4e5968]"}>
                              {ratioText || "리포트 준비 중"}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#8b95a1]">
                          <span>
                            보유{" "}
                            <strong className="text-[#4e5968]">
                              {stock.holders != null ? `${stock.holders}명` : "-"}
                            </strong>
                            {stock.hold_price != null ? (
                              <> · 매수가 ${stock.hold_price.toFixed(2)}</>
                            ) : null}
                          </span>
                          <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                            리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 리포트 상세 열람 모달 (마크다운 완벽 렌더링 + 과거 날짜 이동 + 즉시 매수) */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        className="sm:max-w-4xl"
      >
        <Modal.Header
          title={`${selectedReport?.ticker} 심층 투자 분석 보고서`}
          description={`${selectedReport?.company_name || ""} · 분석일: ${selectedReport?.d} · 종합 의견: ${selectedReport?.verdict}`}
        />
        <Modal.Body>
          <div className="space-y-4">
            {/* 1. 과거 날짜 리포트 선택 바 */}
            {availableDatesForTicker.length > 0 && (
              <div className="p-2.5 bg-[#f2f4f6] rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                  <span className="font-semibold text-[#6b7684] shrink-0 flex items-center gap-1 pl-1">
                    <History className="w-3.5 h-3.5 text-[#3182f6]" />
                    분석 일자:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {availableDatesForTicker.map((dt, idx) => {
                      const isCurrent = dt === selectedReport?.d;
                      const isLatest = idx === 0;
                      return (
                        <button
                          key={dt}
                          onClick={() => handleSelectReportDate(dt)}
                          disabled={isLoadingReportDate || isCurrent}
                          className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap text-xs cursor-pointer ${
                            isCurrent
                              ? "bg-[#3182f6] text-white shadow-xs"
                              : "bg-white text-[#4e5968] hover:text-[#191f28] hover:bg-white/80"
                          }`}
                        >
                          {dt} {isLatest && "(최신)"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {isLoadingReportDate && (
                  <span className="text-[11px] text-[#3182f6] font-semibold animate-pulse shrink-0">
                    리포트 불러오는 중...
                  </span>
                )}
              </div>
            )}

            {/* 표결 요약 및 종합 적정가 카드 */}
            {(() => {
              const valConsensus = extractValuationConsensus(selectedReport);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. 거장 원탁 표결 요약 */}
                  <div className="p-3.5 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#8b95a1]">
                        거장 원탁 표결 결과
                      </span>
                      <Badge variant="primary" className="text-xs font-bold px-2 py-0.5">
                        종합: {selectedReport?.verdict}
                      </Badge>
                    </div>
                    <div className="text-sm font-bold text-[#191f28]">
                      {selectedReport?.vote_summary || "13인 표결 완료"}
                    </div>
                  </div>

                  {/* 2. 종합 적정 내재가치 & 투자 실행 밴드 */}
                  <div className="p-3.5 rounded-2xl bg-[#f8fafd] border border-[#3182f6]/20 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#3182f6]">
                        종합 적정 내재가치
                      </span>
                      {valConsensus?.target_price_band && (
                        <span className="text-[11px] text-[#6b7684] bg-white px-2 py-0.5 rounded-md border border-[#e5e8eb]">
                          밴드: {valConsensus.target_price_band}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-base font-extrabold text-[#191f28]">
                        {valConsensus?.fair_value_price !== null && valConsensus?.fair_value_price !== undefined
                          ? (selectedReport?.ticker === "000660" || (selectedReport?.current_price && selectedReport.current_price > 1000)
                              ? `${valConsensus.fair_value_price.toLocaleString()}원`
                              : `$${valConsensus.fair_value_price.toFixed(2)}`)
                          : "토론 합의 중"}
                      </div>
                      {(valConsensus?.safety_entry_price || valConsensus?.optimistic_target_price) && (
                        <div className="text-[11px] text-[#4e5968] flex items-center gap-1.5 flex-wrap justify-end">
                          {valConsensus.safety_entry_price && (
                            <span><strong className="text-[#008040]">안전:</strong> {valConsensus.safety_entry_price}</span>
                          )}
                          {valConsensus.optimistic_target_price && (
                            <span><strong className="text-[#d93025]">목표:</strong> {valConsensus.optimistic_target_price}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 마크다운 뷰 탭 전환 버튼 (5개 모드: 최종보고서, 원탁토론, 개별서머리, 데이터팩, 일봉차트) */}
            <div className="flex items-center gap-1 p-1 bg-[#f2f4f6] rounded-2xl overflow-x-auto -mx-1 px-1">
              <button
                onClick={() => setReportViewMode("final")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "final"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                최종 마스터 보고서
              </button>
              <button
                onClick={() => setReportViewMode("discussion")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "discussion"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                13인 거장 원탁 토론
              </button>
              <button
                onClick={() => setReportViewMode("summaries")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "summaries"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                13인 개별 서머리
              </button>
              <button
                onClick={() => setReportViewMode("datapack")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "datapack"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                심층 데이터팩
              </button>
              <button
                onClick={() => setReportViewMode("chart")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${
                  reportViewMode === "chart"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                일봉 & 볼린저밴드
              </button>
            </div>

            {/* 리포트 본문 / 서머리 / 데이터팩 / 차트 렌더링 */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#e5e8eb] shadow-xs max-h-[62vh] overflow-y-auto">
              {reportViewMode === "final" && (
                selectedReport?.final_report ? (
                  <MarkdownViewer content={selectedReport.final_report} />
                ) : (
                  <EmptyState
                    icon={<FileText className="w-8 h-8 text-[#8b95a1]" />}
                    title="최종 보고서가 아직 생성되지 않았어요"
                    description="12:00 정기 배치 또는 수동 분석이 완료되면 이곳에 보고서가 등록돼요. '일봉 & 볼린저밴드' 탭에서 실시간 차트를 먼저 확인해 보세요."
                  />
                )
              )}

              {reportViewMode === "discussion" && (
                selectedReport?.discussion ? (
                  <MarkdownViewer content={selectedReport.discussion} />
                ) : (
                  <EmptyState
                    icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                    title="원탁 토론 전문이 아직 등록되지 않았어요"
                    description="거장 AI 분석 파이프라인이 진행되면 13인의 심층 토론 전문이 등록돼요."
                  />
                )
              )}

              {reportViewMode === "summaries" && (
                selectedReport?.summaries ? (
                  <ReportSummariesView summaries={selectedReport.summaries} />
                ) : (
                  <EmptyState
                    icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                    title="거장 개별 서머리가 아직 없어요"
                    description="리포트 파이프라인이 완료되면 13인의 종목 평가 의견이 표시돼요."
                  />
                )
              )}

              {reportViewMode === "datapack" && (
                selectedReport?.datapack ? (
                  <ReportDatapackView datapack={selectedReport.datapack} />
                ) : (
                  <EmptyState
                    icon={<FileText className="w-8 h-8 text-[#8b95a1]" />}
                    title="심층 데이터팩이 아직 없어요"
                    description="Yahoo Finance 및 재무제표 시계열 데이터팩이 수집되면 이곳에 표시돼요."
                  />
                )
              )}

              {reportViewMode === "chart" && selectedReport && (
                <StockChartView
                  ticker={selectedReport.ticker}
                  companyName={selectedReport.company_name}
                />
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-[#8b95a1] truncate hidden sm:block">
              {selectedReport?.ticker} · 분석일 {selectedReport?.d}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="secondary" onClick={() => setReportModalOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
