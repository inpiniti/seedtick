// src/components/feedback/CreateFeedbackModal.tsx - Modal for submitting user feedback & bug reports
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
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
} from 'lucide-react';
import type { FeedbackCategory, NewFeedbackInput } from '../../types/feedback.ts';
import { uploadFeedbackAttachment } from '../../services/feedbackService.ts';

interface CreateFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewFeedbackInput) => Promise<void>;
}

export const CreateFeedbackModal: React.FC<CreateFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
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

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setImages([]);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle clipboard paste (Ctrl+V) for images
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  if (!isOpen) return null;

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
      setErrorMessage('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('내용을 입력해주세요.');
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
        authorName: authorName.trim() || '익명 사용자',
        imageUrls: images,
        deviceInfo,
      });
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '등록에 실패했습니다. 다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="toss-modal-backdrop" onClick={onClose}>
      <div
        className="toss-modal-container toss-feedback-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="toss-modal-header">
          <div className="flex flex-col gap-1">
            <h2 className="toss-modal-title">피드백 & 개선 요청 보내기</h2>
            <p className="toss-modal-subtitle">
              불편한 점이나 추가되었으면 하는 기능을 편하게 남겨주세요.
            </p>
          </div>
          <button
            type="button"
            className="toss-modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="toss-modal-body flex flex-col gap-4">
          {errorMessage && (
            <div className="toss-error-banner text-xs">
              {errorMessage}
            </div>
          )}

          {/* Category Select Buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">분류</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                className={`toss-category-select-btn ${category === 'improvement' ? 'active' : ''}`}
                onClick={() => setCategory('improvement')}
              >
                <Sparkles size={14} className="text-blue-500" />
                <span>사용성 개선</span>
              </button>
              <button
                type="button"
                className={`toss-category-select-btn ${category === 'feature' ? 'active' : ''}`}
                onClick={() => setCategory('feature')}
              >
                <Lightbulb size={14} className="text-amber-500" />
                <span>새로운 기능</span>
              </button>
              <button
                type="button"
                className={`toss-category-select-btn ${category === 'bug' ? 'active' : ''}`}
                onClick={() => setCategory('bug')}
              >
                <Bug size={14} className="text-red-500" />
                <span>버그 제보</span>
              </button>
              <button
                type="button"
                className={`toss-category-select-btn ${category === 'other' ? 'active' : ''}`}
                onClick={() => setCategory('other')}
              >
                <HelpCircle size={14} className="text-purple-500" />
                <span>기타 의견</span>
              </button>
            </div>
          </div>

          {/* Author Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">작성자 닉네임 (선택)</label>
            <input
              type="text"
              className="toss-text-input text-xs"
              placeholder="예: 유튜브 크리에이터 (미입력 시 익명 사용자)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={30}
            />
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">제목 *</label>
            <input
              type="text"
              className="toss-text-input text-xs"
              placeholder="핵심 내용을 한 줄로 요약해주세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">내용 *</label>
            <textarea
              ref={contentAreaRef}
              className="toss-textarea text-xs"
              placeholder="어떤 상황에서 어떤 점이 불편했거나, 어떤 기능이 추가되면 좋을지 자세히 적어주세요.&#10;💡 화면을 캡처한 뒤 이 창에서 바로 Ctrl+V를 누르면 이미지가 첨부됩니다!"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              required
            />
          </div>

          {/* Image Attachments */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-blue-500" />
                <span>이미지 / 스크린샷 첨부 ({images.length}장)</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="toss-btn-text text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Upload size={12} />
                <span>파일 찾기</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Paste Guide Banner */}
            <div className="toss-paste-tip-box">
              <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <span>
                <strong>Tip:</strong> 화면 캡처 도구로 스크린샷을 찍은 뒤, 키보드로{' '}
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono shadow-sm">
                  Ctrl+V
                </kbd>
                를 누르면 바로 첨부할 수 있어요.
              </span>
            </div>

            {/* Images Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {images.map((imgUrl, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                    <img
                      src={imgUrl}
                      alt={`첨부 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors opacity-90 group-hover:opacity-100"
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isUploading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                <span>이미지를 업로드하고 있어요...</span>
              </div>
            )}
          </div>

          {/* Device Info Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-600 text-xs select-none">
            <input
              type="checkbox"
              checked={includeDeviceInfo}
              onChange={(e) => setIncludeDeviceInfo(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>원활한 버그 해결을 위해 브라우저 및 화면 크기 정보를 함께 전송합니다.</span>
          </label>

          {/* Footer Action Buttons */}
          <div className="toss-modal-footer flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              className="toss-btn-secondary text-xs"
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="toss-btn-primary text-xs flex items-center gap-1.5"
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>등록 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  <span>피드백 등록하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
