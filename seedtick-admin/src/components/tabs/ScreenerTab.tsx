"use client";

import React, { useState } from "react";
import { GuruReportRow, GuruVoteRow, PipelineProgress, StockCandidate, ValuationConsensus } from "@/types/api";
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
  guruVotes: GuruVoteRow[];
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
  guruVotes,
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
  const [activeSubTab, setActiveSubTab] = useState<"votes" | "live" | "roma" | "reports">("votes");
  const [selectedReport, setSelectedReport] = useState<GuruReportRow | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<"final" | "discussion" | "summaries" | "datapack" | "chart">("final");
  const [searchTerm, setSearchTerm] = useState("");

  // 날짜 필터링 상태 (과거 날짜 조회 지원)
  const [selectedVoteDate, setSelectedVoteDate] = useState<string>("ALL");
  const [selectedReportDate, setSelectedReportDate] = useState<string>("ALL");
  const [availableDatesForTicker, setAvailableDatesForTicker] = useState<string[]>([]);
  const [isLoadingReportDate, setIsLoadingReportDate] = useState(false);

  // 고유한 날짜 목록 추출 (내림차순)
  const availableReportDates = React.useMemo(() => {
    const dates = Array.from(new Set(guruReports.map((r) => r.d).filter(Boolean)));
    return dates.sort().reverse();
  }, [guruReports]);

  const availableVoteDates = React.useMemo(() => {
    const dates = Array.from(new Set(guruVotes.map((v) => v.d).filter(Boolean)));
    return dates.sort().reverse();
  }, [guruVotes]);

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

  const filteredVotes = guruVotes.filter((v) => {
    const matchesSearch = searchTerm
      ? v.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.name && v.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
    const matchesDate = selectedVoteDate === "ALL" || v.d === selectedVoteDate;
    return matchesSearch && matchesDate;
  });

  const filteredLiveCandidates = liveCandidates.filter((s) =>
    searchTerm
      ? s.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true
  );

  const filteredRomaCandidates = romaCandidates.filter((s) =>
    searchTerm
      ? s.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true
  );

  const filteredReports = guruReports.filter((r) => {
    const matchesSearch = searchTerm
      ? r.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.company_name && r.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
    const matchesDate = selectedReportDate === "ALL" || r.d === selectedReportDate;
    return matchesSearch && matchesDate;
  });

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
            onClick={() => setActiveSubTab("votes")}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "votes"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            거장 표결 ({guruVotes.length})
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
          <button
            onClick={() => setActiveSubTab("reports")}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "reports"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            리포트 보관함 ({guruReports.length})
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

      {/* 1. 거장 표결 랭킹 뷰 */}
      {activeSubTab === "votes" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>13인의 거장 표결 결과</Card.Title>
                <Card.Description>
                  버핏, 린치, 그레이엄 등 13인의 거장 평가 점수표예요. (0: 매수, 1: 보유, 2: 관망, 3: 매도)
                </Card.Description>
              </div>
              {/* 표결 날짜 선택기 */}
              {availableVoteDates.length > 0 && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#f2f4f6] px-2.5 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-[#8b95a1]" />
                  <select
                    value={selectedVoteDate}
                    onChange={(e) => setSelectedVoteDate(e.target.value)}
                    className="text-xs bg-transparent text-[#191f28] font-semibold border-none focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">전체 일자 ({guruVotes.length}건)</option>
                    {availableVoteDates.map((dt, idx) => (
                      <option key={dt} value={dt}>
                        {dt} {idx === 0 ? "(최신)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {filteredVotes.length === 0 ? (
              <EmptyState
                icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                title="표결 집계 데이터가 없어요"
                description="12:00 정기 스케줄러가 실행되거나 수동 트리거를 완료하면 이곳에 집계돼요."
              />
            ) : (
              <>
                {/* [모바일 전용] 카드 리스트 뷰 */}
                <div className="divide-y divide-[#f2f4f6] sm:hidden">
                  {filteredVotes.map((row) => {
                    const badge = getScoreBadge(row.g0);
                    const scores = [
                      row.g1, row.g2, row.g3, row.g4, row.g5,
                      row.g6, row.g7, row.g8, row.g9, row.g10,
                      row.g11, row.g12, row.g13,
                    ];
                    return (
                      <div
                        key={`m-${row.d}-${row.ticker}`}
                        className="py-3 flex flex-col gap-2 cursor-pointer hover:bg-[#f9fafb] rounded-xl px-1 transition-colors"
                        onClick={() => handleOpenReportByTicker(row.ticker, undefined, row.d)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-[#191f28]">
                              {row.ticker}
                            </span>
                            <span className="text-xs text-[#8b95a1] truncate max-w-[120px]">
                              {row.name || "-"}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        {/* 13인 점수 칩 가로 스크롤 */}
                        <div className="flex items-center gap-1 overflow-x-auto py-1">
                          {scores.map((sc, i) => {
                            const scBadge = getScoreBadge(sc);
                            return (
                              <div
                                key={i}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 shrink-0 ${scBadge.bg} ${scBadge.text}`}
                              >
                                <span className="opacity-70">{GURU_NAMES[i + 1].slice(0, 1)}:</span>
                                <span>{sc ?? "-"}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#8b95a1] pt-1">
                          <span>분석일: {row.d}</span>
                          <span className="text-[#3182f6] font-semibold flex items-center">
                            심층 리포트 보기 <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* [데스크톱 전용] 테이블 뷰 */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#f2f4f6] text-[#8b95a1] font-semibold">
                        <th className="py-3 pl-2">분석일</th>
                        <th className="py-3">티커</th>
                        <th className="py-3">종목명</th>
                        <th className="py-3 text-center">종합 의견</th>
                        <th className="py-3 text-center">표결 세부 (13인)</th>
                        <th className="py-3 pr-2 text-right">심층 리포트</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f9fafb]">
                      {filteredVotes.map((row) => {
                        const badge = getScoreBadge(row.g0);
                        const scores = [
                          row.g1, row.g2, row.g3, row.g4, row.g5,
                          row.g6, row.g7, row.g8, row.g9, row.g10,
                          row.g11, row.g12, row.g13,
                        ];
                        return (
                          <tr
                            key={`${row.d}-${row.ticker}`}
                            className="hover:bg-[#f9fafb] transition-colors"
                          >
                            <td className="py-3 pl-2 text-[#8b95a1] font-mono whitespace-nowrap">
                              {row.d}
                            </td>
                            <td className="py-3 font-bold text-sm text-[#191f28]">
                              {row.ticker}
                            </td>
                            <td className="py-3 text-[#4e5968] font-medium max-w-[140px] truncate">
                              {row.name || "-"}
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}
                              >
                                {badge.label} ({row.g0 ?? "-"})
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <div className="inline-flex gap-1 items-center justify-center">
                                {scores.map((sc, i) => {
                                  const scBadge = getScoreBadge(sc);
                                  return (
                                    <span
                                      key={i}
                                      title={`${GURU_NAMES[i + 1]}: ${scBadge.label}`}
                                      className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${scBadge.bg} ${scBadge.text}`}
                                    >
                                      {sc ?? "-"}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3 pr-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenReportByTicker(row.ticker, undefined, row.d)}
                                className="h-8 px-2 text-xs text-[#3182f6]"
                                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                              >
                                리포트 보기
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 2. 토스 공통 스크리너 실시간 뷰 */}
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
                        {stock.change_rate !== undefined && (
                          <div
                            className={`text-xs font-semibold ${
                              stock.change_rate >= 0
                                ? "text-[#f04452]"
                                : "text-[#03b26c]"
                            }`}
                          >
                            {stock.change_rate >= 0 ? "+" : ""}
                            {stock.change_rate.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {stock.roe != null && (
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#f2f4f6] text-[#8b95a1]">
                        <span>ROE: <strong className="text-[#4e5968]">{(stock.roe * 100).toFixed(1)}%</strong></span>
                        <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                          리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                        </span>
                      </div>
                    )}
                  </div>
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

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#f2f4f6] text-[#8b95a1]">
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
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 3. 리포트 보관함 뷰 */}
      {activeSubTab === "reports" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>13인 거장 5단계 심층 리포트 보관함</Card.Title>
                <Card.Description>
                  Supabase에 영구 보존된 데이터팩, 거장 원탁 토론, 마스터 투자 보고서예요.
                </Card.Description>
              </div>
              {/* 리포트 날짜 선택기 */}
              {availableReportDates.length > 0 && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#f2f4f6] px-2.5 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-[#8b95a1]" />
                  <select
                    value={selectedReportDate}
                    onChange={(e) => setSelectedReportDate(e.target.value)}
                    className="text-xs bg-transparent text-[#191f28] font-semibold border-none focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">전체 일자 ({guruReports.length}건)</option>
                    {availableReportDates.map((dt, idx) => (
                      <option key={dt} value={dt}>
                        {dt} {idx === 0 ? "(최신)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {filteredReports.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8 text-[#8b95a1]" />}
                title="보관된 리포트가 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 리포트가 없어요.`
                    : "파이프라인이 완료되면 생성된 리포트가 이곳에 자동으로 쌓여요."
                }
              />
            ) : (
              <div className="divide-y divide-[#f9fafb]">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="py-3.5 flex items-center justify-between gap-2 hover:bg-[#f9fafb] px-2 rounded-2xl transition-colors cursor-pointer"
                    onClick={() => {
                      handleOpenReportByTicker(report.ticker, undefined, report.d);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-[#e8f3ff] text-[#3182f6] flex items-center justify-center font-bold text-sm shrink-0">
                        {report.ticker.slice(0, 3)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-sm text-[#191f28] shrink-0">
                            {report.ticker}
                          </span>
                          <Badge variant="primary" className="shrink-0">
                            {report.verdict}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#8b95a1] mt-0.5 truncate">
                          {report.company_name} · {report.d}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                      className="shrink-0 hidden sm:inline-flex"
                    >
                      상세 보기
                    </Button>
                    <ChevronRight className="w-4 h-4 text-[#8b95a1] shrink-0 sm:hidden" />
                  </div>
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
