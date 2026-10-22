import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { SITE_URL } from "@/lib/siteConfig";

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

export async function GET(): Promise<Response> {
  const supabase = getServerSupabaseClient();
  const buildDate = new Date().toUTCString();

  interface RssItem {
    ticker: string;
    name: string;
    date: string;
    pubDate: string;
    verdict: string;
    voteSummary: string;
    overallScore: number | null;
  }

  const items: RssItem[] = [];

  if (supabase) {
    try {
      // 1. 종목 한글명 맵 조회
      const { data: logoRows } = await supabase
        .from("ticker_logos")
        .select("ticker, korean_name");

      const nameMap: Record<string, string> = {};
      for (const row of (logoRows as Array<{ ticker?: string; korean_name?: string }>) || []) {
        const t = (row.ticker || "").trim().toUpperCase();
        const n = (row.korean_name || "").trim();
        if (t && n && n.toUpperCase() !== t) nameMap[t] = n;
      }

      // 2. 최신 리포트 상위 40개 조회 (최신 일자순, 생성일순)
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
          if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) continue;

          const companyName = typeof r.company_name === "string" ? r.company_name.trim() : "";
          const name = nameMap[ticker] || companyName || ticker;
          const pubDateObj = r.created_at ? new Date(r.created_at) : new Date(d);

          items.push({
            ticker,
            name,
            date: d,
            pubDate: isNaN(pubDateObj.getTime()) ? buildDate : pubDateObj.toUTCString(),
            verdict: typeof r.verdict === "string" ? r.verdict.trim() : "",
            voteSummary: typeof r.vote_summary === "string" ? r.vote_summary.trim() : "",
            overallScore: typeof r.overall_score === "number" ? r.overall_score : null,
          });
        }
      }
    } catch (e) {
      console.warn("[rss.xml] Failed to fetch data for RSS feed:", e);
    }
  }

  const itemsXml = items
    .map((item) => {
      const itemTitle = `[${escapeXml(item.ticker)}] ${escapeXml(item.name)} 13인 거장 AI 주식 리포트 및 적정주가 분석 (${escapeXml(item.date)})`;
      const itemLink = `${SITE_URL}/stocks/${encodeURIComponent(item.ticker)}`;
      const itemGuid = `${SITE_URL}/stocks/${encodeURIComponent(item.ticker)}/${encodeURIComponent(item.date)}`;

      const htmlDesc = `
<p><strong>${escapeXml(item.name)} (${escapeXml(item.ticker)})</strong> 13인 투자 거장 AI 주식 가치평가 및 적정주가 분석 리포트입니다.</p>
<ul>
  <li>분석 기준일: ${escapeXml(item.date)}</li>
  ${item.verdict ? `<li>거장 합의 의견: ${escapeXml(item.verdict)}</li>` : ""}
  ${item.overallScore !== null ? `<li>거장 종합 평점: ${item.overallScore}점</li>` : ""}
  ${item.voteSummary ? `<li>투자의견 요약: ${escapeXml(item.voteSummary)}</li>` : ""}
</ul>
<p><a href="${itemLink}">리포티스트에서 전체 분석 리포트 보기 &rarr;</a></p>
      `.trim();

      return `    <item>
      <title>${itemTitle}</title>
      <link>${itemLink}</link>
      <guid isPermaLink="true">${itemGuid}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${safeCdata(htmlDesc)}</description>
      <author>Reportist Research</author>
      <category>주식 리포트</category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>리포티스트 · 국내 및 미국 주식 리포트와 적정주가 분석</title>
    <link>${SITE_URL}</link>
    <description>리포티스트는 13인 거장의 철학으로 국내 및 미국 주식 리포트를 분석합니다. 종목별 적정주가와 내재가치 밴드, 실시간 스크리너 제공.</description>
    <language>ko</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
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
