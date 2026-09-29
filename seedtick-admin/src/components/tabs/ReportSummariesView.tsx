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
        title="아직 거장별 서머리가 등록되지 않았어요"
        description="분석 파이프라인에서 13인 거장 요약이 완성되면 여기에 나타나요."
      />
    );
  }

  // 의견에 따른 뱃지 스타일 헬퍼
  const getVerdictVariant = (v?: string): "success" | "danger" | "warning" | "primary" | "neutral" => {
    const text = (v || "").trim();
    if (text === "매수") return "success";
    if (text === "매도") return "danger";
    if (text === "보유") return "primary";
    return "neutral"; // 관망 등
  };

  return (
    <div className="space-y-4">
      {/* 안내 헤더 */}
      <div className="flex items-center justify-between text-xs text-[#8b95a1] pb-1 border-b border-[#f2f4f6]">
        <span>총 {summaries.length}인의 투자 거장 개별 분석 요약</span>
        <span>확신도 (1~10점 척도)</span>
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
              className="p-4 rounded-2xl bg-[#ffffff] border border-[#e5e8eb] shadow-xs flex flex-col justify-between hover:border-[#3182f6]/40 transition-colors"
            >
              <div className="space-y-3">
                {/* 상단: 거장 이름 + 의견 뱃지 + 확신도 게이지 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-[#191f28] flex items-center gap-1.5">
                      <span>{name}</span>
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-16 h-1.5 bg-[#f2f4f6] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#3182f6] rounded-full"
                          style={{ width: `${Math.min(100, (confidence / 10) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[#8b95a1]">
                        확신도 {confidence}/10
                      </span>
                    </div>
                  </div>
                  <Badge variant={getVerdictVariant(verdict)} className="shrink-0 font-bold px-2.5 py-0.5">
                    {verdict}
                  </Badge>
                </div>

                {/* 대표 발언 (인용구) */}
                {quote && (
                  <div className="relative pl-3.5 pr-2.5 py-2 bg-[#f8fafd] rounded-xl border-l-2 border-[#3182f6] text-xs text-[#333d4b] italic flex items-start gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-[#3182f6]/70 shrink-0 mt-0.5" />
                    <span>&ldquo;{quote}&rdquo;</span>
                  </div>
                )}

                {/* 적정가 / 목표가 범위 */}
                {targetPrice && (
                  <div className="flex items-center gap-1.5 text-xs bg-[#f2f4f6] px-2.5 py-1.5 rounded-lg text-[#191f28]">
                    <Target className="w-3.5 h-3.5 text-[#3182f6] shrink-0" />
                    <span className="text-[#6b7684]">적정 가격대:</span>
                    <span className="font-bold text-[#191f28]">{targetPrice}</span>
                  </div>
                )}

                {/* 핵심 논거 목록 */}
                {args.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-[#6b7684] block">핵심 투자 논거</span>
                    <ul className="space-y-1 text-xs text-[#333d4b]">
                      {args.map((arg, aIdx) => (
                        <li key={aIdx} className="flex items-start gap-1.5 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#03b26c] shrink-0 mt-0.5" />
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 트리거 / 재검토 조건 */}
                {triggers.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-[#f2f4f6]">
                    <span className="text-[11px] font-bold text-[#8b95a1] block">재검토 / 트리거 조건</span>
                    <ul className="space-y-1 text-xs text-[#6b7684]">
                      {triggers.map((trig, tIdx) => (
                        <li key={tIdx} className="flex items-start gap-1.5 leading-relaxed">
                          <AlertCircle className="w-3.5 h-3.5 text-[#ff9500] shrink-0 mt-0.5" />
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
