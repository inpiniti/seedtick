import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { buildGuruListJsonLd } from "@/lib/server/catalogJsonLd";

export const metadata: Metadata = {
  title: "13인 투자 거장 철학 가이드 · 리포티스트",
  description:
    "워런 버핏, 피터 린치 등 13인 거장의 심사 철학, 핵심 정량 지표와 종목 표결 현황을 확인하세요.",
  alternates: {
    canonical: "/gurus",
  },
  openGraph: {
    title: "13인 투자 거장 철학 가이드 · 리포티스트",
    description:
      "13인 투자 거장의 독자적 심사 기준과 핵심 평가 지표, 종목별 거장 표결 현황",
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
