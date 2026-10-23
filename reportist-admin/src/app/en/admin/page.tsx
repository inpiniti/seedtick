import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "Admin (Tweet Generator & Audit) | Reportist Admin",
  description: "X (Twitter) post generator and system audit logs",
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
