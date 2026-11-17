// components/studio/ProStudioView.tsx - Toss-style 16:9 AI Video Studio with i18n
import './ProStudioView.css';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { MobileStudioStepHeader } from './mobile/MobileStudioStepHeader.tsx';
import { MobileStepListSheet } from './mobile/MobileStepListSheet.tsx';
import { MobileBottomCtaBar } from './mobile/MobileBottomCtaBar.tsx';
import { Button } from '../ui/Button.tsx';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ArrowRight,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  Trash2,
  Upload,
  Plus,
  X,
  Clock,
  Music,
  ListMusic,
  Scissors,
  Film,
  FastForward,
  Type,
  FileAudio,
  MapPin,
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronLeft,
  Globe,
  Calendar,
  Image as ImageIcon,
  Share2,
  Settings,
  Subtitles,
  ArrowUpDown,
  Check,
  Maximize,
  Minimize,
  FolderOpen,
  Link2,
  AlertTriangle,
  MessageSquare,
  Wand2,
  Loader2,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type { SubtitleTone } from '../../types/video.ts';
import {
  refineSubtitlesWithContext,
  getStoredSubtitleTone,
  setStoredSubtitleTone,
} from '../../services/subtitleRefineService.ts';
import { QueueStatusCard, getQueueCopy } from '../queue/QueueStatusCard.tsx';
import { StudioProjectListView } from './StudioProjectListView.tsx';
import type { StudioProjectSummary } from '../../types/project.ts';
import type {
  FinalVideoResult,
  HighlightSegment,
  VideoItem,
  ProcessingProgress,
  VideoOverlayOptions,
  ExportResolution,
  IntroTemplateId,
  OutroTemplateId,
  BridgeDateTemplateId,
  BridgeLocationTemplateId,
  VideoOrientation,
  PortraitPlatform,
} from '../../types/video.ts';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import {
  captureVideoFrameAtTime,
  captureVideoFrameFromElement,
  createCanvasFromImageDataUrl,
  renderThumbnailArtwork,
  downloadThumbnailFile,
} from '../../services/thumbnailGenerator.ts';
import {
  computeBridgeDurationMap,
  evaluateChapterBridge,
} from '../../services/chapterBridgeModel.ts';
import type { createHyperframesBridgeController } from '../../services/hyperframesBridgeRenderer.ts';
import {
  drawCompositorCoverFrame,
  drawCompositorSegmentOverlay,
} from '../../services/previewCompositorBase.ts';
import { previewFrame } from '../../services/frameSpec.ts';
import { playBgmSynthLoop } from '../../services/audioSynth.ts';

// 모달은 사용자가 열 때만 청크를 내려받도록 지연 로딩한다. (초기 번들 절감)
const ModelSelectorModal = React.lazy(() =>
  import('./ModelSelectorModal.tsx').then((m) => ({ default: m.ModelSelectorModal }))
);
const VideoListModal = React.lazy(() =>
  import('./VideoListModal.tsx').then((m) => ({ default: m.VideoListModal }))
);
const LanguageSelectorModal = React.lazy(() =>
  import('./LanguageSelectorModal.tsx').then((m) => ({ default: m.LanguageSelectorModal }))
);
const AudioLibraryModal = React.lazy(() =>
  import('./AudioLibraryModal.tsx').then((m) => ({ default: m.AudioLibraryModal }))
);
const MobileSettingsModal = React.lazy(() =>
  import('./MobileSettingsModal.tsx').then((m) => ({ default: m.MobileSettingsModal }))
);
const DateFormatSelectorModal = React.lazy(() =>
  import('./DateFormatSelectorModal.tsx').then((m) => ({ default: m.DateFormatSelectorModal }))
);
const SubtitleDownloadModal = React.lazy(() =>
  import('./SubtitleDownloadModal.tsx').then((m) => ({ default: m.SubtitleDownloadModal }))
);
const VideoExportModal = React.lazy(() =>
  import('./VideoExportModal.tsx').then((m) => ({ default: m.VideoExportModal }))
);
const SegmentTrimModal = React.lazy(() =>
  import('./SegmentTrimModal.tsx').then((m) => ({ default: m.SegmentTrimModal }))
);
const SegmentBridgeModal = React.lazy(() =>
  import('./SegmentBridgeModal.tsx').then((m) => ({ default: m.SegmentBridgeModal }))
);
const FeedbackModal = React.lazy(() =>
  import('../feedback/FeedbackModal.tsx').then((m) => ({ default: m.FeedbackModal }))
);
const PatchNotesModal = React.lazy(() =>
  import('../patch/PatchNotesModal.tsx').then((m) => ({ default: m.PatchNotesModal }))
);
const IntroOutroPreviewModal = React.lazy(() =>
  import('./IntroOutroPreviewModal.tsx').then((m) => ({ default: m.IntroOutroPreviewModal }))
);
// 커뮤니티 탭은 기본 탭이 아니므로 열 때만 청크를 내려받는다.
const VideoCommunityView = React.lazy(() =>
  import('../community/VideoCommunityView.tsx').then((m) => ({ default: m.VideoCommunityView }))
);
import {
  INTRO_TEMPLATE_OPTIONS,
  OUTRO_TEMPLATE_OPTIONS,
  INTRO_DURATIONS,
  OUTRO_DURATIONS,
} from './introOutroOptions.ts';
import {
  getStoredIntroOutroDefaults,
  setStoredShowIntro,
  setStoredShowOutro,
  setStoredShowChapterBridge,
  setStoredIntroOutroDefaults,
  setStoredIntroTemplate,
  setStoredIntroDuration,
  setStoredOutroTemplate,
  setStoredOutroDuration,
  setStoredOutroText,
} from '../../services/introOutroStorage.ts';
import { notify } from '../../services/toastService.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport.ts';
import {
  type DateFormatOption,
  formatDateByPattern,
  getStoredDateFormat,
  setStoredDateFormat,
  getStoredShowAge,
  setStoredShowAge,
  getStoredShowDate,
  setStoredShowDate,
  getStoredBirthDate,
  setStoredBirthDate,
  getStoredAutoSortByRecordedTime,
  setStoredAutoSortByRecordedTime,
  formatDateWithAge,
  stripAgeFromDate,
  parseDateFromString,
  sortSegmentsByRecordedTime,
  formatSegmentRecordedDateTime,
  calculateSegmentTimestamp,
} from '../../services/videoMetadata.ts';
import {
  loadLibraryAudioFile,
  type AudioLibraryTrack,
} from '../../data/audioLibrary.ts';
import { getStoredStorageMode } from '../../services/storageQuotaService.ts';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import { ShinyText } from '../common/ShinyText.tsx';
import { SpecularButton } from '../common/SpecularButton.tsx';
import { BorderBeam } from '../common/BorderBeam.tsx';
import { useI18n } from '../../i18n/index.tsx';

const PLAYBACK_ERROR_MESSAGE =
  '이 영상은 미리보기를 재생할 수 없어요. 영상을 다시 올리거나 다른 형식(MP4)으로 시도해 주세요.';

// ============================================================
// 통합 스튜디오 편집 가이드 (프로젝트 상태에 따라 두 흐름으로 나뉜다)
// - 처음 만드는 중: 인트로 문구 → 인트로 스타일 → 영상 올리기 → AI 하이라이트 → 브릿지 → 아웃트로 → 노래 → 썸네일 → 다운로드 (9단계)
// - 컷이 만들어진 뒤: 인트로 문구 → 인트로 스타일 → 자막 → 컷 → 브릿지 → 아웃트로 → 노래 → 썸네일 → 다운로드 (9단계)
// ============================================================
type StudioSection =
  | 'intro'
  | 'introStyle'
  | 'caption'
  | 'upload'
  | 'ai'
  | 'cut'
  | 'bridge'
  | 'outro'
  | 'music'
  | 'thumbnail'
  | 'download';

interface StudioStep {
  id: StudioSection;
  label: string;
  shortDesc: string;
  description: string;
}

const CREATE_STUDIO_STEPS: StudioStep[] = [
  {
    id: 'intro',
    label: '인트로 문구',
    shortDesc: '좌·우 문구',
    description: '영상 위에 나올 왼쪽·오른쪽 문구를 정해요. 입력한 문구는 미리보기에서 바로 확인할 수 있어요.',
  },
  {
    id: 'introStyle',
    label: '인트로 스타일',
    shortDesc: '4가지 스타일',
    description: '인트로 모션 스타일과 재생 시간을 골라요. 직접 만든 인트로 영상을 올릴 수도 있어요.',
  },
  {
    id: 'upload',
    label: '영상 올리기',
    shortDesc: '원본 준비',
    description: '영상을 올리고 순서와 촬영 장소를 확인해요. 여러 개를 한 번에 올려도 돼요.',
  },
  {
    id: 'ai',
    label: 'AI 하이라이트',
    shortDesc: '장면 추출',
    description: 'AI가 영상에서 가장 볼만한 장면만 골라 짧게 잘라줘요. 이 단계에서 한 번만 누르면 돼요.',
  },
  {
    id: 'bridge',
    label: '브릿지',
    shortDesc: '장면 전환',
    description: '날짜나 장소가 바뀌는 장면 사이에 들어가는 전환이에요. 지금 스타일을 미리 골라둘 수 있어요.',
  },
  {
    id: 'outro',
    label: '아웃트로',
    shortDesc: '마무리',
    description: '영상 마지막 인사를 골라요. 스타일을 누르면 왼쪽 미리보기에서 바로 재생돼요.',
  },
  {
    id: 'music',
    label: '노래',
    shortDesc: '배경음악',
    description: '영상 전체에 깔리는 노래를 골라요. 어떤 단계를 편집하든 언제든 바꿀 수 있어요.',
  },
  {
    id: 'thumbnail',
    label: '썸네일',
    shortDesc: '대표 이미지',
    description: '유튜브에 올릴 16:9 대표 이미지를 만들어요. AI 추천 프레임과 타이틀을 그대로 쓸 수 있어요.',
  },
  {
    id: 'download',
    label: '다운로드',
    shortDesc: '저장',
    description: '편집한 영상과 자막 파일을 내려받아요. 모든 편집이 끝난 뒤 마지막으로 눌러주세요.',
  },
];

const EDIT_STUDIO_STEPS: StudioStep[] = [
  {
    id: 'intro',
    label: '인트로 문구',
    shortDesc: '좌·우 문구',
    description: '영상 위에 나올 왼쪽·오른쪽 문구를 정해요. 입력한 문구는 미리보기에서 바로 확인할 수 있어요.',
  },
  {
    id: 'introStyle',
    label: '인트로 스타일',
    shortDesc: '4가지 스타일',
    description: '인트로 모션 스타일과 재생 시간을 골라요. 직접 만든 인트로 영상을 올릴 수도 있어요.',
  },
  {
    id: 'caption',
    label: '자막',
    shortDesc: '자막·톤',
    description:
      'AI가 만든 자막을 확인하고 씬별로 제목·날짜·장소를 다듬어요. 자막 톤과 하단 자막·촬영 날짜 표시도 여기서 정해요.',
  },
  {
    id: 'cut',
    label: '컷',
    shortDesc: '장면 다듬기',
    description: 'AI가 고른 장면 중 지금 선택한 컷 하나만 다듬어요. 타임라인에서 컷을 누르면 그 컷으로 바뀌어요.',
  },
  {
    id: 'bridge',
    label: '브릿지',
    shortDesc: '장면 전환',
    description: '날짜나 장소가 바뀌는 컷 사이에 들어가는 장면 전환이에요. 켜 둔 곳만 타임라인에 표시돼요.',
  },
  {
    id: 'outro',
    label: '아웃트로',
    shortDesc: '마무리',
    description: '영상 마지막 인사를 골라요. 스타일을 누르면 왼쪽 미리보기에서 바로 재생돼요.',
  },
  {
    id: 'music',
    label: '노래',
    shortDesc: '배경음악',
    description: '영상 전체에 깔리는 노래를 골라요. 어떤 단계를 편집하든 언제든 바꿀 수 있어요.',
  },
  {
    id: 'thumbnail',
    label: '썸네일',
    shortDesc: '대표 이미지',
    description: '유튜브에 올릴 16:9 대표 이미지를 만들어요. AI 추천 프레임과 타이틀을 그대로 쓸 수 있어요.',
  },
  {
    id: 'download',
    label: '다운로드',
    shortDesc: '저장',
    description: '편집한 영상과 자막 파일을 내려받아요. 모든 편집이 끝난 뒤 마지막으로 눌러주세요.',
  },
];

const BRIDGE_DATE_CHOICES: Array<{ id: BridgeDateTemplateId; label: string }> = [
  { id: 'flip-clock', label: '플립 시계' },
  { id: 'watch-spin', label: '손목시계 회전' },
  { id: 'calendar-page', label: '달력 넘기기' },
  { id: 'minimal-editorial', label: '미니멀 에디토리얼' },
  { id: 'neon-digital', label: '네온 디지털' },
];

const BRIDGE_LOCATION_CHOICES: Array<{ id: BridgeLocationTemplateId; label: string }> = [
  { id: 'winding-route', label: '구불구불 경로' },
  { id: 'globe-spin', label: '3D 지구본' },
  { id: 'boarding-pass', label: '탑승권 티켓' },
  { id: 'minimal-editorial', label: '미니멀 에디토리얼' },
  { id: 'gps-cyber', label: 'GPS HUD' },
];


// 영상 병합(스티치)에 반영되는 모든 편집 상태의 정규화 스냅샷 생성
function computeStitchSnapshot(
  segs: HighlightSegment[],
  overlay: VideoOverlayOptions,
  bgmId: string,
  bgmVol: number,
  customAudio: File | null
): string {
  const segsData = segs.map((s) => ({
    id: s.id,
    sourceVideoId: s.sourceVideoId,
    start: Number((s.start ?? 0).toFixed(2)),
    end: Number((s.end ?? 0).toFixed(2)),
    duration: Number((s.duration ?? 0).toFixed(2)),
    rotation: ((s.rotation ?? 0) % 360 + 360) % 360,
    cropOffsetYRatio: Number((s.cropOffsetYRatio ?? 0.5).toFixed(2)),
    subtitleTitle: (s.subtitleTitle ?? '').trim(),
    subtitleDate: (s.subtitleDate ?? '').trim(),
    locationName: (s.locationName ?? '').trim(),
  }));

  const overlayData = {
    showTitle: Boolean(overlay.showTitle),
    titleText: (overlay.titleText ?? '').trim(),
    showChannel: Boolean(overlay.showChannel),
    channelText: (overlay.channelText ?? '').trim(),
    showSubtitle: overlay.showSubtitle !== false,
    showDate: overlay.showDate !== false,
    subtitleDateText: (overlay.subtitleDateText ?? '').trim(),
    subtitleLocationText: (overlay.subtitleLocationText ?? '').trim(),
    showIntro: Boolean(overlay.showIntro),
    introTemplate: overlay.introTemplate || 'kinetic-slide',
    introDurationSec: overlay.introDurationSec || 2.0,
    introFile: overlay.introVideoFile
      ? `${overlay.introVideoFile.name}_${overlay.introVideoFile.size}_${overlay.introVideoFile.lastModified}`
      : '',
    showOutro: Boolean(overlay.showOutro),
    outroTemplate: overlay.outroTemplate || 'modern-endcard',
    outroDurationSec: overlay.outroDurationSec || 2.2,
    outroFile: overlay.outroVideoFile
      ? `${overlay.outroVideoFile.name}_${overlay.outroVideoFile.size}_${overlay.outroVideoFile.lastModified}`
      : '',
    outroText: (overlay.outroText ?? '').trim(),
    showChapterBridge: overlay.showChapterBridge !== false,
    bgmFitToVideo: Boolean(overlay.bgmFitToVideo),
  };

  const audioData = {
    bgmId: bgmId || 'none',
    bgmVol: Number((bgmVol ?? 0.3).toFixed(2)),
    customAudio: customAudio
      ? `${customAudio.name}_${customAudio.size}_${customAudio.lastModified}`
      : '',
  };

  return JSON.stringify({ segs: segsData, overlay: overlayData, audio: audioData });
}

interface ProStudioViewProps {
  result: FinalVideoResult | null;
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
  onStartAiAnalysis: (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId?: string,
    bgmVolume?: number
  ) => void;
  isProcessing: boolean;
  progress: ProcessingProgress;
  onCancelProcessing: () => void;
  /** 새로 시작(리셋). 포맷 선택 모달에서 고른 방향을 인자로 받는다. */
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
  reStitchProgress?: {
    progressPercent: number;
    statusMessage: string;
  };
  onUpdateVideosDateFormat?: (format: DateFormatOption) => void;
  currentProjectId?: string | null;
  saveStatus?: 'saved' | 'saving' | 'idle';
  projectSummaries?: StudioProjectSummary[];
  isLoadingProjects?: boolean;
  onOpenProject?: (id: string) => void | Promise<void>;
  onDuplicateProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onStartNewProject?: (orientation?: VideoOrientation, platform?: PortraitPlatform) => void;
  initialOverlayOptions?: VideoOverlayOptions | null;
  initialBgmPresetId?: string;
  initialBgmVolume?: number;
  initialCustomAudioFile?: File | null;
  initialSelectedLibraryTrackId?: string | null;
  onOverlayOptionsChange?: (options: VideoOverlayOptions) => void;
  onBgmChange?: (bgmId: string, volume: number, libraryTrackId?: string | null) => void;
  onCustomAudioChange?: (file: File | null) => void;
  onUpdateFinalResult?: (updated: FinalVideoResult) => void;
  onViewProjects?: () => void;
  /** 출력 방향(프로젝트 생성 시점에 정함). 없으면 가로 16:9로 동작한다 (기존 프로젝트 호환). */
  orientation?: VideoOrientation;
  /** 세로일 때 플랫폼 프리셋 ('instagram' | 'youtube' | 'tiktok') */
  portraitPlatform?: PortraitPlatform;
  onRelinkVideo?: (id: string, file: File) => void;
  onRelinkBatch?: (files: File[]) => void;
}

export const ProStudioView: React.FC<ProStudioViewProps> = ({
  result,
  videos,
  models,
  selectedModel,
  onSelectModel,
  isLoadingModels,
  onFilesSelected,
  onRemoveVideo,
  onUpdateVideoLocation,
  onStartAiAnalysis,
  isProcessing,
  progress,
  onCancelProcessing,
  onReset,
  onReStitch,
  isReStitching,
  reStitchProgress,
  onUpdateVideosDateFormat,
  currentProjectId,
  saveStatus = 'saved',
  projectSummaries = [],
  isLoadingProjects = false,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onStartNewProject,
  initialOverlayOptions,
  initialBgmPresetId,
  initialBgmVolume,
  initialCustomAudioFile,
  initialSelectedLibraryTrackId,
  onOverlayOptionsChange,
  onBgmChange,
  onCustomAudioChange,
  onUpdateFinalResult,
  onViewProjects,
  orientation,
  portraitPlatform,
  onRelinkVideo,
  onRelinkBatch,
}) => {
  const { dict, interpolate, currentLocaleInfo, locale, ui } = useI18n();
  // 출력 프레임(가로 16:9 / 세로 9:16) — 프리뷰 렌더러·캔버스 크기·썸네일이 이 스펙을 공유한다.
  const frame = useMemo(
    () => previewFrame(orientation ?? 'landscape', portraitPlatform),
    [orientation, portraitPlatform]
  );
  const isPortraitOutput = frame.orientation === 'portrait';
  const thumbWidth = isPortraitOutput ? 720 : 1280;
  const thumbHeight = isPortraitOutput ? 1280 : 720;
  const thumbSpecLabel = isPortraitOutput ? '(720x1280)' : '(1280x720 HD)';
  const thumbDownloadTitle = `${dict.thumbnail?.downloadBtn || '썸네일 다운로드'} ${thumbSpecLabel}`;
  const queueCopy = useMemo(() => getQueueCopy(locale), [locale]);
  const ioDict = dict.introOutroModal;
  const secUnit = ioDict?.secUnit || 's';

  const introTemplateOptions = useMemo(() => {
    return INTRO_TEMPLATE_OPTIONS.map((opt) => {
      const trans = ioDict?.templates?.intro?.[opt.id];
      return {
        id: opt.id,
        label: trans?.name || opt.name,
        badge: trans?.badge || opt.badge,
        desc: trans?.desc || opt.desc,
      };
    });
  }, [ioDict]);

  const outroTemplateOptions = useMemo(() => {
    return OUTRO_TEMPLATE_OPTIONS.map((opt) => {
      const trans = ioDict?.templates?.outro?.[opt.id];
      return {
        id: opt.id,
        label: trans?.name || opt.name,
        badge: trans?.badge || opt.badge,
        desc: trans?.desc || opt.desc,
      };
    });
  }, [ioDict]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerStageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const sequencerCanvasRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const wasPlayingBeforeScrubRef = useRef<boolean>(false);
  const scrubRafRef = useRef<number | null>(null);
  const pendingScrubTimeRef = useRef<number | null>(null);
  const isRafSeekingRef = useRef<boolean>(false);
  const suppressSegmentClickRef = useRef<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
      }
      isRafSeekingRef.current = false;
      pendingScrubTimeRef.current = null;
    };
  }, []);

  // 비디오 ID 매핑 (상위 선언)
  const videoMap = useMemo(() => {
    const map = new Map<string, VideoItem>();
    videos.forEach((v) => map.set(v.id, v));
    return map;
  }, [videos]);

  const [autoSortByRecordedDate, setAutoSortByRecordedDate] = useState<boolean>(
    getStoredAutoSortByRecordedTime
  );

  // 1. 타임라인 및 클립 상태
  // AI 하이라이트 결과가 있을 때만 시퀀스 클립을 채운다.
  // (하이라이트 전에는 임시 클립을 만들지 않고 원본 영상 미리보기 모드로 동작)
  const initialSegments = useMemo<HighlightSegment[]>(() => {
    if (result?.segments && result.segments.length > 0) {
      if (autoSortByRecordedDate) {
        return sortSegmentsByRecordedTime(result.segments, videoMap);
      }
      return result.segments;
    }
    return [];
  }, [result, autoSortByRecordedDate, videoMap]);

  const [segments, setSegments] = useState<HighlightSegment[]>(initialSegments);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    initialSegments[0]?.id || ''
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // 1-1. 자막 톤앤매너 및 다듬기 상태
  const [currentSubtitleTone, setCurrentSubtitleTone] = useState<SubtitleTone>(getStoredSubtitleTone);
  const [isRefiningSubtitles, setIsRefiningSubtitles] = useState<boolean>(false);
  const [isToneSelectorOpen, setIsToneSelectorOpen] = useState<boolean>(false);
  const toneSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isToneSelectorOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (toneSelectorRef.current && !toneSelectorRef.current.contains(e.target as Node)) {
        setIsToneSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isToneSelectorOpen]);

  const toneOptions = useMemo<Array<{ id: SubtitleTone; label: string; desc: string; icon: string }>>(
    () => [
      {
        id: 'vlog',
        label: dict.dramaticClips?.toneVlog || 'Emotional Vlog',
        desc: dict.dramaticClips?.toneVlogDesc || 'First-person emotional warmth and precious moments',
        icon: '🌿',
      },
      {
        id: 'shorts',
        label: dict.dramaticClips?.toneShorts || 'High-Tension Shorts',
        desc: dict.dramaticClips?.toneShortsDesc || 'Punchy reactions, witty humor, and energy',
        icon: '⚡',
      },
      {
        id: 'natural',
        label: dict.dramaticClips?.toneNatural || 'Conversational',
        desc: dict.dramaticClips?.toneNaturalDesc || 'Friendly and conversational storytelling tone',
        icon: '💬',
      },
      {
        id: 'minimal',
        label: dict.dramaticClips?.toneMinimal || 'Minimal & Clean',
        desc: dict.dramaticClips?.toneMinimalDesc || 'Concise, clean, and crisp summary of moments',
        icon: '📝',
      },
    ],
    [dict]
  );

  const currentToneMeta = useMemo(() => {
    return toneOptions.find((t) => t.id === currentSubtitleTone) || toneOptions[0];
  }, [toneOptions, currentSubtitleTone]);

  const handleSelectSubtitleTone = (tone: SubtitleTone) => {
    setCurrentSubtitleTone(tone);
    setStoredSubtitleTone(tone);
    setIsToneSelectorOpen(false);
    const opt = toneOptions.find((t) => t.id === tone);
    notify.success(`${opt?.icon || '✨'} ${opt?.label || tone}`, {
      description: dict.toasts.toneChangedDesc,
    });
  };

  const handleRefineSubtitles = async (toneToUse?: SubtitleTone) => {
    const tone = toneToUse || currentSubtitleTone;
    if (isRefiningSubtitles || segments.length === 0) return;
    setIsRefiningSubtitles(true);
    setIsToneSelectorOpen(false);
    try {
      const refinedMap = await refineSubtitlesWithContext({
        segments,
        tone,
        videoTitle: effectiveOverlayOptions?.titleText || '',
        locale,
        model: selectedModel,
      });

      const prevSubtitles = new Map(segments.map((s) => [s.id, s.subtitleTitle]));

      setSegments((prev) =>
        prev.map((s) => (refinedMap[s.id] ? { ...s, subtitleTitle: refinedMap[s.id] } : s))
      );

      videos.forEach((v) => {
        v.segments = v.segments.map((s) =>
          refinedMap[s.id] ? { ...s, subtitleTitle: refinedMap[s.id] } : s
        );
      });

      const toneNameMap: Record<SubtitleTone, string> = {
        vlog: dict.dramaticClips?.toneVlog || '감성 브이로그',
        shorts: dict.dramaticClips?.toneShorts || '텐션 UP 쇼츠',
        natural: dict.dramaticClips?.toneNatural || '자연스러운 구어체',
        minimal: dict.dramaticClips?.toneMinimal || '담백한 일상',
      };
      notify.action(
        interpolate(dict.dramaticClips?.refinedToast || '{tone} 스타일로 자막을 다듬었어요.', {
          tone: toneNameMap[tone] || ui('선택한'),
        }),
        dict.common?.undo || '되돌리기',
        () => {
          setSegments((prev) =>
            prev.map((s) => (prevSubtitles.has(s.id) ? { ...s, subtitleTitle: prevSubtitles.get(s.id) } : s))
          );
          videos.forEach((v) => {
            v.segments = v.segments.map((s) =>
              prevSubtitles.has(s.id) ? { ...s, subtitleTitle: prevSubtitles.get(s.id) } : s
            );
          });
          return { title: dict.toasts.subtitleRestored, action: null };
        }
      );
    } catch (err) {
      console.error('Failed to refine subtitles:', err);
    } finally {
      setIsRefiningSubtitles(false);
    }
  };

  // 2. 배경음악(BGM) 상태
  const [selectedBgmId, setSelectedBgmId] = useState<string>(
    initialBgmPresetId || 'none'
  );
  const [bgmVolume, setBgmVolume] = useState<number>(
    typeof initialBgmVolume === 'number' ? initialBgmVolume : 0.3
  );
  const [selectedLibraryTrackId, setSelectedLibraryTrackId] = useState<string | null>(
    initialSelectedLibraryTrackId || null
  );

  // 3. 사용자 직접 업로드 음악 상태
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(
    initialCustomAudioFile || null
  );
  const [customAudioName, setCustomAudioName] = useState<string>(
    initialCustomAudioFile ? initialCustomAudioFile.name : ''
  );
  const [customAudioDuration, setCustomAudioDuration] = useState<number | null>(null);
  const customAudioInputRef = useRef<HTMLInputElement>(null);

  // 3-1. 내보내기 해상도 상태 (모바일은 720p 기본 권장, 데스크탑은 1080p FHD 기본 권장)
  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }, []);

  // 모바일 뷰포트(1024px 이하)에서는 데스크탑 스텝바/하단 상태바 대신 전용 IA(스텝 헤더 + 바텀시트 + 하단 고정 CTA)를 쓴다.
  const isMobileViewport = useIsMobileViewport(1024);
  const [isStepSheetOpen, setIsStepSheetOpen] = useState(false);

  const [exportResolution, setExportResolutionState] = useState<ExportResolution>(() => {
    if (result?.resolution) return result.resolution;
    try {
      const saved = localStorage.getItem('reportist_export_resolution');
      if (saved === '720p' || saved === '1080p') return saved;
    } catch {}
    return isMobileDevice ? '720p' : '1080p';
  });

  const setExportResolution = useCallback((res: ExportResolution) => {
    setExportResolutionState(res);
    try {
      localStorage.setItem('reportist_export_resolution', res);
    } catch {}
  }, []);

  // 선택된 배경음악(customAudioFile)의 실제 재생 길이(초) 자동 추출
  useEffect(() => {
    if (!customAudioFile) {
      setCustomAudioDuration(null);
      return;
    }

    let isCancelled = false;
    const objectUrl = URL.createObjectURL(customAudioFile);
    const audio = new Audio();
    audio.preload = 'metadata';

    const decodeFallback = async () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const buf = await customAudioFile.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf);
        if (!isCancelled && decoded.duration > 0) {
          setCustomAudioDuration(Math.round(decoded.duration * 10) / 10);
        }
        void ctx.close().catch(() => {});
      } catch {
        // ignore fallback error
      }
    };

    audio.onloadedmetadata = () => {
      if (isCancelled) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setCustomAudioDuration(Math.round(audio.duration * 10) / 10);
      } else {
        void decodeFallback();
      }
    };

    audio.onerror = () => {
      if (!isCancelled) {
        void decodeFallback();
      }
    };

    audio.src = objectUrl;

    return () => {
      isCancelled = true;
      audio.src = '';
      URL.revokeObjectURL(objectUrl);
    };
  }, [customAudioFile]);

  // 3-1. 오디오 보관함 상태
  const [isAudioLibraryOpen, setIsAudioLibraryOpen] = useState<boolean>(false);

  // 4. 인트로 / 아웃트로 비디오 파일 업로드 참조 및 지도 모달 상태
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const outroVideoInputRef = useRef<HTMLInputElement>(null);
  const [mapModalTarget, setMapModalTarget] = useState<HighlightSegment | null>(null);
  const [trimModalTarget, setTrimModalTarget] = useState<HighlightSegment | null>(null);
  const [editingBridgeIndex, setEditingBridgeIndex] = useState<number | null>(null);
  // 통합 스튜디오: 현재 편집 중인 단계와 브릿지 선택 상태
  // 처음 진입할 때는 컷이 이미 있어도 항상 1번 인트로부터 시작한다.
  const [activeSection, setActiveSection] = useState<StudioSection>('intro');
  const isCaptionSection = activeSection === 'caption';
  const [selectedBridgeIndex, setSelectedBridgeIndex] = useState<number>(1);
  const musicPanelPinnedRef = useRef<boolean>(false);
  // 단계 이동 등 프로그래밍적으로 시크할 때는 플레이헤드 기반 패널 동기화를 잠시 멈춘다.
  // (꺼져 있는 아웃트로/브릿지로 이동하면 시크 위치가 'segment'로 해석돼 패널이 컷으로 튕기던 문제)
  const sectionSyncSuppressRef = useRef<boolean>(false);
  const previewRangeEndRef = useRef<number | null>(null);
  const rightColumnRef = useRef<HTMLElement>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);
  // 모바일에서 단계가 늘어나도 현재 단계가 항상 보이도록 스텝바를 가로 스크롤한다.
  const stepbarListRef = useRef<HTMLOListElement | null>(null);
  const activeStepButtonRef = useRef<HTMLButtonElement | null>(null);

  // 새 프로젝트 포맷 선택 모달 (프로젝트 만들 때 방향을 정한다)
  const [isFormatModalOpen, setIsFormatModalOpen] = useState<boolean>(false);
  const [pendingOrientation, setPendingOrientation] = useState<VideoOrientation>('landscape');
  // 4-1. 다국어, AI 모델 및 원본 영상 목록 모달 상태
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState<boolean>(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [isVideoListModalOpen, setIsVideoListModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [isPatchNotesModalOpen, setIsPatchNotesModalOpen] = useState<boolean>(false);
  const [isDateFormatModalOpen, setIsDateFormatModalOpen] = useState<boolean>(false);
  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isIntroOutroModalOpen, setIsIntroOutroModalOpen] = useState<boolean>(false);
  const [introOutroModalTab, setIntroOutroModalTab] = useState<'intro' | 'outro'>('intro');
  const [currentDateFormat, setCurrentDateFormat] = useState<DateFormatOption>(getStoredDateFormat);
  const [showAge, setShowAge] = useState<boolean>(getStoredShowAge);
  const [showDate, setShowDate] = useState<boolean>(getStoredShowDate);
  const [birthDate, setBirthDate] = useState<string>(getStoredBirthDate);

  const currentModel = useMemo(
    () => models.find((model) => model.id === selectedModel) || models[0] || null,
    [models, selectedModel]
  );

  // Lock background scroll when inline modals (processing, restitching, map, trim) are active
  const isAnyInlineModalOpen = isProcessing || isReStitching || Boolean(mapModalTarget) || Boolean(trimModalTarget);
  useModalScrollLock(isAnyInlineModalOpen);

  useEffect(() => {
    if (isProcessing) {
      setIsLanguageModalOpen(false);
      setIsModelModalOpen(false);
      setIsVideoListModalOpen(false);
      setIsAudioLibraryOpen(false);
      setIsSettingsModalOpen(false);
      setIsDateFormatModalOpen(false);
      setIsSubtitleModalOpen(false);
      setIsExportModalOpen(false);
    }
  }, [isProcessing]);

  // 모바일 상단 탭 스트립(2번째 줄) 자동 숨김/표시: 아래로 드래그(스크롤 다운)하면 접고, 위로 드래그(스크롤 업)하면 펼친다.
  // 기준점(anchorY) 대비 누적 이동량으로 방향을 판정해 미세 떨림/느린 드래그에서도 안정적으로 동작한다.
  const [isTabStripHidden, setIsTabStripHidden] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const TOP_SHOW = 12; // 상단 근처에서는 항상 표시
    const HIDE_AFTER = 64; // 이 스크롤 지점 이후부터 숨김 허용
    const TRIGGER = 24; // 방향 판정에 필요한 누적 스크롤량
    let anchorY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
      const net = y - anchorY;
      if (y <= TOP_SHOW) {
        setIsTabStripHidden(false);
        anchorY = y;
        return;
      }
      if (Math.abs(net) < TRIGGER) return; // 방향 미확정: 누적 이동량이 쌓일 때까지 유지
      if (net > 0) {
        if (y > HIDE_AFTER) setIsTabStripHidden(true);
      } else {
        setIsTabStripHidden(false);
      }
      anchorY = y;
    };
    const onScroll = () => {
      if (rafId === null) rafId = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // 현재 AI 분석/처리 중인 비디오 및 썸네일
  const currentProcessingVideo = videos[progress.currentVideoIndex] || videos[0];
  const currentVideoThumbnail = currentProcessingVideo?.thumbnailUrl;

  // 모달에 표시할 가장 최근 작업 문구 (최근 2줄 분량, 초과 시 ...)
  const latestTask = useMemo(() => {
    const reasoningText = (progress.liveReasoning || '').trim();
    const contentText = (progress.liveContent || '').trim();
    const liveText = contentText || reasoningText;

    // 1. 실시간 추론 또는 응답 스트리밍 중 -> 최근 1~2줄 추출
    if (liveText) {
      const lines = liveText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const recentLines = lines.slice(-2);
      const textPart = recentLines.join('\n');
      const prefix = contentText ? '⌨️ ' : '💭 ';
      return {
        isStreaming: true,
        text: textPart
          ? `${prefix}${textPart}`
          : contentText
          ? dict.processingModal.responseGeneration
          : dict.processingModal.reasoningProcess,
      };
    }

    // 2. 현재 단계 기본 문구 (추론 전/단계 전환 시)
    if (progress.statusMessage) {
      return {
        isStreaming: false,
        text: progress.statusMessage,
      };
    }

    // 3. 누적된 작업 로그 중 가장 최근 1~2개 로그
    if (progress.reasoningLogs && progress.reasoningLogs.length > 0) {
      const recentLogs = progress.reasoningLogs.slice(-2);
      return {
        isStreaming: false,
        text: recentLogs.join('\n'),
      };
    }

    return {
      isStreaming: false,
      text: dict.processingModal.waitingModel,
    };
  }, [
    progress.liveReasoning,
    progress.liveContent,
    progress.statusMessage,
    progress.reasoningLogs,
    dict,
  ]);

  // 4-2. 상단 탭 상태 (스튜디오 목록 vs 스튜디오 상세 vs 영상 공유 커뮤니티)
  const [activeTab, setActiveTab] = useState<'projects' | 'studio' | 'community'>('projects');

  // 모든 모달 일괄 닫기 헬퍼 (브라우저 뒤로가기 시 활용)
  const closeAllModals = useCallback((): boolean => {
    let hadOpenModal = false;
    if (isLanguageModalOpen) { setIsLanguageModalOpen(false); hadOpenModal = true; }
    if (isModelModalOpen) { setIsModelModalOpen(false); hadOpenModal = true; }
    if (isVideoListModalOpen) { setIsVideoListModalOpen(false); hadOpenModal = true; }
    if (isAudioLibraryOpen) { setIsAudioLibraryOpen(false); hadOpenModal = true; }
    if (isSettingsModalOpen) { setIsSettingsModalOpen(false); hadOpenModal = true; }
    if (isFeedbackModalOpen) { setIsFeedbackModalOpen(false); hadOpenModal = true; }
    if (isPatchNotesModalOpen) { setIsPatchNotesModalOpen(false); hadOpenModal = true; }
    if (isDateFormatModalOpen) { setIsDateFormatModalOpen(false); hadOpenModal = true; }
    if (isSubtitleModalOpen) { setIsSubtitleModalOpen(false); hadOpenModal = true; }
    if (isExportModalOpen) { setIsExportModalOpen(false); hadOpenModal = true; }
    if (isIntroOutroModalOpen) { setIsIntroOutroModalOpen(false); hadOpenModal = true; }
    if (trimModalTarget) { setTrimModalTarget(null); hadOpenModal = true; }
    if (mapModalTarget) { setMapModalTarget(null); hadOpenModal = true; }
    if (editingBridgeIndex !== null) { setEditingBridgeIndex(null); hadOpenModal = true; }
    return hadOpenModal;
  }, [
    isLanguageModalOpen,
    isModelModalOpen,
    isVideoListModalOpen,
    isAudioLibraryOpen,
    isSettingsModalOpen,
    isFeedbackModalOpen,
    isPatchNotesModalOpen,
    isDateFormatModalOpen,
    isSubtitleModalOpen,
    isExportModalOpen,
    isIntroOutroModalOpen,
    trimModalTarget,
    mapModalTarget,
    editingBridgeIndex,
  ]);

  // 브라우저 History API 연동 탭 네비게이션
  const navigateToTab = useCallback((nextTab: 'projects' | 'studio' | 'community', replace = false) => {
    setActiveTab((prev) => {
      if (prev === nextTab) return prev;
      const targetHash = nextTab === 'projects' ? '#projects' : nextTab === 'studio' ? '#studio' : '#community';
      if (replace) {
        window.history.replaceState({ tab: nextTab, timestamp: Date.now() }, '', targetHash);
      } else {
        window.history.pushState({ tab: nextTab, timestamp: Date.now() }, '', targetHash);
      }
      return nextTab;
    });
  }, []);

  // 화면 내 '스튜디오 목록으로' 뒤로가기 액션
  const handleBackToProjects = useCallback(() => {
    onViewProjects?.();
    const st = window.history.state;
    if (st && st.tab === 'studio' && !st.root && window.history.length > 1) {
      window.history.back();
    } else {
      navigateToTab('projects');
    }
  }, [onViewProjects, navigateToTab]);

  // 브라우저 뒤로가기(popstate), 해시 변경(hashchange) 및 초기 해시 동기화
  useEffect(() => {
    const hash = window.location.hash.toLowerCase();
    let initialTab: 'projects' | 'studio' | 'community' = 'projects';
    if (hash === '#studio') {
      initialTab = 'studio';
    } else if (hash === '#community') {
      initialTab = 'community';
    } else {
      initialTab = 'projects';
    }
    setActiveTab(initialTab);

    // 초기 히스토리 스택 설정
    if (initialTab === 'studio') {
      // #studio로 직접 진입한 경우에도 뒤로가기 시 사이트 밖으로 나가지 않고 목록으로 갈 수 있도록 베이스 #projects를 먼저 기록
      window.history.replaceState({ tab: 'projects', root: true, timestamp: Date.now() }, '', '#projects');
      window.history.pushState({ tab: 'studio', timestamp: Date.now() }, '', '#studio');
    } else {
      window.history.replaceState(
        { tab: initialTab, root: true, timestamp: Date.now() },
        '',
        initialTab === 'projects' ? '#projects' : window.location.hash
      );
    }

    const syncLocationTab = (e?: PopStateEvent | HashChangeEvent) => {
      // 1. 모달이 열려있는 상태에서 뒤로가기를 누른 경우 모달을 먼저 닫음
      if (e && 'type' in e && e.type === 'popstate') {
        const closedModal = closeAllModals();
        if (closedModal) {
          return;
        }
      }

      // 2. 화면 탭 전환 처리
      const stateTab = (window.history.state as { tab?: string } | null)?.tab;
      const curHash = window.location.hash.toLowerCase();
      let targetTab: 'projects' | 'studio' | 'community' = 'projects';
      if (curHash === '#studio' || stateTab === 'studio') {
        targetTab = 'studio';
      } else if (curHash === '#community' || stateTab === 'community') {
        targetTab = 'community';
      } else {
        targetTab = 'projects';
      }

      if (targetTab === 'projects') {
        onViewProjects?.();
      }
      setActiveTab(targetTab);
    };

    window.addEventListener('popstate', syncLocationTab);
    window.addEventListener('hashchange', syncLocationTab);
    return () => {
      window.removeEventListener('popstate', syncLocationTab);
      window.removeEventListener('hashchange', syncLocationTab);
    };
  }, [closeAllModals, onViewProjects]);

  // 모달 오픈 시 브라우저 히스토리 푸시 (모달에서 뒤로가기 시 웹페이지 밖으로 나가지 않고 모달만 닫히도록)
  const isAnyModalOpen = Boolean(
    isLanguageModalOpen ||
    isModelModalOpen ||
    isVideoListModalOpen ||
    isAudioLibraryOpen ||
    isSettingsModalOpen ||
    isFeedbackModalOpen ||
    isPatchNotesModalOpen ||
    isDateFormatModalOpen ||
    isSubtitleModalOpen ||
    isExportModalOpen ||
    trimModalTarget ||
    mapModalTarget ||
    editingBridgeIndex !== null
  );
  const modalHistoryPushedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isAnyModalOpen && !modalHistoryPushedRef.current) {
      window.history.pushState({ tab: activeTab, isModal: true, timestamp: Date.now() }, '', window.location.hash);
      modalHistoryPushedRef.current = true;
    } else if (!isAnyModalOpen && modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = false;
    }
  }, [isAnyModalOpen, activeTab]);

  // 5. 자막 & 브랜딩 오버레이 상태
  const initialDateStr = useMemo(() => {
    if (videos.length > 0) {
      const ts = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
      if (ts) {
        const targetDate = new Date(ts);
        const base = formatDateByPattern(targetDate, currentDateFormat, locale);
        return formatDateWithAge(base, targetDate, showAge, birthDate, locale);
      }
      if (videos[0].metadataDate) {
        const targetDate = parseDateFromString(videos[0].metadataDate) || new Date();
        return formatDateWithAge(videos[0].metadataDate, targetDate, showAge, birthDate, locale);
      }
    }
    return '';
  }, [videos, currentDateFormat, showAge, birthDate, locale]);

  const [overlayOptions, setOverlayOptions] = useState<VideoOverlayOptions>(() => {
    const introOutroDefaults = getStoredIntroOutroDefaults();
    if (initialOverlayOptions) {
      return {
        ...initialOverlayOptions,
        showIntro: initialOverlayOptions.showIntro ?? introOutroDefaults.showIntro,
        showOutro: initialOverlayOptions.showOutro ?? introOutroDefaults.showOutro,
        showChapterBridge: initialOverlayOptions.showChapterBridge ?? introOutroDefaults.showChapterBridge,
        introTemplate: initialOverlayOptions.introTemplate || introOutroDefaults.introTemplate,
        introDurationSec: initialOverlayOptions.introDurationSec || introOutroDefaults.introDurationSec,
        outroTemplate: initialOverlayOptions.outroTemplate || introOutroDefaults.outroTemplate,
        outroDurationSec: initialOverlayOptions.outroDurationSec || introOutroDefaults.outroDurationSec,
        outroText:
          initialOverlayOptions.outroText !== undefined
            ? initialOverlayOptions.outroText
            : introOutroDefaults.outroText,
      };
    }
    return {
      showTitle: true,
      titleText: dict.player.defaultTitleText,
      showChannel: true,
      channelText: dict.player.defaultChannelText,
      showSubtitle: true,
      showDate,
      subtitleDateText: initialDateStr,
      subtitleLocationText: '',
      showIntro: introOutroDefaults.showIntro,
      introTemplate: introOutroDefaults.introTemplate,
      introDurationSec: introOutroDefaults.introDurationSec,
      showOutro: introOutroDefaults.showOutro,
      outroTemplate: introOutroDefaults.outroTemplate,
      outroDurationSec: introOutroDefaults.outroDurationSec,
      outroText: introOutroDefaults.outroText,
      showChapterBridge: introOutroDefaults.showChapterBridge,
      bgmFitToVideo: false,
      introVideoFile: null,
      outroVideoFile: null,
    };
  });

  // 외부(보관함 로드 등)에서 initialOverlayOptions 전달 시 동기화
  // 자식 자신이 발생시킨 변경이 부모를 거쳐 다시 자식으로 되돌아오는 무한 루프(Echo) 방지
  const lastEmittedOverlayJsonRef = useRef<string>('');
  const lastLoadedProjectIdRef = useRef<string | null>(currentProjectId || null);

  useEffect(() => {
    if (!initialOverlayOptions) return;

    const incomingJson = JSON.stringify({
      ...initialOverlayOptions,
      introVideoFile: initialOverlayOptions.introVideoFile
        ? `${initialOverlayOptions.introVideoFile.name}_${initialOverlayOptions.introVideoFile.size}`
        : null,
      outroVideoFile: initialOverlayOptions.outroVideoFile
        ? `${initialOverlayOptions.outroVideoFile.name}_${initialOverlayOptions.outroVideoFile.size}`
        : null,
    });

    const isDifferentProject = currentProjectId !== lastLoadedProjectIdRef.current;
    const isExternalChange = incomingJson !== lastEmittedOverlayJsonRef.current;

    if (isDifferentProject || isExternalChange) {
      lastLoadedProjectIdRef.current = currentProjectId || null;
      lastEmittedOverlayJsonRef.current = incomingJson;
      setOverlayOptions(initialOverlayOptions);
    }
  }, [initialOverlayOptions, currentProjectId]);

  // 외부로 overlayOptions 변경 전파 (실제 내용이 변경되었을 때만 전파)
  useEffect(() => {
    const currentJson = JSON.stringify({
      ...overlayOptions,
      introVideoFile: overlayOptions.introVideoFile
        ? `${overlayOptions.introVideoFile.name}_${overlayOptions.introVideoFile.size}`
        : null,
      outroVideoFile: overlayOptions.outroVideoFile
        ? `${overlayOptions.outroVideoFile.name}_${overlayOptions.outroVideoFile.size}`
        : null,
    });

    if (currentJson !== lastEmittedOverlayJsonRef.current) {
      lastEmittedOverlayJsonRef.current = currentJson;
      onOverlayOptionsChange?.(overlayOptions);
    }
  }, [overlayOptions, onOverlayOptionsChange]);

  // 외부에서 BGM 프리셋/볼륨/보관함 트랙 전달 시 동기화 (외부 prop 변경 시 로컬 상태 업데이트 및 중복 역전파 방지)
  const lastEmittedBgmRef = useRef<string>(
    `${initialBgmPresetId ?? 'none'}_${initialBgmVolume ?? 0.3}_${initialSelectedLibraryTrackId ?? 'null'}`
  );

  useEffect(() => {
    const nextBgmId = initialBgmPresetId !== undefined ? initialBgmPresetId : selectedBgmId;
    const nextVolume = typeof initialBgmVolume === 'number' ? initialBgmVolume : bgmVolume;
    const nextTrackId = initialSelectedLibraryTrackId !== undefined ? initialSelectedLibraryTrackId : selectedLibraryTrackId;

    lastEmittedBgmRef.current = `${nextBgmId}_${nextVolume}_${nextTrackId ?? 'null'}`;

    if (initialBgmPresetId !== undefined) {
      setSelectedBgmId((prev) => (prev !== initialBgmPresetId ? initialBgmPresetId : prev));
    }
    if (typeof initialBgmVolume === 'number') {
      setBgmVolume((prev) => (Math.abs(prev - initialBgmVolume) > 0.001 ? initialBgmVolume : prev));
    }
    if (initialSelectedLibraryTrackId !== undefined) {
      setSelectedLibraryTrackId((prev) => (prev !== initialSelectedLibraryTrackId ? initialSelectedLibraryTrackId : prev));
    }
  }, [initialBgmPresetId, initialBgmVolume, initialSelectedLibraryTrackId]);

  // 외부로 BGM 변경 전파 (스튜디오 내부 사용자 액션으로 변경 시에만 전파)
  useEffect(() => {
    const currentKey = `${selectedBgmId}_${bgmVolume}_${selectedLibraryTrackId ?? 'null'}`;
    if (currentKey !== lastEmittedBgmRef.current) {
      lastEmittedBgmRef.current = currentKey;
      onBgmChange?.(selectedBgmId, bgmVolume, selectedLibraryTrackId);
    }
  }, [selectedBgmId, bgmVolume, selectedLibraryTrackId, onBgmChange]);

  // 외부에서 커스텀 오디오 파일 전달 시 동기화
  const lastEmittedCustomAudioRef = useRef<File | null | undefined>(initialCustomAudioFile);

  useEffect(() => {
    if (initialCustomAudioFile !== undefined) {
      lastEmittedCustomAudioRef.current = initialCustomAudioFile;
      setCustomAudioFile((prev) => (prev !== initialCustomAudioFile ? initialCustomAudioFile : prev));
      setCustomAudioName(initialCustomAudioFile ? initialCustomAudioFile.name : '');
    }
  }, [initialCustomAudioFile]);

  // 외부로 커스텀 오디오 변경 전파 (스튜디오 내부 사용자 액션으로 변경 시에만 전파)
  useEffect(() => {
    if (lastEmittedCustomAudioRef.current !== customAudioFile) {
      lastEmittedCustomAudioRef.current = customAudioFile;
      onCustomAudioChange?.(customAudioFile);
    }
  }, [customAudioFile, onCustomAudioChange]);

  const effectiveOverlayOptions = useMemo<VideoOverlayOptions>(() => ({
    ...overlayOptions,
    titleText: overlayOptions.titleText || dict.player.defaultTitleText,
    channelText: overlayOptions.channelText || dict.player.defaultChannelText,
    outroText: overlayOptions.outroText || dict.introOutro.outroDefaultText,
  }), [overlayOptions, dict]);

  const currentProjectTitle = useMemo(() => {
    return (
      effectiveOverlayOptions?.titleText ||
      result?.suggestedTitle ||
      (videos[0]?.name ? videos[0].name.replace(/\.[^/.]+$/, '') : (dict.projects?.newProjectTitle || '새 스튜디오 작업'))
    );
  }, [effectiveOverlayOptions?.titleText, result?.suggestedTitle, videos, dict.projects?.newProjectTitle]);

  // 6. AI 16:9 유튜브 썸네일 상태
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(result?.thumbnailUrl || null);
  const [thumbnailStyle, setThumbnailStyle] = useState<'youtube-bold' | 'banner-box' | 'cinematic-clean'>('youtube-bold');
  const [showThumbnailTitle, setShowThumbnailTitle] = useState<boolean>(true);
  const thumbnailBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPreparedThumbKeyRef = useRef<string>('');
  const [isUpdatingThumbnail, setIsUpdatingThumbnail] = useState<boolean>(false);

  // 영상이 추가되었을 때 실제 촬영 날짜 및 위치 자동 반영
  useEffect(() => {
    if (videos.length > 0) {
      const ts = videos[0].recordedTimestamp || videos[0].file?.lastModified;
      let detectedDate = ts
        ? formatDateByPattern(new Date(ts), currentDateFormat, locale)
        : videos[0].metadataDate || '';
      const detectedLocation = videos[0].locationName || '';

      if (detectedDate) {
        const targetDate = ts ? new Date(ts) : parseDateFromString(detectedDate) || new Date();
        const formattedWithAge = formatDateWithAge(detectedDate, targetDate, showAge, birthDate, locale);
        setOverlayOptions((prev) => ({
          ...prev,
          subtitleDateText: prev.subtitleDateText || formattedWithAge,
          subtitleLocationText: prev.subtitleLocationText || detectedLocation,
        }));
      } else if (detectedLocation) {
        setOverlayOptions((prev) => ({
          ...prev,
          subtitleLocationText: prev.subtitleLocationText || detectedLocation,
        }));
      }

      // segments의 subtitleDate / locationName이 비어있으면 videos의 최신 메타데이터로 보충
      setSegments((prev) =>
        prev.map((seg) => {
          const v = videoMap.get(seg.sourceVideoId);
          if (!v) return seg;
          return {
            ...seg,
            subtitleDate: seg.subtitleDate || v.metadataDate || '',
            locationName: seg.locationName || v.locationName || '',
            latitude: seg.latitude ?? v.latitude,
            longitude: seg.longitude ?? v.longitude,
          };
        })
      );
    }
  }, [videos, currentDateFormat, showAge, birthDate, videoMap, locale]);

  // 현재 날짜 표기 형식과 UI 언어 기준으로 세그먼트 자막 및 기본 하단 자막 날짜를 일괄 재생성
  const reformatAllDates = (format: DateFormatOption) => {
    // 1. 타임라인 세그먼트들의 subtitleDate 일괄 갱신
    setSegments((prev) =>
      prev.map((seg) => {
        const vItem = videoMap.get(seg.sourceVideoId);
        const ts = vItem?.recordedTimestamp || vItem?.file?.lastModified;
        const targetDate = ts ? new Date(ts) : parseDateFromString(seg.subtitleDate || '') || new Date();
        const baseDate = ts
          ? formatDateByPattern(new Date(ts), format, locale)
          : formatDateByPattern(targetDate, format, locale);
        return {
          ...seg,
          subtitleDate: formatDateWithAge(baseDate, targetDate, showAge, birthDate, locale),
        };
      })
    );

    // 2. 전체 기본 하단 자막(subtitleDateText) 갱신
    if (videos.length > 0) {
      const firstTs = videos[0].recordedTimestamp || videos[0].file?.lastModified;
      const targetDate = firstTs
        ? new Date(firstTs)
        : parseDateFromString(overlayOptions.subtitleDateText || '') || new Date();
      const baseDate = formatDateByPattern(targetDate, format, locale);
      setOverlayOptions((prev) => ({
        ...prev,
        subtitleDateText: formatDateWithAge(baseDate, targetDate, showAge, birthDate, locale),
      }));
    }
  };

  // 날짜 표기 형식 변경 시 세그먼트 자막 및 비디오 메타데이터 일괄 갱신
  const handleSelectDateFormat = (newFormat: DateFormatOption) => {
    setCurrentDateFormat(newFormat);
    setStoredDateFormat(newFormat);
    reformatAllDates(newFormat);

    // 상위 컴포넌트(App)의 videos metadataDate 갱신
    onUpdateVideosDateFormat?.(newFormat);
  };

  // UI 언어 변경 시 이미 생성된 자막/클립 날짜의 월 이름·나이 단위도 즉시 갱신
  const lastDateLocaleRef = useRef(locale);
  useEffect(() => {
    if (lastDateLocaleRef.current === locale) return;
    lastDateLocaleRef.current = locale;
    reformatAllDates(currentDateFormat);
  }, [locale]);

  // 나이 표시 옵션 토글 핸들러
  const handleToggleShowAge = (enabled: boolean) => {
    setShowAge(enabled);
    setStoredShowAge(enabled);

    // 1. 타임라인 세그먼트들의 subtitleDate 일괄 갱신
    setSegments((prev) =>
      prev.map((seg) => {
        const vItem = videoMap.get(seg.sourceVideoId);
        const ts = vItem?.recordedTimestamp || vItem?.file?.lastModified;
        const targetDate = ts ? new Date(ts) : parseDateFromString(seg.subtitleDate || '') || new Date();
        const baseDate = ts
          ? formatDateByPattern(new Date(ts), currentDateFormat, locale)
          : stripAgeFromDate(seg.subtitleDate || '');
        return {
          ...seg,
          subtitleDate: formatDateWithAge(baseDate, targetDate, enabled, birthDate, locale),
        };
      })
    );

    // 2. 전체 기본 하단 자막(subtitleDateText) 갱신
    const firstTs = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
    const targetDate = firstTs
      ? new Date(firstTs)
      : parseDateFromString(overlayOptions.subtitleDateText || '') || new Date();
    const baseDate = firstTs
      ? formatDateByPattern(new Date(firstTs), currentDateFormat, locale)
      : stripAgeFromDate(overlayOptions.subtitleDateText || '');
    setOverlayOptions((prev) => ({
      ...prev,
      subtitleDateText: formatDateWithAge(baseDate, targetDate, enabled, birthDate, locale),
    }));

    if (enabled) {
      notify.success(dict.toasts.ageOn, {
        description: dict.toasts.ageOnDesc,
      });
    } else {
      notify.info(dict.toasts.ageOff, {
        description: dict.toasts.ageOffDesc,
      });
    }
  };

  // 촬영 날짜 표시 on/off 토글 핸들러
  const handleToggleShowDate = (enabled: boolean) => {
    setShowDate(enabled);
    setStoredShowDate(enabled);
    setOverlayOptions((prev) => ({ ...prev, showDate: enabled }));
    if (enabled) {
      notify.success(dict.toasts.showDateOn, {
        description: dict.toasts.showDateOnDesc,
      });
    } else {
      notify.info(dict.toasts.showDateOff, {
        description: dict.toasts.showDateOffDesc,
      });
    }
  };

  // 촬영일시 순 기본 정렬 on/off 토글 핸들러
  const handleToggleAutoSortByRecordedDate = (enabled: boolean) => {
    setAutoSortByRecordedDate(enabled);
    setStoredAutoSortByRecordedTime(enabled);
    if (enabled) {
      if (segments.length > 1) {
        const prevSegments = [...segments];
        const sorted = sortSegmentsByRecordedTime(segments, videoMap);
        setSegments(sorted);
        notify.action(
          dict.dramaticClips.sortByRecordedDateToast || '촬영일시 순으로 정렬했어요.',
          dict.common?.undo || '되돌리기',
          () => {
            setSegments(prevSegments);
            return { title: dict.toasts.orderRestored, action: null };
          }
        );
      } else {
        notify.success(dict.toasts.autoSortOn, {
          description: dict.toasts.autoSortOnDesc,
        });
      }
    } else {
      notify.info(dict.toasts.autoSortOff, {
        description: dict.toasts.autoSortOffDesc,
      });
    }
  };

  // 생년월일 변경 핸들러
  const handleChangeBirthDate = (newBirthDate: string) => {
    setBirthDate(newBirthDate);
    setStoredBirthDate(newBirthDate);

    if (!showAge) return;

    // 1. 타임라인 세그먼트들의 subtitleDate 일괄 갱신
    setSegments((prev) =>
      prev.map((seg) => {
        const vItem = videoMap.get(seg.sourceVideoId);
        const ts = vItem?.recordedTimestamp || vItem?.file?.lastModified;
        const targetDate = ts ? new Date(ts) : parseDateFromString(seg.subtitleDate || '') || new Date();
        const baseDate = ts
          ? formatDateByPattern(new Date(ts), currentDateFormat, locale)
          : stripAgeFromDate(seg.subtitleDate || '');
        return {
          ...seg,
          subtitleDate: formatDateWithAge(baseDate, targetDate, showAge, newBirthDate, locale),
        };
      })
    );

    // 2. 전체 기본 하단 자막(subtitleDateText) 갱신
    const firstTs = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
    const targetDate = firstTs
      ? new Date(firstTs)
      : parseDateFromString(overlayOptions.subtitleDateText || '') || new Date();
    const baseDate = firstTs
      ? formatDateByPattern(new Date(firstTs), currentDateFormat, locale)
      : stripAgeFromDate(overlayOptions.subtitleDateText || '');
    setOverlayOptions((prev) => ({
      ...prev,
      subtitleDateText: formatDateWithAge(baseDate, targetDate, showAge, newBirthDate, locale),
    }));
  };

  // AI 추론 콘솔 자동 스크롤
  useEffect(() => {
    if (consoleScrollRef.current) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
    }
  }, [progress.reasoningLogs, progress.liveReasoning, progress.liveContent]);

  const handleCustomAudioSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedAudioFile = e.target.files && e.target.files[0];
    e.target.value = '';
    if (selectedAudioFile) {
      const file = selectedAudioFile;
      setCustomAudioFile(file);
      setCustomAudioName(file.name);
      setSelectedBgmId('custom');
      setSelectedLibraryTrackId(null);
      notify.success(file.name, {
        description: dict.toasts.customAudioAppliedDesc,
      });
    }
  };

  // 오디오 보관함 음원 선택 (파일을 불러와 기존 커스텀 BGM 파이프라인에 연결)
  const handleApplyLibraryAudio = async (track: AudioLibraryTrack | null) => {
    if (!track) {
      setCustomAudioFile(null);
      setCustomAudioName('');
      setSelectedBgmId('none');
      setSelectedLibraryTrackId(null);
      notify.info(dict.toasts.bgmNone, {
        description: dict.toasts.bgmNoneDesc,
      });
      return;
    }

    const file = await loadLibraryAudioFile(track);
    setCustomAudioFile(file);
    setCustomAudioName(track.name);
    setSelectedBgmId('custom');
    setSelectedLibraryTrackId(track.id);
    notify.success(track.name, {
      description: dict.toasts.bgmAppliedDesc,
    });
  };

  const handleIntroVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIntroFile = e.target.files && e.target.files[0];
    e.target.value = '';
    if (selectedIntroFile) {
      const file = selectedIntroFile;
      setOverlayOptions((prev) => ({ ...prev, introVideoFile: file, showIntro: true }));
      notify.success(file.name, {
        description: dict.toasts.introVideoAppliedDesc,
      });
    }
  };

  const handleOutroVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedOutroFile = e.target.files && e.target.files[0];
    e.target.value = '';
    if (selectedOutroFile) {
      const file = selectedOutroFile;
      setOverlayOptions((prev) => ({ ...prev, outroVideoFile: file, showOutro: true }));
      notify.success(file.name, {
        description: dict.toasts.outroVideoAppliedDesc,
      });
    }
  };

  // 신규 작업 또는 영상 리셋 시 스튜디오 내부 상태 완전 초기화
  const resetStudioState = useCallback(() => {
    setSegments([]);
    setSelectedSegmentId('');
    setThumbnailUrl(null);
    thumbnailBgCanvasRef.current = null;
    appliedSuggestedTitleRef.current = null;
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedBgmId('none');
    setBgmVolume(0.3);
    setCustomAudioFile(null);
    setCustomAudioName('');
    setCustomAudioDuration(0);
    setSelectedLibraryTrackId(null);
    lastPreparedThumbKeyRef.current = '';
    const freshDefaults = getStoredIntroOutroDefaults();
    setOverlayOptions({
      showTitle: true,
      titleText: dict.player.defaultTitleText,
      showChannel: true,
      channelText: dict.player.defaultChannelText,
      showSubtitle: true,
      showDate,
      subtitleDateText: '',
      subtitleLocationText: '',
      showIntro: freshDefaults.showIntro,
      introTemplate: freshDefaults.introTemplate,
      introDurationSec: freshDefaults.introDurationSec,
      showOutro: freshDefaults.showOutro,
      outroTemplate: freshDefaults.outroTemplate,
      outroDurationSec: freshDefaults.outroDurationSec,
      outroText: freshDefaults.outroText,
      showChapterBridge: freshDefaults.showChapterBridge,
      bgmFitToVideo: false,
      introVideoFile: null,
      outroVideoFile: null,
    });
    lastEmittedOverlayJsonRef.current = '';
    lastLoadedProjectIdRef.current = null;
    lastStitchedResultUrlRef.current = null;
    setLastStitchedSnapshot(null);
    setActiveSection('intro');
    setSelectedBridgeIndex(1);
  }, [dict.player.defaultTitleText, dict.player.defaultChannelText, showDate]);

  // 새 프로젝트/새 영상 만들기 → 포맷 선택 모달을 먼저 연다. (만들 때 방향을 정한다)
  const requestNewProject = useCallback(() => {
    setPendingOrientation(orientation === 'portrait' ? 'portrait' : 'landscape');
    setIsFormatModalOpen(true);
  }, [orientation]);

  const confirmStartNewProject = useCallback(() => {
    setIsFormatModalOpen(false);
    resetStudioState();
    onStartNewProject?.(pendingOrientation);
    navigateToTab('studio');
  }, [pendingOrientation, onStartNewProject, resetStudioState, navigateToTab]);

  // 상위 결과 갱신 동기화 및 썸네일/타이틀 준비
  const appliedSuggestedTitleRef = useRef<string | null>(null);
  const lastStitchedResultUrlRef = useRef<string | null>(null);
  const [lastStitchedSnapshot, setLastStitchedSnapshot] = useState<string | null>(null);

  // 프로젝트 전환 시 스티치 결과 URL 캐시 초기화
  useEffect(() => {
    if (currentProjectId !== lastLoadedProjectIdRef.current) {
      lastStitchedResultUrlRef.current = null;
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (result?.segments && result.segments.length > 0) {
      const segsToSet = autoSortByRecordedDate
        ? sortSegmentsByRecordedTime(result.segments, videoMap)
        : result.segments;
      setSegments(segsToSet);
      if (!selectedSegmentId || !segsToSet.some((s) => s.id === selectedSegmentId)) {
        setSelectedSegmentId(segsToSet[0].id);
      }
    } else if (!result) {
      if (videos.length === 0) {
        resetStudioState();
      } else {
        // 하이라이트 전에는 임시 클립을 만들지 않는다 (원본 영상 미리보기 모드)
        setSegments((prev) => (prev.length > 0 ? [] : prev));
        setSelectedSegmentId('');
      }
    }

    let effectiveTitle = overlayOptions.titleText || dict.player.defaultTitleText;
    const isDefaultOrEmptyTitle =
      !overlayOptions.titleText ||
      !overlayOptions.titleText.trim() ||
      overlayOptions.titleText.trim() === dict.player.defaultTitleText.trim();

    if (result?.suggestedTitle && appliedSuggestedTitleRef.current !== result.suggestedTitle) {
      appliedSuggestedTitleRef.current = result.suggestedTitle;
      if (isDefaultOrEmptyTitle || overlayOptions.titleText === result.suggestedTitle) {
        effectiveTitle = result.suggestedTitle;
        setOverlayOptions((prev) => ({
          ...prev,
          titleText: result.suggestedTitle!,
          showTitle: true,
        }));
      }
    }

    // 영상 병합 결과가 새로 생성/갱신되었을 때(AI 하이라이트 완료 또는 다시 병합 완료) 기준 스냅샷 동기화
    if (result?.url && result.url !== lastStitchedResultUrlRef.current) {
      lastStitchedResultUrlRef.current = result.url;
      const baselineOverlay: VideoOverlayOptions = {
        ...effectiveOverlayOptions,
        titleText: effectiveTitle,
      };
      const baselineSegments =
        result.segments && result.segments.length > 0 ? result.segments : segments;
      setLastStitchedSnapshot(
        computeStitchSnapshot(
          baselineSegments,
          baselineOverlay,
          selectedBgmId,
          bgmVolume,
          customAudioFile
        )
      );
    } else if (!result?.url) {
      lastStitchedResultUrlRef.current = null;
      setLastStitchedSnapshot(null);
    }

    if (result?.thumbnailUrl) {
      setThumbnailUrl(result.thumbnailUrl);
    }

    // 썸네일용 클린 배경 프레임 캔버스 캡처/캐싱 (실시간 타이틀 편집 지원)
    // 주의: 이미 텍스트가 박힌 thumbnailUrl은 절대 배경 캔버스로 사용하지 않음
    const prepareThumbnailBg = async () => {
      const currentThumbKey = `${result?.bestSourceVideoId}_${result?.bestThumbnailTime}_${result?.bestThumbnailRotation}_${result?.bestThumbnailCropOffsetYRatio}`;
      if (lastPreparedThumbKeyRef.current === currentThumbKey && thumbnailBgCanvasRef.current) {
        return;
      }

      try {
        let bg: HTMLCanvasElement | null = null;
        const targetVideo =
          videos.find((v) => v.id === result?.bestSourceVideoId) || videos[0];

        // 1. 소스 비디오에서 직접 캡처 시도 (오버레이 및 문구 일체 없는 순수 원본 영상)
        if (targetVideo?.url && targetVideo.file && targetVideo.file.size > 0) {
          const targetTime =
            result?.bestThumbnailTime && result.bestThumbnailTime > 0.05
              ? result.bestThumbnailTime
              : (result?.segments && result.segments[0]
                  ? result.segments[0].start + Math.max(0.5, result.segments[0].duration * 0.4)
                  : 0.5);

          const rot = result?.bestThumbnailRotation ?? result?.segments?.[0]?.rotation ?? 0;
          const crop = result?.bestThumbnailCropOffsetYRatio ?? result?.segments?.[0]?.cropOffsetYRatio ?? 0.2;
          const cropX = result?.segments?.[0]?.cropOffsetXRatio ?? 0.5;

          try {
            bg = await captureVideoFrameAtTime(
              targetVideo.url,
              targetTime,
              crop,
              thumbWidth,
              thumbHeight,
              rot,
              cropX
            );
          } catch (e) {
            console.warn('prepareThumbnailBg: Source capture failed, falling back to clean dataUrl:', e);
          }
        }

        // 2. 소스 비디오 캡처 실패 시, 저장된 클린 이미지(dataUrl) 활용
        if (!bg && result?.cleanThumbnailUrl) {
          try {
            bg = await createCanvasFromImageDataUrl(result.cleanThumbnailUrl, thumbWidth, thumbHeight);
          } catch {}
        } else if (!bg && result?.bestThumbnailCleanDataUrl) {
          try {
            bg = await createCanvasFromImageDataUrl(result.bestThumbnailCleanDataUrl, thumbWidth, thumbHeight);
          } catch {}
        }

        if (bg) {
          thumbnailBgCanvasRef.current = bg;
          lastPreparedThumbKeyRef.current = currentThumbKey;
          // 클로저의 옛날 titleText 대신 계산된 effectiveTitle을 적용하여 썸네일 불일치 원천 방지
          const titleToRender = effectiveTitle || overlayOptions.titleText;
          const artCanvas = renderThumbnailArtwork(bg, {
            titleText: titleToRender,
            channelText: '',
            badgeText: '',
            showTitle: showThumbnailTitle && Boolean(titleToRender?.trim()),
            showBadge: false,
            showChannel: false,
            stylePreset: thumbnailStyle,
          });
          const newThumbUrl = artCanvas.toDataURL('image/jpeg', 0.95);
          setThumbnailUrl(newThumbUrl);
          if (result && result.thumbnailUrl !== newThumbUrl) {
            onUpdateFinalResult?.({
              ...result,
              thumbnailUrl: newThumbUrl,
            });
          }
        }
      } catch (err) {
        console.warn('Failed to prepare thumbnail background canvas:', err);
      }
    };

    if (result) {
      prepareThumbnailBg();
    }
  }, [
    result?.url,
    result?.bestSourceVideoId,
    result?.bestThumbnailTime,
    result?.suggestedTitle,
    dict.player.defaultTitleText,
    autoSortByRecordedDate,
    videoMap,
  ]);

  // 타이틀/스타일 변경 시 실시간 썸네일 재렌더링
  useEffect(() => {
    const renderWithBg = (bg: HTMLCanvasElement) => {
      try {
        const artCanvas = renderThumbnailArtwork(bg, {
          titleText: overlayOptions.titleText,
          channelText: '',
          badgeText: '',
          showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
          showBadge: false,
          showChannel: false,
          stylePreset: thumbnailStyle,
        });
        const newThumb = artCanvas.toDataURL('image/jpeg', 0.95);
        setThumbnailUrl(newThumb);
        if (result && result.thumbnailUrl !== newThumb) {
          onUpdateFinalResult?.({
            ...result,
            thumbnailUrl: newThumb,
          });
        }
      } catch (e) {
        console.warn('Live thumbnail render failed:', e);
      }
    };

    if (thumbnailBgCanvasRef.current) {
      renderWithBg(thumbnailBgCanvasRef.current);
    } else if (result?.cleanThumbnailUrl) {
      createCanvasFromImageDataUrl(result.cleanThumbnailUrl, thumbWidth, thumbHeight)
        .then((bg) => {
          thumbnailBgCanvasRef.current = bg;
          renderWithBg(bg);
        })
        .catch(() => {});
    }
  }, [
    overlayOptions.titleText,
    thumbnailStyle,
    showThumbnailTitle,
    result?.cleanThumbnailUrl,
  ]);

  // 재생 가능한 로컬 원본 비디오 소스 유무 판별
  const hasPlayableSourceVideos = useMemo(
    () => videos.some((v) => v.url && (!v.file || v.file.size > 0) && !v.isMissingFile),
    [videos]
  );

  // 하이라이트 전 원본 영상 미리보기 모드 (시퀀스 클립이 없는 상태)
  const isDraftPreview = segments.length === 0;
  // 시퀀스 하이라이트 모드 여부 (캡컷 방식 실시간 시퀀스 프리뷰: 원본 소스가 있거나 완성본이 아직 없는 경우)
  // 원본 소스가 기기 메모리 정리로 분리되었더라도 완성본 비디오(result.url)가 있다면 캔버스 합성이 아닌 완성본 직접 재생 모드로 전환
  const isSequenceMode = segments.length > 0 && (hasPlayableSourceVideos || !result?.url);
  // 아직 AI 컷이 없는 "처음 만드는" 흐름인지 여부 (9단계 vs 9단계 스텝바 분기)
  const isCreationFlow = segments.length === 0;
  const studioSteps = isCreationFlow ? CREATE_STUDIO_STEPS : EDIT_STUDIO_STEPS;
  const activeStudioStepIndex = Math.max(
    0,
    studioSteps.findIndex((step) => step.id === activeSection)
  );
  const activeStudioStep = studioSteps[activeStudioStepIndex] || studioSteps[0];
  // 인트로/브릿지/아웃트로는 AI 컷이 없어도 캔버스 단독으로 미리볼 수 있다.
  // 인트로 스타일 단계도 같은 인트로 캔버스를 보여주고, 토글을 꺼도 타이틀 카드는 그대로 미리보여 준다.
  const standalonePreviewSection: 'intro' | 'bridge' | 'outro' | null = !isSequenceMode
    ? activeSection === 'introStyle'
      ? 'intro'
      : activeSection === 'intro' || activeSection === 'bridge' || activeSection === 'outro'
        ? activeSection
        : null
    : null;

  // AI 분석이 끝나 컷이 처음 생기면 생성 흐름에서 편집 흐름의 '컷'으로 자연스럽게 이동한다.
  const hadSegmentsRef = useRef<boolean>(initialSegments.length > 0);
  useEffect(() => {
    if (segments.length > 0 && !hadSegmentsRef.current) {
      hadSegmentsRef.current = true;
      musicPanelPinnedRef.current = false;
      setActiveSection('cut');
      if (segments[0]) setSelectedSegmentId(segments[0].id);
      return;
    }
    if (segments.length === 0 && hadSegmentsRef.current) {
      hadSegmentsRef.current = false;
      setActiveSection('intro');
    }
  }, [segments]);
  // 실제 하이라이트 결과가 있을 때만 시간 절약률을 계산/노출한다
  const hasHighlight = segments.length > 0;

  // 마지막으로 내보내기(Export)된 캐시 영상 대비 현재 편집 변경 여부 감지
  const isModified = useMemo(() => {
    if (!result?.url || !result?.blob || result.blob.size === 0 || !lastStitchedSnapshot) {
      return true;
    }
    const currentSnapshot = computeStitchSnapshot(
      segments,
      effectiveOverlayOptions,
      selectedBgmId,
      bgmVolume,
      customAudioFile
    );
    return currentSnapshot !== lastStitchedSnapshot;
  }, [
    result?.url,
    result?.blob,
    lastStitchedSnapshot,
    segments,
    effectiveOverlayOptions,
    selectedBgmId,
    bgmVolume,
    customAudioFile,
  ]);

  // 미리보기 모드 및 시퀀스 재생에서 사용할 원본 영상 (기본: 첫 번째 영상)
  const [previewVideoId, setPreviewVideoId] = useState<string>('');
  const previewVideo = useMemo(
    () => videos.find((v) => v.id === previewVideoId) || videos[0] || null,
    [videos, previewVideoId]
  );
  // 메타데이터 추출 전에도 정확한 길이를 쓰기 위한 <video> 실제 길이
  const [previewNativeDuration, setPreviewNativeDuration] = useState<number>(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // 실시간 WYSIWYG 캔버스 프리뷰 (가로 1280x720 / 세로 720x1280) 및 커스텀 인트로/아웃트로/BGM 오디오 레퍼런스
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const introCustomVideoRef = useRef<HTMLVideoElement | null>(null);
  const outroCustomVideoRef = useRef<HTMLVideoElement | null>(null);
  const [introCustomDuration, setIntroCustomDuration] = useState<number>(1.6);
  const [outroCustomDuration, setOutroCustomDuration] = useState<number>(1.8);
  const bridgePreviewCacheRef = useRef<{
    key: string;
    ctrl: ReturnType<typeof createHyperframesBridgeController>;
  } | null>(null);
  // GSAP 기반 프리뷰 렌더러(인트로/아웃트로, 챕터 브리지)는 해당 구간에 진입할 때만 지연 로딩한다.
  const previewIntroOutroRef = useRef<typeof import('../../services/previewCompositorIntroOutro.ts') | null>(null);
  const previewIntroOutroLoadingRef = useRef(false);
  const bridgeRendererRef = useRef<typeof import('../../services/hyperframesBridgeRenderer.ts') | null>(null);
  const bridgeRendererLoadingRef = useRef(false);
  const [previewRendererReady, setPreviewRendererReady] = useState(false);
  // AI 컷이 없을 때 인트로/브릿지/아웃트로를 캔버스 단독으로 재생하기 위한 상태
  const standalonePreviewPlayingRef = useRef(false);
  const standalonePreviewRafRef = useRef<number | null>(null);

  // 실시간 배경음악(BGM) 오디오 엘리먼트 / Web Audio GainNode / 프리셋 신스 루프
  const bgmAudioElRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioUrlRef = useRef<string | null>(null);
  const bgmWebAudioCtxRef = useRef<AudioContext | null>(null);
  const bgmGainNodeRef = useRef<GainNode | null>(null);
  const bgmSynthStopRef = useRef<(() => void) | null>(null);

  // 시퀀스 재생 루프 상태 레퍼런스
  const currentTimeRef = useRef<number>(0);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  const isSequencePlayingRef = useRef<boolean>(false);
  const seqPlayRafRef = useRef<number | null>(null);
  const seqLastFrameTsRef = useRef<number>(0);
  const seqLastStateSyncTsRef = useRef<number>(0);
  const activeSequencePhaseRef = useRef<string>('');

  // 커스텀 인트로 비디오 로드 및 실제 길이 측정
  useEffect(() => {
    if (!overlayOptions.introVideoFile) {
      if (introCustomVideoRef.current) {
        try {
          introCustomVideoRef.current.pause();
          introCustomVideoRef.current.removeAttribute('src');
          introCustomVideoRef.current.load();
        } catch {}
        introCustomVideoRef.current = null;
      }
      setIntroCustomDuration(1.6);
      return;
    }
    const url = URL.createObjectURL(overlayOptions.introVideoFile);
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, 6.0) : 2.0;
      setIntroCustomDuration(Math.round(dur * 10) / 10);
    };
    introCustomVideoRef.current = v;
    return () => {
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch {}
      URL.revokeObjectURL(url);
    };
  }, [overlayOptions.introVideoFile]);

  // 커스텀 아웃트로 비디오 로드 및 실제 길이 측정
  useEffect(() => {
    if (!overlayOptions.outroVideoFile) {
      if (outroCustomVideoRef.current) {
        try {
          outroCustomVideoRef.current.pause();
          outroCustomVideoRef.current.removeAttribute('src');
          outroCustomVideoRef.current.load();
        } catch {}
        outroCustomVideoRef.current = null;
      }
      setOutroCustomDuration(1.8);
      return;
    }
    const url = URL.createObjectURL(overlayOptions.outroVideoFile);
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, 6.0) : 2.2;
      setOutroCustomDuration(Math.round(dur * 10) / 10);
    };
    outroCustomVideoRef.current = v;
    return () => {
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch {}
      URL.revokeObjectURL(url);
    };
  }, [overlayOptions.outroVideoFile]);

  // 언마운트 시 HyperFrames 브릿지 컨트롤러 및 BGM 리소스 정리
  useEffect(() => {
    return () => {
      if (bridgePreviewCacheRef.current) {
        bridgePreviewCacheRef.current.ctrl.dispose();
        bridgePreviewCacheRef.current = null;
      }
      if (bgmSynthStopRef.current) {
        bgmSynthStopRef.current();
        bgmSynthStopRef.current = null;
      }
      if (bgmAudioElRef.current) {
        try {
          bgmAudioElRef.current.pause();
        } catch {}
        bgmAudioElRef.current = null;
      }
      if (bgmAudioUrlRef.current) {
        URL.revokeObjectURL(bgmAudioUrlRef.current);
        bgmAudioUrlRef.current = null;
      }
      if (bgmWebAudioCtxRef.current && bgmWebAudioCtxRef.current.state !== 'closed') {
        bgmWebAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // 활성 비디오 소스 URL (원본 비디오가 있으면 실시간 프리뷰에 사용, 원본이 분리되고 완성본이 있다면 완성본 비디오 사용)
  const activeVideoUrl = useMemo(() => {
    if (hasPlayableSourceVideos) {
      if (previewVideo?.url) return previewVideo.url;
      if (videos[0]?.url) return videos[0].url;
    }
    if (result?.url) return result.url;
    if (previewVideo?.url) return previewVideo.url;
    if (videos[0]?.url) return videos[0].url;
    return null;
  }, [hasPlayableSourceVideos, previewVideo?.url, videos, result?.url]);

  // 모바일에서 왼쪽 플레이어 열이 불필요한 경우를 숨긴다.
  // 1) 생성 흐름에서 미리보기할 영상이 하나도 없을 때(빈 플레이어) — 업로드/AI 카드가 같은 CTA를 제공한다.
  // 2) 다운로드 단계 — 저장 카드가 썸네일·길이·구성을 요약해 보여주므로 플레이어가 화면을 차지할 필요가 없다.
  // (데스크탑은 좌측 모니터를 채우는 온보딩 히어로/최종 확인용으로 남긴다)
  const hidePlayerColumnForMobile =
    isMobileViewport &&
    ((isCreationFlow && !activeVideoUrl && !standalonePreviewSection) ||
      activeSection === 'download');
  // 플레이어 카드와 타임라인 카드를 분리해, 모바일에서 플레이어만 상단에 고정한다.
  const showDraftPreviewBox =
    isDraftPreview &&
    videos.length > 0 &&
    (!isMobileViewport || activeSection === 'upload' || activeSection === 'ai');
  const showTimelineSequencer =
    segments.length > 0 &&
    (!isMobileViewport || activeSection === 'cut' || activeSection === 'caption' || activeSection === 'bridge');

  // 드래프트 모드에서만 비디오 변경 시 재생 초기화
  useEffect(() => {
    if (isSequenceMode) return;
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    setCurrentTime(0);
    setIsPlaying(false);
    setPreviewNativeDuration(0);
    setPlaybackError(null);
  }, [activeVideoUrl, isSequenceMode]);

  // 인트로, 아웃트로 및 챕터 브릿지 실제 적용 시간 (실시간 즉시 반영)
  const introDuration = overlayOptions.showIntro
    ? (overlayOptions.introVideoFile ? introCustomDuration : (overlayOptions.introDurationSec || 2.0))
    : 0;
  const outroDuration = overlayOptions.showOutro
    ? (overlayOptions.outroVideoFile ? outroCustomDuration : (overlayOptions.outroDurationSec || 2.2))
    : 0;
  const effectiveBridgeDurationMap = useMemo(() => {
    return computeBridgeDurationMap(segments, overlayOptions);
  }, [segments, overlayOptions]);

  // 총 시간 계산 (인트로 + 클립 + 챕터 브릿지 + 아웃트로 실시간 합산: 클립 제거/조절 시 즉시 갱신)
  const totalDuration = useMemo(() => {
    if (isDraftPreview) {
      const d = previewNativeDuration || previewVideo?.duration || 0;
      return d > 0 ? d : 1;
    }
    const segsAndBridges = segments.reduce(
      (sum, s) => sum + s.duration + (effectiveBridgeDurationMap[s.id] ?? 0),
      0
    );
    const computed = Math.round((introDuration + segsAndBridges + outroDuration) * 10) / 10;
    if (computed > 0) return computed;
    if (result?.duration && result.duration > 0) return result.duration;
    return 1;
  }, [
    isDraftPreview,
    previewNativeDuration,
    previewVideo?.duration,
    segments,
    effectiveBridgeDurationMap,
    introDuration,
    outroDuration,
    result?.duration,
  ]);

  // 원본 영상 총 시간
  const originalTotalDuration = useMemo(() => {
    return videos.reduce((sum, v) => sum + v.duration, 0);
  }, [videos]);

  // 시간 절약 퍼센트 (하이라이트가 만들어진 뒤에만 의미 있음)
  const savedPercent = useMemo(() => {
    if (!hasHighlight) return 0;
    if (!originalTotalDuration || originalTotalDuration <= 0) return 0;
    return Math.max(0, Math.round((1 - totalDuration / originalTotalDuration) * 100));
  }, [hasHighlight, totalDuration, originalTotalDuration]);

  // 구간별 누적 시작 오프셋 (챕터 브릿지 구간 시간 반영)
  const segmentTimelineOffsets = useMemo(() => {
    let acc = introDuration;
    const offsets: Record<
      string,
      { bridgeStartOffset: number; startOffset: number; endOffset: number; bridgeDuration: number }
    > = {};
    segments.forEach((s) => {
      const bridgeDur = effectiveBridgeDurationMap[s.id] ?? 0;
      const bridgeStart = acc;
      acc += bridgeDur;
      offsets[s.id] = {
        bridgeStartOffset: bridgeStart,
        startOffset: acc,
        endOffset: acc + s.duration,
        bridgeDuration: bridgeDur,
      };
      acc += s.duration;
    });
    return offsets;
  }, [segments, introDuration, effectiveBridgeDurationMap]);

  // 현재 선택된 컷의 실제 인덱스 (인트로/아웃트로 선택 시 마지막 유효 컷 기준)
  const selectedSegmentIndex = useMemo(() => {
    const idx = segments.findIndex((s) => s.id === selectedSegmentId);
    return idx >= 0 ? idx : 0;
  }, [segments, selectedSegmentId]);

  // 날짜/장소가 바뀌어 브릿지가 "들어갈 수 있는" 경계 목록 (꺼진 곳 포함)
  const bridgeCandidateIndexes = useMemo(() => {
    const list: number[] = [];
    for (let i = 1; i < segments.length; i++) {
      const info = evaluateChapterBridge(
        segments[i - 1],
        { ...segments[i], skipChapterBridge: false },
        i,
        segments.length,
        { ...overlayOptions, showChapterBridge: true }
      );
      if (info.shouldBridge) list.push(i);
    }
    return list;
  }, [segments, overlayOptions]);

  // 실제로 타임라인에 렌더링 중인 브릿지 경계 목록
  const activeBridgeIndexes = useMemo(
    () => bridgeCandidateIndexes.filter((i) => (effectiveBridgeDurationMap[segments[i]?.id] ?? 0) > 0),
    [bridgeCandidateIndexes, effectiveBridgeDurationMap, segments]
  );

  // 5번 브릿지 단계에서 보여줄 경계 (선택된 컷과 가장 가까운 후보)
  const effectiveBridgeIndex = useMemo(() => {
    if (bridgeCandidateIndexes.includes(selectedBridgeIndex)) return selectedBridgeIndex;
    const nearest =
      bridgeCandidateIndexes.find((i) => i >= selectedSegmentIndex) ??
      bridgeCandidateIndexes[bridgeCandidateIndexes.length - 1];
    return nearest ?? 1;
  }, [bridgeCandidateIndexes, selectedBridgeIndex, selectedSegmentIndex]);

  // 현재 브릿지 경계의 상세 정보 (skip 여부와 무관하게 날짜/장소를 보여주기 위해 skip을 무시하고 계산)
  const selectedBridgeDetail = useMemo(() => {
    const idx = effectiveBridgeIndex;
    const prev = segments[idx - 1];
    const seg = segments[idx];
    if (!prev || !seg) return null;
    return {
      idx,
      prev,
      seg,
      info: evaluateChapterBridge(prev, { ...seg, skipChapterBridge: false }, idx, segments.length, {
        ...overlayOptions,
        showChapterBridge: true,
      }),
      isEnabled: (effectiveBridgeDurationMap[seg.id] ?? 0) > 0,
    };
  }, [segments, effectiveBridgeIndex, overlayOptions, effectiveBridgeDurationMap]);

  // AI 컷이 없어도 브릿지 스타일을 미리 볼 수 있도록 샘플 날짜/장소 전환 정보를 만든다.
  const creationBridgePreviewInfo = useMemo(() => {
    const first = videos[0];
    const second = videos[1] || videos[0];
    const sampleDateA = ui('9월 10일');
    const sampleDateB = ui('9월 12일');
    const sampleDateC = ui('9월 14일');
    const sampleLocationA = ui('서울');
    const sampleLocationB = ui('부산');
    const sampleLocationC = ui('강릉');
    const fromDate = first?.metadataDate?.trim() || sampleDateA;
    const fromLocation = first?.locationName?.trim() || sampleLocationA;
    let toDate = second?.metadataDate?.trim() || sampleDateB;
    let toLocation = second?.locationName?.trim() || sampleLocationB;
    if (toDate === fromDate) toDate = fromDate === sampleDateB ? sampleDateC : sampleDateB;
    if (toLocation === fromLocation) {
      toLocation = fromLocation === sampleLocationB ? sampleLocationC : sampleLocationB;
    }
    const prevSegment: HighlightSegment = {
      id: 'bridge-preview-prev',
      sourceVideoId: first?.id || 'bridge-preview-prev',
      sourceVideoName: first?.name || ui('첫 장면'),
      start: 0,
      end: 1,
      duration: 1,
      reason: '',
      subtitleDate: fromDate,
      locationName: fromLocation,
    };
    const nextSegment: HighlightSegment = {
      id: 'bridge-preview-next',
      sourceVideoId: second?.id || 'bridge-preview-next',
      sourceVideoName: second?.name || ui('다음 장면'),
      start: 0,
      end: 1,
      duration: 1,
      reason: '',
      subtitleDate: toDate,
      locationName: toLocation,
    };
    return evaluateChapterBridge(prevSegment, nextSegment, 1, 2, {
      ...effectiveOverlayOptions,
      showChapterBridge: true,
      showDate: true,
    });
  }, [videos, effectiveOverlayOptions, ui]);

  const calculatedBgmSpeed = useMemo(() => {
    if (!customAudioDuration || customAudioDuration <= 0 || !totalDuration || totalDuration <= 0) return null;
    const rate = customAudioDuration / totalDuration;
    return rate.toFixed(2);
  }, [customAudioDuration, totalDuration]);

  // 시퀀스 타임라인용 배경음악(A1) 구간 블록 계산 (1회차 원곡 재생 구간 + 초과 시 반복 재생 구간)
  const audioTimelineBlocks = useMemo(() => {
    if (!customAudioFile || !customAudioDuration || customAudioDuration <= 0 || totalDuration <= 0) {
      return [];
    }
    // 영상 길이에 배속 자동 조절 활성화 시 100% 길이의 단일 블록으로 표시
    if (overlayOptions.bgmFitToVideo) {
      return [
        {
          cycleIndex: 0,
          startSec: 0,
          endSec: Math.round(totalDuration * 10) / 10,
          durationSec: Math.round(totalDuration * 10) / 10,
          widthPct: 100,
          isLoop: false,
        },
      ];
    }
    const blocks: Array<{
      cycleIndex: number;
      startSec: number;
      endSec: number;
      durationSec: number;
      widthPct: number;
      isLoop: boolean;
    }> = [];
    let cursor = 0;
    let cycle = 0;
    while (cursor < totalDuration - 0.05 && cycle < 20) {
      const remaining = totalDuration - cursor;
      const dur = Math.min(customAudioDuration, remaining);
      blocks.push({
        cycleIndex: cycle,
        startSec: Math.round(cursor * 10) / 10,
        endSec: Math.round((cursor + dur) * 10) / 10,
        durationSec: Math.round(dur * 10) / 10,
        widthPct: (dur / totalDuration) * 100,
        isLoop: cycle > 0,
      });
      cursor += dur;
      cycle++;
    }
    return blocks;
  }, [customAudioFile, customAudioDuration, totalDuration, overlayOptions.bgmFitToVideo]);

  const isMusicExceeded = Boolean(
    !overlayOptions.bgmFitToVideo &&
    customAudioFile &&
    customAudioDuration &&
    customAudioDuration > 0 &&
    totalDuration > customAudioDuration + 0.15
  );

  const isMusicTrimmed = Boolean(
    !overlayOptions.bgmFitToVideo &&
    customAudioFile &&
    customAudioDuration &&
    customAudioDuration > totalDuration + 0.5 &&
    !isMusicExceeded
  );

  const musicOverflowSec = useMemo(() => {
    if (!isMusicExceeded || !customAudioDuration) return 0;
    return Math.max(0, Math.round((totalDuration - customAudioDuration) * 10) / 10);
  }, [isMusicExceeded, totalDuration, customAudioDuration]);

  // 음악 1회차 길이를 초과하는 뒷부분 클립 자동 제외 (최소 1개 클립 유지)
  const handleFitSegmentsToMusic = () => {
    if (!customAudioDuration || customAudioDuration <= 0 || segments.length <= 1) return;
    const kept: HighlightSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const candidate = [...kept, segments[i]];
      const bridgeMap = computeBridgeDurationMap(candidate, overlayOptions);
      const segsDur = candidate.reduce((sum, s) => sum + s.duration + (bridgeMap[s.id] ?? 0), 0);
      const candidateTotal = introDuration + segsDur + outroDuration;
      if (candidateTotal <= customAudioDuration + 0.15 || kept.length === 0) {
        kept.push(segments[i]);
      } else {
        break;
      }
    }
    const removedCount = segments.length - kept.length;
    if (removedCount > 0) {
      const prevSegments = [...segments];
      const prevSelectedId = selectedSegmentId;
      setSegments(kept);
      if (!kept.some((s) => s.id === selectedSegmentId)) {
        setSelectedSegmentId(kept[0]?.id || '');
      }
      notify.action(
        interpolate(
          dict.sequencer.fitMusicToast || '음악 길이({duration})를 넘기는 {count}개 구간을 제외했어요.',
          { duration: formatSec(customAudioDuration), count: removedCount }
        ),
        dict.common?.undo || '되돌리기',
        () => {
          setSegments(prevSegments);
          setSelectedSegmentId(prevSelectedId);
          return { title: dict.toasts.clipsRestored, action: null };
        }
      );
    }
  };

  // 타임라인 시점(0 ~ totalDuration)을 인트로 / 챕터 브릿지 / 클립 / 아웃트로 페이즈로 해석
  type TimelineResolution =
    | { phase: 'draft'; mediaTime: number; videoId?: string }
    | { phase: 'intro'; elapsed: number; duration: number; nextSeg?: HighlightSegment }
    | {
        phase: 'bridge';
        seg: HighlightSegment;
        segIndex: number;
        elapsed: number;
        duration: number;
      }
    | {
        phase: 'segment';
        seg: HighlightSegment;
        segIndex: number;
        elapsed: number;
        duration: number;
        mediaTime: number;
        videoId: string;
      }
    | { phase: 'outro'; elapsed: number; duration: number; prevSeg?: HighlightSegment };

  const resolveTimelineAt = (timelineTime: number): TimelineResolution => {
    const clamped = Math.max(0, Math.min(totalDuration, timelineTime));
    if (!isSequenceMode || segments.length === 0) {
      return { phase: 'draft', mediaTime: clamped, videoId: previewVideo?.id };
    }
    if (introDuration > 0 && clamped < introDuration) {
      return {
        phase: 'intro',
        elapsed: clamped,
        duration: introDuration,
        nextSeg: segments[0],
      };
    }
    if (outroDuration > 0 && clamped >= totalDuration - outroDuration - 0.001) {
      const outroStart = Math.max(0, totalDuration - outroDuration);
      return {
        phase: 'outro',
        elapsed: Math.max(0, clamped - outroStart),
        duration: outroDuration,
        prevSeg: segments[segments.length - 1],
      };
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const offset = segmentTimelineOffsets[seg.id];
      if (!offset) continue;
      const isLast = i === segments.length - 1 && outroDuration === 0;
      if (
        clamped >= offset.bridgeStartOffset &&
        (isLast ? clamped <= offset.endOffset + 0.5 : clamped < offset.endOffset)
      ) {
        if (offset.bridgeDuration > 0 && clamped < offset.startOffset) {
          return {
            phase: 'bridge',
            seg,
            segIndex: i,
            elapsed: Math.max(0, clamped - offset.bridgeStartOffset),
            duration: offset.bridgeDuration,
          };
        }
        const elapsed = Math.max(0, clamped - offset.startOffset);
        const mediaTime = Math.min(seg.end, Math.max(seg.start, seg.start + elapsed));
        return {
          phase: 'segment',
          seg,
          segIndex: i,
          elapsed,
          duration: seg.duration,
          mediaTime,
          videoId: seg.sourceVideoId,
        };
      }
    }

    const fallbackSeg = segments[segments.length - 1] || segments[0];
    return {
      phase: 'segment',
      seg: fallbackSeg,
      segIndex: Math.max(0, segments.length - 1),
      elapsed: fallbackSeg.duration,
      duration: fallbackSeg.duration,
      mediaTime: fallbackSeg.end,
      videoId: fallbackSeg.sourceVideoId,
    };
  };

  // 타임라인 위치(플레이헤드)에 따라 오른쪽 편집 패널을 인트로/컷/브릿지/아웃트로로 자동 전환한다.
  // - 재생 중에는 눈이 피로하지 않도록 전환하지 않고, 스크럽/클릭/시크 시에만 동기화한다.
  // - 7번 노래 패널을 직접 연 상태에서는 사용자가 타임라인 블록을 누르기 전까지 유지한다.
  const syncSectionForTime = (timelineTime: number) => {
    if (segments.length === 0 || isSequencePlayingRef.current || musicPanelPinnedRef.current || sectionSyncSuppressRef.current) return;
    const res = resolveTimelineAt(timelineTime);
    if (res.phase === 'intro') {
      setActiveSection('intro');
    } else if (res.phase === 'bridge') {
      setActiveSection('bridge');
      setSelectedBridgeIndex(res.segIndex);
      setSelectedSegmentId(res.seg.id);
    } else if (res.phase === 'segment') {
      // 자막 단계에서 씬을 훑는 중이면 자막 패널을 유지하고, 아니면 컷 패널로 전환한다.
      setActiveSection((prev) => (prev === 'caption' ? 'caption' : 'cut'));
      setSelectedSegmentId(res.seg.id);
    } else if (res.phase === 'outro') {
      setActiveSection('outro');
    }
  };

  // 현재 재생 중인 시간대에 위치한 세그먼트 자동 감지 (재병합 없이 실시간 동작)
  const activePlayingSegmentId = useMemo(() => {
    if (!isSequenceMode) return selectedSegmentId;
    if (introDuration > 0 && currentTime < introDuration) {
      return 'intro';
    }
    if (outroDuration > 0 && currentTime >= totalDuration - outroDuration) {
      return 'outro';
    }
    let acc = introDuration;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const bridgeDur = effectiveBridgeDurationMap[seg.id] ?? 0;
      const segBlockStart = acc;
      const segEnd = acc + bridgeDur + seg.duration;
      const isLast = i === segments.length - 1 && outroDuration === 0;
      if (currentTime >= segBlockStart && (isLast ? currentTime <= totalDuration + 2.0 : currentTime < segEnd)) {
        return seg.id;
      }
      acc = segEnd;
    }
    return selectedSegmentId;
  }, [currentTime, segments, isSequenceMode, effectiveBridgeDurationMap, introDuration, outroDuration, totalDuration, selectedSegmentId]);

  // 플레이헤드가 브릿지 구간 안에 있을 때 해당 브릿지의 "다음 컷" 인덱스를 돌려준다.
  // 브릿지 재생 중에는 다음 컷 블록에 초록 테두리가 켜지지 않도록 컷 하이라이트와 분리한다.
  const activePlayingBridgeIndex = useMemo(() => {
    if (!isSequenceMode) return null;
    for (let i = 0; i < segments.length; i++) {
      const offset = segmentTimelineOffsets[segments[i].id];
      if (!offset || offset.bridgeDuration <= 0) continue;
      if (currentTime >= offset.bridgeStartOffset && currentTime < offset.startOffset) {
        return i;
      }
    }
    return null;
  }, [currentTime, segments, segmentTimelineOffsets, isSequenceMode]);

  // 현재 활성 재생 중인 세그먼트 객체
  const activePlayingSegment = useMemo(() => {
    return (
      segments.find((s) => s.id === activePlayingSegmentId) ||
      segments.find((s) => s.id === selectedSegmentId) ||
      segments[0]
    );
  }, [segments, activePlayingSegmentId, selectedSegmentId]);

  // 실시간 미리보기에 띄울 자막 (날짜/위치는 상단 문구 아래로 이동하고 씬 제목만 표시)
  const activePlayingSubtitleText = useMemo(() => {
    if (!activePlayingSegment) return '';
    const titlePart = activePlayingSegment.subtitleTitle || activePlayingSegment.reason || '';
    return titlePart.trim();
  }, [activePlayingSegment]);

  // 실시간 미리보기 영상 좌측 상단 문구 아래 표시할 날짜 및 위치 (흰색 글씨)
  const activePlayingMetaText = useMemo(() => {
    if (!activePlayingSegment) return '';
    const datePart =
      overlayOptions.showDate === false
        ? ''
        : activePlayingSegment.subtitleDate || overlayOptions.subtitleDateText || '';
    const locPart = activePlayingSegment.locationName || overlayOptions.subtitleLocationText || '';
    const parts = [datePart, locPart].filter(Boolean);
    return parts.join(' • ').trim();
  }, [
    activePlayingSegment,
    overlayOptions.showDate,
    overlayOptions.subtitleDateText,
    overlayOptions.subtitleLocationText,
  ]);

  // 실시간 BGM 파일 로드 및 GainNode 구성
  useEffect(() => {
    if (bgmAudioElRef.current) {
      try {
        bgmAudioElRef.current.pause();
      } catch {}
      bgmAudioElRef.current = null;
    }
    if (bgmAudioUrlRef.current) {
      URL.revokeObjectURL(bgmAudioUrlRef.current);
      bgmAudioUrlRef.current = null;
    }
    bgmGainNodeRef.current = null;

    if (!customAudioFile) return;

    const url = URL.createObjectURL(customAudioFile);
    bgmAudioUrlRef.current = url;
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        if (!bgmWebAudioCtxRef.current || bgmWebAudioCtxRef.current.state === 'closed') {
          bgmWebAudioCtxRef.current = new AudioCtx();
        }
        const ctx = bgmWebAudioCtxRef.current;
        const src = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = isMuted ? 0 : Math.min(2.5, Math.max(0, bgmVolume) * 1.4);
        src.connect(gain);
        gain.connect(ctx.destination);
        bgmGainNodeRef.current = gain;
      } else {
        audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, bgmVolume));
      }
    } catch {
      audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, bgmVolume));
    }

    bgmAudioElRef.current = audio;

    if (isSequencePlayingRef.current && isSequenceMode && !isMuted && bgmVolume > 0) {
      const dur = customAudioDuration && customAudioDuration > 0 ? customAudioDuration : audio.duration || 0;
      if (dur > 0) {
        audio.currentTime = currentTimeRef.current % dur;
      }
      bgmWebAudioCtxRef.current?.resume().catch(() => {});
      audio.play().catch(() => {});
    }
  }, [customAudioFile]);

  // BGM 볼륨 및 음소거 실시간 즉시 반영
  useEffect(() => {
    if (bgmGainNodeRef.current && bgmWebAudioCtxRef.current) {
      bgmGainNodeRef.current.gain.setValueAtTime(
        isMuted ? 0 : Math.min(2.5, Math.max(0, bgmVolume) * 1.4),
        bgmWebAudioCtxRef.current.currentTime
      );
    }
    if (bgmAudioElRef.current && !bgmGainNodeRef.current) {
      bgmAudioElRef.current.volume = isMuted ? 0 : Math.min(1, Math.max(0, bgmVolume));
    }
    if (!customAudioFile && isSequencePlayingRef.current && isSequenceMode) {
      if (bgmSynthStopRef.current) {
        bgmSynthStopRef.current();
        bgmSynthStopRef.current = null;
      }
      if (!isMuted && selectedBgmId !== 'none' && bgmVolume > 0) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          if (!bgmWebAudioCtxRef.current || bgmWebAudioCtxRef.current.state === 'closed') {
            bgmWebAudioCtxRef.current = new AudioCtx();
          }
          const ctx = bgmWebAudioCtxRef.current;
          ctx.resume().catch(() => {});
          const gain = ctx.createGain();
          gain.gain.value = Math.min(2.5, Math.max(0, bgmVolume) * 1.4);
          gain.connect(ctx.destination);
          bgmSynthStopRef.current = playBgmSynthLoop(ctx, gain, selectedBgmId, bgmVolume).stop;
        }
      }
    }
  }, [bgmVolume, isMuted, selectedBgmId, customAudioFile, isSequenceMode]);

  // BGM 배속 자동 조절 (영상 길이에 동기화) 실시간 반영
  useEffect(() => {
    if (!bgmAudioElRef.current) return;
    const audio = bgmAudioElRef.current;
    const fit = Boolean(overlayOptions.bgmFitToVideo);
    if (fit && customAudioDuration && customAudioDuration > 0 && totalDuration > 0) {
      const rate = customAudioDuration / totalDuration;
      audio.playbackRate = Math.max(0.25, Math.min(4.0, Number(rate.toFixed(3))));
      audio.preservesPitch = true;
      audio.loop = false;
    } else {
      audio.playbackRate = 1.0;
      audio.loop = true;
    }
  }, [overlayOptions.bgmFitToVideo, customAudioDuration, totalDuration]);

  // BGM 재생/일시정지/시크 동기화 헬퍼
  const syncBgmPlayback = (play: boolean, timelineSec?: number) => {
    if (!isSequenceMode) return;
    if (customAudioFile && bgmAudioElRef.current) {
      const audio = bgmAudioElRef.current;
      if (typeof timelineSec === 'number' && Number.isFinite(timelineSec)) {
        const dur =
          (customAudioDuration && customAudioDuration > 0 ? customAudioDuration : 0) ||
          (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0);
        if (dur > 0) {
          try {
            const fit = Boolean(overlayOptions.bgmFitToVideo);
            if (fit && totalDuration > 0) {
              audio.currentTime = Math.max(0, Math.min(dur, timelineSec * (dur / totalDuration)));
            } else {
              audio.currentTime = Math.max(0, timelineSec % dur);
            }
          } catch {}
        }
      }
      if (play && !isMutedRef.current && bgmVolume > 0) {
        bgmWebAudioCtxRef.current?.resume().catch(() => {});
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    } else {
      if (bgmSynthStopRef.current) {
        bgmSynthStopRef.current();
        bgmSynthStopRef.current = null;
      }
      if (play && !isMutedRef.current && selectedBgmId !== 'none' && bgmVolume > 0) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          if (!bgmWebAudioCtxRef.current || bgmWebAudioCtxRef.current.state === 'closed') {
            bgmWebAudioCtxRef.current = new AudioCtx();
          }
          const ctx = bgmWebAudioCtxRef.current;
          ctx.resume().catch(() => {});
          const gain = ctx.createGain();
          gain.gain.value = Math.min(2.5, Math.max(0, bgmVolume) * 1.4);
          gain.connect(ctx.destination);
          bgmSynthStopRef.current = playBgmSynthLoop(ctx, gain, selectedBgmId, bgmVolume).stop;
        }
      }
    }
  };

  // GSAP 기반 렌더러는 프리뷰에서 실제로 필요한 순간에만 로드한다.
  const ensurePreviewIntroOutroRenderer = () => {
    if (previewIntroOutroRef.current || previewIntroOutroLoadingRef.current) return;
    previewIntroOutroLoadingRef.current = true;
    void import('../../services/previewCompositorIntroOutro.ts')
      .then((mod) => {
        previewIntroOutroRef.current = mod;
        setPreviewRendererReady((v) => !v);
      })
      .catch((err) => {
        console.warn('[ProStudioView] 인트로/아웃트로 프리뷰 렌더러 로드 실패:', err);
      })
      .finally(() => {
        previewIntroOutroLoadingRef.current = false;
      });
  };

  const ensureBridgeRenderer = () => {
    if (bridgeRendererRef.current || bridgeRendererLoadingRef.current) return;
    bridgeRendererLoadingRef.current = true;
    void import('../../services/hyperframesBridgeRenderer.ts')
      .then((mod) => {
        bridgeRendererRef.current = mod;
        setPreviewRendererReady((v) => !v);
      })
      .catch((err) => {
        console.warn('[ProStudioView] 챕터 브리지 렌더러 로드 실패:', err);
      })
      .finally(() => {
        bridgeRendererLoadingRef.current = false;
      });
  };

  // WYSIWYG 캔버스 컴포지터 렌더링 (Export 결과물과 100% 동일한 프리뷰, 가로 16:9 / 세로 9:16)
  const renderCompositorAt = (timelineTime: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !isSequenceMode) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const res = resolveTimelineAt(timelineTime);
    const v = videoRef.current;

    if (res.phase === 'intro') {
      if (overlayOptions.introVideoFile) {
        const customIntroV = introCustomVideoRef.current;
        if (customIntroV) {
          if (!isSequencePlayingRef.current && Math.abs(customIntroV.currentTime - res.elapsed) > 0.05) {
            try {
              customIntroV.currentTime = res.elapsed;
            } catch {}
          }
          if (customIntroV.readyState >= 1) {
            drawCompositorCoverFrame(ctx, customIntroV, undefined, undefined, frame);
          } else {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, frame.width, frame.height);
          }
        } else {
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, frame.width, frame.height);
        }
        return;
      }

      const prog = res.duration > 0 ? res.elapsed / res.duration : 0;
      const introOutro = previewIntroOutroRef.current;
      if (!introOutro) {
        ensurePreviewIntroOutroRenderer();
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, frame.width, frame.height);
        return;
      }
      introOutro.drawCompositorIntroFrame(
        ctx,
        prog,
        effectiveOverlayOptions,
        frame
      );
      return;
    }

    if (res.phase === 'outro') {
      if (overlayOptions.outroVideoFile) {
        const customOutroV = outroCustomVideoRef.current;
        if (customOutroV) {
          if (!isSequencePlayingRef.current && Math.abs(customOutroV.currentTime - res.elapsed) > 0.05) {
            try {
              customOutroV.currentTime = res.elapsed;
            } catch {}
          }
          if (customOutroV.readyState >= 1) {
            drawCompositorCoverFrame(ctx, customOutroV, undefined, undefined, frame);
          } else {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, frame.width, frame.height);
          }
        } else {
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, frame.width, frame.height);
        }
        return;
      }

      const prog = res.duration > 0 ? res.elapsed / res.duration : 0;
      const introOutro = previewIntroOutroRef.current;
      if (!introOutro) {
        ensurePreviewIntroOutroRenderer();
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, frame.width, frame.height);
        return;
      }
      introOutro.drawCompositorOutroFrame(
        ctx,
        prog,
        effectiveOverlayOptions,
        frame
      );
      return;
    }

    if (res.phase === 'bridge') {
      const seg = res.seg;
      const prevSeg = res.segIndex > 0 ? segments[res.segIndex - 1] : undefined;
      const bridgeInfo = evaluateChapterBridge(
        prevSeg,
        seg,
        res.segIndex,
        segments.length,
        effectiveOverlayOptions
      );
      const cacheKey = `${seg.id}|${bridgeInfo.fromDate}|${bridgeInfo.toDate}|${bridgeInfo.fromLocation}|${bridgeInfo.toLocation}|${res.duration}`;
      const vItem = videoMap.get(seg.sourceVideoId) || videos[0];

      const bridgeRenderer = bridgeRendererRef.current;
      if (!bridgeRenderer) {
        ensureBridgeRenderer();
        const drawFallbackFrame =
          v && v.readyState >= 2
            ? () => drawCompositorCoverFrame(ctx, v, vItem, seg, frame)
            : undefined;
        drawFallbackFrame?.();
        return;
      }

      if (!bridgePreviewCacheRef.current || bridgePreviewCacheRef.current.key !== cacheKey) {
        bridgePreviewCacheRef.current?.ctrl.dispose();
        bridgePreviewCacheRef.current = {
          key: cacheKey,
          ctrl: bridgeRenderer.createHyperframesBridgeController(res.duration),
        };
      }
      const drawNextFrame =
        v && v.readyState >= 2
          ? () => drawCompositorCoverFrame(ctx, v, vItem, seg, frame)
          : undefined;

      bridgePreviewCacheRef.current.ctrl.seekAndRender(
        ctx,
        res.elapsed,
        frame.width,
        frame.height,
        bridgeInfo,
        drawNextFrame,
        drawNextFrame
      );
      return;
    }

    if (res.phase === 'segment') {
      const seg = res.seg;
      const vItem = videoMap.get(seg.sourceVideoId) || videos[0];
      if (v && v.readyState >= 2) {
        drawCompositorCoverFrame(
          ctx,
          v,
          vItem,
          seg,
          frame
        );
      }

      drawCompositorSegmentOverlay(
        ctx,
        effectiveOverlayOptions,
        seg,
        frame
      );
    }
  };

  // ============================================================
  // AI 컷이 없을 때의 독립 캔버스 미리보기 (인트로 / 브릿지 / 아웃트로)
  // ============================================================
  const getStandalonePreviewDuration = (section: 'intro' | 'bridge' | 'outro') => {
    if (section === 'intro') {
      return overlayOptions.introVideoFile
        ? Math.max(0.6, introCustomDuration)
        : Math.max(0.6, overlayOptions.introDurationSec || 2.0);
    }
    if (section === 'outro') {
      return overlayOptions.outroVideoFile
        ? Math.max(0.6, outroCustomDuration)
        : Math.max(0.6, overlayOptions.outroDurationSec || 2.2);
    }
    return 2.2;
  };

  const renderStandalonePreviewAt = (
    section: 'intro' | 'bridge' | 'outro',
    elapsed: number,
    duration: number
  ) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const progress = duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 0;

    if (section === 'intro' || section === 'outro') {
      const introOutro = previewIntroOutroRef.current;
      if (!introOutro) {
        ensurePreviewIntroOutroRenderer();
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, frame.width, frame.height);
        return;
      }
      const customFile =
        section === 'intro' ? overlayOptions.introVideoFile : overlayOptions.outroVideoFile;
      const customVideo =
        section === 'intro' ? introCustomVideoRef.current : outroCustomVideoRef.current;
      if (customFile && customVideo && customVideo.readyState >= 2) {
        drawCompositorCoverFrame(
          ctx,
          customVideo,
          undefined,
          undefined,
          frame
        );
        return;
      }
      if (section === 'intro') {
        introOutro.drawCompositorIntroFrame(
          ctx,
          progress,
          effectiveOverlayOptions,
          frame
        );
      } else {
        introOutro.drawCompositorOutroFrame(
          ctx,
          progress,
          effectiveOverlayOptions,
          frame
        );
      }
      return;
    }

    // 브릿지: 같은 컨트롤러를 재사용해 매 프레임 새 타임라인을 만들지 않는다.
    ensureBridgeRenderer();
    const bridgeRenderer = bridgeRendererRef.current;
    if (!bridgeRenderer) {
      const grad = ctx.createLinearGradient(0, 0, frame.width, frame.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, frame.width, frame.height);
      return;
    }
    if (!bridgePreviewCacheRef.current || bridgePreviewCacheRef.current.key !== 'standalone-bridge') {
      bridgePreviewCacheRef.current?.ctrl.dispose();
      bridgePreviewCacheRef.current = {
        key: 'standalone-bridge',
        ctrl: bridgeRenderer.createHyperframesBridgeController(duration),
      };
    }
    bridgePreviewCacheRef.current.ctrl.seekAndRender(
      ctx,
      elapsed,
      frame.width,
      frame.height,
      creationBridgePreviewInfo
    );
  };

  const stopStandalonePreview = () => {
    if (standalonePreviewRafRef.current) {
      cancelAnimationFrame(standalonePreviewRafRef.current);
      standalonePreviewRafRef.current = null;
    }
    const wasPlaying = standalonePreviewPlayingRef.current;
    standalonePreviewPlayingRef.current = false;
    setIsPlaying(false);
    introCustomVideoRef.current?.pause();
    outroCustomVideoRef.current?.pause();
    if (wasPlaying && standalonePreviewSection) {
      const duration = getStandalonePreviewDuration(standalonePreviewSection);
      renderStandalonePreviewAt(standalonePreviewSection, duration * 0.62, duration);
    }
  };

  const startStandalonePreview = (section: 'intro' | 'bridge' | 'outro') => {
    if (!previewCanvasRef.current) return;
    if (standalonePreviewRafRef.current) {
      cancelAnimationFrame(standalonePreviewRafRef.current);
      standalonePreviewRafRef.current = null;
    }
    // 원본 영상이 재생 중이면 멈추고 캔버스 모션만 보여준다.
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    if (section === 'intro' && overlayOptions.introVideoFile && introCustomVideoRef.current) {
      try {
        introCustomVideoRef.current.currentTime = 0;
      } catch {}
      introCustomVideoRef.current.play().catch(() => {});
    }
    if (section === 'outro' && overlayOptions.outroVideoFile && outroCustomVideoRef.current) {
      try {
        outroCustomVideoRef.current.currentTime = 0;
      } catch {}
      outroCustomVideoRef.current.play().catch(() => {});
    }
    const duration = getStandalonePreviewDuration(section);
    standalonePreviewPlayingRef.current = true;
    setIsPlaying(true);
    const startedAt = performance.now();
    renderStandalonePreviewAt(section, 0, duration);
    const tick = (now: number) => {
      if (!standalonePreviewPlayingRef.current) return;
      const elapsed = Math.min(duration, (now - startedAt) / 1000);
      renderStandalonePreviewAt(section, elapsed, duration);
      if (elapsed >= duration) {
        standalonePreviewPlayingRef.current = false;
        standalonePreviewRafRef.current = null;
        if (section === 'intro') {
          introCustomVideoRef.current?.pause();
        }
        if (section === 'outro') {
          outroCustomVideoRef.current?.pause();
        }
        setIsPlaying(false);
        return;
      }
      standalonePreviewRafRef.current = requestAnimationFrame(tick);
    };
    standalonePreviewRafRef.current = requestAnimationFrame(tick);
  };

  // 인트로/브릿지/아웃트로 단계로 들어오면 뒤에서 돌고 있던 원본 영상을 멈춘다.
  useEffect(() => {
    if (!standalonePreviewSection) return;
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {}
    }
  }, [standalonePreviewSection]);

  // 단계 이동/스타일 변경 시 멈춘 상태에서도 대표 프레임을 보여준다.
  useEffect(() => {
    if (!standalonePreviewSection) {
      if (standalonePreviewPlayingRef.current) stopStandalonePreview();
      return;
    }
    if (standalonePreviewPlayingRef.current) return;
    const duration = getStandalonePreviewDuration(standalonePreviewSection);
    renderStandalonePreviewAt(standalonePreviewSection, duration * 0.62, duration);
  }, [
    standalonePreviewSection,
    overlayOptions,
    effectiveOverlayOptions,
    creationBridgePreviewInfo,
    previewRendererReady,
  ]);

  useEffect(() => {
    return () => {
      if (standalonePreviewRafRef.current) {
        cancelAnimationFrame(standalonePreviewRafRef.current);
        standalonePreviewRafRef.current = null;
      }
      standalonePreviewPlayingRef.current = false;
    };
  }, []);

  // 편집 상태(자막, 제목, 날짜, 회전, 크롭, 인트로/아웃트로 등) 변경 시 즉시 캔버스 다시 그리기 (0초 반응)
  useEffect(() => {
    if (!isSequenceMode) return;
    renderCompositorAt(currentTimeRef.current);
  }, [
    isSequenceMode,
    currentTime,
    segments,
    effectiveOverlayOptions,
    introDuration,
    outroDuration,
    effectiveBridgeDurationMap,
    previewVideoId,
    previewRendererReady,
  ]);

  // 단계가 바뀌면 오른쪽 편집 패널을 맨 위로 부드럽게 되돌린다.
  useEffect(() => {
    rightColumnRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  // 9단계 스텝바에서 현재 단계가 가로 스크롤 중앙에 오도록 맞춘다.
  useEffect(() => {
    const list = stepbarListRef.current;
    const button = activeStepButtonRef.current;
    if (!list || !button || list.scrollWidth <= list.clientWidth) return;
    const listRect = list.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const target =
      list.scrollLeft +
      (buttonRect.left - listRect.left) -
      (listRect.width - buttonRect.width) / 2;
    list.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeSection]);

  // 씬별 자막/날짜/위치 수정 핸들러
  const handleUpdateSegmentSubtitle = (
    segId: string,
    field: 'subtitleTitle' | 'subtitleDate' | 'locationName',
    value: string
  ) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, [field]: value } : s))
    );
  };

  // 타임라인 시점(0 ~ totalDuration)으로 원본 비디오 및 컴포지터 즉시 시크
  const applyVideoSeek = (timelineTime: number) => {
    const clampedTimeline = Math.max(0, Math.min(totalDuration, timelineTime));
    // 재생 중이 아닐 때만 플레이헤드 위치에 맞춰 오른쪽 패널을 바꾼다.
    syncSectionForTime(clampedTimeline);
    const v = videoRef.current;

    if (!isSequenceMode) {
      if (v) {
        try {
          v.currentTime = clampedTimeline;
        } catch {}
      }
      return;
    }

    const res = resolveTimelineAt(clampedTimeline);
    let targetVideoId: string | undefined;
    let targetMediaTime = 0;

    if (res.phase === 'intro') {
      targetVideoId = res.nextSeg?.sourceVideoId;
      targetMediaTime = res.nextSeg?.start || 0;
      if (introCustomVideoRef.current) {
        try {
          introCustomVideoRef.current.currentTime = res.elapsed;
        } catch {}
      }
      if (!isSequencePlayingRef.current) {
        introCustomVideoRef.current?.pause();
        outroCustomVideoRef.current?.pause();
      }
    } else if (res.phase === 'bridge') {
      targetVideoId = res.seg.sourceVideoId;
      targetMediaTime = res.seg.start;
      if (!isSequencePlayingRef.current) {
        introCustomVideoRef.current?.pause();
        outroCustomVideoRef.current?.pause();
      }
    } else if (res.phase === 'segment') {
      targetVideoId = res.videoId;
      targetMediaTime = res.mediaTime;
      if (!isSequencePlayingRef.current) {
        introCustomVideoRef.current?.pause();
        outroCustomVideoRef.current?.pause();
      }
    } else if (res.phase === 'outro') {
      targetVideoId = res.prevSeg?.sourceVideoId;
      targetMediaTime = res.prevSeg?.end || 0;
      if (outroCustomVideoRef.current) {
        try {
          outroCustomVideoRef.current.currentTime = res.elapsed;
        } catch {}
      }
      if (!isSequencePlayingRef.current) {
        introCustomVideoRef.current?.pause();
        outroCustomVideoRef.current?.pause();
      }
    }

    if (targetVideoId && targetVideoId !== previewVideoId) {
      setPreviewVideoId(targetVideoId);
      const nextUrl = videoMap.get(targetVideoId)?.url;
      if (v && nextUrl && v.src !== nextUrl) {
        v.src = nextUrl;
      }
    }

    if (v) {
      try {
        if (Math.abs(v.currentTime - targetMediaTime) > 0.03) {
          v.currentTime = targetMediaTime;
        }
      } catch (err) {
        console.warn('[VideoPlayer] Video seek failed:', err);
      }
    }

    if (isSequencePlayingRef.current) {
      syncBgmPlayback(true, clampedTimeline);
    }
    renderCompositorAt(clampedTimeline);
  };

  // 시퀀스 연속 재생 루프 (인트로 -> 챕터 브릿지 -> 멀티 클립 -> 아웃트로 끊김 없이 재생)
  const stopSequencePlayback = () => {
    isSequencePlayingRef.current = false;
    activeSequencePhaseRef.current = '';
    previewRangeEndRef.current = null;
    if (seqPlayRafRef.current) {
      cancelAnimationFrame(seqPlayRafRef.current);
      seqPlayRafRef.current = null;
    }
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    if (introCustomVideoRef.current && !introCustomVideoRef.current.paused) {
      try {
        introCustomVideoRef.current.pause();
      } catch {}
    }
    if (outroCustomVideoRef.current && !outroCustomVideoRef.current.paused) {
      try {
        outroCustomVideoRef.current.pause();
      } catch {}
    }
    syncBgmPlayback(false);
    setIsPlaying(false);
    setCurrentTime(currentTimeRef.current);
  };

  const startSequencePlayback = (fromTimelineTime?: number) => {
    if (!isSequenceMode) return;
    let startT =
      typeof fromTimelineTime === 'number' && Number.isFinite(fromTimelineTime)
        ? fromTimelineTime
        : currentTimeRef.current;

    if (startT >= totalDuration - 0.15) {
      startT = 0;
    }
    startT = Math.max(0, Math.min(totalDuration, startT));
    currentTimeRef.current = startT;
    setCurrentTime(startT);

    isSequencePlayingRef.current = true;
    activeSequencePhaseRef.current = '';
    seqLastFrameTsRef.current = performance.now();
    seqLastStateSyncTsRef.current = performance.now();
    setPlaybackError(null);
    setIsPlaying(true);
    syncBgmPlayback(true, startT);

    const initRes = resolveTimelineAt(startT);
    if (initRes.phase === 'intro' && overlayOptions.introVideoFile && introCustomVideoRef.current) {
      try {
        introCustomVideoRef.current.currentTime = initRes.elapsed;
      } catch {}
      introCustomVideoRef.current.play().catch(() => {});
    } else if (initRes.phase === 'outro' && overlayOptions.outroVideoFile && outroCustomVideoRef.current) {
      try {
        outroCustomVideoRef.current.currentTime = initRes.elapsed;
      } catch {}
      outroCustomVideoRef.current.play().catch(() => {});
    }

    if (seqPlayRafRef.current) {
      cancelAnimationFrame(seqPlayRafRef.current);
      seqPlayRafRef.current = null;
    }

    const step = (now: number) => {
      if (!isSequencePlayingRef.current) return;
      const dt = Math.min(0.1, Math.max(0, (now - seqLastFrameTsRef.current) / 1000));
      seqLastFrameTsRef.current = now;

      let nextT = currentTimeRef.current + dt;
      const v = videoRef.current;
      const res = resolveTimelineAt(nextT);

      if (res.phase === 'segment') {
        if (introCustomVideoRef.current && !introCustomVideoRef.current.paused) {
          try {
            introCustomVideoRef.current.pause();
          } catch {}
        }
        if (outroCustomVideoRef.current && !outroCustomVideoRef.current.paused) {
          try {
            outroCustomVideoRef.current.pause();
          } catch {}
        }

        const phaseKey = `segment:${res.seg.id}`;
        const targetVideo = videoMap.get(res.videoId) || videos[0];
        const segVol =
          typeof res.seg.volume === 'number' && Number.isFinite(res.seg.volume)
            ? Math.max(0, Math.min(1.0, res.seg.volume))
            : 1.0;

        if (activeSequencePhaseRef.current !== phaseKey) {
          activeSequencePhaseRef.current = phaseKey;
          if (res.videoId !== previewVideoId) {
            setPreviewVideoId(res.videoId);
          }
          if (v && targetVideo?.url) {
            if (!v.src.endsWith(targetVideo.url) && v.src !== targetVideo.url) {
              v.src = targetVideo.url;
            }
            try {
              if (Math.abs(v.currentTime - res.mediaTime) > 0.15) {
                v.currentTime = res.mediaTime;
              }
            } catch {}
            v.muted = isMutedRef.current;
            v.volume = segVol;
            const p = v.play();
            if (p !== undefined) {
              p.catch((err) => {
                if (err?.name === 'NotAllowedError') {
                  v.muted = true;
                  v.play().catch(() => {});
                }
              });
            }
          }
        } else if (v) {
          v.muted = isMutedRef.current;
          v.volume = segVol;
          if (v.paused && v.readyState >= 2 && nextT < totalDuration - 0.05) {
            v.play().catch(() => {});
          }
          // 비디오 디코더의 실제 재생 시점과 타임라인 시점 동기화 (오디오/비디오 드리프트 방지)
          const offset = segmentTimelineOffsets[res.seg.id];
          if (offset && !v.paused && !v.seeking && v.readyState >= 2) {
            const actualMediaT = v.currentTime;
            if (actualMediaT >= res.seg.start - 0.05 && actualMediaT <= res.seg.end + 0.15) {
              const syncedTimelineT = offset.startOffset + Math.max(0, actualMediaT - res.seg.start);
              if (Math.abs(syncedTimelineT - nextT) < 0.35) {
                nextT = syncedTimelineT;
              }
            }
          }
        }
      } else {
        // 인트로 / 챕터 브릿지 / 아웃트로 구간에서는 원본 비디오를 일시정지하고 다가올 클립 시작 지점으로 미리 시크(Pre-seek)
        const phaseKey =
          res.phase === 'bridge' ? `bridge:${res.seg.id}` : res.phase;
        if (activeSequencePhaseRef.current !== phaseKey) {
          activeSequencePhaseRef.current = phaseKey;
          if (v && !v.paused) {
            try {
              v.pause();
            } catch {}
          }

          if (res.phase === 'intro') {
            if (outroCustomVideoRef.current && !outroCustomVideoRef.current.paused) {
              try { outroCustomVideoRef.current.pause(); } catch {}
            }
            if (overlayOptions.introVideoFile && introCustomVideoRef.current) {
              const civ = introCustomVideoRef.current;
              try { civ.currentTime = res.elapsed; } catch {}
              civ.play().catch(() => {});
            }
          } else if (res.phase === 'outro') {
            if (introCustomVideoRef.current && !introCustomVideoRef.current.paused) {
              try { introCustomVideoRef.current.pause(); } catch {}
            }
            if (overlayOptions.outroVideoFile && outroCustomVideoRef.current) {
              const cov = outroCustomVideoRef.current;
              try { cov.currentTime = res.elapsed; } catch {}
              cov.play().catch(() => {});
            }
          } else {
            if (introCustomVideoRef.current && !introCustomVideoRef.current.paused) {
              try { introCustomVideoRef.current.pause(); } catch {}
            }
            if (outroCustomVideoRef.current && !outroCustomVideoRef.current.paused) {
              try { outroCustomVideoRef.current.pause(); } catch {}
            }
          }

          const preloadSeg =
            res.phase === 'intro'
              ? res.nextSeg
              : res.phase === 'bridge'
              ? res.seg
              : res.phase === 'outro'
              ? res.prevSeg
              : undefined;
          const preloadTime =
            res.phase === 'outro' ? preloadSeg?.end || 0 : preloadSeg?.start || 0;

          if (preloadSeg) {
            if (preloadSeg.sourceVideoId !== previewVideoId) {
              setPreviewVideoId(preloadSeg.sourceVideoId);
            }
            const preloadUrl = videoMap.get(preloadSeg.sourceVideoId)?.url;
            if (v && preloadUrl) {
              if (v.src !== preloadUrl) {
                v.src = preloadUrl;
              }
              try {
                if (Math.abs(v.currentTime - preloadTime) > 0.1) {
                  v.currentTime = preloadTime;
                }
              } catch {}
            }
          }
        } else {
          // 동일 페이즈 진행 중: 커스텀 인트로/아웃트로 비디오 연속 재생 및 드리프트 보정
          if (res.phase === 'intro' && overlayOptions.introVideoFile && introCustomVideoRef.current) {
            const civ = introCustomVideoRef.current;
            if (civ.paused && civ.readyState >= 2) {
              civ.play().catch(() => {});
            }
            if (Math.abs(civ.currentTime - res.elapsed) > 0.3) {
              try {
                civ.currentTime = res.elapsed;
              } catch {}
            }
          } else if (res.phase === 'outro' && overlayOptions.outroVideoFile && outroCustomVideoRef.current) {
            const cov = outroCustomVideoRef.current;
            if (cov.paused && cov.readyState >= 2) {
              cov.play().catch(() => {});
            }
            if (Math.abs(cov.currentTime - res.elapsed) > 0.3) {
              try {
                cov.currentTime = res.elapsed;
              } catch {}
            }
          }
        }
      }

      if (previewRangeEndRef.current !== null && nextT >= previewRangeEndRef.current - 0.01) {
        const previewEnd = previewRangeEndRef.current;
        currentTimeRef.current = previewEnd;
        setCurrentTime(previewEnd);
        renderCompositorAt(previewEnd);
        stopSequencePlayback();
        return;
      }

      if (nextT >= totalDuration) {
        currentTimeRef.current = totalDuration;
        setCurrentTime(totalDuration);
        renderCompositorAt(totalDuration);
        stopSequencePlayback();
        return;
      }

      currentTimeRef.current = nextT;
      renderCompositorAt(nextT);

      // React 상태 업데이트 쓰로틀링 (매 프레임 60Hz 리렌더링으로 인한 데스크탑/모바일 메인 스레드 프레임 드랍 원천 차단)
      if (now - seqLastStateSyncTsRef.current >= 80) {
        seqLastStateSyncTsRef.current = now;
        setCurrentTime(nextT);
      }
      seqPlayRafRef.current = requestAnimationFrame(step);
    };

    seqPlayRafRef.current = requestAnimationFrame(step);
  };

  // 클립 선택 및 이동
  const handleSelectSegment = (segId: string, targetSection?: StudioSection) => {
    musicPanelPinnedRef.current = false;
    // 단계 이동으로 시크할 때 패널이 플레이헤드 기준으로 되튕기지 않도록 동기화를 잠시 멈춘다.
    sectionSyncSuppressRef.current = true;
    try {
    // 타임라인 블록을 누르면 오른쪽 편집 패널도 같은 단계로 즉시 전환한다.
    // (인트로/아웃트로/컷 각각의 블록과 편집 화면이 서로 어긋나지 않도록)
    // 자막 단계에서 씬을 훑는 중이면 자막 패널을 유지한다.
    setActiveSection((prev) =>
      targetSection ??
      (segId === 'intro'
        ? 'intro'
        : segId === 'outro'
          ? 'outro'
          : prev === 'caption'
            ? 'caption'
            : 'cut')
    );
    setSelectedSegmentId(segId);
    if (!isSequenceMode) {
      const seg = segments.find((s) => s.id === segId);
      if (seg && videoRef.current) {
        videoRef.current.currentTime = seg.start;
        setCurrentTime(seg.start);
      }
      return;
    }
    if (segId === 'intro') {
      currentTimeRef.current = 0;
      setCurrentTime(0);
      activeSequencePhaseRef.current = '';
      applyVideoSeek(0);
      return;
    }
    if (segId === 'outro') {
      const outroStart = Math.max(0, totalDuration - outroDuration);
      currentTimeRef.current = outroStart;
      setCurrentTime(outroStart);
      activeSequencePhaseRef.current = '';
      applyVideoSeek(outroStart);
      return;
    }
    const offset = segmentTimelineOffsets[segId];
    if (offset) {
      const targetT = offset.startOffset + 0.05;
      currentTimeRef.current = targetT;
      setCurrentTime(targetT);
      activeSequencePhaseRef.current = '';
      applyVideoSeek(targetT);
    }
    } finally {
      sectionSyncSuppressRef.current = false;
    }
  };

  // 구간(start~end)만 재생하고 자동으로 멈추는 미리보기
  const previewSectionRange = (startTime: number, endTime: number) => {
    if (!isSequenceMode || totalDuration <= 0) return;
    const start = Math.max(0, Math.min(totalDuration, startTime));
    const end = Math.max(start + 0.15, Math.min(totalDuration, endTime));
    previewRangeEndRef.current = end;
    sectionSyncSuppressRef.current = true;
    try {
      currentTimeRef.current = start;
      setCurrentTime(start);
      applyVideoSeek(start);
    } finally {
      sectionSyncSuppressRef.current = false;
    }
    startSequencePlayback(start);
  };

  // 인트로·컷·브릿지·아웃트로 구간별 "이 부분만 다시 보기"
  const previewSectionPlay = (section: StudioSection, bridgeIndex?: number) => {
    // 썸네일/다운로드 단계는 영상 구간 미리보기가 없는 마무리 화면이다.
    if (section === 'thumbnail' || section === 'download') return;
    if (!isSequenceMode) {
      // AI 컷이 없어도 인트로/브릿지/아웃트로는 캔버스 단독으로 재생한다.
      if (section === 'intro' || section === 'outro' || section === 'bridge') {
        startStandalonePreview(section);
      }
      return;
    }
    if (section === 'intro') {
      if (introDuration <= 0) return;
      previewSectionRange(0, introDuration);
      return;
    }
    if (section === 'outro') {
      if (outroDuration <= 0) return;
      previewSectionRange(totalDuration - outroDuration, totalDuration);
      return;
    }
    if (section === 'music') {
      previewSectionRange(0, Math.min(totalDuration, 12));
      return;
    }
    if (section === 'bridge') {
      const idx = bridgeIndex ?? effectiveBridgeIndex;
      const seg = segments[idx];
      const offset = seg ? segmentTimelineOffsets[seg.id] : undefined;
      if (!offset) return;
      if (offset.bridgeDuration > 0) {
        // 브릿지 구간 안에서만 재생하고, 다음 컷으로 넘어가기 직전에 멈춘다.
        // (기존: 다음 컷을 1.2초 더 재생 → 플레이헤드가 다음 컷 중간에서 멈추던 문제)
        previewSectionRange(offset.bridgeStartOffset + 0.01, offset.startOffset - 0.02);
      } else {
        // 아직 꺼져 있는 브릿지는 재생할 구간이 없으므로 다음 컷으로 넘어가지 않고
        // 해당 전환이 시작되는 위치(다음 컷 첫 프레임)로만 이동한다.
        const target = offset.startOffset;
        currentTimeRef.current = target;
        setCurrentTime(target);
        activeSequencePhaseRef.current = '';
        sectionSyncSuppressRef.current = true;
        try {
          applyVideoSeek(target);
        } finally {
          sectionSyncSuppressRef.current = false;
        }
      }
      return;
    }
    const seg = segments[selectedSegmentIndex];
    const offset = seg ? segmentTimelineOffsets[seg.id] : undefined;
    if (offset) previewSectionRange(offset.startOffset, offset.endOffset);
  };

  // 상태를 바꾼 직후 setTimeout으로 미리보기를 예약하면, 콜백이 이전 렌더의
  // previewSectionPlay(옛 overlayOptions/segments)를 그대로 붙잡아 방금 고른
  // 템플릿이 아니라 직전에 고른 템플릿이 재생된다.
  // 예약 실행 시점의 최신 렌더 함수를 ref로 참조해 항상 방금 바뀐 상태로 재생한다.
  const previewSectionPlayRef = useRef<(section: StudioSection, bridgeIndex?: number) => void>(
    () => {}
  );
  // 타이머 콜백이 커밋 이후에 실행되도록, ref 동기화는 paint 전(layout effect)에 끝낸다.
  useLayoutEffect(() => {
    previewSectionPlayRef.current = previewSectionPlay;
  });

  const scheduleSectionPreview = (
    section: StudioSection,
    bridgeIndex?: number,
    delayMs = 80
  ) => {
    window.setTimeout(() => previewSectionPlayRef.current(section, bridgeIndex), delayMs);
  };

  const selectCutByOffset = (delta: number) => {
    if (segments.length === 0) return;
    const nextIndex = Math.max(0, Math.min(segments.length - 1, selectedSegmentIndex + delta));
    const seg = segments[nextIndex];
    if (!seg) return;
    musicPanelPinnedRef.current = false;
    // 자막 단계에서 씬을 넘기다가 온 경우 자막 패널을 유지하고, 아니면 컷 패널로 전환한다.
    handleSelectSegment(seg.id);
  };

  const handleSelectBridge = (idx: number, autoPreview = false) => {
    const seg = segments[idx];
    if (!seg) return;
    musicPanelPinnedRef.current = false;
    sectionSyncSuppressRef.current = true;
    try {
    setActiveSection('bridge');
    setSelectedBridgeIndex(idx);
    setSelectedSegmentId(seg.id);
    const offset = segmentTimelineOffsets[seg.id];
    if (offset) {
      const target = offset.bridgeDuration > 0 ? offset.bridgeStartOffset + 0.01 : offset.startOffset;
      currentTimeRef.current = target;
      setCurrentTime(target);
      activeSequencePhaseRef.current = '';
      applyVideoSeek(target);
    }
    } finally {
      sectionSyncSuppressRef.current = false;
    }
    if (autoPreview) {
      scheduleSectionPreview('bridge', idx);
    }
  };

  const setBridgeEnabled = (idx: number, enabled: boolean) => {
    const seg = segments[idx];
    if (!seg) return;
    musicPanelPinnedRef.current = false;
    setStoredShowChapterBridge(true);
    setOverlayOptions((prev) => ({ ...prev, showChapterBridge: true }));
    setSegments((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, skipChapterBridge: !enabled } : s))
    );
    setSelectedBridgeIndex(idx);
    setSelectedSegmentId(seg.id);
    if (enabled) {
      scheduleSectionPreview('bridge', idx, 100);
    }
  };

  // 브릿지 단계의 전체 켜기/끄기. 끄면 날짜·장소가 바뀌어도 타임라인에 브릿지가 들어가지 않는다.
  const setChapterBridgeEnabled = (enabled: boolean) => {
    setStoredShowChapterBridge(enabled);
    setOverlayOptions((prev) => ({ ...prev, showChapterBridge: enabled }));
    if (enabled) {
      scheduleSectionPreview('bridge');
    }
  };

  const applyBridgeTemplateToCurrent = (kind: 'date' | 'location', templateId: string) => {
    const idx = effectiveBridgeIndex;
    setSegments((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              ...(kind === 'date'
                ? { bridgeDateTemplateOverride: templateId as BridgeDateTemplateId }
                : { bridgeLocationTemplateOverride: templateId as BridgeLocationTemplateId }),
            }
          : s
      )
    );
    scheduleSectionPreview('bridge', idx, 100);
  };

  // AI 컷이 없거나 자동 감지된 전환이 없을 때 기본 브릿지 스타일을 미리 골라둔다.
  const setDefaultBridgeTemplate = (
    kind: 'date' | 'location',
    templateId: string,
    autoPreview = true
  ) => {
    setOverlayOptions((prev) => ({
      ...prev,
      showChapterBridge: true,
      ...(kind === 'date'
        ? { chapterBridgeDateTemplate: templateId as BridgeDateTemplateId }
        : { chapterBridgeLocationTemplate: templateId as BridgeLocationTemplateId }),
    }));
    if (autoPreview) {
      scheduleSectionPreview('bridge');
    }
  };

  const applyBridgeTemplateToAll = () => {
    if (!selectedBridgeDetail) return;
    const { info } = selectedBridgeDetail;
    setOverlayOptions((prev) => ({
      ...prev,
      chapterBridgeDateTemplate: info.dateTemplate,
      chapterBridgeLocationTemplate: info.locationTemplate,
    }));
    setSegments((prev) =>
      prev.map((s) => ({
        ...s,
        bridgeDateTemplateOverride: undefined,
        bridgeLocationTemplateOverride: undefined,
      }))
    );
    notify.success(ui('모든 브릿지에 같은 스타일을 적용했어요.'));
  };

  const goToSection = (section: StudioSection) => {
    // 노래·썸네일·다운로드는 타임라인 위치와 무관한 마무리 패널이라
    // 사용자가 타임라인을 직접 만지기 전까지 해당 카드를 유지한다.
    musicPanelPinnedRef.current =
      section === 'music' || section === 'thumbnail' || section === 'download';
    setActiveSection(section);
    if (section === 'intro' || section === 'introStyle') {
      handleSelectSegment('intro', section);
      return;
    }
    if (section === 'outro') {
      handleSelectSegment('outro');
      return;
    }
    if (section === 'cut' || section === 'caption') {
      const seg = segments[selectedSegmentIndex] || segments[0];
      if (seg) handleSelectSegment(seg.id, section);
      return;
    }
    if (section === 'bridge') {
      if (segments.length > 0) handleSelectBridge(effectiveBridgeIndex);
      return;
    }
    // upload / ai / music: 재생 위치를 건드리지 않고 해당 패널만 연다.
  };

  // 다음/이전 단계는 현재 흐름(생성 9단계 / 편집 9단계)의 순서를 그대로 따른다.
  // AI 컷이나 브릿지 후보가 없어도 단계를 건너뛰지 않는다.
  const goToAdjacentSection = (delta: 1 | -1) => {
    const nextIndex = activeStudioStepIndex + delta;
    if (nextIndex < 0 || nextIndex >= studioSteps.length) return;
    goToSection(studioSteps[nextIndex].id);
  };

  // 단계별 상태 요약 문구 (데스크탑 스텝바 · 모바일 스텝 헤더/바텀시트에서 공용으로 사용)
  const getStudioStepStatus = (stepId: StudioSection): string => {
    switch (stepId) {
      case 'intro':
        return overlayOptions.titleText.trim().length > 0 ||
          overlayOptions.channelText.trim().length > 0
          ? ui('문구 설정됨')
          : ui('문구 없음');
      case 'introStyle':
        return overlayOptions.showIntro ? ui('사용 중') : ui('사용 안 함');
      case 'upload':
        return videos.length > 0
          ? ui('{count}개 준비됨', { count: videos.length })
          : ui('올리기 필요');
      case 'ai':
        if (isProcessing) {
          return ui('분석 중 {percent}%', { percent: progress.progressPercent });
        }
        return segments.length > 0
          ? ui('{count}개 컷 완성', { count: segments.length })
          : ui('대기');
      case 'caption':
        return ui('{count}개 씬 자막', { count: segments.length });
      case 'cut':
        return ui('{count}개 컷', { count: segments.length });
      case 'bridge':
        if (overlayOptions.showChapterBridge === false) {
          return ui('사용 안 함');
        }
        if (isCreationFlow) {
          return ui('미리 고르기');
        }
        if (activeBridgeIndexes.length > 0) {
          return ui('{count}곳 넣었어요', { count: activeBridgeIndexes.length });
        }
        return bridgeCandidateIndexes.length > 0
          ? ui('{count}곳 가능', { count: bridgeCandidateIndexes.length })
          : ui('자동 감지 없음');
      case 'outro':
        return overlayOptions.showOutro ? ui('사용 중') : ui('사용 안 함');
      case 'music':
        return customAudioFile ? ui('선택됨') : ui('없음');
      case 'thumbnail':
        return thumbnailUrl ? ui('자동으로 만들었어요') : ui('대기');
      case 'download':
        return isSequenceMode && segments.length > 0
          ? ui('저장할 수 있어요')
          : ui('대기');
      default:
        return '';
    }
  };

  // 모바일 스텝 헤더/바텀시트용 단계 목록 (현재 단계 강조 포함)
  const mobileStepItems = studioSteps.map((step, index) => ({
    id: step.id,
    index,
    label: ui(step.label),
    status: getStudioStepStatus(step.id),
    isActive: activeSection === step.id,
  }));
  const activeMobileStepItem = mobileStepItems[activeStudioStepIndex] || mobileStepItems[0];
  const nextStudioStep = studioSteps[activeStudioStepIndex + 1] || null;
  const nextStepCtaLabel = nextStudioStep
    ? nextStudioStep.id === 'download'
      ? ui('다운로드로 가기')
      : ui('다음: {label}', { label: ui(nextStudioStep.label) })
    : ui('다음 단계');

  // 상대 시간 이동 (-5s, +5s)
  const seekRelative = (delta: number) => {
    const baseTime = isSequenceMode
      ? currentTimeRef.current
      : videoRef.current?.currentTime || currentTime;
    const newT = Math.max(0, Math.min(totalDuration, baseTime + delta));
    currentTimeRef.current = newT;
    activeSequencePhaseRef.current = '';
    applyVideoSeek(newT);
    setCurrentTime(newT);
  };

  // 프로그레스 바 드래그 시 좌표 -> 시간 변환
  const calculateTimeFromProgressEvent = (clientX: number): number => {
    const track = progressTrackRef.current;
    if (!track || !totalDuration || totalDuration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * totalDuration;
  };

  // 시퀀서 타임라인 드래그 시 좌표 -> 시간 변환
  const calculateTimeFromSequencerEvent = (clientX: number): number => {
    const canvas = sequencerCanvasRef.current;
    if (!canvas || !totalDuration || totalDuration <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * totalDuration;
  };

  // 스크러빙 시작 (마우스/터치 다운)
  const startScrubbing = (targetTime: number) => {
    if (!totalDuration || totalDuration <= 0) return;
    const clampedTime = Math.max(0, Math.min(totalDuration, targetTime));
    // 타임라인을 직접 만지면 노래 패널 고정을 풀고, 지금 위치의 단계로 돌아간다.
    musicPanelPinnedRef.current = false;
    isScrubbingRef.current = true;
    setIsScrubbing(true);

    if (isSequenceMode) {
      if (isSequencePlayingRef.current) {
        wasPlayingBeforeScrubRef.current = true;
        stopSequencePlayback();
      } else {
        wasPlayingBeforeScrubRef.current = false;
      }
    } else {
      const v = videoRef.current;
      if (v && !v.paused) {
        wasPlayingBeforeScrubRef.current = true;
        v.pause();
      } else {
        wasPlayingBeforeScrubRef.current = false;
      }
    }

    currentTimeRef.current = clampedTime;
    setCurrentTime(clampedTime);
    applyVideoSeek(clampedTime);
  };

  // 스크러빙 진행 (마우스/터치 드래그 중 실시간 위치 및 비디오 프레임 갱신)
  const updateScrubTime = (targetTime: number) => {
    if (!totalDuration || totalDuration <= 0) return;
    const clampedTime = Math.max(0, Math.min(totalDuration, targetTime));

    currentTimeRef.current = clampedTime;
    setCurrentTime(clampedTime);
    pendingScrubTimeRef.current = clampedTime;

    if (!isRafSeekingRef.current) {
      isRafSeekingRef.current = true;
      scrubRafRef.current = requestAnimationFrame(() => {
        isRafSeekingRef.current = false;
        scrubRafRef.current = null;
        if (pendingScrubTimeRef.current !== null) {
          applyVideoSeek(pendingScrubTimeRef.current);
        }
      });
    }
  };

  // 스크러빙 종료 (마우스/터치 릴리즈)
  const stopScrubbing = (finalTime?: number) => {
    isRafSeekingRef.current = false;
    pendingScrubTimeRef.current = null;
    if (scrubRafRef.current) {
      cancelAnimationFrame(scrubRafRef.current);
      scrubRafRef.current = null;
    }

    isScrubbingRef.current = false;
    setIsScrubbing(false);

    const clampedFinal =
      typeof finalTime === 'number' && Number.isFinite(finalTime)
        ? Math.max(0, Math.min(totalDuration, finalTime))
        : currentTimeRef.current;

    currentTimeRef.current = clampedFinal;
    setCurrentTime(clampedFinal);
    applyVideoSeek(clampedFinal);

    if (wasPlayingBeforeScrubRef.current && clampedFinal < totalDuration - 0.1) {
      if (isSequenceMode) {
        startSequencePlayback(clampedFinal);
      } else {
        videoRef.current?.play().catch(() => {});
      }
    }
    wasPlayingBeforeScrubRef.current = false;
  };

  // 1. 영상 프로그레스 바 마우스/터치 드래그 시작
  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!totalDuration) return;

    e.preventDefault();
    const pointerId = e.pointerId;
    const trackEl = e.currentTarget;
    try {
      trackEl.setPointerCapture(pointerId);
    } catch {}

    const initialTime = calculateTimeFromProgressEvent(e.clientX);
    startScrubbing(initialTime);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const moveTime = calculateTimeFromProgressEvent(moveEvent.clientX);
      updateScrubTime(moveTime);
    };

    const cleanup = () => {
      try {
        if (trackEl.hasPointerCapture(pointerId)) {
          trackEl.releasePointerCapture(pointerId);
        }
      } catch {}
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handleBlur);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      cleanup();
      const finalTime = calculateTimeFromProgressEvent(upEvent.clientX);
      stopScrubbing(finalTime);
    };

    const handleBlur = () => {
      cleanup();
      stopScrubbing();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleBlur);
  };

  // 2. 시퀀서 타임라인 마우스/터치 드래그 시작 (빨간선 플레이헤드 즉시 드래그 및 실시간 영상 변경)
  const handleSequencerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!totalDuration) return;

    const target = e.target as HTMLElement;
    if (target.closest('.toss-sequencer-block-delete')) return;

    const pointerId = e.pointerId;
    const canvasEl = e.currentTarget;

    // 클립 블록/A1 음악 행은 자체 클릭(단계 이동·노래 설정 열기)을 처리하므로
    // 둘 다 '.toss-sequencer-block'과 동일하게 다뤄 클릭과 드래그 스크러빙을 모두 지원한다.
    const isBlock = Boolean(
      target.closest('.toss-sequencer-block') ||
        target.closest('.toss-sequencer-audio-strip')
    );
    const isPlayhead = Boolean(
      target.closest('.toss-sequencer-playhead') ||
      target.closest('.toss-playhead-cap') ||
      target.closest('.toss-playhead-line')
    );

    // 블록 위에서 캔버스가 포인터를 캡처하면 mousedown/click이 캔버스로 리타깃되어
    // 블록의 onClick이 동작하지 않는다. 캡처는 배경(룰러/빈 영역)과 플레이헤드 드래그에만 건다.
    // (블록 드래그 추적은 window 포인터 리스너가 그대로 처리한다)
    if (!isBlock || isPlayhead) {
      try {
        canvasEl.setPointerCapture(pointerId);
      } catch {}
    }

    const startX = e.clientX;
    let hasMoved = false;

    if (!isBlock || isPlayhead) {
      e.preventDefault();
      const initialTime = calculateTimeFromSequencerEvent(startX);
      startScrubbing(initialTime);
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentX = moveEvent.clientX;
      const deltaX = Math.abs(currentX - startX);

      if (!hasMoved && deltaX >= 3) {
        hasMoved = true;
        suppressSegmentClickRef.current = true;
        if (isBlock && !isPlayhead) {
          const startTime = calculateTimeFromSequencerEvent(currentX);
          startScrubbing(startTime);
        }
      }

      if (hasMoved || !isBlock || isPlayhead) {
        moveEvent.preventDefault();
        const moveTime = calculateTimeFromSequencerEvent(currentX);
        updateScrubTime(moveTime);
      }
    };

    const cleanup = () => {
      try {
        if (canvasEl.hasPointerCapture(pointerId)) {
          canvasEl.releasePointerCapture(pointerId);
        }
      } catch {}
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handleBlur);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      cleanup();

      if (isBlock && !isPlayhead && !hasMoved) {
        return;
      }

      if (hasMoved || isPlayhead) {
        suppressSegmentClickRef.current = true;
        setTimeout(() => {
          suppressSegmentClickRef.current = false;
        }, 400);
      }

      const finalTime = calculateTimeFromSequencerEvent(upEvent.clientX);
      stopScrubbing(finalTime);
    };

    const handleBlur = () => {
      cleanup();
      stopScrubbing();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleBlur);
  };

  // 프로그레스 바 / 타임라인 위치 클릭 시 직접 이동
  const handleSeekByPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * totalDuration;
    musicPanelPinnedRef.current = false;
    currentTimeRef.current = targetTime;
    activeSequencePhaseRef.current = '';
    applyVideoSeek(targetTime);
    setCurrentTime(targetTime);
  };

  // 영상 종료 시점 여부
  const isAtEnd = Boolean(
    (!isSequenceMode && (videoRef.current?.ended ?? false)) ||
    (totalDuration > 0 && currentTime >= totalDuration - 0.25)
  );

  // 전체화면 변경 이벤트 동기화
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // 전체화면 상태일 때 ESC 키 대응
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // 영상 확대(전체화면) 토글 핸들러
  const toggleFullscreen = async () => {
    const stage = playerStageRef.current;
    if (!stage) return;

    try {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isFs) {
        if (stage.requestFullscreen) {
          await stage.requestFullscreen();
        } else if ((stage as any).webkitRequestFullscreen) {
          await (stage as any).webkitRequestFullscreen();
        } else if ((stage as any).mozRequestFullScreen) {
          await (stage as any).mozRequestFullScreen();
        } else if ((stage as any).msRequestFullscreen) {
          await (stage as any).msRequestFullscreen();
        } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed, fallback to CSS:', err);
      setIsFullscreen((prev) => !prev);
    }
  };

  // 재생 / 일시정지 토글 (영상 종료 시점이면 0초 처음부터 재생)
  const togglePlay = () => {
    if (standalonePreviewSection) {
      if (standalonePreviewPlayingRef.current) {
        stopStandalonePreview();
      } else {
        startStandalonePreview(standalonePreviewSection);
      }
      return;
    }
    if (isSequenceMode) {
      if (isSequencePlayingRef.current || isPlaying) {
        stopSequencePlayback();
      } else {
        const startT = currentTime >= totalDuration - 0.25 ? 0 : currentTime;
        startSequencePlayback(startT);
      }
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : totalDuration;
      const effectiveEnd = Math.min(dur || totalDuration, totalDuration || dur);
      const isEndedOrAtEnd =
        v.ended ||
        (effectiveEnd > 0 && v.currentTime >= effectiveEnd - 0.25) ||
        (totalDuration > 0 && currentTime >= totalDuration - 0.25);

      if (isEndedOrAtEnd) {
        v.currentTime = 0;
        setCurrentTime(0);
      }

      setPlaybackError(null);
      const p = v.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          if (err?.name === 'AbortError') return;
          console.warn('[VideoPlayer] Play interrupted or blocked, fallback to muted:', err);
          if (err?.name === 'NotAllowedError') {
            v.muted = true;
            setIsMuted(true);
            isMutedRef.current = true;
            v.play()
              .then(() => setIsPlaying(true))
              .catch((retryErr) => {
                if (retryErr?.name === 'AbortError') return;
                console.error('[VideoPlayer] Muted playback also failed:', retryErr, {
                  src: v.currentSrc,
                  mediaError: v.error ? { code: v.error.code, message: v.error.message } : null,
                  readyState: v.readyState,
                  networkState: v.networkState,
                });
                setIsPlaying(false);
                setPlaybackError(dict.draftPreview?.playbackError || ui(PLAYBACK_ERROR_MESSAGE));
              });
          }
        });
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // 음소거 토글
  const toggleMute = () => {
    const nextMuted = !isMuted;
    isMutedRef.current = nextMuted;
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    setIsMuted(nextMuted);
  };

  // 클립 시작/끝 미세 조절 (-0.5s / +0.5s)
  const handleTrimChange = (
    segId: string,
    field: 'start' | 'end',
    delta: number
  ) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        const vItem = videoMap.get(s.sourceVideoId);
        const maxDur = vItem?.duration || 100;

        let newStart = s.start;
        let newEnd = s.end;

        if (field === 'start') {
          newStart = Math.max(0, Math.min(s.end - 0.8, Math.round((s.start + delta) * 10) / 10));
        } else {
          newEnd = Math.max(s.start + 0.8, Math.min(maxDur, Math.round((s.end + delta) * 10) / 10));
        }

        const newDuration = Math.round((newEnd - newStart) * 10) / 10;
        return {
          ...s,
          start: newStart,
          end: newEnd,
          duration: newDuration,
        };
      })
    );
  };

  // 모달을 통한 클립 구간 세밀 조정 저장
  const handleSaveTrimRange = (segId: string, newStart: number, newEnd: number) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        const newDuration = Math.round((newEnd - newStart) * 10) / 10;
        return {
          ...s,
          start: newStart,
          end: newEnd,
          duration: newDuration,
        };
      })
    );
  };

  // 클립 삭제
  const handleDeleteSegment = (segId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = segments.filter((s) => s.id !== segId);
    setSegments(updated);
    if (selectedSegmentId === segId && updated.length > 0) {
      setSelectedSegmentId(updated[0].id);
    }
  };

  // 촬영일시(날짜 및 시·분·초) 기준 시간순 정렬
  const handleSortSegmentsByRecordedTime = () => {
    if (segments.length <= 1) return;
    const prevSegments = [...segments];
    const sorted = sortSegmentsByRecordedTime(segments, videoMap);
    setSegments(sorted);

    // Ding 다이나믹 토스트 알림 및 되돌리기 액션
    notify.action(
      dict.dramaticClips.sortByRecordedDateToast || '촬영일시 순으로 정렬했어요.',
      dict.common?.undo || '되돌리기',
      () => {
        setSegments(prevSegments);
        return { title: dict.toasts.orderRestored, action: null };
      }
    );
  };

  // 크롭 위치 조정
  const handleCropAnchorChange = (segId: string, ratio: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, cropOffsetYRatio: ratio } : s))
    );
  };

  // 크롭 좌우 위치 조정 (가로 원본 → 세로 9:16 프레임 좌우 기준)
  const handleCropXAnchorChange = (segId: string, ratio: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, cropOffsetXRatio: ratio } : s))
    );
  };

  // 씬 영상 회전 각도 조정 (90도씩 좌/우 회전: delta = -90 | 90)
  const handleRotateSegment = (segId: string, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        const currentRot = s.rotation ?? 0;
        const newRot = (currentRot + delta + 360) % 360;
        return {
          ...s,
          rotation: newRot,
        };
      })
    );
  };

  // 씬 영상 회전 각도 0도로 초기화
  const handleResetSegmentRotation = (segId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, rotation: 0 } : s))
    );
  };

  // 파일 업로드
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  // 다운로드 완료 피크엔드(Peak-End): 직접 편집 대비 아낀 시간과 함께 기분 좋은 마무리를 보여준다
  const notifyVideoSaved = () => {
    if (savedPercent > 0) {
      notify.success(ui('영상을 저장했어요!'), {
        description: ui('직접 편집하는 것보다 시간을 {percent}% 아꼈어요', {
          percent: savedPercent,
        }),
        duration: 6000,
      });
      return;
    }
    notify.success(dict.toasts.videoDownloadStarted);
  };

  // 완성 영상 내보내기 및 다운로드 (캐시 히트 시 0초 즉시 다운로드, 미합성/편집 변경 시 단 1회 내보내기 후 자동 다운로드)
  const triggerVideoFileDownload = async (targetResult: FinalVideoResult) => {
    if (!targetResult.url) return;
    const ext = targetResult.blob?.type?.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `reportist_highlight_16x9_${Date.now()}.${ext}`;

    if (targetResult.blob && targetResult.blob.size > 0) {
      try {
        const file = new File([targetResult.blob], fileName, {
          type: targetResult.blob.type || `video/${ext}`,
        });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: overlayOptions.titleText || 'Reportist Highlight',
          });
          notifyVideoSaved();
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    const a = document.createElement('a');
    a.href = targetResult.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notifyVideoSaved();
  };

  const handleDownload = async (targetRes?: ExportResolution) => {
    if (segments.length === 0 || isReStitching) return;
    const resToUse = targetRes || exportResolution;

    if (isSequencePlayingRef.current) {
      stopSequencePlayback();
    }

    // 이미 현재 스냅샷과 동일한 결과물이 캐시되어 있고 선택한 해상도와 일치한다면 0초 만에 즉시 파일 다운로드
    const isResolutionMatched = !result?.resolution || result.resolution === resToUse;
    if (!isModified && result?.url && result?.blob && result.blob.size > 0 && isResolutionMatched) {
      await triggerVideoFileDownload(result);
      return;
    }

    // 만약 원본 비디오 파일이 분리된 상태(모바일 재접속 등)에서 이미 완성본 비디오가 있는 경우
    // 원본이 없어 재합성이 불가능하므로, 기존 완성본 파일을 안전하게 즉시 다운로드
    if (!hasPlayableSourceVideos && result?.url && result?.blob && result.blob.size > 0) {
      await triggerVideoFileDownload(result);
      return;
    }

    // 내보내기(Export) 수행 후 완료 즉시 다운로드 트리거
    const stitched = await onReStitch(
      segments,
      selectedBgmId,
      bgmVolume,
      customAudioFile,
      effectiveOverlayOptions,
      resToUse
    );
    if (stitched && stitched.url) {
      await triggerVideoFileDownload(stitched);
    }
  };

  // 16:9 고화질 썸네일 다운로드
  const handleDownloadThumbnail = async () => {
    if (!thumbnailUrl && !thumbnailBgCanvasRef.current) return;
    try {
      if (thumbnailBgCanvasRef.current) {
        const artCanvas = renderThumbnailArtwork(thumbnailBgCanvasRef.current, {
          titleText: overlayOptions.titleText,
          channelText: '',
          badgeText: '',
          showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
          showBadge: false,
          showChannel: false,
          stylePreset: thumbnailStyle,
        });
        await downloadThumbnailFile(artCanvas, overlayOptions.titleText || 'highlight');
      } else if (thumbnailUrl) {
        await downloadThumbnailFile(thumbnailUrl, overlayOptions.titleText || 'highlight');
      }
      notify.success(dict.toasts.thumbnailDownloaded);
    } catch (err) {
      console.error('Thumbnail download failed:', err);
    }
  };

  // 현재 재생 시점 프레임으로 썸네일 배경 변경 (오버레이 및 문구 일체 미포함)
  const handleCaptureCurrentFrame = async () => {
    setIsUpdatingThumbnail(true);
    try {
      let bg: HTMLCanvasElement | null = null;

      // 1. 현재 활성 원본 비디오 엘리먼트에서 즉시 무오버레이 캡처
      if (videoRef.current && videoRef.current.readyState >= 2) {
        bg = captureVideoFrameFromElement(
          videoRef.current,
          activePlayingSegment?.cropOffsetYRatio ?? 0.2,
          thumbWidth,
          thumbHeight,
          activePlayingSegment?.rotation ?? 0,
          activePlayingSegment?.cropOffsetXRatio ?? 0.5
        );
      }

      // 2. 원본 비디오 URL에서 현재 타임라인 시점으로 정밀 캡처
      if (!bg && activePlayingSegment) {
        const targetVideo = videoMap.get(activePlayingSegment.sourceVideoId) || videos[0];
        if (targetVideo?.url) {
          const segOffset = segmentTimelineOffsets[activePlayingSegment.id];
          const curTime = currentTimeRef.current || currentTime || 0;
          const elapsedInSeg = segOffset ? Math.max(0, curTime - segOffset.startOffset) : 0;
          const sourceTime = Math.min(
            activePlayingSegment.end,
            Math.max(activePlayingSegment.start, activePlayingSegment.start + elapsedInSeg)
          );

          try {
            bg = await captureVideoFrameAtTime(
              targetVideo.url,
              sourceTime,
              activePlayingSegment.cropOffsetYRatio ?? 0.2,
              thumbWidth,
              thumbHeight,
              activePlayingSegment.rotation ?? 0,
              activePlayingSegment.cropOffsetXRatio ?? 0.5
            );
          } catch (sourceErr) {
            console.warn('handleCaptureCurrentFrame source capture failed:', sourceErr);
          }
        }
      }

      // 3. 만약 위에서 실패했고 targetVideo가 있다면 세그먼트 시작 시점으로 fallback
      if (!bg && activePlayingSegment) {
        const targetVideo = videoMap.get(activePlayingSegment.sourceVideoId) || videos[0];
        if (targetVideo?.url) {
          try {
            bg = await captureVideoFrameAtTime(
              targetVideo.url,
              activePlayingSegment.start + 0.5,
              activePlayingSegment.cropOffsetYRatio ?? 0.2,
              thumbWidth,
              thumbHeight,
              activePlayingSegment.rotation ?? 0,
              activePlayingSegment.cropOffsetXRatio ?? 0.5
            );
          } catch {}
        }
      }

      if (bg) {
        thumbnailBgCanvasRef.current = bg;

        const artCanvas = renderThumbnailArtwork(bg, {
          titleText: overlayOptions.titleText,
          channelText: '',
          badgeText: '',
          showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
          showBadge: false,
          showChannel: false,
          stylePreset: thumbnailStyle,
        });

        setThumbnailUrl(artCanvas.toDataURL('image/jpeg', 0.95));
      }
    } catch (err) {
      console.warn('Frame capture failed:', err);
    } finally {
      setIsUpdatingThumbnail(false);
    }
  };

  // AI 추천 썸네일 프레임 복원
  const handleRestoreAiThumbnail = async () => {
    setIsUpdatingThumbnail(true);
    try {
      let bg: HTMLCanvasElement | null = null;
      const targetVideo =
        videos.find((v) => v.id === result?.bestSourceVideoId) || videos[0];

      if (targetVideo?.url && typeof result?.bestThumbnailTime === 'number') {
        const rot = result.bestThumbnailRotation ?? result.segments?.[0]?.rotation ?? 0;
        const crop = result.bestThumbnailCropOffsetYRatio ?? result.segments?.[0]?.cropOffsetYRatio ?? 0.2;
        try {
          bg = await captureVideoFrameAtTime(
            targetVideo.url,
            result.bestThumbnailTime,
            crop,
            thumbWidth,
            thumbHeight,
            rot,
            result.segments?.[0]?.cropOffsetXRatio ?? 0.5
          );
        } catch {}
      }

      if (!bg && result?.cleanThumbnailUrl) {
        try {
          bg = await createCanvasFromImageDataUrl(result.cleanThumbnailUrl, thumbWidth, thumbHeight);
        } catch {}
      } else if (!bg && result?.bestThumbnailCleanDataUrl) {
        try {
          bg = await createCanvasFromImageDataUrl(result.bestThumbnailCleanDataUrl, thumbWidth, thumbHeight);
        } catch {}
      }

      if (bg) {
        thumbnailBgCanvasRef.current = bg;
        const artCanvas = renderThumbnailArtwork(bg, {
          titleText: overlayOptions.titleText,
          channelText: '',
          badgeText: '',
          showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
          showBadge: false,
          showChannel: false,
          stylePreset: thumbnailStyle,
        });
        setThumbnailUrl(artCanvas.toDataURL('image/jpeg', 0.95));
      }
    } catch (err) {
      console.warn('Failed to restore AI thumbnail:', err);
    } finally {
      setIsUpdatingThumbnail(false);
    }
  };

  // AI 추천 후보 프레임 선택
  const handleSelectThumbnailCandidate = async (cand: NonNullable<FinalVideoResult['aiThumbnailRecommendations']>[number]) => {
    setIsUpdatingThumbnail(true);
    try {
      let bg: HTMLCanvasElement | null = null;
      const v = videos.find((item) => item.id === cand.videoId);
      if (v?.url) {
        try {
          bg = await captureVideoFrameAtTime(
            v.url,
            cand.timestamp,
            cand.cropOffsetYRatio ?? 0.2,
            thumbWidth,
            thumbHeight,
            cand.rotation ?? 0,
            cand.cropOffsetXRatio ?? 0.5
          );
        } catch {}
      }
      if (!bg && cand.cleanDataUrl) {
        try {
          bg = await createCanvasFromImageDataUrl(cand.cleanDataUrl, thumbWidth, thumbHeight, cand.cropOffsetYRatio ?? 0.2, cand.rotation ?? 0, cand.cropOffsetXRatio ?? 0.5);
        } catch {}
      }
      if (bg) {
        thumbnailBgCanvasRef.current = bg;
        const artCanvas = renderThumbnailArtwork(bg, {
          titleText: overlayOptions.titleText,
          channelText: '',
          badgeText: '',
          showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
          showBadge: false,
          showChannel: false,
          stylePreset: thumbnailStyle,
        });
        const newThumbUrl = artCanvas.toDataURL('image/jpeg', 0.95);
        const newCleanUrl = bg.toDataURL('image/jpeg', 0.95);
        setThumbnailUrl(newThumbUrl);

        lastPreparedThumbKeyRef.current = `${cand.videoId}_${cand.timestamp}_${cand.rotation ?? 0}_${cand.cropOffsetYRatio ?? 0.2}`;

        if (result) {
          onUpdateFinalResult?.({
            ...result,
            thumbnailUrl: newThumbUrl,
            cleanThumbnailUrl: newCleanUrl,
            bestSourceVideoId: cand.videoId,
            bestThumbnailTime: cand.timestamp,
            bestThumbnailReason: cand.reason,
            bestThumbnailCropOffsetYRatio: cand.cropOffsetYRatio,
            bestThumbnailRotation: cand.rotation,
            bestThumbnailCleanDataUrl: cand.cleanDataUrl || newCleanUrl,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to select thumbnail candidate:', err);
    } finally {
      setIsUpdatingThumbnail(false);
    }
  };

  // 특정 하이라이트 구간의 프레임으로 썸네일 변경
  const handleSetSegmentAsThumbnail = async (seg: HighlightSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdatingThumbnail(true);
    try {
      const targetVideo = videoMap.get(seg.sourceVideoId) || videos[0];
      if (!targetVideo) return;
      const targetTime = seg.start + Math.max(0.5, seg.duration * 0.4);
      const bg = await captureVideoFrameAtTime(
        targetVideo.url,
        targetTime,
        seg.cropOffsetYRatio ?? 0.2,
        thumbWidth,
        thumbHeight,
        seg.rotation ?? 0,
        seg.cropOffsetXRatio ?? 0.5
      );
      thumbnailBgCanvasRef.current = bg;

      const artCanvas = renderThumbnailArtwork(bg, {
        titleText: overlayOptions.titleText,
        channelText: '',
        badgeText: '',
        showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
        showBadge: false,
        showChannel: false,
        stylePreset: thumbnailStyle,
      });

      const newThumbUrl = artCanvas.toDataURL('image/jpeg', 0.95);
      const newCleanUrl = bg.toDataURL('image/jpeg', 0.95);
      setThumbnailUrl(newThumbUrl);

      lastPreparedThumbKeyRef.current = `${targetVideo.id}_${targetTime}_${seg.rotation ?? 0}_${seg.cropOffsetYRatio ?? 0.2}`;

      if (result) {
        onUpdateFinalResult?.({
          ...result,
          thumbnailUrl: newThumbUrl,
          cleanThumbnailUrl: newCleanUrl,
          bestSourceVideoId: targetVideo.id,
          bestThumbnailTime: targetTime,
          bestThumbnailReason: seg.reason,
          bestThumbnailCropOffsetYRatio: seg.cropOffsetYRatio ?? 0.2,
          bestThumbnailRotation: seg.rotation ?? 0,
          bestThumbnailCleanDataUrl: newCleanUrl,
        });
      }
    } catch (err) {
      console.warn('Segment thumbnail capture failed:', err);
    } finally {
      setIsUpdatingThumbnail(false);
    }
  };

  // 시간 포맷 (00:04)
  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 왼쪽/오른쪽 문구 입력 필드 (데스크탑 상단 바 · 모바일 인트로 카드에서 공용으로 사용)
  const overlayTextInputFields = (
    <>
      <div className="toss-header-input-wrap">
        <label className="toss-header-input-label">
          <Type size={12} className="text-slate-700" />
          <span>{dict.player.leftTitleLabel}</span>
        </label>
        <input
          type="text"
          value={overlayOptions.titleText}
          onChange={(e) =>
            setOverlayOptions((prev) => ({
              ...prev,
              titleText: e.target.value,
              showTitle: e.target.value.trim().length > 0,
            }))
          }
          placeholder={dict.player.leftTitlePlaceholder}
          className="toss-header-input"
        />
      </div>

      <div className="toss-header-input-wrap toss-header-input-wrap-right">
        <label className="toss-header-input-label toss-label-right">
          <span>{dict.player.rightTitleLabel}</span>
          <Type size={12} className="text-slate-700" />
        </label>
        <input
          type="text"
          value={overlayOptions.channelText}
          onChange={(e) =>
            setOverlayOptions((prev) => ({
              ...prev,
              channelText: e.target.value,
              showChannel: e.target.value.trim().length > 0,
            }))
          }
          placeholder={dict.player.rightTitlePlaceholder}
          className="toss-header-input toss-input-right"
        />
      </div>
    </>
  );

  return (
    <div className="toss-page-container" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* 1. 상단 글로벌 내비게이션 바 */}
      <header className="toss-nav-header">
        {/* 모바일에서는 1줄(로고+앱명+액션)과 2줄(탭 스트립) 구조로 나뉘고, 데스크탑에서는 contents로 원래 flex 배치를 유지 */}
        <div className="toss-nav-top-row">
        <div className="toss-nav-left">
          {activeTab === 'studio' ? (
            /* 스튜디오 상세(편집 화면): 로고 대신 뒤로가기 버튼 표시 및 다른 탭 메뉴 숨김 */
            <>
              <button
                type="button"
                className="toss-nav-back-btn"
                onClick={handleBackToProjects}
                title={dict.projects?.backToList || '스튜디오 목록으로'}
                aria-label={dict.projects?.backToList || '스튜디오 목록으로'}
              >
                <ChevronLeft size={18} className="toss-nav-back-icon" />
                <span className="toss-nav-back-text">{dict.projects?.backToList || '스튜디오 목록'}</span>
              </button>
              {/* 모바일에서 뒤로가기 옆이 허전하지 않도록 앱명 노출 */}
              <span className="toss-nav-detail-brand">{dict.common.brandName}</span>
            </>
          ) : (
            /* 목록 및 커뮤니티 화면: 로고, 브랜드명, 상단 탭 노출 */
            <>
              <div className="toss-logo-badge">
                <PenguinLogo size={28} color="#191f28" />
              </div>
              <div className="toss-nav-brand-block">
                <span className="toss-nav-title">{dict.common.brandName}</span>
                <span className="toss-nav-tagline">{dict.common.taglineBadge}</span>
              </div>

              {/* 상단 네비게이션 탭 (스튜디오 목록 & 영상 공유 커뮤니티) */}
              <div className="toss-nav-tabs-group">
                <button
                  type="button"
                  className={`toss-nav-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
                  onClick={() => {
                    if (activeTab === 'projects') {
                      onViewProjects?.();
                    } else {
                      navigateToTab('projects');
                    }
                  }}
                  title={dict.community?.studioTab || dict.projects?.tabTitle || '스튜디오'}
                >
                  <Film size={14} />
                  <span>{dict.community?.studioTab || dict.projects?.tabTitle || '스튜디오'}</span>
                </button>
                <button
                  type="button"
                  className={`toss-nav-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
                  onClick={() => navigateToTab('community')}
                  title={dict.community?.communityTab || '영상 공유'}
                >
                  <Share2 size={14} />
                  <span>{dict.community?.communityTab || '영상 공유'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="toss-nav-right">
          {/* 모바일 전용 저장 상태 (하단 플로팅 상태바를 걷어내고 헤더의 작은 체크로 흡수) */}
          {activeTab === 'studio' && videos.length > 0 && (
            <span
              className={`toss-mobile-save-status ${saveStatus === 'saving' ? 'is-saving' : 'is-saved'}`}
              role="status"
              aria-label={
                saveStatus === 'saving'
                  ? dict.projects?.saving || ui('저장 중')
                  : dict.projects?.bottomSaved || dict.projects?.autoSaved || ui('기기에 안전하게 보관됨')
              }
              title={
                saveStatus === 'saving'
                  ? dict.projects?.saving || ui('저장 중')
                  : dict.projects?.bottomSaved || dict.projects?.autoSaved || ui('기기에 안전하게 보관됨')
              }
            >
              {saveStatus === 'saving' ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Check size={13} strokeWidth={3} aria-hidden="true" />
              )}
            </span>
          )}
          {/* 다국어 언어 선택 트리거 */}
          <button
            type="button"
            className="toss-model-trigger toss-lang-trigger"
            onClick={() => setIsLanguageModalOpen(true)}
            title={dict.languageModal.title}
          >
            <span className="toss-model-trigger-icon">
              <Globe size={13} />
            </span>
            <span className="toss-model-trigger-text">
              <span className="toss-model-trigger-label">{dict.common.language || 'Language'}</span>
              <span className="toss-model-trigger-name flex items-center gap-1.5">
                <span className="text-xs leading-none">{currentLocaleInfo.flag}</span>
                <span className="toss-lang-name">{currentLocaleInfo.nativeName}</span>
              </span>
            </span>
            <ChevronDown size={14} className="toss-model-trigger-chevron" />
          </button>

          {activeTab === 'studio' && (
            <>
              {/* 올린 원본 영상 리스트 트리거 */}
          <button
            type="button"
            className="toss-model-trigger toss-video-list-trigger"
            onClick={() => setIsVideoListModalOpen(true)}
            title={dict.header.manageVideosTitle}
          >
            <span className="toss-model-trigger-icon">
              <Film size={13} />
            </span>
            <span className="toss-model-trigger-text">
              <span className="toss-model-trigger-label">{dict.header.uploadedVideos}</span>
              <span className="toss-model-trigger-name">
                <span className="toss-video-count-full">
                  {videos.length === 0 ? dict.common.noVideos : `${videos.length} ${dict.common.videos}`}
                </span>
                <span className="toss-video-count-short">
                  {videos.length}
                </span>
              </span>
            </span>
            <ChevronDown size={14} className="toss-model-trigger-chevron" />
          </button>

          {/* 상단 헤더는 편집 중인 단계에 집중할 수 있도록 저장/다운로드 CTA를 두지 않는다.
              영상 저장은 7~8번(썸네일·다운로드) 단계 카드에서만 실행한다. */}

            </>
          )}

          {/* 스튜디오 설정 트리거 버튼 (데스크탑 & 모바일) */}
          <button
            type="button"
            className="toss-settings-trigger"
            onClick={() => setIsSettingsModalOpen(true)}
            title={dict.common.settings || '설정'}
            aria-label={dict.common.settings || '설정'}
          >
            <Settings size={15} />
            <span className="toss-settings-trigger-text">{dict.common.settings || '설정'}</span>
          </button>
        </div>
        </div>

        {/* 모바일 전용 2번째 줄: 앱 메뉴 텍스트 탭 스트립 (KNOCKIT 스타일). 스크롤 다운 시 자동으로 접혀 화면 공간을 확보하고, 스크롤 업 시 다시 펼쳐진다 */}
        {activeTab !== 'studio' && (
          <div
            className={`toss-nav-tab-strip ${isTabStripHidden ? 'is-hidden' : ''}`}
            role="navigation"
            aria-label={ui('주요 메뉴')}
          >
            <button
              type="button"
              className={`toss-strip-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
              aria-current={activeTab === 'projects' ? 'page' : undefined}
              onClick={() => {
                if (activeTab === 'projects') {
                  onViewProjects?.();
                } else {
                  navigateToTab('projects');
                }
              }}
            >
              <Film size={15} />
              <span>{dict.community?.studioTab || dict.projects?.tabTitle || '스튜디오'}</span>
            </button>
            <button
              type="button"
              className={`toss-strip-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
              aria-current={activeTab === 'community' ? 'page' : undefined}
              onClick={() => navigateToTab('community')}
            >
              <Share2 size={15} />
              <span>{dict.community?.communityTab || '영상 공유'}</span>
            </button>
          </div>
        )}
      </header>

      {/* 2. 본문: 영상 공유 커뮤니티 또는 스튜디오 프로젝트 목록 또는 스튜디오 상세 2열 레이아웃 */}
      {activeTab === 'community' ? (
        <React.Suspense
          fallback={
            <div className="app-lazy-section">
              <div className="app-lazy-spinner" />
            </div>
          }
        >
          <VideoCommunityView
            onOpenStudio={() => {
              if (videos.length > 0 || result) {
                navigateToTab('studio');
              } else {
                navigateToTab('projects');
              }
            }}
          />
        </React.Suspense>
      ) : activeTab === 'projects' ? (
        <StudioProjectListView
          projects={projectSummaries}
          currentProjectId={currentProjectId || null}
          isLoading={isLoadingProjects}
          onOpenProject={async (id) => {
            try {
              await onOpenProject?.(id);
            } finally {
              navigateToTab('studio');
            }
          }}
          onDuplicateProject={(id) => onDuplicateProject?.(id)}
          onDeleteProject={(id) => onDeleteProject?.(id)}
          onStartNewProject={requestNewProject}
        />
      ) : (
        <main className="toss-main-content">
        {/* 통합 스튜디오 단계 안내: 처음 만드는 흐름과 컷이 생긴 흐름 모두 9단계
            모바일(1024px 이하)에서는 잘리던 가로 스텝 스트립 대신 컴팩트 스텝 헤더 + 전체 단계 바텀시트를 쓴다 */}
        {isMobileViewport ? (
          <MobileStudioStepHeader
            stepIndex={activeStudioStepIndex}
            totalSteps={studioSteps.length}
            stepLabel={activeMobileStepItem?.label ?? ui(activeStudioStep.label)}
            stepStatus={activeMobileStepItem?.status ?? getStudioStepStatus(activeSection)}
            stepPositionLabel={`${activeStudioStepIndex + 1} / ${studioSteps.length}`}
            viewAllLabel={ui('전체 보기')}
            openAllAriaLabel={ui('전체 단계 보기')}
            onOpenAll={() => setIsStepSheetOpen(true)}
          />
        ) : (
        <nav className="toss-studio-stepbar" aria-label={ui('편집 순서')}>
          <div className="toss-studio-stepbar-head">
            <span className="toss-studio-stepbar-eyebrow">
              {isCreationFlow ? ui('처음 만드는 순서') : ui('편집 순서')}
            </span>
            <strong className="toss-studio-stepbar-title">
              {ui('1번부터 9번까지, 순서대로만 눌러주세요')}
            </strong>
          </div>
          <ol className="toss-studio-steps" ref={stepbarListRef}>
            {studioSteps.map((step, index) => {
              const isActive = activeSection === step.id;
              const status = getStudioStepStatus(step.id);
              return (
                <li key={step.id} className="toss-studio-step-item">
                  <button
                    type="button"
                    ref={isActive ? activeStepButtonRef : undefined}
                    className={`toss-studio-step ${isActive ? 'active' : ''}`}
                    onClick={() => goToSection(step.id)}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="toss-studio-step-num">
                      {step.id === 'intro' ? (
                        <Type size={14} />
                      ) : step.id === 'introStyle' ? (
                        <Film size={14} />
                      ) : step.id === 'upload' ? (
                        <Upload size={14} />
                      ) : step.id === 'ai' ? (
                        <Sparkles size={14} />
                      ) : step.id === 'cut' ? (
                        <Scissors size={14} />
                      ) : step.id === 'bridge' ? (
                        <ArrowRight size={14} />
                      ) : step.id === 'outro' ? (
                        <Check size={14} />
                      ) : step.id === 'music' ? (
                        <Music size={14} />
                      ) : step.id === 'thumbnail' ? (
                        <ImageIcon size={14} />
                      ) : (
                        <Download size={14} />
                      )}
                    </span>
                    <span className="toss-studio-step-text">
                      <span className="toss-studio-step-label">
                        <span className="toss-studio-step-index">{index + 1}</span>
                        {ui(step.label)}
                      </span>
                      <span className="toss-studio-step-status">{status}</span>
                    </span>
                  </button>
                  {index < studioSteps.length - 1 && (
                    <span className="toss-studio-step-connector" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        )}

        {/* 누락 파일 일괄 재연결 알림 배너: 아직 하이라이트 분석 전(초기 업로드 단계)에만 표시 */}
        {isDraftPreview && !result?.url && videos.some((v) => !v.url || (v.file && v.file.size === 0) || v.error || v.isMissingFile) && (
          <div className="toss-relink-banner">
            <div className="toss-relink-banner-left">
              <div className="toss-relink-icon-wrap">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="toss-relink-title">
                  {ui('원본 영상 {count}개의 연결이 필요해요', { count: videos.filter((v) => !v.url || (v.file && v.file.size === 0) || v.error || v.isMissingFile).length })}
                </div>
                <div className="toss-relink-desc">
                  {ui('기기에 원본이 없어 다시 연결해야 해요. 영상 파일을 지참하셔야 이전 편집점과 분석 결과를 그대로 이어서 작업할 수 있어요.')}
                </div>
              </div>
            </div>
            <div className="toss-relink-actions">
              {onRelinkBatch && (
                <label className="toss-relink-btn-batch">
                  <Link2 size={13} />
                  <span>{ui('누락 영상 일괄 연결')}</span>
                  <input
                    type="file"
                    multiple
                    accept="video/*,image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onRelinkBatch(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => setIsVideoListModalOpen(true)}
                className="toss-relink-btn-list"
              >
                {ui('목록 확인')}
              </button>
            </div>
          </div>
        )}

        <div className="toss-studio-columns">
        {/* 2-A. 왼쪽 열: 16:9 모니터 & 배경음악 업로드
            모바일에서 빈 플레이어이거나 다운로드 단계면 생략하고
            활성 단계 카드(영상 올리기·저장 등) 하나만 보여준다. */}
        {!hidePlayerColumnForMobile && (
        <section className="toss-column-left">
          <div className="toss-card toss-player-card">
            {/* 영상 상단 왼쪽, 오른쪽 문구 직관 입력창 (모바일에서는 숨기고 인트로 단계 카드 안에서만 보여준다) */}
            <div className="toss-video-header-bar">{overlayTextInputFields}</div>

            {/* 플레이어 스테이지 (전체화면 지원) */}
            <div
              ref={playerStageRef}
              className={`toss-player-stage ${isFullscreen ? 'is-fullscreen' : ''}`}
            >
              <div
                className={`toss-player-wrapper ${
                  activeVideoUrl || standalonePreviewSection ? 'has-video' : 'is-empty'
                } ${isPortraitOutput ? 'is-portrait-frame' : ''}`}
              >
                {activeVideoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={activeVideoUrl}
                      preload="metadata"
                      playsInline
                      muted={isMuted}
                      onPlay={() => {
                        if (!isSequenceMode) {
                          setIsPlaying(true);
                        }
                      }}
                      onPause={() => {
                        if (!isSequenceMode) {
                          setIsPlaying(false);
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        if (Number.isFinite(d) && d > 0) {
                          setPreviewNativeDuration(d);
                        }
                        if (isSequenceMode) {
                          renderCompositorAt(currentTimeRef.current);
                        }
                      }}
                      onSeeked={() => {
                        if (isSequenceMode) {
                          renderCompositorAt(currentTimeRef.current);
                        }
                      }}
                      onError={(e) => {
                        const err = e.currentTarget.error;
                        console.error('[VideoPlayer] Media load error:', {
                          src: e.currentTarget.currentSrc,
                          code: err?.code,
                          message: err?.message,
                        });
                        if (!isSequenceMode) {
                          setIsPlaying(false);
                          setPlaybackError(dict.draftPreview?.playbackError || ui(PLAYBACK_ERROR_MESSAGE));
                        }
                      }}
                      onTimeUpdate={(e) => {
                        if (isSequenceMode || isScrubbingRef.current) return;
                        const cur = e.currentTarget.currentTime;
                        setCurrentTime(Math.min(cur, totalDuration));
                      }}
                      onEnded={() => {
                        if (isSequenceMode) return;
                        setIsPlaying(false);
                        if (totalDuration > 0) {
                          setCurrentTime(totalDuration);
                        }
                      }}
                      onLoadedData={() => {
                        if (isSequenceMode && !thumbnailBgCanvasRef.current && videoRef.current) {
                          const bg = captureVideoFrameFromElement(
                            videoRef.current,
                            activePlayingSegment?.cropOffsetYRatio ?? 0.2,
                            thumbWidth,
                            thumbHeight,
                            activePlayingSegment?.rotation ?? 0,
                            activePlayingSegment?.cropOffsetXRatio ?? 0.5
                          );
                          if (bg) {
                            thumbnailBgCanvasRef.current = bg;
                            if (!thumbnailUrl) {
                              const artCanvas = renderThumbnailArtwork(bg, {
                                titleText: overlayOptions.titleText,
                                channelText: '',
                                badgeText: '',
                                showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
                                showBadge: false,
                                showChannel: false,
                                stylePreset: thumbnailStyle,
                              });
                              setThumbnailUrl(artCanvas.toDataURL('image/jpeg', 0.95));
                              artCanvas.width = 0;
                              artCanvas.height = 0;
                            }
                          }
                        }
                        if (isSequenceMode) {
                          renderCompositorAt(currentTimeRef.current);
                        }
                      }}
                      onClick={togglePlay}
                      onDoubleClick={toggleFullscreen}
                      className="toss-video-element"
                      style={
                        isSequenceMode
                          ? {
                              opacity: 0,
                              pointerEvents: 'none',
                              position: 'absolute',
                              inset: 0,
                            }
                          : activePlayingSegment?.rotation
                          ? {
                              transform: `rotate(${activePlayingSegment.rotation}deg)${
                                activePlayingSegment.rotation === 90 || activePlayingSegment.rotation === 270
                                  ? ' scale(0.5625)'
                                  : ''
                              }`,
                              transition: 'transform 0.25s ease',
                            }
                          : undefined
                      }
                    />

                    {/* 영상 우측 상단 퀵 확대/축소 버튼 */}
                    <button
                      type="button"
                      className="toss-video-fullscreen-overlay-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      title={
                        isFullscreen
                          ? (dict.player?.exitFullscreen || '전체화면 축소')
                          : (dict.player?.fullscreen || '전체화면 확대')
                      }
                    >
                      {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>

                    {!isPlaying && (
                      <button
                        type="button"
                        className="toss-canvas-play-overlay"
                        onClick={togglePlay}
                        title={
                          isAtEnd
                            ? (dict.player?.replay || '처음부터 다시 재생')
                            : dict.player.play
                        }
                      >
                        {isAtEnd ? (
                          <RotateCcw size={28} className="text-white" />
                        ) : (
                          <Play size={28} className="ml-1 text-white" />
                        )}
                      </button>
                    )}

                    {!isSequenceMode &&
                      !standalonePreviewSection &&
                      !result?.url &&
                      ((overlayOptions.showTitle && overlayOptions.titleText) || activePlayingMetaText) && (
                        <div className="toss-live-overlay-top-left">
                          {overlayOptions.showTitle && overlayOptions.titleText && (
                            <div className="toss-live-overlay-title">
                              {overlayOptions.titleText}
                            </div>
                          )}
                          {activePlayingMetaText && (
                            <div className="toss-live-overlay-meta">
                              {activePlayingMetaText}
                            </div>
                          )}
                        </div>
                      )}

                    {!isSequenceMode && !standalonePreviewSection && !result?.url && overlayOptions.showChannel && overlayOptions.channelText && (
                      <div className="toss-live-overlay-channel">
                        {overlayOptions.channelText}
                      </div>
                    )}

                    {!isSequenceMode && !standalonePreviewSection && !result?.url && overlayOptions.showSubtitle && activePlayingSubtitleText && (
                      <div className="toss-live-overlay-subtitle">
                        {activePlayingSubtitleText}
                      </div>
                    )}
                  </>
                ) : segments.length > 0 ? (
                  /* 원본 영상이 메모리 정리로 분리되었으나, 하이라이트 편집 데이터가 안전 보관된 상태 */
                  <div className="toss-player-preserved-wrapper">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt="Project Thumbnail"
                        className="toss-player-preserved-bg"
                      />
                    ) : (
                      <div className="toss-player-preserved-placeholder" />
                    )}
                    <div className="toss-player-preserved-overlay">
                      <div className="toss-player-preserved-badge">
                        <Sparkles size={12} />
                        <span>{ui('보관된 하이라이트 세션')}</span>
                      </div>
                      <h3 className="toss-player-preserved-title">
                        {overlayOptions.titleText || ui('AI 하이라이트 영상')}
                      </h3>
                      <p className="toss-player-preserved-desc">
                        {ui('{count}개 클립 · {duration} 편집 구간이 안전하게 보관되어 있어요.', { count: segments.length, duration: formatSec(totalDuration) })}
                      </p>
                      <div className="toss-player-preserved-actions">
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => handleDownload()}
                          leftIcon={<Download size={13} />}
                        >
                          {ui('영상 내보내기 & 다운로드')}
                        </Button>
                        {onStartNewProject && (
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={requestNewProject}
                            leftIcon={<Plus size={13} />}
                          >
                            {ui('새 영상 만들기')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="toss-player-empty"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="toss-empty-circle-icon">
                      <Upload size={26} className="text-slate-900" />
                    </div>
                    <h3 className="toss-empty-title">{ui('영상 하나만 올리면 시작돼요')}</h3>
                    <p className="toss-empty-desc">
                      {ui('올린 영상에서 AI가 하이라이트를 뽑아줘요.')}<br />
                      {ui('그다음은')} <strong>{ui('1번 인트로 문구 → 2번 인트로 스타일 → 3번 영상 올리기 → 4번 AI 하이라이트 → 5번 브릿지 → 6번 아웃트로 → 7번 노래')}</strong>{' '}
                      {ui('순서로만 따라가면 끝나요.')}
                    </p>
                    <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => fileInputRef.current?.click()}
                        leftIcon={<Upload size={14} />}
                      >
                        {ui('영상 올리기')}
                      </Button>
                      {onStartNewProject && (
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={requestNewProject}
                          leftIcon={<Plus size={14} />}
                        >
                          {ui('새 프로젝트로 시작')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* AI 컷이 없어도 인트로/브릿지/아웃트로를 그려주는 독립 캔버스 */}
                {(isSequenceMode || standalonePreviewSection) && (
                  <canvas
                    ref={previewCanvasRef}
                    width={frame.width}
                    height={frame.height}
                    onClick={togglePlay}
                    onDoubleClick={toggleFullscreen}
                    className={`toss-video-canvas ${standalonePreviewSection ? 'toss-video-canvas-standalone' : ''}`}
                  />
                )}

                {standalonePreviewSection && !activeVideoUrl && !isPlaying && (
                  <button
                    type="button"
                    className="toss-canvas-play-overlay"
                    onClick={togglePlay}
                    title={ui('미리보기 재생')}
                  >
                    <Play size={28} className="ml-1 text-white" />
                  </button>
                )}
              </div>

              {/* 비디오 재생 트랜스포트 바 (인트로/브릿지/아웃트로 모션 미리보기 중에는 숨김) */}
              {activeVideoUrl && !standalonePreviewSection && (
                <div className="toss-transport-bar">
                  <div className="toss-transport-left">
                    <button
                      type="button"
                      className="toss-btn-step"
                      onClick={() => seekRelative(-5)}
                      title={dict.player.rewind5s}
                    >
                      <RotateCcw size={13} />
                      <span>-5s</span>
                    </button>

                    <button
                      type="button"
                      className="toss-play-btn"
                      onClick={togglePlay}
                      title={
                        isPlaying
                          ? dict.player.pause
                          : isAtEnd
                          ? (dict.player?.replay || '처음부터 다시 재생')
                          : dict.player.play
                      }
                    >
                      {isPlaying ? (
                        <Pause size={18} />
                      ) : isAtEnd ? (
                        <RotateCcw size={18} />
                      ) : (
                        <Play size={18} className="ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      className="toss-btn-step"
                      onClick={() => seekRelative(5)}
                      title={dict.player.forward5s}
                    >
                      <span>+5s</span>
                      <FastForward size={13} />
                    </button>

                    <div className="toss-timecode-text">
                      <span className="font-bold text-slate-900">{formatSec(currentTime)}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-500">{formatSec(totalDuration)}</span>
                    </div>
                  </div>

                  {/* 프로그레스 스크럽 바 */}
                  <div
                    ref={progressTrackRef}
                    className={`toss-progress-track ${isScrubbing ? 'is-scrubbing' : ''}`}
                    onPointerDown={handleProgressPointerDown}
                    title={dict.player.seekTooltip}
                  >
                    <div
                      className="toss-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                        transition: isScrubbing ? 'none' : undefined,
                      }}
                    />
                    <div
                      className="toss-progress-thumb"
                      style={{
                        left: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                      }}
                    />
                  </div>

                  <div className="toss-transport-right">
                    <button
                      type="button"
                      className={`toss-btn-icon ${isMuted ? 'muted' : ''}`}
                      onClick={toggleMute}
                      title={isMuted ? dict.player.unmute : dict.player.mute}
                    >
                      {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                    </button>

                    <button
                      type="button"
                      className={`toss-btn-icon ${isFullscreen ? 'active' : ''}`}
                      onClick={toggleFullscreen}
                      title={
                        isFullscreen
                          ? (dict.player?.exitFullscreen || '전체화면 축소')
                          : (dict.player?.fullscreen || '전체화면 확대')
                      }
                    >
                      {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {playbackError && (
              <div className="toss-playback-error" role="alert">
                <span className="toss-playback-error-dot" />
                <span>{playbackError}</span>
              </div>
            )}
          </div>

          {(showDraftPreviewBox || showTimelineSequencer) && (
          <div className="toss-card toss-timeline-card">
            {/* 하이라이트 전: 가짜 시퀀스 대신 원본 영상 미리보기 선택
                모바일에서는 관련 단계(영상 올리기/AI)에서만 보여준다 */}
            {showDraftPreviewBox && (
              <div className="toss-timeline-sequencer-box toss-draft-preview-box">
                <div className="toss-sequencer-header">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Film size={14} className="text-slate-900 shrink-0" />
                    <span className="toss-sequencer-title">
                      {dict.draftPreview?.title || '원본 영상 미리보기'}
                    </span>
                    <span className="toss-sequencer-badge">
                      {interpolate(dict.draftPreview?.videosCount || '{count}개 영상', {
                        count: videos.length,
                      })}{' '}
                      · {formatSec(originalTotalDuration)}
                    </span>
                  </div>
                </div>
                <p className="toss-draft-preview-desc">
                  {dict.draftPreview?.desc ||
                    'AI 하이라이트를 만들면 여기에 클립이 채워져요. 지금은 올린 영상을 그대로 볼 수 있어요.'}
                </p>
                <div
                  className="toss-draft-preview-list"
                  role="listbox"
                  aria-label={dict.draftPreview?.listAriaLabel || '미리볼 원본 영상'}
                >
                  {videos.map((v, idx) => {
                    const isActive = v.id === previewVideo?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`toss-draft-preview-item ${isActive ? 'active' : ''}`}
                        onClick={() => setPreviewVideoId(v.id)}
                        title={v.name}
                      >
                        <span className="toss-draft-preview-thumb">
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt="" />
                          ) : (
                            <Film size={14} className="text-slate-400" />
                          )}
                          <span className="toss-draft-preview-idx">{idx + 1}</span>
                        </span>
                        <span className="toss-draft-preview-meta">
                          <span className="toss-draft-preview-name">{v.name}</span>
                          <span className="toss-draft-preview-dur">
                            {(!v.url || (v.file && v.file.size === 0) || v.error) ? (
                              <span className="text-red-500 font-bold">{ui('재선택 필요')}</span>
                            ) : v.duration > 0 ? (
                              formatSec(v.duration)
                            ) : (
                              '--:--'
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 시퀀스 타임라인 스트립 (V1 영상 + A1 배경음악 멀티트랙)
                모바일에서는 컷/브릿지 단계에서만 노출해 첫 화면을 가볍게 유지한다 (컷 편집은 toss-cut-navigator로도 가능) */}
            {showTimelineSequencer && (
              <div className="toss-timeline-sequencer-box">
                <div className="toss-sequencer-header">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Film size={14} className="text-slate-900 shrink-0" />
                    <span className="toss-sequencer-title">{dict.sequencer.title}</span>
                    <span className="toss-sequencer-badge">
                      {interpolate(dict.sequencer.clipsCount, { count: segments.length })} · {formatSec(totalDuration)}
                    </span>
                    {customAudioFile && customAudioDuration && customAudioDuration > 0 && (
                      overlayOptions.bgmFitToVideo ? (
                        <span
                          className="toss-sequencer-music-badge ok"
                          title={ui('배경음악이 영상 전체 길이에 맞춰 배속으로 딱 맞게 동기화돼요')}
                        >
                          <Music size={10} className="shrink-0" />
                          <span>
                            {ui('배속 동기화 ({speed}x · {duration})', { speed: calculatedBgmSpeed || '1.0', duration: formatSec(totalDuration) })}
                          </span>
                        </span>
                      ) : isMusicExceeded ? (
                        <span
                          className="toss-sequencer-music-badge warning"
                          title={
                            dict.sequencer.musicBadgeOverflowTip ||
                            '영상 총 길이가 배경음악 1곡 길이를 초과하여 음악이 한 번 더 반복 재생돼요'
                          }
                        >
                          <Music size={10} className="shrink-0" />
                          <span>
                            {interpolate(
                              dict.sequencer.musicBadgeOverflow ||
                                '음악 {duration} · +{overflow}s 초과 (반복 재생)',
                              {
                                duration: formatSec(customAudioDuration),
                                overflow: musicOverflowSec.toFixed(1),
                              }
                            )}
                          </span>
                        </span>
                      ) : (
                        <span
                          className={`toss-sequencer-music-badge ${isMusicTrimmed ? 'trimmed' : 'ok'}`}
                          title={
                            isMusicTrimmed
                              ? interpolate(
                                  dict.sequencer.musicBadgeTrimmedTip ||
                                    '배경음악 원곡({duration})이 영상 길이({used})보다 길어 영상에 맞춰 앞부분만 사용돼요',
                                  {
                                    duration: formatSec(customAudioDuration),
                                    used: formatSec(totalDuration),
                                  }
                                )
                              : (dict.sequencer.musicBadgeOkTip ||
                                  '영상이 배경음악 1회 재생 길이 안에 깔끔하게 들어와요')
                          }
                        >
                          <Music size={10} className="shrink-0" />
                          <span>
                            {isMusicTrimmed
                              ? interpolate(
                                  dict.sequencer.musicBadgeTrimmed || '원곡 {duration} 중 {used} 사용',
                                  {
                                    duration: formatSec(customAudioDuration),
                                    used: formatSec(totalDuration),
                                  }
                                )
                              : interpolate(
                                  dict.sequencer.musicBadgeOk || '음악 {duration} (반복 없음)',
                                  { duration: formatSec(customAudioDuration) }
                                )}
                          </span>
                        </span>
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isMusicExceeded && segments.length > 1 && (
                      <button
                        type="button"
                        className="toss-sequencer-fit-music-btn"
                        onClick={handleFitSegmentsToMusic}
                        title={
                          dict.sequencer.fitMusicBtnTip ||
                          '배경음악 1곡 길이를 넘어가는 뒷부분 영상 클립들을 자동으로 제외해요'
                        }
                      >
                        <Scissors size={11} />
                        <span>
                          {dict.sequencer.fitMusicBtn || '음악 길이에 맞춰 초과 클립 제외'}
                        </span>
                      </button>
                    )}
                    <span className="toss-sequencer-hint">{dict.sequencer.hint}</span>
                  </div>
                </div>

                <div className="toss-sequencer-multitrack">
                  {/* 좌측 트랙 헤더 (Ruler / V1 영상 / A1 음악) */}
                  <div className="toss-sequencer-track-labels" aria-hidden="true">
                    <div className="toss-track-label-ruler">TIME</div>
                    <div className="toss-track-label-row video">
                      <Film size={11} />
                      <span>{dict.sequencer.trackVideo || 'V1 영상'}</span>
                    </div>
                    <div className="toss-track-label-row audio">
                      <Music size={11} />
                      <span>{dict.sequencer.trackAudio || 'A1 음악'}</span>
                    </div>
                  </div>

                  {/* 우측 타임라인 캔버스 (클릭 및 드래그 시 해당 시간으로 실시간 시크) */}
                  <div
                    ref={sequencerCanvasRef}
                    className={`toss-sequencer-tracks-canvas ${isScrubbing ? 'is-scrubbing' : ''}`}
                    onPointerDown={handleSequencerPointerDown}
                    title={dict.player.seekTooltip}
                  >
                    {/* 상단 타임코드 눈금자 (Ruler) */}
                    <div className="toss-sequencer-ruler">
                      <span className="toss-ruler-tick" style={{ left: '0%' }}>
                        00:00
                      </span>
                      <span className="toss-ruler-tick" style={{ left: '25%' }}>
                        {formatSec(totalDuration * 0.25)}
                      </span>
                      <span className="toss-ruler-tick" style={{ left: '50%' }}>
                        {formatSec(totalDuration * 0.5)}
                      </span>
                      <span className="toss-ruler-tick" style={{ left: '75%' }}>
                        {formatSec(totalDuration * 0.75)}
                      </span>
                      <span className="toss-ruler-tick end" style={{ left: '100%' }}>
                        {formatSec(totalDuration)}
                      </span>
                      {isMusicExceeded && customAudioDuration && (
                        <span
                          className="toss-ruler-music-end-tag"
                          style={{
                            left: `${Math.min(96, Math.max(4, (customAudioDuration / (totalDuration || 1)) * 100))}%`,
                          }}
                          title={interpolate(
                            dict.sequencer.musicEndTagTip || '배경음악 1회차 종료 시점 ({duration})',
                            { duration: formatSec(customAudioDuration) }
                          )}
                        >
                          {interpolate(dict.sequencer.musicEndTag || '🎵 {duration} 음악 끝', {
                            duration: formatSec(customAudioDuration),
                          })}
                        </span>
                      )}
                    </div>

                    {/* 재생 헤드 (V1 + A1 관통) */}
                    <div
                      className="toss-sequencer-playhead"
                      style={{
                        left: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                      }}
                    >
                      <div className="toss-playhead-cap" />
                      <div className="toss-playhead-line" />
                    </div>

                    {/* 영상 종료 시점 경계선 (100% 끝에서 영상이 확실하게 닫힘 표시) */}
                    <div
                      className="toss-sequencer-end-boundary"
                      title={interpolate(dict.sequencer.videoEndTagTip || '영상 종료 시점 ({duration})', {
                        duration: formatSec(totalDuration),
                      })}
                    />

                    {/* 음악 1회차 종료 & 반복 시작 경계선 (V1 + A1 관통) */}
                    {isMusicExceeded && customAudioDuration && (
                      <div
                        className="toss-sequencer-music-limit-line"
                        style={{
                          left: `${Math.min(100, Math.max(0, (customAudioDuration / (totalDuration || 1)) * 100))}%`,
                        }}
                        title={interpolate(
                          dict.sequencer.musicLimitLineTip ||
                            '배경음악 1회차 종료 ({duration}) — 이후 구간은 음악이 처음부터 다시 반복돼요',
                          { duration: formatSec(customAudioDuration) }
                        )}
                      />
                    )}

                    {/* V1: 비디오 클립 시퀀스 트랙 */}
                    <div className="toss-sequencer-strip">
                      {/* 시작 인트로 블록 (인터로가 포함된 경우) */}
                      {introDuration > 0 && (
                        <div
                          className={`toss-sequencer-block toss-sequencer-intro-block ${activePlayingSegmentId === 'intro' ? 'playing' : ''} ${activeSection === 'intro' || activeSection === 'introStyle' ? 'selected' : ''}`}
                          style={{
                            flex: `${Math.max(0.01, introDuration)} 1 0%`,
                            minWidth: 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (suppressSegmentClickRef.current) {
                              return;
                            }
                            handleSelectSegment('intro');
                          }}
                          title={`${dict.introOutro.introTitle} (${introDuration.toFixed(1)}s)`}
                        >
                          <div className="toss-sequencer-block-overlay">
                            <span className="toss-block-idx">Intro</span>
                            <span className="toss-block-dur">{introDuration.toFixed(1)}s</span>
                          </div>
                        </div>
                      )}

                      {segments.map((seg, idx) => {
                        const isCurrent = seg.id === activePlayingSegmentId && activePlayingBridgeIndex !== idx;
                        const isSelected = (activeSection === 'cut' || activeSection === 'caption') && seg.id === selectedSegmentId;
                        const bridgeDur = effectiveBridgeDurationMap[seg.id] ?? 0;
                        const widthPct = ((seg.duration + bridgeDur) / (totalDuration || 1)) * 100;
                        const vItem = videoMap.get(seg.sourceVideoId);
                        const segOffset = segmentTimelineOffsets[seg.id];
                        const isExceedingMusic = Boolean(
                          isMusicExceeded &&
                          customAudioDuration &&
                          segOffset &&
                          segOffset.endOffset > customAudioDuration + 0.15
                        );
                        const isFullyBeyondMusic = Boolean(
                          isMusicExceeded &&
                          customAudioDuration &&
                          segOffset &&
                          segOffset.startOffset >= customAudioDuration - 0.05
                        );
                        const segDur = seg.duration;
                        const isLastClip = idx === segments.length - 1 && outroDuration === 0;
                        const isBridgeCandidate = idx > 0 && bridgeCandidateIndexes.includes(idx);
                        const isBridgeEnabled = bridgeDur > 0;
                        const isBridgeSelected = activeSection === 'bridge' && effectiveBridgeIndex === idx;
                        const isBridgePlaying = activePlayingBridgeIndex === idx;
                        const bridgePrev = isBridgeCandidate ? segments[idx - 1] : undefined;

                        return (
                          <React.Fragment key={seg.id}>
                            {isBridgeCandidate && (
                              <button
                                type="button"
                                className={`toss-sequencer-bridge-chip ${isBridgeEnabled ? 'is-active' : 'is-potential'} ${isBridgeSelected ? 'selected' : ''} ${isBridgePlaying ? 'playing' : ''}`}
                                style={{
                                  flex: isBridgeEnabled ? `${Math.max(0.01, bridgeDur)} 1 0%` : '0 0 auto',
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectBridge(idx);
                                }}
                                title={
                                  isBridgeEnabled
                                    ? ui('장면 전환 {from} → {to} ({seconds}s) · 눌러서 수정', { from: bridgePrev?.locationName || ui('이전 장소'), to: seg.locationName || ui('다음 장소'), seconds: bridgeDur.toFixed(1) })
                                    : ui('여기를 누르면 날짜·장소가 바뀌는 장면 전환을 넣을 수 있어요')
                                }
                              >
                                {isBridgeEnabled ? (
                                  <>
                                    <ArrowRight size={9} />
                                    <span className="toss-bridge-chip-label">{ui('브')}</span>
                                  </>
                                ) : (
                                  <Plus size={9} />
                                )}
                              </button>
                            )}
                            <div
                              className={`toss-sequencer-block ${isSelected ? 'selected' : ''} ${isCurrent ? 'playing' : ''} ${isExceedingMusic ? 'exceeds-music' : ''} ${isFullyBeyondMusic ? 'beyond-music' : ''} ${isLastClip ? 'is-video-end-clip' : ''}`}
                              style={{
                                flex: `${Math.max(0.01, segDur)} 1 0%`,
                                minWidth: 0,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (suppressSegmentClickRef.current) {
                                  return;
                                }
                                handleSelectSegment(seg.id);
                              }}
                              title={
                                isExceedingMusic && customAudioDuration
                                  ? `${ui('{title} • 음악 길이({duration}) 초과 구간', { title: interpolate(dict.sequencer.clipTitle, {
                                      idx: idx + 1,
                                      duration: seg.duration.toFixed(1),
                                      reason: seg.reason,
                                    }), duration: formatSec(customAudioDuration) })}`
                                  : interpolate(dict.sequencer.clipTitle, {
                                      idx: idx + 1,
                                      duration: seg.duration.toFixed(1),
                                      reason: seg.reason,
                                    })
                              }
                            >
                              {vItem?.thumbnailUrl && (
                                <img
                                  src={vItem.thumbnailUrl}
                                  alt=""
                                  className="toss-sequencer-block-thumb"
                                  style={
                                    seg.rotation
                                      ? {
                                          transform: `rotate(${seg.rotation}deg)${
                                            seg.rotation === 90 || seg.rotation === 270 ? ' scale(0.6)' : ''
                                          }`,
                                        }
                                      : undefined
                                  }
                                />
                              )}
                              <div className="toss-sequencer-block-overlay">
                                <div className="toss-block-top-row">
                                  <span className="toss-block-idx">#{idx + 1}</span>
                                  {segments.length > 1 && (
                                    <button
                                      type="button"
                                      className="toss-sequencer-block-delete"
                                      onClick={(e) => handleDeleteSegment(seg.id, e)}
                                      title={interpolate(
                                        dict.sequencer.deleteClipTip || '#{idx} 구간 제외하기',
                                        { idx: idx + 1 }
                                      )}
                                      aria-label={interpolate(
                                        dict.sequencer.deleteClipTip || '#{idx} 구간 제외하기',
                                        { idx: idx + 1 }
                                      )}
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                                <div className="toss-block-bottom-row">
                                  {isExceedingMusic && (
                                    <span
                                      className="toss-block-overflow-dot"
                                      title={
                                        dict.dramaticClips.musicOverflowSegmentTip ||
                                        '음악 길이 초과 구간'
                                      }
                                    />
                                  )}
                                  <span className="toss-block-dur">{seg.duration.toFixed(1)}s</span>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {/* 종료 아웃트로 블록 (아웃트로가 포함된 경우) */}
                      {outroDuration > 0 && (
                        <div
                          className={`toss-sequencer-block toss-sequencer-outro-block is-video-end-clip ${activePlayingSegmentId === 'outro' ? 'playing' : ''} ${activeSection === 'outro' ? 'selected' : ''}`}
                          style={{
                            flex: `${Math.max(0.01, outroDuration)} 1 0%`,
                            minWidth: 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (suppressSegmentClickRef.current) {
                              return;
                            }
                            handleSelectSegment('outro');
                          }}
                          title={`${dict.introOutro.outroTitle} (${outroDuration.toFixed(1)}s)`}
                        >
                          <div className="toss-sequencer-block-overlay">
                            <span className="toss-block-idx">Outro</span>
                            <span className="toss-block-dur">{outroDuration.toFixed(1)}s</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* A1: 배경음악 구간 트랙 (1회차 원곡 재생 구간 & 초과 시 반복 구간 표시) */}
                    <div
                      className="toss-sequencer-audio-strip"
                      onClick={() => {
                        if (suppressSegmentClickRef.current) return;
                        goToSection('music');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          goToSection('music');
                        }
                      }}
                      title={ui('노래 설정 열기')}
                    >
                      {customAudioFile ? (
                        audioTimelineBlocks.length > 0 ? (
                          audioTimelineBlocks.map((block) => {
                            const isTrailingTrimmed = isMusicTrimmed && !block.isLoop;
                            return (
                              <div
                                key={`audio_cycle_${block.cycleIndex}`}
                                className={`toss-sequencer-audio-block ${block.isLoop ? 'loop-overflow' : 'primary'} ${isTrailingTrimmed ? 'is-trimmed-trailing' : ''}`}
                                style={{ width: `${block.widthPct}%` }}
                                title={
                                  block.isLoop
                                    ? ui('{name} — {cycle}회차 반복 재생 구간 ({start} ~ {end}, +{extra}s)', { name: customAudioName, cycle: block.cycleIndex + 1, start: formatSec(block.startSec), end: formatSec(block.endSec), extra: block.durationSec.toFixed(1) })
                                    : isTrailingTrimmed
                                    ? interpolate(
                                        dict.sequencer.musicTrimmedTip ||
                                          '{name} — 원곡({total}) 중 영상에 맞춰 앞부분 {used} 재생 (이후 페이드아웃, 뒤에 더 긴 원곡이 있어요)',
                                        {
                                          name: customAudioName,
                                          total: formatSec(customAudioDuration || block.durationSec),
                                          used: formatSec(block.durationSec),
                                        }
                                      )
                                    : ui('{name} — 1회차 원곡 재생 ({start} ~ {end} / 원곡 총 {total})', { name: customAudioName, start: formatSec(block.startSec), end: formatSec(block.endSec), total: formatSec(customAudioDuration || block.durationSec) })
                                }
                              >
                                <div className="toss-audio-block-content">
                                  <div className="toss-audio-block-left">
                                    {block.isLoop ? (
                                      <RotateCw size={10} className="shrink-0" />
                                    ) : (
                                      <Music size={10} className="shrink-0" />
                                    )}
                                    <span className="toss-audio-block-name truncate">
                                      {block.isLoop
                                        ? ui('{cycle}회차 반복 · {name}', { cycle: block.cycleIndex + 1, name: customAudioName })
                                        : customAudioName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="toss-audio-block-dur">
                                      {block.isLoop
                                        ? ui('+{seconds}s 반복', { seconds: block.durationSec.toFixed(1) })
                                        : isTrailingTrimmed
                                        ? ui('{duration} / 원곡 {total}', { duration: formatSec(block.durationSec), total: formatSec(customAudioDuration || 0) })
                                        : formatSec(block.durationSec)}
                                    </span>
                                    {isTrailingTrimmed && (
                                      <span
                                        className="toss-audio-trailing-badge"
                                        title={interpolate(
                                          dict.sequencer.musicTrimmedTagTip ||
                                            '원곡 {duration} 중 {used} 사용됨 (뒤에 원곡이 더 이어져요)',
                                          {
                                            duration: formatSec(customAudioDuration || 0),
                                            used: formatSec(block.durationSec),
                                          }
                                        )}
                                      >
                                        <span>{dict.sequencer.musicTrimmedTag || '원곡 더 있음'}</span>
                                        <ArrowRight size={9} className="shrink-0" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isTrailingTrimmed && (
                                  <div className="toss-audio-trailing-fade-mask" aria-hidden="true" />
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div
                            className={`toss-sequencer-audio-block primary ${isMusicTrimmed ? 'is-trimmed-trailing' : ''}`}
                            style={{ width: '100%' }}
                          >
                            <div className="toss-audio-block-content">
                              <div className="toss-audio-block-left">
                                <Music size={10} className="shrink-0" />
                                <span className="toss-audio-block-name truncate">{customAudioName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="toss-audio-block-dur">
                                  {isMusicTrimmed && customAudioDuration
                                    ? ui('{duration} / 원곡 {total}', { duration: formatSec(totalDuration), total: formatSec(customAudioDuration) })
                                    : formatSec(totalDuration)}
                                </span>
                                {isMusicTrimmed && (
                                  <span className="toss-audio-trailing-badge">
                                    <span>{dict.sequencer.musicTrimmedTag || '원곡 더 있음'}</span>
                                    <ArrowRight size={9} className="shrink-0" />
                                  </span>
                                )}
                              </div>
                            </div>
                            {isMusicTrimmed && (
                              <div className="toss-audio-trailing-fade-mask" aria-hidden="true" />
                            )}
                          </div>
                        )
                      ) : (
                        <button
                          type="button"
                          className="toss-sequencer-audio-empty"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAudioLibraryOpen(true);
                          }}
                          title={
                            dict.sequencer.musicEmptyNoticeTip ||
                            '오디오 보관함에서 배경음악을 선택하면 영상 길이 대비 음악 구간이 표시돼요'
                          }
                        >
                          <span className="toss-sequencer-audio-empty-left">
                            <Music size={11} className="shrink-0" />
                            <span className="truncate">
                              {dict.sequencer.musicEmptyNotice ||
                                '배경음악 미선택 · 음악을 추가하면 영상 대비 길이가 표시돼요'}
                            </span>
                          </span>
                          <span className="toss-sequencer-audio-empty-badge">
                            {dict.sequencer.openAudioLibrary || '+ 오디오 보관함'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isMusicExceeded && customAudioDuration && (
                  <div className="toss-sequencer-overflow-notice">
                    <span className="toss-overflow-dot" />
                    <span>
                      {interpolate(
                        dict.sequencer.musicOverflowNotice ||
                          '영상이 음악 길이({duration})보다 +{overflow}초 길어 점선 이후 구간에서 음악이 한 번 더 재생돼요. 초과 구간의 영상 클립(주황색 테두리)을 몇 개 제외하면 깔끔하게 맞출 수 있어요.',
                        {
                          duration: formatSec(customAudioDuration),
                          overflow: musicOverflowSec.toFixed(1),
                        }
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

        </section>
        )}

        {/* 2-B. 오른쪽 열: [썸네일] -> [다운로드] -> [인트로] -> [AI 극적 순간] -> [아웃트로] -> [요약] */}
        <section className="toss-column-right" ref={rightColumnRef}>
          {/* 현재 편집 단계 안내 (한 번에 한 구간만 보여주기) */}
          <div className="toss-inspector-head">
            <span className="toss-inspector-kicker">
              {ui('{step}단계', { step: activeStudioStepIndex + 1 })}
            </span>
            <h3 className="toss-inspector-title">
              {ui('{label} 설정', { label: ui(activeStudioStep.label) })}
            </h3>
          </div>

          {/* 썸네일 단계: 완성된 영상의 16:9 대표 이미지 */}
          <div
            className={`toss-thumbnail-section toss-inspector-card ${activeSection === 'thumbnail' ? 'is-active-section' : ''}`}
          >
              <div className="toss-card toss-thumbnail-card">
              <BorderBeam
                duration={8}
                borderWidth={1.5}
              />
              <div className="toss-card-header">
                <div>
                  <h4 className="toss-card-title">
                    <ImageIcon size={16} className="text-slate-800 shrink-0" />
                    <span>{dict.thumbnail?.cardTitle || 'AI 맞춤 썸네일 (16:9)'}</span>
                  </h4>
                  {result?.bestThumbnailReason && (
                    <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800">
                      <Sparkles size={12} className="text-slate-700 shrink-0" />
                      <span>{(dict.thumbnail?.aiRecommendedPrefix || 'AI 추천')}: {result.bestThumbnailReason}</span>
                    </div>
                  )}
                </div>
                <span className="toss-tag-blue">
                  {dict.thumbnail?.previewBadge || '16:9 유튜브 규격'}
                </span>
              </div>

              {!result && !thumbnailUrl ? (
                <div className="toss-empty-state toss-thumbnail-empty">
                  <ImageIcon size={30} className="text-slate-300" />
                  <p className="toss-thumbnail-empty-title">
                    {isCreationFlow
                      ? ui('AI 하이라이트를 만들면 썸네일을 함께 준비할 수 있어요')
                      : ui('아직 완성된 썸네일이 없어요')}
                  </p>
                  <p className="toss-thumbnail-empty-desc">
                    {isCreationFlow
                      ? ui('4번 AI 하이라이트에서 영상을 분석하면 AI가 가장 잘 나온 장면으로 16:9 썸네일을 만들어줘요.')
                      : ui('현재 영상 화면을 그대로 캡처하거나, AI 하이라이트를 다시 뽑아 추천 프레임을 받아보세요.')}
                  </p>
                  <div className="toss-thumbnail-empty-actions">
                    <button
                      type="button"
                      className="toss-btn-primary toss-btn-sm"
                      onClick={() => goToSection(isCreationFlow ? 'ai' : 'cut')}
                    >
                      <Sparkles size={13} />
                      <span>{isCreationFlow ? ui('4번 AI 하이라이트로 가기') : ui('4번 컷으로 가기')}</span>
                    </button>
                    {activeVideoUrl && (
                      <button
                        type="button"
                        className="toss-btn-secondary toss-btn-sm"
                        onClick={handleCaptureCurrentFrame}
                        disabled={isUpdatingThumbnail}
                      >
                        <ImageIcon size={13} />
                        <span>{isUpdatingThumbnail ? ui('캡처 중...') : ui('현재 화면으로 만들기')}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
              {/* 썸네일 16:9 프리뷰 */}
              <div className="toss-thumbnail-preview-wrap">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="AI YouTube Thumbnail"
                    className="toss-thumbnail-img"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 py-10 px-4 text-center">
                    <ImageIcon size={32} className="text-slate-600 mb-2 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-600 mb-2">
                      {isUpdatingThumbnail
                        ? (dict.thumbnail?.generatingThumbnail || '썸네일 생성 중...')
                        : (dict.thumbnail?.loadingThumbnail || '썸네일 이미지를 불러오는 중이에요')}
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureCurrentFrame}
                      disabled={isUpdatingThumbnail}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                    >
                      {dict.thumbnail?.generateFromCurrentVideo || '현재 비디오 화면으로 썸네일 생성'}
                    </button>
                  </div>
                )}
              </div>

              {/* 썸네일 타이틀 및 스타일 컨트롤 */}
              <div className="toss-thumbnail-controls">
                {result?.aiThumbnailRecommendations && result.aiThumbnailRecommendations.length > 1 && (
                  <div className="toss-thumbnail-frames">
                    <span className="toss-thumbnail-frames-label">
                      {dict.thumbnail?.selectAiFrame || 'AI 추천 프레임 선택'}
                    </span>
                    <div className="toss-thumbnail-frame-list">
                      {result.aiThumbnailRecommendations.map((cand, idx) => {
                        const isCandSelected =
                          result?.bestSourceVideoId === cand.videoId &&
                          Math.abs((result?.bestThumbnailTime ?? -999) - cand.timestamp) < 0.1;
                        return (
                          <button
                            key={`${cand.videoId}-${cand.timestamp}-${idx}`}
                            type="button"
                            onClick={() => handleSelectThumbnailCandidate(cand)}
                            disabled={isUpdatingThumbnail}
                            className={`toss-thumbnail-frame-btn ${isCandSelected ? 'active' : ''}`}
                            title={cand.reason || cand.videoName}
                          >
                            <Sparkles size={11} className="toss-thumbnail-frame-icon" />
                            <span className="toss-thumbnail-frame-index">#{idx + 1}</span>
                            <span className="toss-thumbnail-frame-name">{cand.videoName}</span>
                            <span className="toss-thumbnail-frame-time">
                              {cand.timestamp.toFixed(1)}s
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="toss-thumbnail-input-group">
                  <div className="toss-thumbnail-label-row">
                    <label className="toss-thumbnail-label">
                      <Type size={13} className="text-slate-800" />
                      <span>{dict.thumbnail?.titleInputLabel || '썸네일 & 영상 타이틀'}</span>
                    </label>
                    <div className="toss-thumbnail-label-actions">
                      {result?.suggestedTitle && overlayOptions.titleText === result.suggestedTitle && (
                        <span className="toss-thumbnail-ai-tag">
                          {dict.thumbnail?.aiTitleBadge || 'AI 추천 타이틀'}
                        </span>
                      )}
                      <label
                        className="toss-thumbnail-title-toggle"
                        title={dict.thumbnail?.overlayToggleTip || '썸네일 내 타이틀 문구 표시 여부'}
                      >
                        <span>{dict.thumbnail?.overlayToggle || '타이틀 텍스트 오버레이'}</span>
                        <span className="toss-toggle-switch">
                          <input
                            type="checkbox"
                            checked={showThumbnailTitle}
                            onChange={(e) => setShowThumbnailTitle(e.target.checked)}
                          />
                          <span className="toss-toggle-slider" />
                        </span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={overlayOptions.titleText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOverlayOptions((prev) => ({
                        ...prev,
                        titleText: val,
                        showTitle: val.trim().length > 0,
                      }));
                    }}
                    placeholder={
                      dict.thumbnail?.titleInputPlaceholder ||
                      '유튜브 클릭률을 높일 매력적인 제목을 입력하세요'
                    }
                    className="toss-thumbnail-input"
                  />
                </div>

                {showThumbnailTitle && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-semibold text-slate-500">
                      {dict.thumbnail?.stylePreset || '스타일 프리셋'}
                    </span>
                    <div className="toss-thumbnail-style-group">
                      <button
                        type="button"
                        className={`toss-thumb-style-btn ${thumbnailStyle === 'youtube-bold' ? 'active' : ''}`}
                        onClick={() => setThumbnailStyle('youtube-bold')}
                      >
                        {dict.thumbnail?.styleBold || '유튜브 볼드'}
                      </button>
                      <button
                        type="button"
                        className={`toss-thumb-style-btn ${thumbnailStyle === 'banner-box' ? 'active' : ''}`}
                        onClick={() => setThumbnailStyle('banner-box')}
                      >
                        {dict.thumbnail?.styleBanner || '하이라이트 박스'}
                      </button>
                      <button
                        type="button"
                        className={`toss-thumb-style-btn ${thumbnailStyle === 'cinematic-clean' ? 'active' : ''}`}
                        onClick={() => setThumbnailStyle('cinematic-clean')}
                      >
                        {dict.thumbnail?.styleClean || '시네마틱'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="toss-thumbnail-actions">
                  <button
                    type="button"
                    className="toss-btn-download-thumb"
                    onClick={handleDownloadThumbnail}
                    title={thumbDownloadTitle}
                  >
                    <Download size={14} className="shrink-0" />
                    <span className="toss-btn-text-content">
                      <span className="toss-btn-download-label-long">
                        {dict.thumbnail?.downloadBtn || '썸네일 다운로드'}
                      </span>
                      <span className="toss-btn-download-label-short">
                        {dict.header?.downloadThumbnail || '다운로드'}
                      </span>
                      <span className="toss-btn-hd-spec"> {thumbSpecLabel}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="toss-btn-frame-capture"
                    onClick={handleRestoreAiThumbnail}
                    disabled={isUpdatingThumbnail}
                    title={
                      dict.thumbnail?.restoreAiFrameTip ||
                      'AI가 직접 추천한 베스트 프레임으로 복원'
                    }
                  >
                    <Sparkles size={13} className="text-slate-700 shrink-0" />
                    <span className="toss-btn-text-content">
                      <span className="toss-btn-label-long">
                        <ShinyText theme="light" text={dict.thumbnail?.restoreAiFrame || 'AI 추천 복원'} />
                      </span>
                      <span className="toss-btn-label-mid">{dict.thumbnail?.restoreAiFrameShort || 'AI 복원'}</span>
                      <span className="toss-btn-label-short">AI</span>
                    </span>
                  </button>

                  {activeVideoUrl && (
                    <button
                      type="button"
                      className="toss-btn-frame-capture"
                      onClick={handleCaptureCurrentFrame}
                      disabled={isUpdatingThumbnail}
                      title={
                        dict.thumbnail?.captureCurrentFrameTip ||
                        '현재 영상 재생 위치의 프레임으로 썸네일 배경 변경 (오버레이 미포함)'
                      }
                    >
                      <ImageIcon size={13} className="text-slate-700 shrink-0" />
                      <span className="toss-btn-text-content">
                        {isUpdatingThumbnail ? (
                          (dict.thumbnail?.capturing || '캡처 중...')
                        ) : (
                          <>
                            <span className="toss-btn-label-long">{dict.thumbnail?.applyCurrentFrame || '현재 프레임 적용'}</span>
                            <span className="toss-btn-label-mid">{dict.thumbnail?.applyCurrentFrameShort || '현재 프레임'}</span>
                            <span className="toss-btn-label-short">{dict.thumbnail?.applyCurrentFrameTiny || '프레임'}</span>
                          </>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              </>
              )}
            </div>
          </div>

          {/* 다운로드 단계: 최종 저장 */}
          <div
            className={`toss-card toss-download-card toss-inspector-card ${activeSection === 'download' ? 'is-active-section' : ''}`}
          >
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Download size={15} className="text-slate-800 shrink-0" />
                  <span>{ui('영상 저장 · 다운로드')}</span>
                </h4>
              </div>
              <span className="toss-tag-blue">
                {isSequenceMode && segments.length > 0 ? ui('저장할 수 있어요') : ui('대기')}
              </span>
            </div>

            {isSequenceMode && segments.length > 0 ? (
              <div className="toss-download-body">
                <div className="toss-download-summary">
                  <div className="toss-download-thumb">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="" className="toss-download-thumb-img" />
                    ) : (
                      <span className="toss-download-thumb-empty">
                        <ImageIcon size={20} />
                      </span>
                    )}
                  </div>
                  <div className="toss-download-meta">
                    <strong className="toss-download-title">
                      {overlayOptions.titleText?.trim() || ui('완성된 영상')}
                    </strong>
                    <span className="toss-download-sub">
                      {ui('{count}개 컷', { count: segments.length })} · {formatSec(totalDuration)}
                      {savedPercent > 0 ? ui(' · 원본보다 {percent}% 짧아요', { percent: savedPercent }) : ''}
                    </span>
                    <div className="toss-download-badges">
                      {introDuration > 0 && <span className="toss-download-badge">{ui('인트로')}</span>}
                      {activeBridgeIndexes.length > 0 && (
                        <span className="toss-download-badge">
                          {ui('브릿지')} {activeBridgeIndexes.length}
                        </span>
                      )}
                      {outroDuration > 0 && <span className="toss-download-badge">{ui('아웃트로')}</span>}
                      {customAudioFile && (
                        <span className="toss-download-badge">{customAudioName || ui('배경음악')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="toss-download-actions">
                  <button
                    type="button"
                    className={`toss-btn-download-video ${isReStitching ? 'loading' : ''}`}
                    onClick={() => {
                      if (isReStitching) return;
                      setIsExportModalOpen(true);
                    }}
                    disabled={isReStitching}
                    title={dict.header.downloadTitle}
                  >
                    <Download size={15} className={isReStitching ? 'animate-bounce' : ''} />
                    <span>
                      {isReStitching
                        ? `${dict.header.stitching} (${reStitchProgress?.progressPercent ?? 0}%)`
                        : `${dict.header.download || '영상 저장하기'} (${exportResolution} · ${formatSec(totalDuration)})`}
                    </span>
                  </button>
                  <div className="toss-download-secondary">
                    <button
                      type="button"
                      className="toss-btn-secondary toss-btn-sm"
                      onClick={() => setIsSubtitleModalOpen(true)}
                      title={dict.subtitleDownload?.buttonTitle || '유튜브 호환 자막 (.srt) 다운로드'}
                    >
                      <Subtitles size={13} />
                      <span>{dict.subtitleDownload?.buttonText || '자막 다운로드 (.srt)'}</span>
                    </button>
                    <button
                      type="button"
                      className="toss-btn-secondary toss-btn-sm"
                      onClick={handleDownloadThumbnail}
                      disabled={!thumbnailUrl && !thumbnailBgCanvasRef.current}
                      title={thumbDownloadTitle}
                    >
                      <ImageIcon size={13} />
                      <span>{ui('썸네일 다시 저장')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="toss-empty-state toss-download-empty">
                <p className="text-slate-500 text-sm">
                  {isCreationFlow
                    ? ui('4번 AI 하이라이트를 만들면 완성된 영상을 저장할 수 있어요.')
                    : ui('AI 하이라이트 컷을 먼저 만든 뒤 저장할 수 있어요.')}
                </p>
                <button
                  type="button"
                  className="toss-btn-primary toss-btn-sm mt-2"
                  onClick={() => goToSection(isCreationFlow ? 'ai' : 'cut')}
                >
                  <Sparkles size={13} />
                  <span>{isCreationFlow ? ui('4번 AI 하이라이트로 가기') : ui('4번 컷으로 가기')}</span>
                </button>
              </div>
            )}
          </div>

          {/* 1번: 인트로 문구 카드 — 영상 위 왼쪽·오른쪽 문구 */}
          <div
            className={`toss-card toss-intro-card toss-inspector-card ${activeSection === 'intro' ? 'is-active-section' : ''}`}
          >
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Type size={15} className="text-slate-800 shrink-0" />
                  <span>{ui('인트로 문구')}</span>
                </h4>
              </div>
            </div>
            <div className="toss-header-inputs-inline">{overlayTextInputFields}</div>
          </div>

          {/* 2번: 인트로 스타일 카드 — 모션 템플릿·재생 시간·직접 업로드 */}
          <div
            className={`toss-card toss-intro-card toss-inspector-card ${activeSection === 'introStyle' ? 'is-active-section' : ''}`}
          >
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Film size={15} className="text-slate-800 shrink-0" />
                  <span>{dict.introOutro.introTitle}</span>
                </h4>
              </div>
              <label className="toss-toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayOptions.showIntro}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setStoredShowIntro(val);
                    setOverlayOptions((prev) => ({ ...prev, showIntro: val }));
                  }}
                />
                <span className="toss-toggle-slider" />
              </label>
            </div>

            {overlayOptions.showIntro && (
              <div className="toss-intro-content">
                {/* 1. HyperFrames 인트로 모션 템플릿 선택 그리드 */}
                <div className="toss-io-section">
                  <div className="toss-io-section-head">
                    <span className="toss-io-section-label">
                      <Sparkles size={12} className="toss-io-accent-intro" />
                      <span>{ioDict?.templateSelectLabel || ui('모션 템플릿 선택')}</span>
                    </span>
                  </div>
                  <div className="toss-io-template-grid">
                    {introTemplateOptions.map((tpl) => {
                      const isSelected = (overlayOptions.introTemplate || 'kinetic-slide') === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setStoredIntroTemplate(tpl.id);
                            setOverlayOptions((prev) => ({ ...prev, introTemplate: tpl.id }));
                            // 선택 즉시 왼쪽 미리보기에서 해당 인트로 모션을 재생한다.
                            scheduleSectionPreview('intro');
                          }}
                          className={`toss-io-template-card ${isSelected ? 'selected' : ''}`}
                        >
                          <span className="toss-io-template-top">
                            <span className="toss-io-template-name">{tpl.label}</span>
                            <span className="toss-io-template-badge">{tpl.badge}</span>
                          </span>
                          <span className="toss-io-template-desc">{tpl.desc}</span>
                          {isSelected && (
                            <span className="toss-io-template-check" aria-hidden="true">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 재생 시간(초) 설정 */}
                <div className="toss-io-row">
                  <span className="toss-io-row-label">
                    <Clock size={12} />
                    <span>{ioDict?.durationLabel || ui('재생 시간')}</span>
                  </span>
                  <div className="toss-io-chips">
                    {INTRO_DURATIONS.map((sec) => {
                      const isCurrent = (overlayOptions.introDurationSec || 2.0) === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setStoredIntroDuration(sec);
                            setOverlayOptions((prev) => ({ ...prev, introDurationSec: sec }));
                            scheduleSectionPreview('intro');
                          }}
                          className={`toss-io-chip ${isCurrent ? 'active' : ''}`}
                        >
                          {sec.toFixed(1)}{secUnit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 직접 업로드한 영상 (우선 적용) */}
                <div className="toss-io-upload">
                  <input
                    ref={introVideoInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={handleIntroVideoSelected}
                  />
                  {overlayOptions.introVideoFile ? (
                    <div className="toss-clip-file-chip">
                      <Film size={14} className="toss-io-file-icon" />
                      <div className="toss-io-file-text">
                        <span className="toss-io-file-name">
                          {overlayOptions.introVideoFile.name}
                        </span>
                        <span className="toss-io-file-meta">{dict.introOutro.userVideoFirst}</span>
                      </div>
                      <button
                        type="button"
                        className="toss-btn-delete-sm toss-io-file-remove"
                        onClick={() =>
                          setOverlayOptions((prev) => ({ ...prev, introVideoFile: null }))
                        }
                        title={dict.introOutro.removeVideo}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="toss-btn-custom-audio toss-io-upload-btn"
                      onClick={() => introVideoInputRef.current?.click()}
                    >
                      <Plus size={13} />
                      <span>{dict.introOutro.uploadIntro}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* [생성 흐름] 2번: 영상 올리기 */}
          {isCreationFlow && (
            <div
              className={`toss-card toss-upload-card toss-inspector-card ${activeSection === 'upload' ? 'is-active-section' : ''}`}
            >
              <div className="toss-card-header">
                <div>
                  <h4 className="toss-card-title">
                    <Upload size={15} className="text-slate-800 shrink-0" />
                    <span>{ui('영상 올리기')}</span>
                  </h4>
                </div>
                <span className="toss-tag-gray">{ui('{count}개', { count: videos.length })}</span>
              </div>

              <button
                type="button"
                className="toss-upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="toss-upload-dropzone-icon">
                  <Upload size={18} />
                </span>
                <strong>{ui('영상 끌어다 놓기')}</strong>
              </button>

              {videos.length > 0 && (
                <div className="toss-upload-list">
                  {videos.map((v, idx) => (
                    <div key={v.id} className="toss-upload-item">
                      <span className="toss-upload-item-index">{idx + 1}</span>
                      <div className="toss-upload-item-body">
                        <span className="toss-upload-item-name" title={v.name}>
                          {v.name}
                        </span>
                        <span className="toss-upload-item-meta">
                          {v.duration > 0 ? formatSec(v.duration) : '--:--'}
                          {' · '}
                          {!v.url || v.isMissingFile ? ui('원본 연결 필요') : ui('준비됨')}
                        </span>
                        {onUpdateVideoLocation && (
                          <input
                            type="text"
                            className="toss-upload-location-input"
                            value={v.locationName ?? ''}
                            placeholder={ui('촬영 장소 (예: 해운대 해수욕장)')}
                            onChange={(e) => onUpdateVideoLocation(v.id, e.target.value)}
                            aria-label={ui('{name} 촬영 장소', { name: v.name })}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="toss-btn-delete-sm"
                        onClick={() => onRemoveVideo(v.id)}
                        title={ui('영상 빼기')}
                        aria-label={ui('{name} 빼기', { name: v.name })}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* [생성 흐름] 3번: AI 하이라이트 만들기 */}
          {isCreationFlow && (
            <div
              className={`toss-card toss-ai-card toss-inspector-card ${activeSection === 'ai' ? 'is-active-section' : ''}`}
            >
              <div className="toss-card-header">
                <div>
                  <h4 className="toss-card-title">
                    <Sparkles size={15} className="text-slate-800 shrink-0" />
                    <span>{ui('AI 하이라이트')}</span>
                  </h4>
                </div>
              </div>

              {videos.length === 0 ? (
                <div className="toss-empty-state">
                  <p className="text-slate-400 text-sm">
                    {ui('먼저 3번 영상 올리기에서 영상을 하나 이상 올려주세요.')}
                  </p>
                  <button
                    type="button"
                    className="toss-btn-secondary mt-2"
                    onClick={() => goToSection('upload')}
                  >
                    <Upload size={12} />
                    <span>{ui('영상 올리러 가기')}</span>
                  </button>
                </div>
              ) : isProcessing ? (
                <div className="toss-ai-progress">
                  <div className="toss-ai-progress-head">
                    <Loader2 size={14} className="animate-spin text-slate-700 shrink-0" />
                    <span>{progress.statusMessage || ui('AI가 하이라이트를 찾고 있어요')}</span>
                    <strong>{progress.progressPercent}%</strong>
                  </div>
                  <div className="toss-ai-progress-bar">
                    <div
                      className="toss-ai-progress-fill"
                      style={{ width: `${Math.max(4, progress.progressPercent)}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-sm toss-ai-cancel-btn"
                    onClick={onCancelProcessing}
                  >
                    {ui('분석 취소')}
                  </button>
                </div>
              ) : segments.length > 0 ? (
                <div className="toss-ai-done">
                  <span className="toss-ai-done-badge">
                    <Check size={12} />
                    {ui('하이라이트 {count}개 완성', { count: segments.length })}
                  </span>
                  <button
                    type="button"
                    className="toss-btn-primary toss-btn-sm"
                    onClick={() => goToSection('cut')}
                  >
                    <Scissors size={12} />
                    <span>{ui('4번 컷 다듬기')}</span>
                  </button>
                </div>
              ) : (
                <SpecularButton
                  type="button"
                  className="toss-nav-cta-btn toss-ai-cta"
                  onClick={() =>
                    onStartAiAnalysis(
                      effectiveOverlayOptions,
                      customAudioFile,
                      selectedBgmId,
                      bgmVolume
                    )
                  }
                  disabled={isProcessing}
                  loading={isProcessing}
                  radius={12}
                  specularColor="#ffffff"
                  glowColor="rgba(203, 213, 225, 0.95)"
                >
                  <Sparkles size={14} />
                  <ShinyText
                    text={ui('AI 하이라이트 만들기')}
                    speed={2.6}
                    color="#f8fafc"
                    shineColor="#ffffff"
                  />
                </SpecularButton>
              )}
            </div>
          )}

          {/* 브릿지 단계: 날짜/장소가 바뀌는 컷 사이 장면 전환 */}
          <div
            className={`toss-card toss-bridge-card toss-inspector-card ${activeSection === 'bridge' ? 'is-active-section' : ''}`}
          >
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <ArrowRight size={15} className="text-slate-800 shrink-0" />
                  <span>{ui('장면 전환 (브릿지)')}</span>
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {bridgeCandidateIndexes.length > 0 && (
                  <span className="toss-tag-gray">
                    {activeBridgeIndexes.length} / {ui('{count}곳에 넣었어요', { count: bridgeCandidateIndexes.length })}
                  </span>
                )}
                <label
                  className="toss-toggle-switch"
                  title={
                    overlayOptions.showChapterBridge !== false
                      ? ui('장면 전환 사용 중 · 눌러서 끄기')
                      : ui('장면 전환 꺼짐 · 눌러서 켜기')
                  }
                >
                  <input
                    type="checkbox"
                    checked={overlayOptions.showChapterBridge !== false}
                    onChange={(e) => setChapterBridgeEnabled(e.target.checked)}
                  />
                  <span className="toss-toggle-slider" />
                </label>
              </div>
            </div>

            {isCreationFlow ? (
              overlayOptions.showChapterBridge === false ? (
                <p className="toss-bridge-footnote">
                  {ui('장면 전환을 꺼 두면 날짜나 장소가 바뀌어도 브릿지가 들어가지 않아요.')}
                </p>
              ) : (
                <div className="toss-bridge-standalone">
                  <div className="toss-bridge-template-group">
                    <span className="toss-bridge-template-label">
                      <Clock size={12} />
                      <span>{ui('날짜 넘어가는 효과')}</span>
                    </span>
                    <div className="toss-bridge-chip-row">
                      {BRIDGE_DATE_CHOICES.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          className={`toss-bridge-chip ${(overlayOptions.chapterBridgeDateTemplate || 'flip-clock') === choice.id ? 'active' : ''}`}
                          onClick={() => setDefaultBridgeTemplate('date', choice.id)}
                        >
                          {ui(choice.label)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="toss-bridge-template-group">
                    <span className="toss-bridge-template-label">
                      <MapPin size={12} />
                      <span>{ui('장소 이동 효과')}</span>
                    </span>
                    <div className="toss-bridge-chip-row">
                      {BRIDGE_LOCATION_CHOICES.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          className={`toss-bridge-chip ${(overlayOptions.chapterBridgeLocationTemplate || 'winding-route') === choice.id ? 'active' : ''}`}
                          onClick={() => setDefaultBridgeTemplate('location', choice.id)}
                        >
                          {ui(choice.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            ) : bridgeCandidateIndexes.length === 0 && segments.length >= 2 ? (
              <div className="toss-bridge-standalone">
                <div className="toss-bridge-actions">
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    onClick={() => goToSection('cut')}
                  >
                    <Scissors size={12} />
                    <span>{ui('4번 컷으로 가기')}</span>
                  </button>
                </div>

                <div className="toss-bridge-template-group">
                  <span className="toss-bridge-template-label">
                    <Clock size={12} />
                    <span>{ui('날짜 넘어가는 효과')}</span>
                  </span>
                  <div className="toss-bridge-chip-row">
                    {BRIDGE_DATE_CHOICES.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        className={`toss-bridge-chip ${(overlayOptions.chapterBridgeDateTemplate || 'flip-clock') === choice.id ? 'active' : ''}`}
                        onClick={() => setDefaultBridgeTemplate('date', choice.id)}
                      >
                        {ui(choice.label)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="toss-bridge-template-group">
                  <span className="toss-bridge-template-label">
                    <MapPin size={12} />
                    <span>{ui('장소 이동 효과')}</span>
                  </span>
                  <div className="toss-bridge-chip-row">
                    {BRIDGE_LOCATION_CHOICES.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        className={`toss-bridge-chip ${(overlayOptions.chapterBridgeLocationTemplate || 'winding-route') === choice.id ? 'active' : ''}`}
                        onClick={() => setDefaultBridgeTemplate('location', choice.id)}
                      >
                        {ui(choice.label)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : segments.length < 2 || !selectedBridgeDetail ? (
              <div className="toss-empty-state">
                <p className="text-slate-400 text-sm">
                  {ui('컷이 2개 이상이고, 컷마다 날짜나 장소가 달라야 브릿지가 자동으로 생겨요. 4번 컷에서 날짜·장소를 먼저 적어보세요.')}
                </p>
                <button
                  type="button"
                  className="toss-btn-secondary mt-2"
                  onClick={() => goToSection('cut')}
                >
                  <Scissors size={12} />
                  <span>{ui('컷 설정으로 가기')}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="toss-bridge-route">
                  <div className="toss-bridge-route-side">
                    <span className="toss-bridge-route-label">{ui('컷 #{index}', { index: selectedBridgeDetail.idx })}</span>
                    <strong>{selectedBridgeDetail.prev.locationName || ui('장소 없음')}</strong>
                    <small>{selectedBridgeDetail.prev.subtitleDate || ui('날짜 없음')}</small>
                  </div>
                  <span className="toss-bridge-route-arrow">
                    <ArrowRight size={16} />
                  </span>
                  <div className="toss-bridge-route-side next">
                    <span className="toss-bridge-route-label">{ui('컷 #{index}', { index: selectedBridgeDetail.idx + 1 })}</span>
                    <strong>{selectedBridgeDetail.seg.locationName || ui('장소 없음')}</strong>
                    <small>{selectedBridgeDetail.seg.subtitleDate || ui('날짜 없음')}</small>
                  </div>
                </div>

                <div className="toss-bridge-navigator">
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    disabled={bridgeCandidateIndexes.indexOf(effectiveBridgeIndex) <= 0}
                    onClick={() => {
                      const pos = bridgeCandidateIndexes.indexOf(effectiveBridgeIndex);
                      const prevIdx = bridgeCandidateIndexes[pos - 1];
                      if (typeof prevIdx === 'number') handleSelectBridge(prevIdx);
                    }}
                  >
                    {ui('‹ 이전 전환')}
                  </button>
                  <span className="toss-bridge-navigator-count">
                    {ui('브릿지 {current} / {total}', { current: bridgeCandidateIndexes.indexOf(effectiveBridgeIndex) + 1, total: bridgeCandidateIndexes.length })}
                  </span>
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    disabled={
                      bridgeCandidateIndexes.indexOf(effectiveBridgeIndex) >=
                      bridgeCandidateIndexes.length - 1
                    }
                    onClick={() => {
                      const pos = bridgeCandidateIndexes.indexOf(effectiveBridgeIndex);
                      const nextIdx = bridgeCandidateIndexes[pos + 1];
                      if (typeof nextIdx === 'number') handleSelectBridge(nextIdx);
                    }}
                  >
                    {ui('다음 전환 ›')}
                  </button>
                </div>

                <label className="toss-bridge-toggle-row">
                  <div className="toss-bridge-toggle-text">
                    <strong>{ui('이 장면 전환 넣기')}</strong>
                    <span>
                      {selectedBridgeDetail.info.isDateChanged &&
                        `${selectedBridgeDetail.info.fromDate} → ${selectedBridgeDetail.info.toDate}`}
                      {selectedBridgeDetail.info.isDateChanged &&
                        selectedBridgeDetail.info.isLocationChanged &&
                        ' · '}
                      {selectedBridgeDetail.info.isLocationChanged &&
                        `${selectedBridgeDetail.info.fromLocation} → ${selectedBridgeDetail.info.toLocation}`}
                    </span>
                  </div>
                  <span className="toss-toggle-switch">
                    <input
                      type="checkbox"
                      checked={selectedBridgeDetail.isEnabled}
                      onChange={(e) => setBridgeEnabled(selectedBridgeDetail.idx, e.target.checked)}
                    />
                    <span className="toss-toggle-slider" />
                  </span>
                </label>

                {selectedBridgeDetail.isEnabled ? (
                  <>
                    <div className="toss-bridge-template-group">
                      <span className="toss-bridge-template-label">
                        <Clock size={12} />
                        <span>{ui('날짜 넘어가는 효과')}</span>
                      </span>
                      <div className="toss-bridge-chip-row">
                        {BRIDGE_DATE_CHOICES.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            className={`toss-bridge-chip ${selectedBridgeDetail.info.dateTemplate === choice.id ? 'active' : ''}`}
                            onClick={() => applyBridgeTemplateToCurrent('date', choice.id)}
                          >
                            {ui(choice.label)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="toss-bridge-template-group">
                      <span className="toss-bridge-template-label">
                        <MapPin size={12} />
                        <span>{ui('장소 이동 효과')}</span>
                      </span>
                      <div className="toss-bridge-chip-row">
                        {BRIDGE_LOCATION_CHOICES.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            className={`toss-bridge-chip ${selectedBridgeDetail.info.locationTemplate === choice.id ? 'active' : ''}`}
                            onClick={() => applyBridgeTemplateToCurrent('location', choice.id)}
                          >
                            {ui(choice.label)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="toss-bridge-actions">
                      <button
                        type="button"
                        className="toss-btn-secondary toss-btn-xs"
                        onClick={applyBridgeTemplateToAll}
                      >
                        <Check size={12} />
                        <span>{ui('모든 브릿지에 같은 스타일')}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="toss-btn-primary toss-bridge-enable-btn"
                    onClick={() => setBridgeEnabled(selectedBridgeDetail.idx, true)}
                  >
                    <Sparkles size={13} />
                    <span>{ui('이 장면 전환 켜기')}</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* AI가 포착한 극적 순간 카드 (자막/컷 단계를 함께 감싼다) */}
          <div
            className={`toss-card toss-dramatic-card toss-inspector-card ${isCaptionSection || activeSection === 'cut' ? 'is-active-section' : ''}`}
          >
            {segments.length > 0 && (
              <BorderBeam
                duration={7}
                borderWidth={1.5}
              />
            )}
            <div className="toss-card-header toss-dramatic-header">
              <div className="toss-dramatic-header-title">
                <h4 className="toss-card-title">
                  {isCaptionSection ? (
                    <>
                      <Subtitles size={15} className="text-slate-800 shrink-0" />
                      <span>{ui('자막')}</span>
                    </>
                  ) : (
                    <>
                      <Scissors size={15} className="text-slate-800 shrink-0" />
                      <span>{dict.dramaticClips.title}</span>
                    </>
                  )}
                </h4>
              </div>

              <div className="toss-dramatic-header-actions flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {!isCaptionSection && segments.length > 0 && (
                    <span className="toss-tag-gray">
                      {interpolate(dict.dramaticClips.totalIntervals, {
                        count: segments.length,
                        duration: totalDuration.toFixed(1),
                      })}
                    </span>
                  )}
                  {isCaptionSection && segments.length > 0 && (
                    <button
                      type="button"
                      className="toss-btn-subtitle-header"
                      onClick={() => setIsSubtitleModalOpen(true)}
                      title={dict.subtitleDownload?.buttonTitle || '유튜브 호환 자막 (.srt) 다운로드'}
                    >
                      <Subtitles size={13} />
                      <span>{dict.subtitleDownload?.buttonText || '자막 다운로드'}</span>
                    </button>
                  )}
                  {!isCaptionSection && segments.length > 0 && (
                    <button
                      type="button"
                      className="toss-btn-sort-time"
                      onClick={handleSortSegmentsByRecordedTime}
                      title={dict.dramaticClips.sortByRecordedDateTitle}
                    >
                      <ArrowUpDown size={12} className="text-slate-500" />
                      <span>{dict.dramaticClips.sortByRecordedDate}</span>
                    </button>
                  )}
                  {isCaptionSection && segments.length > 0 && (
                    <div className="relative inline-flex items-center" ref={toneSelectorRef}>
                      <button
                        type="button"
                        className="toss-btn-tone-selector"
                        onClick={() => setIsToneSelectorOpen((prev) => !prev)}
                        title={dict.dramaticClips?.subtitleToneLabel || '자막 톤앤매너'}
                      >
                        <span className="text-xs">{currentToneMeta.icon}</span>
                        <span className="text-xs font-semibold">{currentToneMeta.label}</span>
                        <ChevronDown size={11} className="text-slate-400" />
                      </button>

                      {isToneSelectorOpen && (
                        <div className="toss-tone-dropdown-menu">
                          <div className="p-1.5 space-y-1">
                            {toneOptions.map((opt) => {
                              const isSelected = currentSubtitleTone === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  className={`toss-tone-dropdown-item ${isSelected ? 'active' : ''}`}
                                  onClick={() => handleSelectSubtitleTone(opt.id)}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                                      <span>{opt.icon}</span>
                                      <span>{opt.label}</span>
                                    </span>
                                    {isSelected && <Check size={12} className="text-slate-900 shrink-0" />}
                                  </div>
                                  <span className="text-[11px] text-slate-500 block mt-0.5 line-clamp-1">
                                    {opt.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isCaptionSection && segments.length > 0 && (
                    <button
                      type="button"
                      className="toss-btn-refine-subtitles"
                      onClick={() => handleRefineSubtitles()}
                      disabled={isRefiningSubtitles}
                      title={dict.dramaticClips?.refineSubtitlesBtnTitle || '전체 맥락을 이해하여 브이로그 스타일의 자연스러운 자막으로 교정합니다'}
                    >
                      {isRefiningSubtitles ? (
                        <Loader2 size={12} className="animate-spin text-slate-900" />
                      ) : (
                        <Wand2 size={12} className="text-slate-900" />
                      )}
                      <ShinyText
                        theme="light"
                        color="#0f172a"
                        shineColor="#94a3b8"
                        speed={3}
                        text={
                          isRefiningSubtitles
                            ? (dict.dramaticClips?.refiningSubtitles || '다듬는 중...')
                            : (dict.dramaticClips?.refineSubtitlesBtn || 'AI 자막 다듬기')
                        }
                      />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                  {!isCaptionSection && (
                    <label
                      className="toss-toggle-label flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600"
                      title={
                        dict.dramaticClips.chapterBridgeTitle ||
                        '날짜 또는 장소가 바뀌는 구간 사이에 플립 시계 / 이동 경로 브릿지를 삽입합니다'
                      }
                    >
                      <span>{dict.dramaticClips.chapterBridgeToggle || '챕터 브릿지'}</span>
                      <span className="toss-toggle-switch">
                        <input
                          type="checkbox"
                          checked={overlayOptions.showChapterBridge !== false}
                          onChange={(e) => {
                            setStoredShowChapterBridge(e.target.checked);
                            setOverlayOptions((prev) => ({ ...prev, showChapterBridge: e.target.checked }));
                          }}
                        />
                        <span className="toss-toggle-slider" />
                      </span>
                    </label>
                  )}
                  {isCaptionSection && (
                    <label
                      className="toss-toggle-label flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600"
                      title={dict.settingsModal?.showDateOptionDesc || '영상 화면에 촬영 날짜를 표시해요 (끄면 날짜 없이 장소만 표시)'}
                    >
                      <span>{dict.settingsModal?.showDateOption || '촬영 날짜'}</span>
                      <span className="toss-toggle-switch">
                        <input
                          type="checkbox"
                          checked={showDate}
                          onChange={(e) => handleToggleShowDate(e.target.checked)}
                        />
                        <span className="toss-toggle-slider" />
                      </span>
                    </label>
                  )}
                  {isCaptionSection && (
                    <label
                      className="toss-toggle-label flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600"
                      title={dict.dramaticClips.bottomSubtitleTitle}
                    >
                      <span>{dict.dramaticClips.bottomSubtitleToggle}</span>
                      <span className="toss-toggle-switch">
                        <input
                          type="checkbox"
                          checked={overlayOptions.showSubtitle}
                          onChange={(e) =>
                            setOverlayOptions((prev) => ({ ...prev, showSubtitle: e.target.checked }))
                          }
                        />
                        <span className="toss-toggle-slider" />
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {segments.length > 0 && (
              <div className="toss-cut-navigator">
                <button
                  type="button"
                  className="toss-btn-secondary toss-btn-xs"
                  onClick={() => selectCutByOffset(-1)}
                  disabled={selectedSegmentIndex <= 0}
                >
                  {isCaptionSection ? ui('‹ 이전 씬') : ui('‹ 이전 컷')}
                </button>
                <div className="toss-cut-navigator-center">
                  <strong className="toss-cut-navigator-count">
                    {isCaptionSection
                      ? ui('씬 #{index}', { index: selectedSegmentIndex + 1 })
                      : ui('컷 #{index}', { index: selectedSegmentIndex + 1 })}
                  </strong>
                  <span className="toss-cut-navigator-sub">/ {segments.length}</span>
                </div>
                <button
                  type="button"
                  className="toss-btn-secondary toss-btn-xs"
                  onClick={() => selectCutByOffset(1)}
                  disabled={selectedSegmentIndex >= segments.length - 1}
                >
                  {isCaptionSection ? ui('다음 씬 ›') : ui('다음 컷 ›')}
                </button>
                <button
                  type="button"
                  className="toss-btn-secondary toss-btn-xs toss-cut-preview-btn"
                  onClick={() => previewSectionPlay('cut')}
                >
                  <Eye size={12} />
                  <span>{isCaptionSection ? ui('이 씬만 보기') : ui('이 컷만 보기')}</span>
                </button>
              </div>
            )}

            {/* 컷을 다듬는 중에도 원본 추가/재분석이 필요할 때만 여는 보조 메뉴 */}
            {!isCaptionSection && segments.length > 0 && (
              <details className="toss-cut-more">
                <summary className="toss-cut-more-summary">
                  <Plus size={12} />
                  <span>{ui('원본 영상 추가 · AI 다시 뽑기')}</span>
                  <ChevronDown size={12} className="toss-cut-more-chevron" />
                </summary>
                <div className="toss-cut-more-body">
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={13} />
                    <span>{ui('원본 영상 추가')}</span>
                  </button>
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-sm"
                    onClick={() =>
                      onStartAiAnalysis(
                        effectiveOverlayOptions,
                        customAudioFile,
                        selectedBgmId,
                        bgmVolume
                      )
                    }
                    disabled={isProcessing || videos.length === 0}
                  >
                    <Sparkles size={13} />
                    <span>{ui('AI 하이라이트 다시 뽑기')}</span>
                  </button>
                </div>
              </details>
            )}

            {segments.length === 0 ? (
              <div className="toss-empty-state">
                <p className="text-slate-400 text-sm">
                  {dict.dramaticClips.emptyNotice}
                </p>
              </div>
            ) : (
              <div className="toss-segment-list">
                {segments.map((seg, idx) => {
                  // 한 번에 선택한 컷 1개만 보여준다. (일반인이 전체 컷 목록에 압도되지 않도록)
                  if (seg.id !== selectedSegmentId) return null;
                  const isSelected = seg.id === selectedSegmentId;
                  const isCurrentPlaying = seg.id === activePlayingSegmentId;
                  const vItem = videoMap.get(seg.sourceVideoId);
                  // 16:9 인물 크롭 위치는 세로 원본 영상에서만 의미가 있음
                  // (90°/270° 회전 시 원본의 가로/세로가 뒤집히므로 회전도 반영)
                  const srcWidth = vItem?.width ?? 0;
                  const srcHeight = vItem?.height ?? 0;
                  const isRotatedQuarter = ((seg.rotation ?? 0) % 360 + 360) % 360 % 180 !== 0;
                  const effectiveWidth = isRotatedQuarter ? srcHeight : srcWidth;
                  const effectiveHeight = isRotatedQuarter ? srcWidth : srcHeight;
                  const isPortraitSource =
                    effectiveWidth > 0 && effectiveHeight > 0
                      ? effectiveHeight > effectiveWidth
                      : false;
                  const segTimeInfo = formatSegmentRecordedDateTime(seg, videoMap);
                  const segOffset = segmentTimelineOffsets[seg.id];
                  const isSegExceedingMusic = Boolean(
                    isMusicExceeded &&
                    customAudioDuration &&
                    segOffset &&
                    segOffset.endOffset > customAudioDuration + 0.15
                  );
                  const isSegFullyBeyondMusic = Boolean(
                    isMusicExceeded &&
                    customAudioDuration &&
                    segOffset &&
                    segOffset.startOffset >= customAudioDuration - 0.05
                  );
                  const bridgeEval = idx > 0
                    ? evaluateChapterBridge(segments[idx - 1], seg, idx, segments.length, overlayOptions)
                    : null;
                  return (
                    <React.Fragment key={seg.id}>
                      {!isCaptionSection && (bridgeEval?.shouldBridge ? (
                        <div
                          className="toss-segment-bridge-item"
                          onClick={() => handleSelectBridge(idx)}
                          title={ui('브릿지 단계에서 이 장면 전환을 설정해요')}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="toss-segment-bridge-badge">
                            {bridgeEval.isDateChanged && bridgeEval.isLocationChanged
                              ? 'DATE & ROUTE'
                              : bridgeEval.isDateChanged
                              ? 'FLIP DATE'
                              : 'ROUTE MOVE'}
                          </span>
                          <span className="toss-segment-bridge-desc">
                            {[
                              bridgeEval.isDateChanged ? `${bridgeEval.fromDate} → ${bridgeEval.toDate}` : '',
                              bridgeEval.isLocationChanged ? `${bridgeEval.fromLocation} → ${bridgeEval.toLocation}` : '',
                            ]
                              .filter(Boolean)
                              .join('  •  ')}
                          </span>
                          <span className="toss-segment-bridge-time">
                            {interpolate(
                              dict.dramaticClips.bridgeBadge || '+{duration}s 브릿지',
                              { duration: '2.2' }
                            )}
                          </span>
                        </div>
                      ) : (seg.skipChapterBridge) ? (
                        <div
                          className="toss-segment-bridge-item"
                          onClick={() => handleSelectBridge(idx)}
                          title={ui('브릿지 단계에서 이 장면 전환을 다시 켜요')}
                          style={{
                            cursor: 'pointer',
                            opacity: 0.6,
                            borderStyle: 'dashed',
                          }}
                        >
                          <span className="toss-segment-bridge-badge" style={{ backgroundColor: '#64748b' }}>
                            {ui('브릿지 건너뜀')}
                          </span>
                          <span className="toss-segment-bridge-desc" style={{ color: '#94a3b8' }}>
                            {ui('클릭하여 챕터 브릿지 다시 켜기')}
                          </span>
                        </div>
                      ) : null)}
                      <div
                        className={`toss-segment-item ${isSelected ? 'active' : ''} ${isCurrentPlaying ? 'playing' : ''} ${isSegExceedingMusic ? 'exceeds-music' : ''}`}
                      >
                      {isCurrentPlaying && isPlaying && vItem?.thumbnailUrl && (
                        <span className="toss-segment-now-playing" aria-hidden="true">
                          <span className="toss-segment-now-dot" />
                          {dict.dramaticClips.nowPlaying}
                        </span>
                      )}
                      <div
                        className="toss-segment-row"
                        onClick={() => handleSelectSegment(seg.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isSelected}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectSegment(seg.id);
                          }
                        }}
                      >
                        <div className="toss-segment-left">
                          <div className="toss-segment-thumb-wrap">
                            {vItem?.thumbnailUrl && (
                              <img
                                src={vItem.thumbnailUrl}
                                alt=""
                                className="toss-segment-thumb"
                                style={
                                  seg.rotation
                                    ? {
                                        transform: `rotate(${seg.rotation}deg)${
                                          seg.rotation === 90 || seg.rotation === 270 ? ' scale(0.6)' : ''
                                        }`,
                                        transition: 'transform 0.2s ease',
                                      }
                                    : undefined
                                }
                              />
                            )}
                            {Boolean(seg.rotation) && (
                              <span
                                className="toss-segment-thumb-badge"
                                title={interpolate(dict.dramaticClips.rotateBadge || '{deg}° 회전됨', {
                                  deg: seg.rotation ?? 0,
                                })}
                              >
                                {seg.rotation}°
                              </span>
                            )}
                          </div>
                          <div className="toss-segment-info">
                            <div className="toss-segment-title-row">
                              <span className="toss-segment-number">#{idx + 1}</span>
                              <span className="toss-segment-reason truncate">
                                {seg.reason}
                              </span>
                              {isSegExceedingMusic && (
                                <span
                                  className={`toss-segment-music-over-badge ${isSegFullyBeyondMusic ? 'beyond' : 'boundary'}`}
                                  title={
                                    customAudioDuration
                                      ? interpolate(
                                          dict.dramaticClips.musicOverflowTip ||
                                            '배경음악 1회차 길이({duration})를 넘어 음악이 반복되는 구간이에요',
                                          { duration: formatSec(customAudioDuration) }
                                        )
                                      : dict.dramaticClips.musicOverflowSegmentTip || '음악 길이 초과 구간'
                                  }
                                >
                                  <Music size={9} className="shrink-0" />
                                  <span>
                                    {isSegFullyBeyondMusic
                                      ? dict.dramaticClips.musicOverflowBadge || '음악 초과'
                                      : dict.dramaticClips.musicBoundaryBadge || '음악 끝 경계'}
                                  </span>
                                </span>
                              )}
                            </div>
                            <div className="toss-segment-meta-row">
                              <span className="toss-segment-source truncate">
                                {seg.sourceVideoName}
                              </span>
                              {segOffset && (
                                <span
                                  className="toss-segment-timeline-range"
                                  title={interpolate(
                                    dict.dramaticClips.timelinePositionTip ||
                                      '시퀀스 타임라인 위치: {start} ~ {end}',
                                    {
                                      start: formatSec(segOffset.startOffset),
                                      end: formatSec(segOffset.endOffset),
                                    }
                                  )}
                                >
                                  {formatSec(segOffset.startOffset)}~{formatSec(segOffset.endOffset)}
                                </span>
                              )}
                              {segTimeInfo.full && (
                                <span
                                  className="toss-segment-time-badge"
                                  title={`${dict.dramaticClips.recordedTimeLabel}: ${segTimeInfo.full}`}
                                >
                                  <Clock size={10} className="shrink-0" />
                                  <span>{segTimeInfo.full}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 트리밍 버튼 및 회전, 길이 */}
                        <div className="toss-segment-right">
                          {!isCaptionSection && (
                          <div className="toss-trim-controls">
                            <span className="toss-segment-duration">
                              {seg.duration.toFixed(1)}s
                            </span>
                            <button
                              type="button"
                              className="toss-btn-trim-edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrimModalTarget(seg);
                              }}
                              title={dict.dramaticClips.trimEdit || '구간 편집'}
                            >
                              <Scissors size={11} />
                              <span>{dict.dramaticClips.trimEdit || '구간 편집'}</span>
                            </button>
                          </div>
                          )}

                          {/* 90도 회전 컨트롤 (반시계/시계 방향) */}
                          {!isCaptionSection && (
                          <div className="toss-segment-rotate-controls" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="toss-btn-micro-rotate"
                              onClick={(e) => handleRotateSegment(seg.id, -90, e)}
                              title={dict.dramaticClips.rotateCcw || '좌회전 (↶ 90°)'}
                              aria-label={ui('반시계 90도 회전')}
                            >
                              <RotateCcw size={12} />
                            </button>
                            {Boolean(seg.rotation) && (
                              <button
                                type="button"
                                className="toss-segment-rot-indicator"
                                onClick={(e) => handleResetSegmentRotation(seg.id, e)}
                                title={ui('0°로 초기화')}
                              >
                                {seg.rotation}°
                              </button>
                            )}
                            <button
                              type="button"
                              className="toss-btn-micro-rotate"
                              onClick={(e) => handleRotateSegment(seg.id, 90, e)}
                              title={dict.dramaticClips.rotateCw || '우회전 (↷ 90°)'}
                              aria-label={ui('시계 90도 회전')}
                            >
                              <RotateCw size={12} />
                            </button>
                          </div>
                          )}


                          {!isCaptionSection && (
                          <button
                            type="button"
                            className="toss-btn-delete"
                            onClick={(e) => handleDeleteSegment(seg.id, e)}
                            title={dict.dramaticClips.excludeInterval}
                          >
                            <Trash2 size={15} />
                          </button>
                          )}
                        </div>
                      </div>

                      {/* 선택한 씬의 자막/날짜/위치/구도 수정 */}
                      {isSelected && (isCaptionSection || isPortraitSource || (isPortraitOutput && !isPortraitSource)) && (
                        <div className="toss-segment-editor" onClick={(e) => e.stopPropagation()}>
                          <div className="toss-segment-editor-head">
                            {isCaptionSection ? (
                              <span className="toss-segment-editor-title">{dict.dramaticClips.editorTitle}</span>
                            ) : (
                              <span className="toss-segment-editor-title">{ui('이 씬의 구도 (크롭)')}</span>
                            )}
                          </div>

                          {isCaptionSection && (
                            <>
                          {/* 1. 씬 자막 제목 */}
                          <div className="toss-branding-row">
                            <span className="toss-branding-label">{dict.dramaticClips.subtitleLabel}</span>
                            <input
                              type="text"
                              value={seg.subtitleTitle ?? seg.reason}
                              onChange={(e) =>
                                handleUpdateSegmentSubtitle(seg.id, 'subtitleTitle', e.target.value)
                              }
                              placeholder={dict.dramaticClips.subtitlePlaceholder}
                              className="toss-input-sm"
                            />
                          </div>

                          {/* 2. 씬 촬영 날짜 & 위치 */}
                          <div className="toss-branding-row">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[11px] font-bold text-slate-600 mb-1 block">{dict.dramaticClips.dateLabel}</span>
                                <input
                                  type="text"
                                  value={seg.subtitleDate ?? ''}
                                  onChange={(e) =>
                                    handleUpdateSegmentSubtitle(seg.id, 'subtitleDate', e.target.value)
                                  }
                                  placeholder={dict.dramaticClips.datePlaceholder}
                                  className="toss-input-sm"
                                />
                                {segTimeInfo.full && (
                                  <span
                                    className="toss-original-recorded-tip"
                                    title={interpolate(dict.dramaticClips.originalRecordedTime, {
                                      time: segTimeInfo.full,
                                    })}
                                  >
                                    <Clock size={10} className="shrink-0 text-slate-400" />
                                    <span className="truncate">
                                      {interpolate(dict.dramaticClips.originalRecordedTime, {
                                        time: segTimeInfo.full,
                                      })}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-[11px] font-bold text-slate-600 mb-1 block">{dict.dramaticClips.locationLabel}</span>
                                <input
                                  type="text"
                                  value={seg.locationName ?? ''}
                                  onChange={(e) =>
                                    handleUpdateSegmentSubtitle(seg.id, 'locationName', e.target.value)
                                  }
                                  placeholder={dict.dramaticClips.locationPlaceholder}
                                  className="toss-input-sm"
                                />
                              </div>
                            </div>

                            {/* 지도 확인 버튼들 */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <button
                                type="button"
                                className="toss-btn-micro-action"
                                onClick={() => setMapModalTarget(seg)}
                              >
                                <MapPin size={12} className="text-red-500" />
                                <span>{dict.dramaticClips.checkMapMarker}</span>
                              </button>

                              <a
                                href={
                                  seg.locationName
                                    ? `https://map.naver.com/v5/search/${encodeURIComponent(seg.locationName)}`
                                    : seg.latitude && seg.longitude
                                    ? `https://map.naver.com/v5/search/${seg.latitude},${seg.longitude}`
                                    : `https://map.naver.com/v5/search/${encodeURIComponent(seg.subtitleTitle || seg.reason)}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="toss-btn-micro-action"
                              >
                                <ExternalLink size={11} />
                                <span>{dict.dramaticClips.naverMap}</span>
                              </a>

                              <a
                                href={
                                  seg.latitude && seg.longitude
                                    ? `https://www.google.com/maps/search/?api=1&query=${seg.latitude},${seg.longitude}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(seg.locationName || seg.subtitleTitle || seg.reason)}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="toss-btn-micro-action"
                              >
                                <ExternalLink size={11} />
                                <span>{dict.dramaticClips.googleMap}</span>
                              </a>
                            </div>
                          </div>
                            </>
                          )}

                          {!isCaptionSection && (
                            <>
                          {/* 3. 16:9 세로 영상 인물 크롭 기준 (세로 원본 영상에서만 노출) */}
                          {isPortraitSource && (
                            <div className="toss-branding-row">
                              <div className="flex items-center justify-between mb-1">
                                <span className="toss-branding-label">{dict.dramaticClips.cropLabel}</span>
                                <span className="text-[11px] text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                                  {dict.dramaticClips.aiRecommended}
                                </span>
                              </div>
                              <div className="toss-segment-control">
                                <button
                                  type="button"
                                  className={`toss-segment-btn ${(seg.cropOffsetYRatio ?? 0.2) <= 0.25 ? 'active' : ''}`}
                                  onClick={() => handleCropAnchorChange(seg.id, 0.15)}
                                >
                                  {dict.dramaticClips.cropTop}
                                </button>
                                <button
                                  type="button"
                                  className={`toss-segment-btn ${(seg.cropOffsetYRatio ?? 0.2) > 0.25 && (seg.cropOffsetYRatio ?? 0.2) < 0.75 ? 'active' : ''}`}
                                  onClick={() => handleCropAnchorChange(seg.id, 0.5)}
                                >
                                  {dict.dramaticClips.cropCenter}
                                </button>
                                <button
                                  type="button"
                                  className={`toss-segment-btn ${(seg.cropOffsetYRatio ?? 0.2) >= 0.75 ? 'active' : ''}`}
                                  onClick={() => handleCropAnchorChange(seg.id, 0.85)}
                                >
                                  {dict.dramaticClips.cropBottom}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 가로 원본 → 세로 9:16 크롭: 인물 가로 위치 선택 (세로 출력 프로젝트에서만 노출) */}
                          {isPortraitOutput && !isPortraitSource && (
                            <div className="toss-branding-row">
                              <div className="flex items-center justify-between mb-1">
                                <span className="toss-branding-label">{ui('인물 가로 위치')}</span>
                                <span className="text-[11px] text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                                  {dict.dramaticClips.aiRecommended}
                                </span>
                              </div>
                              <div className="toss-segment-control">
                                <button
                                  type="button"
                                  className={`toss-segment-btn ${(seg.cropOffsetXRatio ?? 0.5) <= 0.25 ? 'active' : ''}`}
                                  onClick={() => handleCropXAnchorChange(seg.id, 0.15)}
                                >
                                  {ui('왼쪽')}
                                </button>
                                <button
                                  type="button"
                                  className={`toss-segment-btn ${(seg.cropOffsetXRatio ?? 0.5) > 0.25 && (seg.cropOffsetXRatio ?? 0.5) < 0.75 ? 'active' : ''}`}
                                  onClick={() => handleCropXAnchorChange(seg.id, 0.5)}
                                >
                                  {ui('가운데')}
                                </button>
                                <button
                                  type="button"
                                  className={`toss-segment-btn ${(seg.cropOffsetXRatio ?? 0.5) >= 0.75 ? 'active' : ''}`}
                                  onClick={() => handleCropXAnchorChange(seg.id, 0.85)}
                                >
                                  {ui('오른쪽')}
                                </button>
                              </div>
                            </div>
                          )}
                            </>
                          )}
                        </div>
                      )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* 종료 아웃트로 카드 */}
          <div
            className={`toss-card toss-outro-card toss-inspector-card ${activeSection === 'outro' ? 'is-active-section' : ''}`}
          >
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Film size={15} className="text-slate-800 shrink-0" />
                  <span>{dict.introOutro.outroTitle}</span>
                </h4>
              </div>
              <label className="toss-toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayOptions.showOutro}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setStoredShowOutro(val);
                    setOverlayOptions((prev) => ({ ...prev, showOutro: val }));
                  }}
                />
                <span className="toss-toggle-slider" />
              </label>
            </div>

            {overlayOptions.showOutro && (
              <div className="toss-outro-content">
                {/* 1. HyperFrames 아웃트로 모션 템플릿 선택 그리드 */}
                <div className="toss-io-section">
                  <div className="toss-io-section-head">
                    <span className="toss-io-section-label">
                      <Sparkles size={12} className="toss-io-accent-outro" />
                      <span>{ioDict?.templateSelectLabel || ui('모션 템플릿 선택')}</span>
                    </span>
                  </div>
                  <div className="toss-io-template-grid">
                    {outroTemplateOptions.map((tpl) => {
                      const isSelected = (overlayOptions.outroTemplate || 'modern-endcard') === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setStoredOutroTemplate(tpl.id);
                            setOverlayOptions((prev) => ({ ...prev, outroTemplate: tpl.id }));
                            scheduleSectionPreview('outro');
                          }}
                          className={`toss-io-template-card ${isSelected ? 'selected' : ''}`}
                        >
                          <span className="toss-io-template-top">
                            <span className="toss-io-template-name">{tpl.label}</span>
                            <span className="toss-io-template-badge">{tpl.badge}</span>
                          </span>
                          <span className="toss-io-template-desc">{tpl.desc}</span>
                          {isSelected && (
                            <span className="toss-io-template-check" aria-hidden="true">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 클로징 문구 설정 */}
                <div className="toss-io-field">
                  <label className="toss-io-field-label" htmlFor="toss-outro-text">
                    {ioDict?.outroTextLabel || ui('클로징 문구')}
                  </label>
                  <input
                    id="toss-outro-text"
                    type="text"
                    value={overlayOptions.outroText ?? ''}
                    placeholder={ioDict?.outroTextPlaceholder || dict.introOutro?.outroDefaultText || ui('시청해 주셔서 감사합니다')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStoredOutroText(val);
                      setOverlayOptions((prev) => ({ ...prev, outroText: val }));
                    }}
                    className="toss-io-text-input"
                  />
                </div>

                {/* 3. 재생 시간(초) 설정 */}
                <div className="toss-io-row">
                  <span className="toss-io-row-label">
                    <Clock size={12} />
                    <span>{ioDict?.durationLabel || ui('재생 시간')}</span>
                  </span>
                  <div className="toss-io-chips">
                    {OUTRO_DURATIONS.map((sec) => {
                      const isCurrent = (overlayOptions.outroDurationSec || 2.2) === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setStoredOutroDuration(sec);
                            setOverlayOptions((prev) => ({ ...prev, outroDurationSec: sec }));
                            scheduleSectionPreview('outro');
                          }}
                          className={`toss-io-chip ${isCurrent ? 'active' : ''}`}
                        >
                          {sec.toFixed(1)}{secUnit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. 직접 업로드한 영상 (우선 적용) */}
                <div className="toss-io-upload">
                  <input
                    ref={outroVideoInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={handleOutroVideoSelected}
                  />
                  {overlayOptions.outroVideoFile ? (
                    <div className="toss-clip-file-chip">
                      <Film size={14} className="toss-io-file-icon" />
                      <div className="toss-io-file-text">
                        <span className="toss-io-file-name">
                          {overlayOptions.outroVideoFile.name}
                        </span>
                        <span className="toss-io-file-meta">{dict.introOutro.userVideoFirst}</span>
                      </div>
                      <button
                        type="button"
                        className="toss-btn-delete-sm toss-io-file-remove"
                        onClick={() =>
                          setOverlayOptions((prev) => ({ ...prev, outroVideoFile: null }))
                        }
                        title={dict.introOutro.removeVideo}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="toss-btn-custom-audio toss-io-upload-btn"
                      onClick={() => outroVideoInputRef.current?.click()}
                    >
                      <Plus size={13} />
                      <span>{dict.introOutro.uploadOutro}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 노래 단계: 항상 설정 가능 */}
          <div
            className={`toss-card toss-music-card toss-inspector-card ${activeSection === 'music' ? 'is-active-section' : ''}`}
          >
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Music size={15} className="text-slate-800 shrink-0" />
                  <span>{ui('배경 음악')}</span>
                </h4>
              </div>
            </div>

            <input
              ref={customAudioInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleCustomAudioSelected}
            />

            {customAudioFile ? (
              <div className="toss-music-body">
                <div className="toss-music-current">
                  <span className="toss-music-current-icon">
                    <FileAudio size={18} />
                  </span>
                  <div className="toss-music-current-text">
                    <strong className="toss-music-current-name">{customAudioName}</strong>
                    <span className="toss-music-current-meta">
                      {selectedLibraryTrackId ? ui('오디오 보관함') : ui('내 파일')}
                      {customAudioDuration ? ` · ${formatSec(customAudioDuration)}` : ''}
                      {!overlayOptions.bgmFitToVideo && audioTimelineBlocks.length > 1
                        ? ` ${ui('· {count}회 반복', { count: audioTimelineBlocks.length })}`
                        : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="toss-btn-delete-sm"
                    onClick={() => {
                      setCustomAudioFile(null);
                      setCustomAudioName('');
                      setSelectedBgmId('none');
                      setSelectedLibraryTrackId(null);
                    }}
                    title={ui('음악 빼기')}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="toss-music-volume">
                  <span className="toss-music-volume-label">
                    <Volume2 size={13} />
                    <span>{ui('볼륨')}</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="toss-slider toss-music-slider"
                  />
                  <strong className="toss-music-volume-value">{Math.round(bgmVolume * 100)}%</strong>
                </div>

                <label className="toss-music-toggle-row">
                  <div className="toss-music-toggle-text">
                    <strong>{ui('영상 길이에 음악 맞추기')}</strong>
                    {overlayOptions.bgmFitToVideo && calculatedBgmSpeed && (
                      <span>
                        {ui('영상 길이에 맞춰 {speed}x 속도로 재생돼요.', { speed: calculatedBgmSpeed })}
                      </span>
                    )}
                  </div>
                  <span className="toss-toggle-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(overlayOptions.bgmFitToVideo)}
                      onChange={(e) =>
                        setOverlayOptions((prev) => ({
                          ...prev,
                          bgmFitToVideo: e.target.checked,
                        }))
                      }
                    />
                    <span className="toss-toggle-slider" />
                  </span>
                </label>

                <div className="toss-music-actions">
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    onClick={() => setIsAudioLibraryOpen(true)}
                  >
                    <ListMusic size={12} />
                    <span>{ui('다른 노래 고르기')}</span>
                  </button>
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    onClick={() => previewSectionPlay('music')}
                    disabled={!isSequenceMode}
                    title={
                      isSequenceMode
                        ? ui('영상 앞부분에서 음악을 미리 들어요')
                        : ui('4번 AI 하이라이트를 먼저 만들면 영상과 함께 들을 수 있어요')
                    }
                  >
                    <Play size={12} />
                    <span>{ui('미리 듣기')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="toss-music-empty">
                <p className="toss-music-empty-text">
                  {ui('아직 노래가 없어요. 보관함에서 고르거나 내 음악을 올려보세요.')}
                </p>
                <div className="toss-music-empty-actions">
                  <button
                    type="button"
                    className="toss-btn-primary toss-btn-sm"
                    onClick={() => setIsAudioLibraryOpen(true)}
                  >
                    <ListMusic size={13} />
                    <span>{ui('보관함에서 고르기')}</span>
                  </button>
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-sm"
                    onClick={() => customAudioInputRef.current?.click()}
                  >
                    <Upload size={13} />
                    <span>{ui('내 음악 올리기')}</span>
                  </button>
                </div>
              </div>
            )}

            {isCreationFlow && (
              <button
                type="button"
                className="toss-music-next-cta"
                onClick={() => goToSection('ai')}
              >
                <Sparkles size={13} />
                <span>{ui('4번 AI 하이라이트를 먼저 만들면 영상과 함께 들을 수 있어요')}</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* 단계 이동: 생성 흐름 9단계 / 편집 흐름 9단계 순서를 그대로 따른다 */}
          <nav className="toss-inspector-nav" aria-label={ui('편집 단계 이동')}>
            <button
              type="button"
              className="toss-btn-secondary toss-inspector-nav-btn"
              onClick={() => goToAdjacentSection(-1)}
              disabled={activeStudioStepIndex <= 0}
            >
              <ChevronLeft size={14} />
              <span>{ui('이전 단계')}</span>
            </button>
            {activeSection === 'download' ? (
              <button
                type="button"
                className="toss-btn-primary toss-inspector-nav-btn"
                onClick={() => setIsExportModalOpen(true)}
                disabled={!isSequenceMode || segments.length === 0 || isReStitching}
                title={
                  isSequenceMode && segments.length > 0
                    ? ui('편집한 영상을 저장해요')
                    : ui('AI 하이라이트를 먼저 만들면 저장할 수 있어요')
                }
              >
                <Download size={14} className={isReStitching ? 'animate-bounce' : ''} />
                <span>{isReStitching ? ui('저장 준비 중...') : ui('영상 저장하기')}</span>
              </button>
            ) : (
              <button
                type="button"
                className="toss-btn-primary toss-inspector-nav-btn"
                onClick={() => goToAdjacentSection(1)}
              >
                <span>{activeSection === 'thumbnail' ? ui('다운로드로 가기') : ui('다음 단계')}</span>
                <ArrowRight size={14} />
              </button>
            )}
          </nav>
          {/* 모바일 전체 단계 바텀시트 */}
          {isMobileViewport && (
            <MobileStepListSheet
              isOpen={isStepSheetOpen}
              onClose={() => setIsStepSheetOpen(false)}
              steps={mobileStepItems}
              title={ui('전체 단계')}
              closeLabel={dict.common?.close || ui('닫기')}
              onSelect={(id) => goToSection(id as StudioSection)}
            />
          )}
        </section>

        {/* 모바일 하단 고정 CTA 바 (엄지 영역) */}
        {isMobileViewport && (
          <MobileBottomCtaBar
            ariaLabel={ui('편집 단계 이동')}
            prevLabel={ui('이전')}
            onPrev={() => goToAdjacentSection(-1)}
            prevDisabled={activeStudioStepIndex <= 0}
            primaryLabel={
              activeSection === 'download'
                ? isReStitching
                  ? `${dict.header.stitching} (${reStitchProgress?.progressPercent ?? 0}%)`
                  : `${dict.header.download || '영상 저장하기'} (${exportResolution} · ${formatSec(totalDuration)})`
                : nextStepCtaLabel
            }
            onPrimary={() => {
              if (activeSection === 'download') {
                if (!isReStitching) setIsExportModalOpen(true);
                return;
              }
              goToAdjacentSection(1);
            }}
            primaryDisabled={
              activeSection === 'download'
                ? !isSequenceMode || segments.length === 0 || isReStitching
                : activeStudioStepIndex >= studioSteps.length - 1
            }
            primaryBusy={activeSection === 'download' && isReStitching}
            isDownloadStep={activeSection === 'download'}
          />
        )}
        </div>
      </main>
      )}

      {/* AI 분석 진행 중 토스식 모달 */}
      {isProcessing && (
        <div className="toss-modal-overlay">
          <div className="toss-modal-card">
            <BorderBeam
              duration={4.5}
              borderWidth={2}
            />
            {/* 상단 비디오 썸네일 또는 기본 아이콘 */}
            <div className={currentVideoThumbnail ? 'toss-modal-thumb-box' : 'toss-modal-icon-circle'}>
              {currentVideoThumbnail ? (
                <img
                  src={currentVideoThumbnail}
                  alt={currentProcessingVideo?.name || ui('영상 썸네일')}
                  className="w-full h-full object-cover"
                />
              ) : progress.currentPhase === 'stitch' ? (
                <Scissors size={24} className="text-slate-700 animate-pulse" />
              ) : (
                <Sparkles size={24} className="text-slate-700 animate-pulse" />
              )}
            </div>

            <h3 className="toss-modal-title">
              <ShinyText theme="light" speed={2.5}>
                {progress.isQueued
                  ? queueCopy.waitingTitle
                  : progress.currentPhase === 'stitch'
                    ? (dict.processingModal.titleStitching || '하이라이트 영상을 병합하고 있어요')
                    : dict.processingModal.title}
              </ShinyText>
            </h3>
            <p className="toss-modal-desc">
              {progress.statusMessage || dict.processingModal.defaultDesc}
            </p>

            {/* 대기열 순번/예상 대기 시간 */}
            {progress.isQueued && (
              <QueueStatusCard
                locale={locale}
                position={progress.queuePosition}
                estimatedWaitSec={progress.estimatedWaitSec}
              />
            )}

            {/* 진행률 바 */}
            <div className="toss-modal-progress-bar">
              <div
                className="toss-modal-progress-fill"
                style={{
                  width: `${Math.max(
                    5,
                    progress.currentPhase === 'stitch' && progress.stitchProgressPercent !== undefined
                      ? progress.stitchProgressPercent
                      : progress.progressPercent
                  )}%`
                }}
              />
            </div>
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 mt-1.5 px-0.5">
              <span>
                {progress.currentPhase === 'stitch' && progress.stitchProgressPercent !== undefined
                  ? `${dict.processingModal.stitchProgressLabel || ui('병합 진행률')} ${ui('(전체 {percent}%)', { percent: Math.floor(progress.progressPercent) })}`
                  : dict.processingModal.youtubeSpec}
              </span>
              <span className="font-bold text-slate-800">
                {progress.currentPhase === 'stitch' && progress.stitchProgressPercent !== undefined
                  ? `${Math.floor(progress.stitchProgressPercent)}%`
                  : `${Math.floor(progress.progressPercent)}%`}
              </span>
            </div>

            {/* 최근 작업/추론 2줄 안내 박스 (2줄 고정 높이, 넘치면 ...) */}
            <div className="toss-modal-reasoning-wrap">
              <div className="toss-modal-reasoning-text">
                <span>{latestTask.text}</span>
                {latestTask.isStreaming && <span className="toss-live-caret" />}
              </div>
            </div>

            {/* 백그라운드 보호 및 화면 꺼짐 방지 안심 배너 */}
            <div className="flex items-center gap-2 px-3 py-2 mt-1 mb-2 bg-slate-100 border border-slate-200 rounded-xl text-left">
              <span className="text-xs shrink-0">🛡️</span>
              <p className="text-[11px] leading-tight text-slate-700 font-medium">
                {dict.processingModal.backgroundGuardNotice || '다른 탭이나 다른 앱을 다녀오셔도 작업이 안전하게 이어져요.'}
              </p>
            </div>

            {/* 취소 버튼 */}
            <button
              type="button"
              className="toss-modal-cancel-btn"
              onClick={onCancelProcessing}
            >
              {progress.isQueued ? queueCopy.cancel : dict.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* 4-B. 타임라인 재병합 진행 모달 */}
      {isReStitching && (
        <div className="toss-modal-overlay toss-restitch-modal-overlay">
          <div className="toss-modal-card">
            <div className="toss-modal-icon-circle">
              <Scissors size={24} className="text-slate-700 animate-pulse" />
            </div>

            <h3 className="toss-modal-title">
              {dict.processingModal.reStitchModalTitle || '수정된 타임라인으로 영상을 병합하고 있어요'}
            </h3>
            <p className="toss-modal-desc">
              {reStitchProgress?.statusMessage ||
                dict.processingModal.reStitchModalDesc ||
                ui('고화질 프레임과 자막, 오디오를 싱크에 맞춰 재합성 중입니다.')}
            </p>

            {/* 진행률 바 */}
            <div className="toss-modal-progress-bar">
              <div
                className="toss-modal-progress-fill"
                style={{ width: `${Math.max(5, reStitchProgress?.progressPercent ?? 0)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 mt-2 px-0.5">
              <span>{dict.processingModal.youtubeSpec}</span>
              <span className="font-bold text-slate-800 text-sm">
                {reStitchProgress?.progressPercent ?? 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. 씬 촬영 위치 지도 확인 모달 */}
      {mapModalTarget && (
        <div className="model-modal-backdrop" onClick={() => setMapModalTarget(null)}>
          <div
            className="model-modal-card toss-map-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="model-modal-header">
              <div className="model-modal-title-row">
                <div className="model-modal-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                  <MapPin size={22} color="#ef4444" />
                </div>
                <div className="model-modal-titles">
                  <h2 id="map-modal-title" className="model-modal-title">
                    {dict.mapModal.title}
                  </h2>
                  <p className="model-modal-subtitle">
                    {mapModalTarget.locationName || mapModalTarget.subtitleTitle || mapModalTarget.reason}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="model-modal-close-btn"
                onClick={() => setMapModalTarget(null)}
                aria-label={dict.common.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
              <div className="toss-map-frame-box">
                {mapModalTarget.latitude && mapModalTarget.longitude ? (
                  <iframe
                    title={dict.mapModal.title}
                    className="w-full h-64 rounded-xl border border-slate-200"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapModalTarget.longitude - 0.008}%2C${mapModalTarget.latitude - 0.008}%2C${mapModalTarget.longitude + 0.008}%2C${mapModalTarget.latitude + 0.008}&layer=mapnik&marker=${mapModalTarget.latitude}%2C${mapModalTarget.longitude}`}
                  />
                ) : (
                  <div className="w-full h-48 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                    <MapPin size={28} className="text-slate-300 mb-2" />
                    <p className="text-xs text-slate-700 font-bold mb-1">
                      {interpolate(dict.mapModal.noGpsTitle, {
                        location: mapModalTarget.locationName || dict.common.videos,
                      })}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {dict.mapModal.noGpsDesc}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="model-modal-footer">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={
                    mapModalTarget.locationName
                      ? `https://map.naver.com/v5/search/${encodeURIComponent(mapModalTarget.locationName)}`
                      : mapModalTarget.latitude && mapModalTarget.longitude
                      ? `https://map.naver.com/v5/search/${mapModalTarget.latitude},${mapModalTarget.longitude}`
                      : `https://map.naver.com/v5/search/${encodeURIComponent(mapModalTarget.subtitleTitle || mapModalTarget.reason)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="toss-modal-btn-close"
                  style={{ padding: '8px 14px', fontSize: '12.5px', gap: '5px' }}
                >
                  <ExternalLink size={13} />
                  <span>{dict.mapModal.viewNaverMap}</span>
                </a>
                <a
                  href={
                    mapModalTarget.latitude && mapModalTarget.longitude
                      ? `https://www.google.com/maps/search/?api=1&query=${mapModalTarget.latitude},${mapModalTarget.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapModalTarget.locationName || mapModalTarget.subtitleTitle || mapModalTarget.reason)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="toss-modal-btn-close"
                  style={{ padding: '8px 14px', fontSize: '12.5px', gap: '5px' }}
                >
                  <ExternalLink size={13} />
                  <span>{dict.mapModal.viewGoogleMap}</span>
                </a>
              </div>
              <button
                type="button"
                className="toss-modal-btn-close"
                onClick={() => setMapModalTarget(null)}
              >
                {dict.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. AI 모델 선택 모달 */}
      {isModelModalOpen && (
        <React.Suspense fallback={null}>
          <ModelSelectorModal
            isOpen={isModelModalOpen}
            onClose={() => setIsModelModalOpen(false)}
            models={models}
            selectedModelId={selectedModel}
            onSelectModel={onSelectModel}
          />
        </React.Suspense>
      )}

      {/* 7. 올린 원본 영상 목록 모달 */}
      {isVideoListModalOpen && (
        <React.Suspense fallback={null}>
          <VideoListModal
            isOpen={isVideoListModalOpen}
            onClose={() => setIsVideoListModalOpen(false)}
            videos={videos}
            onRemoveVideo={onRemoveVideo}
            onAddFilesClick={() => {
              setIsVideoListModalOpen(false);
              fileInputRef.current?.click();
            }}
            onFilesSelected={onFilesSelected}
            onRelinkVideo={onRelinkVideo}
            onRelinkBatch={onRelinkBatch}
          />
        </React.Suspense>
      )}

      {/* 8. 다국어 언어 선택 모달 (ModelSelectorModal과 동일한 팝업 UI) */}
      {isLanguageModalOpen && (
        <React.Suspense fallback={null}>
          <LanguageSelectorModal
            isOpen={isLanguageModalOpen}
            onClose={() => setIsLanguageModalOpen(false)}
          />
        </React.Suspense>
      )}

      {/* 9. 오디오 보관함 모달 */}
      {isAudioLibraryOpen && (
        <React.Suspense fallback={null}>
          <AudioLibraryModal
            isOpen={isAudioLibraryOpen}
            onClose={() => setIsAudioLibraryOpen(false)}
            selectedTrackId={selectedLibraryTrackId}
            hasAppliedAudio={Boolean(customAudioFile)}
            onApply={handleApplyLibraryAudio}
          />
        </React.Suspense>
      )}

      {/* 10. 스튜디오 설정 모달 (AI 모델, 언어, 날짜 표기, 아이 나이, 초기화 등) */}
      {isSettingsModalOpen && (
      <React.Suspense fallback={null}>
      <MobileSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onOpenLanguageModal={() => setIsLanguageModalOpen(true)}
        onOpenFeedbackModal={() => setIsFeedbackModalOpen(true)}
        onOpenPatchNotesModal={() => setIsPatchNotesModalOpen(true)}
        onOpenDateFormatModal={() => setIsDateFormatModalOpen(true)}
        currentDateFormat={currentDateFormat}
        showDate={showDate}
        onToggleShowDate={handleToggleShowDate}
        autoSortByRecordedDate={autoSortByRecordedDate}
        onToggleAutoSortByRecordedDate={handleToggleAutoSortByRecordedDate}
        showAge={showAge}
        onToggleShowAge={handleToggleShowAge}
        birthDate={birthDate}
        onChangeBirthDate={handleChangeBirthDate}
        referenceDate={videos[0]?.recordedTimestamp ? new Date(videos[0].recordedTimestamp) : undefined}
        showSubtitle={overlayOptions.showSubtitle}
        onToggleShowSubtitle={(val) =>
          setOverlayOptions((prev) => ({ ...prev, showSubtitle: val }))
        }
        showChapterBridge={overlayOptions.showChapterBridge !== false}
        onToggleShowChapterBridge={(val) => {
          setStoredShowChapterBridge(val);
          setOverlayOptions((prev) => ({ ...prev, showChapterBridge: val }));
        }}
        chapterBridgeDateTemplate={overlayOptions.chapterBridgeDateTemplate || 'flip-clock'}
        chapterBridgeLocationTemplate={overlayOptions.chapterBridgeLocationTemplate || 'winding-route'}
        onChangeChapterBridgeTemplates={(dateTpl, locTpl) => {
          setOverlayOptions((prev) => ({
            ...prev,
            chapterBridgeDateTemplate: dateTpl,
            chapterBridgeLocationTemplate: locTpl,
          }));
        }}
        showIntro={overlayOptions.showIntro}
        onToggleShowIntro={(val) => {
          setStoredShowIntro(val);
          setOverlayOptions((prev) => ({ ...prev, showIntro: val }));
        }}
        introTemplate={overlayOptions.introTemplate || 'kinetic-slide'}
        introDurationSec={overlayOptions.introDurationSec || 2.0}
        showOutro={overlayOptions.showOutro}
        onToggleShowOutro={(val) => {
          setStoredShowOutro(val);
          setOverlayOptions((prev) => ({ ...prev, showOutro: val }));
        }}
        outroTemplate={overlayOptions.outroTemplate || 'modern-endcard'}
        outroDurationSec={overlayOptions.outroDurationSec || 2.2}
        outroText={overlayOptions.outroText}
        onChangeIntroOutroSettings={(settings) => {
          setStoredIntroOutroDefaults(settings);
          setOverlayOptions((prev) => ({
            ...prev,
            ...settings,
          }));
        }}
        currentSubtitleTone={currentSubtitleTone}
        onSelectSubtitleTone={handleSelectSubtitleTone}
        currentModel={currentModel || undefined}
        isLoadingModels={isLoadingModels}
        currentLocaleInfo={currentLocaleInfo}
        hasVideos={videos.length > 0}
        onReset={requestNewProject}
        hasStitchedResult={isSequenceMode}
        onDownloadThumbnail={handleDownloadThumbnail}
        onDownloadSubtitles={() => {
          setIsSettingsModalOpen(false);
          setIsSubtitleModalOpen(true);
        }}
        onReStitch={() => {
          setIsSettingsModalOpen(false);
          void handleDownload();
        }}
        isReStitching={isReStitching}
        reStitchProgress={reStitchProgress}
        selectedResolution={exportResolution}
        onSelectResolution={setExportResolution}
        orientation={orientation}
        portraitPlatform={portraitPlatform}
      />
      </React.Suspense>
      )}

      {/* 11. 촬영 날짜 포맷 선택 모달 */}
      {isDateFormatModalOpen && (
        <React.Suspense fallback={null}>
          <DateFormatSelectorModal
            isOpen={isDateFormatModalOpen}
            onClose={() => setIsDateFormatModalOpen(false)}
            currentFormat={currentDateFormat}
            onSelectFormat={handleSelectDateFormat}
            referenceDate={videos[0]?.recordedTimestamp ? new Date(videos[0].recordedTimestamp) : undefined}
          />
        </React.Suspense>
      )}

      {/* 12. 유튜브 호환 다국어 자막 다운로드 모달 */}
      {isSubtitleModalOpen && (
        <React.Suspense fallback={null}>
          <SubtitleDownloadModal
            isOpen={isSubtitleModalOpen}
            onClose={() => setIsSubtitleModalOpen(false)}
            segments={segments}
            introDuration={introDuration}
            bridgeDurationMap={effectiveBridgeDurationMap}
            videoTitle={overlayOptions.titleText || result?.suggestedTitle || 'highlight'}
          />
        </React.Suspense>
      )}

      {/* 12-1. 완성 영상 해상도 선택 및 내보내기 모달 */}
      {isExportModalOpen && (
        <React.Suspense fallback={null}>
          <VideoExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            currentResolution={exportResolution}
            onConfirmDownload={(res) => {
              setExportResolution(res);
              void handleDownload(res);
            }}
            totalDurationText={formatSec(totalDuration)}
            segmentCount={segments.length}
            isMobileDevice={isMobileDevice}
            orientation={orientation}
          />
        </React.Suspense>
      )}

      {/* 12-2. 클립 구간 세밀 편집 모달 (원본 비디오 확인 & 조절) */}
      {Boolean(trimModalTarget) && (
        <React.Suspense fallback={null}>
          <SegmentTrimModal
            isOpen={Boolean(trimModalTarget)}
            onClose={() => setTrimModalTarget(null)}
            segment={trimModalTarget}
            sourceVideo={trimModalTarget ? videoMap.get(trimModalTarget.sourceVideoId) : undefined}
            onSave={handleSaveTrimRange}
          />
        </React.Suspense>
      )}

      {/* 12-2B. 클립 챕터 브릿지 개별 변경 모달 */}
      {editingBridgeIndex !== null && segments[editingBridgeIndex] && (
        <React.Suspense fallback={null}>
          <SegmentBridgeModal
            isOpen={true}
            onClose={() => setEditingBridgeIndex(null)}
            segment={segments[editingBridgeIndex]}
            segmentIndex={editingBridgeIndex}
            defaultDateTemplate={overlayOptions.chapterBridgeDateTemplate || 'flip-clock'}
            defaultLocationTemplate={overlayOptions.chapterBridgeLocationTemplate || 'winding-route'}
            orientation={orientation}
            portraitPlatform={portraitPlatform}
            onSave={(updatedSegment) => {
              setSegments((prev) =>
                prev.map((s, idx) => (idx === editingBridgeIndex ? updatedSegment : s))
              );
              notify.success(dict.toasts.segmentBridgeUpdated);
            }}
          />
        </React.Suspense>
      )}

      {/* 12-3. 피드백 & 개선 요청 모달 (설정 메뉴에서 진입) */}
      {isFeedbackModalOpen && (
        <React.Suspense fallback={null}>
          <FeedbackModal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
          />
        </React.Suspense>
      )}

      {/* 12-4. 패치 노트 모달 (설정 메뉴에서 진입) */}
      {isPatchNotesModalOpen && (
        <React.Suspense fallback={null}>
          <PatchNotesModal
            isOpen={isPatchNotesModalOpen}
            onClose={() => setIsPatchNotesModalOpen(false)}
          />
        </React.Suspense>
      )}

      {/* 12-5. HyperFrames 인트로 & 아웃트로 실시간 미리보기 모달 */}
      {isIntroOutroModalOpen && (
        <React.Suspense fallback={null}>
          <IntroOutroPreviewModal
            isOpen={isIntroOutroModalOpen}
            onClose={() => setIsIntroOutroModalOpen(false)}
            initialTab={introOutroModalTab}
            initialIntroTemplate={overlayOptions.introTemplate || 'kinetic-slide'}
            initialIntroDuration={overlayOptions.introDurationSec || 2.0}
            initialOutroTemplate={overlayOptions.outroTemplate || 'modern-endcard'}
            initialOutroDuration={overlayOptions.outroDurationSec || 2.2}
            initialOutroText={overlayOptions.outroText}
            mockTitle={overlayOptions.titleText || result?.suggestedTitle}
            mockDate={overlayOptions.subtitleDateText}
            mockLocation={overlayOptions.subtitleLocationText}
            orientation={orientation}
            portraitPlatform={portraitPlatform}
            onApply={(settings) => {
              setStoredIntroOutroDefaults(settings);
              setOverlayOptions((prev) => ({
                ...prev,
                ...settings,
              }));
              notify.success(dict.toasts.introOutroDefaultsApplied);
            }}
          />
        </React.Suspense>
      )}

      {/* 13. 화면 하단 고정 슬림 상태바 (자동 저장 상태 + 시간 절약률 요약) */}
      {/* 새 프로젝트 포맷 선택 모달 — 만들 때 가로/세로를 정한다 */}
      {isFormatModalOpen && (
        <div
          className="toss-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={ui('새 영상 포맷 고르기')}
          onClick={() => setIsFormatModalOpen(false)}
        >
          <div className="toss-modal-card format-picker-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="toss-modal-title">{ui('새 영상 포맷 고르기')}</h2>
            <p className="toss-modal-desc">{ui('만들기 전에 화면 비율을 골라주세요.')}</p>

            <div className="format-picker-grid">
              <button
                type="button"
                className={`format-picker-option ${pendingOrientation === 'landscape' ? 'is-selected' : ''}`}
                onClick={() => setPendingOrientation('landscape')}
                aria-pressed={pendingOrientation === 'landscape'}
              >
                <span className="format-picker-frame format-picker-frame-landscape">
                  <Monitor size={20} strokeWidth={1.8} />
                </span>
                <span className="format-picker-name">{ui('가로 16:9')}</span>
                <span className="format-picker-sub">{ui('유튜브·동영상 사이트')}</span>
                {pendingOrientation === 'landscape' && (
                  <span className="format-picker-check"><Check size={12} strokeWidth={3} /></span>
                )}
              </button>
              <button
                type="button"
                className={`format-picker-option ${pendingOrientation === 'portrait' ? 'is-selected' : ''}`}
                onClick={() => setPendingOrientation('portrait')}
                aria-pressed={pendingOrientation === 'portrait'}
              >
                <span className="format-picker-frame format-picker-frame-portrait">
                  <Smartphone size={20} strokeWidth={1.8} />
                </span>
                <span className="format-picker-name">{ui('세로 9:16')}</span>
                <span className="format-picker-sub">{ui('릴스·쇼츠·틱톡')}</span>
                {pendingOrientation === 'portrait' && (
                  <span className="format-picker-check"><Check size={12} strokeWidth={3} /></span>
                )}
              </button>
            </div>

            <button type="button" className="toss-modal-btn-submit format-picker-start" onClick={confirmStartNewProject}>
              {ui('이 포맷으로 시작하기')}
            </button>
            <button type="button" className="toss-modal-cancel-btn" onClick={() => setIsFormatModalOpen(false)}>
              {dict.common?.cancel || '취소'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'studio' && (
        <aside className="toss-bottom-status-bar" aria-label={dict.projects?.tabTitle || '작업 상태바'}>
          <div className="toss-bottom-status-inner">
            {/* 좌측: 자동 저장 상태 */}
            <div className="toss-bottom-status-left">
              <span
                className={`toss-bottom-status-dot ${
                  videos.length === 0
                    ? 'idle'
                    : saveStatus === 'saving'
                    ? 'saving'
                    : 'saved'
                }`}
              />
              <span className="toss-bottom-status-text">
                {videos.length === 0 ? (
                  <span className="text-slate-500 font-normal">
                    {dict.projects?.studioReady || '스튜디오 준비됨 · 영상을 올려보세요'}
                  </span>
                ) : saveStatus === 'saving' ? (
                  <span className="text-slate-800 font-medium">
                    {dict.projects?.saving || '기기에 안전하게 보관 중...'}
                  </span>
                ) : (
                  <span className="text-slate-700 font-medium">
                    {getStoredStorageMode() === 'lightweight'
                      ? ui('편집 정보만 기기에 저장됨 (초경량 모드)')
                      : result?.url && !hasPlayableSourceVideos
                        ? (dict.projects?.finalResultSaved || '최종 완성 영상이 기기에 보관됨')
                        : dict.projects?.bottomSaved || dict.projects?.autoSaved || '기기에 안전하게 보관됨'}
                  </span>
                )}
              </span>

              {videos.length > 0 && saveStatus === 'saved' && (
                <button
                  type="button"
                  className="toss-bottom-status-link"
                  onClick={handleBackToProjects}
                  title={dict.projects?.goToProjects || '스튜디오 목록으로 이동'}
                >
                  <FolderOpen size={12} className="inline mr-1 text-slate-500" />
                  <span>{dict.projects?.viewProjects || '스튜디오 목록'}</span>
                </button>
              )}
            </div>

            {/* 우측: 시간 절약률 / 영상 요약 */}
            <div className="toss-bottom-status-right">
              {originalTotalDuration > 0 && hasHighlight ? (
                <div className="toss-bottom-savings-box">
                  <span className="toss-bottom-savings-label">
                    {dict.summaryCard.timeSavedRate}
                  </span>
                  <span className="toss-bottom-savings-times">
                    <span className="text-slate-500">
                      {interpolate(dict.summaryCard.originalVideo, {
                        duration: originalTotalDuration.toFixed(1),
                      })}
                    </span>
                    <span className="mx-1 text-slate-400">➔</span>
                    <strong className="text-slate-900 font-mono font-semibold">
                      {interpolate(dict.summaryCard.highlightOnly || '{duration}초 하이라이트', {
                        duration: totalDuration.toFixed(1),
                      })}
                    </strong>
                  </span>
                  {savedPercent > 0 && (
                    <span className="toss-bottom-savings-badge">
                      {interpolate(dict.summaryCard.reducedBy, { percent: savedPercent })}
                    </span>
                  )}
                </div>
              ) : videos.length > 0 ? (
                <div className="toss-bottom-summary-simple">
                  <span className="text-slate-500 text-xs font-mono">
                    {interpolate(
                      dict.summaryCard.totalVideosSummary || '총 {count}개 영상 ({duration}초)',
                      {
                        count: videos.length,
                        duration: originalTotalDuration.toFixed(1),
                      }
                    )}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
