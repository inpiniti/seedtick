import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Captions,
  Download,
  MessageSquare,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';
import { CURRENT_APP_VERSION } from '../../data/appVersion.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import {
  formatDateByPattern,
  getStoredAutoSortByRecordedTime,
  getStoredBirthDate,
  getStoredDateFormat,
  getStoredShowAge,
  getStoredShowDate,
  getStoredShowSubtitle,
  setStoredAutoSortByRecordedTime,
  setStoredBirthDate,
  setStoredShowAge,
  setStoredShowDate,
  setStoredShowSubtitle,
  type DateFormatOption,
} from '../../services/videoMetadata.ts';
import {
  getStoredHighlightMode,
  setStoredHighlightMode,
} from '../../services/highlightModeStorage.ts';
import {
  getStoredSubtitleTone,
  setStoredSubtitleTone,
} from '../../services/subtitleRefineService.ts';
import type { HighlightMode, SubtitleTone, VideoOverlayOptions } from '../../types/video.ts';
import type { StudioModelDisplay } from './types.ts';

// components/studio-v2/StudioV2SettingsModal.tsx
// V2 전용 슬림 설정 모달. 편집 맥락에 속한 옵션은 제자리(인스펙터/음악 트랙)에 두고,
// 전역·표시·도구·지원 항목만 여기에 모은다.
// 좌측 섹션 메뉴를 고르면 우측 영역에 해당 설정만 보여준다.

type SettingsSection = 'ai' | 'subtitle' | 'display' | 'tools' | 'support';

interface StudioV2SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 날짜 형식 모달처럼 위에 겹친 하위 모달이 있으면 ESC 처리를 넘긴다. */
  isSubModalOpen?: boolean;
  /** 저장값을 바꾼 뒤 미리보기 캔버스를 다시 그리도록 상위에 알린다. */
  onChange?: () => void;
  dateFormat: DateFormatOption;
  onOpenDateFormat: () => void;
  onDownloadSubtitles: () => void;
  canDownloadSubtitles: boolean;
  onOpenFeedback: () => void;
  onOpenPatchNotes: () => void;
  onResetProject: () => void;
  onOverlayChange?: (patch: Partial<VideoOverlayOptions>) => void;
  onHighlightModeChange?: (mode: HighlightMode) => void;
  /** 상단 바에서 이관한 AI 모델 선택 진입점. */
  modelDisplay: StudioModelDisplay;
  isLoadingModels: boolean;
  onOpenModelModal: () => void;
}

export const StudioV2SettingsModal = ({
  isOpen,
  onClose,
  isSubModalOpen = false,
  onChange,
  dateFormat,
  onOpenDateFormat,
  onDownloadSubtitles,
  canDownloadSubtitles,
  onOpenFeedback,
  onOpenPatchNotes,
  onResetProject,
  onOverlayChange,
  onHighlightModeChange,
  modelDisplay,
  isLoadingModels,
  onOpenModelModal,
}: StudioV2SettingsModalProps) => {
  const { ui, t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.sv2-settings-content, [data-modal-scrollable="true"]',
  });

  const [activeSection, setActiveSection] = useState<SettingsSection>('ai');
  const [highlightMode, setHighlightMode] = useState<HighlightMode>(getStoredHighlightMode);
  const [subtitleTone, setSubtitleTone] = useState<SubtitleTone>(getStoredSubtitleTone);
  const [autoSort, setAutoSort] = useState<boolean>(getStoredAutoSortByRecordedTime);
  const [showDate, setShowDate] = useState<boolean>(getStoredShowDate);
  const [showSubtitle, setShowSubtitle] = useState<boolean>(getStoredShowSubtitle);
  const [showAge, setShowAge] = useState<boolean>(getStoredShowAge);
  const [birthDate, setBirthDate] = useState<string>(getStoredBirthDate);

  // 모달을 열 때마다 다른 탭/레거시 화면에서 바뀐 저장값을 다시 읽어 온다.
  useEffect(() => {
    if (!isOpen) return;
    setHighlightMode(getStoredHighlightMode());
    setSubtitleTone(getStoredSubtitleTone());
    setAutoSort(getStoredAutoSortByRecordedTime());
    setShowDate(getStoredShowDate());
    setShowSubtitle(getStoredShowSubtitle());
    setShowAge(getStoredShowAge());
    setBirthDate(getStoredBirthDate());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubModalOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, isSubModalOpen]);

  if (!isOpen) return null;

  const highlightOptions: Array<{ id: HighlightMode; label: string }> = [
    { id: 'story', label: ui('감성 하이라이트') },
    { id: 'quick-cut', label: ui('1초 컷 편집') },
  ];

  const toneOptions: Array<{ id: SubtitleTone; label: string }> = [
    { id: 'vlog', label: t('dramaticClips.toneVlog') },
    { id: 'shorts', label: t('dramaticClips.toneShorts') },
    { id: 'natural', label: t('dramaticClips.toneNatural') },
    { id: 'minimal', label: t('dramaticClips.toneMinimal') },
  ];

  const chooseHighlight = (mode: HighlightMode) => {
    setStoredHighlightMode(mode);
    setHighlightMode(mode);
    onHighlightModeChange?.(mode);
  };

  const chooseTone = (tone: SubtitleTone) => {
    setStoredSubtitleTone(tone);
    setSubtitleTone(tone);
  };

  const toggleDate = () => {
    const next = !showDate;
    setShowDate(next);
    setStoredShowDate(next);
    onOverlayChange?.({ showDate: next });
    onChange?.();
  };

  const toggleSubtitle = () => {
    const next = !showSubtitle;
    setShowSubtitle(next);
    setStoredShowSubtitle(next);
    onOverlayChange?.({ showSubtitle: next });
    onChange?.();
  };

  const toggleAge = () => {
    const next = !showAge;
    setShowAge(next);
    setStoredShowAge(next);
    onChange?.();
  };

  const navSections = [
    { id: 'ai' as const, label: ui('AI 분석'), icon: Sparkles },
    { id: 'subtitle' as const, label: ui('자막'), icon: Captions },
    { id: 'display' as const, label: ui('화면 표시'), icon: CalendarDays },
    { id: 'tools' as const, label: ui('작업 & 도구'), icon: Download },
    { id: 'support' as const, label: ui('지원 & 정보'), icon: MessageSquare },
  ];

  return (
    <div
      ref={overlayRef}
      className="sv2-settings-backdrop"
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
        className="sv2-settings-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv2-settings-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <header className="sv2-settings-head">
          <div>
            <h2 id="sv2-settings-title">{t('settingsModal.title')}</h2>
            <p>{t('settingsModal.subtitle')}</p>
          </div>
          <button
            type="button"
            className="sv2-settings-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className="sv2-settings-body">
          {/* 좌측: 섹션 탐색 */}
          <nav className="sv2-settings-nav" aria-label={t('settingsModal.navAriaLabel')}>
            {navSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  className="sv2-settings-nav-item"
                  data-active={activeSection === section.id}
                  aria-current={activeSection === section.id ? 'page' : undefined}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon size={15} />
                  <span>{section.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="sv2-settings-nav-item sv2-settings-nav-feedback"
              onClick={onOpenFeedback}
            >
              <MessageSquare size={15} />
              <span>{t('feedback.headerTitle')}</span>
            </button>
          </nav>

          {/* 우측: 선택한 섹션의 설정 값 */}
          <div className="sv2-settings-content" data-modal-scrollable="true">
          <section className="sv2-settings-section" hidden={activeSection !== 'ai'}>
            <h3>
              <Sparkles size={14} /> {ui('AI 분석')}
            </h3>

            {/* 상단 바에서 옮긴 AI 모델 선택 진입점 */}
            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{ui('AI 모델')}</strong>
                <span title={modelDisplay.tooltip}>
                  {isLoadingModels
                    ? ui('불러오는 중…')
                    : `${modelDisplay.label}${modelDisplay.speedText ? ` · ${modelDisplay.speedText}` : ''}`}
                </span>
              </div>
              <button
                type="button"
                className="sv2-settings-link"
                onClick={onOpenModelModal}
                disabled={isLoadingModels}
                aria-label={ui('AI 모델 선택')}
              >
                {modelDisplay.isByok ? t('common.settings') : t('common.edit')} ›
              </button>
            </div>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{ui('하이라이트 방식')}</strong>
              </div>
              <div className="sv2-settings-chips">
                {highlightOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="sv2-settings-chip"
                    data-active={highlightMode === opt.id}
                    aria-pressed={highlightMode === opt.id}
                    onClick={() => chooseHighlight(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.autoSortByRecordedDate')}</strong>
                <span>{t('settingsModal.autoSortByRecordedDateDesc')}</span>
              </div>
              <button
                type="button"
                className="sv2-switch"
                data-on={autoSort}
                aria-label={t('settingsModal.autoSortByRecordedDate')}
                onClick={() => {
                  const next = !autoSort;
                  setAutoSort(next);
                  setStoredAutoSortByRecordedTime(next);
                  onChange?.();
                }}
              />
            </div>
          </section>

          <section className="sv2-settings-section" hidden={activeSection !== 'subtitle'}>
            <h3>
              <Captions size={14} /> {ui('자막')}
            </h3>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.subtitleTone')}</strong>
                <span>{t('settingsModal.subtitleToneDesc')}</span>
              </div>
              <div className="sv2-settings-chips">
                {toneOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="sv2-settings-chip"
                    data-active={subtitleTone === opt.id}
                    aria-pressed={subtitleTone === opt.id}
                    onClick={() => chooseTone(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.subtitleOption')}</strong>
                <span>{t('settingsModal.subtitleOptionDesc')}</span>
              </div>
              <button
                type="button"
                className="sv2-switch"
                data-on={showSubtitle}
                aria-label={t('settingsModal.subtitleOption')}
                onClick={toggleSubtitle}
              />
            </div>
          </section>

          <section className="sv2-settings-section" hidden={activeSection !== 'display'}>
            <h3>
              <CalendarDays size={14} /> {ui('화면 표시')}
            </h3>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.showDateOption')}</strong>
                <span>{t('settingsModal.showDateOptionDesc')}</span>
              </div>
              <button
                type="button"
                className="sv2-switch"
                data-on={showDate}
                aria-label={t('settingsModal.showDateOption')}
                onClick={toggleDate}
              />
            </div>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.dateFormat')}</strong>
                <span>{t('settingsModal.dateFormatDesc')}</span>
              </div>
              <button type="button" className="sv2-settings-link" onClick={onOpenDateFormat}>
                {formatDateByPattern(new Date(), dateFormat)} ›
              </button>
            </div>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.ageOption')}</strong>
                <span>{t('settingsModal.ageOptionDesc')}</span>
              </div>
              <button
                type="button"
                className="sv2-switch"
                data-on={showAge}
                aria-label={t('settingsModal.ageOption')}
                onClick={toggleAge}
              />
            </div>

            {showAge && (
              <div className="sv2-settings-row">
                <div className="sv2-settings-row-text">
                  <strong>{t('settingsModal.birthDateLabel')}</strong>
                  <span>{t('settingsModal.birthDatePrompt')}</span>
                </div>
                <input
                  type="date"
                  className="sv2-input sv2-settings-date-input"
                  value={birthDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBirthDate(next);
                    setStoredBirthDate(next);
                    onChange?.();
                  }}
                />
              </div>
            )}
          </section>

          <section className="sv2-settings-section" hidden={activeSection !== 'tools'}>
            <h3>
              <Download size={14} /> {ui('작업 & 도구')}
            </h3>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('settingsModal.downloadSubtitles')}</strong>
                <span>{t('settingsModal.downloadSubtitlesDesc')}</span>
              </div>
              <button
                type="button"
                className="sv2-btn sv2-btn-sm"
                onClick={onDownloadSubtitles}
                disabled={!canDownloadSubtitles}
              >
                <Download size={13} /> {t('settingsModal.downloadSubtitles')}
              </button>
            </div>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('projects.newProjectBtn')}</strong>
                <span>{t('settingsModal.resetDesc')}</span>
              </div>
              <button
                type="button"
                className="sv2-btn sv2-btn-sm sv2-btn-ghost sv2-settings-danger"
                onClick={onResetProject}
              >
                <RotateCcw size={13} /> {t('projects.newProjectBtn')}
              </button>
            </div>
          </section>

          <section className="sv2-settings-section" hidden={activeSection !== 'support'}>
            <h3>
              <MessageSquare size={14} /> {ui('지원 & 정보')}
            </h3>

            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('feedback.headerTitle')}</strong>
              </div>
              <button type="button" className="sv2-settings-link" onClick={onOpenFeedback}>
                {t('feedback.headerTitle')} ›
              </button>
            </div>
            <div className="sv2-settings-row">
              <div className="sv2-settings-row-text">
                <strong>{t('patchNotes.title')}</strong>
              </div>
              <button type="button" className="sv2-settings-link" onClick={onOpenPatchNotes}>
                v{CURRENT_APP_VERSION} ›
              </button>
            </div>
          </section>

            <p className="sv2-settings-hint">{ui('설정 변경은 미리보기에 바로 반영돼요')}</p>
          </div>
        </div>

        <footer className="sv2-settings-foot">
          <span className="sv2-settings-version">v{CURRENT_APP_VERSION}</span>
          <button type="button" className="sv2-btn sv2-btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default StudioV2SettingsModal;
