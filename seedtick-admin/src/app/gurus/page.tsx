import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "13인 투자 거장 철학 및 평가 기준 가이드 | SeedTick",
  description:
    "워런 버핏, 찰리 멍거, 피터 린치, 필립 피셔, 벤저민 그레이엄 등 13인의 전설적 투자 거장들의 원전 철학과 핵심 평가 지표 분석 가이드",
  alternates: {
    canonical: "/gurus",
  },
  openGraph: {
    title: "13인 투자 거장 철학 및 평가 기준 가이드 | SeedTick",
    description: "전설적 투자 대가 13인의 핵심 투자 원칙과 가치 평가 기준 가이드",
  },
};

export default function GurusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-gurus" />
    </Suspense>
  );
}
