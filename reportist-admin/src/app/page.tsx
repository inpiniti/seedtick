import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getPublicCatalog } from "@/lib/server/publicCatalog";
import { buildTickerListJsonLd } from "@/lib/server/catalogJsonLd";

import { SITE_URL } from "@/lib/siteConfig";

/**
 * 공개 카탈로그는 5분 주기로 갱신한다.
 * (리포트는 하루 1회 발행되므로 5분이면 충분하고, 정적 셸 + ISR 로 TTFB 를 낮춘다)
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "리포티스트 · 13인 투자 거장 AI 적정주가 및 국내·미국 주식 리포트 | Reportist Research",
  description:
    "감정에 휘둘리는 투자를 끝내세요. 리포티스트(Reportist Research)는 워런 버핏, 벤저민 그레이엄, 피터 린치 등 13인 거장의 밸류에이션 모델로 국내 및 미국 주식의 적정주가(Fair Value)와 안전마진 밴드를 매일 분석합니다.",
  keywords: [
    "리포티스트",
    "Reportist",
    "Reportist stock",
    "Reportist fair value",
    "Reportist research",
    "적정주가",
    "내재가치",
    "13인 투자 거장",
    "국내 주식 리포트",
    "미국 주식 리포트",
    "주식 스크리너",
  ],
  alternates: {
    canonical: "/",
    languages: {
      ko: "/",
      en: "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title: "리포티스트(Reportist Research) · 13인 투자 거장 AI 주식 리서치 플랫폼",
    description:
      "왜 이걸 사야 할까? 13인 투자 거장이 합의한 적정주가, 5단계 우량주 스크리너, 100% 공개된 산출식과 투명한 성과 추적.",
    type: "website",
    siteName: "리포티스트",
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: "리포티스트 · 13인 투자 거장 AI 적정주가 및 국내·미국 주식 리포트",
      alternateName: [
        "Reportist",
        "Reportist Research",
        "Reportist Stock",
        "Reportist Fair Value",
      ],
      description:
        "워런 버핏, 벤저민 그레이엄, 피터 린치 등 13인 투자 거장의 원전 철학과 퀀트 알고리즘으로 국내 및 미국 주식의 적정주가와 안전마진을 매일 분석하는 독립 주식 리서치 시스템",
      inLanguage: "ko",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: [
        { "@type": "Thing", name: "적정주가" },
        { "@type": "Thing", name: "내재가치 밸류에이션" },
        { "@type": "Thing", name: "안전마진" },
        { "@type": "Thing", name: "국내 주식 리포트" },
        { "@type": "Thing", name: "미국 주식 리포트" },
        { "@type": "Thing", name: "13인 투자 거장" },
        { "@type": "Thing", name: "주식 스크리너" },
        { "@type": "Thing", name: "Reportist Stock Research" },
        { "@type": "Thing", name: "Stock Fair Value Valuation" },
      ],
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": `${SITE_URL}/#application`,
      name: "Reportist",
      alternateName: [
        "리포티스트",
        "Reportist Research",
        "Reportist Stock Screener",
        "Reportist Fair Value Calculator",
      ],
      applicationCategory: "FinanceApplication",
      applicationSubCategory: "Stock Valuation & Investment Research",
      operatingSystem: "Web",
      url: SITE_URL,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KRW",
      },
      description:
        "13인 투자 거장(워런 버핏, 벤저민 그레이엄, 피터 린치 등)의 철학을 기반으로 국내 및 미국 주식의 적정주가(Fair Value)를 자동 분석하고 매일 리포트를 발행하는 AI 가치투자 리서치 소프트웨어(SoftwareApplication).",
      featureList: [
        "13인 투자 거장(워런 버핏, 벤저민 그레이엄, 피터 린치 등) 퀀트 가치평가 및 적정주가(Fair Value) 자동 산출",
        "국내 및 미국 주식 일일 자동 리서치 리포트 발행",
        "5단계 재무 건전성 퀀트 스크리너",
        "100% 투명한 가치평가 산출식 및 사후 성과(Track Record) 공시",
      ],
      sameAs: [
        "https://twitter.com/reportist_app",
        "https://www.producthunt.com/products/reportist",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "리포티스트는 어떤 서비스인가요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "리포티스트(Reportist)는 워런 버핏, 벤저민 그레이엄, 피터 린치, 아스워스 다모다란 등 100년간 검증된 13인 투자 거장의 고유한 밸류에이션 철학을 퀀트 알고리즘과 AI로 구현하여, 국내 및 미국 주식의 적정 내재가치와 안전마진 매수가를 매일 분석해 제공하는 독립 주식 리서치 시스템입니다.",
          },
        },
        {
          "@type": "Question",
          name: "왜 리포티스트를 만들었나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "증권사 리포트의 90% 이상이 '매수' 일색이고 목표주가의 근거가 불투명하며, 개인 투자자들은 감정적인 뇌동매매와 고점 매수로 큰 손실을 입기 쉽습니다. 복잡한 재무제표와 DCF 계산을 개인이 일일이 분석하기 어렵기 때문에, 이해관계 없이 객관적인 13인 투자 거장의 시선으로 정직한 적정주가와 안전마진을 계산해 주고자 개발되었습니다.",
          },
        },
        {
          "@type": "Question",
          name: "종목 선정은 어떤 기준으로 이루어지나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "테마주, 작전주, 부실 적자기업은 100% 필터링됩니다. 미국 주식은 S&P500 우량주와 월가 슈퍼인베스터 10인 이상이 동시 보유한 DataRoma 그랜드 포트폴리오를 기반으로 선정합니다. 한국 주식은 코스피·코스닥 전 종목 중 시가총액 5,000억 원 이상, 부채비율 80% 이하, 이자보상배율 5배 이상, 영업이익률 15% 이상, ROE 15% 이상의 5단계를 통과한 핵심 알짜 기업만 엄격히 선별합니다.",
          },
        },
        {
          "@type": "Question",
          name: "리포티스트의 분석 결과를 신뢰할 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "리포티스트는 블랙박스 AI가 아닙니다. 13인 거장별 세부 체크리스트, 재무 지표, 가치평가 모델(DCF, NCAV, Graham Number, Lynch Fair PE 등)의 계산 수식과 판단 근거를 100% 투명하게 공개합니다. 또한 거장 간 표결 합의율과 의견 분산도를 제공하며, 과거 분석 리포트의 실제 주가 성과와 거장 적중률(Track Record)을 숨김없이 실시간으로 추적·공시합니다.",
          },
        },
        {
          "@type": "Question",
          name: "어떠한 기술로 동작하나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Python 기반의 금융 분석 엔진(reportist-analyzer)이 Yahoo Finance, SEC 공시(10-K, 10-Q), DART 전자공시에서 팩트 데이터를 수집하고 13인 밸류에이션 모델을 연산합니다. AI 게이트웨이(reportist-ai-gateway)가 멀티 LLM 로테이션을 통해 거장별 심층 리포트를 병렬 생성하며, Next.js 15와 Supabase로 구성된 고성능 웹 아키텍처를 통해 매일 정규장 마감 후 최신 리포트를 실시간 배포합니다.",
          },
        },
      ],
    },
  ],
};

export default async function HomePage() {
  // 서버에서 공개 카탈로그를 프리페치해 초기 HTML에 종목 목록·링크를 포함시킨다.
  // (클라 fetch 전용이면 봇이 빈 페이지를 색인하게 된다)
  const catalog = await getPublicCatalog();
  const itemListJsonLd = buildTickerListJsonLd(catalog.directory, "/");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
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
        />
      </Suspense>
    </>
  );
}

