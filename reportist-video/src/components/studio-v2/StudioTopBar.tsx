import {
  ChevronDown,
  Download,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  RectangleHorizontal,
  RectangleVertical,
  Settings,
} from 'lucide-react';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import { getLandingPath, useI18n } from '../../i18n/index.tsx';
import type { VideoOrientation } from '../../types/video.ts';

// components/studio-v2/StudioTopBar.tsx — 좌측 도크 토글/언어/설정/내보내기.
// AI 모델 선택은 설정 모달(StudioV2SettingsModal)로 이관했다.

interface StudioTopBarProps {
  projectName: string;
  onOpenLanguageModal: () => void;
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

  return (
    <header className="sv2-topbar">
      <button
        type="button"
        className="sv2-btn sv2-btn-icon sv2-btn-ghost"
        onClick={onToggleDock}
        aria-expanded={isDockOpen}
        aria-label={isDockOpen ? ui('영상 목록 닫기') : ui('영상 목록 열기')}
        title={isDockOpen ? ui('영상 목록 닫기') : ui('영상 목록 열기')}
      >
        {isDockOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>
      <a
        className="sv2-brand"
        href={getLandingPath(locale)}
        title="PenguinCut"
        aria-label="PenguinCut"
      >
        <PenguinLogo size={26} color="#191f28" className="sv2-brand-logo" />
        PenguinCut
      </a>
      {projectName && <span className="sv2-project-name">{projectName}</span>}

      <div className="sv2-topbar-spacer" />

      <div className="sv2-segmented" title={ui('화면 비율')}>
        <button
          type="button"
          data-active={orientation === 'landscape'}
          aria-pressed={orientation === 'landscape'}
          title={ui('가로 영상 (16:9)')}
          aria-label={ui('가로 영상 (16:9)')}
          onClick={() => onOrientationChange('landscape')}
        >
          <RectangleHorizontal size={17} strokeWidth={2} />
        </button>
        <button
          type="button"
          data-active={orientation === 'portrait'}
          aria-pressed={orientation === 'portrait'}
          title={ui('세로 영상 (9:16)')}
          aria-label={ui('세로 영상 (9:16)')}
          onClick={() => onOrientationChange('portrait')}
        >
          <RectangleVertical size={17} strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        className="sv2-model-trigger sv2-lang-trigger"
        onClick={onOpenLanguageModal}
        title={`${locale.toUpperCase()} · ${currentLocaleInfo.nativeName}`}
        aria-label={`${locale.toUpperCase()} · ${currentLocaleInfo.nativeName}`}
      >
        <Globe size={14} />
        <span className="sv2-model-label sv2-lang-label">
          <span className="sv2-lang-code">{locale.toUpperCase()}</span>
          <span className="sv2-lang-name">{currentLocaleInfo.nativeName}</span>
        </span>
        <ChevronDown size={13} className="sv2-model-chevron" />
      </button>

      <button
        type="button"
        className="sv2-btn sv2-btn-icon sv2-settings-trigger"
        onClick={onOpenSettings}
        aria-haspopup="dialog"
        aria-label={t('common.settings')}
        title={t('common.settings')}
      >
        <Settings size={18} />
      </button>

      <button
        type="button"
        className="sv2-btn sv2-btn-primary"
        onClick={onExport}
        disabled={!canExport || isExporting}
      >
        <Download size={16} /> {isExporting ? ui('내보내는 중…') : ui('MP4 내보내기')}
      </button>
    </header>
  );
};
