import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getOutcomesOverview } from "@/lib/server/outcomesData";
import { buildBreadcrumbJsonLd } from "@/lib/server/catalogJsonLd";
import { absoluteUrl } from "@/lib/siteConfig";
import type { OutcomesOverview } from "@/types/api";

const outcomesBreadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "리포티스트 홈", path: "/" },
  { name: "투자 리포트 성과 및 거장 적중률", path: "/outcomes" },
]);

/**
 * 성과 추적 데이터는 하루 1회 갱신되므로 1시간 주기면 충분하다.
 * (정적 셸 + ISR 로 TTFB 를 낮추면서도 값이 오래되지 않게)
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "투자 리포트 성과 및 거장 적중률 | 리포티스트",
  description:
    "발행된 가치평가 리포트와 13인 거장들의 투자의견이 시장에서 어떤 수익률을 기록했는지 투명하게 추적합니다.",
  alternates: {
    canonical: "/outcomes",
  },
  openGraph: {
    title: "투자 리포트 성과 및 거장 적중률 | 리포티스트",
    description: "S&P500 대비 초과수익률 및 13인 투자 거장 예측 적중률 실시간 트랙레코드",
  },
};

/** 성과 추적 JSON-LD (13인 거장별 적중률) */
function buildOutcomesJsonLd(overview: OutcomesOverview) {
  if (!overview || overview.guru_stats.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl("/outcomes")}#guru-accuracy`,
    name: "13인 투자 거장 적중률 (Track Record)",
    description:
      "리포티스트가 발행한 가치평가 리포트 기준 13인 투자 거장별 투자의견 적중률과 평균 수익률",
    numberOfItems: overview.guru_stats.length,
    itemListElement: overview.guru_stats.map((guru, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${guru.name} 적중률 ${guru.accuracy_pct ?? 0}%`,
      url: absoluteUrl(`/gurus/${encodeURIComponent(guru.persona)}`),
    })),
  };
}

export default async function OutcomesPage() {
  // 서버에서 성과 데이터를 프리페치해 초기 HTML에 트랙레코드를 포함시킨다.
  // (클라 fetch 전용이면 봇이 "적중률" 키워드 대상 콘텐츠를 색인하지 못한다)
  const { overview } = await getOutcomesOverview(null, 100);
  const itemListJsonLd = buildOutcomesJsonLd(overview);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(outcomesBreadcrumbJsonLd) }}
      />
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-outcomes"
          initialOutcomes={overview}
        />
      </Suspense>
    </>
  );
}
