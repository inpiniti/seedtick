import type { NextConfig } from "next";

// NOTE: apex(reportist.kr) → www(reportist.kr) 308 리다이렉트는
// Vercel Dashboard(Domains) 한 곳에서만 설정한다. 양쪽 다 설정하면
// ERR_TOO_MANY_REDIRECTS 루프가 발생한다.
//
// canonical 호스트는 www다. src/lib/siteConfig.ts 의 SITE_URL 이
// metadataBase · canonical · og:url · JSON-LD · sitemap · robots 의 단일 소스다.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/feed.xml",
        destination: "/rss.xml",
      },
      {
        source: "/rss",
        destination: "/rss.xml",
      },
    ];
  },
};

export default nextConfig;
