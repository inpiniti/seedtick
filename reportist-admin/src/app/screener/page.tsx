import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "실시간 주식 스크리너 · 리포티스트",
  description:
    "워런 버핏, 피터 린치 등 13인 거장 원칙을 통과한 국내 및 미국 주식 스크리너와 적정주가 시그널.",
  alternates: {
    canonical: "/screener",
  },
  openGraph: {
    title: "실시간 주식 스크리너 · 리포티스트",
    description:
      "13인 거장 투자 원칙을 통과한 국내 및 미국 주식 리포트 후보군",
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
