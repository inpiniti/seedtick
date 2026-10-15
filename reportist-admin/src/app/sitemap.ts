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
  const supabase = getServerSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("guru_reports")
        .select("ticker, d")
        .order("d", { ascending: false });

      if (!error && data) {
        // 티커별 가장 최신 날짜 매핑
        const tickerLatestDateMap = new Map<string, string>();
        for (const row of data) {
          const ticker = (row.ticker as string)?.toUpperCase();
          if (ticker && !tickerLatestDateMap.has(ticker)) {
            tickerLatestDateMap.set(ticker, (row.d as string) || "");
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
