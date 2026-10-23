import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { buildTickerListJsonLd } from "@/lib/server/catalogJsonLd";
import { SITE_URL } from "@/lib/siteConfig";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Reportist · Stock Fair Value & 13 Guru AI Equity Research",
  description:
    "Stop emotional investing. Reportist (Reportist Research) is an independent stock research platform calculating deterministic stock fair values and margin of safety bands for US & global equities based on 13 legendary gurus.",
  keywords: [
    "Reportist",
    "Reportist stock",
    "Reportist fair value",
    "Reportist research",
    "Reportist valuation",
    "stock fair value calculator",
    "intrinsic value screener",
    "13 legendary gurus",
    "value investing AI",
    "equity research platform",
  ],
  alternates: {
    canonical: "/en",
    languages: {
      ko: "/",
      en: "/en",
      "x-default": "/",
    },
    types: {
      "application/rss+xml": `${SITE_URL}/en/rss.xml`,
    },
  },
  openGraph: {
    title: "Reportist Stock Research · 13 Guru AI Fair Value & Valuation",
    description:
      "Deterministic stock fair values agreed by 13 legendary gurus, robust quality screener, and 100% transparent historical track record.",
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
      name: "Reportist · Stock Fair Value & 13 Guru AI Equity Research",
      alternateName: [
        "Reportist",
        "Reportist Stock",
        "Reportist Fair Value",
        "Reportist Research",
      ],
      description:
        "Independent stock research platform calculating deterministic intrinsic values and safety margins daily with the original philosophies and quant algorithms of 13 legendary gurus.",
      inLanguage: "en",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: [
        { "@type": "Thing", name: "Reportist Stock Research" },
        { "@type": "Thing", name: "Reportist Fair Value" },
        { "@type": "Thing", name: "Stock Valuation" },
        { "@type": "Thing", name: "Intrinsic Value Calculator" },
        { "@type": "Thing", name: "Margin of Safety" },
        { "@type": "Thing", name: "13 Investment Gurus" },
        { "@type": "Thing", name: "Stock Screener" },
      ],
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": `${SITE_URL}/#application`,
      name: "Reportist",
      alternateName: [
        "Reportist Research",
        "Reportist Stock Screener",
        "Reportist Fair Value Calculator",
      ],
      applicationCategory: "FinanceApplication",
      applicationSubCategory: "Stock Valuation & Investment Research",
      operatingSystem: "Web",
      url: `${SITE_URL}/en`,
      description:
        "AI-powered stock analysis, research and fair value calculator web application based on 13 legendary investment gurus (Warren Buffett, Benjamin Graham, Peter Lynch, etc.).",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Intrinsic stock fair value calculations using 13 legendary investor models (DCF, NCAV, Graham Number, Peter Lynch Fair PE)",
        "Daily automated stock research reports published after US and Korean market close",
        "Real-time 5-stage quantitative stock screener filtering robust quality companies",
        "100% transparent historical track record and valuation formulas",
      ],
      sameAs: [
        "https://x.com/reportist_app",
        "https://twitter.com/reportist_app",
        "https://www.producthunt.com/@reportist",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/en#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Reportist and Reportist Research?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Reportist (Reportist Research) is an independent AI-powered stock research and valuation platform. It calculates deterministic stock fair values and margin of safety price bands for US and global equities based on the investment philosophies and quantitative models of 13 legendary investors including Warren Buffett, Benjamin Graham, and Peter Lynch.",
          },
        },
        {
          "@type": "Question",
          name: "How does Reportist calculate stock fair value?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Reportist calculates stock fair values by applying 13 proven quantitative valuation models—such as Discounted Cash Flow (DCF), Net Current Asset Value (NCAV), Graham Number, and Peter Lynch Fair PE—directly to audited SEC 10-K/10-Q financial statements, eliminating emotional FOMO and Wall Street sell-side bias.",
          },
        },
        {
          "@type": "Question",
          name: "What features are included in Reportist Stock Research?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Reportist Stock Research provides daily automated stock valuation reports, a real-time 5-stage quantitative equity screener, guru voting consensus, margin of safety price bands, and a 100% transparent historical performance track record.",
          },
        },
        {
          "@type": "Question",
          name: "Is Reportist free to use for stock analysis?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, Reportist provides free public access to featured stock research reports, fair value calculations, screener filters, and the 13 investment guru valuation methodologies.",
          },
        },
      ],
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
