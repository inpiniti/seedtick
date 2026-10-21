import { Suspense } from "react";
import type { Metadata } from "next";
import { FeedbackPageView } from "@/components/feedback/FeedbackPageView";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "의견 및 기능 제안함 · 리포티스트",
  description:
    "리포티스트를 이용하시며 겪은 불편한 점이나 추가되었으면 하는 기능을 제안해 주세요. 사용자의 소중한 의견을 서비스에 신속히 반영합니다.",
  alternates: {
    canonical: "/feedback",
  },
  openGraph: {
    title: "의견 및 기능 제안함 · 리포티스트",
    description:
      "서비스 이용 중 불편한 점이나 바라는 기능을 편하게 제안하고 투표해 주세요.",
    type: "website",
    url: `${SITE_URL}/feedback`,
  },
};

const feedbackJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/feedback#webpage`,
  url: `${SITE_URL}/feedback`,
  name: "리포티스트 의견 및 기능 제안함",
  description: "사용자 의견 수집 및 기능 제안 게시판",
  inLanguage: "ko",
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

export default function FeedbackPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(feedbackJsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-[#f7f9fc]" />}>
        <FeedbackPageView />
      </Suspense>
    </>
  );
}
