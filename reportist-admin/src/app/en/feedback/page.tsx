import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Feedback & Feature Requests · Reportist",
  description:
    "Share your feedback, report issues, or suggest new features for Reportist. We actively review and implement community suggestions.",
  alternates: {
    canonical: "/en/feedback",
    languages: {
      ko: "/feedback",
      en: "/en/feedback",
      "x-default": "/feedback",
    },
  },
  openGraph: {
    title: "Feedback & Feature Requests · Reportist",
    description: "Suggest new features or report issues for Reportist.",
    type: "website",
    url: `${SITE_URL}/en/feedback`,
    locale: "en_US",
  },
};

export default function EnglishFeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-feedback" lang="en" />
    </Suspense>
  );
}
