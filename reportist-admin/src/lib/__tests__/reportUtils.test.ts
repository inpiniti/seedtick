import { describe, it, expect } from "vitest";
import {
  getPreviousAvailableDate,
  deduplicateReportsByLatestDate,
} from "../reportUtils";
import type { GuruReportRow } from "@/types/api";

function mockReport(
  ticker: string,
  d: string,
  overall_score = 80,
  company_name = ticker
): GuruReportRow {
  return {
    id: `${ticker}-${d}`,
    ticker,
    d,
    overall_score,
    company_name,
    current_price: 100,
    created_at: new Date().toISOString(),
  } as GuruReportRow;
}

describe("reportUtils", () => {
  describe("getPreviousAvailableDate", () => {
    const dates = ["2026-10-21", "2026-10-20", "2026-10-17", "2026-10-16"];

    it("최신 일자(2026-10-21)를 선택하면 직전 분석 일자(2026-10-20)를 반환한다", () => {
      expect(getPreviousAvailableDate("2026-10-21", dates)).toBe("2026-10-20");
    });

    it("중간 일자(2026-10-20)를 선택하면 직전 분석 일자(2026-10-17)를 반환한다", () => {
      expect(getPreviousAvailableDate("2026-10-20", dates)).toBe("2026-10-17");
    });

    it("가장 오래된 일자(2026-10-16)를 선택하면 undefined를 반환한다", () => {
      expect(getPreviousAvailableDate("2026-10-16", dates)).toBeUndefined();
    });

    it("목록에 없는 일자를 넘기면 undefined를 반환한다", () => {
      expect(getPreviousAvailableDate("2026-09-01", dates)).toBeUndefined();
    });

    it("'ALL'을 선택하면 undefined를 반환한다", () => {
      expect(getPreviousAvailableDate("ALL", dates)).toBeUndefined();
    });

    it("선택 일자가 없거나 날짜 배열이 비어있으면 undefined를 반환한다", () => {
      expect(getPreviousAvailableDate(undefined, dates)).toBeUndefined();
      expect(getPreviousAvailableDate("2026-10-21", [])).toBeUndefined();
      expect(getPreviousAvailableDate("2026-10-21", ["2026-10-21"])).toBeUndefined();
    });
  });

  describe("deduplicateReportsByLatestDate", () => {
    it("오늘자 종목과 어제자 종목이 겹칠 때 최신 일자(오늘자) 리포트를 유지한다", () => {
      const reports = [
        mockReport("AAPL", "2026-10-20", 75, "애플 어제자"),
        mockReport("AAPL", "2026-10-21", 85, "애플 오늘자"),
      ];

      const result = deduplicateReportsByLatestDate(reports);
      expect(result).toHaveLength(1);
      expect(result[0].d).toBe("2026-10-21");
      expect(result[0].overall_score).toBe(85);
      expect(result[0].company_name).toBe("애플 오늘자");
    });

    it("오늘자 미장 종목과 어제자 국장 종목이 함께 있을 때 두 종목 모두 유지된다", () => {
      const reports = [
        mockReport("NVDA", "2026-10-21", 90, "엔비디아 오늘자"),
        mockReport("005930", "2026-10-20", 82, "삼성전자 어제자"),
        mockReport("000660", "2026-10-20", 79, "SK하이닉스 어제자"),
      ];

      const result = deduplicateReportsByLatestDate(reports);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.ticker)).toEqual(["NVDA", "005930", "000660"]);
      expect(result.find((r) => r.ticker === "005930")?.d).toBe("2026-10-20");
    });

    it("오늘자 미장+국장 리포트와 어제자 미장+국장 리포트가 함께 있을 때, 중복된 모든 종목은 오늘자만 남는다", () => {
      const reports = [
        mockReport("NVDA", "2026-10-20", 88),
        mockReport("005930", "2026-10-20", 80),
        mockReport("AAPL", "2026-10-21", 85),
        mockReport("005930", "2026-10-21", 86), // 국장 오늘자 생성 완료된 케이스
      ];

      const result = deduplicateReportsByLatestDate(reports);
      expect(result).toHaveLength(3);

      const samsung = result.find((r) => r.ticker === "005930");
      expect(samsung?.d).toBe("2026-10-21");
      expect(samsung?.overall_score).toBe(86);

      const nvda = result.find((r) => r.ticker === "NVDA");
      expect(nvda?.d).toBe("2026-10-20");

      const aapl = result.find((r) => r.ticker === "AAPL");
      expect(aapl?.d).toBe("2026-10-21");
    });

    it("티커 대소문자가 달라도 동일 종목으로 인식하여 최신 일자를 보존한다", () => {
      const reports = [
        mockReport("msft", "2026-10-20", 70),
        mockReport("MSFT", "2026-10-21", 95),
      ];

      const result = deduplicateReportsByLatestDate(reports);
      expect(result).toHaveLength(1);
      expect(result[0].d).toBe("2026-10-21");
    });

    it("빈 배열이거나 단일 요소일 때 예외 없이 반환한다", () => {
      expect(deduplicateReportsByLatestDate([])).toEqual([]);
      const single = [mockReport("AAPL", "2026-10-21")];
      expect(deduplicateReportsByLatestDate(single)).toHaveLength(1);
    });
  });
});
