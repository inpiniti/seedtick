// src/components/feedback/CreateFeedbackForm.tsx - Toss-style Feedback Creation Form Component
import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Bug,
  Lightbulb,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle,
  Info,
  ArrowLeft,
} from 'lucide-react';
import type { FeedbackCategory, NewFeedbackInput } from '../../types/feedback.ts';
import { uploadFeedbackAttachment } from '../../services/feedbackService.ts';
import { useI18n } from '../../i18n/index.tsx';

export interface CreateFeedbackFormProps {
  onCancel: () => void;
  onSubmit: (data: NewFeedbackInput) => Promise<void>;
  showBackHeader?: boolean;
}

export const CreateFeedbackForm: React.FC<CreateFeedbackFormProps> = ({
  onCancel,
  onSubmit,
  showBackHeader = true,
}) => {
  const { dict } = useI18n();
  const [category, setCategory] = useState<FeedbackCategory>('improvement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [includeDeviceInfo, setIncludeDeviceInfo] = useState(true);

  // Attachments
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Handle clipboard paste (Ctrl+V) for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        setIsUploading(true);
        try {
          for (const file of imageFiles) {
            const url = await uploadFeedbackAttachment(file);
            setImages((prev) => [...prev, url]);
          }
        } catch (err) {
          console.warn('Image paste upload failed:', err);
        } finally {
          setIsUploading(false);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const url = await uploadFeedbackAttachment(file);
          setImages((prev) => [...prev, url]);
        }
      }
    } catch (err) {
      console.warn('File upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage(dict.feedback?.titleRequiredError || '제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      setErrorMessage(dict.feedback?.contentRequiredError || '내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const deviceInfo = includeDeviceInfo
      ? `${navigator.userAgent} (화면: ${window.innerWidth}x${window.innerHeight})`
      : undefined;

    try {
      await onSubmit({
        category,
        title: title.trim(),
        content: content.trim(),
        authorName: authorName.trim() || dict.feedback?.anonymousAuthor || '익명 사용자',
        imageUrls: images,
        deviceInfo,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : dict.feedback?.submitFailedError || '등록에 실패했습니다. 다시 시도해주세요.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="toss-feedback-form">
      {/* Header with Back button */}
      {showBackHeader && (
        <div className="toss-feedback-create-header">
          <div className="toss-feedback-create-header-left">
            <button
              type="button"
              className="toss-feedback-back-btn"
              onClick={onCancel}
              title={dict.feedback?.backToList || '목록으로 돌아가기'}
            >
              <ArrowLeft size={15} />
              <span>{dict.feedback?.backToList || '목록으로'}</span>
            </button>
            <span className="toss-feedback-step-indicator">
              {dict.feedback?.createTitle || '피드백 & 개선 요청 작성'}
            </span>
          </div>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="toss-feedback-form">
        {errorMessage && (
          <div className="toss-feedback-error-banner">
            {errorMessage}
          </div>
        )}

        {/* Category Select Buttons */}
        <div className="toss-feedback-form-group">
          <label className="toss-feedback-label">
            {dict.feedback?.categoryLabel || '분류'}
          </label>
          <div className="toss-category-select-grid">
            <button
              type="button"
              className={`toss-category-select-btn ${category === 'improvement' ? 'active' : ''}`}
              onClick={() => setCategory('improvement')}
            >
              <Sparkles size={14} className="text-blue-500" />
              <span>{dict.feedback?.catImprovement || '사용성 개선'}</span>
            </button>
            <button
              type="button"
              className={`toss-category-select-btn ${category === 'feature' ? 'active' : ''}`}
              onClick={() => setCategory('feature')}
            >
              <Lightbulb size={14} className="text-amber-500" />
              <span>{dict.feedback?.catFeature || '새로운 기능'}</span>
            </button>
            <button
              type="button"
              className={`toss-category-select-btn ${category === 'bug' ? 'active' : ''}`}
              onClick={() => setCategory('bug')}
            >
              <Bug size={14} className="text-red-500" />
              <span>{dict.feedback?.catBug || '버그 제보'}</span>
            </button>
            <button
              type="button"
              className={`toss-category-select-btn ${category === 'other' ? 'active' : ''}`}
              onClick={() => setCategory('other')}
            >
              <HelpCircle size={14} className="text-purple-500" />
              <span>{dict.feedback?.catOther || '기타 의견'}</span>
            </button>
          </div>
        </div>

        {/* Author Name */}
        <div className="toss-feedback-form-group">
          <label className="toss-feedback-label">
            {dict.feedback?.authorLabel || '작성자 닉네임 (선택)'}
          </label>
          <input
            type="text"
            className="toss-feedback-input"
            placeholder={dict.feedback?.authorPlaceholder || '예: 유튜브 크리에이터 (미입력 시 익명 사용자)'}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={30}
          />
        </div>

        {/* Title */}
        <div className="toss-feedback-form-group">
          <label className="toss-feedback-label">
            {dict.feedback?.titleLabel || '제목 *'}
          </label>
          <input
            type="text"
            className="toss-feedback-input"
            placeholder={dict.feedback?.titlePlaceholder || '핵심 내용을 한 줄로 요약해주세요'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* Content */}
        <div className="toss-feedback-form-group">
          <label className="toss-feedback-label">
            {dict.feedback?.contentLabel || '내용 *'}
          </label>
          <textarea
            ref={contentAreaRef}
            className="toss-feedback-textarea"
            placeholder={
              dict.feedback?.contentPlaceholder ||
              '어떤 상황에서 어떤 점이 불편했거나, 어떤 기능이 추가되면 좋을지 자세히 적어주세요.\n💡 화면을 캡처한 뒤 이 창에서 바로 Ctrl+V를 누르면 이미지가 첨부됩니다!'
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            required
          />
        </div>

        {/* Image Attachments */}
        <div className="toss-feedback-form-group">
          <div className="toss-feedback-images-header">
            <label className="toss-feedback-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImageIcon size={14} color="#3182f6" />
              <span>
                {dict.feedback?.attachImagesLabel || '이미지 / 스크린샷 첨부'} ({images.length}
                {dict.feedback?.attachedImagesTitle ? '' : '장'})
              </span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="toss-feedback-upload-btn"
            >
              <Upload size={12} />
              <span>{dict.feedback?.findFileBtn || '파일 찾기'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>

          {/* Paste Guide Banner */}
          <div className="toss-paste-tip-box">
            <Info size={13} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>{dict.feedback?.pasteTipStrong || 'Tip:'}</strong>{' '}
              {dict.feedback?.pasteTipText ||
                '화면 캡처 도구로 스크린샷을 찍은 뒤 키보드로 Ctrl+V를 누르면 바로 첨부할 수 있어요.'}
            </span>
          </div>

          {/* Images Grid */}
          {images.length > 0 && (
            <div className="toss-feedback-images-grid">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="toss-feedback-image-tile">
                  <img
                    src={imgUrl}
                    alt={`Attachment ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="toss-feedback-image-del-btn"
                    title={dict.feedback?.deleteFeedbackBtn || '삭제'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isUploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', padding: '4px 0' }}>
              <Loader2 size={14} className="animate-spin" color="#3182f6" />
              <span>{dict.feedback?.uploadingImages || '이미지를 업로드하고 있어요...'}</span>
            </div>
          )}
        </div>

        {/* Device Info Checkbox */}
        <label className="toss-feedback-checkbox-label">
          <input
            type="checkbox"
            checked={includeDeviceInfo}
            onChange={(e) => setIncludeDeviceInfo(e.target.checked)}
            style={{ width: '15px', height: '15px', accentColor: '#3182f6', cursor: 'pointer' }}
          />
          <span>
            {dict.feedback?.deviceInfoNotice ||
              '원활한 버그 해결을 위해 브라우저 및 화면 크기 정보를 함께 전송합니다.'}
          </span>
        </label>

        {/* Footer Action Buttons */}
        <div className="toss-feedback-form-footer">
          <button
            type="button"
            className="toss-btn-secondary text-xs"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {dict.feedback?.cancelBtn || '취소'}
          </button>
          <button
            type="submit"
            className="toss-btn-primary text-xs"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{dict.feedback?.submittingBtn || '등록 중...'}</span>
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                <span>{dict.feedback?.submitBtn || '피드백 등록하기'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
