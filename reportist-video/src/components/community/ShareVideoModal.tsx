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
        setErrorMsg(res.error || '영상 등록 중 오류가 발생했습니다.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '영상 등록 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm">
              <Youtube size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {cDict?.shareModalTitle || '유튜브 영상 공유하기'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {cDict?.shareModalSubtitle || '유튜브 ID나 링크를 입력하면 자동으로 정보를 불러와요.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. YouTube Link / ID Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {cDict?.inputLabel || '유튜브 영상 링크 또는 ID'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={cDict?.inputPlaceholder || 'https://www.youtube.com/watch?v=... 또는 ID'}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition-all pr-10"
                autoFocus
              />
              {isLoadingMeta && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              )}
              {extractedId && !isLoadingMeta && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </div>
            {extractedId && (
              <p className="text-[11px] text-emerald-600 mt-1 font-mono flex items-center gap-1">
                <Sparkles size={11} />
                감지된 비디오 ID: {extractedId}
              </p>
            )}
          </div>

          {/* Live Preview Card */}
          {extractedId && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {cDict?.previewLabel || '공유 카드 미리보기'}
              </div>
              <div className="flex gap-3 items-center">
                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200 shadow-sm">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Youtube size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {title || '영상 제목'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {authorName || '채널명'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Title Input (editable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {cDict?.titleLabel || '영상 제목'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={cDict?.titlePlaceholder || '유튜브 영상 제목이 자동으로 채워져요'}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* 3. Author Name Input (editable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {cDict?.authorLabel || '작성자 (채널명)'}
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={cDict?.authorPlaceholder || '채널명이 자동으로 채워져요'}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* 4. Description / Note (optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              소개 또는 하이라이트 설명 (선택)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="영상에 대한 간단한 소개나 사용한 프롬프트 등을 남겨보세요."
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {dict.common.close}
            </button>
            <button
              type="submit"
              disabled={!extractedId || isSubmitting}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl text-white transition-all shadow-sm ${
                !extractedId || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {isSubmitting
                ? cDict?.submitting || '등록하는 중...'
                : cDict?.submitBtn || '공유 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
