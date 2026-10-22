import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { buildTickerListJsonLd } from "@/lib/server/catalogJsonLd";
import { SITE_URL } from "@/lib/siteConfig";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Reportist · 13 Legendary Investment Guru AI Fair Value & Stock Research",
  description:
    "End emotional investing. Reportist analyzes US and global equities every day using valuation models and intrinsic value bands derived from 13 legendary investing gurus including Warren Buffett, Benjamin Graham, and Peter Lynch.",
  alternates: {
    canonical: "/en",
    languages: {
      ko: "/",
      en: "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title: "Reportist · 13 Legendary Investment Guru AI Equity Research",
    description:
      "Deterministic fair values agreed by 13 legendary gurus, robust quality screener, and 100% transparent historical track record.",
    type: "website",
    siteName: "Reportist Research",
    locale: "en_US",
  },
};

const homeEnglishJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/en#webpage`,
      url: `${SITE_URL}/en`,
      name: "Reportist · 13 Investment Guru AI Fair Value & Stock Reports",
      alternateName: "Reportist Research",
      description:
        "Independent equity research platform analyzing intrinsic values and safety margins daily with the original philosophies and quant algorithms of 13 legendary gurus.",
      inLanguage: "en",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: [
        { "@type": "Thing", name: "Fair Value Analysis" },
        { "@type": "Thing", name: "Intrinsic Value Valuation" },
        { "@type": "Thing", name: "Margin of Safety" },
        { "@type": "Thing", name: "Stock Forecast" },
        { "@type": "Thing", name: "13 Investment Gurus" },
        { "@type": "Thing", name: "Stock Screener" },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#application`,
      name: "Reportist",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default async function EnglishHomePage() {
  const catalog = await getPublicCatalog();
  const itemListJsonLd = buildTickerListJsonLd(catalog.directory, "/en");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeEnglishJsonLd) }}
      />
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListJsonLd),
          }}
        />
      ) : null}
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="all"
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
