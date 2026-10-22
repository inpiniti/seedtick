import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { SITE_URL } from "@/lib/siteConfig";
import { getEnglishCompanyName } from "@/lib/tickerAliases";

export const revalidate = 3600; // 1시간마다 캐시 재검증

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

function safeCdata(content: string): string {
  return `<![CDATA[${content.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

const VERDICT_MAP: Record<string, string> = {
  매수: "BUY",
  보유: "HOLD",
  관망: "WATCH",
  매도: "SELL",
};

function translateVerdict(verdict: string): string {
  if (!verdict) return "";
  return VERDICT_MAP[verdict] || verdict;
}

function translateVoteSummary(summary: string): string {
  if (!summary) return "";
  return summary
    .replace(/매수/g, "Buy")
    .replace(/보유/g, "Hold")
    .replace(/관망/g, "Watch")
    .replace(/매도/g, "Sell")
    .replace(/슈퍼인베스터/g, "Superinvestors")
    .replace(/인 보유 종목/g, " holders")
    .replace(/스크리너 발굴 종목/g, "Screener Candidate");
}

export async function GET(): Promise<Response> {
  const supabase = getServerSupabaseClient();
  const buildDate = new Date().toUTCString();

  interface RssItem {
    ticker: string;
    englishName: string;
    date: string;
    pubDate: string;
    verdict: string;
    voteSummary: string;
    overallScore: number | null;
  }

  const items: RssItem[] = [];

  if (supabase) {
    try {
      // 최신 리포트 상위 40개 조회 (최신 일자순, 생성일순)
      const { data: reportRows, error } = await supabase
        .from("guru_reports")
        .select("id, ticker, company_name, d, verdict, overall_score, vote_summary, created_at")
        .order("d", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(40);

      if (!error && reportRows) {
        for (const r of reportRows) {
          const ticker = (typeof r.ticker === "string" ? r.ticker : "").trim().toUpperCase();
          const d = typeof r.d === "string" ? r.d.trim() : "";
          if (!ticker || !d) continue;

          // 유효하지 않은 티커(더미/문장 등) 제외
          if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) continue;

          const companyName = typeof r.company_name === "string" ? r.company_name.trim() : "";
          const englishName = getEnglishCompanyName(ticker, companyName);
          const pubDateObj = r.created_at ? new Date(r.created_at) : new Date(d);

          items.push({
            ticker,
            englishName,
            date: d,
            pubDate: isNaN(pubDateObj.getTime()) ? buildDate : pubDateObj.toUTCString(),
            verdict: translateVerdict(typeof r.verdict === "string" ? r.verdict.trim() : ""),
            voteSummary: translateVoteSummary(typeof r.vote_summary === "string" ? r.vote_summary.trim() : ""),
            overallScore: typeof r.overall_score === "number" ? r.overall_score : null,
          });
        }
      }
    } catch (e) {
      console.warn("[en/rss.xml] Failed to fetch data for English RSS feed:", e);
    }
  }

  const itemsXml = items
    .map((item) => {
      const itemTitle = `[${escapeXml(item.ticker)}] ${escapeXml(item.englishName)} 13-Guru AI Equity Research & Fair Value Forecast (${escapeXml(item.date)})`;
      const encodedTicker = encodeURIComponent(item.ticker);
      const itemLink = `${SITE_URL}/en/stocks/${encodedTicker}`;
      const itemGuid = `${SITE_URL}/en/stocks/${encodedTicker}/${encodeURIComponent(item.date)}`;

      const htmlDesc = `
<p><strong>${escapeXml(item.englishName)} (${escapeXml(item.ticker)})</strong> AI Equity Research and Intrinsic Fair Value analysis report analyzed by 13 legendary investing gurus.</p>
<ul>
  <li>Report Date: ${escapeXml(item.date)}</li>
  ${item.verdict ? `<li>Consensus Verdict: <strong>${escapeXml(item.verdict)}</strong></li>` : ""}
  ${item.overallScore !== null ? `<li>Guru Composite Score: ${item.overallScore} / 100</li>` : ""}
  ${item.voteSummary ? `<li>Vote Breakdown: ${escapeXml(item.voteSummary)}</li>` : ""}
</ul>
<p><a href="${itemLink}">Read the full interactive valuation report on Reportist &rarr;</a></p>
      `.trim();

      return `    <item>
      <title>${itemTitle}</title>
      <link>${itemLink}</link>
      <guid isPermaLink="true">${itemGuid}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${safeCdata(htmlDesc)}</description>
      <author>Reportist Research</author>
      <category>Equity Research</category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Reportist · 13 Investment Guru AI Stock Research &amp; Fair Value Analysis</title>
    <link>${SITE_URL}/en</link>
    <description>Institutional-grade equity research driven by 13 legendary guru AI personas. Deterministic fair values, margin of safety bands, and daily consensus forecasts for US and global equities.</description>
    <language>en-US</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/en/rss.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
