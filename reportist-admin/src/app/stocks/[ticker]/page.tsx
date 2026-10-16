import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { maskReportRowPublic } from "@/lib/subscription/reportAccess";
import { ResearchDocTab } from "@/components/research/ResearchDocumentView";
import type { GuruReportRow } from "@/types/api";

interface StockDetailPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tab?: string; date?: string }>;
}

/**
 * 종목 한글명 조회 (비민감 공개 데이터만 사용).
 * 1순위 guru_reports.company_name(예: 핀둬둬(ADR)), 2순위 ticker_logos.korean_name.
 * verdict·적정가 등 민감 컬럼은 절대 조회하지 않음.
 */
async function resolveKoreanName(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  ticker: string,
  reportCompanyName: string
): Promise<string> {
  if (reportCompanyName) return reportCompanyName;
  if (!supabase) return ticker;
  try {
    const { data } = await supabase
      .from("ticker_logos")
      .select("korean_name")
      .eq("ticker", ticker)
      .maybeSingle();
    const ko = ((data as { korean_name?: string } | null)?.korean_name || "").trim();
    return ko || ticker;
  } catch {
    return ticker;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: StockDetailPageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const { date } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  let companyName = ticker;
  let publishedDate = date || "";

  // SSR은 로그인 컨텍스트가 없으므로 public(free) 기준 마스킹된 티저만 사용.
  // 최근 30일 리포트의 verdict/적정가는 메타데이터에 절대 포함하지 않음.
  const supabase = getServerSupabaseClient();
  if (supabase) {
    try {
      let report: GuruReportRow | null = null;
      if (date) {
        const { data } = await supabase
          .from("guru_reports")
          .select("*")
          .eq("id", `${date}_${ticker}`)
          .maybeSingle();
        report = (data as GuruReportRow | null) || null;
        if (!report) {
          const fallback = await supabase
            .from("guru_reports")
            .select("*")
            .eq("d", date)
            .eq("ticker", ticker)
            .limit(1)
            .maybeSingle();
          report = (fallback.data as GuruReportRow | null) || null;
        }
      } else {
        const { data } = await supabase
          .from("guru_reports")
          .select("*")
          .eq("ticker", ticker)
          .order("d", { ascending: false })
          .limit(1)
          .maybeSingle();
        report = (data as GuruReportRow | null) || null;
      }

      if (report) {
        const teaser = maskReportRowPublic(report);
        if (teaser.company_name) companyName = teaser.company_name;
        if (teaser.d) publishedDate = teaser.d;
      }
      companyName = await resolveKoreanName(supabase, ticker, companyName);
    } catch {
      // ignore
    }
  }

  const title = `${companyName}(${ticker}) 주식 리포트와 분석 | 리포티스트`;
  const description = `리포티스트 ${companyName}(${ticker}) 주식 보고서와 분석 아카이브. 13인 투자 거장 AI 가치평가 리포트와 적정주가·내재가치 분석을 확인하세요. 최신 리포트는 Pro 멤버십으로 열람 가능합니다.`;
  const canonicalUrl = `/stocks/${ticker}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      publishedTime: publishedDate ? new Date(publishedDate).toISOString() : undefined,
      siteName: "Reportist Research",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StockDetailPage({
  params,
  searchParams,
}: StockDetailPageProps) {
  const { ticker: rawTicker } = await params;
  const { tab, date } = await searchParams;
  const ticker = (rawTicker || "").toUpperCase();

  const validTabs: ResearchDocTab[] = ["final", "summaries", "datapack", "chart"];
  const validatedTab = validTabs.includes(tab as ResearchDocTab) ? (tab as ResearchDocTab) : undefined;

  // SSR initialReport도 public 마스킹 티저만 전달 (원문 절대 미포함).
  // 로그인 유저의 전체 열람은 클라이언트가 /api/reports/detail로 재조회합니다.
  // public 허용 필드(한글명·티커·분석일자·현재가)만 SSR SEO에 사용, verdict·적정가는 절대 미포함.
  let initialReport: GuruReportRow | null = null;
  let koName = ticker;
  let publishedDate = date || "";
  let currentPrice: number | null = null;
  const ssrSupabase = getServerSupabaseClient();
  if (ssrSupabase) {
    try {
      let row: GuruReportRow | null = null;
      if (date) {
        const { data } = await ssrSupabase
          .from("guru_reports")
          .select("*")
          .eq("id", `${date}_${ticker}`)
          .maybeSingle();
        row = (data as GuruReportRow | null) || null;
        if (!row) {
          const fallback = await ssrSupabase
            .from("guru_reports")
            .select("*")
            .eq("d", date)
            .eq("ticker", ticker)
            .limit(1)
            .maybeSingle();
          row = (fallback.data as GuruReportRow | null) || null;
        }
      } else {
        const { data } = await ssrSupabase
          .from("guru_reports")
          .select("*")
          .eq("ticker", ticker)
          .order("d", { ascending: false })
          .limit(1)
          .maybeSingle();
        row = (data as GuruReportRow | null) || null;
      }
      if (row) initialReport = maskReportRowPublic(row);
      if (initialReport) {
        koName = await resolveKoreanName(
          ssrSupabase,
          ticker,
          initialReport.company_name || ticker
        );
        if (initialReport.d) publishedDate = initialReport.d;
        if (typeof initialReport.current_price === "number") {
          currentPrice = initialReport.current_price;
        }
      } else {
        koName = await resolveKoreanName(ssrSupabase, ticker, ticker);
      }
    } catch (e) {
      console.warn("SSR fetchReport error:", e);
    }
  }

  // JSON-LD 구조화 데이터 생성 (검색엔진 SEO 표준)
  // verdict·적정가 등 민감값 미포함. 한글 종목명으로 "핀둬둬 보고서" 같은 쿼리에 매칭.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://reportist.kr",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Stocks",
            "item": "https://reportist.kr/stocks",
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": `${koName}(${ticker})`,
            "item": `https://reportist.kr/stocks/${ticker}`,
          },
        ],
      },
      {
        "@type": "Article",
        "@id": `https://reportist.kr/stocks/${ticker}#article`,
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://reportist.kr/#website",
          "name": "Reportist Research",
          "url": "https://reportist.kr",
        },
        "headline": `${koName}(${ticker}) 주식 리포트와 분석 · 적정주가 및 13인 거장 AI 가치평가 보고서`,
        "description": `${koName}(${ticker}) 주식 보고서와 분석. 내재가치와 13인 전설적 거장들의 종합 투자 표결 리포트 아카이브`,
        "inLanguage": "ko",
        "publisher": {
          "@type": "Organization",
          "@id": "https://reportist.kr/#organization",
          "name": "Reportist Research",
          "alternateName": "리포티스트",
          "url": "https://reportist.kr",
          "logo": {
            "@type": "ImageObject",
            "url": "https://reportist.kr/reportist-logo-fill-120x120.png",
            "width": 120,
            "height": 120,
          },
        },
        "isAccessibleForFree": "False",
        "hasPart": {
          "@type": "WebPageElement",
          "isAccessibleForFree": "False",
          "cssSelector": ".paywall-content",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView
          initialSection="sec-reports"
          initialTicker={ticker}
          initialReport={initialReport}
          initialTab={validatedTab}
          initialDate={date}
        />
      </Suspense>
      {/* 종목별 SSR SEO 콘텐츠: CSR 대시보드와 별개로 항상 HTML에 포함.
          public 허용 필드(한글명·티커·분석일자·현재가)만 사용, verdict·적정가는 절대 미포함. */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-16">
        <section aria-label={`${koName} 주식 리포트 안내`} className="mt-10 border-t border-[#e2e8f0] pt-8">
          <h1 className="text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl">
            {koName}({ticker}) 주식 리포트와 분석 | 리포티스트
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#475569]">
            리포티스트 {koName}({ticker}) 주식 보고서와 분석 아카이브입니다.
            워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 철학으로
            {koName} 보고서를 매일 분석하고 적정주가와 내재가치 밴드를 정리합니다.
            {publishedDate ? ` 최근 분석 기준일은 ${publishedDate}이며,` : ""}
            {currentPrice !== null
              ? ` 기준 현재가는 $${currentPrice.toLocaleString()}입니다.`
              : " 상세 적정주가와 표결 결과는 리포트 본문에서 확인하세요."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#475569]">
            {koName} 보고서, {koName} 분석, {ticker} 적정주가를 찾는다면 이
            페이지의 리포트 목록에서 일자별 {koName} 주식 리포트를 확인하세요.
            최신 보고서는 Pro 멤버십으로 열람할 수 있습니다.
          </p>
        </section>
      </main>
    </>
  );
}
