"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  X,
  BookOpen,
  CheckCircle2,
  Quote,
  Scale,
  ExternalLink,
} from "lucide-react";
import { GuruPersona, findGuruPersona } from "@/lib/guruPersonas";
import { GuruReportRow } from "@/types/api";
import { extractValuationConsensus, formatIntrinsicRatio } from "@/lib/insightUtils";

interface GuruDetailModalProps {
  guru: GuruPersona | null;
  reports: GuruReportRow[];
  onClose: () => void;
  onSelectReport?: (report: GuruReportRow) => void;
}

export function GuruDetailModal({
  guru,
  reports,
  onClose,
  onSelectReport,
}: GuruDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"philosophy" | "stocks">("philosophy");
  const [opinionFilter, setOpinionFilter] = useState<string>("ALL");

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 현재 종목 리포트에서 해당 거장이 표결한 종목 추출
  const guruVotes = useMemo(() => {
    if (!guru) return [];

    const results: Array<{
      ticker: string;
      companyName?: string | null;
      verdict: string;
      confidence?: number;
      opinionText?: string;
      intrinsicRatio?: number | null;
      report: GuruReportRow;
    }> = [];

    reports.forEach((rep) => {
      if (!rep.summaries || !Array.isArray(rep.summaries)) return;

      // summaries 중 이 거장과 매칭되는 항목 찾기
      const matched = rep.summaries.find((op) => {
        const raw = op.persona || op.guru_name || "";
        const p = findGuruPersona(raw);
        return p && p.slug === guru.slug;
      });

      if (matched) {
        const v = matched.verdict || matched.stance || "관망";
        const valConsensus = extractValuationConsensus(rep);
        let ratio: number | null = null;
        if (
          valConsensus?.fair_value_price &&
          rep.current_price &&
          rep.current_price > 0
        ) {
          ratio = valConsensus.fair_value_price / rep.current_price;
        }

        results.push({
          ticker: rep.ticker,
          companyName: rep.company_name,
          verdict: v,
          confidence: matched.confidence,
          opinionText:
            matched.rationale ||
            (matched.core_arguments && matched.core_arguments.length > 0
              ? matched.core_arguments.join(" ")
              : matched.quote),
          intrinsicRatio: ratio,
          report: rep,
        });
      }
    });

    return results;
  }, [guru, reports]);

  // 표결 통계
  const voteStats = useMemo(() => {
    const buy = guruVotes.filter((v) => v.verdict.includes("매수")).length;
    const hold = guruVotes.filter((v) => v.verdict.includes("보유")).length;
    const wait = guruVotes.filter((v) => v.verdict.includes("관망")).length;
    const sell = guruVotes.filter((v) => v.verdict.includes("매도")).length;
    return { buy, hold, wait, sell, total: guruVotes.length };
  }, [guruVotes]);

  const filteredVotes = useMemo(() => {
    if (opinionFilter === "ALL") return guruVotes;
    return guruVotes.filter((v) => v.verdict.includes(opinionFilter));
  }, [guruVotes, opinionFilter]);

  if (!guru) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guru-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white rounded-lg border border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden text-[#0f172a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <header className="px-6 py-5 bg-[#fafafa] border-b border-[#e2e8f0] flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] font-semibold">
                {guru.style}
              </span>
              <span className="font-mono text-xs text-[#94a3b8]">
                {guru.englishName}
              </span>
            </div>
            <h2
              id="guru-modal-title"
              className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight"
            >
              {guru.name}
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] font-medium leading-relaxed">
              {guru.oneLiner}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#94a3b8] hover:text-[#0f172a] rounded-md hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 탭 네비게이션 */}
        <nav
          aria-label="거장 세부 정보 탭"
          className="px-6 bg-white border-b border-[#e2e8f0] flex items-center gap-6 font-mono text-xs shrink-0"
        >
          <button
            onClick={() => setActiveTab("philosophy")}
            className={`py-3 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === "philosophy"
                ? "border-[#0f172a] text-[#0f172a]"
                : "border-transparent text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            투자 철학 & 체크리스트
          </button>
          <button
            onClick={() => setActiveTab("stocks")}
            className={`py-3 border-b-2 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "stocks"
                ? "border-[#0f172a] text-[#0f172a]"
                : "border-transparent text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <span>현재 표결 종목 현황</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1]">
              {voteStats.total}
            </span>
          </button>
        </nav>

        {/* 모달 바디 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "philosophy" ? (
            <div className="space-y-6">
              {/* 대표 어록 */}
              {guru.quote && (
                <div className="p-4 rounded-md bg-[#f8fafc] border-l-4 border-[#0f172a] text-xs sm:text-sm text-[#334155] italic flex gap-3">
                  <Quote className="w-4 h-4 text-[#94a3b8] shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-serif">
                    &ldquo;{guru.quote}&rdquo;
                  </p>
                </div>
              )}

              {/* 대표 저서 카드 */}
              {guru.bookTitle && (
                <div className="p-4 rounded-md border border-[#e2e8f0] bg-white space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#0f172a] font-semibold">
                    <BookOpen className="w-4 h-4 text-[#0f172a]" />
                    <span>필독서: {guru.bookTitle}</span>
                  </div>
                  <p className="text-xs text-[#64748b] leading-relaxed">
                    {guru.bookSummary}
                  </p>
                </div>
              )}

              {/* 투자 철학 4대 원칙 */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#94a3b8]">
                  Core Investment Principles
                </h3>
                <ul className="space-y-2">
                  {guru.philosophy.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-[#334155] leading-relaxed"
                    >
                      <span className="font-mono text-[#0f172a] font-bold shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 체크리스트 판정 기준 */}
              {guru.checklistRules && guru.checklistRules.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#94a3b8]">
                    Evaluation Checklist & Rules
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {guru.checklistRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded border border-[#e2e8f0] bg-[#fafafa] space-y-1"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0f172a]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0f172a]" />
                          <span>{rule.title}</span>
                        </div>
                        <p className="text-[11px] text-[#64748b] leading-relaxed">
                          {rule.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 밸류에이션 접근법 */}
              {guru.valuationMethod && (
                <div className="p-4 rounded-md border border-[#e2e8f0] bg-[#fafafa] space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#0f172a] font-semibold">
                    <Scale className="w-4 h-4 text-[#0f172a]" />
                    <span>밸류에이션 & 적정가 산출 철학</span>
                  </div>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {guru.valuationMethod}
                  </p>
                </div>
              )}

              {/* 핵심 모니터링 지표 태그 */}
              <div className="space-y-2 pt-2 border-t border-[#f1f5f9]">
                <span className="text-[11px] font-mono text-[#94a3b8] uppercase block">
                  Focus Financial Metrics
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {guru.focusMetrics.map((metric) => (
                    <span
                      key={metric}
                      className="px-2 py-0.5 rounded text-xs font-mono border border-[#cbd5e1] bg-white text-[#334155]"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 표결 통계 요약 바 */}
              <div className="p-4 rounded-md bg-[#fafafa] border border-[#e2e8f0] space-y-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold text-[#0f172a]">
                    현재 분석 대상 종목 표결 현황
                  </span>
                  <span className="text-[#64748b]">
                    총 {voteStats.total}개 종목 평가 완료
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                  <button
                    onClick={() => setOpinionFilter("ALL")}
                    className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                      opinionFilter === "ALL"
                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                        : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                    }`}
                  >
                    전체 ({voteStats.total})
                  </button>
                  <button
                    onClick={() => setOpinionFilter("매수")}
                    className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                      opinionFilter === "매수"
                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                        : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                    }`}
                  >
                    매수 ({voteStats.buy})
                  </button>
                  <button
                    onClick={() => setOpinionFilter("보유")}
                    className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                      opinionFilter === "보유"
                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                        : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                    }`}
                  >
                    보유 ({voteStats.hold})
                  </button>
                  <button
                    onClick={() => setOpinionFilter("관망")}
                    className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                      opinionFilter === "관망"
                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                        : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                    }`}
                  >
                    관망 ({voteStats.wait})
                  </button>
                  <button
                    onClick={() => setOpinionFilter("매도")}
                    className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                      opinionFilter === "매도"
                        ? "bg-[#0f172a] text-white border-[#0f172a]"
                        : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                    }`}
                  >
                    매도 ({voteStats.sell})
                  </button>
                </div>
              </div>

              {/* 종목 리스트 */}
              {filteredVotes.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-[#94a3b8] bg-[#fafafa] rounded border border-dashed border-[#cbd5e1]">
                  해당 의견으로 분류된 종목이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-md overflow-hidden bg-white">
                  {filteredVotes.map((v) => (
                    <div
                      key={v.ticker}
                      onClick={() => {
                        onClose();
                        onSelectReport?.(v.report);
                      }}
                      className="p-3.5 hover:bg-[#f8fafc] transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#0f172a] group-hover:underline underline-offset-2">
                            ${v.ticker}
                          </span>
                          {v.companyName && (
                            <span className="text-xs text-[#64748b] truncate">
                              {v.companyName}
                            </span>
                          )}
                          <span
                            className={`font-mono text-2xs px-1.5 py-0.5 rounded border font-semibold ${
                              v.verdict.includes("매수")
                                ? "bg-[#0f172a] text-white border-[#0f172a]"
                                : v.verdict.includes("매도")
                                ? "bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]"
                                : "bg-white text-[#334155] border-[#cbd5e1]"
                            }`}
                          >
                            {v.verdict}
                            {v.confidence ? ` ${v.confidence}/10` : ""}
                          </span>
                        </div>
                        {v.opinionText && (
                          <p className="text-xs text-[#475569] line-clamp-1">
                            {v.opinionText}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono text-xs text-[#64748b]">
                        {v.intrinsicRatio != null && (
                          <span className="text-2xs text-[#475569] bg-[#f8fafc] px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                            내재가치 {formatIntrinsicRatio(v.intrinsicRatio)}
                          </span>
                        )}
                        <ExternalLink className="w-3.5 h-3.5 text-[#94a3b8] group-hover:text-[#0f172a] transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <footer className="px-6 py-3 bg-[#fafafa] border-t border-[#e2e8f0] flex items-center justify-between font-mono text-xs text-[#64748b] shrink-0">
          <span>SeedTick Guru Knowledge Base</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-white border border-[#cbd5e1] hover:border-[#0f172a] text-[#0f172a] font-semibold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
