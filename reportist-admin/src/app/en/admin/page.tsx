import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "System Audit Logs | Reportist Admin",
  description: "System error and audit logs monitor",
  alternates: {
    canonical: "/en/admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function EnglishAdminAuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-audit" lang="en" />
    </Suspense>
  );
}
