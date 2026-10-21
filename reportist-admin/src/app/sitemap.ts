import { MetadataRoute } from "next";
import { GURU_PERSONAS } from "@/lib/guruPersonas";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { getServerAllowedFreeDate } from "@/lib/subscription/reportAccess";
import { getDefaultReportDate, isReportRestricted } from "@/lib/subscription/subscriptionPolicy";
import { getGlobalReportDates } from "@/lib/server/publicCatalog";
import { SITE_URL } from "@/lib/siteConfig";

export const revalidate = 3600; // 1시간 주기로 사이트맵 자동 갱신

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fullBaseUrl = SITE_URL;

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
      url: `${fullBaseUrl}/outcomes`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${fullBaseUrl}/stats`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${fullBaseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${fullBaseUrl}/feedback`,
      lastModified: new Date(),
      changeFrequency: "daily",
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

  // 3. Supabase DB에서 발행된 모든 종목(티커) 목록 및 날짜 동적 조회
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
        const now = new Date();

        // 티커별 일자 집계 (d 내림차순이므로 최초 등장값이 최신)
        const tickerDates = new Map<string, string[]>();
        const tickerLatestDate = new Map<string, string>();
        for (const row of rows) {
          const ticker =
            typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
          const d = typeof row.d === "string" ? row.d : "";
          if (!ticker || !d) continue;
          if (!tickerLatestDate.has(ticker)) tickerLatestDate.set(ticker, d);
          const list = tickerDates.get(ticker) || [];
          list.push(d);
          tickerDates.set(ticker, list);
        }

        // 모든 발행 일자 (최신순) → free 기준 허용 기본 일자 계산
        // /api/reports/dates 와 동일한 1000행 제한 기준을 사용해야
        // 공개 가능 날짜 판정이 API·SSR·사이트맵에서 일치한다.
        const allDates = await getGlobalReportDates();
        const allowedFreeDate =
          (await getServerAllowedFreeDate(supabase, now)) ||
          getDefaultReportDate(allDates, "free", now, false) ||
          undefined;

        // 종목별 최신 리포트 페이지
        for (const [ticker, latestDate] of tickerLatestDate.entries()) {
          const dateObj = latestDate ? new Date(latestDate) : new Date();
          routes.push({
            url: `${fullBaseUrl}/stocks/${ticker}`,
            lastModified: isNaN(dateObj.getTime()) ? new Date() : dateObj,
            changeFrequency: "daily",
            priority: 0.8,
          });

          // 공개 열람 가능한(무료) 과거 일자만 개별 URL로 노출한다.
          // 잠긴 날짜는 페이월 티저로 동일 내용이라 색인 대상이 아니다.
          const dates = Array.from(new Set(tickerDates.get(ticker) || []))
            .sort()
            .reverse();
          for (const d of dates) {
            if (isReportRestricted(d, "free", now, allowedFreeDate, false)) continue;
            if (d === latestDate) continue; // 최신일자는 위에서 이미 추가
            const dObj = new Date(d);
            routes.push({
              url: `${fullBaseUrl}/stocks/${ticker}/${d}`,
              lastModified: isNaN(dObj.getTime()) ? new Date() : dObj,
              changeFrequency: "monthly",
              priority: 0.6,
            });
          }
        }
      }
    } catch (err) {
      console.warn("[sitemap] Failed to fetch tickers from Supabase:", err);
    }
  }

  return routes;
}
