"use client";

import React, { useState } from "react";
import { FeedbackItem, FeedbackStatus } from "@/types/feedback";
import { MessageSquare, ThumbsUp, Lock, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toggleFeedbackLike } from "@/lib/feedbackApi";

interface FeedbackCardProps {
  item: FeedbackItem;
  isAdmin?: boolean;
  onOpenAdminModal?: (item: FeedbackItem) => void;
  onLikeUpdate?: (id: string, hasLiked: boolean, nextCount: number) => void;
}

const CATEGORY_META = {
  feature: {
    label: "기능 제안",
    icon: Sparkles,
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  bug: {
    label: "불편한 점",
    icon: AlertCircle,
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
  general: {
    label: "기타 의견",
    icon: MessageSquare,
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

const STATUS_META: Record<
  FeedbackStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  received: {
    label: "접수됨",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: Clock,
  },
  reviewing: {
    label: "검토하고 있어요",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: Clock,
  },
  in_progress: {
    label: "개발하고 있어요",
    bg: "bg-blue-50",
    text: "text-[#3182f6]",
    border: "border-blue-200",
    icon: Sparkles,
  },
  completed: {
    label: "반영을 마쳤어요",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  resolved: {
    label: "해결되었어요",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
};

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "방금 전";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}일 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function FeedbackCard({
  item,
  isAdmin = false,
  onOpenAdminModal,
  onLikeUpdate,
}: FeedbackCardProps) {
  const [hasLiked, setHasLiked] = useState(Boolean(item.hasLiked));
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [isLiking, setIsLiking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryMeta = CATEGORY_META[item.category] || CATEGORY_META.feature;
  const CategoryIcon = categoryMeta.icon;
  const statusMeta = STATUS_META[item.status] || STATUS_META.received;
  const StatusIcon = statusMeta.icon;

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    // 낙관적 UI 업데이트
    const nextHasLiked = !hasLiked;
    const nextCount = Math.max(0, likeCount + (nextHasLiked ? 1 : -1));
    setHasLiked(nextHasLiked);
    setLikeCount(nextCount);
    onLikeUpdate?.(item.id, nextHasLiked, nextCount);

    const res = await toggleFeedbackLike(item.id);
    if (!res.success) {
      // 롤백
      setHasLiked(hasLiked);
      setLikeCount(likeCount);
      onLikeUpdate?.(item.id, hasLiked, likeCount);
    } else {
      setHasLiked(res.hasLiked);
      setLikeCount(res.likeCount);
      onLikeUpdate?.(item.id, res.hasLiked, res.likeCount);
    }
    setIsLiking(false);
  };

  const isLongContent = item.content.length > 180;
  const displayedContent = isExpanded || !isLongContent
    ? item.content
    : item.content.slice(0, 180) + "...";

  return (
    <article
      className="p-5 sm:p-6 rounded-2xl bg-white border border-[#e5e8eb] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all space-y-4"
      aria-label={item.title}
    >
      {/* 1. 상단 뱃지 및 메타 정보 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* 카테고리 뱃지 */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryMeta.badgeBg}`}
          >
            <CategoryIcon className="w-3.5 h-3.5" />
            <span>{categoryMeta.label}</span>
          </span>

          {/* 상태 뱃지 */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{statusMeta.label}</span>
          </span>

          {item.isPrivate && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
              title="작성자와 관리자만 볼 수 있는 비공개 글이에요"
            >
              <Lock className="w-3 h-3" />
              <span>비공개</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8b95a1]">
          <span>{item.authorName}</span>
          <span>·</span>
          <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
        </div>
      </div>

      {/* 2. 제목 & 본문 */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-[#191f28] tracking-tight leading-snug">
          {item.title}
        </h3>
        <p className="mt-2 text-sm text-[#4e5968] leading-relaxed whitespace-pre-line">
          {displayedContent}
        </p>
        {isLongContent && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-1 text-xs text-[#3182f6] font-semibold hover:underline cursor-pointer"
          >
            {isExpanded ? "접기" : "더보기"}
          </button>
        )}
      </div>

      {/* 3. 관리자 공식 답변 (있을 때만 노출) */}
      {item.adminReply && (
        <div className="mt-3 p-4 rounded-xl bg-[#f7f9fc] border border-[#e5e8eb] space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#191f28]">
            <ShieldCheck className="w-4 h-4 text-[#3182f6]" />
            <span>리포티스트 팀 답변</span>
            {item.repliedAt && (
              <span className="text-[11px] text-[#8b95a1] font-normal">
                ({formatRelativeTime(item.repliedAt)})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#334155] leading-relaxed whitespace-pre-line">
            {item.adminReply}
          </p>
        </div>
      )}

      {/* 4. 하단 액션 영역: 공감 버튼 및 관리자 버튼 */}
      <div className="pt-2 flex items-center justify-between border-t border-[#f1f5f9]">
        <button
          type="button"
          onClick={handleLike}
          disabled={isLiking}
          className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            hasLiked
              ? "bg-blue-50 text-[#3182f6] border border-blue-200 shadow-2xs"
              : "bg-white text-[#4e5968] border border-[#e5e8eb] hover:bg-[#f8fafc] hover:text-[#191f28]"
          }`}
          aria-label={`나도 필요해요 ${likeCount}명`}
        >
          <ThumbsUp className={`w-4 h-4 ${hasLiked ? "fill-current text-[#3182f6]" : ""}`} />
          <span>나도 필요해요</span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded-full text-xs ${
              hasLiked ? "bg-[#3182f6] text-white" : "bg-slate-100 text-[#4e5968]"
            }`}
          >
            {likeCount}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onOpenAdminModal?.(item)}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span>상태 변경 / 답변 달기</span>
          </button>
        )}
      </div>
    </article>
  );
}
