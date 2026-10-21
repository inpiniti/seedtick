import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { absoluteUrl } from "@/lib/siteConfig";

/** 통계 랭킹 페이지는 1시간 주기로 갱신 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "13인 투자 거장 표결 랭킹 및 통계 허브 · 리포티스트",
  description:
    "워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인의 전설적 투자 거장 AI 에이전트가 선정한 최다 찬성 종목 Top 10, 가치평가 종합 점수 랭킹, 실시간 거장 센티먼트 통계 요약.",
  alternates: {
    canonical: "/stats",
  },
  openGraph: {
    title: "13인 투자 거장 표결 랭킹 및 통계 허브 · 리포티스트",
    description:
      "13인 투자 거장 최다 찬성 순위 Top 10 및 가치평가 종합 점수 랭킹 실시간 통계 리포트",
    url: absoluteUrl("/stats"),
    siteName: "Reportist Research",
  },
  twitter: {
    card: "summary_large_image",
    title: "13인 투자 거장 표결 랭킹 및 통계 허브 · 리포티스트",
    description:
      "13인 투자 거장 최다 찬성 순위 Top 10 및 가치평가 종합 점수 랭킹 실시간 통계 리포트",
  },
};

export default async function StatsRankingPage() {
  const catalog = await getPublicCatalog();

  // 상위 최다 찬성 종목 목록으로 ItemList 스키마 생성 (검색 엔진 및 AI 봇 인용용)
  const topReports = [...catalog.reports]
    .filter((r) => (r.votes_buy || 0) > 0)
    .sort((a, b) => (b.votes_buy || 0) - (a.votes_buy || 0))
    .slice(0, 10);

  const statsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl("/stats")}#guru-rankings`,
    name: "13인 투자 거장 최다 찬성 주식 랭킹 Top 10",
    description:
      "워런 버핏, 피터 린치 등 13인의 전설적 투자 대가 AI가 가장 많이 매수/찬성 표결을 던진 종목 순위",
    numberOfItems: topReports.length,
    itemListElement: topReports.map((report, index) => {
      const ticker = report.ticker.toUpperCase();
      const name = catalog.tickerNameMap[ticker] || report.company_name || ticker;
      return {
        "@type": "ListItem",
        position: index + 1,
        name: `${name}(${ticker}) - 찬성 ${report.votes_buy || 0}표`,
        url: absoluteUrl(`/stocks/${encodeURIComponent(ticker)}`),
      };
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(statsJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-stats"
          initialReports={catalog.reports}
          initialCatalogDates={catalog.dates}
          initialCatalogDate={catalog.freeDate}
          initialTickerDirectory={catalog.directory}
          initialTickerNameMap={catalog.tickerNameMap}
        />
      </Suspense>
    </>
  );
}
