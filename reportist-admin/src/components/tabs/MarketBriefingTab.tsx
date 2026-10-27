"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Newspaper,
  Calendar,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Radio,
  Sparkles,
  TrendingUp,
  Tag,
  ExternalLink,
} from "lucide-react";
import { MarketBriefing } from "@/types/api";
import { fetchMarketBriefings } from "@/lib/supabase";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { Badge } from "@/components/ui/Badge";

interface MarketBriefingTabProps {
  isEn?: boolean;
}

export function MarketBriefingTab({ isEn = false }: MarketBriefingTabProps) {
  const [briefings, setBriefings] = useState<MarketBriefing[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 브리핑 데이터 로드 (마운트 시)
  useEffect(() => {
    let active = true;
    fetchMarketBriefings(30)
      .then((data) => {
        if (!active) return;
        setBriefings(data);
        if (data.length > 0) {
          setSelectedId((prev) => (prev && data.some((b) => b.id === prev) ? prev : data[0].id));
        }
      })
      .catch((e) => {
        console.error("Failed to load market briefings:", e);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchMarketBriefings(30);
      setBriefings(data);
      if (data.length > 0) {
        setSelectedId((prev) => (prev && data.some((b) => b.id === prev) ? prev : data[0].id));
      }
    } catch (e) {
      console.error("Failed to refresh market briefings:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 현재 선택된 브리핑 객체
  const currentBriefing = useMemo(() => {
    return briefings.find((b) => b.id === selectedId) || briefings[0] || null;
  }, [briefings, selectedId]);

  // 영문 다국어 분기 (영문 데이터 우선 사용)
  const activeTitle = (isEn && currentBriefing?.title_en) ? currentBriefing.title_en : currentBriefing?.title || "";
  const activeContent = (isEn && currentBriefing?.content_en) ? currentBriefing.content_en : currentBriefing?.content || "";
  const activeSummary =
    isEn && currentBriefing?.summary_3lines_en && currentBriefing.summary_3lines_en.length > 0
      ? currentBriefing.summary_3lines_en
      : currentBriefing?.summary_3lines || [];
  const activeTopics =
    isEn && currentBriefing?.topics_en && currentBriefing.topics_en.length > 0
      ? currentBriefing.topics_en
      : currentBriefing?.topics || [];

  // 마크다운 전문 복사
  const handleCopyContent = async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy briefing:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 font-sans animate-pulse">
        <div className="p-4 sm:p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl flex items-center justify-between gap-4">
          <div className="h-9 bg-slate-200 rounded-xl w-60" />
          <div className="h-9 bg-slate-200 rounded-xl w-32" />
        </div>
        <div className="p-6 bg-white border border-[#e2e8f0] rounded-2xl space-y-4">
          <div className="h-6 bg-slate-200 rounded-md w-3/4" />
          <div className="h-4 bg-slate-200 rounded-md w-1/2" />
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-slate-200 rounded-md w-full" />
            <div className="h-4 bg-slate-200 rounded-md w-full" />
            <div className="h-4 bg-slate-200 rounded-md w-2/3" />
          </div>
        </div>
        <div className="h-64 bg-white border border-[#e2e8f0] rounded-2xl" />
      </div>
    );
  }

  if (briefings.length === 0) {
    return (
      <div className="p-12 text-center bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-2xl font-sans">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-2xs border border-[#e2e8f0]">
          <Newspaper className="w-6 h-6 text-[#64748b]" />
        </div>
        <h3 className="text-base font-bold text-[#0f172a] mb-1">
          {isEn ? "No market briefings published yet" : "아직 발행된 마켓 브리핑이 없어요"}
        </h3>
        <p className="text-xs text-[#64748b] max-w-sm mx-auto mb-5 leading-relaxed">
          {isEn
            ? "Automated daily briefing runs every midnight at 00:05 KST, curating global community pulse & 24h market news into Supabase."
            : "매일 자정 00:05 KST에 레딧, 국내 주식 커뮤니티, 주요 뉴스를 종합 수집하여 AI 브리핑을 자동으로 생성하고 저장해요."}
        </p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#cbd5e1] hover:border-[#0f172a] rounded-xl text-xs font-semibold text-[#0f172a] transition-all shadow-sm cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>{isEn ? "Refresh Data" : "다시 불러오기"}</span>
        </button>
      </div>
    );
  }

  const sources = currentBriefing?.sources || {};
  const tickers = currentBriefing?.tickers || [];

  return (
    <div className="space-y-6 font-sans">
      {/* ── 1. 상단 툴바: 일자 선택 드롭다운 + 액션 버튼 (TweetGeneratorTab 스타일 통일) ── */}
      <div className="p-4 sm:p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 좌측: 일자 선택 및 새로고침 */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs sm:text-sm font-semibold text-[#0f172a] shrink-0 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#64748b]" />
            <span>{isEn ? "Briefing Date:" : "발행 일자:"}</span>
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3.5 py-2 text-sm font-semibold font-mono text-[#0f172a] bg-white border border-[#cbd5e1] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
          >
            {briefings.map((b, idx) => (
              <option key={b.id} value={b.id}>
                {b.d} {idx === 0 ? (isEn ? "— Latest" : "— 최신 발행") : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#0f172a] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#64748b] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isEn ? "Refresh" : "새로고침"}</span>
          </button>
        </div>

        {/* 우측: 전문 복사 액션 버튼 */}
        <div className="flex items-center gap-2">
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
                <span>{isEn ? "Copied to Clipboard!" : "전문 복사 완료"}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{isEn ? "Copy Full Newsletter" : "전문 복사하기"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {currentBriefing && (
        <div className="space-y-6">
          {/* ── 2. 브리핑 헤드라인 및 요약 메타 카드 ── */}
          <div className="p-6 sm:p-7 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs space-y-5">
            {/* 통계 메타 배지 바 (reportist-admin Badge 컴포넌트 사용) */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" className="font-mono">
                <Calendar className="w-3 h-3 opacity-70" />
                <span>{currentBriefing.d}</span>
              </Badge>

              <Badge variant="neutral" className="font-mono">
                <Globe className="w-3 h-3 text-[#64748b]" />
                <span>
                  {isEn
                    ? `Total ${currentBriefing.raw_count || 0} Sources`
                    : `총 ${currentBriefing.raw_count || 0}건 수집`}
                </span>
              </Badge>

              {sources.news !== undefined && sources.news > 0 && (
                <Badge variant="neutral" className="font-mono">
                  {isEn ? `News ${sources.news}` : `뉴스 ${sources.news}건`}
                </Badge>
              )}
              {sources.reddit !== undefined && sources.reddit > 0 && (
                <Badge variant="neutral" className="font-mono">
                  {isEn ? `Reddit ${sources.reddit}` : `Reddit ${sources.reddit}건`}
                </Badge>
              )}
              {sources.kr_community !== undefined && sources.kr_community > 0 && (
                <Badge variant="neutral" className="font-mono">
                  {isEn ? `KR Community ${sources.kr_community}` : `국내 커뮤니티 ${sources.kr_community}건`}
                </Badge>
              )}
              {sources.stocktwits !== undefined && sources.stocktwits > 0 && (
                <Badge variant="neutral" className="font-mono">
                  {isEn ? `StockTwits ${sources.stocktwits}` : `StockTwits ${sources.stocktwits}건`}
                </Badge>
              )}
            </div>

            {/* 영문 미번역 시 원문 임시 안내 */}
            {isEn && !currentBriefing.content_en && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2 font-mono">
                <span>ℹ️ English translation is being generated for this briefing date. Displaying original Korean source text in the meantime.</span>
              </div>
            )}

            {/* 메인 헤드라인 제목 */}
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#0f172a] leading-snug tracking-tight">
                {activeTitle}
              </h1>
            </div>

            {/* 오늘의 시장 3줄 핵심 요약 블록 */}
            {activeSummary.length > 0 && (
              <div className="p-4 sm:p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{isEn ? "Today's 3-Line Market Summary" : "오늘의 시장 3줄 핵심 요약"}</span>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-[#334155] leading-relaxed">
                  {activeSummary.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2">
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] hover:border-[#0f172a] rounded-lg font-mono text-xs font-bold text-[#0f172a] transition-all shadow-2xs group"
                  >
                    <span>${ticker}</span>
                    <ExternalLink className="w-3 h-3 text-[#94a3b8] group-hover:text-[#0f172a] transition-colors" />
                  </Link>
                ))}
              </div>
            )}

            {/* 핵심 토픽/키워드 태그 */}
            {activeTopics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Tag className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
                {activeTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-0.5 bg-[#f1f5f9] text-[#475569] font-medium rounded-md border border-[#e2e8f0]"
                  >
                    #{topic.length > 35 ? topic.slice(0, 35) + "..." : topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. 마크다운 뉴스레터 전문 뷰어 (Reportist 공용 MarkdownViewer 사용) ── */}
          <div className="p-6 sm:p-8 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">
                  {isEn ? "Full AI Newsletter Briefing" : "데일리 브리핑 전문 (뉴스레터)"}
                </h3>
              </div>
              <span className="text-xs text-[#94a3b8] font-mono">
                {activeContent.length.toLocaleString()} chars
              </span>
            </div>

            <div className="prose prose-slate max-w-none text-[#0f172a]">
              <MarkdownViewer content={activeContent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
