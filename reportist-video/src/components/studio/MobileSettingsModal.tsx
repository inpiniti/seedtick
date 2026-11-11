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
  AlertTriangle,
  MessageSquare,
  Trash2,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import type { FreeModelMeta } from '../../types/gateway.ts';
import type { ExportResolution, SubtitleTone } from '../../types/video.ts';
import {
  getStoredSubtitleTone,
  setStoredSubtitleTone,
} from '../../services/subtitleRefineService.ts';
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
  clearAllAppStorage,
  formatBytes,
  type StorageEstimateInfo,
  type StorageMode,
} from '../../services/storageQuotaService.ts';
import { isOpfsAvailable } from '../../services/opfsStorage.ts';
import { detectOptimalCodec } from '../../services/videoCompressor.ts';
import { CURRENT_APP_VERSION } from '../../data/patchNotes.ts';

export interface MobileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModelModal: () => void;
  onOpenLanguageModal: () => void;
  onOpenFeedbackModal?: () => void;
  onOpenPatchNotesModal?: () => void;
  onOpenDateFormatModal?: () => void;
  currentDateFormat?: DateFormatOption;
  showDate?: boolean;
  onToggleShowDate?: (enabled: boolean) => void;
  autoSortByRecordedDate?: boolean;
  onToggleAutoSortByRecordedDate?: (enabled: boolean) => void;
  showAge?: boolean;
  onToggleShowAge?: (enabled: boolean) => void;
  birthDate?: string;
  onChangeBirthDate?: (dateStr: string) => void;
  referenceDate?: Date;
  showSubtitle?: boolean;
  onToggleShowSubtitle?: (enabled: boolean) => void;
  showChapterBridge?: boolean;
  onToggleShowChapterBridge?: (enabled: boolean) => void;
  currentSubtitleTone?: SubtitleTone;
  onSelectSubtitleTone?: (tone: SubtitleTone) => void;
  selectedResolution?: ExportResolution;
  onSelectResolution?: (res: ExportResolution) => void;
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
  onOpenFeedbackModal,
  onOpenPatchNotesModal,
  onOpenDateFormatModal,
  currentDateFormat,
  showDate = true,
  onToggleShowDate,
  autoSortByRecordedDate = false,
  onToggleAutoSortByRecordedDate,
  showAge = false,
  onToggleShowAge,
  birthDate = '',
  onChangeBirthDate,
  referenceDate,
  showSubtitle = true,
  onToggleShowSubtitle,
  showChapterBridge = true,
  onToggleShowChapterBridge,
  currentSubtitleTone,
  onSelectSubtitleTone,
  selectedResolution = '1080p',
  onSelectResolution,
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
  const [isClearingStorage, setIsClearingStorage] = useState<boolean>(false);
  const [storageClearMessage, setStorageClearMessage] = useState<string | null>(null);

  const [activeTone, setActiveTone] = useState<SubtitleTone>(
    currentSubtitleTone || getStoredSubtitleTone()
  );

  useEffect(() => {
    if (currentSubtitleTone) {
      setActiveTone(currentSubtitleTone);
    } else if (isOpen) {
      setActiveTone(getStoredSubtitleTone());
    }
  }, [currentSubtitleTone, isOpen]);

  const handleToneChange = (tone: SubtitleTone) => {
    setActiveTone(tone);
    setStoredSubtitleTone(tone);
    onSelectSubtitleTone?.(tone);
  };

  const toneOptions: Array<{ id: SubtitleTone; label: string; desc: string; icon: string }> = [
    {
      id: 'vlog',
      label: dict.dramaticClips?.toneVlog || '감성 브이로그',
      desc: dict.dramaticClips?.toneVlogDesc || '1인칭 감성, 일상의 따뜻한 분위기와 여운',
      icon: '🌿',
    },
    {
      id: 'shorts',
      label: dict.dramaticClips?.toneShorts || '텐션 UP 쇼츠',
      desc: dict.dramaticClips?.toneShortsDesc || '짧고 굵은 리액션, 위트와 감탄사',
      icon: '⚡',
    },
    {
      id: 'natural',
      label: dict.dramaticClips?.toneNatural || '자연스러운 구어체',
      desc: dict.dramaticClips?.toneNaturalDesc || '대화하듯 편안한 ~해요/~했어 어조',
      icon: '💬',
    },
    {
      id: 'minimal',
      label: dict.dramaticClips?.toneMinimal || '담백한 일상',
      desc: dict.dramaticClips?.toneMinimalDesc || '군더더기 없는 깔끔한 상황 요약',
      icon: '📝',
    },
  ];

  useEffect(() => {
    if (isOpen) {
      void getStorageEstimate().then((info) => {
        setStorageEstimate(info);
        setIsPersisted(info.isPersisted);
      });
      setStorageMode(getStoredStorageMode());
      setStorageClearMessage(null);
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

  const handleClearStorage = async () => {
    setIsClearingStorage(true);
    setStorageClearMessage(null);
    try {
      const updated = await clearAllAppStorage();
      setStorageEstimate(updated);
      setStorageClearMessage(dict.settingsModal?.storageClearSuccess || 'OPFS 임시 파일 및 캐시가 모두 정리되었습니다.');
      setTimeout(() => {
        setStorageClearMessage(null);
      }, 4000);
    } finally {
      setIsClearingStorage(false);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 id="settings-modal-title" className="model-modal-title" style={{ margin: 0 }}>
                  {dict.settingsModal?.title || dict.common.settings || '스튜디오 설정'}
                </h2>
                <span className="toss-version-badge">
                  v{CURRENT_APP_VERSION}
                </span>
              </div>
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

          {/* Group 3: Date & Order Settings */}
          {(onOpenDateFormatModal || onToggleShowDate || onToggleAutoSortByRecordedDate) && (
            <div className="settings-modal-group">
              <span className="settings-modal-group-title">
                {dict.settingsModal?.dateSection || '촬영 날짜 및 정렬'}
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
              {onToggleAutoSortByRecordedDate && (
                <div className="settings-modal-card-box" style={{ marginBottom: 8 }}>
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        <ArrowUpDown size={18} />
                      </div>
                      <div className="settings-modal-item-text">
                        <div className="settings-modal-item-title">
                          {dict.settingsModal?.autoSortByRecordedDate || '촬영일시 순 기본 정렬'}
                        </div>
                        <div className="settings-modal-item-desc">
                          {dict.settingsModal?.autoSortByRecordedDateDesc ||
                            '클립을 타임라인에 배치할 때 촬영일시 순서대로 자동 정렬해요'}
                        </div>
                      </div>
                    </div>
                    <label className="toss-toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={autoSortByRecordedDate}
                        onChange={(e) => onToggleAutoSortByRecordedDate(e.target.checked)}
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

              {/* 자막 톤앤매너 선택 */}
              <div className="settings-modal-card-box mt-2.5 p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <div
                    className="settings-modal-icon-badge"
                    style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div className="settings-modal-item-text">
                    <div className="settings-modal-item-title">
                      {dict.settingsModal?.subtitleTone || '기본 자막 톤앤매너'}
                    </div>
                    <div className="settings-modal-item-desc">
                      {dict.settingsModal?.subtitleToneDesc ||
                        'AI가 자막을 생성하거나 다듬을 때 적용할 기본 말투를 설정해요'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  {toneOptions.map((opt) => {
                    const isSelected = activeTone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 shadow-sm ring-1 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                        onClick={() => handleToneChange(opt.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                          </span>
                          {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Group: 내보내기 화질 설정 (해상도) */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.resolutionSection || '내보내기 영상 화질 (해상도)'}
            </span>
            <div className="settings-modal-card-box toss-modal-res-box">
              <div className="toss-modal-res-list" role="radiogroup" aria-label="Export Resolution">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedResolution === '720p'}
                  onClick={() => onSelectResolution?.('720p')}
                  className={`toss-modal-res-item ${selectedResolution === '720p' ? 'active' : ''}`}
                >
                  <div className="toss-modal-res-item-left">
                    <div className="toss-modal-res-radio">
                      {selectedResolution === '720p' && <div className="toss-modal-res-radio-dot" />}
                    </div>
                    <div className="toss-modal-res-content">
                      <div className="toss-modal-res-title-row">
                        <span className="toss-modal-res-title">720p HD</span>
                        <span className="toss-modal-res-subbadge standard">기본</span>
                      </div>
                      <div className="toss-modal-res-desc">
                        {dict.settingsModal?.resolution720pDesc || '인코딩이 빠르고 모든 기기에서 안정적이에요'}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedResolution === '1080p'}
                  onClick={() => onSelectResolution?.('1080p')}
                  className={`toss-modal-res-item ${selectedResolution === '1080p' ? 'active' : ''}`}
                >
                  <div className="toss-modal-res-item-left">
                    <div className="toss-modal-res-radio">
                      {selectedResolution === '1080p' && <div className="toss-modal-res-radio-dot" />}
                    </div>
                    <div className="toss-modal-res-content">
                      <div className="toss-modal-res-title-row">
                        <span className="toss-modal-res-title">1080p FHD</span>
                        <span className="toss-modal-res-subbadge desktop">
                          {dict.settingsModal?.resolutionDesktopBadge || '데스크탑 권장'}
                        </span>
                      </div>
                      <div className="toss-modal-res-desc">
                        {dict.settingsModal?.resolution1080pDesc || '더 선명하고 또렷한 고해상도로 내보내요'}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* 모바일 1080p 선택 시 경고 안내 */}
              {selectedResolution === '1080p' && (
                <div className="toss-modal-res-warning">
                  <AlertTriangle size={15} className="toss-modal-res-warning-icon" />
                  <span className="toss-modal-res-warning-text">
                    {dict.settingsModal?.resolutionMobileWarning ||
                      '모바일 기기에서는 영상 길이에 따라 브라우저 메모리 부족으로 튕길 수 있어요.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Group: Storage & Persistence Settings (스토리지 엔진 및 보관 설정) */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.storageSection || '저장소 및 보관 설정'}
            </span>
            <div className="settings-modal-card-box toss-storage-card">
              {/* 1. 스토리지 엔진 및 가용 공간 */}
              <div className="toss-storage-header">
                <div className="toss-storage-header-left">
                  <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                    <HardDrive size={18} />
                  </div>
                  <div className="toss-storage-title-wrap">
                    <div className="toss-storage-title-row">
                      <span className="toss-storage-engine-title">
                        {opfsSupported
                          ? dict.settingsModal?.storageEngineOpfs || 'OPFS 가상 파일시스템'
                          : dict.settingsModal?.storageEngineIdb || 'IndexedDB 로컬 스토리지'}
                      </span>
                      {optimalCodec && (
                        <span className="toss-storage-badge-codec">
                          {optimalCodec.name.toUpperCase()} {dict.settingsModal?.storageCodecSupport || '지원'}
                        </span>
                      )}
                    </div>
                    <div className="toss-storage-quota-desc">
                      {storageEstimate
                        ? (dict.settingsModal?.storageUsageInfo
                            ? dict.settingsModal.storageUsageInfo
                                .replace('{used}', formatBytes(storageEstimate.usageBytes))
                                .replace('{available}', formatBytes(storageEstimate.availableBytes))
                            : `사용 중: ${formatBytes(storageEstimate.usageBytes)} · 남은 공간: ${formatBytes(storageEstimate.availableBytes)}`)
                        : dict.settingsModal?.storageMeasuring || '스토리지 사용량 측정 중...'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 스토리지 사용량 게이지 바 */}
              {storageEstimate && storageEstimate.quotaBytes > 0 && (
                <div className="toss-storage-bar-container">
                  <div className="toss-storage-bar-track">
                    <div
                      className={`toss-storage-bar-fill ${storageEstimate.isLowStorage ? 'danger' : ''}`}
                      style={{ width: `${Math.min(100, Math.max(3, storageEstimate.percentUsed))}%` }}
                    />
                  </div>
                  <div className="toss-storage-bar-label">
                    <span>
                      {dict.settingsModal?.storageBarLabel
                        ? dict.settingsModal.storageBarLabel
                            .replace('{quota}', formatBytes(storageEstimate.quotaBytes))
                            .replace('{percent}', String(storageEstimate.percentUsed))
                        : `전체 ${formatBytes(storageEstimate.quotaBytes)} 중 ${storageEstimate.percentUsed}% 사용 중`}
                    </span>
                    {storageEstimate.isLowStorage && (
                      <span className="toss-storage-low-warning">
                        {dict.settingsModal?.storageLowWarning || '저장 공간 부족'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 2. 영구 보존 상태 및 권한 요청 */}
              <div className={`toss-storage-persist-row ${isPersisted ? 'persisted' : ''}`}>
                <div className="toss-storage-persist-left">
                  {isPersisted ? (
                    <ShieldCheck size={18} className="toss-icon-persisted" />
                  ) : (
                    <ShieldAlert size={18} className="toss-icon-temporary" />
                  )}
                  <div className="toss-storage-persist-text">
                    <div className="toss-storage-persist-title">
                      {isPersisted
                        ? dict.settingsModal?.persistProtectedTitle || '영구 보존 중 (브라우저 자동 삭제 방지)'
                        : dict.settingsModal?.persistTemporaryTitle || '임시 보관 (캐시 정리 시 삭제 위험)'}
                    </div>
                    <div className="toss-storage-persist-desc">
                      {isPersisted
                        ? dict.settingsModal?.persistProtectedDesc || '용량이 부족해도 브라우저가 임의로 프로젝트를 지우지 않아요'
                        : dict.settingsModal?.persistTemporaryDesc || '기기 용량 부족 시 브라우저 정책에 의해 캐시가 삭제될 수 있어요'}
                    </div>
                  </div>
                </div>
                {!isPersisted ? (
                  <button
                    type="button"
                    onClick={handleRequestPersist}
                    disabled={isRequestingPersist}
                    className="toss-storage-persist-btn"
                  >
                    {isRequestingPersist
                      ? dict.settingsModal?.persistChecking || '확인 중...'
                      : dict.settingsModal?.persistRequestBtn || '영구 보존 요청'}
                  </button>
                ) : (
                  <span className="toss-storage-persist-badge">
                    {dict.settingsModal?.persistBadge || '보호 중'}
                  </span>
                )}
              </div>

              {/* 3. 보관 모드 선택 */}
              <div className="toss-storage-mode-group">
                <div className="toss-storage-mode-title">
                  {dict.settingsModal?.storageModeTitle || '보관 모드'}
                </div>
                <div className="toss-storage-mode-grid">
                  <button
                    type="button"
                    onClick={() => handleSelectStorageMode('auto')}
                    className={`toss-storage-mode-btn ${storageMode === 'auto' ? 'active' : ''}`}
                  >
                    <div className="toss-storage-mode-name">
                      {dict.settingsModal?.storageModeAuto || '자동 (권장)'}
                    </div>
                    <div className="toss-storage-mode-sub">
                      {dict.settingsModal?.storageModeAutoDesc || '용량 맞춤 최적화'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectStorageMode('full')}
                    className={`toss-storage-mode-btn ${storageMode === 'full' ? 'active' : ''}`}
                  >
                    <div className="toss-storage-mode-name">
                      {dict.settingsModal?.storageModeFull || '전체 보관'}
                    </div>
                    <div className="toss-storage-mode-sub">
                      {dict.settingsModal?.storageModeFullDesc || '원본 비디오 보관'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectStorageMode('lightweight')}
                    className={`toss-storage-mode-btn ${storageMode === 'lightweight' ? 'active' : ''}`}
                  >
                    <div className="toss-storage-mode-name">
                      {dict.settingsModal?.storageModeLight || '초경량 모드'}
                    </div>
                    <div className="toss-storage-mode-sub">
                      {dict.settingsModal?.storageModeLightDesc || '용량 99% 절약'}
                    </div>
                  </button>
                </div>
              </div>

              {/* 4. 저장 공간 정리 (캐시 및 OPFS 잔여 파일 완전 비우기) */}
              <div
                className="toss-storage-clear-row"
                style={{
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                      {dict.settingsModal?.storageClearBtn || '저장 공간 정리 (캐시 비우기)'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35 }}>
                      {dict.settingsModal?.storageClearHint || '보관함을 비워도 브라우저 리소스 캐시가 남아있을 수 있어요. 필요할 때 즉시 정리할 수 있어요.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearStorage}
                    disabled={isClearingStorage}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      padding: '6px 12px',
                      flexShrink: 0,
                      borderRadius: '8px',
                      border: '1px solid #ffe4e6',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isClearingStorage ? '#94a3b8' : '#e11d48',
                      backgroundColor: '#fff1f2',
                      cursor: isClearingStorage ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>
                      {isClearingStorage
                        ? dict.settingsModal?.storageClearing || '정리 중...'
                        : '정리하기'}
                    </span>
                  </button>
                </div>
                {storageClearMessage && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '11.5px',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 500,
                    }}
                  >
                    <ShieldCheck size={14} />
                    <span>{storageClearMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Group: Feedback & Customer Support / Updates */}
          {(onOpenFeedbackModal || onOpenPatchNotesModal) && (
            <div className="settings-modal-group">
              <span className="settings-modal-group-title">
                {dict.settingsModal?.supportSection || '고객 지원 및 업데이트'}
              </span>

              {onOpenFeedbackModal && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onOpenFeedbackModal();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#3182f6' }}>
                      <MessageSquare size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.feedback?.headerTitle || '피드백 & 개선 요청'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.feedback?.headerDesc || '불편사항이나 필요한 기능을 남겨주시면 개발자가 답변해드려요'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span style={{ color: '#3182f6', fontWeight: 600 }}>
                      {dict.feedback?.openBoard || '게시판 열기'}
                    </span>
                    <ChevronRight size={15} color="#3182f6" />
                  </div>
                </button>
              )}

              {onOpenPatchNotesModal && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onOpenPatchNotesModal();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                      <Sparkles size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{dict.patchNotes?.title || '패치 노트'}</span>
                        <span className="toss-version-badge">v{CURRENT_APP_VERSION}</span>
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.patchNotes?.desc || '지금까지의 기능 추가 및 업데이트 내역을 확인해요'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                      {dict.patchNotes?.viewHistory || '내역 보기'}
                    </span>
                    <ChevronRight size={15} color="#16a34a" />
                  </div>
                </button>
              )}
            </div>
          )}

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
