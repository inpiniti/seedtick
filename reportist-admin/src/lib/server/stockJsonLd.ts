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
  const title = `${displayName}(${ticker}) 주가 전망 및 적정주가 분석 · 13인 거장 AI 가치평가 보고서`;
  const description = `${displayName}(${ticker}) 주가 전망과 적정주가 분석 보고서. 13인 전설적 투자 거장들의 철학으로 산출한 향후 전망과 내재가치, 안전마진 밴드 및 종목별 가치평가 리포트 아카이브.`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
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
      ...(report != null
        ? [
            {
              "@type": "Dataset",
              "@id": `${url}#dataset`,
              name: `${displayName}(${ticker}) 13인 투자 거장 AI 가치평가 리포트 및 표결 통계`,
              description,
              inLanguage: "ko",
              license: `${SITE_URL}/terms`,
              creator: {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: "Reportist Research",
              },
              isAccessibleForFree: isPublicDate ? "True" : "False",
              temporalCoverage: publishedDate || undefined,
              variableMeasured: [
                "거장 찬성 표수",
                "거장 관망 표수",
                "거장 매도 표수",
                "거장 종합 의견",
                "가치평가 종합 점수",
              ],
              additionalProperty: [
                ...(typeof report.votes_buy === "number"
                  ? [
                      {
                        "@type": "PropertyValue",
                        name: "거장 찬성 표수",
                        value: `${report.votes_buy}명`,
                      },
                    ]
                  : []),
                ...(typeof report.votes_watch === "number" ||
                typeof report.votes_hold === "number"
                  ? [
                      {
                        "@type": "PropertyValue",
                        name: "거장 관망 표수",
                        value: `${
                          (report.votes_watch || 0) + (report.votes_hold || 0)
                        }명`,
                      },
                    ]
                  : []),
                ...(typeof report.votes_sell === "number"
                  ? [
                      {
                        "@type": "PropertyValue",
                        name: "거장 매도 표수",
                        value: `${report.votes_sell}명`,
                      },
                    ]
                  : []),
                ...(report.verdict
                  ? [
                      {
                        "@type": "PropertyValue",
                        name: "거장 종합 의견",
                        value: report.verdict,
                      },
                    ]
                  : []),
                ...(typeof report.overall_score === "number" &&
                report.overall_score > 0
                  ? [
                      {
                        "@type": "PropertyValue",
                        name: "가치평가 종합 점수",
                        value: `${report.overall_score.toFixed(1)}점`,
                      },
                    ]
                  : []),
              ],
              distribution: {
                "@type": "DataDownload",
                encodingFormat: "application/json",
                contentUrl: `${SITE_URL}/api/reports/dates-by-ticker?ticker=${encodeURIComponent(
                  ticker
                )}`,
              },
            },
            {
              "@type": "FAQPage",
              "@id": `${url}#faq`,
              mainEntity: [
                {
                  "@type": "Question",
                  name: `${displayName}(${ticker})의 13인 거장 종합 주가 전망 의견은 어떤가요?`,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: `워런 버핏, 피터 린치 등 13인의 전설적 투자 거장 AI 에이전트 분석 결과, ${displayName}의 종합 투자의견은 "${report.verdict || "분석 완료"}"입니다. 세부 표결 현황은 찬성 ${report.votes_buy ?? 0}명, 관망 ${(report.votes_watch ?? 0) + (report.votes_hold ?? 0)}명, 매도 ${report.votes_sell ?? 0}명입니다.`,
                  },
                },
                {
                  "@type": "Question",
                  name: `${displayName}(${ticker})의 적정주가 및 내재가치는 어떻게 산출되나요?`,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: `리포티스트는 DCF(현금흐름할인), NCAV, Graham Number, Lynch Fair PE 등 거장들의 고유 밸류에이션 공식을 기반으로 기업의 내재가치와 안전마진 밴드를 산출하여 향후 주가 전망을 객관적으로 제시합니다.`,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
}
