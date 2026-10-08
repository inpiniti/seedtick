import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "SeedTick Research · 미국 주식 13인 거장 AI 가치평가 및 리서치 아카이브",
  description:
    "워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 원전 철학으로 분석한 미국 주식 AI 가치평가, 내재가치 밴드 및 실시간 스크리닝",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SeedTick Research · 미국 주식 13인 거장 AI 가치평가 아카이브",
    description:
      "13인의 투자 거장이 합의한 미국 주식 적정주가와 내재가치 밴드, 실시간 스크리너",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="all" />
    </Suspense>
  );
}
