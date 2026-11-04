// components/studio/ProStudioView.tsx - Toss-style 16:9 AI Video Studio with i18n

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
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
  ChevronDown,
  Globe,
  Calendar,
  Image as ImageIcon,
  Share2,
  Settings,
  Subtitles,
} from 'lucide-react';
import { VideoCommunityView } from '../community/VideoCommunityView.tsx';
import type {
  FinalVideoResult,
  HighlightSegment,
  VideoItem,
  ProcessingProgress,
  VideoOverlayOptions,
} from '../../types/video.ts';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import {
  captureVideoFrameAtTime,
  captureVideoFrameFromElement,
  renderThumbnailArtwork,
  downloadThumbnailFile,
} from '../../services/thumbnailGenerator.ts';
import {
  computeBridgeDurationMap,
  evaluateChapterBridge,
} from '../../services/hyperframesBridgeRenderer.ts';
import { ModelSelectorModal } from './ModelSelectorModal.tsx';
import { VideoListModal } from './VideoListModal.tsx';
import { LanguageSelectorModal } from './LanguageSelectorModal.tsx';
import { AudioLibraryModal } from './AudioLibraryModal.tsx';
import { MobileSettingsModal } from './MobileSettingsModal.tsx';
import { DateFormatSelectorModal } from './DateFormatSelectorModal.tsx';
import { SubtitleDownloadModal } from './SubtitleDownloadModal.tsx';
import {
  type DateFormatOption,
  formatDateByPattern,
  getStoredDateFormat,
  setStoredDateFormat,
  getStoredShowAge,
  setStoredShowAge,
  getStoredBirthDate,
  setStoredBirthDate,
  formatDateWithAge,
  stripAgeFromDate,
  parseDateFromString,
} from '../../services/videoMetadata.ts';
import {
  loadLibraryAudioFile,
  type AudioLibraryTrack,
} from '../../data/audioLibrary.ts';
import { ReportistLogo } from '../common/ReportistLogo.tsx';
import { useI18n } from '../../i18n/index.tsx';

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
  onStartAiAnalysis: (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId?: string,
    bgmVolume?: number
  ) => void;
  isProcessing: boolean;
  progress: ProcessingProgress;
  onCancelProcessing: () => void;
  onReset: () => void;
  onReStitch: (
    updatedSegments: HighlightSegment[],
    bgmPresetId: string,
    bgmVolume: number,
    customAudioFile?: File | null,
    overlayOptions?: VideoOverlayOptions
  ) => Promise<void>;
  isReStitching: boolean;
  reStitchProgress?: {
    progressPercent: number;
    statusMessage: string;
  };
  onUpdateVideosDateFormat?: (format: DateFormatOption) => void;
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
  onStartAiAnalysis,
  isProcessing,
  progress,
  onCancelProcessing,
  onReset,
  onReStitch,
  isReStitching,
  reStitchProgress,
  onUpdateVideosDateFormat,
}) => {
  const { dict, interpolate, currentLocaleInfo } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 타임라인 및 클립 상태
  const initialSegments = useMemo(() => {
    if (result?.segments && result.segments.length > 0) {
      return result.segments;
    }
    const extracted = videos.flatMap((v) => v.segments);
    if (extracted.length > 0) return extracted;
    return videos.map((v, idx) => ({
      id: `temp_seg_${v.id}`,
      sourceVideoId: v.id,
      sourceVideoName: v.name,
      start: 0,
      end: Math.min(v.duration || 5, 5),
      duration: Math.min(v.duration || 5, 5),
      reason: `Clip #${idx + 1}`,
    }));
  }, [result, videos]);

  const [segments, setSegments] = useState<HighlightSegment[]>(initialSegments);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    initialSegments[0]?.id || ''
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 2. 배경음악(BGM) 상태
  const [selectedBgmId, setSelectedBgmId] = useState<string>('none');
  const [bgmVolume, setBgmVolume] = useState<number>(0.3);

  // 3. 사용자 직접 업로드 음악 상태
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioName, setCustomAudioName] = useState<string>('');
  const customAudioInputRef = useRef<HTMLInputElement>(null);

  // 3-1. 오디오 보관함 상태
  const [isAudioLibraryOpen, setIsAudioLibraryOpen] = useState<boolean>(false);
  const [selectedLibraryTrackId, setSelectedLibraryTrackId] = useState<string | null>(null);

  // 4. 인트로 / 아웃트로 비디오 파일 업로드 참조 및 지도 모달 상태
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const outroVideoInputRef = useRef<HTMLInputElement>(null);
  const [mapModalTarget, setMapModalTarget] = useState<HighlightSegment | null>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);

  // 4-1. 다국어, AI 모델 및 원본 영상 목록 모달 상태
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState<boolean>(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [isVideoListModalOpen, setIsVideoListModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isDateFormatModalOpen, setIsDateFormatModalOpen] = useState<boolean>(false);
  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = useState<boolean>(false);
  const [currentDateFormat, setCurrentDateFormat] = useState<DateFormatOption>(getStoredDateFormat);
  const [showAge, setShowAge] = useState<boolean>(getStoredShowAge);
  const [birthDate, setBirthDate] = useState<string>(getStoredBirthDate);

  const currentModel = useMemo(
    () => models.find((model) => model.id === selectedModel) || models[0] || null,
    [models, selectedModel]
  );

  useEffect(() => {
    if (isProcessing) {
      setIsLanguageModalOpen(false);
      setIsModelModalOpen(false);
      setIsVideoListModalOpen(false);
      setIsAudioLibraryOpen(false);
      setIsSettingsModalOpen(false);
      setIsDateFormatModalOpen(false);
      setIsSubtitleModalOpen(false);
    }
  }, [isProcessing]);

  // 현재 AI 분석/처리 중인 비디오 및 썸네일
  const currentProcessingVideo = videos[progress.currentVideoIndex] || videos[0];
  const currentVideoThumbnail = currentProcessingVideo?.thumbnailUrl;

  // 모달에 표시할 가장 최근 작업 문구 (최근 2줄 분량, 초과 시 ...)
  const latestTask = useMemo(() => {
    const reasoningText = (progress.liveReasoning || '').trim();
    const contentText = (progress.liveContent || '').trim();
    const liveText = reasoningText || contentText;

    // 1. 실시간 추론 또는 응답 스트리밍 중 -> 최근 1~2줄 추출
    if (liveText) {
      const lines = liveText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const recentLines = lines.slice(-2);
      const textPart = recentLines.join('\n');
      const prefix = reasoningText ? '💭 ' : '⌨️ ';
      return {
        isStreaming: true,
        text: textPart
          ? `${prefix}${textPart}`
          : reasoningText
          ? dict.processingModal.reasoningProcess
          : dict.processingModal.responseGeneration,
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

  // 4-2. 상단 탭 상태 (스튜디오 vs 영상 공유 커뮤니티)
  const [activeTab, setActiveTab] = useState<'studio' | 'community'>('studio');

  // 5. 자막 & 브랜딩 오버레이 상태
  const initialDateStr = useMemo(() => {
    if (videos.length > 0 && videos[0].metadataDate) {
      const ts = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
      const targetDate = ts ? new Date(ts) : parseDateFromString(videos[0].metadataDate) || new Date();
      return formatDateWithAge(videos[0].metadataDate, targetDate, showAge, birthDate);
    }
    const ts = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
    if (ts) {
      const base = formatDateByPattern(new Date(ts), currentDateFormat);
      return formatDateWithAge(base, new Date(ts), showAge, birthDate);
    }
    return '';
  }, [videos, currentDateFormat, showAge, birthDate]);

  const [overlayOptions, setOverlayOptions] = useState<VideoOverlayOptions>({
    showTitle: true,
    titleText: dict.player.defaultTitleText,
    showChannel: true,
    channelText: dict.player.defaultChannelText,
    showSubtitle: true,
    subtitleDateText: initialDateStr,
    subtitleLocationText: '',
    showIntro: false,
    showOutro: false,
    showChapterBridge: true,
    introVideoFile: null,
    outroVideoFile: null,
  });

  const effectiveOverlayOptions = useMemo<VideoOverlayOptions>(() => ({
    ...overlayOptions,
    titleText: overlayOptions.titleText || dict.player.defaultTitleText,
    channelText: overlayOptions.channelText || dict.player.defaultChannelText,
    outroText: overlayOptions.outroText || dict.introOutro.outroDefaultText,
  }), [overlayOptions, dict]);

  // 6. AI 16:9 유튜브 썸네일 상태
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(result?.thumbnailUrl || null);
  const [thumbnailStyle, setThumbnailStyle] = useState<'youtube-bold' | 'banner-box' | 'cinematic-clean'>('youtube-bold');
  const [showThumbnailTitle, setShowThumbnailTitle] = useState<boolean>(true);
  const thumbnailBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isUpdatingThumbnail, setIsUpdatingThumbnail] = useState<boolean>(false);

  // 영상이 추가되었을 때 실제 촬영 날짜 자동 반영
  useEffect(() => {
    if (videos.length > 0) {
      const ts = videos[0].recordedTimestamp || videos[0].file?.lastModified;
      let detectedDate =
        videos[0].metadataDate ||
        (ts ? formatDateByPattern(new Date(ts), currentDateFormat) : '');
      if (detectedDate) {
        const targetDate = ts ? new Date(ts) : parseDateFromString(detectedDate) || new Date();
        const formattedWithAge = formatDateWithAge(detectedDate, targetDate, showAge, birthDate);
        setOverlayOptions((prev) => ({
          ...prev,
          subtitleDateText: prev.subtitleDateText || formattedWithAge,
        }));
      }
    }
  }, [videos, currentDateFormat, showAge, birthDate]);

  // 날짜 표기 형식 변경 시 세그먼트 자막 및 비디오 메타데이터 일괄 갱신
  const handleSelectDateFormat = (newFormat: DateFormatOption) => {
    setCurrentDateFormat(newFormat);
    setStoredDateFormat(newFormat);

    // 1. 타임라인 세그먼트들의 subtitleDate 일괄 갱신
    setSegments((prev) =>
      prev.map((seg) => {
        const vItem = videoMap.get(seg.sourceVideoId);
        const ts = vItem?.recordedTimestamp || vItem?.file?.lastModified;
        const targetDate = ts ? new Date(ts) : parseDateFromString(seg.subtitleDate || '') || new Date();
        const baseDate = ts ? formatDateByPattern(new Date(ts), newFormat) : formatDateByPattern(targetDate, newFormat);
        return {
          ...seg,
          subtitleDate: formatDateWithAge(baseDate, targetDate, showAge, birthDate),
        };
      })
    );

    // 2. 전체 기본 하단 자막(subtitleDateText) 갱신
    if (videos.length > 0) {
      const firstTs = videos[0].recordedTimestamp || videos[0].file?.lastModified;
      const targetDate = firstTs ? new Date(firstTs) : parseDateFromString(overlayOptions.subtitleDateText || '') || new Date();
      const baseDate = formatDateByPattern(targetDate, newFormat);
      setOverlayOptions((prev) => ({
        ...prev,
        subtitleDateText: formatDateWithAge(baseDate, targetDate, showAge, birthDate),
      }));
    }

    // 3. 상위 컴포넌트(App)의 videos metadataDate 갱신
    onUpdateVideosDateFormat?.(newFormat);
  };

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
          ? formatDateByPattern(new Date(ts), currentDateFormat)
          : stripAgeFromDate(seg.subtitleDate || '');
        return {
          ...seg,
          subtitleDate: formatDateWithAge(baseDate, targetDate, enabled, birthDate),
        };
      })
    );

    // 2. 전체 기본 하단 자막(subtitleDateText) 갱신
    const firstTs = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
    const targetDate = firstTs
      ? new Date(firstTs)
      : parseDateFromString(overlayOptions.subtitleDateText || '') || new Date();
    const baseDate = firstTs
      ? formatDateByPattern(new Date(firstTs), currentDateFormat)
      : stripAgeFromDate(overlayOptions.subtitleDateText || '');
    setOverlayOptions((prev) => ({
      ...prev,
      subtitleDateText: formatDateWithAge(baseDate, targetDate, enabled, birthDate),
    }));
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
          ? formatDateByPattern(new Date(ts), currentDateFormat)
          : stripAgeFromDate(seg.subtitleDate || '');
        return {
          ...seg,
          subtitleDate: formatDateWithAge(baseDate, targetDate, showAge, newBirthDate),
        };
      })
    );

    // 2. 전체 기본 하단 자막(subtitleDateText) 갱신
    const firstTs = videos[0]?.recordedTimestamp || videos[0]?.file?.lastModified;
    const targetDate = firstTs
      ? new Date(firstTs)
      : parseDateFromString(overlayOptions.subtitleDateText || '') || new Date();
    const baseDate = firstTs
      ? formatDateByPattern(new Date(firstTs), currentDateFormat)
      : stripAgeFromDate(overlayOptions.subtitleDateText || '');
    setOverlayOptions((prev) => ({
      ...prev,
      subtitleDateText: formatDateWithAge(baseDate, targetDate, showAge, newBirthDate),
    }));
  };

  // AI 추론 콘솔 자동 스크롤
  useEffect(() => {
    if (consoleScrollRef.current) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
    }
  }, [progress.reasoningLogs, progress.liveReasoning, progress.liveContent]);

  const handleCustomAudioSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCustomAudioFile(file);
      setCustomAudioName(file.name);
      setSelectedBgmId('custom');
      setSelectedLibraryTrackId(null);
    }
  };

  // 오디오 보관함 음원 선택 (파일을 불러와 기존 커스텀 BGM 파이프라인에 연결)
  const handleApplyLibraryAudio = async (track: AudioLibraryTrack | null) => {
    if (!track) {
      setCustomAudioFile(null);
      setCustomAudioName('');
      setSelectedBgmId('none');
      setSelectedLibraryTrackId(null);
      return;
    }

    const file = await loadLibraryAudioFile(track);
    setCustomAudioFile(file);
    setCustomAudioName(track.name);
    setSelectedBgmId('custom');
    setSelectedLibraryTrackId(track.id);
  };

  const handleIntroVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOverlayOptions((prev) => ({ ...prev, introVideoFile: file, showIntro: true }));
    }
  };

  const handleOutroVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOverlayOptions((prev) => ({ ...prev, outroVideoFile: file, showOutro: true }));
    }
  };

  // 상위 결과 갱신 동기화
  // 상위 결과 갱신 동기화 및 썸네일/타이틀 준비
  useEffect(() => {
    if (result?.segments && result.segments.length > 0) {
      setSegments(result.segments);
      if (!selectedSegmentId || !result.segments.some((s) => s.id === selectedSegmentId)) {
        setSelectedSegmentId(result.segments[0].id);
      }
    } else if (videos.length > 0 && segments.length === 0) {
      const fallback = videos.map((v, idx) => ({
        id: `temp_seg_${v.id}`,
        sourceVideoId: v.id,
        sourceVideoName: v.name,
        start: 0,
        end: Math.min(v.duration || 5, 5),
        duration: Math.min(v.duration || 5, 5),
        reason: `Clip #${idx + 1}`,
      }));
      setSegments(fallback);
      setSelectedSegmentId(fallback[0]?.id || '');
    }

    if (result?.suggestedTitle) {
      setOverlayOptions((prev) => ({
        ...prev,
        titleText:
          prev.titleText && prev.titleText !== dict.player.defaultTitleText
            ? prev.titleText
            : result.suggestedTitle!,
        showTitle: true,
      }));
    }

    if (result?.thumbnailUrl) {
      setThumbnailUrl(result.thumbnailUrl);

      // 이미 완성된 썸네일 이미지를 배경 캔버스로 즉시 캐시해두어 실시간 편집 보장
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 1280;
        c.height = img.naturalHeight || 720;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          if (!thumbnailBgCanvasRef.current) {
            thumbnailBgCanvasRef.current = c;
          }
        }
      };
      img.src = result.thumbnailUrl;
    }

    // 썸네일용 배경 프레임 캔버스 캡처/캐싱 (실시간 타이틀 편집 지원)
    const prepareThumbnailBg = async () => {
      if (!videos.length && !result?.url) return;
      try {
        const targetVideo =
          videos.find((v) => v.id === result?.bestSourceVideoId) || videos[0];
        const targetUrl = targetVideo ? targetVideo.url : result?.url;
        if (!targetUrl) return;

        const targetTime =
          result?.bestThumbnailTime && result.bestThumbnailTime > 0.5
            ? result.bestThumbnailTime
            : (result?.segments && result.segments[0]
                ? result.segments[0].start + Math.max(0.5, result.segments[0].duration * 0.4)
                : 0.5);

        const bg = await captureVideoFrameAtTime(
          targetUrl,
          targetTime,
          result?.segments?.[0]?.cropOffsetYRatio ?? 0.2
        );
        thumbnailBgCanvasRef.current = bg;
      } catch (err) {
        console.warn('Failed to prepare thumbnail background canvas:', err);
      }
    };

    if (result) {
      prepareThumbnailBg();
    }
  }, [result, dict.player.defaultTitleText, videos]);

  // 타이틀/스타일 변경 시 실시간 썸네일 재렌더링
  useEffect(() => {
    if (!thumbnailBgCanvasRef.current) return;
    try {
      const artCanvas = renderThumbnailArtwork(thumbnailBgCanvasRef.current, {
        titleText: overlayOptions.titleText,
        channelText: '',
        badgeText: '',
        showTitle: showThumbnailTitle && Boolean(overlayOptions.titleText?.trim()),
        showBadge: false,
        showChannel: false,
        stylePreset: thumbnailStyle,
      });
      setThumbnailUrl(artCanvas.toDataURL('image/jpeg', 0.95));
    } catch (e) {
      console.warn('Live thumbnail render failed:', e);
    }
  }, [
    overlayOptions.titleText,
    thumbnailStyle,
    showThumbnailTitle,
  ]);

  // 활성 비디오 소스 URL
  const activeVideoUrl = useMemo(() => {
    if (result?.url) return result.url;
    if (videos.length > 0 && videos[0].url) return videos[0].url;
    return null;
  }, [result?.url, videos]);

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [activeVideoUrl]);

  // 총 시간 계산
  const totalDuration = useMemo(() => {
    if (result?.duration && result.duration > 0) return result.duration;
    return segments.reduce((sum, s) => sum + s.duration, 0) || 1;
  }, [result?.duration, segments]);

  // 원본 영상 총 시간
  const originalTotalDuration = useMemo(() => {
    return videos.reduce((sum, v) => sum + v.duration, 0);
  }, [videos]);

  // 시간 절약 퍼센트
  const savedPercent = useMemo(() => {
    if (!originalTotalDuration || originalTotalDuration <= 0) return 0;
    return Math.max(0, Math.round((1 - totalDuration / originalTotalDuration) * 100));
  }, [totalDuration, originalTotalDuration]);

  // 비디오 ID 매핑
  const videoMap = useMemo(() => {
    const map = new Map<string, VideoItem>();
    videos.forEach((v) => map.set(v.id, v));
    return map;
  }, [videos]);

  // 인트로, 아웃트로 및 챕터 브릿지 실제 적용 시간
  const introDuration = (result?.url && result.introDuration) ? result.introDuration : 0;
  const outroDuration = (result?.url && result.outroDuration) ? result.outroDuration : 0;
  const effectiveBridgeDurationMap = useMemo(() => {
    if (result?.url && result.bridgeDurationMap) {
      return result.bridgeDurationMap;
    }
    return computeBridgeDurationMap(segments, overlayOptions);
  }, [result?.url, result?.bridgeDurationMap, segments, overlayOptions]);

  // 구간별 누적 시작 오프셋 (챕터 브릿지 구간 시간 반영)
  const segmentTimelineOffsets = useMemo(() => {
    let acc = introDuration;
    const offsets: Record<string, { bridgeStartOffset: number; startOffset: number; endOffset: number; bridgeDuration: number }> = {};
    segments.forEach((s) => {
      const bridgeDur = (result?.url ? (result.bridgeDurationMap?.[s.id] ?? 0) : (effectiveBridgeDurationMap[s.id] ?? 0));
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
  }, [segments, introDuration, result?.url, result?.bridgeDurationMap, effectiveBridgeDurationMap]);

  // 현재 재생 중인 시간대에 위치한 세그먼트 자동 감지
  const activePlayingSegmentId = useMemo(() => {
    if (!result?.url) return selectedSegmentId;
    if (introDuration > 0 && currentTime < introDuration) {
      return 'intro';
    }
    if (outroDuration > 0 && currentTime >= totalDuration - outroDuration) {
      return 'outro';
    }
    let acc = introDuration;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const bridgeDur = result.bridgeDurationMap?.[seg.id] ?? 0;
      const segBlockStart = acc;
      const segEnd = acc + bridgeDur + seg.duration;
      const isLast = i === segments.length - 1 && outroDuration === 0;
      if (currentTime >= segBlockStart && (isLast ? currentTime <= totalDuration + 2.0 : currentTime < segEnd)) {
        return seg.id;
      }
      acc = segEnd;
    }
    return selectedSegmentId;
  }, [currentTime, segments, result?.url, result?.bridgeDurationMap, introDuration, outroDuration, totalDuration, selectedSegmentId]);

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
    const datePart = activePlayingSegment.subtitleDate || overlayOptions.subtitleDateText || '';
    const locPart = activePlayingSegment.locationName || overlayOptions.subtitleLocationText || '';
    const parts = [datePart, locPart].filter(Boolean);
    return parts.join(' • ').trim();
  }, [activePlayingSegment, overlayOptions.subtitleDateText, overlayOptions.subtitleLocationText]);

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

  // 클립 선택 및 이동
  const handleSelectSegment = (segId: string) => {
    setSelectedSegmentId(segId);
    if (!result?.url) {
      const seg = segments.find((s) => s.id === segId);
      if (seg && videoRef.current) {
        videoRef.current.currentTime = seg.start;
        setCurrentTime(seg.start);
      }
      return;
    }
    if (segId === 'intro') {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      return;
    }
    if (segId === 'outro') {
      const outroStart = Math.max(0, totalDuration - outroDuration);
      if (videoRef.current) {
        videoRef.current.currentTime = outroStart;
        setCurrentTime(outroStart);
      }
      return;
    }
    const offset = segmentTimelineOffsets[segId];
    if (offset && videoRef.current) {
      videoRef.current.currentTime = offset.startOffset + 0.05;
      setCurrentTime(offset.startOffset + 0.05);
    }
  };

  // 상대 시간 이동 (-5s, +5s)
  const seekRelative = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const newT = Math.max(0, Math.min(totalDuration, (v.currentTime || currentTime) + delta));
    v.currentTime = newT;
    setCurrentTime(newT);
  };

  // 프로그레스 바 / 타임라인 위치 클릭 시 직접 이동
  const handleSeekByPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * totalDuration;
    v.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // 재생 / 일시정지 토글
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      const p = v.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('[VideoPlayer] Play interrupted or blocked, fallback to muted:', err);
          v.muted = true;
          setIsMuted(true);
          v.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // 음소거 토글
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
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

  // 클립 삭제
  const handleDeleteSegment = (segId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = segments.filter((s) => s.id !== segId);
    setSegments(updated);
    if (selectedSegmentId === segId && updated.length > 0) {
      setSelectedSegmentId(updated[0].id);
    }
  };

  // 크롭 위치 조정
  const handleCropAnchorChange = (segId: string, ratio: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, cropOffsetYRatio: ratio } : s))
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

  // 완성 영상 다운로드
  const handleDownload = () => {
    if (!result?.url) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `reportist_highlight_16x9_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    } catch (err) {
      console.error('Thumbnail download failed:', err);
    }
  };

  // 현재 재생 시점 프레임으로 썸네일 배경 변경
  const handleCaptureCurrentFrame = async () => {
    if (!videoRef.current && !activeVideoUrl) return;
    setIsUpdatingThumbnail(true);
    try {
      let bg: HTMLCanvasElement | null = null;
      if (videoRef.current && videoRef.current.readyState >= 2) {
        bg = captureVideoFrameFromElement(
          videoRef.current,
          activePlayingSegment?.cropOffsetYRatio ?? 0.2
        );
      }

      if (!bg && activeVideoUrl) {
        const curTime = videoRef.current?.currentTime || currentTime || 0.1;
        bg = await captureVideoFrameAtTime(
          activeVideoUrl,
          curTime,
          activePlayingSegment?.cropOffsetYRatio ?? 0.2
        );
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
        seg.cropOffsetYRatio ?? 0.2
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

      setThumbnailUrl(artCanvas.toDataURL('image/jpeg', 0.95));
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
        <div className="toss-nav-left">
          <div className="toss-logo-badge">
            <ReportistLogo size={18} inverted />
          </div>
          <span className="toss-nav-title">{dict.common.brandName}</span>
          <span className="toss-tag-blue">{dict.common.taglineBadge}</span>

          {/* 상단 네비게이션 탭 (스튜디오 / 영상 공유 커뮤니티) */}
          <div className="toss-nav-tabs-group">
            <button
              type="button"
              className={`toss-nav-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
              onClick={() => setActiveTab('studio')}
              title={dict.community?.studioTab || '스튜디오'}
            >
              <Film size={14} />
              <span>{dict.community?.studioTab || '스튜디오'}</span>
            </button>
            <button
              type="button"
              className={`toss-nav-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
              onClick={() => setActiveTab('community')}
              title={dict.community?.communityTab || '영상 공유'}
            >
              <Share2 size={14} />
              <span>{dict.community?.communityTab || '영상 공유'}</span>
            </button>
          </div>
        </div>

        <div className="toss-nav-right">
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

          {/* 메인 액션 버튼 */}
          {videos.length > 0 && (
            !result?.url ? (
              <button
                type="button"
                className={`toss-nav-cta-btn ${isProcessing ? 'loading' : ''}`}
                onClick={() =>
                  onStartAiAnalysis(effectiveOverlayOptions, customAudioFile, selectedBgmId, bgmVolume)
                }
                disabled={isProcessing}
              >
                <Sparkles size={14} className={isProcessing ? 'animate-spin' : ''} />
                <span>{isProcessing ? dict.header.analyzingAi : dict.header.startAiHighlight}</span>
              </button>
            ) : (
              <div className="toss-nav-dual-actions">
                <button
                  type="button"
                  className="toss-nav-btn-secondary toss-nav-secondary-action"
                  onClick={() =>
                    onReStitch(
                      segments,
                      selectedBgmId,
                      bgmVolume,
                      customAudioFile,
                      effectiveOverlayOptions
                    )
                  }
                  disabled={isReStitching || segments.length === 0}
                  title={dict.header.reStitchTitle}
                >
                  <Scissors size={13} className={isReStitching ? 'animate-spin' : ''} />
                  <span>
                    {isReStitching
                      ? `${dict.header.stitching} (${reStitchProgress?.progressPercent ?? 0}%)`
                      : dict.header.reStitch}
                  </span>
                </button>
              </div>
            )
          )}

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
      </header>

      {/* 2. 본문: 영상 공유 커뮤니티 또는 스튜디오 2열 레이아웃 */}
      {activeTab === 'community' ? (
        <VideoCommunityView onOpenStudio={() => setActiveTab('studio')} />
      ) : (
        <main className="toss-main-content">
        {/* 2-A. 왼쪽 열: 16:9 모니터 & 배경음악 업로드 */}
        <section className="toss-column-left">
          <div className="toss-card toss-player-card">
            {/* 영상 상단 왼쪽, 오른쪽 문구 직관 입력창 */}
            <div className="toss-video-header-bar">
              <div className="toss-header-input-wrap">
                <label className="toss-header-input-label">
                  <Type size={12} className="text-blue-500" />
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
                  <Type size={12} className="text-blue-500" />
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
            </div>

            <div className={`toss-player-wrapper ${activeVideoUrl ? 'has-video' : 'is-empty'}`}>
              {activeVideoUrl ? (
                <>
                  <video
                    key={activeVideoUrl}
                    ref={videoRef}
                    src={activeVideoUrl}
                    playsInline
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => {
                      const cur = e.currentTarget.currentTime;
                      const nativeDur = e.currentTarget.duration;
                      const effectiveMaxDur =
                        Number.isFinite(nativeDur) && nativeDur > 0
                          ? Math.max(totalDuration, nativeDur)
                          : totalDuration;
                      if (result?.url && effectiveMaxDur > 0 && cur >= effectiveMaxDur) {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = effectiveMaxDur;
                        setCurrentTime(Math.min(cur, totalDuration));
                        setIsPlaying(false);
                        return;
                      }
                      setCurrentTime(Math.min(cur, totalDuration));
                    }}
                    onEnded={() => {
                      setIsPlaying(false);
                      setCurrentTime(0);
                    }}
                    onLoadedData={() => {
                      if (!thumbnailBgCanvasRef.current && videoRef.current) {
                        const bg = captureVideoFrameFromElement(
                          videoRef.current,
                          activePlayingSegment?.cropOffsetYRatio ?? 0.2
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
                          }
                        }
                      }
                    }}
                    onClick={togglePlay}
                    className="toss-video-element"
                  />
                  {!isPlaying && (
                    <button
                      type="button"
                      className="toss-canvas-play-overlay"
                      onClick={togglePlay}
                      title={dict.player.play}
                    >
                      <Play size={28} className="ml-1 text-white" />
                    </button>
                  )}

                  {!result?.url &&
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

                  {!result?.url && overlayOptions.showChannel && overlayOptions.channelText && (
                    <div className="toss-live-overlay-channel">
                      {overlayOptions.channelText}
                    </div>
                  )}

                  {!result?.url && overlayOptions.showSubtitle && activePlayingSubtitleText && (
                    <div className="toss-live-overlay-subtitle">
                      {activePlayingSubtitleText}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="toss-player-empty"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="toss-empty-circle-icon">
                    <Upload size={28} className="text-blue-500" />
                  </div>
                  <h3 className="toss-empty-title">{dict.player.emptyTitle}</h3>
                  <p className="toss-empty-desc">
                    {dict.player.emptyDesc.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i === 0 && <br />}
                      </React.Fragment>
                    ))}
                  </p>
                  <button type="button" className="toss-btn-secondary mt-3">
                    <Plus size={15} />
                    <span>{dict.player.selectVideoFiles}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 비디오 재생 트랜스포트 바 */}
            {activeVideoUrl && (
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
                    title={isPlaying ? dict.player.pause : dict.player.play}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
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
                  className="toss-progress-track"
                  onClick={handleSeekByPosition}
                  title={dict.player.seekTooltip}
                >
                  <div
                    className="toss-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
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
                </div>
              </div>
            )}

            {/* 시퀀스 타임라인 스트립 */}
            {segments.length > 0 && (
              <div className="toss-timeline-sequencer-box">
                <div className="toss-sequencer-header">
                  <div className="flex items-center gap-1.5">
                    <Film size={14} className="text-blue-600" />
                    <span className="toss-sequencer-title">{dict.sequencer.title}</span>
                    <span className="toss-sequencer-badge">
                      {interpolate(dict.sequencer.clipsCount, { count: segments.length })}
                    </span>
                  </div>
                  <span className="toss-sequencer-hint">{dict.sequencer.hint}</span>
                </div>

                <div
                  className="toss-sequencer-track"
                  onClick={handleSeekByPosition}
                  title={dict.player.seekTooltip}
                >
                  <div
                    className="toss-sequencer-playhead"
                    style={{
                      left: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                    }}
                  >
                    <div className="toss-playhead-cap" />
                    <div className="toss-playhead-line" />
                  </div>

                  <div className="toss-sequencer-strip">
                    {/* 시작 인트로 블록 (인트로가 포함된 경우) */}
                    {introDuration > 0 && (
                      <div
                        className={`toss-sequencer-block toss-sequencer-intro-block ${activePlayingSegmentId === 'intro' ? 'playing' : ''} ${selectedSegmentId === 'intro' ? 'selected' : ''}`}
                        style={{ width: `${(introDuration / (totalDuration || 1)) * 100}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
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
                      const isCurrent = seg.id === activePlayingSegmentId;
                      const isSelected = seg.id === selectedSegmentId;
                      const bridgeDur = effectiveBridgeDurationMap[seg.id] ?? 0;
                      const bridgeWidthPct = (bridgeDur / (totalDuration || 1)) * 100;
                      const widthPct = (seg.duration / (totalDuration || 1)) * 100;
                      const vItem = videoMap.get(seg.sourceVideoId);
                      return (
                        <React.Fragment key={seg.id}>
                          {bridgeDur > 0 && (
                            <div
                              className={`toss-sequencer-block toss-sequencer-intro-block ${isCurrent ? 'playing' : ''}`}
                              style={{
                                width: `${bridgeWidthPct}%`,
                                minWidth: '14px',
                                background: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const offset = segmentTimelineOffsets[seg.id];
                                if (offset && videoRef.current && result?.url) {
                                  videoRef.current.currentTime = offset.bridgeStartOffset + 0.05;
                                  setCurrentTime(offset.bridgeStartOffset + 0.05);
                                  setSelectedSegmentId(seg.id);
                                } else {
                                  handleSelectSegment(seg.id);
                                }
                              }}
                              title={`챕터 브릿지 → #${idx + 1} (${bridgeDur.toFixed(1)}s)`}
                            >
                              <div className="toss-sequencer-block-overlay">
                                <span className="toss-block-idx">✦</span>
                              </div>
                            </div>
                          )}
                          <div
                            className={`toss-sequencer-block ${isSelected ? 'selected' : ''} ${isCurrent ? 'playing' : ''}`}
                            style={{ width: `${widthPct}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSegment(seg.id);
                            }}
                            title={interpolate(dict.sequencer.clipTitle, {
                              idx: idx + 1,
                              duration: seg.duration.toFixed(1),
                              reason: seg.reason,
                            })}
                          >
                            {vItem?.thumbnailUrl && (
                              <img
                                src={vItem.thumbnailUrl}
                                alt=""
                                className="toss-sequencer-block-thumb"
                              />
                            )}
                            <div className="toss-sequencer-block-overlay">
                              <span className="toss-block-idx">#{idx + 1}</span>
                              <span className="toss-block-dur">{seg.duration.toFixed(1)}s</span>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* 종료 아웃트로 블록 (아웃트로가 포함된 경우) */}
                    {outroDuration > 0 && (
                      <div
                        className={`toss-sequencer-block toss-sequencer-outro-block ${activePlayingSegmentId === 'outro' ? 'playing' : ''} ${selectedSegmentId === 'outro' ? 'selected' : ''}`}
                        style={{ width: `${(outroDuration / (totalDuration || 1)) * 100}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
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
                </div>
              </div>
            )}

            {/* 완성 영상 다운로드 및 유튜브 호환 자막 다운로드 */}
            {Boolean(result?.url) && (
              <div className="toss-timeline-actions">
                <button
                  type="button"
                  className="toss-btn-download-video"
                  onClick={handleDownload}
                  title={dict.header.downloadTitle}
                >
                  <Download size={15} />
                  <span>{dict.header.download} ({formatSec(totalDuration)})</span>
                </button>

                <button
                  type="button"
                  className="toss-btn-download-subtitle"
                  onClick={() => setIsSubtitleModalOpen(true)}
                  title={dict.subtitleDownload?.buttonTitle || '유튜브 호환 자막 (.srt) 다운로드'}
                >
                  <Subtitles size={15} />
                  <span>{dict.subtitleDownload?.buttonText || '자막 다운로드 (.srt)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 배경음악 카드 */}
          <div className="toss-card toss-bgm-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Music size={15} className="text-blue-600 shrink-0" />
                  <span>{dict.bgm.title}</span>
                </h4>
                <p className="toss-card-desc">
                  {dict.bgm.desc}
                </p>
              </div>

              <div className="toss-bgm-header-actions">
                {customAudioFile && (
                  <div className="toss-bgm-volume-control">
                    <span className="text-xs font-semibold text-slate-500">{dict.bgm.volume}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={bgmVolume}
                      onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                      className="toss-slider"
                    />
                    <span className="text-xs font-mono font-bold text-blue-600 w-8 text-right">
                      {Math.round(bgmVolume * 100)}%
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="toss-btn-audio-library"
                  onClick={() => setIsAudioLibraryOpen(true)}
                >
                  <ListMusic size={13} />
                  <span>{dict.audioLibrary.openButton}</span>
                </button>
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
              <div className="toss-bgm-uploaded-box">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="toss-audio-icon-box">
                    <FileAudio size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {customAudioName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {selectedLibraryTrackId ? dict.audioLibrary.fromLibrary : dict.bgm.myAudioFile} ({((customAudioFile.size || 0) / (1024 * 1024)).toFixed(1)}MB) • {dict.bgm.applied}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    onClick={() => customAudioInputRef.current?.click()}
                  >
                    {dict.bgm.changeFile}
                  </button>
                  <button
                    type="button"
                    className="toss-btn-delete-sm"
                    onClick={() => {
                      setCustomAudioFile(null);
                      setCustomAudioName('');
                      setSelectedBgmId('none');
                      setSelectedLibraryTrackId(null);
                    }}
                    title={dict.bgm.deleteBgm}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="toss-upload-box toss-audio-upload-box"
                onClick={() => customAudioInputRef.current?.click()}
              >
                <FileAudio size={22} className="text-blue-500 mb-1" />
                <span className="text-xs font-bold text-slate-800">
                  {dict.bgm.uploadButton}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {dict.bgm.uploadHint}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* 2-B. 오른쪽 열: [썸네일(완성시)] -> [인트로] -> [AI 극적 순간] -> [아웃트로] -> [요약] */}
        <section className="toss-column-right">
          {/* AI 맞춤 16:9 썸네일 카드 */}
          {(result || thumbnailUrl) && (
            <div className="toss-card toss-thumbnail-card">
              <div className="toss-card-header">
                <div>
                  <h4 className="toss-card-title">
                    <ImageIcon size={16} className="text-blue-600 shrink-0" />
                    <span>{dict.thumbnail?.cardTitle || 'AI 맞춤 썸네일 (16:9)'}</span>
                  </h4>
                  <p className="toss-card-desc">
                    {dict.thumbnail?.cardDesc ||
                      'AI가 감지한 가장 매력적인 순간과 추천 타이틀로 완성된 유튜브 맞춤 썸네일이에요.'}
                  </p>
                </div>
                <span className="toss-tag-blue">
                  {dict.thumbnail?.previewBadge || '16:9 유튜브 규격'}
                </span>
              </div>

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
                    <ImageIcon size={32} className="text-blue-500 mb-2 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-600 mb-2">
                      {isUpdatingThumbnail ? '썸네일 생성 중...' : '썸네일 이미지를 불러오는 중이에요'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureCurrentFrame}
                      disabled={isUpdatingThumbnail}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                    >
                      현재 비디오 화면으로 썸네일 생성
                    </button>
                  </div>
                )}
              </div>

              {/* 썸네일 타이틀 및 스타일 컨트롤 */}
              <div className="toss-thumbnail-controls">
                <div className="toss-thumbnail-input-group">
                  <div className="toss-thumbnail-label-row">
                    <label className="toss-thumbnail-label">
                      <Type size={13} className="text-blue-600" />
                      <span>{dict.thumbnail?.titleInputLabel || '썸네일 & 영상 타이틀'}</span>
                    </label>
                    {result?.suggestedTitle && overlayOptions.titleText === result.suggestedTitle && (
                      <span className="toss-thumbnail-ai-tag">
                        {dict.thumbnail?.aiTitleBadge || 'AI 추천 타이틀'}
                      </span>
                    )}
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

                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-semibold text-slate-500">스타일 프리셋</span>
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

                <div className="toss-thumbnail-actions">
                  <button
                    type="button"
                    className="toss-btn-download-thumb"
                    onClick={handleDownloadThumbnail}
                    title={dict.thumbnail?.downloadHd || '썸네일 다운로드 (1280x720 HD)'}
                  >
                    <Download size={15} />
                    <span>{dict.thumbnail?.downloadHd || '썸네일 다운로드 (1280x720 HD)'}</span>
                  </button>

                  {activeVideoUrl && (
                    <button
                      type="button"
                      className="toss-btn-frame-capture"
                      onClick={handleCaptureCurrentFrame}
                      disabled={isUpdatingThumbnail}
                      title="현재 영상 재생 위치의 프레임으로 썸네일 배경 변경"
                    >
                      <ImageIcon size={13} className="text-blue-600" />
                      <span>{isUpdatingThumbnail ? '캡처 중...' : '현재 프레임 적용'}</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 text-center">
                  {dict.thumbnail?.selectFrameHint ||
                    '아래 하이라이트 장면의 [썸네일] 버튼을 눌러 배경 이미지를 바꿀 수도 있어요.'}
                </p>
              </div>
            </div>
          )}

          {/* 시작 인트로 카드 */}
          <div className="toss-card toss-intro-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Film size={15} className="text-blue-600 shrink-0" />
                  <span>{dict.introOutro.introTitle}</span>
                </h4>
                <p className="toss-card-desc">{dict.introOutro.introDesc}</p>
              </div>
              <label className="toss-toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayOptions.showIntro}
                  onChange={(e) =>
                    setOverlayOptions((prev) => ({ ...prev, showIntro: e.target.checked }))
                  }
                />
                <span className="toss-toggle-slider" />
              </label>
            </div>

            {overlayOptions.showIntro && (
              <div className="toss-intro-content mt-2">
                <input
                  ref={introVideoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={handleIntroVideoSelected}
                />
                {overlayOptions.introVideoFile ? (
                  <div className="toss-clip-file-chip">
                    <Film size={14} className="text-blue-600 flex-shrink-0" />
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {overlayOptions.introVideoFile.name}
                    </span>
                    <button
                      type="button"
                      className="toss-btn-delete-sm ml-auto"
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
                    className="toss-btn-custom-audio w-full"
                    onClick={() => introVideoInputRef.current?.click()}
                  >
                    <Plus size={14} />
                    <span>{dict.introOutro.uploadIntro}</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 block mt-1.5">
                  {overlayOptions.introVideoFile
                    ? dict.introOutro.introApplied
                    : dict.introOutro.introDefault}
                </span>
              </div>
            )}
          </div>

          {/* AI가 포착한 극적 순간 카드 */}
          <div className="toss-card toss-dramatic-card">
            <div className="toss-card-header toss-dramatic-header">
              <div className="toss-dramatic-header-title">
                <h4 className="toss-card-title">
                  <Scissors size={15} className="text-blue-600 shrink-0" />
                  <span>{dict.dramaticClips.title}</span>
                </h4>
                <p className="toss-card-desc">
                  {dict.dramaticClips.desc}
                </p>
              </div>

              <div className="toss-dramatic-header-actions flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {segments.length > 0 && (
                    <span className="toss-tag-gray">
                      {interpolate(dict.dramaticClips.totalIntervals, {
                        count: segments.length,
                        duration: totalDuration.toFixed(1),
                      })}
                    </span>
                  )}
                  {segments.length > 0 && (
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
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                  <label
                    className="toss-toggle-label flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600"
                    title="날짜·장소·원본 영상이 바뀌는 구간 사이에 시네마틱 챕터 브릿지 카드를 삽입합니다"
                  >
                    <span>챕터 브릿지</span>
                    <span className="toss-toggle-switch">
                      <input
                        type="checkbox"
                        checked={overlayOptions.showChapterBridge !== false}
                        onChange={(e) =>
                          setOverlayOptions((prev) => ({ ...prev, showChapterBridge: e.target.checked }))
                        }
                      />
                      <span className="toss-toggle-slider" />
                    </span>
                  </label>
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
                </div>
              </div>
            </div>

            {segments.length === 0 ? (
              <div className="toss-empty-state">
                <p className="text-slate-400 text-sm">
                  {dict.dramaticClips.emptyNotice}
                </p>
              </div>
            ) : (
              <div className="toss-segment-list">
                {segments.map((seg, idx) => {
                  const isSelected = seg.id === selectedSegmentId;
                  const isCurrentPlaying = seg.id === activePlayingSegmentId;
                  const vItem = videoMap.get(seg.sourceVideoId);
                  const bridgeEval = idx > 0
                    ? evaluateChapterBridge(segments[idx - 1], seg, idx, segments.length, overlayOptions)
                    : null;
                  return (
                    <React.Fragment key={seg.id}>
                      {bridgeEval?.shouldBridge && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-dashed border-blue-200 text-[11px] text-slate-600">
                          <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] tracking-wider">
                            {bridgeEval.isDateChanged
                              ? 'TIMELINE JUMP'
                              : bridgeEval.isLocationChanged
                              ? 'LOCATION SHIFT'
                              : `CHAPTER ${String(bridgeEval.chapterIndex).padStart(2, '0')}`}
                          </span>
                          <span className="font-medium text-slate-700 truncate">
                            {[bridgeEval.toDate, bridgeEval.toLocation].filter(Boolean).join(' • ') || bridgeEval.sceneTitle}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-blue-600 font-semibold shrink-0">
                            +1.2s 브릿지
                          </span>
                        </div>
                      )}
                      <div
                        className={`toss-segment-item ${isSelected ? 'active' : ''} ${isCurrentPlaying ? 'playing' : ''}`}
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
                          {vItem?.thumbnailUrl && (
                            <img
                              src={vItem.thumbnailUrl}
                              alt=""
                              className="toss-segment-thumb"
                            />
                          )}
                          <div className="toss-segment-info">
                            <div className="toss-segment-title-row">
                              <span className="toss-segment-number">#{idx + 1}</span>
                              <span className="toss-segment-reason truncate">
                                {seg.reason}
                              </span>
                            </div>
                            <span className="toss-segment-source truncate">
                              {seg.sourceVideoName}
                            </span>
                          </div>
                        </div>

                        {/* 트리밍 버튼 및 길이 */}
                        <div className="toss-segment-right">
                          <div className="toss-trim-controls">
                            <button
                              type="button"
                              className="toss-btn-micro"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrimChange(seg.id, 'start', -0.5);
                              }}
                              title={dict.dramaticClips.trimMinus}
                            >
                              -0.5s
                            </button>
                            <span className="toss-segment-duration">
                              {seg.duration.toFixed(1)}s
                            </span>
                            <button
                              type="button"
                              className="toss-btn-micro"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrimChange(seg.id, 'end', 0.5);
                              }}
                              title={dict.dramaticClips.trimPlus}
                            >
                              +0.5s
                            </button>
                          </div>

                          <button
                            type="button"
                            className="toss-clip-thumb-btn"
                            onClick={(e) => handleSetSegmentAsThumbnail(seg, e)}
                            title="이 장면으로 썸네일 배경 설정"
                          >
                            <ImageIcon size={11} />
                            <span>썸네일</span>
                          </button>

                          <button
                            type="button"
                            className="toss-btn-delete"
                            onClick={(e) => handleDeleteSegment(seg.id, e)}
                            title={dict.dramaticClips.excludeInterval}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* 선택한 씬의 자막/날짜/위치/구도 수정 */}
                      {isSelected && (
                        <div className="toss-segment-editor" onClick={(e) => e.stopPropagation()}>
                          <div className="toss-segment-editor-head">
                            <span className="toss-segment-editor-title">{dict.dramaticClips.editorTitle}</span>
                            <span className="toss-segment-editor-hint">{dict.dramaticClips.editorHint}</span>
                          </div>

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

                          {/* 3. 16:9 세로 영상 인물 크롭 기준 */}
                          <div className="toss-branding-row">
                            <div className="flex items-center justify-between mb-1">
                              <span className="toss-branding-label">{dict.dramaticClips.cropLabel}</span>
                              <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
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
          <div className="toss-card toss-outro-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Film size={15} className="text-blue-600 shrink-0" />
                  <span>{dict.introOutro.outroTitle}</span>
                </h4>
                <p className="toss-card-desc">{dict.introOutro.outroDesc}</p>
              </div>
              <label className="toss-toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayOptions.showOutro}
                  onChange={(e) =>
                    setOverlayOptions((prev) => ({ ...prev, showOutro: e.target.checked }))
                  }
                />
                <span className="toss-toggle-slider" />
              </label>
            </div>

            {overlayOptions.showOutro && (
              <div className="toss-outro-content mt-2">
                <input
                  ref={outroVideoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={handleOutroVideoSelected}
                />
                {overlayOptions.outroVideoFile ? (
                  <div className="toss-clip-file-chip">
                    <Film size={14} className="text-blue-600 flex-shrink-0" />
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {overlayOptions.outroVideoFile.name}
                    </span>
                    <button
                      type="button"
                      className="toss-btn-delete-sm ml-auto"
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
                    className="toss-btn-custom-audio w-full"
                    onClick={() => outroVideoInputRef.current?.click()}
                  >
                    <Plus size={14} />
                    <span>{dict.introOutro.uploadOutro}</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 block mt-1.5">
                  {overlayOptions.outroVideoFile
                    ? dict.introOutro.outroApplied
                    : dict.introOutro.outroDefault}
                </span>
              </div>
            )}
          </div>

          {/* 시간 절약 효과 요약 카드 */}
          {originalTotalDuration > 0 && segments.length > 0 && (
            <div className="toss-summary-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">{dict.summaryCard.timeSavedRate}</span>
                <span className="text-sm font-bold text-emerald-600">
                  {interpolate(dict.summaryCard.reducedBy, { percent: savedPercent })}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-400">
                  {interpolate(dict.summaryCard.originalVideo, { duration: originalTotalDuration.toFixed(1) })}
                </span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {interpolate(dict.summaryCard.highlightVideo, { duration: totalDuration.toFixed(1) })}
                </span>
              </div>
            </div>
          )}
        </section>
      </main>
      )}

      {/* AI 분석 진행 중 토스식 모달 */}
      {isProcessing && (
        <div className="toss-modal-overlay">
          <div className="toss-modal-card">
            {/* 상단 비디오 썸네일 또는 기본 아이콘 */}
            <div className={currentVideoThumbnail ? 'toss-modal-thumb-box' : 'toss-modal-icon-circle'}>
              {currentVideoThumbnail ? (
                <img
                  src={currentVideoThumbnail}
                  alt={currentProcessingVideo?.name || '영상 썸네일'}
                  className="w-full h-full object-cover"
                />
              ) : progress.currentPhase === 'stitch' ? (
                <Scissors size={24} className="text-blue-500 animate-pulse" />
              ) : (
                <Sparkles size={24} className="text-blue-500 animate-pulse" />
              )}
            </div>

            <h3 className="toss-modal-title">
              {progress.currentPhase === 'stitch'
                ? (dict.processingModal.titleStitching || '하이라이트 영상을 병합하고 있어요')
                : dict.processingModal.title}
            </h3>
            <p className="toss-modal-desc">
              {progress.statusMessage || dict.processingModal.defaultDesc}
            </p>

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
                  ? `${dict.processingModal.stitchProgressLabel || '병합 진행률'} (전체 ${progress.progressPercent}%)`
                  : dict.processingModal.youtubeSpec}
              </span>
              <span className="font-bold text-blue-600">
                {progress.currentPhase === 'stitch' && progress.stitchProgressPercent !== undefined
                  ? `${progress.stitchProgressPercent}%`
                  : `${progress.progressPercent}%`}
              </span>
            </div>

            {/* 최근 작업/추론 2줄 안내 박스 (2줄 고정 높이, 넘치면 ...) */}
            <div className="toss-modal-reasoning-wrap mt-4 text-left">
              <span className="toss-reasoning-live-dot mr-2.5 flex-shrink-0" />
              <div className="flex-1 min-w-0 toss-modal-reasoning-text">
                <span>{latestTask.text}</span>
                {latestTask.isStreaming && <span className="toss-live-caret" />}
              </div>
            </div>

            {/* 취소 버튼 */}
            <button
              type="button"
              className="toss-btn-text text-slate-400 mt-4 mx-auto block hover:text-slate-600"
              onClick={onCancelProcessing}
            >
              {dict.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* 4-B. 타임라인 재병합 진행 모달 */}
      {isReStitching && (
        <div className="toss-modal-overlay toss-restitch-modal-overlay">
          <div className="toss-modal-card">
            <div className="toss-modal-icon-circle">
              <Scissors size={24} className="text-blue-500 animate-pulse" />
            </div>

            <h3 className="toss-modal-title">
              {dict.processingModal.reStitchModalTitle || '수정된 타임라인으로 영상을 병합하고 있어요'}
            </h3>
            <p className="toss-modal-desc">
              {reStitchProgress?.statusMessage ||
                dict.processingModal.reStitchModalDesc ||
                '고화질 프레임과 자막, 오디오를 싱크에 맞춰 재합성 중입니다.'}
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
              <span className="font-bold text-blue-600 text-sm">
                {reStitchProgress?.progressPercent ?? 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. 씬 촬영 위치 지도 확인 모달 */}
      {mapModalTarget && (
        <div className="toss-modal-overlay" onClick={() => setMapModalTarget(null)}>
          <div className="toss-modal-card toss-map-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 text-left">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {dict.mapModal.title}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {mapModalTarget.locationName || mapModalTarget.subtitleTitle || mapModalTarget.reason}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="toss-btn-icon"
                onClick={() => setMapModalTarget(null)}
                title={dict.common.close}
              >
                <X size={16} />
              </button>
            </div>

            {/* 임베디드 오픈스트리트맵 지도 */}
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

            <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
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
                className="toss-btn-secondary"
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
                className="toss-btn-secondary"
              >
                <ExternalLink size={13} />
                <span>{dict.mapModal.viewGoogleMap}</span>
              </a>
              <button
                type="button"
                className="toss-btn-primary"
                onClick={() => setMapModalTarget(null)}
              >
                {dict.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. AI 모델 선택 모달 */}
      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        models={models}
        selectedModelId={selectedModel}
        onSelectModel={onSelectModel}
      />

      {/* 7. 올린 원본 영상 목록 모달 */}
      <VideoListModal
        isOpen={isVideoListModalOpen}
        onClose={() => setIsVideoListModalOpen(false)}
        videos={videos}
        onRemoveVideo={onRemoveVideo}
        onAddFilesClick={() => {
          setIsVideoListModalOpen(false);
          fileInputRef.current?.click();
        }}
      />

      {/* 8. 다국어 언어 선택 모달 (ModelSelectorModal과 동일한 팝업 UI) */}
      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
      />

      {/* 9. 오디오 보관함 모달 */}
      <AudioLibraryModal
        isOpen={isAudioLibraryOpen}
        onClose={() => setIsAudioLibraryOpen(false)}
        selectedTrackId={selectedLibraryTrackId}
        hasAppliedAudio={Boolean(customAudioFile)}
        onApply={handleApplyLibraryAudio}
      />

      {/* 10. 스튜디오 설정 모달 (AI 모델, 언어, 날짜 표기, 아이 나이, 초기화 등) */}
      <MobileSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onOpenLanguageModal={() => setIsLanguageModalOpen(true)}
        onOpenDateFormatModal={() => setIsDateFormatModalOpen(true)}
        currentDateFormat={currentDateFormat}
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
        onToggleShowChapterBridge={(val) =>
          setOverlayOptions((prev) => ({ ...prev, showChapterBridge: val }))
        }
        currentModel={currentModel || undefined}
        isLoadingModels={isLoadingModels}
        currentLocaleInfo={currentLocaleInfo}
        hasVideos={videos.length > 0}
        onReset={onReset}
        hasStitchedResult={Boolean(result?.url)}
        onDownloadThumbnail={handleDownloadThumbnail}
        onDownloadSubtitles={() => {
          setIsSettingsModalOpen(false);
          setIsSubtitleModalOpen(true);
        }}
        onReStitch={() => {
          setIsSettingsModalOpen(false);
          onReStitch(
            segments,
            selectedBgmId,
            bgmVolume,
            customAudioFile,
            effectiveOverlayOptions
          );
        }}
        isReStitching={isReStitching}
        reStitchProgress={reStitchProgress}
      />

      {/* 11. 촬영 날짜 포맷 선택 모달 */}
      <DateFormatSelectorModal
        isOpen={isDateFormatModalOpen}
        onClose={() => setIsDateFormatModalOpen(false)}
        currentFormat={currentDateFormat}
        onSelectFormat={handleSelectDateFormat}
        referenceDate={videos[0]?.recordedTimestamp ? new Date(videos[0].recordedTimestamp) : undefined}
      />

      {/* 12. 유튜브 호환 다국어 자막 다운로드 모달 */}
      <SubtitleDownloadModal
        isOpen={isSubtitleModalOpen}
        onClose={() => setIsSubtitleModalOpen(false)}
        segments={segments}
        introDuration={introDuration}
        bridgeDurationMap={effectiveBridgeDurationMap}
        videoTitle={overlayOptions.titleText || result?.suggestedTitle || 'highlight'}
      />
    </div>
  );
};
