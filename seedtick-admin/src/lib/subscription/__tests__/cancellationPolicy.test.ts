import { describe, it, expect } from "vitest";
import {
  REFUND_WINDOW_DAYS,
  decideCancellation,
  getRemainingDays,
} from "../subscriptionPolicy";

describe("구독 해지 정책 (Cancellation Policy)", () => {
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

  describe("decideCancellation", () => {
    it(`결제 후 ${REFUND_WINDOW_DAYS}일 이내면 전액 환불 + 즉시 만료`, () => {
      const result = decideCancellation({
        paidAt: "2026-10-10T12:00:00Z",
        amount: 2900,
        now: NOW,
      });
      expect(result).toEqual({ mode: "refund", refundAmount: 2900 });
    });

    it("정확히 7일이 지나면 환불 불가, 기간 만료 시 종료", () => {
      const result = decideCancellation({
        paidAt: "2026-10-07T12:00:00Z",
        amount: 2900,
        now: NOW,
      });
      expect(result).toEqual({ mode: "end_of_period", refundAmount: 0 });
    });

    it("이미 환불된 결제는 다시 환불하지 않는다", () => {
      const result = decideCancellation({
        paidAt: "2026-10-13T12:00:00Z",
        amount: 2900,
        now: NOW,
        alreadyRefunded: true,
      });
      expect(result.mode).toBe("end_of_period");
    });

    it("결제 기록이 없으면 기간 만료 시 종료", () => {
      const result = decideCancellation({ paidAt: null, amount: 0, now: NOW });
      expect(result).toEqual({ mode: "end_of_period", refundAmount: 0 });
    });
  });
});
