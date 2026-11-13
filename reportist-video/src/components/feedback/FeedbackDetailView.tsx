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
          <span className="toss-badge bg-slate-100 text-slate-900 border border-slate-200">
            <Sparkles size={11} />
            <span>{dict.feedback?.catImprovement || '사용성 개선'}</span>
          </span>
        );
      default:
        return (
          <span className="toss-badge bg-slate-100 text-slate-900 border border-slate-200">
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
          <span className="toss-badge bg-slate-100 text-slate-900 border border-slate-200 font-bold">
            <Clock size={12} className="text-slate-900" />
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
    <div className="toss-feedback-detail-container">
      {/* Top Header Row with Back Button */}
      <div className="toss-feedback-detail-header">
        <button
          type="button"
          className="toss-feedback-back-btn"
          onClick={onBack}
          title={dict.feedback?.backToList || '목록으로 돌아가기'}
        >
          <ArrowLeft size={15} />
          <span>{dict.feedback?.backToList || '목록으로'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getCategoryBadge()}
          {getStatusBadge(feedback.status)}
        </div>
      </div>

      {/* Detail Content Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 className="toss-feedback-detail-title">
            {feedback.title}
          </h2>
          <div className="toss-feedback-detail-meta">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontWeight: 600 }}>
              <User size={12} />
              {feedback.authorName}
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} />
              {formatDate(feedback.createdAt)}
            </span>
            {feedback.deviceInfo && (
              <>
                <span>•</span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
        <div className="toss-feedback-detail-body">
          {feedback.content}
        </div>

        {/* Attached Images */}
        {feedback.imageUrls && feedback.imageUrls.length > 0 && (
          <div className="toss-feedback-form-group">
            <span className="toss-feedback-label">
              {dict.feedback?.attachedImagesTitle || '첨부 이미지'} ({feedback.imageUrls.length})
            </span>
            <div className="toss-feedback-images-grid">
              {feedback.imageUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="toss-feedback-image-tile"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedImage(url)}
                >
                  <img
                    src={url}
                    alt={`Attachment ${idx + 1}`}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                  >
                    {dict.feedback?.zoomImageText || '확대 보기'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Like Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '4px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(203, 213, 225, 0.6)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 700, fontSize: '12.5px' }}>
              <ShieldCheck size={16} color="#0f172a" />
              <span>{dict.feedback?.adminResponseTitle || '개발자 처리 내용'}</span>
              {feedback.status === 'completed' && (
                <span style={{ marginLeft: '4px', fontSize: '11px', backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
                  {dict.feedback?.adminResponseCompletedBadge || '반영 완료 🎉'}
                </span>
              )}
            </div>
            {feedback.adminRespondedAt && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {formatDate(feedback.adminRespondedAt)}
              </span>
            )}
          </div>

          {feedback.adminResponse ? (
            <div style={{ color: '#1e293b', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingTop: '10px' }}>
              {feedback.adminResponse}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} color="#cbd5e1" />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                <ShieldCheck size={14} />
                <span>{dict.feedback?.adminControlsTitle || '개발자 관리자 모드 (Admin Controls)'}</span>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={12} />
                <span>{dict.feedback?.deleteFeedbackBtn || '삭제'}</span>
              </button>
            </div>

            {/* Status Switcher */}
            <div className="toss-feedback-form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>
                {dict.feedback?.statusChangeLabel || '진행 상태 변경'}
              </label>
              <div className="toss-feedback-status-grid">
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
            <div className="toss-feedback-form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>
                {dict.feedback?.adminReplyLabel || '개발자 공식 처리/답변 내용 작성'}
              </label>
              <textarea
                className="toss-feedback-textarea"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', minHeight: '90px' }}
                rows={4}
                placeholder={
                  dict.feedback?.adminReplyPlaceholder ||
                  '처리 경과, 해결 방법, 또는 반영된 릴리즈 내용을 상세히 적어주세요.'
                }
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
              />
            </div>

            <div className="toss-feedback-admin-footer">
              <button
                type="button"
                onClick={handleSaveAdmin}
                disabled={isSaving}
                className="toss-btn-primary text-xs"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
          style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            style={{ position: 'absolute', top: '16px', right: '16px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
            onClick={() => setSelectedImage(null)}
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="Expanded attachment"
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
