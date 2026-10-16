import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "리포티스트 Reportist Research · 미국 주식 리포트와 13인 거장 AI 적정주가 분석",
  description:
    "리포티스트(Reportist)는 워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 철학으로 미국 주식 리포트와 보고서를 분석합니다. 종목별 적정주가, 내재가치 밴드, 실시간 스크리너 제공.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "리포티스트 Reportist Research · 미국 주식 리포트 아카이브",
    description:
      "13인 투자 거장이 합의한 미국 주식 리포트와 보고서, 적정주가와 내재가치 밴드, 실시간 스크리너",
    type: "website",
    siteName: "리포티스트 Reportist Research",
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://reportist.kr/#webpage",
  url: "https://reportist.kr",
  name: "리포티스트 Reportist Research · 미국 주식 리포트와 적정주가 분석",
  alternateName: "리포티스트",
  inLanguage: "ko",
  isPartOf: { "@id": "https://reportist.kr/#website" },
  about: [
    { "@type": "Thing", name: "미국 주식 리포트" },
    { "@type": "Thing", name: "주식 보고서" },
    { "@type": "Thing", name: "적정주가" },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <DashboardView initialSection="all" />
      </Suspense>
      {/* 검색엔진 크롤러용 서버 렌더링 SEO 콘텐츠 (CSR 대시보드와 별개로 항상 HTML에 포함) */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-16">
        <section aria-label="리포티스트 소개" className="mt-10 border-t border-[#e2e8f0] pt-8">
          <h1 className="text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl">
            리포티스트(Reportist) — 미국 주식 리포트와 13인 거장 AI 적정주가 아카이브
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#475569]">
            리포티스트는 워런 버핏, 찰리 멍거, 피터 린치, 벤저민 그레이엄 등 13인 투자
            거장의 원전 철학으로 미국 주식 리포트와 보고서를 매일 분석하는 AI
            가치평가 서비스입니다. 종목별 주식 보고서, 적정주가와 내재가치 밴드,
            실시간 스크리닝 결과를 하나의 문서로 제공합니다.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#475569]">
            미국 주식 보고서와 주식 리포트를 찾는다면 리포티스트 아카이브에서
            티커별 최신 보고서, 거장별 합의 적정주가, SEC 공시 기반 데이터팩을
            확인하세요.
          </p>
          <nav aria-label="주요 리포트 바로가기" className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link
              href="/stocks"
              className="rounded-md border border-[#cbd5e1] px-3 py-1.5 text-[#0f172a]"
            >
              미국 주식 리포트 목록
            </Link>
            <Link
              href="/screener"
              className="rounded-md border border-[#cbd5e1] px-3 py-1.5 text-[#0f172a]"
            >
              실시간 주식 스크리너
            </Link>
            <Link
              href="/gurus"
              className="rounded-md border border-[#cbd5e1] px-3 py-1.5 text-[#0f172a]"
            >
              13인 투자 거장 철학 가이드
            </Link>
          </nav>
        </section>
      </main>
    </>
  );
}
