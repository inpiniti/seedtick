import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = "https://reportist.kr";
const LOGO_URL = `${SITE_URL}/reportist-logo-fill-120x120.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "리포티스트 Reportist Research · 미국 주식 리포트와 13인 거장 AI 적정주가 분석",
    template: "%s | 리포티스트 Reportist",
  },
  description:
    "리포티스트(Reportist)는 워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 철학으로 미국 주식 리포트와 보고서를 분석하는 AI 가치평가 아카이브입니다. 종목별 적정주가, 내재가치 밴드, 실시간 스크리너 제공.",
  keywords: [
    "리포티스트",
    "Reportist",
    "미국 주식 리포트",
    "주식 보고서",
    "미국 주식 보고서",
    "적정주가",
    "내재가치",
    "가치평가",
    "워런 버핏",
    "피터 린치",
    "주식 스크리너",
  ],
  authors: [{ name: "Reportist Research", url: SITE_URL }],
  creator: "Reportist Research",
  publisher: "Reportist Research",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "리포티스트 Reportist Research",
    title: "리포티스트 Reportist Research · 미국 주식 리포트와 13인 거장 AI 적정주가 분석",
    description:
      "13인 투자 거장의 철학으로 분석한 미국 주식 리포트·보고서 아카이브. 적정주가, 내재가치 밴드, 실시간 스크리너.",
    images: [
      {
        url: "/reportist-logo-fill-120x120.png",
        width: 120,
        height: 120,
        alt: "리포티스트 Reportist 로고",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "리포티스트 Reportist Research · 미국 주식 리포트와 적정주가 분석",
    description:
      "13인 거장 AI 가치평가 리포트·보고서 아카이브. 미국 주식 적정주가와 내재가치 밴드 제공.",
    images: ["/reportist-logo-fill-120x120.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/reportist-logo-fill-120x120.png", type: "image/png", sizes: "120x120" },
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml" },
      { url: "/reportist-logo-fill-120x120.png", type: "image/png", sizes: "120x120" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

import { AppProviders } from "@/components/providers/AppProviders";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Reportist Research",
      alternateName: "리포티스트",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: LOGO_URL,
        width: 120,
        height: 120,
      },
      image: LOGO_URL,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "리포티스트 Reportist Research",
      alternateName: "리포티스트",
      inLanguage: "ko",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
    {
      "@type": "SiteNavigationElement",
      "@id": `${SITE_URL}/#navigation`,
      name: "리포티스트 주요 메뉴",
      hasPart: [
        {
          "@type": "SiteNavigationElement",
          name: "미국 주식 리포트 목록",
          url: `${SITE_URL}/stocks`,
        },
        {
          "@type": "SiteNavigationElement",
          name: "실시간 주식 스크리너",
          url: `${SITE_URL}/screener`,
        },
        {
          "@type": "SiteNavigationElement",
          name: "13인 투자 거장 철학 가이드",
          url: `${SITE_URL}/gurus`,
        },
        {
          "@type": "SiteNavigationElement",
          name: "멤버십 요금제",
          url: `${SITE_URL}/pricing`,
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[color:var(--page-background)] text-foreground selection:bg-[#2563eb]/10 selection:text-[#2563eb]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <AppProviders>{children}</AppProviders>
        {/* 사이트링크용 서버 렌더링 푸터 내비게이션 (전 페이지 크롤 가능) */}
        <footer className="border-t border-[#e2e8f0] bg-white">
          <nav
            aria-label="리포티스트 사이트 메뉴"
            className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-xs text-[#64748b]"
          >
            <span className="font-semibold text-[#0f172a]">리포티스트 Reportist</span>
            <a href="/stocks" className="hover:text-[#0f172a]">
              미국 주식 리포트 목록
            </a>
            <a href="/screener" className="hover:text-[#0f172a]">
              실시간 주식 스크리너
            </a>
            <a href="/gurus" className="hover:text-[#0f172a]">
              13인 투자 거장 철학 가이드
            </a>
            <a href="/pricing" className="hover:text-[#0f172a]">
              멤버십 요금제
            </a>
          </nav>
        </footer>
      </body>
    </html>
  );
}

