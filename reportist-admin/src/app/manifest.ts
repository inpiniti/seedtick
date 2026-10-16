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
        src: "/reportist-logo-fill-120x120.png",
        sizes: "120x120",
        type: "image/png",
      },
      {
        src: "/reportist-logo-circle-120x120.png",
        sizes: "120x120",
        type: "image/png",
      },
      {
        src: "/reportist-logo-120x120.png",
        sizes: "120x120",
        type: "image/png",
      },
    ],
  };
}
