import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import type { MarketBriefing } from "@/types/api";

export interface BriefingPageData {
  briefing: MarketBriefing | null;
  date: string;
  isLatest: boolean;
  availableDates: string[];
  title: string;
  description: string;
  keywords: string[];
  canonicalPath: string;
}

/**
 * 데일리 마켓 브리핑 서버 데이터 조회 헬퍼 (SSR & 메타데이터 공용)
 */
export async function getBriefingPageData(
  targetDate?: string,
  isEn = false
): Promise<BriefingPageData> {
  const supabase = getServerSupabaseClient();
  const baseCanonical = isEn ? "/en/briefings" : "/briefings";

  if (!supabase) {
    return {
      briefing: null,
      date: targetDate || "",
      isLatest: !targetDate,
      availableDates: [],
      title: isEn
        ? "Daily Market Briefing · Global Community & 24h News Radar | Reportist"
        : "데일리 마켓 브리핑 · 글로벌 커뮤니티 & 24시간 뉴스 레이더 | 리포티스트",
      description: isEn
        ? "Daily AI market briefing synthesizing Reddit, financial news, and community sentiment."
        : "매일 자정 00:05 KST 발행. 미국 레딧, 국내 주식 커뮤니티, 24시간 주요 뉴스를 종합한 AI 데일리 마켓 브리핑 아카이브.",
      keywords: ["리포티스트", "데일리 마켓 브리핑", "주식 뉴스레터", "커뮤니티 레이더", "Reportist"],
      canonicalPath: targetDate ? `${baseCanonical}/${targetDate}` : baseCanonical,
    };
  }

  try {
    // 1. 전체 발행 일자 목록 조회 (최신순 60건)
    const { data: dateRows } = await supabase
      .from("market_briefings")
      .select("d")
      .order("d", { ascending: false })
      .limit(60);

    const availableDates = (dateRows || []).map((r: { d: string }) => r.d);
    const latestDate = availableDates[0] || "";
    const activeDate = targetDate || latestDate;
    const isLatest = !targetDate || targetDate === latestDate;

    // 2. 대상 브리핑 조회
    let briefing: MarketBriefing | null = null;
    if (activeDate) {
      const { data } = await supabase
        .from("market_briefings")
        .select("*")
        .eq("d", activeDate)
        .maybeSingle();

      if (data) {
        briefing = data as MarketBriefing;
      }
    }

    // 3. SEO 타이틀 및 디스크립션 추출
    let title = "";
    let description = "";
    const keywords: string[] = [
      "리포티스트",
      "Reportist",
      "데일리 마켓 브리핑",
      "글로벌 증시 브리핑",
      "주식 뉴스레터",
      "마켓 레이더",
    ];

    if (briefing) {
      const datePrefix = `[${briefing.d} 데일리 마켓 브리핑]`;
      const datePrefixEn = `[${briefing.d} Daily Market Briefing]`;

      // 헤드라인 정리
      const rawTitle = briefing.title
        .replace(/^#\s*/, "")
        .replace(/^\[데일리 마켓 브리핑\]\s*[\d-]*\s*/, "")
        .trim();

      title = isEn
        ? `${datePrefixEn} ${rawTitle || "Global Community & 24h Market Radar"} · Reportist`
        : `${datePrefix} ${rawTitle || "글로벌 커뮤니티 & 24시간 마켓 레이더"} · 리포티스트`;

      // 3줄 요약 문장으로 설명문 구성 (스니펫 최적화)
      if (Array.isArray(briefing.summary_3lines) && briefing.summary_3lines.length > 0) {
        description = `${briefing.summary_3lines.slice(0, 2).join(" ")} 리포티스트 24시간 글로벌 마켓 브리핑 전문을 확인하세요.`;
      } else {
        description = `${briefing.d} 글로벌 주식 시장과 레딧, 국내 주식 커뮤니티 여론을 종합한 일일 AI 마켓 브리핑 뉴스레터.`;
      }

      if (briefing.tickers && briefing.tickers.length > 0) {
        keywords.push(...briefing.tickers.map((t) => `$${t}`));
      }
      if (briefing.topics && briefing.topics.length > 0) {
        keywords.push(...briefing.topics.slice(0, 5));
      }
    } else {
      title = isEn
        ? "Daily Market Briefing · Global Community & 24h News Radar | Reportist"
        : "데일리 마켓 브리핑 허브 · 글로벌 커뮤니티 & 24시간 뉴스 레이더 | 리포티스트";
      description = isEn
        ? "Daily AI journalistic market briefing synthesized from Reddit (WSB, Investing), stock forums, and 24-hour financial news."
        : "매일 자정 00:05 KST 발행. 미국 레딧, 국내 주식 커뮤니티, 24시간 금융 뉴스를 종합 분석한 AI 데일리 마켓 브리핑 아카이브.";
    }

    const canonicalPath = targetDate ? `${baseCanonical}/${targetDate}` : baseCanonical;

    return {
      briefing,
      date: activeDate,
      isLatest,
      availableDates,
      title,
      description,
      keywords,
      canonicalPath,
    };
  } catch (err) {
    console.warn("[getBriefingPageData] Error:", err);
    return {
      briefing: null,
      date: targetDate || "",
      isLatest: !targetDate,
      availableDates: [],
      title: "데일리 마켓 브리핑 · 리포티스트",
      description: "글로벌 커뮤니티 & 24시간 뉴스 데일리 마켓 브리핑",
      keywords: ["리포티스트", "데일리 마켓 브리핑"],
      canonicalPath: targetDate ? `${baseCanonical}/${targetDate}` : baseCanonical,
    };
  }
}
