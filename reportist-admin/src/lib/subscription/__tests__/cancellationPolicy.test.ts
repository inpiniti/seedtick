import { describe, it, expect } from "vitest";
import {
  REFUND_WINDOW_DAYS,
  decideCancellation,
  calculateProratedRefund,
  getRemainingDays,
} from "../subscriptionPolicy";

describe("구독 해지 및 일할 계산 환불 정책 (Prorated Refund Policy)", () => {
  const NOW = new Date("2026-10-14T12:00:00Z");

  describe("getRemainingDays", () => {
    it("만료일까지 남은 일수를 올림으로 반환한다", () => {
      expect(getRemainingDays("2026-10-20T12:00:00Z", NOW)).toBe(6);
      expect(getRemainingDays("2026-10-14T13:00:00Z", NOW)).toBe(1);
    });

    it("만료일이 지났거나 없으면 0을 반환한다", () => {
      expect(getRemainingDays("2026-10-13T00:00:00Z", NOW)).toBe(0);
      expect(getRemainingDays(null, NOW)).toBe(0);
      expect(getRemainingDays("invalid", NOW)).toBe(0);
    });
  });

  describe("calculateProratedRefund (일할 계산)", () => {
    it("월간 2,900원 결제 당일(1일차 사용) 해지 시 1일분 공제 후 부분 환불", () => {
      // 2026-10-14 02:00 결제, 12:00 해지 -> 경과 10시간 = 1일분 사용
      // 1일 요금: Math.ceil(2900 / 30) = 97원
      // 환불 금액: 2900 - 97 = 2803원
      const res = calculateProratedRefund({
        amount: 2900,
        planType: "monthly",
        paidAt: "2026-10-14T02:00:00Z",
        now: NOW,
      });
      expect(res.mode).toBe("refund");
      expect(res.usedDays).toBe(1);
      expect(res.usedAmount).toBe(97);
      expect(res.refundAmount).toBe(2803);
    });

    it("월간 2,900원 결제 3일차 해지 시 3일분 공제 후 부분 환불", () => {
      // 2026-10-11 12:00 결제, 2026-10-14 12:00 해지 -> 3일 사용
      // 3일 요금: Math.ceil(3 * (2900 / 30)) = Math.ceil(290) = 290원
      // 환불 금액: 2900 - 290 = 2610원
      const res = calculateProratedRefund({
        amount: 2900,
        planType: "monthly",
        paidAt: "2026-10-11T12:00:00Z",
        now: NOW,
      });
      expect(res.mode).toBe("refund");
      expect(res.usedDays).toBe(3);
      expect(res.usedAmount).toBe(290);
      expect(res.refundAmount).toBe(2610);
    });

    it("연간 29,000원 결제 5일차 해지 시 5일분 공제 후 부분 환불", () => {
      // 1일 요금: 29000 / 365 = 79.452... -> 5일 = Math.ceil(5 * 79.452) = 398원
      // 환불 금액: 29000 - 398 = 28602원
      const res = calculateProratedRefund({
        amount: 29000,
        planType: "yearly",
        paidAt: "2026-10-09T12:00:00Z",
        now: NOW,
      });
      expect(res.mode).toBe("refund");
      expect(res.usedDays).toBe(5);
      expect(res.usedAmount).toBe(398);
      expect(res.refundAmount).toBe(28602);
    });

    it("7일 초과 시에는 환불 불가(0원), 기간 만료 시 종료로 처리", () => {
      const res = calculateProratedRefund({
        amount: 2900,
        planType: "monthly",
        paidAt: "2026-10-06T12:00:00Z", // 8일 경과
        now: NOW,
      });
      expect(res.mode).toBe("end_of_period");
      expect(res.refundAmount).toBe(0);
    });
  });

  describe("decideCancellation", () => {
    it(`결제 후 ${REFUND_WINDOW_DAYS}일 이내면 일할 계산된 금액 환불 + 즉시 만료`, () => {
      const result = decideCancellation({
        paidAt: "2026-10-11T12:00:00Z",
        amount: 2900,
        planType: "monthly",
        now: NOW,
      });
      expect(result.mode).toBe("refund");
      expect(result.refundAmount).toBe(2610);
      expect(result.usedDays).toBe(3);
      expect(result.usedAmount).toBe(290);
    });

    it("정확히 7일이 초과하면 환불 불가, 기간 만료 시 종료", () => {
      const result = decideCancellation({
        paidAt: "2026-10-07T11:00:00Z", // 7일 1시간 경과
        amount: 2900,
        planType: "monthly",
        now: NOW,
      });
      expect(result).toEqual({
        mode: "end_of_period",
        refundAmount: 0,
        usedAmount: 0,
        usedDays: 0,
        totalDays: 30,
        reason: "청약철회 기간(7일) 초과로 인한 자동갱신 해지",
      });
    });

    it("이미 환불된 결제는 다시 환불하지 않는다", () => {
      const result = decideCancellation({
        paidAt: "2026-10-13T12:00:00Z",
        amount: 2900,
        planType: "monthly",
        now: NOW,
        alreadyRefunded: true,
      });
      expect(result.mode).toBe("end_of_period");
      expect(result.refundAmount).toBe(0);
    });

    it("결제 기록이 없으면 기간 만료 시 종료", () => {
      const result = decideCancellation({ paidAt: null, amount: 0, now: NOW });
      expect(result.mode).toBe("end_of_period");
      expect(result.refundAmount).toBe(0);
    });
  });
});
