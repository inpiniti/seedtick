import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "시스템 감사 로그 | Reportist Admin",
  description: "시스템 에러 감사 로그 모니터",
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
