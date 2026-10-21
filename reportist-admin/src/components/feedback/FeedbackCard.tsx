"use client";

import React, { useState } from "react";
import { FeedbackItem, FeedbackStatus } from "@/types/feedback";
import {
  MessageSquare,
  ThumbsUp,
  Lock,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
    badgeClass: "bg-blue-50/70 text-blue-700 border-blue-200",
  },
  bug: {
    label: "불편한 점",
    icon: AlertCircle,
    badgeClass: "bg-rose-50/70 text-rose-700 border-rose-200",
  },
  general: {
    label: "기타 의견",
    icon: MessageSquare,
    badgeClass: "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]",
  },
};

const STATUS_META: Record<
  FeedbackStatus,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  received: {
    label: "접수됨",
    badgeClass: "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]",
    icon: Clock,
  },
  reviewing: {
    label: "검토 중",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  in_progress: {
    label: "개발 중",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200 font-semibold",
    icon: Sparkles,
  },
  completed: {
    label: "반영 완료",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold",
    icon: CheckCircle2,
  },
  resolved: {
    label: "해결 완료",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold",
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

    const nextHasLiked = !hasLiked;
    const nextCount = Math.max(0, likeCount + (nextHasLiked ? 1 : -1));
    setHasLiked(nextHasLiked);
    setLikeCount(nextCount);
    onLikeUpdate?.(item.id, nextHasLiked, nextCount);

    const res = await toggleFeedbackLike(item.id);
    if (!res.success) {
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

  const isLongContent = item.content.length > 200;
  const displayedContent = isExpanded || !isLongContent
    ? item.content
    : item.content.slice(0, 200) + "...";

  return (
    <article
      className="p-4 sm:p-5 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] transition-all space-y-3"
      aria-label={item.title}
    >
      {/* 1. 상단 메타 바: 카테고리 / 상태 / 작성자 / 작성일 */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 카테고리 뱃지 */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${categoryMeta.badgeClass}`}
          >
            <CategoryIcon className="w-3 h-3" />
            <span>{categoryMeta.label}</span>
          </span>

          {/* 상태 뱃지 */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${statusMeta.badgeClass}`}
          >
            <StatusIcon className="w-3 h-3" />
            <span>{statusMeta.label}</span>
          </span>

          {item.isPrivate && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]"
              title="작성자와 관리자만 볼 수 있는 비공개 글입니다"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>비공개</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-[#94a3b8]">
          <span className="text-[#64748b] font-medium">{item.authorName}</span>
          <span>·</span>
          <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
        </div>
      </div>

      {/* 2. 제목 & 본문 */}
      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-[#0f172a] tracking-tight leading-snug">
          {item.title}
        </h3>
        <p className="text-xs sm:text-sm text-[#475569] leading-relaxed whitespace-pre-line break-words">
          {displayedContent}
        </p>
        {isLongContent && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-0.5 text-xs text-[#0f172a] font-semibold hover:underline cursor-pointer pt-0.5"
          >
            <span>{isExpanded ? "접기" : "자세히 보기"}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* 3. 관리자 공식 답변 */}
      {item.adminReply && (
        <div className="mt-2.5 p-3 sm:p-3.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-[#0f172a] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>REPORTIST RESEARCH REPLY</span>
            </span>
            {item.repliedAt && (
              <span className="text-[10px] text-[#94a3b8]">
                {formatRelativeTime(item.repliedAt)}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-[13px] text-[#334155] leading-relaxed whitespace-pre-line">
            {item.adminReply}
          </p>
        </div>
      )}

      {/* 4. 하단 액션: 공감 버튼 & 관리자 관리 버튼 */}
      <div className="pt-2 flex items-center justify-between border-t border-[#f1f5f9]">
        <button
          type="button"
          onClick={handleLike}
          disabled={isLiking}
          className={`h-7 px-2.5 rounded border text-xs font-mono font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
            hasLiked
              ? "border-blue-300 bg-blue-50 text-blue-700 shadow-2xs font-semibold"
              : "border-[#cbd5e1] bg-white text-[#475569] hover:border-[#0f172a] hover:text-[#0f172a]"
          }`}
          aria-label={`나도 필요해요 ${likeCount}명`}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? "fill-current text-blue-600" : ""}`} />
          <span>나도 필요해요</span>
          <span
            className={`font-mono text-[11px] px-1 py-0.2 rounded ${
              hasLiked ? "bg-blue-200/60 text-blue-900" : "bg-[#f1f5f9] text-[#64748b]"
            }`}
          >
            {likeCount}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onOpenAdminModal?.(item)}
            className="h-7 px-2.5 rounded border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-mono text-[#475569] hover:text-[#0f172a] transition-colors cursor-pointer"
          >
            관리자 상태/답변 수정
          </button>
        )}
      </div>
    </article>
  );
}
