import type { Metadata } from "next";

import { buildBreadcrumbJsonLd } from "@/lib/server/catalogJsonLd";
import { absoluteUrl, SITE_URL } from "@/lib/siteConfig";

/**
 * 멤버십 요금제 페이지 메타데이터.
 * page.tsx 가 클라이언트 컴포넌트라 metadata 를 직접 export 할 수 없어
 * 레이아웃에서 정의한다.
 */
export const metadata: Metadata = {
  title: "멤버십 요금제 · 무료와 Pro 비교 | 리포티스트",
  description:
    "리포티스트 멤버십 요금제 비교. 13인 거장 AI 가치평가 리포트, 적정주가, 데이터팩 및 차트 열람 혜택을 확인하세요.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "멤버십 요금제 안내 | 리포티스트",
    description:
      "13인 거장 AI 주식 리포트 무료 아카이브와 Pro 플랜의 혜택을 비교해보세요.",
  },
};

const pricingBreadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "리포티스트 홈", path: "/" },
  { name: "멤버십 요금제", path: "/pricing" },
]);

const pricingWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${absoluteUrl("/pricing")}#webpage`,
  url: absoluteUrl("/pricing"),
  name: "리포티스트 멤버십 요금제 안내",
  description: "13인 투자 거장 AI 주식 리서치 멤버십 플랜 및 혜택 비교",
  inLanguage: "ko",
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingBreadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingWebPageJsonLd) }}
      />
      {children}
    </>
  );
}
