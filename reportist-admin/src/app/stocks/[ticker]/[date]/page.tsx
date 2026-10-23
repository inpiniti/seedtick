import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import type { ResearchDocTab } from "@/components/research/ResearchDocumentView";
import { StockStatsSummaryTable } from "@/components/research/StockStatsSummaryTable";
import { getStockPageData } from "@/lib/server/stockPageData";
import { buildStockJsonLd } from "@/lib/server/stockJsonLd";
import { absoluteUrl } from "@/lib/siteConfig";

interface StockDateDetailPageProps {
  params: Promise<{ ticker: string; date: string }>;
  searchParams: Promise<{ tab?: string; from?: string }>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  if (!DATE_RE.test(decoded)) return null;
  // 실제 존재하는 날짜인지 확인 (2026-02-31 등 방지)
  const parsed = new Date(`${decoded}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== decoded) return null;
  return decoded;
}

/**
 * 과거 분석일자별 영구 URL.
 *
 * /stocks/{ticker}?date=YYYY-MM-DD 는 쿼리 파라미터라 검색엔진이
 * 동일 페이지의 변형으로 취급한다. 경로로 분리해 색인 가능한 개별 문서가 되고,
 * 공개 열람 가능(무료) 날짜만 canonical 로 노출한다.
 */
export async function generateMetadata({
  params,
}: StockDateDetailPageProps): Promise<Metadata> {
  const { ticker: rawTicker, date: rawDate } = await params;
  const ticker = (rawTicker || "").toUpperCase();
  const date = normalizeDate(rawDate);

  if (!date) {
    return {
      title: `리포티스트 · ${ticker} 분석일자 아카이브`,
      robots: { index: false, follow: true },
    };
  }

  const data = await getStockPageData(ticker, date);
  if (data.isUnknownTicker) {
    return {
      title: `리포티스트 · ${ticker}`,
      robots: { index: false, follow: true },
    };
  }
  const canonicalPath = data.isPublicDate
    ? `/stocks/${ticker}/${date}`
    : `/stocks/${ticker}`;

  const report = data.report;
  const votesBuy = typeof report?.votes_buy === "number" ? report.votes_buy : null;
  const votesWatch =
    typeof report?.votes_watch === "number" || typeof report?.votes_hold === "number"
      ? (report.votes_watch || 0) + (report.votes_hold || 0)
      : null;
  const votesSell = typeof report?.votes_sell === "number" ? report.votes_sell : null;
  const verdict = report?.verdict || "";

  const voteSnippet =
    votesBuy !== null && votesWatch !== null && votesSell !== null
      ? `13인 거장 표결 결과: 찬성 ${votesBuy}명, 관망 ${votesWatch}명, 매도 ${votesSell}명${verdict ? ` (${verdict})` : ""}. `
      : "";

  const title = data.isPublicDate
    ? `${data.displayName}(${ticker}) ${date} 주가 전망 및 적정주가 분석 · 13인 거장 AI 리포트 | 리포티스트`
    : `${data.displayName}(${ticker}) 주가 전망 및 적정주가 분석 | 리포티스트`;
  const description = `${data.displayName}(${ticker}) ${date} 기준 주가 전망과 적정주가 분석 리포트. ${voteSnippet}워런 버핏, 피터 린치 등 13인 투자 거장 AI 에이전트의 독립 가치평가 및 향후 투자 전망을 확인하세요.`;

  return {
    title,
    description,
    keywords: data.seoKeywords,
    alternates: {
      canonical: canonicalPath,
      languages: {
        "ko": canonicalPath,
        "en": `/en${canonicalPath}`,
        "x-default": canonicalPath,
      },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonicalPath),
      type: "article",
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

export default async function StockDateDetailPage({
  params,
  searchParams,
}: StockDateDetailPageProps) {
  const { ticker: rawTicker, date: rawDate } = await params;
  const { tab, from } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();
  const date = normalizeDate(rawDate);

  // ?from= 출처는 SEO·민감정보와 무관 — 클라에서만 사용
  void from;

  if (!date) notFound();

  const validTabs: ResearchDocTab[] = ["final", "summaries", "datapack", "chart"];
  const validatedTab = validTabs.includes(tab as ResearchDocTab)
    ? (tab as ResearchDocTab)
    : undefined;

  const pageData = await getStockPageData(ticker, date);
  // 존재하지 않는 티커/일자는 404 처리 (soft 404 로 색인되는 것 방지)
  if (pageData.isUnknownTicker) notFound();

  const reportForRender = pageData.report
    ? { ...pageData.report, company_name: pageData.displayName }
    : null;

  const jsonLd = buildStockJsonLd({
    displayName: pageData.displayName,
    ticker,
    canonicalPath: pageData.isPublicDate
      ? `/stocks/${ticker}/${date}`
      : `/stocks/${ticker}`,
    publishedDate: pageData.publishedDate,
    seoKeywords: pageData.seoKeywords,
    isPublicDate: pageData.isPublicDate,
    report: pageData.report,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 검색 엔진 및 AI 크롤러를 위한 SSR 시맨틱 통계 요약 */}
      <section
        aria-label={`${pageData.displayName} (${ticker}) ${date} 주가 전망 및 거장 표결 통계 요약`}
        className="sr-only"
      >
        <StockStatsSummaryTable
          displayName={pageData.displayName}
          ticker={ticker}
          publishedDate={pageData.publishedDate}
          report={reportForRender}
          lang="ko"
        />
      </section>
      <noscript>
        <StockStatsSummaryTable
          displayName={pageData.displayName}
          ticker={ticker}
          publishedDate={pageData.publishedDate}
          report={reportForRender}
          lang="ko"
        />
      </noscript>
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-reports"
          initialTicker={ticker}
          initialReport={reportForRender}
          initialTab={validatedTab}
          initialDate={date}
          initialReportDates={pageData.availableDates}
        />
      </Suspense>
    </>
  );
}
