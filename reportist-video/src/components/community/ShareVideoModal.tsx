// src/components/community/ShareVideoModal.tsx - Modal for Sharing YouTube Video
import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const Youtube: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  fetchYouTubeMeta,
} from '../../services/youtubeService.ts';
import { createVideoShare } from '../../services/videoShareService.ts';
import type { VideoShareItem } from '../../types/share.ts';
import { useI18n } from '../../i18n/index.tsx';

interface ShareVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: VideoShareItem) => void;
}

export const ShareVideoModal: React.FC<ShareVideoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { dict } = useI18n();
  const cDict = dict.community;

  const [inputVal, setInputVal] = useState('');
  const [extractedId, setExtractedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 입력값 변경 시 유튜브 ID 추출 및 메타데이터 자동 조회
  useEffect(() => {
    if (!inputVal.trim()) {
      setExtractedId(null);
      setTitle('');
      setAuthorName('');
      setThumbnailUrl('');
      setErrorMsg(null);
      return;
    }

    const videoId = extractYouTubeVideoId(inputVal);
    if (!videoId) {
      setExtractedId(null);
      setErrorMsg(cDict?.invalidIdError || '올바른 유튜브 링크 또는 ID를 입력해 주세요.');
      return;
    }

    setExtractedId(videoId);
    setErrorMsg(null);
    setThumbnailUrl(getYouTubeThumbnailUrl(videoId));

    let active = true;
    setIsLoadingMeta(true);

    fetchYouTubeMeta(videoId)
      .then((meta) => {
        if (!active) return;
        if (meta) {
          setTitle((prev) => (prev ? prev : meta.title));
          setAuthorName((prev) => (prev ? prev : meta.authorName));
          if (meta.thumbnailUrl) setThumbnailUrl(meta.thumbnailUrl);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch oEmbed metadata:', err);
      })
      .finally(() => {
        if (active) setIsLoadingMeta(false);
      });

    return () => {
      active = false;
    };
  }, [inputVal, cDict]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedId) {
      setErrorMsg(cDict?.invalidIdError || '올바른 유튜브 링크 또는 ID를 입력해 주세요.');
      return;
    }

    const finalTitle = title.trim() || `YouTube Highlight (${extractedId})`;
    const finalAuthor = authorName.trim() || 'Reportist Creator';

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createVideoShare({
        youtubeVideoId: extractedId,
        title: finalTitle,
        authorName: finalAuthor,
        description: description.trim(),
        thumbnailUrl: thumbnailUrl || getYouTubeThumbnailUrl(extractedId),
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
        // Reset form
        setInputVal('');
        setExtractedId(null);
        setTitle('');
        setAuthorName('');
        setDescription('');
      } else {
        setErrorMsg(res.error || cDict?.submitError || '영상 등록 중 오류가 발생했습니다.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (cDict?.submitError || '영상 등록 중 오류가 발생했습니다.');
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="toss-community-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="toss-modal-header">
          <div className="toss-modal-header-left">
            <div className="toss-modal-yt-icon">
              <Youtube size={20} />
            </div>
            <div className="toss-modal-title-group">
              <h3 className="toss-modal-title">
                {cDict?.shareModalTitle || '유튜브 영상 공유하기'}
              </h3>
              <p className="toss-modal-subtitle">
                {cDict?.shareModalSubtitle || '유튜브 링크나 ID만 입력하면 정보를 자동으로 불러와요.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="toss-modal-close-btn"
            title={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="toss-modal-body">
            {errorMsg && (
              <div className="toss-form-alert">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. YouTube Link / ID Input */}
            <div className="toss-form-group">
              <label className="toss-form-label">
                {cDict?.inputLabel || '유튜브 영상 링크 또는 ID'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder={cDict?.inputPlaceholder || 'https://www.youtube.com/watch?v=... 또는 ID'}
                  className="toss-form-input"
                  style={{ paddingRight: 40, fontFamily: 'monospace' }}
                  autoFocus
                />
                {isLoadingMeta && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#0f172a' }}>
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                )}
                {extractedId && !isLoadingMeta && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#03b26c' }}>
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </div>
              {extractedId && (
                <div style={{ fontSize: '11.5px', color: '#03b26c', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontFamily: 'monospace' }}>
                  <Sparkles size={11} />
                  {cDict?.detectedVideoId ? `${cDict.detectedVideoId}: ${extractedId}` : `감지된 비디오 ID: ${extractedId}`}
                </div>
              )}
            </div>

            {/* Live Preview Card */}
            {extractedId && (
              <div className="toss-preview-card-box">
                <div className="toss-preview-thumb">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <Youtube size={24} />
                    </div>
                  )}
                </div>
                <div className="toss-preview-info">
                  <div className="toss-preview-title">
                    {title || cDict?.titleLabel || '영상 제목'}
                  </div>
                  <div className="toss-preview-channel">
                    {authorName || cDict?.authorLabel || '채널명'}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Title Input (editable) */}
            <div className="toss-form-group">
              <label className="toss-form-label">
                {cDict?.titleLabel || '영상 제목'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={cDict?.titlePlaceholder || '유튜브 영상 제목이 자동으로 채워져요'}
                className="toss-form-input"
              />
            </div>

            {/* 3. Author Name Input (editable) */}
            <div className="toss-form-group">
              <label className="toss-form-label">
                {cDict?.authorLabel || '작성자 (채널명)'}
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={cDict?.authorPlaceholder || '채널명이 자동으로 채워져요'}
                className="toss-form-input"
              />
            </div>

            {/* 4. Description / Note (optional) */}
            <div className="toss-form-group">
              <label className="toss-form-label">
                {cDict?.descriptionLabel || '소개 또는 하이라이트 설명 (선택)'}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={cDict?.descriptionPlaceholder || '영상에 대한 간단한 소개나 사용한 프롬프트 등을 남겨보세요.'}
                className="toss-form-textarea"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="toss-modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="toss-modal-btn-close"
            >
              {dict.common.close}
            </button>
            <button
              type="submit"
              disabled={!extractedId || isSubmitting}
              className="toss-modal-btn-submit"
            >
              {isSubmitting
                ? (cDict?.submitting || '등록하는 중...')
                : (cDict?.submitBtn || '영상 공유하기')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
