import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBriefingPageData } from "@/lib/server/briefingPageData";
import {
  buildBriefingArticleJsonLd,
  buildBriefingBreadcrumbJsonLd,
} from "@/lib/server/briefingJsonLd";
import { BriefingDetailView } from "@/components/briefings/BriefingDetailView";
import { ReportistLogoBadge } from "@/components/ui/ReportistLogo";
import { SITE_URL } from "@/lib/siteConfig";

interface BriefingDetailPageProps {
  params: Promise<{ date: string }>;
}

export const revalidate = 86400; // Past briefings revalidate daily

export async function generateMetadata({
  params,
}: BriefingDetailPageProps): Promise<Metadata> {
  const { date } = await params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      title: "Briefing Not Found · Reportist",
      robots: { index: false, follow: false },
    };
  }

  const data = await getBriefingPageData(date, true);
  if (!data.briefing) {
    return {
      title: `${date} Daily Market Briefing · Reportist`,
      description: `Market briefing for ${date} is being prepared.`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    alternates: {
      canonical: data.canonicalPath,
      languages: {
        ko: `/briefings/${date}`,
        en: `/en/briefings/${date}`,
        "x-default": `/briefings/${date}`,
      },
    },
    openGraph: {
      title: data.title,
      description: data.description,
      type: "article",
      publishedTime: `${date}T00:05:00+09:00`,
      modifiedTime: data.briefing.updated_at || `${date}T00:05:00+09:00`,
      url: `${SITE_URL}/en/briefings/${date}`,
      siteName: "Reportist",
      section: "Finance & Stock Research",
      tags: data.briefing.tickers || [],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
    },
  };
}

export default async function BriefingDetailPageEn({
  params,
}: BriefingDetailPageProps) {
  const { date } = await params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const data = await getBriefingPageData(date, true);
  if (!data.briefing) {
    notFound();
  }

  const articleJsonLd = buildBriefingArticleJsonLd(data.briefing, true);
  const breadcrumbJsonLd = buildBriefingBreadcrumbJsonLd(date, true);

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* ── SEO Structured Data (JSON-LD) ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ── SSR Semantic Article Body for Search Engines & AI Crawlers ── */}
      <div className="sr-only" aria-hidden="true">
        <h1>{data.briefing.title_en || data.briefing.title}</h1>
        <p>{data.description}</p>
        <div>
          <h2>Today&apos;s Market 3-Line Summary</h2>
          <ul>
            {(
              (data.briefing.summary_3lines_en && data.briefing.summary_3lines_en.length > 0
                ? data.briefing.summary_3lines_en
                : data.briefing.summary_3lines) || []
            ).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Key Mentioned Tickers</h2>
          <p>{(data.briefing.tickers || []).join(", ")}</p>
        </div>
        <article>{data.briefing.content_en || data.briefing.content}</article>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e2e8f0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/en" className="flex items-center gap-2 group">
            <ReportistLogoBadge size="md" />
            <span className="font-bold text-base text-[#0f172a] tracking-tight group-hover:text-blue-600 transition-colors">
              Reportist
            </span>
          </Link>
          <span className="text-slate-300">/</span>
          <Link
            href="/en/briefings"
            className="text-xs sm:text-sm font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            Daily Market Briefing
          </Link>
        </div>

        <nav aria-label="Main Navigation" className="flex items-center gap-2 text-xs font-semibold">
          <Link
            href="/en/stocks"
            className="hidden sm:inline-block px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            Stock Reports
          </Link>
          <Link
            href="/en/screener"
            className="hidden sm:inline-block px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            Live Screener
          </Link>
          <Link
            href="/en/briefings"
            className="px-3 py-1.5 bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors shadow-2xs"
          >
            All Briefings
          </Link>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Suspense fallback={<div className="h-96 bg-white rounded-2xl animate-pulse" />}>
          <BriefingDetailView
            briefing={data.briefing}
            availableDates={data.availableDates}
            isEn={true}
          />
        </Suspense>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e2e8f0] bg-white py-8 px-4 text-center text-xs text-[#94a3b8]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Reportist Research. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <Link href="/en/privacy" className="hover:text-[#0f172a] transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/en/terms" className="hover:text-[#0f172a] transition-colors">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="/en/feedback" className="hover:text-[#0f172a] transition-colors">
              Feedback
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
