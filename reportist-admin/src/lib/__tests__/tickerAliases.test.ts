import { describe, it, expect } from "vitest";
import {
  getTickerPrimaryAlias,
  getTickerAliases,
  getCompanyDisplayNameWithAlias,
  getSeoKeywordsForTicker,
  matchesTickerAlias,
} from "../tickerAliases";

describe("tickerAliases", () => {
  it("티커별 대표 별칭을 정상 반환해야 한다", () => {
    expect(getTickerPrimaryAlias("GOOGL")).toBe("구글");
    expect(getTickerPrimaryAlias("googl")).toBe("구글");
    expect(getTickerPrimaryAlias("META")).toBe("페이스북");
    expect(getTickerPrimaryAlias("UNKNOWN_TICKER")).toBeNull();
  });

  it("별칭이 포함된 표시명을 정확하게 결합해야 한다", () => {
    // 알파벳 A -> 알파벳 A (구글)
    expect(getCompanyDisplayNameWithAlias("알파벳 A", "GOOGL")).toBe(
      "알파벳 A (구글)"
    );

    // 이미 구글이 포함되어 있다면 중복 방지
    expect(getCompanyDisplayNameWithAlias("구글 A", "GOOGL")).toBe("구글 A");
    expect(getCompanyDisplayNameWithAlias("알파벳 구글", "GOOGL")).toBe(
      "알파벳 구글"
    );

    // 메타 플랫폼스 -> 메타 플랫폼스 (페이스북)
    expect(getCompanyDisplayNameWithAlias("메타 플랫폼스", "META")).toBe(
      "메타 플랫폼스 (페이스북)"
    );
  });

  it("SEO 키워드 목록에 별칭과 기본 키워드가 모두 포함되어야 한다", () => {
    const keywords = getSeoKeywordsForTicker("GOOGL", "알파벳 A");
    expect(keywords).toContain("리포티스트");
    expect(keywords).toContain("GOOGL");
    expect(keywords).toContain("알파벳 A");
    expect(keywords).toContain("구글");
    expect(keywords).toContain("Google");
    expect(keywords).toContain("워런 버핏");
  });

  it("검색 쿼리가 별칭과 정확하게 매칭되어야 한다", () => {
    expect(matchesTickerAlias("구글", "GOOGL", "알파벳 A")).toBe(true);
    expect(matchesTickerAlias("google", "GOOGL", "알파벳 A")).toBe(true);
    expect(matchesTickerAlias("페이스북", "META", "메타 플랫폼스")).toBe(true);
    expect(matchesTickerAlias("삼성전자", "GOOGL", "알파벳 A")).toBe(false);
  });
});
