// components/studio-v2/types.ts
// Center-Stage 스튜디오 V2가 상위 App과 주고받는 props 타입.
// 기존 ProStudioViewProps와 동일한 계약을 유지해 App의 상태/핸들러를 그대로 재사용한다.

import type {
  ExportResolution,
  FinalVideoResult,
  HighlightMode,
  HighlightSegment,
  PortraitPlatform,
  ProcessingProgress,
  VideoItem,
  VideoOrientation,
  VideoOverlayOptions,
} from '../../types/video.ts';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import type { StudioProjectSummary } from '../../types/project.ts';

export interface StudioV2Props {
  result: FinalVideoResult | null;
  onUpdateFinalResult: (updated: FinalVideoResult) => void;
  videos: VideoItem[];
  models: FreeModelMeta[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  selectedEffort: ReasoningEffortOption;
  onSelectEffort: (effort: ReasoningEffortOption) => void;
  isLoadingModels: boolean;
  onFilesSelected: (files: File[]) => void;
  onRemoveVideo: (id: string) => void;
  onUpdateVideoLocation?: (id: string, locationName: string) => void;
  onUpdateVideoRotation?: (id: string, rotation: number) => void;
  onStartAiAnalysis: (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId?: string,
    bgmVolume?: number,
    highlightMode?: HighlightMode
  ) => void;
  isProcessing: boolean;
  isPreparingVideos?: boolean;
  progress: ProcessingProgress;
  onCancelProcessing: () => void;
  onReset: (orientation?: VideoOrientation, platform?: PortraitPlatform) => void;
  onReStitch: (
    updatedSegments: HighlightSegment[],
    bgmPresetId: string,
    bgmVolume: number,
    customAudioFile?: File | null,
    overlayOptions?: VideoOverlayOptions,
    resolution?: ExportResolution
  ) => Promise<FinalVideoResult | null>;
  isReStitching: boolean;
  reStitchProgress?: { progressPercent: number; statusMessage: string };
  currentProjectId?: string | null;
  saveStatus?: 'saved' | 'saving' | 'idle';
  projectSummaries?: StudioProjectSummary[];
  isLoadingProjects?: boolean;
  onProjectsRefresh?: () => void;
  onOpenProject?: (id: string) => void | Promise<void>;
  onViewProjects?: () => void;
  /** V2 상단 바의 '새 작업' — 로컬 미디어를 비우고 초기 상태로 돌아간다. */
  onNewProject?: () => void | Promise<void>;
  onStartNewProject?: (orientation?: VideoOrientation, platform?: PortraitPlatform) => void;
  onTrySampleVideo?: () => void;
  isLoadingSample?: boolean;
  initialOverlayOptions?: VideoOverlayOptions | null;
  initialBgmPresetId?: string;
  initialBgmVolume?: number;
  initialCustomAudioFile?: File | null;
  initialSelectedLibraryTrackId?: string | null;
  onOverlayOptionsChange?: (options: VideoOverlayOptions) => void;
  onBgmChange?: (bgmId: string, volume: number, libraryTrackId?: string | null) => void;
  onCustomAudioChange?: (file: File | null) => void;
  onRelinkVideo?: (id: string, file: File) => void;
  orientation?: VideoOrientation;
  portraitPlatform?: PortraitPlatform;
  onOrientationChange?: (orientation: VideoOrientation) => void;
  onPortraitPlatformChange?: (platform: PortraitPlatform) => void;
}

export type InspectorTarget =
  | { type: 'location'; segmentId: string }
  | { type: 'intro' }
  | { type: 'outro' }
  | null;

/** 인스펙터가 중앙 미리보기에 요청하는 인트로/아웃트로 구간 동작. */
export type PreviewRequest =
  | { kind: 'intro' | 'outro'; mode: 'replay'; loop: boolean }
  | { kind: 'intro' | 'outro'; mode: 'hold'; progress: number };

/** 현재 구간 단독 미리보기 상태 (중앙 캔버스 배지·재생 루프가 공유). */
export interface PreviewRange {
  kind: 'intro' | 'outro';
  loop: boolean;
}

export const DEFAULT_OVERLAY_OPTIONS: VideoOverlayOptions = {
  showTitle: false,
  titleText: '',
  showChannel: false,
  channelText: '',
  showSubtitle: true,
  showDate: true,
  subtitleDateText: '',
  subtitleLocationText: '',
  showIntro: true,
  showOutro: true,
  introTemplate: 'kinetic-slide',
  outroTemplate: 'modern-endcard',
  introDurationSec: 2.0,
  outroDurationSec: 2.2,
  showChapterBridge: false,
  bgmFitToVideo: false,
  showCredit: true,
  creditText: 'Cut with PenguinCut · penguincut.com',
};

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 'yyyy.mm.dd' 포맷. timestamp 우선, 없으면 segment의 subtitleDate를 사용 */
export function formatShootDate(segment?: HighlightSegment | null): string {
  if (!segment) return '';
  const ts = segment.recordedTimestamp;
  if (ts && Number.isFinite(ts)) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}.${m}.${day}`;
    }
  }
  return segment.subtitleDate || '';
}
