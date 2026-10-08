import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "https://seedtick.kr"
  ).replace(/\/$/, "");

  const fullBaseUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Yeti", // 네이버 검색 로봇
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${fullBaseUrl}/sitemap.xml`,
  };
}
