import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { UnanalyzedStockView } from "@/components/research/UnanalyzedStockView";
import { StockStatsSummaryTable } from "@/components/research/StockStatsSummaryTable";
import { getStockPageData } from "@/lib/server/stockPageData";
import { buildStockJsonLd } from "@/lib/server/stockJsonLd";
import { absoluteUrl } from "@/lib/siteConfig";

export const revalidate = 3600; // 1시간 주기 ISR 캐시 (크롤러 Edge CDN 캐시 히트)

interface StockDetailPageProps {
  params: Promise<{ ticker: string }>;
}

/**
 * 기준 경로의 canonical 을 만드는 헬퍼.
 * 최신 종목 경로는 /stocks/{ticker} 로 통합
 */
async function buildCanonical(
  ticker: string
): Promise<{ canonicalPath: string; isPublicDate: boolean; publishedDate: string; displayName: string; seoKeywords: string[]; report: Awaited<ReturnType<typeof getStockPageData>>["report"]; isUnknownTicker: boolean }> {
  const data = await getStockPageData(ticker, undefined);
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
}: StockDetailPageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const ticker = (rawTicker || "").toUpperCase();

  const meta = await buildCanonical(ticker);

  if (meta.isUnknownTicker) {
    const isValidTickerPattern = /^[A-Z0-9.\-]{1,10}$/.test(ticker);
    return {
      title: isValidTickerPattern ? `리포티스트 · ${ticker}` : "페이지를 찾을 수 없습니다 · 리포티스트",
      robots: { index: false, follow: isValidTickerPattern },
    };
  }

  const report = meta.report;
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

  const title = `${meta.displayName}(${ticker}) 주가 전망 및 적정주가 분석 · 13인 거장 AI 리포트 | 리포티스트`;
  const description = `${meta.displayName}(${ticker}) 주가 전망과 적정주가 분석 리포트. ${voteSnippet}워런 버핏, 피터 린치 등 13인 투자 거장 AI 에이전트의 독립 가치평가 및 향후 투자 전망, 안전마진 밴드를 확인하세요.`;
  const canonicalUrl = absoluteUrl(meta.canonicalPath);

  return {
    title,
    description,
    keywords: meta.seoKeywords,
    alternates: {
      canonical: meta.canonicalPath,
      languages: {
        "ko": `/stocks/${ticker}`,
        "en": `/en/stocks/${ticker}`,
        "x-default": `/stocks/${ticker}`,
      },
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
}: StockDetailPageProps) {
  const { ticker: rawTicker } = await params;
  const ticker = (rawTicker || "").toUpperCase();

  // SSR initialReport도 public 마스킹 티저만 전달 (원문 절대 미포함).
  // 로그인 유저의 전체 열람은 클라이언트가 /api/reports/detail로 재조회합니다.
  // 단, free 폴백으로 공개 열람 가능한 일자는 공개 범위 안에서 그대로 노출됩니다.
  const pageData = await getStockPageData(ticker, undefined);

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
      {/* 검색 엔진 및 AI 크롤러를 위한 SSR 시맨틱 통계 요약 */}
      <section aria-label={`${displayName} (${ticker}) 주가 전망 및 거장 표결 통계 요약`} className="sr-only">
        <StockStatsSummaryTable
          displayName={displayName}
          ticker={ticker}
          publishedDate={pageData.publishedDate}
          report={reportForRender}
          lang="ko"
        />
      </section>
      <noscript>
        <StockStatsSummaryTable
          displayName={displayName}
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
          initialReportDates={pageData.availableDates}
        />
      </Suspense>
    </>
  );
}
