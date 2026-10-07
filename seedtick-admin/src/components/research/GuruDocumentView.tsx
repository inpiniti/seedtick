"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  BookOpen,
  Quote,
  Scale,
  Award,
  Users,
  ExternalLink,
  CheckCircle2,
  Bookmark,
  FileText,
} from "lucide-react";
import { getGuruDetail } from "@/lib/guruMasterData";
import { findGuruPersona } from "@/lib/guruPersonas";
import { GuruReportRow } from "@/types/api";
import { extractValuationConsensus, formatIntrinsicRatio } from "@/lib/insightUtils";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { Button } from "@/components/ui/Button";

interface GuruDocumentViewProps {
  guruSlug: string;
  guruReports: GuruReportRow[];
  onBack: () => void;
  onSelectReport: (report: GuruReportRow) => void;
}

export function GuruDocumentView({
  guruSlug,
  guruReports,
  onBack,
  onSelectReport,
}: GuruDocumentViewProps) {
  const [activeTab, setActiveTab] = useState<"philosophy" | "book" | "votes">("philosophy");
  const [opinionFilter, setOpinionFilter] = useState<string>("ALL");

  const guru = useMemo(() => getGuruDetail(guruSlug), [guruSlug]);

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

    guruReports.forEach((rep) => {
      if (!rep.summaries || !Array.isArray(rep.summaries)) return;

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
  }, [guru, guruReports]);

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

  if (!guru) {
    return (
      <div className="p-12 text-center font-mono text-sm text-[#64748b]">
        해당 거장 정보를 찾을 수 없습니다.
        <div className="mt-4">
          <Button variant="secondary" onClick={onBack}>
            카탈로그로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <article className="flex-1 min-w-0 flex flex-col bg-white font-sans divide-y divide-[#e2e8f0]">
      {/* ── 1. 브레드크럼 & 뒤로가기 바 ── */}
      <nav
        aria-label="거장 문서 네비게이션"
        className="px-6 lg:px-12 py-3.5 bg-[#f8fafc] flex items-center justify-between text-xs font-mono"
      >
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[#0f172a] hover:text-black font-semibold cursor-pointer group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>카탈로그로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2 text-[#64748b] hidden sm:flex">
          <span>SeedTick Research</span>
          <span>/</span>
          <span>13 Gurus</span>
          <span>/</span>
          <span className="font-semibold text-[#0f172a]">{guru.name}</span>
        </div>
      </nav>

      {/* ── 2. 에디토리얼 거장 헤더 ── */}
      <header className="px-6 lg:px-12 py-8 lg:py-10 bg-white space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap font-mono text-xs text-[#64748b]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#0f172a] uppercase">
              GURU PROFILE
            </span>
            <span>·</span>
            <span>{guru.englishName}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1] font-semibold text-2xs uppercase">
            {guru.style}
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            {guru.name}
            <span className="ml-3 text-lg sm:text-2xl font-normal font-mono text-[#94a3b8]">
              {guru.englishName}
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[#334155] font-medium leading-relaxed max-w-3xl">
            {guru.oneLiner}
          </p>
        </div>

        {/* 대표 어록 */}
        {guru.quote && (
          <div className="p-4 sm:p-5 rounded-md bg-[#f8fafc] border-l-4 border-[#0f172a] text-sm sm:text-base text-[#1e293b] italic flex gap-3 shadow-2xs">
            <Quote className="w-5 h-5 text-[#94a3b8] shrink-0 mt-0.5" />
            <p className="leading-relaxed font-serif">&ldquo;{guru.quote}&rdquo;</p>
          </div>
        )}

        {/* 핵심 메타 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded border border-[#e2e8f0] bg-[#fafafa] space-y-1">
            <span className="text-[10px] text-[#94a3b8] uppercase font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>대표 필독서</span>
            </span>
            <p className="font-semibold text-[#0f172a] truncate">{guru.bookTitle}</p>
          </div>
          <div className="p-3.5 rounded border border-[#e2e8f0] bg-[#fafafa] space-y-1">
            <span className="text-[10px] text-[#94a3b8] uppercase font-semibold flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              <span>핵심 가치평가 방식</span>
            </span>
            <p className="font-semibold text-[#0f172a] truncate">
              {guru.focusMetrics.join(", ")}
            </p>
          </div>
          <div className="p-3.5 rounded border border-[#e2e8f0] bg-[#fafafa] space-y-1">
            <span className="text-[10px] text-[#94a3b8] uppercase font-semibold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>현재 분석 종목 표결</span>
            </span>
            <p className="font-semibold text-[#0f172a]">
              총 {voteStats.total}건 (매수 {voteStats.buy} · 매도 {voteStats.sell})
            </p>
          </div>
        </div>
      </header>

      {/* ── 3. 탭 네비게이션 ── */}
      <nav
        aria-label="거장 문서 섹션"
        className="px-6 lg:px-12 bg-white sticky top-[56px] z-10 border-b border-[#e2e8f0] flex items-center gap-8 font-mono text-xs overflow-x-auto"
      >
        <button
          onClick={() => setActiveTab("philosophy")}
          className={`py-3.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === "philosophy"
              ? "border-[#0f172a] text-[#0f172a]"
              : "border-transparent text-[#64748b] hover:text-[#0f172a]"
          }`}
        >
          01. 투자 철학 & 체크리스트 프로토콜
        </button>
        <button
          onClick={() => setActiveTab("book")}
          className={`py-3.5 border-b-2 font-semibold transition-colors cursor-pointer shrink-0 ${
            activeTab === "book"
              ? "border-[#0f172a] text-[#0f172a]"
              : "border-transparent text-[#64748b] hover:text-[#0f172a]"
          }`}
        >
          02. 필독 명저 요약 해설 ({guru.bookTitle})
        </button>
        <button
          onClick={() => setActiveTab("votes")}
          className={`py-3.5 border-b-2 font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "votes"
              ? "border-[#0f172a] text-[#0f172a]"
              : "border-transparent text-[#64748b] hover:text-[#0f172a]"
          }`}
        >
          <span>03. 현재 종목 표결 현황</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1]">
            {voteStats.total}
          </span>
        </button>
      </nav>

      {/* ── 4. 탭 콘텐츠 영역 ── */}
      <div className="px-6 lg:px-12 py-8 lg:py-10">
        {activeTab === "philosophy" && (
          <section className="space-y-8 max-w-4xl">
            {/* 요약 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-md border border-[#e2e8f0] bg-[#fafafa] space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>4대 핵심 투자 원칙</span>
                </span>
                <ul className="space-y-2">
                  {guru.philosophy.map((p, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-[#334155] leading-relaxed"
                    >
                      <span className="font-mono font-bold text-[#0f172a]">
                        0{idx + 1}.
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-md border border-[#e2e8f0] bg-[#fafafa] space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>심사 체크리스트 기준</span>
                </span>
                <div className="space-y-2">
                  {guru.checklistRules.map((rule, idx) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <span className="font-semibold text-[#0f172a]">
                        • {rule.title}
                      </span>
                      <p className="text-[11px] text-[#64748b] pl-2.5">
                        {rule.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 거장 에이전트 원문 판정 가이드 */}
            <div className="pt-6 border-t border-[#f1f5f9] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#94a3b8] font-bold">
                  System Persona & Evaluation Protocol (.claude/agents)
                </h3>
                <span className="font-mono text-2xs text-[#94a3b8]">
                  AUTONOMOUS EVALUATION PROMPT
                </span>
              </div>
              <div className="p-6 rounded-md border border-[#e2e8f0] bg-white">
                <MarkdownViewer content={guru.agentMarkdown} />
              </div>
            </div>
          </section>
        )}

        {activeTab === "book" && (
          <section className="space-y-6 max-w-4xl">
            <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0f172a]" />
                <span className="font-bold text-[#0f172a]">{guru.bookTitle}</span>
              </div>
              <span className="text-[#64748b]">
                Masterwork Summary & Key Takeaways
              </span>
            </div>

            <div className="p-6 lg:p-8 rounded-md border border-[#e2e8f0] bg-white">
              <MarkdownViewer content={guru.bookMarkdown} />
            </div>
          </section>
        )}

        {activeTab === "votes" && (
          <section className="space-y-6 max-w-4xl">
            {/* 표결 통계 요약 바 */}
            <div className="p-4 rounded-md bg-[#fafafa] border border-[#e2e8f0] space-y-3">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-[#0f172a]">
                  현재 포트폴리오 분석 종목 표결 현황
                </span>
                <span className="text-[#64748b]">
                  총 {voteStats.total}개 종목 평가 완료
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                <button
                  onClick={() => setOpinionFilter("ALL")}
                  className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    opinionFilter === "ALL"
                      ? "bg-[#0f172a] text-white border-[#0f172a]"
                      : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                  }`}
                >
                  전체 ({voteStats.total})
                </button>
                <button
                  onClick={() => setOpinionFilter("매수")}
                  className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    opinionFilter === "매수"
                      ? "bg-[#0f172a] text-white border-[#0f172a]"
                      : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                  }`}
                >
                  매수 ({voteStats.buy})
                </button>
                <button
                  onClick={() => setOpinionFilter("보유")}
                  className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    opinionFilter === "보유"
                      ? "bg-[#0f172a] text-white border-[#0f172a]"
                      : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                  }`}
                >
                  보유 ({voteStats.hold})
                </button>
                <button
                  onClick={() => setOpinionFilter("관망")}
                  className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                    opinionFilter === "관망"
                      ? "bg-[#0f172a] text-white border-[#0f172a]"
                      : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-100"
                  }`}
                >
                  관망 ({voteStats.wait})
                </button>
                <button
                  onClick={() => setOpinionFilter("매도")}
                  className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
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
                    onClick={() => onSelectReport(v.report)}
                    className="p-4 hover:bg-[#f8fafc] transition-colors cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#0f172a] group-hover:underline underline-offset-2">
                          ${v.ticker}
                        </span>
                        {v.companyName && (
                          <span className="text-xs text-[#64748b] truncate">
                            {v.companyName}
                          </span>
                        )}
                        <span
                          className={`font-mono text-2xs px-2 py-0.5 rounded border font-semibold ${
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
                        <p className="text-xs text-[#475569] line-clamp-2 leading-relaxed">
                          {v.opinionText}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-xs text-[#64748b]">
                      {v.intrinsicRatio != null && (
                        <span className="text-2xs text-[#475569] bg-[#f8fafc] px-2 py-0.5 rounded border border-[#e2e8f0]">
                          내재가치 {formatIntrinsicRatio(v.intrinsicRatio)}
                        </span>
                      )}
                      <ExternalLink className="w-4 h-4 text-[#94a3b8] group-hover:text-[#0f172a] transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── 5. 하단 복귀 액션 바 ── */}
      <footer className="mt-auto px-6 lg:px-12 py-6 bg-[#fafafa] border-t border-[#e2e8f0] flex items-center justify-between font-mono text-xs text-[#64748b]">
        <span>SeedTick Research Archive · 13 Gurus Knowledge Base</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>카탈로그로 돌아가기</span>
        </Button>
      </footer>
    </article>
  );
}
