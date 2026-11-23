import {
  Download,
  FolderOpen,
  Moon,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { FreeModelMeta } from '../../types/gateway.ts';
import type { VideoOrientation } from '../../types/video.ts';

// components/studio-v2/StudioTopBar.tsx — 프로젝트/업로드/모델/내보내기/테마 전환.

interface StudioTopBarProps {
  projectName: string;
  saveStatus?: 'saved' | 'saving' | 'idle';
  models: FreeModelMeta[];
  selectedModel: string;
  isLoadingModels: boolean;
  onSelectModel: (id: string) => void;
  onAddVideos: () => void;
  onOpenProjects: () => void;
  onExport: () => void;
  canExport: boolean;
  isExporting: boolean;
  orientation: VideoOrientation;
  onOrientationChange: (o: VideoOrientation) => void;
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
}

export const StudioTopBar = ({
  projectName,
  saveStatus,
  models,
  selectedModel,
  isLoadingModels,
  onSelectModel,
  onAddVideos,
  onOpenProjects,
  onExport,
  canExport,
  isExporting,
  orientation,
  onOrientationChange,
  theme,
  onThemeChange,
}: StudioTopBarProps) => (
  <header className="sv2-topbar">
    <div className="sv2-brand">
      <span className="sv2-brand-badge"><Sparkles size={16} /></span>
      PenguinCut
    </div>
    <button type="button" className="sv2-project-name" onClick={onOpenProjects} title="프로젝트 보관함 열기">
      {projectName || '새 프로젝트'} ▾
    </button>
    {saveStatus && (
      <span className="sv2-save-state">
        {saveStatus === 'saving' ? '저장 중…' : saveStatus === 'saved' ? '저장됨' : ''}
      </span>
    )}

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
        <RectangleHorizontal size={15} strokeWidth={2} />
        <span>16:9</span>
      </button>
      <button
        type="button"
        data-active={orientation === 'portrait'}
        aria-pressed={orientation === 'portrait'}
        title="세로 영상 (9:16)"
        aria-label="세로 영상 (9:16)"
        onClick={() => onOrientationChange('portrait')}
      >
        <RectangleVertical size={15} strokeWidth={2} />
        <span>9:16</span>
      </button>
    </div>

    <select
      className="sv2-model-select"
      value={selectedModel}
      disabled={isLoadingModels}
      onChange={(e) => onSelectModel(e.target.value)}
      title="AI 모델"
    >
      {isLoadingModels && <option>불러오는 중…</option>}
      {!isLoadingModels && models.length === 0 && <option>기본 모델</option>}
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name || m.id}
        </option>
      ))}
    </select>

    <button type="button" className="sv2-btn sv2-btn-icon" onClick={onOpenProjects} title="프로젝트 보관함">
      <FolderOpen size={17} />
    </button>
    <button
      type="button"
      className="sv2-btn sv2-btn-icon"
      onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
      title={theme === 'light' ? '다크 테마로 전환' : '라이트 테마로 전환'}
    >
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
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
