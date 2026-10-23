import { describe, it, expect } from "vitest";
import { buildStockJsonLd } from "../server/stockJsonLd";
import type { GuruReportRow } from "../../types/api";

describe("buildStockJsonLd", () => {
  const dummyReport: GuruReportRow = {
    ticker: "PDD",
    company_name: "PDD 홀딩스",
    company_name_en: "PDD Holdings Inc.",
    d: "2026-10-22",
    verdict: "매수",
    votes_buy: 12,
    votes_watch: 0,
    votes_hold: 0,
    votes_sell: 1,
    overall_score: 85.5,
    current_price: 78.72,
  };

  it("국문 모드(lang='ko')에서 한글 FAQPage 및 속성을 올바르게 생성해야 한다", () => {
    const jsonLd = buildStockJsonLd({
      displayName: "PDD 홀딩스",
      ticker: "PDD",
      canonicalPath: "/stocks/PDD",
      publishedDate: "2026-10-22",
      seoKeywords: ["PDD", "주가 전망"],
      isPublicDate: true,
      report: dummyReport,
      lang: "ko",
    });

    const graph = jsonLd["@graph"] as any[];
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    expect(faq).toBeDefined();
    expect(faq.mainEntity[0].name).toContain("주가 전망 의견은 어떤가요?");
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain("워런 버핏, 피터 린치 등");

    const dataset = graph.find((node) => node["@type"] === "Dataset");
    expect(dataset.variableMeasured).toContain("거장 종합 의견");
    const verdictProp = dataset.additionalProperty.find(
      (p: any) => p.name === "거장 종합 의견"
    );
    expect(verdictProp.value).toBe("매수");
  });

  it("영문 모드(lang='en')에서 영문 FAQPage 및 속성을 올바르게 생성해야 한다", () => {
    const jsonLd = buildStockJsonLd({
      displayName: "PDD Holdings Inc.",
      ticker: "PDD",
      canonicalPath: "/en/stocks/PDD",
      publishedDate: "2026-10-22",
      seoKeywords: ["PDD", "stock forecast"],
      isPublicDate: true,
      report: dummyReport,
      lang: "en",
    });

    const graph = jsonLd["@graph"] as any[];
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    expect(faq).toBeDefined();
    expect(faq.mainEntity[0].name).toBe(
      "What is the 13-guru consensus valuation verdict for PDD Holdings Inc. (PDD)?"
    );
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain(
      'the consensus investment verdict for PDD Holdings Inc. is "BUY"'
    );
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain(
      "Vote distribution: Buy 12, Watch 0, Sell 1 (out of 13 gurus)."
    );
    // 한국어가 없어야 함
    expect(faq.mainEntity[0].acceptedAnswer.text).not.toMatch(/[\u3131-\uD79D]/);

    const dataset = graph.find((node) => node["@type"] === "Dataset");
    expect(dataset.variableMeasured).toContain("13 Guru Consensus Verdict");
    const verdictProp = dataset.additionalProperty.find(
      (p: any) => p.name === "13 Guru Consensus Verdict"
    );
    expect(verdictProp.value).toBe("BUY");
  });
});
