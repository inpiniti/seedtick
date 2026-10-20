import type { Metadata } from "next";

/**
 * 멤버십 요금제 페이지 메타데이터.
 * page.tsx 가 클라이언트 컴포넌트라 metadata 를 직접 export 할 수 없어
 * 레이아웃에서 정의한다.
 */
export const metadata: Metadata = {
  title: "멤버십 요금제 · 무료 아카이브와 Pro 플랜 비교 | Reportist",
  description:
    "리포티스트 무료 아카이브와 Pro 멤버십 요금제 비교. 13인 투자 거장 AI 가치평가 리포트, 적정주가, SEC 데이터팩, 일봉·밴드 차트를 확인하세요.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "리포티스트 멤버십 요금제 | Reportist",
    description:
      "13인 투자 거장 AI 가치평가 리포트를 무료 아카이브로 확인하거나 Pro로 전체를 열람하세요.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
