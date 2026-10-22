import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { UnanalyzedStockView } from "@/components/research/UnanalyzedStockView";
import type { ResearchDocTab } from "@/components/research/ResearchDocumentView";
import { StockStatsSummaryTable } from "@/components/research/StockStatsSummaryTable";
import { getStockPageData } from "@/lib/server/stockPageData";
import { buildStockJsonLd } from "@/lib/server/stockJsonLd";
import { absoluteUrl } from "@/lib/siteConfig";

interface EnglishStockDatePageProps {
  params: Promise<{ ticker: string; date: string }>;
  searchParams: Promise<{ tab?: string; from?: string }>;
}

export async function generateMetadata({
  params,
}: EnglishStockDatePageProps): Promise<Metadata> {
  const { ticker: rawTicker, date } = await params;
  const ticker = (rawTicker || "").toUpperCase();

  const data = await getStockPageData(ticker, date, "en");

  if (data.isUnknownTicker) {
    return {
      title: `Reportist · ${ticker}`,
      robots: { index: false, follow: true },
    };
  }

  const canonicalPath = `/en/stocks/${data.ticker}/${date}`;
  const report = data.report;
  const votesBuy = typeof report?.votes_buy === "number" ? report.votes_buy : null;
  const votesWatch =
    typeof report?.votes_watch === "number" || typeof report?.votes_hold === "number"
      ? (report.votes_watch || 0) + (report.votes_hold || 0)
      : null;
  const votesSell = typeof report?.votes_sell === "number" ? report.votes_sell : null;
  const verdictMap: Record<string, string> = {
    매수: "BUY",
    보유: "HOLD",
    관망: "WATCH",
    매도: "SELL",
  };
  const verdictEn = report?.verdict ? verdictMap[report.verdict] || report.verdict : "";

  const voteSnippet =
    votesBuy !== null && votesWatch !== null && votesSell !== null
      ? `13 Guru Vote Results: Buy ${votesBuy}, Watch ${votesWatch}, Sell ${votesSell}${verdictEn ? ` (${verdictEn})` : ""}. `
      : "";

  const title = `${data.displayName} (${ticker}) ${date} Stock Forecast & Fair Value Analysis · 13 Guru AI Research | Reportist`;
  const description = `${data.displayName} (${ticker}) stock forecast and intrinsic fair value report as of ${date}. ${voteSnippet}Review independent valuations and margin of safety bands from 13 legendary guru AI personas.`;

  return {
    title,
    description,
    keywords: data.seoKeywords,
    alternates: {
      canonical: canonicalPath,
      languages: {
        ko: `/stocks/${ticker}/${date}`,
        en: canonicalPath,
        "x-default": `/stocks/${ticker}/${date}`,
      },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonicalPath),
      type: "article",
      locale: "en_US",
      publishedTime: data.publishedDate
        ? new Date(data.publishedDate).toISOString()
        : undefined,
      siteName: "Reportist Research",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EnglishStockDateDetailPage({
  params,
  searchParams,
}: EnglishStockDatePageProps) {
  const { ticker: rawTicker, date } = await params;
  const { tab } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  const data = await getStockPageData(ticker, date, "en");

  if (data.isUnknownTicker) {
    notFound();
  }

  const validTabs: ResearchDocTab[] = ["final", "summaries", "datapack", "chart"];
  const initialTab = validTabs.includes(tab as ResearchDocTab)
    ? (tab as ResearchDocTab)
    : undefined;

  const jsonLd = buildStockJsonLd({
    displayName: data.displayName,
    ticker: data.ticker,
    canonicalPath: `/en/stocks/${data.ticker}/${date}`,
    publishedDate: data.publishedDate,
    seoKeywords: data.seoKeywords,
    isPublicDate: data.isPublicDate,
    report: data.report,
    lang: "en",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {data.report ? (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
          <DashboardView
            key={`en-${ticker}-${date}`}
            initialSection="sec-reports"
            initialTicker={ticker}
            initialReport={data.report}
            initialTab={initialTab}
            initialDate={date}
            initialReportDates={data.availableDates}
            lang="en"
          />
          <StockStatsSummaryTable
            displayName={data.displayName}
            ticker={ticker}
            publishedDate={data.publishedDate}
            report={data.report}
          />
        </Suspense>
      ) : (
        <UnanalyzedStockView
          ticker={ticker}
          displayName={data.displayName}
        />
      )}
    </>
  );
}
