"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle, MessageSquare, Lock, Loader2 } from "lucide-react";
import { FeedbackCategory, FeedbackCreateInput, FeedbackItem } from "@/types/feedback";
import { createFeedback } from "@/lib/feedbackApi";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";

interface FeedbackWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: FeedbackItem) => void;
}

const CATEGORIES: { id: FeedbackCategory; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: "feature",
    label: "기능 제안",
    desc: "새로운 지표나 기능이 필요해요",
    icon: Sparkles,
  },
  {
    id: "bug",
    label: "불편한 점",
    desc: "버그나 이용 중 불편을 겪었어요",
    icon: AlertCircle,
  },
  {
    id: "general",
    label: "기타 의견",
    desc: "서비스 칭찬이나 자유 의견이에요",
    icon: MessageSquare,
  },
];

export function FeedbackWriteModal({
  isOpen,
  onClose,
  onSuccess,
}: FeedbackWriteModalProps) {
  const { user } = useSubscription();

  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모바일/데스크톱 ESC 키 누를 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 유저 정보가 있으면 기본 닉네임 자동 채움
  useEffect(() => {
    if (user) {
      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] ||
        "회원";
      setAuthorName(name);
      if (user.email) setAuthorEmail(user.email);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (trimmedTitle.length < 3) {
      setErrorMessage("제목을 3자 이상 입력해 주세요.");
      return;
    }
    if (trimmedContent.length < 10) {
      setErrorMessage("내용을 10자 이상 자세히 작성해 주세요.");
      return;
    }
    if (!user && !authorName.trim()) {
      setErrorMessage("닉네임을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const input: FeedbackCreateInput = {
      category,
      title: trimmedTitle,
      content: trimmedContent,
      authorName: authorName.trim() || undefined,
      authorEmail: authorEmail.trim() || undefined,
      isPrivate,
    };

    const res = await createFeedback(input);
    setIsSubmitting(false);

    if (!res.success || !res.feedback) {
      setErrorMessage(res.message);
      return;
    }

    // 성공 처리
    onSuccess(res.feedback);
    onClose();
    // 폼 초기화
    setTitle("");
    setContent("");
    setIsPrivate(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* 1. 배경 딤 (Backdrop) */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 2. 모달 컨테이너 (토스 스타일 서피스) */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#e5e8eb] flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-[#f1f5f9] flex items-center justify-between">
          <div>
            <h2 id="feedback-modal-title" className="text-lg font-bold text-[#191f28]">
              소중한 의견을 들려주세요
            </h2>
            <p className="text-xs text-[#8b95a1] mt-0.5">
              불편했던 점이나 바라는 기능을 남겨주시면 꼼꼼히 살펴볼게요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 폼 바디 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* 카테고리 선택 칩 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#191f28]">
              어떤 종류의 의견인가요?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`min-h-[64px] p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#3182f6] bg-blue-50/70 text-[#3182f6] shadow-2xs ring-2 ring-[#3182f6]/20"
                        : "border-[#e5e8eb] bg-white text-[#4e5968] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <div>
                      <div className="text-xs font-bold">{cat.label}</div>
                      <div className="text-[10px] text-[#8b95a1] leading-tight line-clamp-1">
                        {cat.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 제목 입력 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="fb-title" className="text-xs font-bold text-[#191f28]">
                제목
              </label>
              <span className="text-[11px] text-[#8b95a1]">{title.length}/100</span>
            </div>
            <input
              id="fb-title"
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="핵심 내용을 한 줄로 요약해 주세요"
              className="w-full h-12 px-4 rounded-xl border border-[#e5e8eb] bg-[#f8fafc] text-sm text-[#191f28] placeholder-[#8b95a1] focus:bg-white focus:border-[#3182f6] focus:outline-none transition-colors"
            />
          </div>

          {/* 본문 내용 입력 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="fb-content" className="text-xs font-bold text-[#191f28]">
                내용
              </label>
              <span className="text-[11px] text-[#8b95a1]">{content.length}/2000</span>
            </div>
            <textarea
              id="fb-content"
              rows={4}
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                category === "bug"
                  ? "어떤 화면에서 어떤 현상이 일어났는지 자세히 알려주시면 빠르게 고칠게요."
                  : category === "feature"
                  ? "어떤 기능이 생기면 분석이나 투자에 더 도움이 될지 편하게 적어주세요."
                  : "서비스에 대한 솔직한 생각을 자유롭게 남겨주세요."
              }
              className="w-full p-4 rounded-xl border border-[#e5e8eb] bg-[#f8fafc] text-sm text-[#191f28] placeholder-[#8b95a1] focus:bg-white focus:border-[#3182f6] focus:outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* 작성자 닉네임 및 이메일 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="fb-author" className="text-xs font-bold text-[#191f28]">
                작성자 닉네임
              </label>
              <input
                id="fb-author"
                type="text"
                value={authorName}
                maxLength={20}
                disabled={Boolean(user)}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="예: 버핏꿈나무"
                className="w-full h-11 px-3.5 rounded-xl border border-[#e5e8eb] bg-[#f8fafc] text-xs text-[#191f28] placeholder-[#8b95a1] focus:bg-white focus:border-[#3182f6] focus:outline-none disabled:opacity-70 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fb-email" className="text-xs font-bold text-[#191f28]">
                답변 알림 이메일 (선택)
              </label>
              <input
                id="fb-email"
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="답변 완료 시 알려드릴게요"
                className="w-full h-11 px-3.5 rounded-xl border border-[#e5e8eb] bg-[#f8fafc] text-xs text-[#191f28] placeholder-[#8b95a1] focus:bg-white focus:border-[#3182f6] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 비공개 여부 체크박스 */}
          <div className="pt-2 border-t border-[#f1f5f9]">
            <label className="flex items-center gap-2.5 text-xs text-[#4e5968] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#3182f6] focus:ring-[#3182f6]"
              />
              <span className="flex items-center gap-1 font-medium">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>비공개로 문의하기 (작성자와 관리자만 볼 수 있어요)</span>
              </span>
            </label>
          </div>

          {/* 하단 CTA */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-xl border border-[#e5e8eb] text-sm font-semibold text-[#4e5968] hover:bg-[#f8fafc] transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[48px] px-6 rounded-xl bg-[#3182f6] hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>등록하고 있어요...</span>
                </>
              ) : (
                <span>의견 남기기</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
