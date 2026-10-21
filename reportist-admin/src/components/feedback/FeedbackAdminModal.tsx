"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { FeedbackItem, FeedbackStatus } from "@/types/feedback";
import { updateFeedbackAdmin, deleteFeedbackAdmin } from "@/lib/feedbackApi";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface FeedbackAdminModalProps {
  item: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: FeedbackItem) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { id: FeedbackStatus; label: string; desc: string }[] = [
  { id: "received", label: "접수됨", desc: "검토 전 확인 단계" },
  { id: "reviewing", label: "검토 중", desc: "기획 및 개발 타당성 검토" },
  { id: "in_progress", label: "개발 중", desc: "기능 개발 및 버그 조치 진행 중" },
  { id: "completed", label: "반영 완료", desc: "서비스 배포 및 반영 완료" },
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
    <Modal isOpen={isOpen} onClose={onClose} size="default">
      <form onSubmit={handleSave} className="flex flex-col h-full font-sans">
        <Modal.Header
          title="피드백 관리 및 팀 공식 답변"
          description="피드백의 상태를 업데이트하고 사용자에게 노출될 공식 검토 답변을 작성합니다."
        />

        <Modal.Body className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* 원본 피드백 요약 */}
          <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#94a3b8] font-semibold">
              ORIGINAL FEEDBACK · {item.authorName} ({item.category})
            </span>
            <div className="text-xs font-bold text-[#0f172a]">{item.title}</div>
            <div className="text-[11px] text-[#475569] line-clamp-3 whitespace-pre-line font-mono">
              {item.content}
            </div>
          </div>

          {/* 상태 선택 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold text-[#0f172a] uppercase tracking-wider">
              진행 상태
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatus(st.id)}
                  className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                    status === st.id
                      ? "border-[#0f172a] bg-[#0f172a] text-white shadow-xs"
                      : "border-[#cbd5e1] bg-white text-[#475569] hover:border-[#0f172a] hover:bg-[#f8fafc]"
                  }`}
                >
                  <div className="text-xs font-bold">{st.label}</div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      status === st.id ? "text-slate-300" : "text-[#94a3b8]"
                    }`}
                  >
                    {st.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 관리자 공식 답변 */}
          <div className="space-y-1">
            <label
              htmlFor="admin-reply-textarea"
              className="block text-xs font-mono font-semibold text-[#0f172a] uppercase tracking-wider"
            >
              리포티스트 리서치팀 공식 답변
            </label>
            <textarea
              id="admin-reply-textarea"
              rows={4}
              value={adminReply}
              onChange={(e) => setAdminReply(e.target.value)}
              placeholder="예: 소중한 제안 감사드립니다. 요청해주신 지표 필터링 기능은 차주 정기 업데이트에 반영될 예정입니다."
              className="w-full p-3 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a] placeholder-[#94a3b8] resize-none leading-relaxed"
            />
          </div>
        </Modal.Body>

        <Modal.Footer className="justify-between">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            disabled={isDeleting}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            게시글 삭제
          </Button>

          <div className="flex items-center gap-2">
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
              답변 및 상태 저장
            </Button>
          </div>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
