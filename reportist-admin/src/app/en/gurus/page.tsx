import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { buildGuruListJsonLd } from "@/lib/server/catalogJsonLd";

export const metadata: Metadata = {
  title: "13 Guru Methodologies & Valuation Guides · Reportist",
  description:
    "Explore the distinct valuation philosophies, checklists, focus metrics, and stock voting records of 13 legendary value investors.",
  alternates: {
    canonical: "/en/gurus",
    languages: {
      ko: "/gurus",
      en: "/en/gurus",
      "x-default": "/gurus",
    },
  },
  openGraph: {
    title: "13 Guru Methodologies & Valuation Guides · Reportist",
    description:
      "Distinct criteria, core quantitative indicators, and voting records of 13 legendary investing gurus.",
    type: "website",
    locale: "en_US",
  },
};

export default function EnglishGurusPage() {
  const itemListJsonLd = buildGuruListJsonLd();

  return (
    <>
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView initialSection="sec-gurus" lang="en" />
      </Suspense>
    </>
  );
}
