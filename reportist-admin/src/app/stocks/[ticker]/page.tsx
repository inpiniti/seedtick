import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { UnanalyzedStockView } from "@/components/research/UnanalyzedStockView";
import type { ResearchDocTab } from "@/components/research/ResearchDocumentView";
import { getStockPageData } from "@/lib/server/stockPageData";
import { buildStockJsonLd } from "@/lib/server/stockJsonLd";
import { absoluteUrl } from "@/lib/siteConfig";

interface StockDetailPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tab?: string; date?: string; from?: string }>;
}

/**
 * 기준 경로의 canonical 을 만드는 헬퍼.
 * - 공개 열람 가능한 날짜면 날짜 포함 경로(/stocks/{ticker}/{date})가 canonical
 * - 잠긴 날짜면 종목 경로(/stocks/{ticker})로 통합 (중복 콘텐츠 방지)
 */
async function buildCanonical(
  ticker: string,
  date: string | undefined
): Promise<{ canonicalPath: string; isPublicDate: boolean; publishedDate: string; displayName: string; seoKeywords: string[]; report: Awaited<ReturnType<typeof getStockPageData>>["report"]; isUnknownTicker: boolean }> {
  const data = await getStockPageData(ticker, date);
  if (date && data.isPublicDate && data.publishedDate) {
    return {
      canonicalPath: `/stocks/${data.ticker}/${data.publishedDate}`,
      isPublicDate: true,
      publishedDate: data.publishedDate,
      displayName: data.displayName,
      seoKeywords: data.seoKeywords,
      report: data.report,
      isUnknownTicker: data.isUnknownTicker,
    };
  }
  return {
    canonicalPath: `/stocks/${data.ticker}`,
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
}: StockDetailPageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const { date } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  const meta = await buildCanonical(ticker, date);

  if (meta.isUnknownTicker) {
    return {
      title: `리포티스트 · ${ticker}`,
      robots: { index: false, follow: true },
    };
  }

  const title = `${meta.displayName}(${ticker}) 주식 리포트와 분석 | 리포티스트`;
  const description = `리포티스트 ${meta.displayName}(${ticker}) 주식 보고서와 분석 아카이브. 13인 투자 거장 AI 가치평가 리포트와 적정주가·내재가치 분석을 확인하세요. 최신 리포트는 Pro 멤버십으로 열람 가능합니다.`;
  const canonicalUrl = absoluteUrl(meta.canonicalPath);

  return {
    title,
    description,
    keywords: meta.seoKeywords,
    alternates: {
      canonical: meta.canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
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

export default async function StockDetailPage({
  params,
  searchParams,
}: StockDetailPageProps) {
  const { ticker: rawTicker } = await params;
  const { tab, date, from } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();
  // ?from= 출처는 SEO·민감정보와 무관 — 클라에서만 사용하므로 서버 렌더에는 영향 없음
  void from;

  const validTabs: ResearchDocTab[] = ["final", "summaries", "datapack", "chart"];
  const validatedTab = validTabs.includes(tab as ResearchDocTab)
    ? (tab as ResearchDocTab)
    : undefined;

  // SSR initialReport도 public 마스킹 티저만 전달 (원문 절대 미포함).
  // 로그인 유저의 전체 열람은 클라이언트가 /api/reports/detail로 재조회합니다.
  // 단, free 폴백으로 공개 열람 가능한 일자는 공개 범위 안에서 그대로 노출됩니다.
  const pageData = await getStockPageData(ticker, date);

  // 대중적 통칭/별칭 결합명 (예: "알파벳 A (구글)")
  const displayName = pageData.displayName;

  // 존재하지 않거나 분석되지 않은 티커의 경우:
  if (pageData.isUnknownTicker) {
    // 유효한 티커 심볼 형식(영문 1~6자 또는 국내 종목코드 숫자 6자)인지 확인
    const isValidTickerPattern = /^[A-Z0-9.\-]{1,10}$/.test(ticker);
    if (!isValidTickerPattern) {
      notFound();
    }
    // 유효한 티커면 미분석 안내 및 13인 거장 AI 즉시 분석 요청 뷰 렌더링
    return <UnanalyzedStockView ticker={ticker} displayName={displayName} />;
  }

  const initialReport = pageData.report;

  // SSR initialReport에도 별칭이 포함된 이름을 반영하여 HTML 본문 크롤링 시 검색 키워드 보존
  const reportForRender = initialReport
    ? { ...initialReport, company_name: displayName }
    : null;

  const jsonLd = buildStockJsonLd({
    displayName,
    ticker,
    canonicalPath: pageData.canonicalPath,
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
