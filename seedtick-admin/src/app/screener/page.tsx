import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "미국 주식 13인 거장 실시간 스크리너 | SeedTick",
  description:
    "토스증권 13인 투자 거장 공통 합의 종목 및 DataRoma 슈퍼인베스터 그랜드 포트폴리오 기반 미국 주식 실시간 스크리닝",
  alternates: {
    canonical: "/screener",
  },
  openGraph: {
    title: "미국 주식 13인 거장 실시간 스크리너 | SeedTick",
    description:
      "워런 버핏, 피터 린치 등 13인의 투자 원칙을 통과한 미국 주식 실시간 발굴 후보군",
  },
};

interface ScreenerPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ScreenerPage({ searchParams }: ScreenerPageProps) {
  const params = await searchParams;
  const isRoma = params?.tab === "roma";

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection={isRoma ? "sec-roma" : "sec-screener"} />
    </Suspense>
  );
}
