import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { fetchReportByDateAndTicker, fetchGuruReports, supabase } from "@/lib/supabase";
import { extractValuationConsensus } from "@/lib/insightUtils";
import { ResearchDocTab } from "@/components/research/ResearchDocumentView";

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
  let verdict = "투자 의견 조율 중";
  let fairValueText = "";
  let publishedDate = date || "";

  if (supabase) {
    try {
      let report = null;
      if (date) {
        report = await fetchReportByDateAndTicker(date, ticker);
      } else {
        const { data } = await supabase
          .from("guru_reports")
          .select("*")
          .eq("ticker", ticker)
          .order("d", { ascending: false })
          .limit(1)
          .maybeSingle();
        report = data;
      }

      if (report) {
        if (report.company_name) companyName = report.company_name;
        if (report.verdict) verdict = report.verdict;
        if (report.d) publishedDate = report.d;

        const val = extractValuationConsensus(report);
        if (val?.fair_value_price) {
          fairValueText = ` · 컨센서스 적정주가 $${val.fair_value_price.toFixed(2)}`;
        }
      }
    } catch {
      // ignore
    }
  }

  const title = `${ticker} (${companyName}) 적정주가 및 13인 거장 AI 투자 분석 | SeedTick`;
  const description = `${ticker} - 워런 버핏, 피터 린치 등 13인의 투자 거장 AI 합의 표결(${verdict})${fairValueText}. SEC 공시 데이터팩과 내재가치 밴드 심층 분석 리포트.`;
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

  const validTabs: ResearchDocTab[] = ["final", "summaries", "datapack", "discussion", "chart"];
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
          initialTab={validatedTab}
          initialDate={date}
        />
      </Suspense>
    </>
  );
}
