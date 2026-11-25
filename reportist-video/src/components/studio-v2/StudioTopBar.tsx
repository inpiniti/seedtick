import {
  ChevronDown,
  CircleHelp,
  Download,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  RectangleHorizontal,
  RectangleVertical,
  Settings,
} from 'lucide-react';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import { ThemeToggleButton } from '../common/ThemeToggleButton.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';
import { getLandingPath, getLanguageCode, useI18n } from '../../i18n/index.tsx';
import type { VideoOrientation } from '../../types/video.ts';

// components/studio-v2/StudioTopBar.tsx — 좌측 도크 토글/언어/설정/내보내기.
// AI 모델 선택은 설정 모달(StudioV2SettingsModal)로 이관했다.

interface StudioTopBarProps {
  projectName: string;
  onOpenLanguageModal: () => void;
  /** 온보딩 가이드를 처음부터 다시 보여준다. */
  onReplayGuide: () => void;
  onOpenSettings: () => void;
  isDockOpen: boolean;
  onToggleDock: () => void;
  onExport: () => void;
  canExport: boolean;
  isExporting: boolean;
  orientation: VideoOrientation;
  onOrientationChange: (o: VideoOrientation) => void;
}

export const StudioTopBar = ({
  projectName,
  onOpenLanguageModal,
  onReplayGuide,
  onOpenSettings,
  isDockOpen,
  onToggleDock,
  onExport,
  canExport,
  isExporting,
  orientation,
  onOrientationChange,
}: StudioTopBarProps) => {
  const { locale, currentLocaleInfo, ui, t } = useI18n();
  const languageCode = getLanguageCode(locale);

  return (
    <header className="sv2-topbar">
      <Tooltip content={isDockOpen ? ui('영상 목록 닫기') : ui('영상 목록 열기')}>
        <button
          type="button"
          className="sv2-btn sv2-btn-icon sv2-btn-ghost"
          onClick={onToggleDock}
          aria-expanded={isDockOpen}
          aria-label={isDockOpen ? ui('영상 목록 닫기') : ui('영상 목록 열기')}
        >
          {isDockOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </Tooltip>
      <Tooltip content="PenguinCut">
        <a
          className="sv2-brand"
          href={getLandingPath(locale)}
          aria-label="PenguinCut"
        >
          <PenguinLogo size={26} className="sv2-brand-logo" />
          PenguinCut
        </a>
      </Tooltip>
      {projectName && <span className="sv2-project-name">{projectName}</span>}

      <div className="sv2-topbar-spacer" />

      <Tooltip content={ui('화면 비율')}>
        <div className="sv2-segmented">
          <Tooltip content={ui('가로 영상 (16:9)')}>
            <button
              type="button"
              data-active={orientation === 'landscape'}
              aria-pressed={orientation === 'landscape'}
              aria-label={ui('가로 영상 (16:9)')}
              onClick={() => onOrientationChange('landscape')}
            >
              <RectangleHorizontal size={17} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip content={ui('세로 영상 (9:16)')}>
            <button
              type="button"
              data-active={orientation === 'portrait'}
              aria-pressed={orientation === 'portrait'}
              aria-label={ui('세로 영상 (9:16)')}
              onClick={() => onOrientationChange('portrait')}
            >
              <RectangleVertical size={17} strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
      </Tooltip>

      <Tooltip content={`${languageCode} · ${currentLocaleInfo.nativeName}`}>
        <button
          type="button"
          className="sv2-model-trigger sv2-lang-trigger"
          onClick={onOpenLanguageModal}
          aria-label={`${languageCode} · ${currentLocaleInfo.nativeName}`}
        >
          <Globe size={14} />
          <span className="sv2-lang-code">{languageCode}</span>
          <ChevronDown size={13} className="sv2-model-chevron" />
        </button>
      </Tooltip>

      {/* 테마·가이드·설정은 하나의 아이콘 버튼 그룹으로 묶는다. */}
      <div className="sv2-btn-group" role="group" aria-label={ui('화면 도구')}>
        <ThemeToggleButton />

        <Tooltip content={ui('사용 가이드 다시 보기')}>
          <button
            type="button"
            className="sv2-btn sv2-btn-icon sv2-settings-trigger"
            onClick={onReplayGuide}
            aria-label={ui('사용 가이드 다시 보기')}
          >
            <CircleHelp size={18} />
          </button>
        </Tooltip>

        <Tooltip content={t('common.settings')}>
          <button
            type="button"
            className="sv2-btn sv2-btn-icon sv2-settings-trigger"
            onClick={onOpenSettings}
            aria-haspopup="dialog"
            aria-label={t('common.settings')}
          >
            <Settings size={18} />
          </button>
        </Tooltip>
      </div>

      <button
        type="button"
        className="sv2-btn sv2-btn-primary"
        onClick={onExport}
        disabled={!canExport || isExporting}
        data-tour="onboarding-export"
        data-tour-ready={canExport && !isExporting ? 'true' : 'false'}
      >
        <Download size={16} /> {isExporting ? ui('내보내는 중…') : ui('MP4 내보내기')}
      </button>
    </header>
  );
};
