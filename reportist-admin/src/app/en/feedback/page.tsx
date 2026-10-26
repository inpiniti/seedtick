import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { buildBreadcrumbJsonLd } from "@/lib/server/catalogJsonLd";
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

const enFeedbackBreadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Reportist Home", path: "/en" },
  { name: "Feedback & Feature Requests", path: "/en/feedback" },
]);

const enFeedbackJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/en/feedback#webpage`,
  url: `${SITE_URL}/en/feedback`,
  name: "Reportist Feedback & Feature Requests",
  description: "Community feedback and feature suggestions for Reportist research platform",
  inLanguage: "en",
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

export default function EnglishFeedbackPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enFeedbackBreadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enFeedbackJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView initialSection="sec-feedback" lang="en" />
      </Suspense>
    </>
  );
}
