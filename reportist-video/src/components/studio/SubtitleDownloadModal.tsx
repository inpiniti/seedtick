import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Subtitles,
  X,
  Download,
  Copy,
  Check,
  Globe,
  Loader2,
  Sparkles,
  FileText,
  Clock,
} from 'lucide-react';
import type { HighlightSegment } from '../../types/video.ts';
import type { Locale, LocaleInfo } from '../../i18n/types.ts';
import { LOCALES } from '../../i18n/types.ts';
import { useI18n } from '../../i18n/index.tsx';
import {
  formatSrtTimestamp,
  buildSrtFromSegments,
  translateSubtitles,
  downloadSrtFile,
  getSubtitleFileName,
} from '../../services/subtitleService.ts';
import { notify } from '../../services/toastService.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

export interface SubtitleDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: HighlightSegment[];
  introDuration?: number;
  bridgeDurationMap?: Record<string, number>;
  videoTitle?: string;
}

export const SubtitleDownloadModal: React.FC<SubtitleDownloadModalProps> = ({
  isOpen,
  onClose,
  segments,
  introDuration = 0,
  bridgeDurationMap,
  videoTitle = 'highlight',
}) => {
  const { dict, locale: currentAppLocale, interpolate } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector:
      '.subtitle-modal-body, .subtitle-cues-list, .subtitle-lang-grid, [data-modal-scrollable="true"]',
  });

  const [selectedLocale, setSelectedLocale] = useState<Locale>(currentAppLocale);
  const [translationsCache, setTranslationsCache] = useState<
    Partial<Record<Locale, Record<string, string>>>
  >({});
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedLocale(currentAppLocale);
      // Pre-fill current app locale with existing segment texts
      const initialMap: Record<string, string> = {};
      segments.forEach((s) => {
        initialMap[s.id] = (s.subtitleTitle || s.reason || '').trim();
      });
      setTranslationsCache((prev) => ({
        ...prev,
        [currentAppLocale]: initialMap,
      }));
    }
  }, [isOpen, currentAppLocale, segments]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Translation trigger when locale changes
  const fetchTranslationForLocale = useCallback(
    async (targetLoc: Locale) => {
      if (translationsCache[targetLoc]) return;

      const rawTexts = segments.map((s) => (s.subtitleTitle || s.reason || '').trim());
      setIsTranslating(true);
      try {
        const translatedArray = await translateSubtitles(rawTexts, targetLoc);
        const newMap: Record<string, string> = {};
        segments.forEach((s, idx) => {
          newMap[s.id] = translatedArray[idx] || rawTexts[idx];
        });
        setTranslationsCache((prev) => ({
          ...prev,
          [targetLoc]: newMap,
        }));
      } catch (err) {
        console.error('Translation error:', err);
      } finally {
        setIsTranslating(false);
      }
    },
    [segments, translationsCache]
  );

  const handleSelectLocale = (loc: Locale) => {
    setSelectedLocale(loc);
    if (!translationsCache[loc]) {
      void fetchTranslationForLocale(loc);
    }
  };

  // Current translation mapping
  const currentTranslations = useMemo(() => {
    return translationsCache[selectedLocale] || {};
  }, [translationsCache, selectedLocale]);

  // Generate current SRT content
  const currentSrtContent = useMemo(() => {
    return buildSrtFromSegments(segments, introDuration, currentTranslations, bridgeDurationMap);
  }, [segments, introDuration, currentTranslations, bridgeDurationMap]);

  // Copy to clipboard
  const handleCopySrt = async () => {
    try {
      await navigator.clipboard.writeText(currentSrtContent);
      setCopiedToast(true);
      notify.success(dict.toasts.subtitleCopied);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
      notify.error(dict.toasts.clipboardCopyFailed);
    }
  };

  // Download selected locale
  const handleDownloadSelected = () => {
    const fileName = getSubtitleFileName(videoTitle, selectedLocale);
    downloadSrtFile(currentSrtContent, fileName);
    notify.success(dict.toasts.subtitleDownloaded);
  };

  // Download all 7 languages
  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      for (const locInfo of LOCALES) {
        let trans: Record<string, string> = translationsCache[locInfo.code] || {};
        if (Object.keys(trans).length === 0) {
          const rawTexts = segments.map((s) => (s.subtitleTitle || s.reason || '').trim());
          const translatedArray = await translateSubtitles(rawTexts, locInfo.code);
          const newTrans: Record<string, string> = {};
          segments.forEach((s, idx) => {
            newTrans[s.id] = translatedArray[idx] || rawTexts[idx];
          });
          trans = newTrans;
          setTranslationsCache((prev) => ({ ...prev, [locInfo.code]: newTrans }));
        }

        const srt = buildSrtFromSegments(segments, introDuration, trans, bridgeDurationMap);
        const fileName = getSubtitleFileName(videoTitle, locInfo.code);
        downloadSrtFile(srt, fileName);
        // Small delay between browser downloads
        await new Promise((r) => setTimeout(r, 250));
      }
      notify.success(dict.toasts.subtitleAllDownloaded);
    } catch (err) {
      console.error('Download all failed:', err);
      notify.error(dict.toasts.subtitleDownloadFailed);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  if (!isOpen) return null;

  const selectedLocaleInfo = LOCALES.find((l) => l.code === selectedLocale) || LOCALES[0];

  // Timeline preview cues
  let offsetAcc = Math.max(0, introDuration);
  const previewCues = segments.map((seg, idx) => {
    offsetAcc += Math.max(0, bridgeDurationMap?.[seg.id] || 0);
    const startSec = offsetAcc;
    const endSec = offsetAcc + seg.duration;
    offsetAcc = endSec;
    const text = currentTranslations[seg.id] ?? (seg.subtitleTitle || seg.reason || '');
    return {
      index: idx + 1,
      startFormatted: formatSrtTimestamp(startSec),
      endFormatted: formatSrtTimestamp(endSec),
      text,
      duration: seg.duration,
    };
  });

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop"
      onClick={onClose}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="model-modal-card subtitle-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subtitle-modal-title"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
              <Subtitles size={22} />
            </div>
            <div className="model-modal-titles">
              <h2 id="subtitle-modal-title" className="model-modal-title">
                {dict.subtitleDownload?.modalTitle || '자막 다운로드 (SRT)'}
              </h2>
              <p className="model-modal-subtitle">
                {dict.subtitleDownload?.modalSubtitle ||
                  '유튜브 및 영상 플랫폼에 바로 업로드할 수 있는 호환 자막 파일이에요'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="subtitle-modal-body">
          {/* Language Selector Tabs */}
          <div className="subtitle-lang-section">
            <div className="subtitle-section-header">
              <span className="subtitle-section-title">
                <Globe size={15} className="text-slate-900" />
                <span>{dict.subtitleDownload?.selectLanguage || '다운로드할 언어 선택'}</span>
              </span>
              <span className="subtitle-youtube-badge">
                <Check size={12} className="text-emerald-500" />
                <span>{dict.subtitleDownload?.compatibleBadge || 'YouTube 100% 호환'}</span>
              </span>
            </div>

            <div className="subtitle-lang-grid">
              {LOCALES.map((locInfo: LocaleInfo) => {
                const isSelected = locInfo.code === selectedLocale;
                return (
                  <button
                    key={locInfo.code}
                    type="button"
                    className={`subtitle-lang-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectLocale(locInfo.code)}
                  >
                    <span className="subtitle-lang-flag">{locInfo.flag}</span>
                    <span className="subtitle-lang-name">{locInfo.nativeName}</span>
                    <span className="subtitle-lang-code">({locInfo.code})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtitle Preview Section */}
          <div className="subtitle-preview-section">
            <div className="subtitle-preview-header">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-slate-600" />
                <span className="font-semibold text-slate-800 text-sm">
                  {dict.subtitleDownload?.previewTitle || '자막 타임라인 미리보기'}
                </span>
                <span className="toss-tag-gray text-xs">
                  {interpolate(dict.subtitleDownload?.totalCues || '{count}개 구간 자막', {
                    count: segments.length,
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isTranslating && (
                  <span className="subtitle-translating-badge">
                    <Loader2 size={12} className="animate-spin text-slate-900" />
                    <span>{dict.subtitleDownload?.translating || '번역 중...'}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="toss-btn-micro"
                  onClick={handleCopySrt}
                  title={dict.subtitleDownload?.copySrt || 'SRT'}
                >
                  {copiedToast ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-600 font-bold">{dict.community?.copiedToast || '복사 완료!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>{dict.subtitleDownload?.copySrt || 'SRT 복사'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Cue Cards Container */}
            <div
              className="subtitle-cues-list"
              data-modal-scrollable="true"
              onTouchMove={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              {segments.length === 0 ? (
                <div className="toss-empty-state py-8">
                  <p className="text-slate-400 text-sm">
                    {dict.dramaticClips.emptyNotice || '등록된 극적 구간이 없습니다.'}
                  </p>
                </div>
              ) : (
                previewCues.map((cue) => (
                  <div key={cue.index} className="subtitle-cue-item">
                    <div className="subtitle-cue-meta">
                      <span className="subtitle-cue-index">#{cue.index}</span>
                      <div className="subtitle-cue-time">
                        <Clock size={11} className="text-slate-400" />
                        <span>
                          {cue.startFormatted.slice(3)} &rarr; {cue.endFormatted.slice(3)}
                        </span>
                        <span className="subtitle-cue-duration">({cue.duration.toFixed(1)}s)</span>
                      </div>
                    </div>
                    <div className="subtitle-cue-text">
                      {isTranslating && !currentTranslations[segments[cue.index - 1]?.id] ? (
                        <div className="subtitle-cue-skeleton" />
                      ) : (
                        cue.text || (
                          <span className="text-slate-400 italic">
                            {dict.subtitleDownload?.noSubtitleText || '(자막 내용 없음)'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* YouTube Guide Tip */}
            <div className="subtitle-guide-tip">
              <Sparkles size={14} className="text-slate-900 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                {dict.subtitleDownload?.youtubeNotice || (
                  <>
                    <strong>유튜브 업로드 팁:</strong> 유튜브 스튜디오의 동영상 세부정보 &gt; <strong>자막</strong> 탭에서 <strong>파일 업로드(타이밍 포함)</strong>를 선택한 뒤 다운로드한 <code>.srt</code> 파일을 등록하면 다국어 자막이 완벽하게 동기화됩니다.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="model-modal-footer subtitle-modal-footer">
          <button
            type="button"
            className="toss-modal-btn-close"
            onClick={onClose}
          >
            {dict.common.close}
          </button>

          <button
            type="button"
            className="toss-btn-secondary"
            onClick={handleDownloadAll}
            disabled={segments.length === 0 || isDownloadingAll}
            title={dict.subtitleDownload?.downloadAllBtn || '모든 언어 일괄 다운로드'}
          >
            <Download size={15} />
            <span>
              {isDownloadingAll
                ? (dict.subtitleDownload?.downloading || dict.common.loading || '다운로드 중...')
                : (dict.subtitleDownload?.downloadAllBtn || '모든 언어 일괄 다운로드 (7개)')}
            </span>
          </button>

          <button
            type="button"
            className="toss-btn-primary"
            onClick={handleDownloadSelected}
            disabled={segments.length === 0 || isTranslating}
            style={{ minWidth: '190px' }}
          >
            <Download size={16} />
            <span>
              {selectedLocaleInfo.flag} {selectedLocaleInfo.nativeName} {dict.subtitleDownload?.buttonText || '자막 (.srt)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubtitleDownloadModal;
