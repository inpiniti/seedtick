import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "관리자 (마켓 브리핑·트윗 생성기·감사 로그) | Reportist Admin",
  description: "일일 마켓 브리핑 뉴스레터, X(트위터) 트윗 생성기 및 시스템 감사 로그",
  alternates: {
    canonical: "/admin",
  },
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
