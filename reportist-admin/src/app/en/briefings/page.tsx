import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getBriefingPageData } from "@/lib/server/briefingPageData";
import {
  buildBriefingBreadcrumbJsonLd,
  buildBriefingListJsonLd,
} from "@/lib/server/briefingJsonLd";
import { SITE_URL } from "@/lib/siteConfig";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getBriefingPageData(undefined, true);

  return {
    title: "Daily Market Briefing · Global Community & 24h News Radar | Reportist",
    description: data.description,
    keywords: data.keywords,
    alternates: {
      canonical: "/en/briefings",
      languages: {
        ko: "/briefings",
        en: "/en/briefings",
        "x-default": "/briefings",
      },
    },
    openGraph: {
      title: "Daily Market Briefing · Global Community & 24h News Radar | Reportist",
      description: data.description,
      type: "website",
      url: `${SITE_URL}/en/briefings`,
      siteName: "Reportist",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "Daily Market Briefing · Reportist",
      description: data.description,
    },
  };
}

export default async function EnglishBriefingsHubPage() {
  const data = await getBriefingPageData(undefined, true);
  const breadcrumbJsonLd = buildBriefingBreadcrumbJsonLd(undefined, true);
  const listJsonLd = buildBriefingListJsonLd(data.availableDates, true);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
      />

      <nav
        aria-label="Daily Market Briefing Archive"
        className="sr-only"
      >
        <h2>Daily Market Briefing Archive</h2>
        <ul>
          {data.availableDates.map((date) => (
            <li key={date}>
              <a href={`/en/briefings/${date}`}>{date} Daily Market Briefing</a>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView initialSection="sec-briefings" />
      </Suspense>
    </>
  );
}
