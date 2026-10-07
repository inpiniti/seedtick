"use client";

import React, { useState } from "react";
import { GuruReportRow, ValuationConsensus } from "@/types/api";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { ReportSummariesView } from "@/components/tabs/ReportSummariesView";
import { ReportDatapackView } from "@/components/tabs/ReportDatapackView";
import { StockChartView } from "@/components/tabs/StockChartView";
import {
  FileText,
  Users,
  PieChart,
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface ResearchDocumentModalProps {
  report: GuruReportRow | null;
  isOpen: boolean;
  onClose: () => void;
  availableDates?: string[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isLoadingDate?: boolean;
}

export function extractValuationConsensus(
  report?: GuruReportRow | null
): ValuationConsensus | null {
  if (!report) return null;

  // 1. datapack.valuation_consensus 확인
  const consensus = report.datapack?.valuation_consensus;
  if (
    consensus &&
    (consensus.fair_value_price ||
      consensus.target_price_band ||
      consensus.safety_entry_price)
  ) {
    return consensus;
  }

  // 2. final_report 마크다운에서 정규식 파싱
  const md = report.final_report;
  if (!md) return null;

  let fairValuePrice: number | null = null;
  const fvMatch = md.match(
    /(?:종합\s*적정\s*내재가치|종합\s*적정가|적정\s*내재가치|적정가)[:\s\*]*[$₩]?\s*([\d,]+(?:\.\d+)?)/
  );
  if (fvMatch) {
    const raw = fvMatch[1].replace(/,/g, "").trim();
    const val = parseFloat(raw);
    if (!isNaN(val)) fairValuePrice = val;
  }

  let targetPriceBand: string | null = null;
  const bandMatch = md.match(
    /(?:적정\s*밴드|목표\s*밴드|밸류에이션\s*밴드)[:\s\*]*([^\n\)|]+)/
  );
  if (bandMatch) {
    targetPriceBand = bandMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let safetyEntryPrice: string | null = null;
  const safeMatch = md.match(
    /(?:\[안전마진\s*매수가\]|안전마진\s*매수가|안전마진\s*가격)[:\s\*]*([^\n|]+)/
  );
  if (safeMatch) {
    safetyEntryPrice = safeMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let optimisticTargetPrice: string | null = null;
  const targetMatch = md.match(
    /(?:\[목표\s*매도가\]|목표\s*매도가|낙관적\s*목표주가|목표가)[:\s\*]*([^\n|]+)/
  );
  if (targetMatch) {
    optimisticTargetPrice = targetMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  if (
    fairValuePrice ||
    targetPriceBand ||
    safetyEntryPrice ||
    optimisticTargetPrice
  ) {
    return {
      fair_value_price: fairValuePrice,
      target_price_band: targetPriceBand,
      safety_entry_price: safetyEntryPrice,
      optimistic_target_price: optimisticTargetPrice,
    };
  }

  return null;
}

export function ResearchDocumentModal({
  report,
  isOpen,
  onClose,
  availableDates = [],
  selectedDate,
  onSelectDate,
  isLoadingDate = false,
}: ResearchDocumentModalProps) {
  const [activeTab, setActiveTab] = useState<
    "final" | "summaries" | "datapack" | "discussion" | "chart"
  >("final");

  if (!report) return null;

  const valConsensus = extractValuationConsensus(report);
  const ticker = report.ticker;
  const companyName = report.company_name || ticker;
  const docId = `DOC-${report.d?.replace(/-/g, "") || "LIVE"}-${ticker}`;
  const verdict = report.verdict || "의견 조율 중";

  const getVerdictBadgeVariant = (v: string): "success" | "danger" | "warning" | "primary" | "neutral" => {
    if (v.includes("매수") || v.includes("buy")) return "success";
    if (v.includes("매도") || v.includes("sell")) return "danger";
    if (v.includes("보유") || v.includes("hold")) return "primary";
    return "neutral";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="wide">
      <div className="space-y-5 font-sans">
        {/* 1. 상단 화이트페이퍼 메타데이터 헤더 */}
        <div className="pb-4 border-b border-[#e2e8f0]">
          <div className="flex items-center justify-between gap-3 flex-wrap font-mono text-[11px] text-[#64748b]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#0f172a] uppercase">{docId}</span>
              <span>·</span>
              <span>PUBLISHED: {report.d || "TODAY"}</span>
            </div>
            {/* 과거 발행 이력 드롭다운 */}
            {availableDates.length > 1 && onSelectDate && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Calendar className="w-3.5 h-3.5 text-[#64748b]" />
                <span className="text-[#64748b]">이력:</span>
                <select
                  value={selectedDate || report.d}
                  onChange={(e) => onSelectDate(e.target.value)}
                  disabled={isLoadingDate}
                  className="bg-[#f8fafc] border border-[#e2e8f0] rounded px-2 py-0.5 text-[11px] font-mono text-[#0f172a] focus:outline-hidden"
                >
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {date} {date === report.d ? "(현재)" : ""}
                    </option>
                  ))}
                </select>
                {isLoadingDate && (
                  <span className="text-blue-600 animate-pulse text-[10px]">
                    로드 중...
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                  {companyName}
                </h2>
                <span className="font-mono text-sm px-2 py-0.5 bg-[#f1f5f9] border border-[#e2e8f0] text-[#0f172a] font-semibold rounded">
                  ${ticker}
                </span>
                <Badge variant={getVerdictBadgeVariant(verdict)} className="font-mono text-xs uppercase">
                  {verdict}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b] mt-1 leading-relaxed">
                13인 투자 거장 독립 분석 및 정량 밸류에이션 기반 종합 리서치 보고서
              </p>
            </div>

            {/* 현재가 / 내재가치 요약 카드 */}
            <div className="flex items-center gap-3 bg-[#f8fafc] border border-[#e2e8f0] px-3.5 py-2 rounded-md font-mono text-xs">
              <div>
                <span className="text-[#64748b] block text-[10px]">CURRENT PRICE</span>
                <span className="font-semibold text-sm text-[#0f172a]">
                  {report.current_price ? `$${report.current_price.toLocaleString()}` : "-"}
                </span>
              </div>
              <div className="h-6 w-px bg-[#e2e8f0]" />
              <div>
                <span className="text-blue-700 block text-[10px]">FAIR VALUE</span>
                <span className="font-bold text-sm text-blue-700">
                  {valConsensus?.fair_value_price
                    ? `$${valConsensus.fair_value_price.toFixed(2)}`
                    : "합의 완료"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 핵심 표결 & 안전마진 밴드 브리프 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
          <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex flex-col justify-between">
            <span className="text-[11px] text-[#64748b] uppercase">
              Guru Consensus Votes
            </span>
            <div className="text-xs sm:text-sm font-semibold text-[#0f172a] mt-1">
              {report.vote_summary || "13인 표결 및 합의 완료"}
            </div>
          </div>
          <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex flex-col justify-between">
            <span className="text-[11px] text-[#64748b] uppercase">
              Target Price Band & Safety Margin
            </span>
            <div className="text-xs sm:text-sm font-semibold text-[#0f172a] mt-1 flex items-center justify-between gap-2 flex-wrap">
              <span>{valConsensus?.target_price_band || "밸류에이션 모델 수렴"}</span>
              {valConsensus?.safety_entry_price && (
                <span className="text-emerald-700 text-xs">
                  안전매수: {valConsensus.safety_entry_price}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. 문서 섹션 탭 (aihero 스타일 미니멀 탭) */}
        <div className="flex items-center gap-1 border-b border-[#e2e8f0] font-mono text-xs overflow-x-auto pb-px">
          {[
            { id: "final" as const, label: "01. 마스터 보고서", icon: FileText },
            { id: "summaries" as const, label: "02. 13인 개별 서머리", icon: Users },
            { id: "datapack" as const, label: "03. 심층 데이터팩", icon: PieChart },
            { id: "discussion" as const, label: "04. 원탁 토론 전문", icon: Users },
            { id: "chart" as const, label: "05. 일봉 및 밴드", icon: TrendingUp },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-[#0f172a] text-[#0f172a] bg-slate-50/50"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a] hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 4. 문서 본문 렌더링 영역 */}
        <div className="p-4 sm:p-6 rounded-md bg-white border border-[#e2e8f0] shadow-xs max-h-[60vh] overflow-y-auto">
          {activeTab === "final" && (
            report.final_report ? (
              <MarkdownViewer content={report.final_report} />
            ) : (
              <EmptyState
                icon="📄"
                title="최종 마스터 보고서가 아직 생성되지 않았습니다"
                description="12:00 정기 분석 파이프라인이 실행되면 이곳에 전체 심층 보고서가 문서화됩니다."
              />
            )
          )}

          {activeTab === "summaries" && (
            <ReportSummariesView summaries={report.summaries} />
          )}

          {activeTab === "datapack" && (
            <ReportDatapackView datapack={report.datapack} />
          )}

          {activeTab === "discussion" && (
            report.discussion ? (
              <div className="font-sans leading-relaxed">
                <MarkdownViewer content={report.discussion} />
              </div>
            ) : (
              <EmptyState
                icon="💬"
                title="원탁 토론 전문이 등록되지 않았습니다"
                description="거장 AI 모델의 심층 상호 반론 토론 세션 내용이 이곳에 보관됩니다."
              />
            )
          )}

          {activeTab === "chart" && (
            <StockChartView
              ticker={report.ticker}
              companyName={report.company_name}
            />
          )}
        </div>

        {/* 5. 푸터 */}
        <div className="flex items-center justify-between pt-2 border-t border-[#e2e8f0] text-xs font-mono text-[#64748b]">
          <span>SeedTick Research Archive · {ticker}</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
