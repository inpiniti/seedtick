"use client";

import React, { useState, useMemo, useEffect } from "react";
import { GuruReportRow } from "@/types/api";
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Shuffle,
  Share2,
  TrendingUp,
  AlertCircle,
  Building,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface TweetGeneratorTabProps {
  reports: GuruReportRow[];
  isEn?: boolean;
}

const VERDICT_MAP: Record<string, string> = {
  매수: "BUY",
  보유: "HOLD",
  관망: "WATCH",
  매도: "SELL",
};

export function TweetGeneratorTab({ reports, isEn = false }: TweetGeneratorTabProps) {
  // 사용 가능한 유효 종목 필터링 (최신 일자 우선 정렬 및 유효 티커)
  const availableReports = useMemo(() => {
    const list = (reports || []).filter(
      (r) => r.ticker && /^[A-Z0-9.]{1,10}$/.test(r.ticker.trim().toUpperCase())
    );
    // 티커별 최신 1건만 중복 제거
    const map = new Map<string, GuruReportRow>();
    for (const r of list) {
      const ticker = r.ticker.toUpperCase();
      if (!map.has(ticker)) {
        map.set(ticker, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [reports]);

  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [lang, setLang] = useState<"en" | "ko">("en");
  const [tweetText, setTweetText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // 초기 로드 시 첫 종목(또는 NVDA/AAPL/인기 종목) 자동 선택
  useEffect(() => {
    if (availableReports.length > 0 && !selectedTicker) {
      const popular = availableReports.find((r) =>
        ["NVDA", "AAPL", "TSLA", "MSFT"].includes(r.ticker.toUpperCase())
      );
      setSelectedTicker(popular ? popular.ticker : availableReports[0].ticker);
    }
  }, [availableReports, selectedTicker]);

  // 현재 선택된 보고서
  const currentReport = useMemo(() => {
    return availableReports.find((r) => r.ticker === selectedTicker) || null;
  }, [availableReports, selectedTicker]);

  // 트윗 텍스트 자동 생성 로직
  const generateTweetContent = (report: GuruReportRow | null, targetLang: "en" | "ko"): string => {
    if (!report) return "";
    const ticker = report.ticker.toUpperCase();
    const verdictEn = VERDICT_MAP[report.verdict] || report.verdict || "WATCH";
    const votesBuy = report.votes_buy ?? 0;
    const votesWatch = (report.votes_watch ?? 0) + (report.votes_hold ?? 0);
    const votesSell = report.votes_sell ?? 0;

    const fairValue = report.fair_value;
    const currentPrice = report.current_price;
    let upsidePct = report.upside_pct;
    if (upsidePct == null && fairValue && currentPrice && currentPrice > 0) {
      upsidePct = ((fairValue - currentPrice) / currentPrice) * 100;
    }

    // 워런 버핏 또는 피터 린치 대표 발언 추출
    let guruQuote = "";
    if (Array.isArray(report.summaries)) {
      for (const s of report.summaries) {
        const persona = s.persona || s.guru_name || "";
        if (persona.includes("버핏") || persona.includes("Buffett")) {
          const q = (s.quote || "").trim().replace(/\n/g, " ").replace(/"/g, "");
          if (q) {
            guruQuote = targetLang === "en"
              ? `• Warren Buffett: "${q.slice(0, 50)}${q.length > 50 ? "..." : ""}"`
              : `• 워런 버핏: "${q.slice(0, 50)}${q.length > 50 ? "..." : ""}"`;
            break;
          }
        }
      }
      if (!guruQuote) {
        for (const s of report.summaries) {
          const persona = s.persona || s.guru_name || "";
          if (persona.includes("린치") || persona.includes("Lynch")) {
            const q = (s.quote || "").trim().replace(/\n/g, " ").replace(/"/g, "");
            if (q) {
              guruQuote = targetLang === "en"
                ? `• Peter Lynch: "${q.slice(0, 50)}${q.length > 50 ? "..." : ""}"`
                : `• 피터 린치: "${q.slice(0, 50)}${q.length > 50 ? "..." : ""}"`;
              break;
            }
          }
        }
      }
    }

    if (targetLang === "en") {
      const lines = [
        `$${ticker} AI Valuation & 13-Guru Consensus 📊`,
        "",
        `Consensus: ${verdictEn} (Buy ${votesBuy} | Watch ${votesWatch} | Sell ${votesSell})`,
      ];
      if (fairValue && fairValue > 0) {
        let valLine = `• Intrinsic Value: $${fairValue.toFixed(2)}`;
        if (upsidePct != null) {
          valLine += ` (${upsidePct >= 0 ? "+" : ""}${upsidePct.toFixed(1)}% upside)`;
        }
        lines.push(valLine);
      }
      if (guruQuote) lines.push(guruQuote);

      lines.push("");
      lines.push("Full valuation & margin of safety bands:");
      lines.push(`https://www.reportist.kr/en/stocks/${ticker}`);
      lines.push(`#${ticker} #Stocks #FinTwit #Investing`);
      return lines.join("\n");
    } else {
      // 한국어 트윗
      const companyName = report.company_name || ticker;
      const lines = [
        `$${ticker} (${companyName}) 13인 거장 AI 적정주가 & 표결 📊`,
        "",
        `종합의견: ${report.verdict} (찬성 ${votesBuy} | 관망 ${votesWatch} | 매도 ${votesSell})`,
      ];
      if (fairValue && fairValue > 0) {
        let valLine = `• 산출 적정가: $${fairValue.toFixed(2)}`;
        if (upsidePct != null) {
          valLine += ` (상승여력: ${upsidePct >= 0 ? "+" : ""}${upsidePct.toFixed(1)}%)`;
        }
        lines.push(valLine);
      }
      if (guruQuote) lines.push(guruQuote);

      lines.push("");
      lines.push("13인 거장 독립 가치평가 및 안전마진 밴드 보기:");
      lines.push(`https://www.reportist.kr/stocks/${ticker}`);
      lines.push(`#${ticker} #미국주식 #주식분석 #워런버핏`);
      return lines.join("\n");
    }
  };

  // 종목이나 언어가 바뀔 때 트윗 텍스트 갱신
  useEffect(() => {
    if (currentReport) {
      setTweetText(generateTweetContent(currentReport, lang));
    }
  }, [currentReport, lang]);

  // 랜덤 종목 뽑기
  const handlePickRandom = () => {
    if (availableReports.length === 0) return;
    // 현재 선택된 종목 제외한 나머지 중에서 랜덤 선택
    const candidates = availableReports.filter((r) => r.ticker !== selectedTicker);
    const pool = candidates.length > 0 ? candidates : availableReports;
    const randomPick = pool[Math.floor(Math.random() * pool.length)];
    setSelectedTicker(randomPick.ticker);
  };

  // 트윗 글자 수 계산 (Twitter 공식 t.co URL은 길이와 무관하게 23자로 계산됨)
  const charStats = useMemo(() => {
    const urlRegex = /https?:\/\/\S+/g;
    const urls = tweetText.match(urlRegex) || [];
    const textWithoutUrls = tweetText.replace(urlRegex, "");
    const effectiveLen = textWithoutUrls.length + urls.length * 23;
    const maxLen = 280;
    const remaining = maxLen - effectiveLen;
    const isOver = remaining < 0;
    return { effectiveLen, remaining, isOver };
  }, [tweetText]);

  // 복사 핸들러
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 폴백 복사
      const textArea = document.createElement("textarea");
      textArea.value = tweetText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // X(트위터) 공식 인텐트 URL 새 탭 열기 (텍스트 자동 채움)
  const handleOpenTwitterIntent = () => {
    const encoded = encodeURIComponent(tweetText);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encoded}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── 상단 툴바: 종목 선택 및 랜덤 버튼 ── */}
      <div className="p-4 sm:p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs sm:text-sm font-semibold text-[#0f172a] shrink-0">
            {isEn ? "Select Stock:" : "발행 종목:"}
          </label>
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="px-3.5 py-2 text-sm font-semibold text-[#0f172a] bg-white border border-[#cbd5e1] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
          >
            {availableReports.map((r) => {
              const name = r.company_name_en || r.company_name || r.ticker;
              return (
                <option key={r.ticker} value={r.ticker}>
                  {r.ticker} — {name} ({r.verdict})
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={handlePickRandom}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#0f172a] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 active:scale-95"
          >
            <Shuffle className="w-4 h-4 text-[#64748b]" />
            {isEn ? "🎲 Pick Random" : "🎲 랜덤 종목 선택"}
          </button>
        </div>

        {/* 언어 선택 토글 */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-[#e2e8f0] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              lang === "en"
                ? "bg-white text-[#0f172a] shadow-sm"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            🇺🇸 English (추천)
          </button>
          <button
            type="button"
            onClick={() => setLang("ko")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              lang === "ko"
                ? "bg-white text-[#0f172a] shadow-sm"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            🇰🇷 한국어
          </button>
        </div>
      </div>

      {/* ── 선택된 종목 요약 카드 ── */}
      {currentReport && (
        <div className="p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f172a] text-white flex items-center justify-center font-bold text-sm">
              {currentReport.ticker.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#0f172a]">
                  {currentReport.ticker}
                </span>
                <span className="text-xs text-[#64748b]">
                  {currentReport.company_name_en || currentReport.company_name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748b]">
                <span>기준일: {currentReport.d}</span>
                <span>•</span>
                <span>
                  찬성 {currentReport.votes_buy ?? 0} · 관망{" "}
                  {(currentReport.votes_watch ?? 0) + (currentReport.votes_hold ?? 0)} · 매도{" "}
                  {currentReport.votes_sell ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={
                currentReport.verdict === "매수"
                  ? "success"
                  : currentReport.verdict === "매도"
                  ? "danger"
                  : "warning"
              }
            >
              {currentReport.verdict}
            </Badge>
            {currentReport.fair_value && (
              <span className="text-xs font-semibold text-[#0f172a] bg-[#f1f5f9] px-2.5 py-1 rounded-lg">
                적정가 ${currentReport.fair_value.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── 트윗 텍스트 에디터 (직접 편집 가능) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-bold text-[#0f172a] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            {isEn ? "Generated Tweet Draft (Editable)" : "생성된 트윗 내용 (직접 편집 가능)"}
          </label>
          <div
            className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${
              charStats.isOver
                ? "bg-rose-100 text-rose-700"
                : charStats.remaining < 30
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {charStats.effectiveLen} / 280자 {charStats.isOver ? "(초과!)" : `(${charStats.remaining}자 남음)`}
          </div>
        </div>

        <textarea
          rows={10}
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          placeholder="트윗 텍스트..."
          className={`w-full p-4 font-mono text-xs sm:text-sm leading-relaxed bg-[#f8fafc] border rounded-2xl shadow-inner focus:outline-none focus:ring-2 resize-y transition-all ${
            charStats.isOver
              ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20"
              : "border-[#cbd5e1] focus:ring-[#0f172a]"
          }`}
        />
      </div>

      {/* ── 하단 액션 버튼 바 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {currentReport && (
            <a
              href={lang === "en" ? `/en/stocks/${currentReport.ticker}` : `/stocks/${currentReport.ticker}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#64748b] hover:text-[#0f172a] underline flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {isEn ? "Open Stock Page" : "종목 보고서 페이지 확인"}
            </a>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* 복사 버튼 */}
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95 ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-[#0f172a] hover:bg-slate-800 text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                복사되었습니다!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {isEn ? "Copy to Clipboard" : "클립보드 복사"}
              </>
            )}
          </button>

          {/* X에서 바로 작성하기 (원클릭) */}
          <button
            type="button"
            onClick={handleOpenTwitterIntent}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#000000] hover:bg-neutral-800 rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95"
            title="X(트위터) 글쓰기 화면을 열고 이 내용을 자동으로 채웁니다"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {isEn ? "Open in X (Tweet)" : "X에서 바로 열기"}
          </button>
        </div>
      </div>

      {/* 안내 팁 박스 */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">간편 발행 팁:</span> <strong>[X에서 바로 열기]</strong>를 누르면 X(트위터) 작성창이 새 탭으로 열리며 <strong>텍스트가 자동으로 채워진 상태</strong>로 뜹니다. 내용 확인 후 X에서 바로 [게시하기]만 누르시면 3초 만에 발행됩니다!
        </div>
      </div>
    </div>
  );
}
