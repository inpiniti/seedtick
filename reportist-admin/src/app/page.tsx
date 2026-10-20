import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { buildTickerListJsonLd } from "@/lib/server/catalogJsonLd";

/**
 * 공개 카탈로그는 5분 주기로 갱신한다.
 * (리포트는 하루 1회 발행되므로 5분이면 충분하고, 정적 셸 + ISR 로 TTFB 를 낮춘다)
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "리포티스트 Reportist Research · 국내 및 미국 주식 리포트와 13인 거장 AI 적정주가 분석",
  description:
    "리포티스트(Reportist)는 워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 철학으로 국내 및 미국 주식 리포트와 보고서를 분석합니다. 종목별 적정주가, 내재가치 밴드, 실시간 스크리너 제공.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "리포티스트 Reportist Research · 국내 및 미국 주식 리포트 아카이브",
    description:
      "13인 투자 거장이 합의한 국내 및 미국 주식 리포트와 보고서, 적정주가와 내재가치 밴드, 실시간 스크리너",
    type: "website",
    siteName: "리포티스트 Reportist Research",
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://reportist.kr/#webpage",
  url: "https://reportist.kr",
  name: "리포티스트 Reportist Research · 국내 및 미국 주식 리포트와 적정주가 분석",
  alternateName: "리포티스트",
  inLanguage: "ko",
  isPartOf: { "@id": "https://reportist.kr/#website" },
  about: [
    { "@type": "Thing", name: "국내 주식 리포트" },
    { "@type": "Thing", name: "미국 주식 리포트" },
    { "@type": "Thing", name: "주식 보고서" },
    { "@type": "Thing", name: "적정주가" },
  ],
};

export default async function HomePage() {
  // 서버에서 공개 카탈로그를 프리페치해 초기 HTML에 종목 목록·링크를 포함시킨다.
  // (클라 fetch 전용이면 봇이 빈 페이지를 색인하게 된다)
  const catalog = await getPublicCatalog();
  const itemListJsonLd = buildTickerListJsonLd(catalog.directory, "/");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="all"
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

