import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { buildGuruListJsonLd } from "@/lib/server/catalogJsonLd";

export const metadata: Metadata = {
  title: "13인 투자 거장 철학 가이드 · 리포티스트 주식 보고서 평가 기준",
  description:
    "워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 심사 철학, 체크리스트, 핵심 정량 지표와 각자의 종목 표결 현황을 확인하세요.",
  alternates: {
    canonical: "/gurus",
  },
  openGraph: {
    title: "13인 투자 거장 철학 가이드 | 리포티스트",
    description:
      "13인 투자 거장의 독자적 심사 기준과 핵심 평가 지표, 그리고 이들이 매수·보유·관망·매도한 종목 현황.",
    type: "website",
  },
};

export default function GurusPage() {
  const itemListJsonLd = buildGuruListJsonLd();

  return (
    <>
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView initialSection="sec-gurus" />
      </Suspense>
    </>
  );
}
