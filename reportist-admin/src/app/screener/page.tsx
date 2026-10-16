import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "리포티스트 실시간 스크리너 · 13인 거장 합의 미국 주식 리포트",
  description:
    "리포티스트 실시간 주식 스크리너. 워런 버핏, 피터 린치 등 13인 투자 거장 원칙을 통과한 미국 주식 보고서 후보와 적정주가 signal.",
  alternates: {
    canonical: "/screener",
  },
  openGraph: {
    title: "리포티스트 실시간 주식 스크리너",
    description:
      "워런 버핏, 피터 린치 등 13인의 투자 원칙을 통과한 미국 주식 리포트 후보군",
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
