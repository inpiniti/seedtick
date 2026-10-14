import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { maskReportRowPublic } from "@/lib/subscription/reportAccess";
import { ResearchDocTab } from "@/components/research/ResearchDocumentView";
import type { GuruReportRow } from "@/types/api";

interface StockDetailPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tab?: string; date?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: StockDetailPageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const { date } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  let companyName = ticker;
  let publishedDate = date || "";

  // SSR은 로그인 컨텍스트가 없으므로 public(free) 기준 마스킹된 티저만 사용.
  // 최근 30일 리포트의 verdict/적정가는 메타데이터에 절대 포함하지 않음.
  const supabase = getServerSupabaseClient();
  if (supabase) {
    try {
      let report: GuruReportRow | null = null;
      if (date) {
        const { data } = await supabase
          .from("guru_reports")
          .select("*")
          .eq("id", `${date}_${ticker}`)
          .maybeSingle();
        report = (data as GuruReportRow | null) || null;
        if (!report) {
          const fallback = await supabase
            .from("guru_reports")
            .select("*")
            .eq("d", date)
            .eq("ticker", ticker)
            .limit(1)
            .maybeSingle();
          report = (fallback.data as GuruReportRow | null) || null;
        }
      } else {
        const { data } = await supabase
          .from("guru_reports")
          .select("*")
          .eq("ticker", ticker)
          .order("d", { ascending: false })
          .limit(1)
          .maybeSingle();
        report = (data as GuruReportRow | null) || null;
      }

      if (report) {
        const teaser = maskReportRowPublic(report);
        if (teaser.company_name) companyName = teaser.company_name;
        if (teaser.d) publishedDate = teaser.d;
      }
    } catch {
      // ignore
    }
  }

  const title = `${ticker} (${companyName}) 13인 거장 AI 투자 분석 | SeedTick`;
  const description = `${ticker}(${companyName}) - 13인 투자 거장 AI 가치평가 리포트 아카이브. 최신 리포트는 Pro 멤버십으로 열람 가능합니다.`;
  const canonicalUrl = `/stocks/${ticker}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      publishedTime: publishedDate ? new Date(publishedDate).toISOString() : undefined,
      siteName: "SeedTick Research",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StockDetailPage({
  params,
  searchParams,
}: StockDetailPageProps) {
  const { ticker: rawTicker } = await params;
  const { tab, date } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  const validTabs: ResearchDocTab[] = ["final", "summaries", "datapack", "chart"];
  const validatedTab = validTabs.includes(tab as ResearchDocTab) ? (tab as ResearchDocTab) : undefined;

  // JSON-LD 구조화 데이터 생성 (검색엔진 SEO 표준)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://seedtick.kr",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Stocks",
            "item": "https://seedtick.kr/stocks",
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": ticker,
            "item": `https://seedtick.kr/stocks/${ticker}`,
          },
        ],
      },
      {
        "@type": "Article",
        "@id": `https://seedtick.kr/stocks/${ticker}#article`,
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://seedtick.kr/#website",
          "name": "SeedTick Research",
          "url": "https://seedtick.kr",
        },
        "headline": `${ticker} 적정주가 및 13인 거장 AI 가치평가 리포트`,
        "description": `${ticker} 주식의 내재가치와 13인 전설적 거장들의 종합 투자 표결 보고서`,
        "publisher": {
          "@type": "Organization",
          "name": "SeedTick Research",
          "url": "https://seedtick.kr",
        },
        "isAccessibleForFree": "False",
        "hasPart": {
          "@type": "WebPageElement",
          "isAccessibleForFree": "False",
          "cssSelector": ".paywall-content",
        },
      },
    ],
  };

  // SSR initialReport도 public 마스킹 티저만 전달 (원문 절대 미포함).
  // 로그인 유저의 전체 열람은 클라이언트가 /api/reports/detail로 재조회합니다.
  let initialReport: GuruReportRow | null = null;
  const ssrSupabase = getServerSupabaseClient();
  if (ssrSupabase) {
    try {
      let row: GuruReportRow | null = null;
      if (date) {
        const { data } = await ssrSupabase
          .from("guru_reports")
          .select("*")
          .eq("id", `${date}_${ticker}`)
          .maybeSingle();
        row = (data as GuruReportRow | null) || null;
        if (!row) {
          const fallback = await ssrSupabase
            .from("guru_reports")
            .select("*")
            .eq("d", date)
            .eq("ticker", ticker)
            .limit(1)
            .maybeSingle();
          row = (fallback.data as GuruReportRow | null) || null;
        }
      } else {
        const { data } = await ssrSupabase
          .from("guru_reports")
          .select("*")
          .eq("ticker", ticker)
          .order("d", { ascending: false })
          .limit(1)
          .maybeSingle();
        row = (data as GuruReportRow | null) || null;
      }
      if (row) initialReport = maskReportRowPublic(row);
    } catch (e) {
      console.warn("SSR fetchReport error:", e);
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-reports"
          initialTicker={ticker}
          initialReport={initialReport}
          initialTab={validatedTab}
          initialDate={date}
        />
      </Suspense>
    </>
  );
}
