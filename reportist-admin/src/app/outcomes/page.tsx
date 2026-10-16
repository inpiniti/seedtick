import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "투자 리포트 성과 및 거장 적중률 (Track Record) | Reportist",
  description:
    "발행된 가치평가 리포트와 13인 거장들의 투자의견이 실제 시장에서 어떤 수익률을 기록했는지 투명하게 추적하고 검증합니다.",
  openGraph: {
    title: "투자 리포트 성과 및 거장 적중률 | Reportist",
    description: "S&P500 대비 초과수익률 및 13인 투자 거장 예측 적중률 실시간 트랙레코드",
  },
};

export default function OutcomesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-outcomes" />
    </Suspense>
  );
}
