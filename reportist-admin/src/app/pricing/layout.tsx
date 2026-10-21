import type { Metadata } from "next";

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

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
