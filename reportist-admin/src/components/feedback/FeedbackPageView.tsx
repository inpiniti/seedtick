"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquarePlus,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Filter,
  Search,
  RefreshCw,
} from "lucide-react";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackWriteModal } from "./FeedbackWriteModal";
import { FeedbackAdminModal } from "./FeedbackAdminModal";
import { FeedbackCategory, FeedbackItem, FeedbackStatus } from "@/types/feedback";
import { fetchFeedbacks } from "@/lib/feedbackApi";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { EmptyState } from "@/components/ui/EmptyState";

export function FeedbackPageView() {
  const { isAdmin } = useSubscription();

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

  // 클라이언트 검색어 필터링
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
    <div className="min-h-screen bg-[#f7f9fc] text-[#191f28] font-sans pb-24">
      {/* 1. 상단 미니멀 네비게이션 헤더 */}
      <header className="bg-white border-b border-[#e5e8eb] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4e5968] hover:text-[#191f28] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>REPORTIST 리서치 홈으로</span>
          </Link>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e8eb] bg-white text-xs font-semibold text-[#4e5968] hover:bg-[#f8fafc] transition-colors cursor-pointer disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 space-y-8">
        {/* 2. 타이틀 & 소개 섹션 */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#3182f6] border border-blue-200 text-xs font-bold">
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>의견 및 기능 제안함</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#191f28] tracking-tight">
            여러분의 목소리로 리포티스트를 완성해요
          </h1>
          <p className="text-sm sm:text-base text-[#4e5968] leading-relaxed max-w-2xl">
            서비스 이용 중 불편했던 점이나 새롭게 있었으면 하는 기능을 편하게 제안해 주세요.
            다른 분들의 제안에 공감(나도 필요해요)을 남겨주시면 우선순위로 검토할게요.
          </p>
        </div>

        {/* 3. 통계 요약 카드 4종 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e8eb] shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8b95a1]">
              <MessageSquarePlus className="w-4 h-4 text-slate-500" />
              <span>전체 제안</span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#191f28] font-mono">
              {counts.total}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e8eb] shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <Sparkles className="w-4 h-4 text-[#3182f6]" />
              <span>기능 제안</span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#3182f6] font-mono">
              {counts.feature}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e8eb] shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span>불편한 점</span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono">
              {counts.bug}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e8eb] shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>반영 완료</span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">
              {counts.completed}
            </div>
          </div>
        </div>

        {/* 4. 컨트롤 바: 카테고리 칩 + 검색창 + 정렬 셀렉터 + 작성 버튼 */}
        <div className="space-y-4">
          {/* 카테고리 탭 칩 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`min-h-[44px] px-4 rounded-full text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-[#191f28] text-white shadow-xs"
                  : "bg-white text-[#4e5968] border border-[#e5e8eb] hover:bg-[#f8fafc]"
              }`}
            >
              전체 ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("feature")}
              className={`min-h-[44px] px-4 rounded-full text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "feature"
                  ? "bg-[#3182f6] text-white shadow-xs"
                  : "bg-white text-[#4e5968] border border-[#e5e8eb] hover:bg-[#f8fafc]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>기능 제안 ({counts.feature})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("bug")}
              className={`min-h-[44px] px-4 rounded-full text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "bug"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-white text-[#4e5968] border border-[#e5e8eb] hover:bg-[#f8fafc]"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>불편한 점 ({counts.bug})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("general")}
              className={`min-h-[44px] px-4 rounded-full text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === "general"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "bg-white text-[#4e5968] border border-[#e5e8eb] hover:bg-[#f8fafc]"
              }`}
            >
              기타 의견 ({counts.general})
            </button>
          </div>

          {/* 서브 필터 및 액션 라인 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8b95a1] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목이나 작성자로 검색해 보세요"
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e8eb] bg-white text-xs text-[#191f28] placeholder-[#8b95a1] focus:border-[#3182f6] focus:outline-none"
                />
              </div>

              {/* 상태 필터 셀렉터 */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as FeedbackStatus | "all")}
                className="h-11 px-3 rounded-xl border border-[#e5e8eb] bg-white text-xs font-semibold text-[#4e5968] focus:border-[#3182f6] focus:outline-none cursor-pointer"
              >
                <option value="all">전체 상태</option>
                <option value="received">접수됨</option>
                <option value="reviewing">검토하고 있어요</option>
                <option value="in_progress">개발하고 있어요</option>
                <option value="completed">반영을 마쳤어요</option>
              </select>

              {/* 정렬 셀렉터 */}
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value as "latest" | "popular")}
                className="h-11 px-3 rounded-xl border border-[#e5e8eb] bg-white text-xs font-semibold text-[#4e5968] focus:border-[#3182f6] focus:outline-none cursor-pointer"
              >
                <option value="latest">최신순</option>
                <option value="popular">공감 많은 순</option>
              </select>
            </div>

            {/* 메인 작성 버튼 */}
            <button
              type="button"
              onClick={() => setIsWriteModalOpen(true)}
              className="min-h-[44px] px-5 rounded-xl bg-[#3182f6] hover:bg-blue-600 active:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>의견 남기기</span>
            </button>
          </div>
        </div>

        {/* 5. 피드백 리스트 영역 */}
        <section aria-label="피드백 목록" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white border border-[#e5e8eb] space-y-3 animate-pulse"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-5 rounded-full bg-slate-100" />
                    <div className="w-20 h-5 rounded-full bg-slate-100" />
                  </div>
                  <div className="w-2/3 h-5 rounded bg-slate-100" />
                  <div className="w-full h-12 rounded bg-slate-50" />
                </div>
              ))}
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <EmptyState
              icon="💡"
              title="아직 등록된 의견이 없어요"
              description="서비스를 이용하며 겪은 불편한 점이나 바라시는 기능을 가장 먼저 남겨보세요."
              action={
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(true)}
                  className="min-h-[44px] px-5 rounded-xl bg-[#3182f6] text-white text-xs sm:text-sm font-bold hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  첫 번째 의견 남기기
                </button>
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
      </main>

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
