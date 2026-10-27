import { SITE_URL, absoluteUrl } from "@/lib/siteConfig";
import type { MarketBriefing } from "@/types/api";

/**
 * 데일리 마켓 브리핑 기사용 NewsArticle JSON-LD 스키마 빌더 (구글 뉴스/검색 색인용)
 */
export function buildBriefingArticleJsonLd(
  briefing: MarketBriefing,
  isEn = false
) {
  const pagePath = isEn ? `/en/briefings/${briefing.d}` : `/briefings/${briefing.d}`;
  const canonicalUrl = absoluteUrl(pagePath);
  const headline = briefing.title
    .replace(/^#\s*/, "")
    .replace(/^\[데일리 마켓 브리핑\]\s*[\d-]*\s*/, "")
    .trim();

  const description =
    Array.isArray(briefing.summary_3lines) && briefing.summary_3lines.length > 0
      ? briefing.summary_3lines.join(" ")
      : `${briefing.d} 리포티스트 일일 AI 마켓 브리핑`;

  const datePublished = `${briefing.d}T00:05:00+09:00`;
  const dateModified = briefing.updated_at || datePublished;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${canonicalUrl}#article`,
    isPartOf: {
      "@type": "WebSite",
      name: "Reportist",
      url: SITE_URL,
    },
    headline,
    description,
    datePublished,
    dateModified,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    url: canonicalUrl,
    inLanguage: isEn ? "en" : "ko",
    articleSection: "Finance & Market Research",
    author: {
      "@type": "Organization",
      name: "Reportist AI Research",
      url: SITE_URL,
      logo: `${SITE_URL}/reportist-logo-fill-120x120.png`,
    },
    publisher: {
      "@type": "Organization",
      name: "Reportist",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/reportist-logo-fill-120x120.png`,
        width: 120,
        height: 120,
      },
    },
    keywords: [
      ...(briefing.keywords || []),
      ...(briefing.tickers ? briefing.tickers.map((t) => `$${t}`) : []),
      "데일리 마켓 브리핑",
      "주식 시장 브리핑",
    ],
    about: (briefing.tickers || []).map((ticker) => ({
      "@type": "Thing",
      name: ticker,
      identifier: ticker,
      url: absoluteUrl(isEn ? `/en/stocks/${ticker}` : `/stocks/${ticker}`),
    })),
  };
}

/**
 * 데일리 마켓 브리핑 BreadcrumbList JSON-LD 스키마 빌더
 */
export function buildBriefingBreadcrumbJsonLd(date?: string, isEn = false) {
  const homePath = isEn ? "/en" : "/";
  const homeName = isEn ? "Reportist Home" : "리포티스트 홈";
  const briefingsPath = isEn ? "/en/briefings" : "/briefings";
  const briefingsName = isEn ? "Daily Market Briefing" : "데일리 마켓 브리핑";

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: homeName,
      item: absoluteUrl(homePath),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: briefingsName,
      item: absoluteUrl(briefingsPath),
    },
  ];

  if (date) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: `${date} ${briefingsName}`,
      item: absoluteUrl(`${briefingsPath}/${date}`),
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/**
 * 데일리 마켓 브리핑 허브 목록용 ItemList JSON-LD 스키마 빌더 (구글 사이트링크 & 컬렉션 색인용)
 */
export function buildBriefingListJsonLd(
  dates: string[],
  isEn = false
) {
  const briefingsPath = isEn ? "/en/briefings" : "/briefings";
  const canonicalUrl = absoluteUrl(briefingsPath);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#collection`,
    name: isEn ? "Daily Market Briefings Archive" : "데일리 마켓 브리핑 아카이브",
    url: canonicalUrl,
    description: isEn
      ? "Daily AI market briefings synthesized from Reddit and 24-hour financial news."
      : "글로벌 레딧과 국내 주식 커뮤니티, 24시간 주요 뉴스를 종합한 일일 AI 마켓 브리핑 아카이브.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: dates.length,
      itemListElement: dates.slice(0, 30).map((d, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${d} 데일리 마켓 브리핑`,
        url: absoluteUrl(`${briefingsPath}/${d}`),
      })),
    },
  };
}
