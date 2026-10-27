import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getBriefingPageData } from "@/lib/server/briefingPageData";
import {
  buildBriefingBreadcrumbJsonLd,
  buildBriefingListJsonLd,
} from "@/lib/server/briefingJsonLd";
import { SITE_URL } from "@/lib/siteConfig";

export const revalidate = 3600; // 1시간 주기 자동 갱신

export async function generateMetadata(): Promise<Metadata> {
  const data = await getBriefingPageData();

  return {
    title: "데일리 마켓 브리핑 · 글로벌 커뮤니티 & 24시간 뉴스 레이더 | 리포티스트",
    description: data.description,
    keywords: data.keywords,
    alternates: {
      canonical: "/briefings",
      languages: {
        ko: "/briefings",
        en: "/en/briefings",
        "x-default": "/briefings",
      },
    },
    openGraph: {
      title: "데일리 마켓 브리핑 · 글로벌 커뮤니티 & 24시간 뉴스 레이더 | 리포티스트",
      description: data.description,
      type: "website",
      url: `${SITE_URL}/briefings`,
      siteName: "Reportist",
    },
    twitter: {
      card: "summary_large_image",
      title: "데일리 마켓 브리핑 · 리포티스트",
      description: data.description,
    },
  };
}

export default async function BriefingsHubPage() {
  const data = await getBriefingPageData();
  const breadcrumbJsonLd = buildBriefingBreadcrumbJsonLd();
  const listJsonLd = buildBriefingListJsonLd(data.availableDates, false);

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

      {/* 검색 엔진 크롤러용 일자별 브리핑 내부 링크 아카이브 (사이트링크 & 크롤링 보장) */}
      <nav
        aria-label="데일리 마켓 브리핑 전체 발행 아카이브"
        className="sr-only"
      >
        <h2>데일리 마켓 브리핑 일자별 아카이브</h2>
        <ul>
          {data.availableDates.map((date) => (
            <li key={date}>
              <a href={`/briefings/${date}`}>{date} 데일리 마켓 브리핑</a>
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
