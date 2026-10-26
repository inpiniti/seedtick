import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { buildBreadcrumbJsonLd } from "@/lib/server/catalogJsonLd";
import { absoluteUrl, SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Real-time Stock Screener · Reportist",
  description:
    "Real-time equity screener filtering US and global stocks that pass the quantitative criteria of 13 legendary value investors like Warren Buffett and Peter Lynch.",
  alternates: {
    canonical: "/en/screener",
    languages: {
      ko: "/screener",
      en: "/en/screener",
      "x-default": "/screener",
    },
  },
  openGraph: {
    title: "Real-time Stock Screener · Reportist",
    description:
      "Discovery candidate stocks and Superinvestor portfolio holdings filtered by 13 guru criteria.",
    locale: "en_US",
  },
};

const enScreenerBreadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Reportist Home", path: "/en" },
  { name: "Real-time Stock Screener", path: "/en/screener" },
]);

const enScreenerWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${absoluteUrl("/en/screener")}#webpage`,
  url: absoluteUrl("/en/screener"),
  name: "Real-time Stock Screener · Reportist",
  description: "Real-time equity screener filtering stocks that pass 13 legendary value investor criteria.",
  inLanguage: "en",
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

interface ScreenerPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function EnglishScreenerPage({ searchParams }: ScreenerPageProps) {
  const params = await searchParams;
  const isRoma = params?.tab === "roma";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enScreenerBreadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enScreenerWebPageJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView initialSection={isRoma ? "sec-roma" : "sec-screener"} lang="en" />
      </Suspense>
    </>
  );
}
