import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "미국 주식 13인 거장 AI 가치평가 및 리서치 카탈로그 | SeedTick",
  description:
    "미국 주요 상장 기업의 SEC EDGAR 공시, 손익계산서, 현금흐름표 팩트체크와 13인의 투자 거장 AI 종합 분석 리포트 아카이브",
  alternates: {
    canonical: "/stocks",
  },
  openGraph: {
    title: "미국 주식 13인 거장 AI 리서치 아카이브 | SeedTick",
    description: "전 종목 13인 투자 거장 합의 적정주가 밴드 및 심층 리서치 문서 목록",
  },
};

export default function StocksCatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-reports" />
    </Suspense>
  );
}
