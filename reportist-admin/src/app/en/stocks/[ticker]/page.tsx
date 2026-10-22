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

interface EnglishStockDetailPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tab?: string; date?: string; from?: string }>;
}

async function buildEnglishCanonical(
  ticker: string,
  date: string | undefined
) {
  const data = await getStockPageData(ticker, date, "en");
  if (date && data.isPublicDate && data.publishedDate) {
    return {
      canonicalPath: `/en/stocks/${data.ticker}/${data.publishedDate}`,
      isPublicDate: true,
      publishedDate: data.publishedDate,
      displayName: data.displayName,
      seoKeywords: data.seoKeywords,
      report: data.report,
      isUnknownTicker: data.isUnknownTicker,
    };
  }
  return {
    canonicalPath: `/en/stocks/${data.ticker}`,
    isPublicDate: data.isPublicDate,
    publishedDate: data.publishedDate,
    displayName: data.displayName,
    seoKeywords: data.seoKeywords,
    report: data.report,
    isUnknownTicker: data.isUnknownTicker,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: EnglishStockDetailPageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const { date } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  const meta = await buildEnglishCanonical(ticker, date);

  if (meta.isUnknownTicker) {
    return {
      title: `Reportist · ${ticker}`,
      robots: { index: false, follow: true },
    };
  }

  const report = meta.report;
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

  const title = `${meta.displayName} (${ticker}) Stock Forecast & Fair Value Analysis · 13 Guru AI Research | Reportist`;
  const description = `${meta.displayName} (${ticker}) stock forecast and intrinsic fair value analysis report. ${voteSnippet}Explore independent valuations, margin of safety bands, and forecasts from 13 legendary investor AI agents including Warren Buffett and Peter Lynch.`;
  const canonicalUrl = absoluteUrl(meta.canonicalPath);

  return {
    title,
    description,
    keywords: meta.seoKeywords,
    alternates: {
      canonical: meta.canonicalPath,
      languages: {
        ko: `/stocks/${ticker}`,
        en: `/en/stocks/${ticker}`,
        "x-default": `/stocks/${ticker}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      locale: "en_US",
      publishedTime: meta.publishedDate
        ? new Date(meta.publishedDate).toISOString()
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

export default async function EnglishStockDetailPage({
  params,
  searchParams,
}: EnglishStockDetailPageProps) {
  const { ticker: rawTicker } = await params;
  const { tab, date, from } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  const data = await getStockPageData(ticker, date, "en");

  if (data.isUnknownTicker) {
    notFound();
  }

  const initialTab = (
    tab === "screener" ||
    tab === "matrix" ||
    tab === "pipeline" ||
    tab === "chart" ||
    tab === "reports" ||
    tab === "gurus" ||
    tab === "history" ||
    tab === "stats" ||
    tab === "screener_v2"
      ? tab
      : "reports"
  ) as ResearchDocTab;

  const jsonLd = buildStockJsonLd({
    displayName: data.displayName,
    ticker: data.ticker,
    canonicalPath: data.canonicalPath,
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
            key={`en-${ticker}-${data.publishedDate}`}
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
