import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "13인 투자 거장 철학 가이드 · 리포티스트 주식 보고서 평가 기준",
  description:
    "리포티스트 13인 투자 거장 철학과 주식 보고서 평가 기준. 워런 버핏, 찰리 멍거, 피터 린치, 벤저민 그레이엄 등 거장들의 가치평가 지표 가이드.",
  alternates: {
    canonical: "/gurus",
  },
  openGraph: {
    title: "13인 투자 거장 철학 가이드 | 리포티스트",
    description: "전설적 투자 대가 13인의 주식 리포트 평가 원칙과 가치 기준 가이드",
  },
};

export default function GurusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-gurus" />
    </Suspense>
  );
}
