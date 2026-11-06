import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Sparkles,
  Globe,
  Calendar,
  RotateCcw,
  Image as ImageIcon,
  ChevronRight,
  X,
  Zap,
  Scissors,
  Baby,
  Subtitles,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  Database,
  Layers,
} from 'lucide-react';
import type { FreeModelMeta } from '../../types/gateway.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import {
  formatDateByPattern,
  formatDateWithAge,
  type DateFormatOption,
} from '../../services/videoMetadata.ts';
import { cleanModelName, getSpeedTier } from '../../services/modelMetrics.ts';
import { useI18n } from '../../i18n/index.tsx';
import {
  getStorageEstimate,
  requestPersistentStorage,
  getStoredStorageMode,
  setStoredStorageMode,
  formatBytes,
  type StorageEstimateInfo,
  type StorageMode,
} from '../../services/storageQuotaService.ts';
import { isOpfsAvailable } from '../../services/opfsStorage.ts';
import { detectOptimalCodec } from '../../services/videoCompressor.ts';

export interface MobileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModelModal: () => void;
  onOpenLanguageModal: () => void;
  onOpenDateFormatModal?: () => void;
  currentDateFormat?: DateFormatOption;
  showDate?: boolean;
  onToggleShowDate?: (enabled: boolean) => void;
  showAge?: boolean;
  onToggleShowAge?: (enabled: boolean) => void;
  birthDate?: string;
  onChangeBirthDate?: (dateStr: string) => void;
  referenceDate?: Date;
  showSubtitle?: boolean;
  onToggleShowSubtitle?: (enabled: boolean) => void;
  showChapterBridge?: boolean;
  onToggleShowChapterBridge?: (enabled: boolean) => void;
  currentModel?: FreeModelMeta;
  isLoadingModels?: boolean;
  currentLocaleInfo: { flag: string; nativeName: string; name: string };
  hasVideos: boolean;
  onReset?: () => void;
  hasStitchedResult: boolean;
  onDownloadThumbnail?: () => void;
  onDownloadSubtitles?: () => void;
  onReStitch?: () => void;
  isReStitching?: boolean;
  reStitchProgress?: {
    progressPercent: number;
    statusMessage: string;
  };
}

export const MobileSettingsModal: React.FC<MobileSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenModelModal,
  onOpenLanguageModal,
  onOpenDateFormatModal,
  currentDateFormat,
  showDate = true,
  onToggleShowDate,
  showAge = false,
  onToggleShowAge,
  birthDate = '',
  onChangeBirthDate,
  referenceDate,
  showSubtitle = true,
  onToggleShowSubtitle,
  showChapterBridge = true,
  onToggleShowChapterBridge,
  currentModel,
  isLoadingModels,
  currentLocaleInfo,
  hasVideos,
  onReset,
  hasStitchedResult,
  onDownloadThumbnail,
  onDownloadSubtitles,
  onReStitch,
  isReStitching,
  reStitchProgress,
}) => {
  const { dict } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.settings-modal-body, [data-modal-scrollable="true"]',
  });

  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateInfo | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>(getStoredStorageMode());
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [isRequestingPersist, setIsRequestingPersist] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      void getStorageEstimate().then((info) => {
        setStorageEstimate(info);
        setIsPersisted(info.isPersisted);
      });
      setStorageMode(getStoredStorageMode());
    }
  }, [isOpen]);

  const handleRequestPersist = async () => {
    setIsRequestingPersist(true);
    try {
      const ok = await requestPersistentStorage();
      setIsPersisted(ok);
      const updated = await getStorageEstimate();
      setStorageEstimate(updated);
    } finally {
      setIsRequestingPersist(false);
    }
  };

  const handleSelectStorageMode = (mode: StorageMode) => {
    setStorageMode(mode);
    setStoredStorageMode(mode);
  };

  const optimalCodec = detectOptimalCodec();
  const opfsSupported = isOpfsAvailable();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSpeedTier = currentModel ? getSpeedTier(currentModel.speedTokensPerSecond) : null;
  const sampleDate = referenceDate || new Date();
  const sampleBaseDateStr = formatDateByPattern(sampleDate, currentDateFormat || 'YYYY.MM.DD');
  const previewFormattedAge = birthDate.trim()
    ? formatDateWithAge(sampleBaseDateStr, sampleDate, true, birthDate)
    : '';

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
        className="model-modal-card settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Settings size={22} color="#3182f6" />
            </div>
            <div className="model-modal-titles">
              <h2 id="settings-modal-title" className="model-modal-title">
                {dict.settingsModal?.title || dict.common.settings || '스튜디오 설정'}
              </h2>
              <p className="model-modal-subtitle">
                {dict.settingsModal?.subtitle || 'AI 모델 및 환경설정을 관리해요'}
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

        {/* Modal Body */}
        <div
          className="settings-modal-body"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Group 1: AI Model */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.aiEngine || 'AI Engine'}
            </span>
            <button
              type="button"
              className="settings-modal-item"
              onClick={() => {
                onClose();
                onOpenModelModal();
              }}
            >
              <div className="settings-modal-item-left">
                <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <Sparkles size={18} />
                </div>
                <div className="settings-modal-item-text">
                  <div className="settings-modal-item-title">{dict.header.aiModel}</div>
                  <div className="settings-modal-item-desc">
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      {isLoadingModels
                        ? dict.header.loadingModels
                        : cleanModelName(currentModel?.name) || dict.header.selectModel}
                    </span>
                    {currentModel?.speedTokensPerSecond != null && currentSpeedTier && (
                      <span className={`toss-model-trigger-speed ${currentSpeedTier.key}`} style={{ fontSize: '10px' }}>
                        <Zap size={9} />
                        {Math.round(currentModel.speedTokensPerSecond)} tok/s
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="settings-modal-item-action">
                <span>{dict.common.edit || '변경'}</span>
                <ChevronRight size={15} color="#94a3b8" />
              </div>
            </button>
          </div>

          {/* Group 2: Language */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.language || dict.common.language || 'Language'}
            </span>
            <button
              type="button"
              className="settings-modal-item"
              onClick={() => {
                onClose();
                onOpenLanguageModal();
              }}
            >
              <div className="settings-modal-item-left">
                <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                  <Globe size={18} />
                </div>
                <div className="settings-modal-item-text">
                  <div className="settings-modal-item-title">{dict.common.language || 'Language'}</div>
                  <div className="settings-modal-item-desc">
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{currentLocaleInfo.flag}</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{currentLocaleInfo.nativeName}</span>
                  </div>
                </div>
              </div>
              <div className="settings-modal-item-action">
                <span>{dict.common.edit || '변경'}</span>
                <ChevronRight size={15} color="#94a3b8" />
              </div>
            </button>
          </div>

          {/* Group 3: Date Format */}
          {(onOpenDateFormatModal || onToggleShowDate) && (
            <div className="settings-modal-group">
              <span className="settings-modal-group-title">
                {dict.settingsModal?.dateSection || '촬영 날짜'}
              </span>
              {onToggleShowDate && (
                <div className="settings-modal-card-box" style={{ marginBottom: 8 }}>
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        <Calendar size={18} />
                      </div>
                      <div className="settings-modal-item-text">
                        <div className="settings-modal-item-title">
                          {dict.settingsModal?.showDateOption || '촬영 날짜 표시'}
                        </div>
                        <div className="settings-modal-item-desc">
                          {dict.settingsModal?.showDateOptionDesc ||
                            '영상 화면에 촬영 날짜를 표시해요 (끄면 날짜 없이 장소만 표시)'}
                        </div>
                      </div>
                    </div>
                    <label className="toss-toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showDate}
                        onChange={(e) => onToggleShowDate(e.target.checked)}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>
                </div>
              )}
              {onOpenDateFormatModal && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onOpenDateFormatModal();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div
                      className="settings-modal-icon-badge"
                      style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                    >
                      <Calendar size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.settingsModal?.dateFormat || '촬영 날짜 표기 형식'}
                      </div>
                      <div className="settings-modal-item-desc">
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#1e293b',
                            fontFamily: 'monospace',
                            letterSpacing: '-0.3px',
                          }}
                        >
                          {currentDateFormat || 'YYYY.MM.DD'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>{dict.common.edit || '변경'}</span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Group 4: Child Age Display (아이 나이 표시) */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.ageOption || '아이 나이 표시'}
            </span>
            <div className="settings-modal-card-box">
              <div className="settings-modal-toggle-row">
                <div className="settings-modal-item-left">
                  <div
                    className="settings-modal-icon-badge"
                    style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}
                  >
                    <Baby size={18} />
                  </div>
                  <div className="settings-modal-item-text">
                    <div className="settings-modal-item-title">
                      {dict.settingsModal?.ageOption || '아이 나이 표시'}
                    </div>
                    <div className="settings-modal-item-desc">
                      {dict.settingsModal?.ageOptionDesc || '촬영 날짜 옆에 만 나이(2살 미만은 개월수)를 함께 표시해요'}
                    </div>
                  </div>
                </div>
                <label className="toss-toggle-switch" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showAge}
                    onChange={(e) => onToggleShowAge?.(e.target.checked)}
                  />
                  <span className="toss-toggle-slider" />
                </label>
              </div>

              {/* 생년월일 입력창 (나이 표시 켰을 때만 노출) */}
              {showAge && (
                <div className="settings-age-input-section">
                  <div className="settings-age-input-row">
                    <label className="settings-age-input-label">
                      <Calendar size={13} className="text-pink-500" />
                      <span>{dict.settingsModal?.birthDateLabel || '생년월일'}</span>
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => onChangeBirthDate?.(e.target.value)}
                      className="settings-age-date-input"
                      max={new Date().toISOString().split('T')[0]}
                      placeholder={dict.settingsModal?.birthDatePlaceholder || 'YYYY-MM-DD'}
                    />
                  </div>

                  {/* 실시간 미리보기 뱃지 */}
                  <div className="settings-age-preview-badge">
                    <span className="settings-age-preview-label">
                      {dict.settingsModal?.agePreviewLabel || '미리보기'}
                    </span>
                    <span className="settings-age-preview-value">
                      {previewFormattedAge || (dict.settingsModal?.birthDatePrompt || '생년월일을 입력하면 날짜 옆에 나이가 표시돼요')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Group 5: Subtitle & Chapter Bridge Display (영상 자막 및 챕터 브릿지 표시) */}
          {(onToggleShowSubtitle || onToggleShowChapterBridge) && (
            <div className="settings-modal-group">
              <span className="settings-modal-group-title">
                {dict.settingsModal?.subtitleSection || dict.settingsModal?.subtitleOption || '영상 자막 및 스토리 브릿지 설정'}
              </span>
              {onToggleShowChapterBridge && (
                <div className="settings-modal-card-box mb-2">
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        <Sparkles size={18} />
                      </div>
                      <div className="settings-modal-item-text">
                        <div className="settings-modal-item-title">
                          {dict.settingsModal?.chapterBridgeOption || '스토리 챕터 브릿지 표시'}
                        </div>
                        <div className="settings-modal-item-desc">
                          {dict.settingsModal?.chapterBridgeOptionDesc ||
                            '날짜나 장소가 바뀌는 구간 사이에 플립 시계 / 이동 경로 브릿지를 삽입해요'}
                        </div>
                      </div>
                    </div>
                    <label className="toss-toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showChapterBridge}
                        onChange={(e) => onToggleShowChapterBridge(e.target.checked)}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>
                </div>
              )}
              {onToggleShowSubtitle && (
                <div className="settings-modal-card-box">
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        <Subtitles size={18} />
                      </div>
                      <div className="settings-modal-item-text">
                        <div className="settings-modal-item-title">
                          {dict.settingsModal?.subtitleOption || '영상 자막 표시'}
                        </div>
                        <div className="settings-modal-item-desc">
                          {dict.settingsModal?.subtitleOptionDesc || '영상 화면에 씬 제목 자막을 표시해요 (꺼도 자막 다운로드는 가능해요)'}
                        </div>
                      </div>
                    </div>
                    <label className="toss-toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showSubtitle}
                        onChange={(e) => onToggleShowSubtitle(e.target.checked)}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Group: Storage & Persistence Settings (스토리지 엔진 및 보관 설정) */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              저장소 및 보관 설정 (스토리지 엔진)
            </span>
            <div className="settings-modal-card-box p-3.5 space-y-3">
              {/* 1. 용량 및 엔진 정보 */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                    <HardDrive size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {opfsSupported ? 'OPFS 가상 파일시스템' : 'IndexedDB 로컬 스토리지'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {storageEstimate
                        ? `사용 중: ${formatBytes(storageEstimate.usageBytes)} · 남은 공간: ${formatBytes(storageEstimate.availableBytes)}`
                        : '스토리지 사용량 측정 중...'}
                    </div>
                  </div>
                </div>
                {optimalCodec && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded shrink-0">
                    {optimalCodec.name.toUpperCase()} 지원
                  </span>
                )}
              </div>

              {/* 2. 영구 보존 상태 및 요청 */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <div className="flex items-center gap-2">
                  {isPersisted ? (
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                  )}
                  <span className="text-xs text-slate-700 font-medium">
                    {isPersisted
                      ? '영구 보존됨 (브라우저 자동 삭제 방지)'
                      : '임시 보관 (캐시 정리 시 삭제될 수 있음)'}
                  </span>
                </div>
                {!isPersisted && (
                  <button
                    type="button"
                    onClick={handleRequestPersist}
                    disabled={isRequestingPersist}
                    className="px-2 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0"
                  >
                    {isRequestingPersist ? '확인 중...' : '영구 보존 요청'}
                  </button>
                )}
              </div>

              {/* 3. 보관 모드 선택 */}
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1.5">보관 모드</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectStorageMode('auto')}
                    className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                      storageMode === 'auto'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>자동 (권장)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">용량 맞춤 최적화</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectStorageMode('full')}
                    className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                      storageMode === 'full'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>전체 보관</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">원본 비디오 보관</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectStorageMode('lightweight')}
                    className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                      storageMode === 'lightweight'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>초경량 모드</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">용량 99% 절약</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Group 6: Project Actions */}
          {(hasStitchedResult || hasVideos) && (
            <div className="settings-modal-group">
              <span className="settings-modal-group-title">
                {dict.settingsModal?.projectActions || 'Project Actions'}
              </span>

              {hasStitchedResult && onReStitch && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onReStitch();
                  }}
                  disabled={isReStitching}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                      <Scissors size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.header.reStitch || '영상 다시 조합'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.reStitchDesc || '수정된 타임라인으로 영상 다시 조합'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>
                      {isReStitching
                        ? `${dict.header.stitching} (${reStitchProgress?.progressPercent ?? 0}%)`
                        : (dict.common.retry || '조합')}
                    </span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              )}

              {hasStitchedResult && onDownloadThumbnail && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onDownloadThumbnail();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                      <ImageIcon size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.thumbnail?.downloadBtn || dict.header.downloadThumbnail || '썸네일 다운로드'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.thumbnailDesc || '16:9 AI 썸네일 아트워크 이미지 저장'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>{dict.header.download || '다운로드'}</span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              )}

              {(hasStitchedResult || hasVideos) && onDownloadSubtitles && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onDownloadSubtitles();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                      <Subtitles size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.settingsModal?.downloadSubtitles || dict.subtitleDownload?.buttonText || '자막 다운로드 (.srt)'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.downloadSubtitlesDesc || '유튜브 업로드용 다국어 자막 파일 다운로드'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>{dict.header.download || '다운로드'}</span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              )}

              {hasVideos && onReset && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onReset();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                      <RotateCcw size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title" style={{ color: '#dc2626' }}>
                        {dict.header.reset || '새로 시작'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.resetDesc || '업로드된 모든 영상 및 편집 타임라인 초기화'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action" style={{ color: '#dc2626' }}>
                    <span>{dict.common.confirm || '초기화'}</span>
                    <ChevronRight size={15} color="#dc2626" />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="model-modal-footer">
          <button
            type="button"
            className="toss-modal-btn-close"
            style={{ width: '100%' }}
            onClick={onClose}
          >
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export const StudioSettingsModal = MobileSettingsModal;
export default MobileSettingsModal;
