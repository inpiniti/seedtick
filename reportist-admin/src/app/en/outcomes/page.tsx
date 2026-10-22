import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getOutcomesOverview } from "@/lib/server/outcomesData";
import { absoluteUrl } from "@/lib/siteConfig";
import type { OutcomesOverview } from "@/types/api";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Track Record & 13 Guru Accuracy | Reportist",
  description:
    "Transparent performance tracking of 13 legendary guru valuation models and recommendations compared to the S&P 500 index benchmark.",
  alternates: {
    canonical: "/en/outcomes",
    languages: {
      ko: "/outcomes",
      en: "/en/outcomes",
      "x-default": "/outcomes",
    },
  },
  openGraph: {
    title: "Track Record & 13 Guru Accuracy | Reportist",
    description: "Real-time historical track record, alpha against S&P 500, and consensus accuracy.",
    locale: "en_US",
  },
};

function buildOutcomesJsonLd(overview: OutcomesOverview) {
  if (!overview || overview.guru_stats.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl("/en/outcomes")}#guru-accuracy`,
    name: "13 Investment Guru Accuracy (Track Record)",
    description:
      "Historical investment recommendation accuracy and average return per guru on Reportist research platform",
    numberOfItems: overview.guru_stats.length,
    itemListElement: overview.guru_stats.map((guru, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${guru.name} Accuracy ${guru.accuracy_pct ?? 0}%`,
      url: absoluteUrl(`/en/gurus/${encodeURIComponent(guru.persona)}`),
    })),
  };
}

export default async function EnglishOutcomesPage() {
  const { overview } = await getOutcomesOverview(null, 100);
  const itemListJsonLd = buildOutcomesJsonLd(overview);

  return (
    <>
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-outcomes"
          initialOutcomes={overview}
          lang="en"
        />
      </Suspense>
    </>
  );
}
