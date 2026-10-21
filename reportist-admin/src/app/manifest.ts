import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "리포티스트 Reportist Research · 국내 및 미국 주식 리포트",
    short_name: "리포티스트",
    description:
      "리포티스트(Reportist) — 13인 투자 거장 AI 가치평가 국내 및 미국 주식 리포트와 보고서 아카이브",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "ko",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/reportist-logo-fill-120x120.png",
        sizes: "120x120",
        type: "image/png",
      },
    ],
  };
}
