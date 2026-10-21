import { supabase } from "./supabase";
import {
  FeedbackAdminUpdateInput,
  FeedbackCategory,
  FeedbackCreateInput,
  FeedbackItem,
  FeedbackListResponse,
  FeedbackStatus,
} from "../types/feedback";

/**
 * 브라우저 방문자 식별용 클라이언트 ID (게스트 공감 중복 방지용)
 */
export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "reportist_client_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "c_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "c_fallback_" + Date.now();
  }
}

/**
 * Supabase Auth 세션 Bearer 토큰 헤더 반환
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * 피드백 목록 및 집계 조회
 */
export async function fetchFeedbacks(options?: {
  category?: FeedbackCategory | "all";
  status?: FeedbackStatus | "all";
  sort?: "latest" | "popular";
  limit?: number;
}): Promise<FeedbackListResponse> {
  try {
    const params = new URLSearchParams();
    if (options?.category && options.category !== "all") {
      params.set("category", options.category);
    }
    if (options?.status && options.status !== "all") {
      params.set("status", options.status);
    }
    if (options?.sort) {
      params.set("sort", options.sort);
    }
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const clientId = getOrCreateClientId();
    if (clientId) {
      params.set("clientId", clientId);
    }

    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/feedback?${params.toString()}`, {
      headers: { ...authHeaders },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        feedbacks: [],
        total: 0,
        counts: {
          total: 0,
          received: 0,
          reviewing: 0,
          inProgress: 0,
          completed: 0,
          feature: 0,
          bug: 0,
          general: 0,
        },
        message: json?.message || "피드백 목록을 가져오지 못했어요.",
      };
    }

    return json as FeedbackListResponse;
  } catch (err) {
    return {
      success: false,
      feedbacks: [],
      total: 0,
      counts: {
        total: 0,
        received: 0,
        reviewing: 0,
        inProgress: 0,
        completed: 0,
        feature: 0,
        bug: 0,
        general: 0,
      },
      message: err instanceof Error ? err.message : "네트워크 연결을 확인해 주세요.",
    };
  }
}

/**
 * 새로운 피드백 등록
 */
export async function createFeedback(
  input: FeedbackCreateInput
): Promise<{ success: boolean; feedback?: FeedbackItem; message: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const clientId = getOrCreateClientId();

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        ...input,
        clientId,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        message: json?.message || "피드백 등록에 실패했어요.",
      };
    }

    return {
      success: true,
      feedback: json.feedback as FeedbackItem,
      message: json.message || "소중한 의견을 등록했어요!",
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "잠시 연결이 어려워요. 다시 시도해 주세요.",
    };
  }
}

/**
 * 공감(Upvote) 토글
 */
export async function toggleFeedbackLike(
  feedbackId: string
): Promise<{ success: boolean; hasLiked: boolean; likeCount: number; message: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const clientId = getOrCreateClientId();

    const res = await fetch(`/api/feedback/${feedbackId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ clientId }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        hasLiked: false,
        likeCount: 0,
        message: json?.message || "공감 처리에 실패했어요.",
      };
    }

    return {
      success: true,
      hasLiked: Boolean(json.hasLiked),
      likeCount: Number(json.likeCount),
      message: json.message || "공감했어요!",
    };
  } catch (err) {
    return {
      success: false,
      hasLiked: false,
      likeCount: 0,
      message: err instanceof Error ? err.message : "잠시 연결이 어려워요.",
    };
  }
}

/**
 * 관리자: 상태 및 공식 답변 업데이트
 */
export async function updateFeedbackAdmin(
  feedbackId: string,
  input: FeedbackAdminUpdateInput
): Promise<{ success: boolean; message: string; feedback?: FeedbackItem }> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/feedback/${feedbackId}/admin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(input),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        message: json?.message || "관리자 업데이트 실패",
      };
    }

    return {
      success: true,
      message: json.message || "성공적으로 반영했어요.",
      feedback: json.feedback as FeedbackItem,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.",
    };
  }
}

/**
 * 관리자: 피드백 삭제
 */
export async function deleteFeedbackAdmin(
  feedbackId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/feedback/${feedbackId}/admin`, {
      method: "DELETE",
      headers: {
        ...authHeaders,
      },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        message: json?.message || "삭제 실패",
      };
    }

    return {
      success: true,
      message: json.message || "삭제했어요.",
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.",
    };
  }
}
