import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "파이프라인 & 시스템 감사 로그 | SeedTick Admin",
  description: "13인 거장 AI 파이프라인 진행 상태 및 에러 감사 로그",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-audit" />
    </Suspense>
  );
}
