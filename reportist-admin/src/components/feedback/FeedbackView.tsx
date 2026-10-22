"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquarePlus,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  MessageSquare,
} from "lucide-react";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackWriteModal } from "./FeedbackWriteModal";
import { FeedbackAdminModal } from "./FeedbackAdminModal";
import { FeedbackCategory, FeedbackItem, FeedbackStatus } from "@/types/feedback";
import { fetchFeedbacks } from "@/lib/feedbackApi";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";

interface FeedbackViewProps {
  isAdmin?: boolean;
}

export function FeedbackView({ isAdmin = false }: FeedbackViewProps) {
  const { isEn } = useLanguage();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | "all">("all");
  const [selectedSort, setSelectedSort] = useState<"latest" | "popular">("latest");
  const [searchQuery, setSearchQuery] = useState("");

  const [counts, setCounts] = useState({
    total: 0,
    received: 0,
    reviewing: 0,
    inProgress: 0,
    completed: 0,
    feature: 0,
    bug: 0,
    general: 0,
  });

  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [adminTargetItem, setAdminTargetItem] = useState<FeedbackItem | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchFeedbacks({
      category: selectedCategory,
      status: selectedStatus,
      sort: selectedSort,
    });
    setIsLoading(false);

    if (res.success) {
      setFeedbacks(res.feedbacks);
      setCounts(res.counts);
    }
  }, [selectedCategory, selectedStatus, selectedSort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFeedbackCreated = (newItem: FeedbackItem) => {
    setFeedbacks((prev) => [newItem, ...prev]);
    setCounts((prev) => ({
      ...prev,
      total: prev.total + 1,
      received: prev.received + 1,
      [newItem.category]: (prev[newItem.category] || 0) + 1,
    }));
  };

  const handleAdminUpdate = (updated: FeedbackItem) => {
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f))
    );
  };

  const handleAdminDelete = (deletedId: string) => {
    setFeedbacks((prev) => prev.filter((f) => f.id !== deletedId));
    setCounts((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
    }));
  };

  const handleLikeUpdate = (id: string, hasLiked: boolean, nextCount: number) => {
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, hasLiked, likeCount: nextCount } : f))
    );
  };

  const filteredFeedbacks = useMemo(() => {
    if (!searchQuery.trim()) return feedbacks;
    const query = searchQuery.trim().toLowerCase();
    return feedbacks.filter(
      (f) =>
        f.title.toLowerCase().includes(query) ||
        f.content.toLowerCase().includes(query) ||
        f.authorName.toLowerCase().includes(query)
    );
  }, [feedbacks, searchQuery]);

  return (
    <div className="space-y-6 font-sans">
      {/* ── 1. 섹션 헤더 & 주요 액션 ── */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-semibold text-[#94a3b8]">06</span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              {isEn ? "Feedback & Feature Requests" : "의견 및 기능 제안함"}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
            {isEn
              ? "Share bug reports, feedback, and feature requests for Reportist Research. Upvote ideas with 'I need this too' to help us prioritize."
              : "리포티스트 리서치 서비스를 이용하시며 겪은 불편한 점(버그)이나 바라는 기능을 자유롭게 제안해 주세요. 다른 분들의 제안에 공감(나도 필요해요)을 남겨주시면 우선순위로 검토합니다."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isEn ? "Refresh" : "새로고침"}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsWriteModalOpen(true)}
            leftIcon={<MessageSquarePlus className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            {isEn ? "Submit Feedback" : "의견 남기기"}
          </Button>
        </div>
      </div>

      {/* ── 2. 핵심 지표 카드 4종 (리포티스트 OutcomesView 통일 스타일) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#64748b] text-xs font-medium">
            <span>{isEn ? "Total Ideas" : "전체 제안"}</span>
            <MessageSquare className="w-4 h-4 text-[#94a3b8]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#0f172a]">
            {counts.total}
            {!isEn && <span className="text-xs font-normal text-[#64748b] ml-1">건</span>}
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            {isEn ? "Total collected user suggestions" : "사용자 수렴 의견 총계"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-blue-700 text-xs font-medium">
            <span>{isEn ? "Feature Requests" : "기능 제안"}</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-700">
            {counts.feature}
            {!isEn && <span className="text-xs font-normal text-[#64748b] ml-1">건</span>}
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            {isEn ? "New metric & capability requests" : "새로운 지표 및 기능 요청"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 text-xs font-medium">
            <span>{isEn ? "Bug Reports" : "불편한 점"}</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600">
            {counts.bug}
            {!isEn && <span className="text-xs font-normal text-[#64748b] ml-1">건</span>}
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            {isEn ? "Errors & issues encountered" : "이용 중 발생한 오류 및 건의"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>{isEn ? "Shipped" : "반영 완료"}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600">
            {counts.completed}
            {!isEn && <span className="text-xs font-normal text-[#64748b] ml-1">건</span>}
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            {isEn ? "Implemented & released features" : "배포 및 조치 완료된 항목"}
          </p>
        </div>
      </div>

      {/* ── 3. 필터 & 검색 툴바 ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* 카테고리 탭 칩 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
              selectedCategory === "all"
                ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                : "bg-white text-[#64748b] border-[#cbd5e1] hover:text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            {isEn ? `All (${counts.total})` : `전체 (${counts.total})`}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("feature")}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              selectedCategory === "feature"
                ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                : "bg-white text-[#64748b] border-[#cbd5e1] hover:text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>{isEn ? `Feature Requests (${counts.feature})` : `기능 제안 (${counts.feature})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("bug")}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              selectedCategory === "bug"
                ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                : "bg-white text-[#64748b] border-[#cbd5e1] hover:text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            <AlertCircle className="w-3 h-3 text-rose-500" />
            <span>{isEn ? `Bug Reports (${counts.bug})` : `불편한 점 (${counts.bug})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("general")}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
              selectedCategory === "general"
                ? "bg-[#0f172a] text-white border-[#0f172a] font-medium"
                : "bg-white text-[#64748b] border-[#cbd5e1] hover:text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            {isEn ? `General (${counts.general})` : `기타 의견 (${counts.general})`}
          </button>
        </div>

        {/* 검색 및 셀렉터 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? "Search... (title, content, author)" : "검색... (제목, 내용, 작성자)"}
              className="w-full h-8 pl-8 pr-2.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a] placeholder-[#94a3b8]"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as FeedbackStatus | "all")}
            className="h-8 px-2 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md text-[#334155] focus:outline-hidden focus:border-[#0f172a] cursor-pointer"
          >
            <option value="all">{isEn ? "All Status" : "전체 상태"}</option>
            <option value="received">{isEn ? "Received" : "접수됨"}</option>
            <option value="reviewing">{isEn ? "Under Review" : "검토 중"}</option>
            <option value="in_progress">{isEn ? "In Progress" : "개발 중"}</option>
            <option value="completed">{isEn ? "Shipped" : "반영 완료"}</option>
          </select>

          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value as "latest" | "popular")}
            className="h-8 px-2 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md text-[#334155] focus:outline-hidden focus:border-[#0f172a] cursor-pointer"
          >
            <option value="latest">{isEn ? "Latest" : "최신순"}</option>
            <option value="popular">{isEn ? "Most Upvoted" : "공감순"}</option>
          </select>
        </div>
      </div>

      {/* ── 4. 피드백 목록 ── */}
      <section aria-label={isEn ? "Feedback List" : "피드백 목록"} className="space-y-3 pt-1">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-md border border-[#e2e8f0] bg-white space-y-2.5 animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <div className="w-16 h-4 rounded bg-[#f1f5f9]" />
                  <div className="w-16 h-4 rounded bg-[#f1f5f9]" />
                </div>
                <div className="w-1/2 h-4 rounded bg-[#f1f5f9]" />
                <div className="w-full h-8 rounded bg-[#f8fafc]" />
              </div>
            ))}
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <EmptyState
            icon="💡"
            title={isEn ? "No feedback submitted yet" : "등록된 의견이 없습니다"}
            description={
              isEn
                ? "Be the first to share an improvement or request a new feature for Reportist."
                : "서비스를 이용하시며 느낀 개선 사항이나 바라는 기능을 가장 먼저 제안해 보세요."
            }
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsWriteModalOpen(true)}
              >
                {isEn ? "Submit First Feedback" : "첫 번째 의견 남기기"}
              </Button>
            }
          />
        ) : (
          filteredFeedbacks.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onOpenAdminModal={(target) => setAdminTargetItem(target)}
              onLikeUpdate={handleLikeUpdate}
            />
          ))
        )}
      </section>

      {/* 작성 모달 */}
      <FeedbackWriteModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        onSuccess={handleFeedbackCreated}
      />

      {/* 관리자 모달 */}
      <FeedbackAdminModal
        item={adminTargetItem}
        isOpen={Boolean(adminTargetItem)}
        onClose={() => setAdminTargetItem(null)}
        onUpdate={handleAdminUpdate}
        onDelete={handleAdminDelete}
      />
    </div>
  );
}
