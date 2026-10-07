"use client";

import React, { useMemo } from "react";
import { GuruSummaryItem } from "@/types/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { TallyBar, TallyCounts } from "@/components/ui/TallyBar";
import { findGuruPersona } from "@/lib/guruPersonas";
import { Target, Check, AlertCircle } from "lucide-react";

interface ReportSummariesViewProps {
  summaries: GuruSummaryItem[] | null;
}

export function ReportSummariesView({ summaries }: ReportSummariesViewProps) {
  // 13인 표결 집계 (탈리 바 데이터 계산)
  const tally = useMemo<TallyCounts>(() => {
    const counts: TallyCounts = { buy: 0, hold: 0, watch: 0, sell: 0 };
    if (!summaries) return counts;

    for (const item of summaries) {
      const v = (item.verdict || item.stance || "").toLowerCase();
      if (v.includes("매수") || v.includes("buy")) counts.buy += 1;
      else if (v.includes("매도") || v.includes("sell")) counts.sell += 1;
      else if (v.includes("관망") || v.includes("watch")) counts.watch += 1;
      else counts.hold += 1;
    }
    return counts;
  }, [summaries]);

  if (!summaries || summaries.length === 0) {
    return (
      <EmptyState
        title="거장별 개별 분석 서머리가 등록되지 않았습니다"
        description="분석 파이프라인에서 13인 거장 요약이 완성되면 여기에 문서 형태로 아카이빙됩니다."
      />
    );
  }

  // 모노크롬 투자의견 뱃지 렌더러 (알록달록 색상 배제)
  const renderMonochromeVerdict = (v?: string) => {
    const text = (v || "관망").trim();
    const lower = text.toLowerCase();

    if (lower.includes("매수") || lower.includes("buy")) {
      return (
        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#0f172a] text-white border border-[#0f172a] shrink-0">
          {text}
        </span>
      );
    }
    if (lower.includes("매도") || lower.includes("sell")) {
      return (
        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-white text-[#0f172a] border border-[#64748b] shrink-0">
          {text}
        </span>
      );
    }
    return (
      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] shrink-0">
        {text}
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── 상단 13인 원탁 표결 탈리 바 (C:\Users\user\repositories\my\financial 참조) ── */}
      <div className="p-4 rounded-md border border-[#e2e8f0] bg-[#f8fafc] space-y-2.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-semibold text-[#0f172a] uppercase">
            13 Guru Round-Table Vote Tally
          </span>
          <span className="text-[#64748b]">
            총 {summaries.length}인 참여 · 합의 표결 비례 바
          </span>
        </div>
        <TallyBar tally={tally} />
      </div>

      {/* ── 거장 카드 리스트 (2열 그리드) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {summaries.map((item, index) => {
          const rawName = item.persona || item.guru_name || `거장 #${index + 1}`;
          const name = rawName.replace("-", " ");
          const persona = findGuruPersona(rawName);
          const verdict = item.verdict || item.stance || "관망";
          const confidence = item.confidence || 5;
          const targetPrice = item.target_price_range;
          const quote = item.quote;
          const args =
            item.core_arguments || (item.rationale ? [item.rationale] : []);
          const triggers = item.trigger_conditions || [];

          return (
            <div
              key={index}
              className="p-4 rounded-md bg-white border border-[#e2e8f0] flex flex-col justify-between hover:border-[#0f172a] transition-colors shadow-xs"
            >
              <div className="space-y-3">
                {/* 상단: 거장 이름 + 철학 태그 + 흑백 의견 뱃지 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-[#0f172a]">
                        {name}
                      </h4>
                      {persona && (
                        <span className="text-[10px] font-mono text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] px-1.5 py-0.2 rounded">
                          {persona.englishName}
                        </span>
                      )}
                    </div>

                    {/* 거장 핵심 철학 한 줄 (my/financial 메타데이터 연동) */}
                    {persona && (
                      <p className="text-[11px] text-[#64748b] leading-snug pt-0.5 truncate max-w-sm">
                        {persona.oneLiner}
                      </p>
                    )}

                    {/* 확신도 인라인 표시 */}
                    <div className="flex items-center gap-1.5 mt-1.5 font-mono text-[11px] text-[#64748b]">
                      <div className="w-16 h-1 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0f172a] rounded-full"
                          style={{
                            width: `${Math.min(100, (confidence / 10) * 100)}%`,
                          }}
                        />
                      </div>
                      <span>확신도 {confidence}/10</span>
                    </div>
                  </div>

                  {renderMonochromeVerdict(verdict)}
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
                    <span className="font-semibold text-[#0f172a]">
                      {targetPrice}
                    </span>
                  </div>
                )}

                {/* 핵심 논거 목록 */}
                {args.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono font-semibold text-[#64748b] block uppercase tracking-wider">
                      Core Rationale
                    </span>
                    <ul className="space-y-1 text-xs text-[#334155]">
                      {args.map((arg, aIdx) => (
                        <li
                          key={aIdx}
                          className="flex items-start gap-1.5 leading-relaxed"
                        >
                          <Check className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 재검토 조건 */}
                {triggers.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-[#f1f5f9]">
                    <span className="text-[10px] font-mono font-semibold text-[#64748b] block uppercase tracking-wider">
                      Re-evaluation Triggers
                    </span>
                    <ul className="space-y-1 text-xs text-[#64748b]">
                      {triggers.map((trig, tIdx) => (
                        <li
                          key={tIdx}
                          className="flex items-start gap-1.5 leading-relaxed"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-[#64748b] shrink-0 mt-0.5" />
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
