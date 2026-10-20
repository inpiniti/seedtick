/**
 * 카탈로그/목록 페이지 JSON-LD 빌더 (schema.org).
 * - ItemList 로 종목/거장 목록을 구조화해 검색엔진에 색인 힌트를 준다.
 */

import { absoluteUrl, SITE_URL } from "@/lib/siteConfig";
import { GURU_PERSONAS } from "@/lib/guruPersonas";
import type { TickerDirectoryEntry } from "@/lib/server/publicCatalog";

/** 종목 목록 ItemList */
export function buildTickerListJsonLd(
  directory: TickerDirectoryEntry[],
  path = "/stocks"
): object | null {
  if (!directory || directory.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(path)}#itemlist`,
    name: "국내·미국 주식 리포트 종목 목록",
    description:
      "13인 투자 거장의 철학으로 분석한 국내·미국 전 종목의 AI 가치평가 리포트와 적정주가 아카이브",
    numberOfItems: directory.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: directory.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${entry.ticker}${entry.name ? ` ${entry.name}` : ""} 주식 리포트`,
      url: absoluteUrl(`/stocks/${encodeURIComponent(entry.ticker)}`),
    })),
  };
}

/** 13인 투자 거장 목록 ItemList */
export function buildGuruListJsonLd(): object | null {
  const gurus = Object.values(GURU_PERSONAS);
  if (gurus.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl("/gurus")}#itemlist`,
    name: "13인 투자 거장 철학 가이드",
    description:
      "워런 버핏, 피터 린치, 벤저민 그레이엄 등 13인 투자 거장의 심사 철학과 핵심 정량 평가 지표",
    numberOfItems: gurus.length,
    itemListElement: gurus.map((guru, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${guru.name} (${guru.englishName}) 투자 철학과 핵심 평가 지표`,
      url: absoluteUrl(`/gurus/${encodeURIComponent(guru.slug)}`),
    })),
  };
}

/** 웹사이트 검색 엔진용 WebSite + Organization 통합 JSON-LD (이미 layout 에서 제공) */
export const SITE_JSON_LD_ID = `${SITE_URL}/#website`;
