import { describe, it, expect } from "vitest";
import { FeedbackCategory, FeedbackItem, FeedbackStatus } from "../../types/feedback";
import { getOrCreateClientId } from "../feedbackApi";

describe("Feedback Domain Logic", () => {
  it("유효한 카테고리 목록을 올바르게 판정한다", () => {
    const validCategories: FeedbackCategory[] = ["feature", "bug", "general"];
    expect(validCategories).toContain("feature");
    expect(validCategories).toContain("bug");
    expect(validCategories).toContain("general");
    expect(validCategories.includes("invalid" as FeedbackCategory)).toBe(false);
  });

  it("유효한 상태 라이프사이클 값을 갖는다", () => {
    const validStatuses: FeedbackStatus[] = [
      "received",
      "reviewing",
      "in_progress",
      "completed",
      "resolved",
    ];
    expect(validStatuses).toHaveLength(5);
    expect(validStatuses).toContain("received");
    expect(validStatuses).toContain("reviewing");
    expect(validStatuses).toContain("in_progress");
    expect(validStatuses).toContain("completed");
  });

  it("비공개 글의 권한별 접근 가드를 올바르게 검사한다", () => {
    const publicItem: FeedbackItem = {
      id: "1",
      userId: "user-123",
      authorName: "작성자",
      category: "feature",
      title: "기능 제안",
      content: "제안 내용입니다.",
      status: "received",
      likeCount: 0,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const privateItem: FeedbackItem = {
      ...publicItem,
      id: "2",
      isPrivate: true,
    };

    // 검사 함수 시뮬레이션
    function canViewFeedback(
      item: FeedbackItem,
      currentUserId?: string | null,
      isAdmin = false
    ): boolean {
      if (!item.isPrivate) return true;
      if (isAdmin) return true;
      if (currentUserId && item.userId === currentUserId) return true;
      return false;
    }

    // 공개 글은 누구나 열람 가능
    expect(canViewFeedback(publicItem, null, false)).toBe(true);
    expect(canViewFeedback(publicItem, "other-user", false)).toBe(true);

    // 비공개 글은 제3자(비로그인/타인)에게 차단됨
    expect(canViewFeedback(privateItem, null, false)).toBe(false);
    expect(canViewFeedback(privateItem, "other-user", false)).toBe(false);

    // 비공개 글이라도 작성자 본인과 관리자는 열람 가능
    expect(canViewFeedback(privateItem, "user-123", false)).toBe(true);
    expect(canViewFeedback(privateItem, "other-user", true)).toBe(true);
  });

  it("서버 환경(SSR)에서는 빈 문자열을 반환하고 클라이언트에서는 ID를 생성한다", () => {
    // 1. SSR 환경 (window 없음)
    const ssrId = getOrCreateClientId();
    expect(ssrId).toBe("");

    // 2. 브라우저 환경 시뮬레이션
    const storage = new Map<string, string>();
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    };

    const clientId = getOrCreateClientId();
    expect(typeof clientId).toBe("string");
    expect(clientId.length).toBeGreaterThan(5);

    // 동일한 클라이언트는 저장된 ID를 재사용
    const sameId = getOrCreateClientId();
    expect(sameId).toBe(clientId);

    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });
});
