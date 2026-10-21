"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, AlertCircle, MessageSquare, Lock } from "lucide-react";
import { FeedbackCategory, FeedbackCreateInput, FeedbackItem } from "@/types/feedback";
import { createFeedback } from "@/lib/feedbackApi";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface FeedbackWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: FeedbackItem) => void;
}

const CATEGORIES: { id: FeedbackCategory; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: "feature",
    label: "기능 제안",
    desc: "신규 지표나 기능 추가 요청",
    icon: Sparkles,
  },
  {
    id: "bug",
    label: "불편한 점",
    desc: "버그 및 이용 중 오류/불편",
    icon: AlertCircle,
  },
  {
    id: "general",
    label: "기타 의견",
    desc: "서비스 개선을 위한 자유 의견",
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

    onSuccess(res.feedback);
    onClose();
    setTitle("");
    setContent("");
    setIsPrivate(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="default">
      <form onSubmit={handleSubmit} className="flex flex-col h-full font-sans">
        <Modal.Header
          title="의견 및 기능 제안 등록"
          description="리포티스트 서비스를 이용하시며 겪은 불편한 점이나 추가되었으면 하는 기능을 편하게 들려주세요."
        />

        <Modal.Body className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* 카테고리 선택 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold text-[#0f172a] uppercase tracking-wider">
              카테고리 구분
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
                    className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-[#0f172a] bg-[#0f172a] text-white shadow-xs"
                        : "border-[#cbd5e1] bg-white text-[#475569] hover:border-[#0f172a] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-1.5" />
                    <div>
                      <div className="text-xs font-bold leading-tight">{cat.label}</div>
                      <div
                        className={`text-[10px] mt-0.5 line-clamp-1 ${
                          isSelected ? "text-slate-300" : "text-[#94a3b8]"
                        }`}
                      >
                        {cat.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 제목 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="write-fb-title" className="font-mono font-semibold text-[#0f172a] uppercase tracking-wider">
                제목
              </label>
              <span className="font-mono text-[11px] text-[#94a3b8]">{title.length}/100</span>
            </div>
            <input
              id="write-fb-title"
              type="text"
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 피터 린치 PEG 기준 정렬 기능이 필요합니다"
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a] placeholder-[#94a3b8]"
            />
          </div>

          {/* 내용 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="write-fb-content" className="font-mono font-semibold text-[#0f172a] uppercase tracking-wider">
                상세 내용
              </label>
              <span className="font-mono text-[11px] text-[#94a3b8]">{content.length}/2000</span>
            </div>
            <textarea
              id="write-fb-content"
              rows={4}
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                category === "bug"
                  ? "어떤 화면에서 어떤 현상이 일어났는지 자세히 알려주시면 신속하게 조치하겠습니다."
                  : category === "feature"
                  ? "어떤 기능이 생기면 분석이나 투자에 더 도움이 될지 편하게 적어주세요."
                  : "서비스에 대한 솔직한 생각을 자유롭게 남겨주세요."
              }
              className="w-full p-3 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a] placeholder-[#94a3b8] resize-none leading-relaxed"
            />
          </div>

          {/* 작성자 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label htmlFor="write-fb-author" className="block text-xs font-mono font-semibold text-[#0f172a] uppercase tracking-wider">
                작성자 닉네임
              </label>
              <input
                id="write-fb-author"
                type="text"
                maxLength={20}
                value={authorName}
                disabled={Boolean(user)}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="예: 버핏꿈나무"
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a] placeholder-[#94a3b8] disabled:bg-[#f8fafc] disabled:text-[#64748b]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="write-fb-email" className="block text-xs font-mono font-semibold text-[#0f172a] uppercase tracking-wider">
                답변 알림 이메일 (선택)
              </label>
              <input
                id="write-fb-email"
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="답변 완료 시 안내받으실 이메일"
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a] placeholder-[#94a3b8]"
              />
            </div>
          </div>

          {/* 비공개 토글 */}
          <div className="pt-2 border-t border-[#e2e8f0]">
            <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-[#cbd5e1] text-[#0f172a] focus:ring-[#0f172a]"
              />
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Lock className="w-3 h-3 text-[#94a3b8]" />
                <span>비공개 등록 (작성자 본인 및 운영진만 열람)</span>
              </span>
            </label>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            닫기
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            제안 등록하기
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
