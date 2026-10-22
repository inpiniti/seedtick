import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { absoluteUrl } from "@/lib/siteConfig";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "13 Guru Vote Rankings & Statistics Hub · Reportist",
  description:
    "Top 10 consensus buy stocks agreed by 13 legendary investing gurus, overall valuation score rankings, and real-time guru sentiment summary.",
  alternates: {
    canonical: "/en/stats",
    languages: {
      ko: "/stats",
      en: "/en/stats",
      "x-default": "/stats",
    },
  },
  openGraph: {
    title: "13 Guru Vote Rankings & Statistics Hub · Reportist",
    description: "Top 10 guru consensus stocks and overall valuation score rankings.",
    url: absoluteUrl("/en/stats"),
    siteName: "Reportist Research",
    locale: "en_US",
  },
};

export default async function EnglishStatsRankingPage() {
  const catalog = await getPublicCatalog();

  const topReports = [...catalog.reports]
    .filter((r) => (r.votes_buy || 0) > 0)
    .sort((a, b) => (b.votes_buy || 0) - (a.votes_buy || 0))
    .slice(0, 10);

  const statsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl("/en/stats")}#guru-rankings`,
    name: "Top 10 Consensus Buy Stocks by 13 Legendary Gurus",
    description:
      "Rankings of stocks that received the most buy votes from 13 legendary value investors",
    numberOfItems: topReports.length,
    itemListElement: topReports.map((report, index) => {
      const ticker = report.ticker.toUpperCase();
      const name = report.company_name || ticker;
      return {
        "@type": "ListItem",
        position: index + 1,
        name: `${name}(${ticker}) - ${report.votes_buy || 0} Buy Votes`,
        url: absoluteUrl(`/en/stocks/${encodeURIComponent(ticker)}`),
      };
    }),
  };

  return (
    <>
      {statsJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(statsJsonLd) }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-stats"
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
