import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "리포티스트 미국 주식 리포트 목록 · 13인 거장 AI 보고서 아카이브",
  description:
    "리포티스트 미국 주식 리포트와 보고서 아카이브. SEC 공시 기반 종목별 주식 보고서, 13인 투자 거장 AI 적정주가와 내재가치 밴드 목록.",
  alternates: {
    canonical: "/stocks",
  },
  openGraph: {
    title: "리포티스트 미국 주식 리포트 아카이브",
    description: "전 종목 주식 보고서와 13인 거장 합의 적정주가 밴드 목록",
  },
};

export default function StocksCatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-reports" />
    </Suspense>
  );
}
