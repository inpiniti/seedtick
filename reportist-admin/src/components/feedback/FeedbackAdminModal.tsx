"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { FeedbackItem, FeedbackStatus } from "@/types/feedback";
import { updateFeedbackAdmin, deleteFeedbackAdmin } from "@/lib/feedbackApi";

interface FeedbackAdminModalProps {
  item: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: FeedbackItem) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { id: FeedbackStatus; label: string; desc: string }[] = [
  { id: "received", label: "접수됨", desc: "검토 전 확인 단계" },
  { id: "reviewing", label: "검토하고 있어요", desc: "개발 및 기획팀 검토 중" },
  { id: "in_progress", label: "개발하고 있어요", desc: "기능 개발 및 버그 픽스 진행 중" },
  { id: "completed", label: "반영을 마쳤어요", desc: "배포 완료 및 반영 완료" },
];

export function FeedbackAdminModal({
  item,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: FeedbackAdminModalProps) {
  const [status, setStatus] = useState<FeedbackStatus>("received");
  const [adminReply, setAdminReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setAdminReply(item.adminReply || "");
      setErrorMessage(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await updateFeedbackAdmin(item.id, {
      status,
      adminReply: adminReply.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!res.success || !res.feedback) {
      setErrorMessage(res.message);
      return;
    }

    onUpdate({
      ...item,
      status: res.feedback.status,
      adminReply: res.feedback.adminReply ?? adminReply.trim(),
      repliedAt: res.feedback.repliedAt ?? new Date().toISOString(),
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm("이 피드백을 영구히 삭제할까요?")) return;
    setIsDeleting(true);
    const res = await deleteFeedbackAdmin(item.id);
    setIsDeleting(false);

    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }
    onDelete(item.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#e5e8eb] flex flex-col max-h-[90vh] overflow-hidden z-10">
        <div className="px-6 py-5 border-b border-[#f1f5f9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#3182f6]" />
            <h2 id="admin-feedback-modal-title" className="text-lg font-bold text-[#191f28]">
              피드백 관리 및 팀 답변
            </h2>
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

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* 원본 피드백 요약 */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e5e8eb] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#8b95a1] font-semibold">
              ORIGINAL FEEDBACK · {item.authorName}
            </span>
            <div className="text-sm font-bold text-[#191f28]">{item.title}</div>
            <div className="text-xs text-[#4e5968] line-clamp-3 whitespace-pre-line">
              {item.content}
            </div>
          </div>

          {/* 상태 변경 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#191f28]">
              진행 상태 변경
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatus(st.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    status === st.id
                      ? "border-[#3182f6] bg-blue-50 text-[#3182f6] font-bold ring-2 ring-[#3182f6]/20"
                      : "border-[#e5e8eb] bg-white text-[#4e5968] hover:bg-[#f8fafc]"
                  }`}
                >
                  <div className="text-xs">{st.label}</div>
                  <div className="text-[10px] text-[#8b95a1] font-normal">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 관리자 공식 답변 */}
          <div className="space-y-1.5">
            <label htmlFor="admin-reply-input" className="block text-xs font-bold text-[#191f28]">
              리포티스트 팀 공식 답변 (해요체 권장)
            </label>
            <textarea
              id="admin-reply-input"
              rows={4}
              value={adminReply}
              onChange={(e) => setAdminReply(e.target.value)}
              placeholder="예: 소중한 제안 감사드려요! 요청해주신 정렬 지표는 다음 주 정기 업데이트에 반영될 예정이에요."
              className="w-full p-4 rounded-xl border border-[#e5e8eb] bg-[#f8fafc] text-sm text-[#191f28] placeholder-[#8b95a1] focus:bg-white focus:border-[#3182f6] focus:outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* 하단 버튼 및 삭제 */}
          <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="min-h-[44px] px-3.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>게시글 삭제</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl border border-[#e5e8eb] text-sm font-semibold text-[#4e5968] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] px-5 rounded-xl bg-[#3182f6] hover:bg-blue-600 text-white text-sm font-bold shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>저장 중...</span>
                  </>
                ) : (
                  <span>답변 및 상태 저장</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
