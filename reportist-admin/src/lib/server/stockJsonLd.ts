/**
 * 종목 상세 페이지 JSON-LD 빌더 (schema.org).
 *
 * 원칙:
 * - 민감 정보(적정가·투자의견·본문)는 절대 포함하지 않는다.
 * - 공개 열람 가능한(무료) 날짜만 isAccessibleForFree: True 로 표기한다.
 * - 유료로 잠긴 날짜는 Google 의 페이월드 콘텐츠 규약에 맞춰
 *   isAccessibleForFree "False" + hasPart.cssSelector 로 명시한다.
 */

import { absoluteUrl, SITE_URL } from "@/lib/siteConfig";
import type { GuruReportRow } from "@/types/api";

interface BuildStockJsonLdParams {
  displayName: string;
  ticker: string;
  canonicalPath: string;
  publishedDate: string;
  seoKeywords: string[];
  isPublicDate: boolean;
  report: GuruReportRow | null;
}

export function buildStockJsonLd({
  displayName,
  ticker,
  canonicalPath,
  publishedDate,
  seoKeywords,
  isPublicDate,
  report,
}: BuildStockJsonLdParams) {
  const url = absoluteUrl(canonicalPath);
  const title = `${displayName}(${ticker}) 주식 리포트와 분석 · 적정주가 및 13인 거장 AI 가치평가 보고서`;
  const description = `${displayName}(${ticker}) 주식 보고서와 분석. 13인 전설적 투자 거장들의 철학으로 산출한 내재가치와 적정주가, 종목별 가치평가 리포트 아카이브.`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Stocks",
            item: `${SITE_URL}/stocks`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${displayName}(${ticker})`,
            item: url,
          },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: "ko",
        isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${SITE_URL}/reportist-logo-fill-120x120.png`,
        },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "Reportist Research",
          url: SITE_URL,
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${url}#webpage` },
        headline: title,
        description,
        keywords: seoKeywords.join(", "),
        inLanguage: "ko",
        datePublished: publishedDate
          ? new Date(publishedDate).toISOString()
          : undefined,
        dateModified: publishedDate
          ? new Date(publishedDate).toISOString()
          : undefined,
        author: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Reportist Research",
          alternateName: "리포티스트",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/reportist-logo-fill-120x120.png`,
            width: 120,
            height: 120,
          },
        },
        publisher: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Reportist Research",
          alternateName: "리포티스트",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/reportist-logo-fill-120x120.png`,
            width: 120,
            height: 120,
          },
        },
        about: {
          "@type": "Thing",
          name: `${displayName}(${ticker}) 주식`,
          additionalType: "https://schema.org/Corporation",
          tickerSymbol: ticker,
        },
        // 공개 열람 가능 날짜는 무료 콘텐츠, 잠긴 날짜는 페이월 규약 명시
        ...(isPublicDate
          ? { isAccessibleForFree: "True" }
          : {
              isAccessibleForFree: "False",
              hasPart: {
                "@type": "WebPageElement",
                isAccessibleForFree: "False",
                cssSelector: ".paywall-content",
              },
            }),
      },
      ...(report?.current_price != null
        ? [
            {
              "@type": "Dataset",
              "@id": `${url}#dataset`,
              name: `${displayName}(${ticker}) 13인 투자 거장 AI 가치평가 리포트`,
              description,
              inLanguage: "ko",
              creator: {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: "Reportist Research",
              },
              isAccessibleForFree: isPublicDate ? "True" : "False",
              temporalCoverage: publishedDate || undefined,
              variableMeasured: [
                "투자의견 합계",
                "내재가치 적정가",
                "13인 거장별 확신도",
              ],
              distribution: {
                "@type": "DataDownload",
                encodingFormat: "application/json",
                contentUrl: `${SITE_URL}/api/reports/dates-by-ticker?ticker=${encodeURIComponent(
                  ticker
                )}`,
              },
            },
          ]
        : []),
    ],
  };
}
