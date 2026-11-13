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
  Eye,
  Key,
  Clapperboard,
  Film,
} from 'lucide-react';
import type { FreeModelMeta } from '../../types/gateway.ts';
import { getStoredUserApiKeyConfig, getProviderPreset } from '../../services/userApiKeyService.ts';
import type {
  BridgeDateTemplateId,
  BridgeLocationTemplateId,
  ExportResolution,
  IntroTemplateId,
  OutroTemplateId,
  SubtitleTone,
} from '../../types/video.ts';
import {
  ChapterBridgePreviewModal,
  DATE_TEMPLATE_OPTIONS,
  LOCATION_TEMPLATE_OPTIONS,
} from './ChapterBridgePreviewModal.tsx';
import {
  IntroOutroPreviewModal,
} from './IntroOutroPreviewModal.tsx';
import {
  INTRO_TEMPLATE_OPTIONS,
  OUTRO_TEMPLATE_OPTIONS,
} from './introOutroOptions.ts';
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
import { notify } from '../../services/toastService.ts';
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
import {
  compactDatabase,
  wipeAllAppData,
  getAppStorageStats,
} from '../../services/projectStorage.ts';
import { isMobileStorageEnvironment } from '../../services/deviceStoragePolicy.ts';
import { detectOptimalCodec } from '../../services/videoCompressor.ts';
import { CURRENT_APP_VERSION } from '../../data/appVersion.ts';

export type SettingsSectionId =
  | 'general'
  | 'capture'
  | 'subtitles'
  | 'motion'
  | 'export'
  | 'support'
  | 'project';

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
  chapterBridgeDateTemplate?: BridgeDateTemplateId;
  chapterBridgeLocationTemplate?: BridgeLocationTemplateId;
  onChangeChapterBridgeTemplates?: (dateTpl: BridgeDateTemplateId, locTpl: BridgeLocationTemplateId) => void;
  showIntro?: boolean;
  onToggleShowIntro?: (enabled: boolean) => void;
  introTemplate?: IntroTemplateId;
  introDurationSec?: number;
  showOutro?: boolean;
  onToggleShowOutro?: (enabled: boolean) => void;
  outroTemplate?: OutroTemplateId;
  outroDurationSec?: number;
  outroText?: string;
  onChangeIntroOutroSettings?: (settings: {
    introTemplate: IntroTemplateId;
    introDurationSec: number;
    outroTemplate: OutroTemplateId;
    outroDurationSec: number;
    outroText?: string;
  }) => void;
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
  chapterBridgeDateTemplate = 'flip-clock',
  chapterBridgeLocationTemplate = 'winding-route',
  onChangeChapterBridgeTemplates,
  showIntro = true,
  onToggleShowIntro,
  introTemplate = 'kinetic-slide',
  introDurationSec = 2.0,
  showOutro = true,
  onToggleShowOutro,
  outroTemplate = 'modern-endcard',
  outroDurationSec = 2.2,
  outroText = '시청해 주셔서 감사합니다',
  onChangeIntroOutroSettings,
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
  const { dict, interpolate } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.settings-modal-body, [data-modal-scrollable="true"]',
  });

  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateInfo | null>(null);
  const [appStorageStats, setAppStorageStats] = useState<{
    projectCount: number;
    mediaCount: number;
    mediaBytes: number;
  } | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>(getStoredStorageMode());
  const isMobileDevice = isMobileStorageEnvironment();
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [isRequestingPersist, setIsRequestingPersist] = useState<boolean>(false);
  const [isClearingStorage, setIsClearingStorage] = useState<boolean>(false);
  const [isCompactingStorage, setIsCompactingStorage] = useState<boolean>(false);
  const [isWipingStorage, setIsWipingStorage] = useState<boolean>(false);
  const [storageClearMessage, setStorageClearMessage] = useState<string | null>(null);
  const [isBridgePreviewOpen, setIsBridgePreviewOpen] = useState<boolean>(false);
  const [isIntroOutroPreviewOpen, setIsIntroOutroPreviewOpen] = useState<boolean>(false);
  const [introOutroPreviewTab, setIntroOutroPreviewTab] = useState<'intro' | 'outro'>('intro');

  useEffect(() => {
    if (!isOpen) {
      setIsBridgePreviewOpen(false);
      setIsIntroOutroPreviewOpen(false);
    } else {
      setActiveSection('general');
    }
  }, [isOpen]);

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
    const opt = toneOptions.find((t) => t.id === tone);
    notify.success(`${opt?.icon || '✨'} ${opt?.label || tone}`, {
      description: dict.toasts.toneChangedDesc,
    });
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
      desc: dict.dramaticClips?.toneNaturalDesc || '대화하듯 편안한 ~해요/~했어요 어조',
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
      void getAppStorageStats()
        .then(setAppStorageStats)
        .catch(() => setAppStorageStats(null));
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
      if (ok) {
        notify.success(dict.toasts.persistGranted, {
          description: dict.toasts.persistGrantedDesc,
        });
      } else {
        notify.info(dict.toasts.persistRequested, {
          description: dict.toasts.persistRequestedDesc,
        });
      }
    } finally {
      setIsRequestingPersist(false);
    }
  };

  // 1. 캐시 정리: OPFS 잔여 파일 + CacheStorage만 비운다. (프로젝트 데이터는 유지)
  const handleClearStorage = async () => {
    setIsClearingStorage(true);
    setStorageClearMessage(null);
    try {
      await clearAllAppStorage();
      const updated = await getStorageEstimate();
      setStorageEstimate(updated);
      const successMsg = '브라우저 캐시와 OPFS 임시 파일을 정리했습니다. 프로젝트는 그대로 유지돼요.';
      setStorageClearMessage(successMsg);
      notify.success(successMsg);
      setTimeout(() => {
        setStorageClearMessage(null);
      }, 4000);
    } catch {
      notify.error(dict.settingsModal?.storageClearError || '저장공간 정리에 실패했습니다.');
    } finally {
      setIsClearingStorage(false);
    }
  };

  // 2. 저장공간 최적화(DB 압축): 프로젝트 데이터를 유지한 채 DB를 재구성해 고아 Blob/잔여 용량을 회수
  const handleCompactStorage = async () => {
    setIsCompactingStorage(true);
    setStorageClearMessage(null);
    try {
      const result = await compactDatabase();
      const updated = await getStorageEstimate();
      setStorageEstimate(updated);
      const stats = await getAppStorageStats().catch(() => null);
      setAppStorageStats(stats);
      const successMsg = `프로젝트 ${result.projectCount}개를 유지한 채 저장소를 최적화했습니다.`;
      setStorageClearMessage(successMsg);
      notify.success(successMsg);
      setTimeout(() => {
        setStorageClearMessage(null);
      }, 4000);
    } catch (err) {
      console.warn('[Settings] Storage compact failed:', err);
      notify.error('저장공간 최적화에 실패했습니다. 프로젝트를 개별 삭제해 보세요.');
    } finally {
      setIsCompactingStorage(false);
    }
  };

  // 3. 저장소 완전 비우기: 모든 프로젝트·미디어·캐시를 영구 삭제 (되돌릴 수 없음)
  const handleWipeAllStorage = async () => {
    const confirmed = window.confirm(
      '모든 프로젝트와 원본 영상, 편집 데이터가 기기에서 완전히 삭제됩니다.\n이 작업은 되돌릴 수 없습니다. 계속할까요?'
    );
    if (!confirmed) return;
    setIsWipingStorage(true);
    setStorageClearMessage(null);
    try {
      await wipeAllAppData();
      const updated = await getStorageEstimate();
      setStorageEstimate(updated);
      setAppStorageStats({ projectCount: 0, mediaCount: 0, mediaBytes: 0 });
      notify.success('저장소를 완전히 비웠습니다.');
      setStorageClearMessage('저장소를 완전히 비웠습니다.');
      // 메모리에 남은 작업 상태도 초기화해야 삭제된 데이터가 다시 저장되지 않는다.
      onReset?.();
    } catch (err) {
      console.warn('[Settings] Storage wipe failed:', err);
      notify.error('저장소를 비우는 데 실패했습니다.');
    } finally {
      setIsWipingStorage(false);
    }
  };

  const handleSelectStorageMode = (mode: StorageMode) => {
    setStorageMode(mode);
    setStoredStorageMode(mode);
    const modeLabel =
      mode === 'full'
        ? (dict.settingsModal?.storageModeFull || '전체 보관')
        : mode === 'lightweight'
          ? (dict.settingsModal?.storageModeLight || '초경량 모드')
          : (dict.settingsModal?.storageModeAuto || '자동 (권장)');
    const modeDesc =
      mode === 'full'
        ? (dict.settingsModal?.storageModeFullDesc || '원본 비디오를 기기에 안전하게 보관해요. (삭제 시 함께 지워져요)')
        : mode === 'lightweight'
          ? (dict.settingsModal?.storageModeLightDesc || '용량을 99% 절약해요.')
          : (dict.settingsModal?.storageModeAutoDesc || '남은 용량에 맞게 최적화해요.');
    notify.success(interpolate(dict.toasts.storageModeSelected, { mode: modeLabel }), {
      description: modeDesc,
    });
  };

  const handleSelectResolution = (res: ExportResolution) => {
    onSelectResolution?.(res);
    notify.success(interpolate(dict.toasts.resolutionSelected, { resolution: res }), {
      description: dict.toasts.resolutionSelectedDesc,
    });
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

  useEffect(() => {
    if (!isOpen) return;
    bodyRef.current?.scrollTo({ top: 0 });
  }, [activeSection, isOpen]);

  if (!isOpen) return null;

  const settingsSections: Array<{ id: SettingsSectionId; label: string; icon: React.ReactNode }> = [
    {
      id: 'general',
      label: dict.settingsModal?.navGeneral || 'AI · 언어',
      icon: <Sparkles size={16} />,
    },
    {
      id: 'capture',
      label: dict.settingsModal?.navCapture || '촬영 날짜 · 나이',
      icon: <Calendar size={16} />,
    },
    {
      id: 'subtitles',
      label: dict.settingsModal?.navSubtitles || '자막 · 브릿지',
      icon: <Subtitles size={16} />,
    },
    {
      id: 'motion',
      label: dict.settingsModal?.navMotion || '인트로 · 아웃트로',
      icon: <Clapperboard size={16} />,
    },
    {
      id: 'export',
      label: dict.settingsModal?.navExport || '화질 · 저장소',
      icon: <HardDrive size={16} />,
    },
    {
      id: 'support',
      label: dict.settingsModal?.navSupport || '지원 · 업데이트',
      icon: <MessageSquare size={16} />,
    },
    {
      id: 'project',
      label: dict.settingsModal?.navProject || '프로젝트',
      icon: <Layers size={16} />,
    },
  ];

  const visibleSettingsSections = settingsSections.filter((section) => {
    switch (section.id) {
      case 'subtitles':
        return Boolean(onToggleShowSubtitle || onToggleShowChapterBridge);
      case 'motion':
        return Boolean(onToggleShowIntro || onToggleShowOutro);
      case 'support':
        return Boolean(onOpenFeedbackModal || onOpenPatchNotesModal);
      case 'project':
        return Boolean(hasStitchedResult || hasVideos);
      default:
        return true;
    }
  });

  const resolvedSection = visibleSettingsSections.some((section) => section.id === activeSection)
    ? activeSection
    : visibleSettingsSections[0]?.id || 'general';

  const groupClassName = (section: SettingsSectionId) =>
    `settings-modal-group${resolvedSection === section ? '' : ' settings-modal-group--desktop-hidden'}`;

  const currentSpeedTier = currentModel ? getSpeedTier(currentModel.speedTokensPerSecond) : null;
  const sampleDate = referenceDate || new Date();
  const sampleBaseDateStr = formatDateByPattern(sampleDate, currentDateFormat || 'YYYY.MM.DD');
  const previewFormattedAge = birthDate.trim()
    ? formatDateWithAge(sampleBaseDateStr, sampleDate, true, birthDate)
    : '';

  return (
    <>
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
              <Settings size={22} color="#0f172a" />
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
        <div className="settings-modal-layout">
          <nav
            className="settings-modal-nav"
            aria-label={dict.settingsModal?.navAriaLabel || '설정 섹션'}
          >
            {visibleSettingsSections.map((section) => {
              const isActive = resolvedSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`settings-modal-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="settings-modal-nav-icon">{section.icon}</span>
                  <span className="settings-modal-nav-text">{section.label}</span>
                </button>
              );
            })}
          </nav>
          <div
            ref={bodyRef}
            className="settings-modal-body"
            data-modal-scrollable="true"
            onTouchMove={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
          {/* Group 1: AI Model */}
          <div className={groupClassName('general')}>
            <span className="settings-modal-group-title">
              {dict.settingsModal?.aiEngine || 'AI Engine'}
            </span>
            {(() => {
              const userKey = getStoredUserApiKeyConfig();
              const hasKey = Boolean(userKey?.apiKey?.trim());
              const preset = userKey ? getProviderPreset(userKey.provider) : null;
              return (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onOpenModelModal();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div
                      className="settings-modal-icon-badge"
                      style={{
                        backgroundColor: hasKey ? 'rgba(16, 185, 129, 0.15)' : '#f1f5f9',
                        color: hasKey ? '#10b981' : '#0f172a',
                      }}
                    >
                      {hasKey ? <Key size={18} /> : <Sparkles size={18} />}
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {hasKey ? 'AI 모델 & API Key' : dict.header.aiModel}
                      </div>
                      <div className="settings-modal-item-desc">
                        {hasKey ? (
                          <span style={{ fontWeight: 700, color: '#059669' }}>
                            {preset?.name} ({userKey?.model}) 연결됨
                          </span>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>{hasKey ? '설정' : (dict.common.edit || '변경')}</span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              );
            })()}
          </div>

          {/* Group 2: Language */}
          <div className={groupClassName('general')}>
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
            <div className={groupClassName('capture')}>
              <span className="settings-modal-group-title">
                {dict.settingsModal?.dateSection || '촬영 날짜 및 정렬'}
              </span>
              {onToggleShowDate && (
                <div className="settings-modal-card-box" style={{ marginBottom: 8 }}>
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
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
                        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
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
                      style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
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
          <div className={groupClassName('capture')}>
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
                      onChange={(e) => {
                        const val = e.target.value;
                        onChangeBirthDate?.(val);
                        if (val) {
                          notify.success(dict.toasts.birthDateSet, {
                            description: interpolate(dict.toasts.birthDateSetDesc, { date: val }),
                          });
                        }
                      }}
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
            <div className={groupClassName('subtitles')}>
              <span className="settings-modal-group-title">
                {dict.settingsModal?.subtitleSection || dict.settingsModal?.subtitleOption || '영상 자막 및 스토리 브릿지 설정'}
              </span>
              {onToggleShowChapterBridge && (
                <div className="settings-modal-card-box mb-2">
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
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
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onToggleShowChapterBridge?.(checked);
                          if (checked) {
                            notify.success(dict.toasts.chapterBridgeOn, {
                              description: dict.toasts.chapterBridgeOnDesc,
                            });
                          } else {
                            notify.info(dict.toasts.chapterBridgeOff, {
                              description: dict.toasts.chapterBridgeOffDesc,
                            });
                          }
                        }}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>

                  {showChapterBridge && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '4px 9px',
                            borderRadius: '6px',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                          }}
                        >
                          {interpolate(dict.settingsModal?.chapterBridgeDateBadge || '날짜: {name}', {
                            name:
                              dict.chapterBridgeModal?.templates?.date?.[chapterBridgeDateTemplate || 'flip-clock']
                                ?.name ||
                              DATE_TEMPLATE_OPTIONS.find((o) => o.id === chapterBridgeDateTemplate)?.name ||
                              '플립 시계',
                          })}
                        </span>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '4px 9px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {interpolate(dict.settingsModal?.chapterBridgeLocationBadge || '장소: {name}', {
                            name:
                              dict.chapterBridgeModal?.templates?.location?.[
                                chapterBridgeLocationTemplate || 'winding-route'
                              ]?.name ||
                              LOCATION_TEMPLATE_OPTIONS.find((o) => o.id === chapterBridgeLocationTemplate)?.name ||
                              '로드트립 S경로',
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBridgePreviewOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#0f172a',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                        }}
                      >
                        <Eye size={14} />
                        {dict.settingsModal?.chapterBridgePreviewBtn || '모션 템플릿 & 실시간 미리보기'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {onToggleShowSubtitle && (
                <div className="settings-modal-card-box">
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
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
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onToggleShowSubtitle?.(checked);
                          if (checked) {
                            notify.success(dict.toasts.subtitleOn, {
                              description: dict.toasts.subtitleOnDesc,
                            });
                          } else {
                            notify.info(dict.toasts.subtitleOff, {
                              description: dict.toasts.subtitleOffDesc,
                            });
                          }
                        }}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>
                </div>
              )}

              {/* 자막 톤앤매너 선택 */}
              <div className="settings-modal-tone-box mt-2.5">
                <div className="settings-modal-tone-header">
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

                <div className="settings-modal-tone-grid" role="radiogroup" aria-label="Subtitle Tone">
                  {toneOptions.map((opt) => {
                    const isSelected = activeTone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`settings-modal-tone-card ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToneChange(opt.id)}
                      >
                        <div className="settings-modal-tone-card-top">
                          <span className="settings-modal-tone-card-title">
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                          </span>
                          <div className="settings-modal-tone-radio">
                            {isSelected && <div className="settings-modal-tone-radio-dot" />}
                          </div>
                        </div>
                        <p className="settings-modal-tone-card-desc">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Group: Intro & Outro Motion Settings (시작 인트로 및 종료 아웃트로 설정) */}
          {(onToggleShowIntro || onToggleShowOutro) && (
            <div className={groupClassName('motion')}>
              <span className="settings-modal-group-title">
                {dict.settingsModal?.introOutroSection || '시작 인트로 & 종료 아웃트로 설정'}
              </span>

              {/* 1. 시작 인트로 모션 */}
              {onToggleShowIntro && (
                <div className="settings-modal-card-box mb-2">
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
                      >
                        <Clapperboard size={18} />
                      </div>
                      <div className="settings-modal-item-text">
                        <div className="settings-modal-item-title">
                          {dict.settingsModal?.introOption || '시작 인트로 모션 표시'}
                        </div>
                        <div className="settings-modal-item-desc">
                          {dict.settingsModal?.introOptionDesc ||
                            '영상 시작 시 감각적인 볼드 타이포 및 카운트다운 모션을 삽입해요'}
                        </div>
                      </div>
                    </div>
                    <label className="toss-toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showIntro}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onToggleShowIntro?.(checked);
                          if (checked) {
                            notify.success(dict.toasts.introOn, {
                              description: dict.toasts.introOnDesc,
                            });
                          } else {
                            notify.info(dict.toasts.introOff, {
                              description: dict.toasts.introOffDesc,
                            });
                          }
                        }}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>

                  {showIntro && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '4px 9px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          {interpolate(dict.settingsModal?.introBadge || '인트로: {name} ({sec}초)', {
                            name:
                              dict.introOutroModal?.templates?.intro?.[introTemplate || 'kinetic-slide']?.name ||
                              INTRO_TEMPLATE_OPTIONS.find((o) => o.id === (introTemplate || 'kinetic-slide'))
                                ?.name || '키네틱 슬라이드',
                            sec: (introDurationSec || 2.0).toFixed(1),
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIntroOutroPreviewTab('intro');
                          setIsIntroOutroPreviewOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#0f172a',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                        }}
                      >
                        <Eye size={14} />
                        {dict.settingsModal?.introOutroPreviewBtn || '모션 템플릿 & 실시간 미리보기'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. 종료 아웃트로 모션 */}
              {onToggleShowOutro && (
                <div className="settings-modal-card-box">
                  <div className="settings-modal-toggle-row">
                    <div className="settings-modal-item-left">
                      <div
                        className="settings-modal-icon-badge"
                        style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}
                      >
                        <Film size={18} />
                      </div>
                      <div className="settings-modal-item-text">
                        <div className="settings-modal-item-title">
                          {dict.settingsModal?.outroOption || '종료 아웃트로 모션 표시'}
                        </div>
                        <div className="settings-modal-item-desc">
                          {dict.settingsModal?.outroOptionDesc ||
                            '영상 마지막에 추천 영상 카드 및 엔드 크레딧 클로징을 삽입해요'}
                        </div>
                      </div>
                    </div>
                    <label className="toss-toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showOutro}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onToggleShowOutro?.(checked);
                          if (checked) {
                            notify.success(dict.toasts.outroOn, {
                              description: dict.toasts.outroOnDesc,
                            });
                          } else {
                            notify.info(dict.toasts.outroOff, {
                              description: dict.toasts.outroOffDesc,
                            });
                          }
                        }}
                      />
                      <span className="toss-toggle-slider" />
                    </label>
                  </div>

                  {showOutro && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '4px 9px',
                            borderRadius: '6px',
                            backgroundColor: '#fdf2f8',
                            color: '#be185d',
                            border: '1px solid #fbcfe8',
                          }}
                        >
                          {interpolate(dict.settingsModal?.outroBadge || '아웃트로: {name} ({sec}초)', {
                            name:
                              dict.introOutroModal?.templates?.outro?.[outroTemplate || 'modern-endcard']?.name ||
                              OUTRO_TEMPLATE_OPTIONS.find((o) => o.id === (outroTemplate || 'modern-endcard'))
                                ?.name || '유튜브 엔드카드',
                            sec: (outroDurationSec || 2.2).toFixed(1),
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIntroOutroPreviewTab('outro');
                          setIsIntroOutroPreviewOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#0f172a',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                        }}
                      >
                        <Eye size={14} />
                        {dict.settingsModal?.introOutroPreviewBtn || '모션 템플릿 & 실시간 미리보기'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Group: 내보내기 화질 설정 (해상도) */}
          <div className={groupClassName('export')}>
            <span className="settings-modal-group-title">
              {dict.settingsModal?.resolutionSection || '내보내기 영상 화질 (해상도)'}
            </span>
            <div className="settings-modal-card-box toss-modal-res-box">
              <div className="toss-modal-res-list" role="radiogroup" aria-label="Export Resolution">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedResolution === '720p'}
                  onClick={() => handleSelectResolution('720p')}
                  className={`toss-modal-res-item ${selectedResolution === '720p' ? 'active' : ''}`}
                >
                  <div className="toss-modal-res-item-left">
                    <div className="toss-modal-res-radio">
                      {selectedResolution === '720p' && <div className="toss-modal-res-radio-dot" />}
                    </div>
                    <div className="toss-modal-res-content">
                      <div className="toss-modal-res-title-row">
                        <span className="toss-modal-res-title">720p HD</span>
                        <span className="toss-modal-res-subbadge standard">
                          {dict.exportSettings?.standardBadge || '기본'}
                        </span>
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
                  onClick={() => handleSelectResolution('1080p')}
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
          <div className={groupClassName('export')}>
            <span className="settings-modal-group-title">
              {dict.settingsModal?.storageSection || '저장소 및 보관 설정'}
            </span>
            <div className="settings-modal-card-box toss-storage-card">
              {/* 1. 스토리지 엔진 및 가용 공간 */}
              <div className="toss-storage-header">
                <div className="toss-storage-header-left">
                  <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
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
                      {appStorageStats && (
                        <span style={{ display: 'block', marginTop: '2px', color: '#475569' }}>
                          앱 내부: {appStorageStats.projectCount}개 프로젝트 · {formatBytes(appStorageStats.mediaBytes)}
                        </span>
                      )}
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

              {isMobileDevice && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '9px 11px',
                    borderRadius: '9px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '11px',
                    lineHeight: 1.5,
                    color: '#64748b',
                  }}
                >
                  {dict.settingsModal?.storageMobileNotice ||
                    '모바일에서도 원본 영상이 기기에 안전하게 보관돼요. 프로젝트를 삭제하면 용량도 함께 회수돼요. Safari 임시 파일은 앱을 완전히 종료 후 다시 열어야 완전히 비워질 수 있어요.'}
                </div>
              )}

              {/* 4. 저장 공간 관리 — 캐시 정리 / 저장공간 최적화(DB 압축) / 저장소 완전 비우기 */}
              <div
                className="toss-storage-clear-row"
                style={{
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* 4-1. 캐시 정리 (비파괴) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                      캐시 정리
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35 }}>
                      브라우저 임시 파일과 OPFS 캐시만 비워요. 프로젝트는 그대로 유지돼요.
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
                      border: '1px solid #e2e8f0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isClearingStorage ? '#94a3b8' : '#334155',
                      backgroundColor: '#f8fafc',
                      cursor: isClearingStorage ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{isClearingStorage ? '정리 중...' : '캐시 정리'}</span>
                  </button>
                </div>

                {/* 4-2. 저장공간 최적화 (DB 압축 — 프로젝트 유지) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                      저장공간 최적화 (DB 압축)
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35 }}>
                      프로젝트를 유지한 채 DB를 재구성해, 삭제 후 남은 고아 파일과 잔여 용량을 회수해요.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompactStorage}
                    disabled={isCompactingStorage}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      padding: '6px 12px',
                      flexShrink: 0,
                      borderRadius: '8px',
                      border: '1px solid #dbeafe',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isCompactingStorage ? '#94a3b8' : '#1d4ed8',
                      backgroundColor: '#eff6ff',
                      cursor: isCompactingStorage ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <HardDrive size={13} />
                    <span>{isCompactingStorage ? '최적화 중...' : '최적화'}</span>
                  </button>
                </div>

                {/* 4-3. 저장소 완전 비우기 (전체 삭제 — 위험) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                      저장소 완전 비우기
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35 }}>
                      모든 프로젝트와 원본 영상을 기기에서 영구 삭제해요. 되돌릴 수 없어요.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleWipeAllStorage}
                    disabled={isWipingStorage}
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
                      color: isWipingStorage ? '#94a3b8' : '#e11d48',
                      backgroundColor: '#fff1f2',
                      cursor: isWipingStorage ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{isWipingStorage ? '삭제 중...' : '완전 삭제'}</span>
                  </button>
                </div>

                {storageClearMessage && (
                  <div
                    style={{
                      marginTop: '2px',
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
            <div className={groupClassName('support')}>
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
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
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
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                      {dict.feedback?.openBoard || '게시판 열기'}
                    </span>
                    <ChevronRight size={15} color="#0f172a" />
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
            <div className={groupClassName('project')}>
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
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
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
        </div>

        {/* Modal Footer */}
        <div className="model-modal-footer settings-modal-footer">
          <button
            type="button"
            className="toss-modal-btn-close"
            onClick={onClose}
          >
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>

    {/* 챕터 브릿지 모션 템플릿 실시간 미리보기 모달 (완전 독립 오버레이) */}
    <ChapterBridgePreviewModal
      isOpen={isBridgePreviewOpen}
      onClose={() => setIsBridgePreviewOpen(false)}
      initialDateTemplate={chapterBridgeDateTemplate}
      initialLocationTemplate={chapterBridgeLocationTemplate}
      onApply={(dateTpl, locTpl) => {
        if (onChangeChapterBridgeTemplates) {
          onChangeChapterBridgeTemplates(dateTpl, locTpl);
        }
      }}
    />

    {/* 인트로 & 아웃트로 모션 템플릿 실시간 미리보기 모달 (완전 독립 오버레이) */}
    <IntroOutroPreviewModal
      isOpen={isIntroOutroPreviewOpen}
      onClose={() => setIsIntroOutroPreviewOpen(false)}
      initialTab={introOutroPreviewTab}
      initialIntroTemplate={introTemplate}
      initialIntroDuration={introDurationSec}
      initialOutroTemplate={outroTemplate}
      initialOutroDuration={outroDurationSec}
      initialOutroText={outroText}
      onApply={(settings) => {
        if (onChangeIntroOutroSettings) {
          onChangeIntroOutroSettings(settings);
        }
      }}
    />
  </>
);
};

export const StudioSettingsModal = MobileSettingsModal;
export default MobileSettingsModal;
