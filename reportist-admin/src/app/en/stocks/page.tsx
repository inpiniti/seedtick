import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { buildTickerListJsonLd } from "@/lib/server/catalogJsonLd";

/** Revalidate every 5 minutes */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "US & Global Stock Valuation Rankings & Research Reports · Reportist",
  description:
    "Comprehensive archive of US and global equity research reports. Explore 13 legendary value investor AI fair values, deterministic upside rankings, and margin of safety bands.",
  alternates: {
    canonical: "/en/stocks",
    languages: {
      ko: "/stocks",
      en: "/en/stocks",
      "x-default": "/stocks",
    },
  },
  openGraph: {
    title: "US & Global Stock Valuation Rankings & Research Reports · Reportist",
    description: "Intrinsic fair value rankings and consensus reports agreed by 13 legendary investing gurus.",
    locale: "en_US",
  },
};

export default async function EnglishStocksCatalogPage() {
  const catalog = await getPublicCatalog();
  const itemListJsonLd = buildTickerListJsonLd(catalog.directory, "/en/stocks");

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
          initialSection="sec-reports"
          initialReports={catalog.reports}
          initialCatalogDates={catalog.dates}
          initialCatalogDate={catalog.freeDate}
          initialTickerDirectory={catalog.directory}
          initialTickerNameMap={catalog.tickerNameMap}
          lang="en"
        />
      </Suspense>
    </>
  );
}
