import type { Metadata } from "next";

/**
 * 계정/결제 화면은 로그인 사용자 전용이며 색인 대상이 아니다.
 * (thin content 색인 방지 — robots.ts 에서도 /account 를 차단한다)
 */
export const metadata: Metadata = {
  title: "계정 · 멤버십 관리 | 리포티스트",
  alternates: {
    canonical: "/account",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
