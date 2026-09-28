import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeedTick 관리자 관제센터",
  description:
    "미국 주식 13인 거장 AI 스크리닝 · 소액 분할 자동매매 및 시스템 실시간 모니터링",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
