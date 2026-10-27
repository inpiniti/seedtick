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

  // 1. 기본 정적 페이지 목록 (한국어 및 영어)
  // /pipeline, /account, /admin은 noindex/내부용이므로 제외
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${fullBaseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${fullBaseUrl}/en`,
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
      url: `${fullBaseUrl}/en/screener`,
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
      url: `${fullBaseUrl}/en/stocks`,
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
      url: `${fullBaseUrl}/en/gurus`,
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
      url: `${fullBaseUrl}/en/outcomes`,
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
      url: `${fullBaseUrl}/en/stats`,
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
      url: `${fullBaseUrl}/en/pricing`,
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
      url: `${fullBaseUrl}/en/feedback`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${fullBaseUrl}/briefings`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${fullBaseUrl}/en/briefings`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
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

  // 2. 13인 거장 철학 개별 페이지 목록 (한국어 및 영어)
  for (const guruSlug of Object.keys(GURU_PERSONAS)) {
    routes.push({
      url: `${fullBaseUrl}/gurus/${encodeURIComponent(guruSlug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
    routes.push({
      url: `${fullBaseUrl}/en/gurus/${encodeURIComponent(guruSlug)}`,
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
        // 유효한 주식 티커(미국장 1~6자 영문/점, 한국장 6자리 영숫자)만 허용하여
        // DB에 들어간 더미 행('S&P 500', 문장 등)으로 인한 XML 파싱 오류(& 문법 오류) 원천 차단
        const tickerDates = new Map<string, string[]>();
        const tickerLatestDate = new Map<string, string>();
        for (const row of rows) {
          const ticker =
            typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
          const d = typeof row.d === "string" ? row.d.trim() : "";
          if (!ticker || !d) continue;
          if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) continue; // 유효하지 않은 티커(공백, &, 문장) 제외
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue; // 유효하지 않은 날짜 형식 제외

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

        // 종목별 최신 리포트 페이지 (한국어 + 영어 동시 등록)
        for (const [ticker, latestDate] of tickerLatestDate.entries()) {
          const dateObj = latestDate ? new Date(latestDate) : new Date();
          const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
          const encodedTicker = encodeURIComponent(ticker);
          routes.push({
            url: `${fullBaseUrl}/stocks/${encodedTicker}`,
            lastModified: validDate,
            changeFrequency: "daily",
            priority: 0.8,
          });
          routes.push({
            url: `${fullBaseUrl}/en/stocks/${encodedTicker}`,
            lastModified: validDate,
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
            const validDObj = isNaN(dObj.getTime()) ? new Date() : dObj;
            routes.push({
              url: `${fullBaseUrl}/stocks/${encodedTicker}/${encodeURIComponent(d)}`,
              lastModified: validDObj,
              changeFrequency: "monthly",
              priority: 0.6,
            });
            routes.push({
              url: `${fullBaseUrl}/en/stocks/${encodedTicker}/${encodeURIComponent(d)}`,
              lastModified: validDObj,
              changeFrequency: "monthly",
              priority: 0.6,
            });
          }
        }
      }

      // 4. 데일리 마켓 브리핑 개별 일자 페이지 (/briefings/[date], /en/briefings/[date])
      try {
        const { data: briefingRows, error: briefingError } = await supabase
          .from("market_briefings")
          .select("d, updated_at, created_at")
          .order("d", { ascending: false })
          .limit(1000);

        if (!briefingError && briefingRows) {
          for (const row of briefingRows) {
            const d = typeof row.d === "string" ? row.d.trim() : "";
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
            const ts = (row.updated_at || row.created_at || d) as string;
            const dateObj = new Date(ts);
            const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

            routes.push({
              url: `${fullBaseUrl}/briefings/${d}`,
              lastModified: validDate,
              changeFrequency: "weekly",
              priority: 0.8,
            });
            routes.push({
              url: `${fullBaseUrl}/en/briefings/${d}`,
              lastModified: validDate,
              changeFrequency: "weekly",
              priority: 0.8,
            });
          }
        }
      } catch (briefingCatchErr) {
        console.warn("[sitemap] Failed to fetch market_briefings:", briefingCatchErr);
      }
    } catch (err) {
      console.warn("[sitemap] Failed to fetch tickers from Supabase:", err);
    }
  }

  return routes;
}
