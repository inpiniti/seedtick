import { describe, it, expect } from "vitest";
import {
  calculateSubscriptionExpiry,
  isReportRestricted,
  getDefaultReportDate,
  isDateWithinDays,
} from "../subscriptionPolicy";
import { SubscriptionTier, PlanType } from "../types";

describe("Subscription Policy & Date Guard (TDD)", () => {
  const FIXED_BASE_DATE = new Date("2026-10-14T00:00:00Z");

  describe("isDateWithinDays", () => {
    it("오늘 기준 30일 이내 날짜는 true를 반환해야 한다", () => {
      expect(isDateWithinDays("2026-10-14", 30, FIXED_BASE_DATE)).toBe(true);
      expect(isDateWithinDays("2026-10-01", 30, FIXED_BASE_DATE)).toBe(true);
      expect(isDateWithinDays("2026-09-15", 30, FIXED_BASE_DATE)).toBe(true);
    });

    it("오늘 기준 30일을 초과한 과거 날짜는 false를 반환해야 한다", () => {
      // 2026-10-14 기준 30일 전은 2026-09-14
      expect(isDateWithinDays("2026-09-13", 30, FIXED_BASE_DATE)).toBe(false);
      expect(isDateWithinDays("2026-08-01", 30, FIXED_BASE_DATE)).toBe(false);
      expect(isDateWithinDays("2025-12-31", 30, FIXED_BASE_DATE)).toBe(false);
    });
  });

  describe("isReportRestricted", () => {
    it("Pro 티어 유저는 어떤 날짜의 보고서든 제한되지 않는다 (false 반환)", () => {
      expect(isReportRestricted("2026-10-14", "pro", FIXED_BASE_DATE)).toBe(false);
      expect(isReportRestricted("2026-10-05", "pro", FIXED_BASE_DATE)).toBe(false);
      expect(isReportRestricted("2026-08-01", "pro", FIXED_BASE_DATE)).toBe(false);
    });

    it("Free 티어 유저는 최근 30일 이내 보고서 열람이 제한된다 (true 반환)", () => {
      expect(isReportRestricted("2026-10-14", "free", FIXED_BASE_DATE)).toBe(true);
      expect(isReportRestricted("2026-10-01", "free", FIXED_BASE_DATE)).toBe(true);
    });

    it("Free 티어 유저는 30일 이전 과거 보고서는 정상 열람 가능하다 (false 반환)", () => {
      expect(isReportRestricted("2026-09-13", "free", FIXED_BASE_DATE)).toBe(false);
      expect(isReportRestricted("2026-07-20", "free", FIXED_BASE_DATE)).toBe(false);
    });
  });

  describe("getDefaultReportDate", () => {
    const dates = [
      "2026-10-14", // 최신 (오늘)
      "2026-10-08", // 6일 전
      "2026-09-20", // 24일 전
      "2026-09-10", // 34일 전 (30일 이전 중 가장 최신)
      "2026-09-01", // 43일 전
      "2026-08-15", // 60일 전
    ];

    it("Pro 유저에게는 목록의 가장 최신 날짜(첫 번째 요소)를 디폴트로 반환해야 한다", () => {
      const defaultDate = getDefaultReportDate(dates, "pro", FIXED_BASE_DATE);
      expect(defaultDate).toBe("2026-10-14");
    });

    it("Free 유저에게는 30일 이전(과거) 보고서 중 가장 최신 날짜를 디폴트로 반환해야 한다", () => {
      const defaultDate = getDefaultReportDate(dates, "free", FIXED_BASE_DATE);
      expect(defaultDate).toBe("2026-09-10");
    });

    it("30일 이전 날짜가 전혀 없는 경우에도 안전하게 첫 번째 날짜 또는 fallback을 반환해야 한다", () => {
      const recentOnly = ["2026-10-14", "2026-10-10"];
      const defaultDate = getDefaultReportDate(recentOnly, "free", FIXED_BASE_DATE);
      expect(defaultDate).toBe("2026-10-10"); // 가장 오래된 날짜 반환
    });

    it("빈 배열인 경우 빈 문자열을 반환해야 한다", () => {
      expect(getDefaultReportDate([], "free", FIXED_BASE_DATE)).toBe("");
    });
  });

  describe("calculateSubscriptionExpiry", () => {
    it("신규 월간 결제 시 기준일로부터 1개월 뒤를 만료일로 설정해야 한다", () => {
      const expiry = calculateSubscriptionExpiry(null, "monthly", FIXED_BASE_DATE);
      expect(expiry.toISOString().slice(0, 10)).toBe("2026-11-14");
    });

    it("신규 연간 결제 시 기준일로부터 1년 뒤를 만료일로 설정해야 한다", () => {
      const expiry = calculateSubscriptionExpiry(null, "yearly", FIXED_BASE_DATE);
      expect(expiry.toISOString().slice(0, 10)).toBe("2027-10-14");
    });

    it("기존 Pro 유효기간이 남아있는 경우 기존 만료일에 1개월이 누적 연장되어야 한다", () => {
      const activeEnd = new Date("2026-10-25T00:00:00Z"); // 11일 후 만료 예정
      const expiry = calculateSubscriptionExpiry(activeEnd, "monthly", FIXED_BASE_DATE);
      expect(expiry.toISOString().slice(0, 10)).toBe("2026-11-25");
    });

    it("기존 Pro 유효기간이 이미 지난 경우(과거) 결제 시점(기준일)부터 1개월이 연장되어야 한다", () => {
      const expiredPast = new Date("2026-09-01T00:00:00Z"); // 과거 만료
      const expiry = calculateSubscriptionExpiry(expiredPast, "monthly", FIXED_BASE_DATE);
      expect(expiry.toISOString().slice(0, 10)).toBe("2026-11-14");
    });
  });
});
