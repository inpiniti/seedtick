import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // www와 apex 중복 노출 방지: 정식 도메인 apex로 통합
        source: "/:path*",
        has: [{ type: "host", value: "www.reportist.kr" }],
        destination: "https://reportist.kr/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
