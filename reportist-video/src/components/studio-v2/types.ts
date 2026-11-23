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
import {
  getStoredShowDate,
  getStoredShowSubtitle,
  formatDateByPattern,
  formatDateWithAge,
  getStoredBirthDate,
  getStoredDateFormat,
  getStoredShowAge,
  parseDateTimeFromString,
} from '../../services/videoMetadata.ts';
import {
  getStoredIntroDuration,
  getStoredIntroTemplate,
  getStoredOutroDuration,
  getStoredOutroTemplate,
  getStoredShowIntro,
  getStoredShowOutro,
  getStoredShowCredit,
} from '../../services/introOutroStorage.ts';

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

  onTrySampleVideo?: () => void;
  isLoadingSample?: boolean;
  initialOverlayOptions?: VideoOverlayOptions | null;
  initialBgmPresetId?: string;
  initialBgmVolume?: number;
  initialCustomAudioFile?: File | null;
  onOverlayOptionsChange?: (options: VideoOverlayOptions) => void;
  onBgmChange?: (bgmId: string, volume: number) => void;
  onCustomAudioChange?: (file: File | null) => void;
  onRelinkVideo?: (id: string, file: File) => void;
  orientation?: VideoOrientation;
  portraitPlatform?: PortraitPlatform;
  onOrientationChange?: (orientation: VideoOrientation) => void;
  onPortraitPlatformChange?: (platform: PortraitPlatform) => void;
  /** 설정 모달에서 바꾼 하이라이트 방식을 App 상태와 동기화하기 위한 선택 props. */
  initialHighlightMode?: HighlightMode;
  onHighlightModeChange?: (mode: HighlightMode) => void;
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

/**
 * V2 오버레이 기본값.
 * 레거시 설정 모달에서 저장해 둔 값(날짜 표시, 자막 표시, 크레딧, 인트로/아웃트로 기본값)을
 * 반영해 세션 시작 시에도 사용자의 선택이 유지되도록 한다.
 * 챕터 브릿지는 V2 타임라인이 intro/segment/outro만 지원하므로 의도적으로 false로 고정한다.
 */
export function createDefaultOverlayOptions(): VideoOverlayOptions {
  return {
    ...DEFAULT_OVERLAY_OPTIONS,
    showDate: getStoredShowDate(),
    showSubtitle: getStoredShowSubtitle(),
    showCredit: getStoredShowCredit(),
    showIntro: getStoredShowIntro(),
    introTemplate: getStoredIntroTemplate(),
    introDurationSec: getStoredIntroDuration(),
    showOutro: getStoredShowOutro(),
    outroTemplate: getStoredOutroTemplate(),
    outroDurationSec: getStoredOutroDuration(),
    showChapterBridge: false,
  };
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 촬영일 라벨. 저장된 날짜 표기 형식 · 아이 나이 옵션 · 현재 로케일을 반영한다.
 * timestamp 우선, 없으면 segment의 subtitleDate를 파싱한다.
 * 캔버스의 formatMetaDate와 같은 규칙을 사용해 화면과 힌트 문구가 항상 일치한다.
 */
export function formatShootDate(segment?: HighlightSegment | null): string {
  if (!segment) return '';
  const ts = segment.recordedTimestamp;
  let date: Date | null = null;
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    const candidate = new Date(ts);
    if (!Number.isNaN(candidate.getTime())) date = candidate;
  }
  if (!date && segment.subtitleDate?.trim()) {
    date = parseDateTimeFromString(segment.subtitleDate)?.date ?? null;
  }
  if (date) {
    const base = formatDateByPattern(date, getStoredDateFormat());
    return formatDateWithAge(base, date, getStoredShowAge(), getStoredBirthDate());
  }
  return segment.subtitleDate || '';
}
