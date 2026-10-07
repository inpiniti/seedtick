"use client";

import React from "react";
import { GuruSummaryItem } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Quote, Target, AlertCircle, CheckCircle2 } from "lucide-react";

interface ReportSummariesViewProps {
  summaries: GuruSummaryItem[] | null;
}

export function ReportSummariesView({ summaries }: ReportSummariesViewProps) {
  if (!summaries || summaries.length === 0) {
    return (
      <EmptyState
        title="거장별 개별 분석 서머리가 등록되지 않았습니다"
        description="분석 파이프라인에서 13인 거장 요약이 완성되면 여기에 문서 형태로 아카이빙됩니다."
      />
    );
  }

  // 의견에 따른 뱃지 스타일 헬퍼
  const getVerdictVariant = (v?: string): "success" | "danger" | "warning" | "primary" | "neutral" => {
    const text = (v || "").trim();
    if (text === "매수") return "success";
    if (text === "매도") return "danger";
    if (text === "보유") return "primary";
    return "neutral";
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 안내 헤더 */}
      <div className="flex items-center justify-between text-xs font-mono text-[#64748b] pb-2 border-b border-[#e2e8f0]">
        <span>TOTAL: {summaries.length} GURU ASSESSMENTS</span>
        <span>CONFIDENCE SCALE (1-10)</span>
      </div>

      {/* 거장 카드 리스트 (2열 그리드) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {summaries.map((item, index) => {
          const name = (item.persona || item.guru_name || `거장 #${index + 1}`).replace("-", " ");
          const verdict = item.verdict || item.stance || "관망";
          const confidence = item.confidence || 5;
          const targetPrice = item.target_price_range;
          const quote = item.quote;
          const args = item.core_arguments || (item.rationale ? [item.rationale] : []);
          const triggers = item.trigger_conditions || [];

          return (
            <div
              key={index}
              className="p-4 rounded-md bg-white border border-[#e2e8f0] flex flex-col justify-between hover:border-slate-400 transition-colors shadow-xs"
            >
              <div className="space-y-3">
                {/* 상단: 거장 이름 + 의견 뱃지 + 확신도 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-[#0f172a] flex items-center gap-1.5">
                      <span>{name}</span>
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-[#64748b]">
                      <div className="w-16 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0f172a] rounded-full"
                          style={{ width: `${Math.min(100, (confidence / 10) * 100)}%` }}
                        />
                      </div>
                      <span>{confidence}/10</span>
                    </div>
                  </div>
                  <Badge variant={getVerdictVariant(verdict)} className="shrink-0 uppercase font-mono">
                    {verdict}
                  </Badge>
                </div>

                {/* 대표 발언 (인용구) */}
                {quote && (
                  <blockquote className="pl-3 py-1.5 my-2 border-l-2 border-[#0f172a] bg-[#f8fafc] text-xs text-[#334155] italic rounded-r leading-relaxed">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                )}

                {/* 적정가 / 목표가 범위 */}
                {targetPrice && (
                  <div className="flex items-center gap-1.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded font-mono text-[#0f172a]">
                    <Target className="w-3.5 h-3.5 text-[#64748b] shrink-0" />
                    <span className="text-[#64748b]">적정 범위:</span>
                    <span className="font-semibold text-[#0f172a]">{targetPrice}</span>
                  </div>
                )}

                {/* 핵심 논거 목록 */}
                {args.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-mono font-medium text-[#64748b] block uppercase">
                      Core Rationale
                    </span>
                    <ul className="space-y-1 text-xs text-[#334155]">
                      {args.map((arg, aIdx) => (
                        <li key={aIdx} className="flex items-start gap-1.5 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 트리거 / 재검토 조건 */}
                {triggers.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-[#f1f5f9]">
                    <span className="text-[11px] font-mono font-medium text-[#64748b] block uppercase">
                      Re-evaluation Triggers
                    </span>
                    <ul className="space-y-1 text-xs text-[#64748b]">
                      {triggers.map((trig, tIdx) => (
                        <li key={tIdx} className="flex items-start gap-1.5 leading-relaxed">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{trig}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
