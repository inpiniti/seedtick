import {
  ChevronDown,
  Download,
  Globe,
  Key,
  PanelLeftClose,
  PanelLeftOpen,
  RectangleHorizontal,
  RectangleVertical,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import { getLandingPath, useI18n } from '../../i18n/index.tsx';
import type { VideoOrientation } from '../../types/video.ts';

// components/studio-v2/StudioTopBar.tsx — 좌측 도크 토글/모델/언어/내보내기.

/** 상단 바에 표시할 현재 AI 모델 상태 (CenterStudioView가 계산해 내려준다). */
export interface StudioModelDisplay {
  isByok: boolean;
  label: string;
  tooltip: string;
  speedText: string | null;
  speedTier: 'ultra' | 'fast' | 'balanced' | 'slow' | null;
  usesTrainingData: boolean;
}

interface StudioTopBarProps {
  projectName: string;
  modelDisplay: StudioModelDisplay;
  isLoadingModels: boolean;
  isProcessing: boolean;
  onOpenModelModal: () => void;
  onOpenLanguageModal: () => void;
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
  modelDisplay,
  isLoadingModels,
  isProcessing,
  onOpenModelModal,
  onOpenLanguageModal,
  isDockOpen,
  onToggleDock,
  onExport,
  canExport,
  isExporting,
  orientation,
  onOrientationChange,
}: StudioTopBarProps) => {
  const { locale, currentLocaleInfo, ui } = useI18n();
  const selectModel = ui('AI 모델 선택');

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
      <span className="sv2-project-name">{projectName || ui('새 프로젝트')}</span>

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
        title={currentLocaleInfo.nativeName}
        aria-label={`${locale.toUpperCase()} · ${currentLocaleInfo.nativeName}`}
      >
        <Globe size={14} />
        <span className="sv2-model-label">
          <span className="sv2-lang-flag">{currentLocaleInfo.flag}</span>{' '}
          <span className="sv2-lang-name">{currentLocaleInfo.nativeName}</span>
          <span className="sv2-lang-code">{locale.toUpperCase()}</span>
        </span>
        <ChevronDown size={13} className="sv2-model-chevron" />
      </button>

      <button
        type="button"
        className={`sv2-model-trigger${modelDisplay.isByok ? ' is-byok' : ''}`}
        onClick={onOpenModelModal}
        disabled={isLoadingModels || isProcessing}
        aria-haspopup="dialog"
        title={modelDisplay.tooltip || selectModel}
      >
        {modelDisplay.isByok ? <Key size={14} /> : <Sparkles size={14} />}
        {modelDisplay.isByok && <span className="sv2-model-badge">BYOK</span>}
        <span className="sv2-model-label">
          {isLoadingModels ? ui('불러오는 중…') : modelDisplay.label || selectModel}
        </span>
        {!modelDisplay.isByok && modelDisplay.speedText && (
          <span className={`sv2-model-speed sv2-speed-${modelDisplay.speedTier ?? 'balanced'}`}>
            <Zap size={11} /> {modelDisplay.speedText}
          </span>
        )}
        {!modelDisplay.isByok && modelDisplay.usesTrainingData && (
          <ShieldAlert size={13} className="sv2-model-warn" aria-label={ui('학습에 사용되는 모델')} />
        )}
        <ChevronDown size={13} className="sv2-model-chevron" />
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
