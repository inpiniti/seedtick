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

export const revalidate = 86400; // 과거 일자 브리핑은 24시간 주기 갱신

export async function generateMetadata({
  params,
}: BriefingDetailPageProps): Promise<Metadata> {
  const { date } = await params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      title: "브리핑을 찾을 수 없습니다 · 리포티스트",
      robots: { index: false, follow: false },
    };
  }

  const data = await getBriefingPageData(date, false);
  if (!data.briefing) {
    return {
      title: `${date} 데일리 마켓 브리핑 · 리포티스트`,
      description: `${date} 일자 마켓 브리핑을 준비 중입니다.`,
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
      url: `${SITE_URL}/briefings/${date}`,
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

export default async function BriefingDetailPage({
  params,
}: BriefingDetailPageProps) {
  const { date } = await params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const data = await getBriefingPageData(date, false);
  if (!data.briefing) {
    notFound();
  }

  const articleJsonLd = buildBriefingArticleJsonLd(data.briefing, false);
  const breadcrumbJsonLd = buildBriefingBreadcrumbJsonLd(date, false);

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* ── SEO 구조화 데이터 주입 ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ── 검색 엔진 및 AI 크롤러를 위한 SSR 시맨틱 기사 본문 ── */}
      <div className="sr-only" aria-hidden="true">
        <h1>{data.briefing.title}</h1>
        <p>{data.description}</p>
        <div>
          <h2>오늘의 시장 3줄 요약</h2>
          <ul>
            {(data.briefing.summary_3lines || []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>언급된 주요 종목</h2>
          <p>{(data.briefing.tickers || []).join(", ")}</p>
        </div>
        <article>{data.briefing.content}</article>
      </div>

      {/* ── 상단 글로벌 헤더 바 ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e2e8f0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <ReportistLogoBadge size="md" />
            <span className="font-bold text-base text-[#0f172a] tracking-tight group-hover:text-blue-600 transition-colors">
              Reportist
            </span>
          </Link>
          <span className="text-slate-300">/</span>
          <Link
            href="/briefings"
            className="text-xs sm:text-sm font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            데일리 마켓 브리핑
          </Link>
        </div>

        <nav aria-label="메인 네비게이션" className="flex items-center gap-2 text-xs font-semibold">
          <Link
            href="/stocks"
            className="hidden sm:inline-block px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            종목 리포트
          </Link>
          <Link
            href="/screener"
            className="hidden sm:inline-block px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            실시간 스크리너
          </Link>
          <Link
            href="/briefings"
            className="px-3 py-1.5 bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors shadow-2xs"
          >
            전체 브리핑 목록
          </Link>
        </nav>
      </header>

      {/* ── 메인 컨텐츠 영역 ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Suspense fallback={<div className="h-96 bg-white rounded-2xl animate-pulse" />}>
          <BriefingDetailView
            briefing={data.briefing}
            availableDates={data.availableDates}
            isEn={false}
          />
        </Suspense>
      </main>

      {/* ── 하단 푸터 ── */}
      <footer className="border-t border-[#e2e8f0] bg-white py-8 px-4 text-center text-xs text-[#94a3b8]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Reportist Research. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-[#0f172a] transition-colors">
              개인정보처리방침
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#0f172a] transition-colors">
              서비스이용약관
            </Link>
            <span>·</span>
            <Link href="/feedback" className="hover:text-[#0f172a] transition-colors">
              의견 및 제안
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
