import { MetadataRoute } from "next";
import { GURU_PERSONAS } from "@/lib/guruPersonas";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";

export const revalidate = 3600; // 1시간 주기로 사이트맵 자동 갱신

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "https://reportist.kr"
  ).replace(/\/$/, "");

  const fullBaseUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  // 1. 기본 정적 페이지 목록
  // /pipeline, /account, /admin은 noindex/내부용이므로 제외
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${fullBaseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${fullBaseUrl}/screener`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${fullBaseUrl}/stocks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${fullBaseUrl}/gurus`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${fullBaseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${fullBaseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${fullBaseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // 2. 13인 거장 철학 개별 페이지 목록
  for (const guruSlug of Object.keys(GURU_PERSONAS)) {
    routes.push({
      url: `${fullBaseUrl}/gurus/${encodeURIComponent(guruSlug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // 3. Supabase DB에서 최신 발행된 모든 종목(티커) 목록 및 최신 날짜 동적 조회
  // 티커/일자만 사용 (민감 컬럼 미조회). anon 직접 접근 차단 이후 service_role 경유.
  // supabase-js 기본 1000행 제한을 피하기 위해 range 페이지네이션으로 전량 조회.
  const supabase = getServerSupabaseClient();

  if (supabase) {
    try {
      const PAGE_SIZE = 1000;
      const MAX_ROWS = 50000; // 무한 루프 방지 상한
      const rows: Array<{ ticker: unknown; d: unknown }> = [];

      for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("guru_reports")
          .select("ticker, d")
          .order("d", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.warn("[sitemap] Failed to fetch tickers from Supabase:", error);
          break;
        }
        if (!data || data.length === 0) break;

        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
      }

      if (rows.length > 0) {
        // 티커별 가장 최신 날짜 매핑 (d 내림차순이므로 최초 등장값이 최신)
        const tickerLatestDateMap = new Map<string, string>();
        for (const row of rows) {
          const ticker =
            typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
          if (ticker && !tickerLatestDateMap.has(ticker)) {
            tickerLatestDateMap.set(ticker, typeof row.d === "string" ? row.d : "");
          }
        }

        // 각 종목별 상세 페이지 URL 추가
        for (const [ticker, latestDate] of tickerLatestDateMap.entries()) {
          const dateObj = latestDate ? new Date(latestDate) : new Date();
          routes.push({
            url: `${fullBaseUrl}/stocks/${ticker}`,
            lastModified: isNaN(dateObj.getTime()) ? new Date() : dateObj,
            changeFrequency: "daily",
            priority: 0.8,
          });
        }
      }
    } catch (err) {
      console.warn("[sitemap] Failed to fetch tickers from Supabase:", err);
    }
  }

  return routes;
}
