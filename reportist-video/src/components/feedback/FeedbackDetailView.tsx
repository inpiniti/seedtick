// src/components/feedback/FeedbackDetailView.tsx - Toss-style Feedback Detail View Component
import React, { useState } from 'react';
import {
  Sparkles,
  Bug,
  Lightbulb,
  HelpCircle,
  Clock,
  User,
  Heart,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  Save,
  Trash2,
  Loader2,
  Monitor,
  ArrowLeft,
  X,
} from 'lucide-react';
import type { FeedbackItem, FeedbackStatus } from '../../types/feedback.ts';
import { useI18n } from '../../i18n/index.tsx';

export interface FeedbackDetailViewProps {
  feedback: FeedbackItem;
  onBack: () => void;
  onLike: (id: string) => void;
  isAdminMode: boolean;
  onUpdateStatusAndResponse: (
    id: string,
    status: FeedbackStatus,
    adminResponse: string | null
  ) => Promise<void>;
  onDeleteFeedback: (id: string) => Promise<void>;
}

export const FeedbackDetailView: React.FC<FeedbackDetailViewProps> = ({
  feedback,
  onBack,
  onLike,
  isAdminMode,
  onUpdateStatusAndResponse,
  onDeleteFeedback,
}) => {
  const { dict } = useI18n();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<FeedbackStatus>(feedback.status);
  const [adminReply, setAdminReply] = useState<string>(feedback.adminResponse || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getCategoryBadge = () => {
    switch (feedback.category) {
      case 'bug':
        return (
          <span className="toss-badge bg-red-50 text-red-600 border border-red-200">
            <Bug size={11} />
            <span>{dict.feedback?.catBug || '버그 제보'}</span>
          </span>
        );
      case 'feature':
        return (
          <span className="toss-badge bg-amber-50 text-amber-700 border border-amber-200">
            <Lightbulb size={11} />
            <span>{dict.feedback?.catFeature || '새로운 기능'}</span>
          </span>
        );
      case 'improvement':
        return (
          <span className="toss-badge bg-blue-50 text-blue-600 border border-blue-200">
            <Sparkles size={11} />
            <span>{dict.feedback?.catImprovement || '사용성 개선'}</span>
          </span>
        );
      default:
        return (
          <span className="toss-badge bg-purple-50 text-purple-600 border border-purple-200">
            <HelpCircle size={11} />
            <span>{dict.feedback?.catOther || '기타 의견'}</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="toss-badge bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>{dict.feedback?.statusCompleted || '해결 완료'}</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="toss-badge bg-blue-50 text-blue-700 border border-blue-200 font-bold">
            <Clock size={12} className="text-blue-600" />
            <span>{dict.feedback?.statusReviewing || dict.feedback?.statusInProgress || '진행중'}</span>
          </span>
        );
      case 'closed':
        return (
          <span className="toss-badge bg-slate-100 text-slate-600 border border-slate-200">
            <span>{dict.feedback?.statusClosed || '보류'}</span>
          </span>
        );
      case 'open':
      default:
        return (
          <span className="toss-badge bg-amber-50 text-amber-600 border border-amber-200">
            <span>{dict.feedback?.statusWaiting || dict.feedback?.statusOpen || '대기중'}</span>
          </span>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
        d.getDate()
      ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;
    } catch {
      return isoStr;
    }
  };

  const handleSaveAdmin = async () => {
    setIsSaving(true);
    try {
      await onUpdateStatusAndResponse(feedback.id, adminStatus, adminReply);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(dict.feedback?.deleteFeedbackConfirm || '정말로 이 피드백을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await onDeleteFeedback(feedback.id);
      onBack();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Row with Back Button */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <button
          type="button"
          className="toss-feedback-back-btn"
          onClick={onBack}
          title={dict.feedback?.backToList || '목록으로 돌아가기'}
        >
          <ArrowLeft size={16} />
          <span>{dict.feedback?.backToList || '목록으로'}</span>
        </button>

        <div className="flex items-center gap-2">
          {getCategoryBadge()}
          {getStatusBadge(feedback.status)}
        </div>
      </div>

      {/* Detail Content Card */}
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            {feedback.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
            <span className="flex items-center gap-1 text-slate-600 font-medium">
              <User size={12} />
              {feedback.authorName}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDate(feedback.createdAt)}
            </span>
            {feedback.deviceInfo && (
              <>
                <span>•</span>
                <span
                  className="flex items-center gap-1 text-slate-400 truncate max-w-[220px]"
                  title={feedback.deviceInfo}
                >
                  <Monitor size={12} />
                  {feedback.deviceInfo.split(' (')[0]}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Feedback Body */}
        <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap break-words bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          {feedback.content}
        </div>

        {/* Attached Images */}
        {feedback.imageUrls && feedback.imageUrls.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-700">
              {dict.feedback?.attachedImagesTitle || '첨부 이미지'} ({feedback.imageUrls.length})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {feedback.imageUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video cursor-pointer hover:opacity-95 group transition-all shadow-sm"
                  onClick={() => setSelectedImage(url)}
                >
                  <img
                    src={url}
                    alt={`Attachment ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                    {dict.feedback?.zoomImageText || '확대 보기'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Like Button */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => onLike(feedback.id)}
            className="toss-feedback-like-btn"
          >
            <Heart size={14} className="text-rose-500 fill-rose-500" />
            <span>
              {dict.feedback?.likeCountText || '공감해요'} {feedback.likeCount || 0}
            </span>
          </button>
        </div>

        {/* Developer Response Section */}
        <div className="toss-admin-response-card">
          <div className="flex items-center justify-between border-b border-blue-100/60 pb-2.5">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
              <ShieldCheck size={16} className="text-blue-600" />
              <span>{dict.feedback?.adminResponseTitle || '개발자 처리 내용'}</span>
              {feedback.status === 'completed' && (
                <span className="ml-1 text-[11px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                  {dict.feedback?.adminResponseCompletedBadge || '반영 완료 🎉'}
                </span>
              )}
            </div>
            {feedback.adminRespondedAt && (
              <span className="text-[11px] text-slate-400">
                {formatDate(feedback.adminRespondedAt)}
              </span>
            )}
          </div>

          {feedback.adminResponse ? (
            <div className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words pt-2.5">
              {feedback.adminResponse}
            </div>
          ) : (
            <div className="text-slate-400 text-xs italic py-2 flex items-center gap-2">
              <MessageSquare size={14} className="text-slate-300" />
              <span>
                {dict.feedback?.adminResponsePendingText ||
                  '개발자가 확인 후 처리 내용과 일정을 공유할 예정입니다.'}
              </span>
            </div>
          )}
        </div>

        {/* Developer Admin Management Panel */}
        {isAdminMode && (
          <div className="toss-dev-admin-panel">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
                <ShieldCheck size={14} />
                <span>{dict.feedback?.adminControlsTitle || '개발자 관리자 모드 (Admin Controls)'}</span>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>{dict.feedback?.deleteFeedbackBtn || '삭제'}</span>
              </button>
            </div>

            {/* Status Switcher */}
            <div className="flex flex-col gap-1.5 mb-3">
              <label className="text-[11px] font-bold text-slate-600">
                {dict.feedback?.statusChangeLabel || '진행 상태 변경'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(['open', 'in_progress', 'completed', 'closed'] as FeedbackStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`toss-status-select-btn ${adminStatus === st ? 'active' : ''}`}
                    onClick={() => setAdminStatus(st)}
                  >
                    {st === 'open' && (dict.feedback?.statusWaiting || dict.feedback?.statusOpen || '대기중')}
                    {st === 'in_progress' && (dict.feedback?.statusReviewing || dict.feedback?.statusInProgress || '진행중')}
                    {st === 'completed' && (dict.feedback?.statusCompleted || '해결 완료')}
                    {st === 'closed' && (dict.feedback?.statusClosed || '보류')}
                  </button>
                ))}
              </div>
            </div>

            {/* Response Textarea */}
            <div className="flex flex-col gap-1.5 mb-3">
              <label className="text-[11px] font-bold text-slate-600">
                {dict.feedback?.adminReplyLabel || '개발자 공식 처리/답변 내용 작성'}
              </label>
              <textarea
                className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-800 outline-none focus:border-purple-500 transition-all resize-y leading-relaxed"
                rows={4}
                placeholder={
                  dict.feedback?.adminReplyPlaceholder ||
                  '처리 경과, 해결 방법, 또는 반영된 릴리즈 내용을 상세히 적어주세요.'
                }
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveAdmin}
                disabled={isSaving}
                className="toss-btn-primary text-xs flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{dict.feedback?.adminSavingBtn || '저장 중...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>{dict.feedback?.adminSaveBtn || '답변 및 상태 업데이트 저장'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[1200] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:text-slate-300 p-2"
            onClick={() => setSelectedImage(null)}
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="Expanded attachment"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
