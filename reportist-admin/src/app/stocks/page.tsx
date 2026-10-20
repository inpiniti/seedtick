import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { buildTickerListJsonLd } from "@/lib/server/catalogJsonLd";

/** 공개 카탈로그는 5분 주기로 갱신 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "리포티스트 국내 및 미국 주식 리포트 목록 · 13인 거장 AI 보고서 아카이브",
  description:
    "리포티스트 국내 및 미국 주식 리포트와 보고서 아카이브. DART·SEC 공시 기반 종목별 주식 보고서, 13인 투자 거장 AI 적정주가와 내재가치 밴드 목록.",
  alternates: {
    canonical: "/stocks",
  },
  openGraph: {
    title: "리포티스트 국내 및 미국 주식 리포트 아카이브",
    description: "국내 및 미국 전 종목 주식 보고서와 13인 거장 합의 적정주가 밴드 목록",
  },
};

export default async function StocksCatalogPage() {
  // 서버 프리페치 → 초기 HTML에 전체 종목 목록과 크롤링 가능한 링크가 포함된다.
  const catalog = await getPublicCatalog();
  const itemListJsonLd = buildTickerListJsonLd(catalog.directory, "/stocks");

  return (
    <>
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-reports"
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
