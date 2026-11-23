import {
  ChevronDown,
  Download,
  Key,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import type { VideoOrientation } from '../../types/video.ts';

// components/studio-v2/StudioTopBar.tsx — 새 작업/업로드/모델/내보내기.

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
  modelDisplay: StudioModelDisplay;
  isLoadingModels: boolean;
  isProcessing: boolean;
  onNewProject: () => void;
  onOpenModelModal: () => void;
  onAddVideos: () => void;
  onExport: () => void;
  canExport: boolean;
  isExporting: boolean;
  orientation: VideoOrientation;
  onOrientationChange: (o: VideoOrientation) => void;
}

export const StudioTopBar = ({
  modelDisplay,
  isLoadingModels,
  isProcessing,
  onNewProject,
  onOpenModelModal,
  onAddVideos,
  onExport,
  canExport,
  isExporting,
  orientation,
  onOrientationChange,
}: StudioTopBarProps) => (
  <header className="sv2-topbar">
    <div className="sv2-brand">
      <PenguinLogo size={26} color="#191f28" className="sv2-brand-logo" />
      PenguinCut
    </div>

    <div className="sv2-topbar-spacer" />

    <div className="sv2-segmented" title="화면 비율">
      <button
        type="button"
        data-active={orientation === 'landscape'}
        aria-pressed={orientation === 'landscape'}
        title="가로 영상 (16:9)"
        aria-label="가로 영상 (16:9)"
        onClick={() => onOrientationChange('landscape')}
      >
        <RectangleHorizontal size={17} strokeWidth={2} />
      </button>
      <button
        type="button"
        data-active={orientation === 'portrait'}
        aria-pressed={orientation === 'portrait'}
        title="세로 영상 (9:16)"
        aria-label="세로 영상 (9:16)"
        onClick={() => onOrientationChange('portrait')}
      >
        <RectangleVertical size={17} strokeWidth={2} />
      </button>
    </div>

    <button
      type="button"
      className={`sv2-model-trigger${modelDisplay.isByok ? ' is-byok' : ''}`}
      onClick={onOpenModelModal}
      disabled={isLoadingModels || isProcessing}
      aria-haspopup="dialog"
      title={modelDisplay.tooltip || 'AI 모델 선택'}
    >
      {modelDisplay.isByok ? <Key size={14} /> : <Sparkles size={14} />}
      {modelDisplay.isByok && <span className="sv2-model-badge">BYOK</span>}
      <span className="sv2-model-label">
        {isLoadingModels ? '불러오는 중…' : modelDisplay.label || 'AI 모델 선택'}
      </span>
      {!modelDisplay.isByok && modelDisplay.speedText && (
        <span className={`sv2-model-speed sv2-speed-${modelDisplay.speedTier ?? 'balanced'}`}>
          <Zap size={11} /> {modelDisplay.speedText}
        </span>
      )}
      {!modelDisplay.isByok && modelDisplay.usesTrainingData && (
        <ShieldAlert size={13} className="sv2-model-warn" aria-label="학습에 사용되는 모델" />
      )}
      <ChevronDown size={13} className="sv2-model-chevron" />
    </button>

    <button
      type="button"
      className="sv2-btn"
      onClick={onNewProject}
      title="현재 작업을 지우고 새로 시작"
    >
      <RotateCcw size={16} /> 새 작업
    </button>
    <button type="button" className="sv2-btn" onClick={onAddVideos}>
      <Plus size={16} /> 영상 추가
    </button>
    <button
      type="button"
      className="sv2-btn sv2-btn-primary"
      onClick={onExport}
      disabled={!canExport || isExporting}
    >
      <Download size={16} /> {isExporting ? '내보내는 중…' : 'MP4 내보내기'}
    </button>
  </header>
);
