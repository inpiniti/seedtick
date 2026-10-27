"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Globe,
  Radio,
  Sparkles,
  TrendingUp,
  Tag,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import type { MarketBriefing } from "@/types/api";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { Badge } from "@/components/ui/Badge";

interface BriefingDetailViewProps {
  briefing: MarketBriefing;
  availableDates: string[];
  isEn?: boolean;
}

export function BriefingDetailView({
  briefing,
  availableDates,
  isEn = false,
}: BriefingDetailViewProps) {
  const router = useRouter();
  const [copied, setCopied] = useState<boolean>(false);

  const sources = briefing.sources || {};
  const tickers = briefing.tickers || [];
  const topics = briefing.topics || [];
  const summary3 = briefing.summary_3lines || [];

  const currentIndex = availableDates.indexOf(briefing.d);
  const prevDate = currentIndex > 0 ? availableDates[currentIndex - 1] : null; // 더 최신
  const nextDate = currentIndex >= 0 && currentIndex < availableDates.length - 1 ? availableDates[currentIndex + 1] : null; // 더 과거

  const basePath = isEn ? "/en/briefings" : "/briefings";

  const handleCopyContent = async () => {
    if (!briefing.content) return;
    try {
      await navigator.clipboard.writeText(briefing.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy briefing:", e);
    }
  };

  return (
    <article className="space-y-6 font-sans">
      {/* ── 1. 상단 브레드크럼 & 일자 전환 툴바 ── */}
      <div className="p-4 sm:p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 좌측: 목록으로 돌아가기 & 날짜 네비게이션 */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={basePath}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-[#0f172a] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl shadow-sm transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-[#64748b]" />
            <span>{isEn ? "All Briefings" : "전체 브리핑 목록"}</span>
          </Link>

          {/* 일자 바로가기 드롭다운 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748b] font-medium hidden sm:inline">
              {isEn ? "Date:" : "일자 선택:"}
            </span>
            <select
              value={briefing.d}
              onChange={(e) => {
                const target = e.target.value;
                if (target) {
                  router.push(`${basePath}/${target}`);
                }
              }}
              className="px-3.5 py-2 text-sm font-semibold font-mono text-[#0f172a] bg-white border border-[#cbd5e1] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
            >
              {availableDates.map((d, idx) => (
                <option key={d} value={d}>
                  {d} {idx === 0 ? (isEn ? "— Latest" : "— 최신 발행") : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 우측: 이전/다음 날짜 & 전문 복사 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          {prevDate && (
            <Link
              href={`${basePath}/${prevDate}`}
              className="px-3 py-2 text-xs font-semibold text-[#0f172a] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl shadow-sm transition-colors flex items-center gap-1"
              title={isEn ? "Next Newer Briefing" : "다음 최신 브리핑"}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{isEn ? "Newer" : "최신글"}</span>
            </Link>
          )}

          {nextDate && (
            <Link
              href={`${basePath}/${nextDate}`}
              className="px-3 py-2 text-xs font-semibold text-[#0f172a] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl shadow-sm transition-colors flex items-center gap-1"
              title={isEn ? "Previous Older Briefing" : "이전 과거 브리핑"}
            >
              <span>{isEn ? "Older" : "이전글"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}

          <button
            type="button"
            onClick={handleCopyContent}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-[#0f172a] hover:bg-[#1e293b] text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>{isEn ? "Copied!" : "전문 복사 완료"}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{isEn ? "Copy Full Article" : "전문 복사하기"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. 브리핑 헤드라인 및 요약 메타 카드 ── */}
      <div className="p-6 sm:p-8 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs space-y-5">
        {/* 통계 메타 배지 바 (Reportist Badge 컴포넌트) */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary" className="font-mono">
            <Calendar className="w-3 h-3 opacity-70" />
            <span>{briefing.d}</span>
          </Badge>

          <Badge variant="neutral" className="font-mono">
            <Globe className="w-3 h-3 text-[#64748b]" />
            <span>
              {isEn
                ? `Total ${briefing.raw_count || 0} Sources`
                : `총 ${briefing.raw_count || 0}건 분석`}
            </span>
          </Badge>

          {sources.news !== undefined && sources.news > 0 && (
            <Badge variant="neutral" className="font-mono">
              뉴스 {sources.news}건
            </Badge>
          )}
          {sources.reddit !== undefined && sources.reddit > 0 && (
            <Badge variant="neutral" className="font-mono">
              Reddit {sources.reddit}건
            </Badge>
          )}
          {sources.kr_community !== undefined && sources.kr_community > 0 && (
            <Badge variant="neutral" className="font-mono">
              국내 커뮤니티 {sources.kr_community}건
            </Badge>
          )}
          {sources.stocktwits !== undefined && sources.stocktwits > 0 && (
            <Badge variant="neutral" className="font-mono">
              StockTwits {sources.stocktwits}건
            </Badge>
          )}
        </div>

        {/* 메인 헤드라인 (SEO 단일 h1) */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] leading-tight tracking-tight">
            {briefing.title}
          </h1>
        </div>

        {/* 오늘의 시장 3줄 핵심 요약 블록 */}
        {summary3.length > 0 && (
          <div className="p-5 sm:p-6 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0f172a]">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{isEn ? "Today's 3-Line Market Summary" : "오늘의 시장 3줄 핵심 요약"}</span>
            </div>
            <ul className="space-y-2 text-sm text-[#334155] leading-relaxed">
              {summary3.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-[#0f172a] shrink-0 select-none">
                    {idx + 1}.
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 언급된 주요 티커 (Reportist Ticker 디렉토리/상세 연동) */}
        {tickers.length > 0 && (
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#64748b] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {isEn ? "Mentioned Stocks:" : "언급된 주요 종목:"}
            </span>
            {tickers.map((ticker) => (
              <Link
                key={ticker}
                href={isEn ? `/en/stocks/${encodeURIComponent(ticker)}` : `/stocks/${encodeURIComponent(ticker)}`}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] hover:border-[#0f172a] rounded-lg font-mono text-xs font-bold text-[#0f172a] transition-all shadow-2xs group"
              >
                <span>${ticker}</span>
                <ExternalLink className="w-3 h-3 text-[#94a3b8] group-hover:text-[#0f172a] transition-colors" />
              </Link>
            ))}
          </div>
        )}

        {/* 핵심 토픽/키워드 태그 */}
        {topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Tag className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
            {topics.map((topic, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-0.5 bg-[#f1f5f9] text-[#475569] font-medium rounded-md border border-[#e2e8f0]"
              >
                #{topic.length > 40 ? topic.slice(0, 40) + "..." : topic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. 마크다운 뉴스레터 전문 뷰어 ── */}
      <div className="p-6 sm:p-10 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">
              {isEn ? "Full AI Newsletter Briefing" : "데일리 브리핑 전문 (뉴스레터)"}
            </h2>
          </div>
          <span className="text-xs text-[#94a3b8] font-mono">
            {briefing.content.length.toLocaleString()} chars
          </span>
        </div>

        <div className="prose prose-slate max-w-none text-[#0f172a]">
          <MarkdownViewer content={briefing.content} />
        </div>
      </div>
    </article>
  );
}
