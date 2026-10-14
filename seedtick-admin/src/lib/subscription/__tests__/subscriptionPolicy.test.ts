import { describe, it, expect } from "vitest";
import {
  calculateSubscriptionExpiry,
  isReportRestricted,
  getDefaultReportDate,
  isDateWithinDays,
  isWelcomeTrialActive,
  getRemainingTrialHours,
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

    it("Free 티어 유저라도 24시간 체험 활성(isTrialActive = true)인 경우 최신 보고서도 제한되지 않는다 (false 반환)", () => {
      expect(isReportRestricted("2026-10-14", "free", FIXED_BASE_DATE, undefined, true)).toBe(false);
      expect(isReportRestricted("2026-10-01", "free", FIXED_BASE_DATE, undefined, true)).toBe(false);
    });

    it("Free 티어 유저는 30일 이전 과거 보고서는 정상 열람 가능하다 (false 반환)", () => {
      expect(isReportRestricted("2026-09-13", "free", FIXED_BASE_DATE)).toBe(false);
      expect(isReportRestricted("2026-07-20", "free", FIXED_BASE_DATE)).toBe(false);
    });

    it("30일 이내 날짜라도 allowedFreeDate로 지정된 날짜는 예외적으로 열람 허용되어야 한다", () => {
      // 2026-10-10은 4일 전이지만 fallback Free 디폴트 일자로 지정되면 false 반환
      expect(isReportRestricted("2026-10-10", "free", FIXED_BASE_DATE, "2026-10-10")).toBe(false);
    });
  });

  describe("isWelcomeTrialActive & getRemainingTrialHours", () => {
    it("가입 후 24시간 이내인 유저는 무료 체험이 활성화(true)되어야 한다", () => {
      // 3시간 전 가입
      const threeHoursAgo = new Date(FIXED_BASE_DATE.getTime() - 3 * 60 * 60 * 1000).toISOString();
      expect(isWelcomeTrialActive(threeHoursAgo, FIXED_BASE_DATE)).toBe(true);
      expect(getRemainingTrialHours(threeHoursAgo, FIXED_BASE_DATE)).toBe(21);
    });

    it("서버-클라이언트 간 시계 오차로 created_at이 현재 시각보다 10초 미래라도 24시간 체험이 활성화(true)되어야 한다", () => {
      const tenSecondsFuture = new Date(FIXED_BASE_DATE.getTime() + 10 * 1000).toISOString();
      expect(isWelcomeTrialActive(tenSecondsFuture, FIXED_BASE_DATE)).toBe(true);
      expect(getRemainingTrialHours(tenSecondsFuture, FIXED_BASE_DATE)).toBe(24);
    });

    it("가입 후 23.5시간 경과 시점에도 무료 체험이 활성화(true)되어야 한다", () => {
      const almost24HoursAgo = new Date(FIXED_BASE_DATE.getTime() - 23.5 * 60 * 60 * 1000).toISOString();
      expect(isWelcomeTrialActive(almost24HoursAgo, FIXED_BASE_DATE)).toBe(true);
      expect(getRemainingTrialHours(almost24HoursAgo, FIXED_BASE_DATE)).toBe(1);
    });

    it("가입 후 24시간이 경과한 유저는 무료 체험이 만료(false)되어야 한다", () => {
      // 25시간 전 가입
      const dayAndHourAgo = new Date(FIXED_BASE_DATE.getTime() - 25 * 60 * 60 * 1000).toISOString();
      expect(isWelcomeTrialActive(dayAndHourAgo, FIXED_BASE_DATE)).toBe(false);
      expect(getRemainingTrialHours(dayAndHourAgo, FIXED_BASE_DATE)).toBe(0);
    });

    it("가입 일시가 없거나 유효하지 않은 경우 false 및 0시간을 반환해야 한다", () => {
      expect(isWelcomeTrialActive(null, FIXED_BASE_DATE)).toBe(false);
      expect(isWelcomeTrialActive(undefined, FIXED_BASE_DATE)).toBe(false);
      expect(isWelcomeTrialActive("invalid-date", FIXED_BASE_DATE)).toBe(false);
      expect(getRemainingTrialHours(null, FIXED_BASE_DATE)).toBe(0);
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

    it("Free 유저라도 24시간 무료 체험(isTrialActive = true)인 경우 가장 최신 날짜를 디폴트로 반환해야 한다", () => {
      const defaultDate = getDefaultReportDate(dates, "free", FIXED_BASE_DATE, true);
      expect(defaultDate).toBe("2026-10-14");
    });

    it("Free 유저(체험 만료)에게는 30일 이전(과거) 보고서 중 가장 최신 날짜를 디폴트로 반환해야 한다", () => {
      const defaultDate = getDefaultReportDate(dates, "free", FIXED_BASE_DATE, false);
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
