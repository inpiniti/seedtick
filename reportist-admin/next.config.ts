import type { NextConfig } from "next";

// NOTE: www↔apex 리다이렉트는 Vercel Dashboard(Domains) 한 곳에서만 설정.
// next.config과 Dashboard에 반대 방향이 동시에 있으면 ERR_TOO_MANY_REDIRECTS 루프 발생.
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
