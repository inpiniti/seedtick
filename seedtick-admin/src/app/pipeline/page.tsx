import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "13인 거장 파이프라인 | SeedTick Admin",
  description: "13인 거장 AI 파이프라인 실시간 진행 상태",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-pipeline" />
    </Suspense>
  );
}
