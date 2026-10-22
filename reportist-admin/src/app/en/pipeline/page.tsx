import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "13 Guru Pipeline | Reportist Admin",
  description: "Real-time execution status of 13-guru research pipeline",
  alternates: {
    canonical: "/en/pipeline",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function EnglishPipelinePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-pipeline" lang="en" />
    </Suspense>
  );
}
