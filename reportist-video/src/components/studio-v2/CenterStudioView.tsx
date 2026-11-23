import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cleanModelName, getSpeedTier } from '../../services/modelMetrics.ts';
import {
  getProviderPreset,
  getStoredUserApiKeyConfig,
  isByokActive,
} from '../../services/userApiKeyService.ts';
import { previewFrame } from '../../services/frameSpec.ts';
import {
  getStoredAutoSortByRecordedTime,
  getStoredDateFormat,
  setStoredDateFormat,
  sortSegmentsByRecordedTime,
  type DateFormatOption,
} from '../../services/videoMetadata.ts';
import { getStoredHighlightMode } from '../../services/highlightModeStorage.ts';
import { loadLibraryAudioFile, type AudioLibraryTrack } from '../../data/audioLibrary.ts';
import type {
  ExportResolution,
  HighlightMode,
  HighlightSegment,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { DesktopOnlyGate } from './DesktopOnlyGate.tsx';
import { StudioTopBar, type StudioModelDisplay } from './StudioTopBar.tsx';
import { UploadQueueDock } from './UploadQueueDock.tsx';
import { CenterPreviewStage } from './CenterPreviewStage.tsx';
import { TimelineDock } from './TimelineDock.tsx';
import { RightInspectorDrawer } from './RightInspectorDrawer.tsx';
import {
  collapseFlightCard,
  flyCutsIn,
  flyCutsOut,
  type FlightHandle,
} from './cutFlightAnimator.ts';
import { buildTimeline } from './timelineModel.ts';
import {
  createDefaultOverlayOptions,
  type InspectorTarget,
  type PreviewRange,
  type PreviewRequest,
  type StudioV2Props,
} from './types.ts';
import './studioV2.css';

// 무거운 모달은 지연 로드
const SegmentTrimModal = lazy(() =>
  import('../studio/SegmentTrimModal.tsx').then((m) => ({ default: m.SegmentTrimModal }))
);
const VideoExportModal = lazy(() =>
  import('../studio/VideoExportModal.tsx').then((m) => ({ default: m.VideoExportModal }))
);
const ModelSelectorModal = lazy(() =>
  import('../studio/ModelSelectorModal.tsx').then((m) => ({ default: m.ModelSelectorModal }))
);
const LanguageSelectorModal = lazy(() =>
  import('../studio/LanguageSelectorModal.tsx').then((m) => ({ default: m.LanguageSelectorModal }))
);
const StudioV2SettingsModal = lazy(() =>
  import('./StudioV2SettingsModal.tsx').then((m) => ({ default: m.StudioV2SettingsModal }))
);
const DateFormatSelectorModal = lazy(() =>
  import('../studio/DateFormatSelectorModal.tsx').then((m) => ({ default: m.DateFormatSelectorModal }))
);
const SubtitleDownloadModal = lazy(() =>
  import('../studio/SubtitleDownloadModal.tsx').then((m) => ({ default: m.SubtitleDownloadModal }))
);
const FeedbackModal = lazy(() =>
  import('../feedback/FeedbackModal.tsx').then((m) => ({ default: m.FeedbackModal }))
);
const PatchNotesModal = lazy(() =>
  import('../patch/PatchNotesModal.tsx').then((m) => ({ default: m.PatchNotesModal }))
);

/**
 * CenterStudioView — PC 전용 "미리보기 중심" 스튜디오 V2 최상위 셸.
 * App의 상태/핸들러를 그대로 재사용하고, UI 레이아웃·상태 전이만 새로 구현한다.
 */
export const CenterStudioView = (props: StudioV2Props) => {
  const { ui } = useI18n();
  const {
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
    isPreparingVideos,
    progress,
    onCancelProcessing,
    onReStitch,
    isReStitching,
    reStitchProgress,

    initialOverlayOptions,
    initialBgmPresetId,
    initialBgmVolume,
    initialCustomAudioFile,
    initialSelectedLibraryTrackId,
    onOverlayOptionsChange,
    onBgmChange,
    onCustomAudioChange,
    orientation = 'landscape',
    portraitPlatform,
    onOrientationChange,
    onReset,
    onHighlightModeChange,
  } = props;

  // ---------- 뷰포트 가드 ----------
  const [isWide, setIsWide] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 960
  );
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---------- 세그먼트 (App의 finalResult / 분석 중 videos와 양방향 동기화) ----------
  const [localSegments, setLocalSegments] = useState<HighlightSegment[]>(
    () => result?.segments ?? []
  );
  const [landedVideos, setLandedVideos] = useState<Set<string>>(new Set());
  const [landingIds, setLandingIds] = useState<Set<string>>(new Set());
  const [subtitleRefreshed, setSubtitleRefreshed] = useState(false);
  // 원본 삭제 연출 중인 컷/영상. 컷은 타임라인에서 숨기고, 편집·내보내기는 잠근다.
  const [returningIds, setReturningIds] = useState<Set<string>>(new Set());
  const [removingVideoIds, setRemovingVideoIds] = useState<Set<string>>(new Set());

  // 비행 상태는 ref를 진실 원본으로 두어 거의 동시에 완료되는 여러 배치가 서로를 덮어쓰지 않게 한다.
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const landingIdsRef = useRef<Set<string>>(new Set());
  const dispatchedIdsRef = useRef<Set<string>>(
    new Set((result?.segments ?? []).map((s) => s.id))
  );
  const idToSourceRef = useRef<Map<string, string>>(new Map());
  const activeFlightsRef = useRef<Set<FlightHandle>>(new Set());
  const activeReturnFlightsRef = useRef<Set<FlightHandle>>(new Set());
  const prevSegmentsRef = useRef<HighlightSegment[]>(result?.segments ?? []);

  /** 새로 도착한 컷만 한 배치로 발사한다. 이미 발사한 id는 절대 중복 발사하지 않는다. */
  const launchFlights = useCallback((incoming: HighlightSegment[]) => {
    const fresh = incoming.filter((s) => !dispatchedIdsRef.current.has(s.id));
    if (fresh.length === 0) return;

    fresh.forEach((seg) => {
      dispatchedIdsRef.current.add(seg.id);
      landingIdsRef.current.add(seg.id);
      idToSourceRef.current.set(seg.id, seg.sourceVideoId);
    });
    setLandingIds(new Set(landingIdsRef.current));

    let cancelled = false;
    // 칩이 DOM에 마운트된 뒤 출발/도착 좌표를 잡고 '탁탁탁' 비행을 시작한다.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelled) return;
        const currentVideos = videosRef.current;
        const items = fresh.map((seg) => {
          const card = document.querySelector(`[data-cut-card-id="${seg.sourceVideoId}"]`);
          const rect = card?.getBoundingClientRect();
          const slot = document.querySelector(
            `[data-cut-slot-id="${seg.id}"]`
          ) as HTMLElement | null;
          return {
            id: seg.id,
            thumbnailUrl: currentVideos.find((v) => v.id === seg.sourceVideoId)?.thumbnailUrl,
            from: rect
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : { x: 140, y: window.innerHeight / 2 },
            toEl: slot,
          };
        });

        let handle: FlightHandle | null = null;
        handle = flyCutsIn(items, {
          onLand: (id) => {
            landingIdsRef.current.delete(id);
            idToSourceRef.current.delete(id);
            setLandingIds(new Set(landingIdsRef.current));
            const landed = fresh.find((s) => s.id === id);
            if (!landed) return;
            // 같은 영상의 남은 컷이 아직 날아가는 중이면 카드를 유지한다(출발점 소실 방지).
            const stillFlying = Array.from(landingIdsRef.current).some(
              (flyingId) => idToSourceRef.current.get(flyingId) === landed.sourceVideoId
            );
            if (!stillFlying) {
              setLandedVideos((prev) => new Set(prev).add(landed.sourceVideoId));
            }
          },
          onComplete: () => {
            if (handle) activeFlightsRef.current.delete(handle);
          },
        });
        if (handle) activeFlightsRef.current.add(handle);
      })
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // 언마운트 시 남은 비행(착지/역비행)을 모두 정리한다.
  useEffect(() => {
    const flights = activeFlightsRef.current;
    const returns = activeReturnFlightsRef.current;
    return () => {
      flights.forEach((h) => h.cancel());
      flights.clear();
      returns.forEach((h) => h.cancel());
      returns.clear();
    };
  }, []);

  // 분석 중: 각 영상에 즉시 채워지는 segments를 실시간으로 합쳐 타임라인/프리뷰에 흘려보낸다.
  // 최종 result가 도착하면 동일한 id의 세그먼트라 다시 날아가지 않고 자막만 갱신된다.
  const streamingSegments = useMemo(() => {
    if (!isProcessing) return null;
    const base = result?.segments ?? [];
    const known = new Set(base.map((s) => s.id));
    const added: HighlightSegment[] = [];
    for (const video of videos) {
      for (const seg of video.segments ?? []) {
        if (!known.has(seg.id)) {
          known.add(seg.id);
          added.push(seg);
        }
      }
    }
    if (added.length === 0) return base;
    const raw = [...base, ...added];
    return getStoredAutoSortByRecordedTime()
      ? sortSegmentsByRecordedTime(raw, new Map(videos.map((v) => [v.id, v])))
      : raw;
  }, [isProcessing, result?.segments, videos]);

  const displaySegments = streamingSegments ?? localSegments;

  useEffect(() => {
    if (!isProcessing || !streamingSegments) return;
    launchFlights(streamingSegments);
  }, [isProcessing, streamingSegments, launchFlights]);

  useEffect(() => {
    const incoming = result?.segments ?? [];
    if (incoming.length === 0) {
      if (!isProcessing) {
        activeFlightsRef.current.forEach((h) => h.cancel());
        activeFlightsRef.current.clear();
        dispatchedIdsRef.current.clear();
        idToSourceRef.current.clear();
        landingIdsRef.current.clear();
        setLandingIds(new Set());
        setLandedVideos(new Set());
        prevSegmentsRef.current = [];
        setLocalSegments([]);
      }
      return;
    }
    // 자막 정제처럼 같은 컷의 텍스트만 바뀐 경우 타임라인에 은은한 갱신 연출을 준다.
    const subtitleChanged = incoming.some((seg) => {
      const prev = prevSegmentsRef.current.find((p) => p.id === seg.id);
      return prev && prev.subtitleTitle !== seg.subtitleTitle;
    });
    prevSegmentsRef.current = incoming;
    setLocalSegments(incoming);
    if (subtitleChanged) setSubtitleRefreshed(true);
    // 실시간 비행으로 이미 발사된 컷은 최종 result에서 다시 날아가지 않는다.
    launchFlights(incoming);
  }, [result?.segments, isProcessing, launchFlights]);

  useEffect(() => {
    if (!subtitleRefreshed) return;
    const timer = window.setTimeout(() => setSubtitleRefreshed(false), 650);
    return () => window.clearTimeout(timer);
  }, [subtitleRefreshed]);

  const commitSegments = useCallback(
    (next: HighlightSegment[]) => {
      if (result && !isProcessing) props.onUpdateFinalResult({ ...result, segments: next });
    },
    [result, isProcessing, props]
  );

  // 분석 중이거나 원본 삭제 연출 중에는 스트리밍/연출 상태와 충돌하지 않도록 편집을 막는다.
  const updateSegment = useCallback(
    (id: string, patch: Partial<HighlightSegment>) => {
      if (isProcessing || removingVideoIds.size > 0) return;
      const next = localSegments.map((s) => (s.id === id ? { ...s, ...patch } : s));
      setLocalSegments(next);
      commitSegments(next);
    },
    [isProcessing, removingVideoIds, localSegments, commitSegments]
  );

  const deleteSegment = useCallback(
    (id: string) => {
      if (isProcessing || removingVideoIds.size > 0) return;
      const next = localSegments.filter((s) => s.id !== id);
      setLocalSegments(next);
      commitSegments(next);
      setSelectedSegmentId((prev) => (prev === id ? null : prev));
    },
    [isProcessing, removingVideoIds, localSegments, commitSegments]
  );

  const reorderSegments = useCallback(
    (from: number, to: number) => {
      if (isProcessing || removingVideoIds.size > 0 || from === to) return;
      const next = [...localSegments];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      setLocalSegments(next);
      commitSegments(next);
    },
    [isProcessing, removingVideoIds, localSegments, commitSegments]
  );

  // ---------- 오버레이 옵션 ----------
  const [overlayOptions, setOverlayOptions] = useState<VideoOverlayOptions>(() => ({
    ...createDefaultOverlayOptions(),
    ...(initialOverlayOptions ?? {}),
  }));
  const overlaySig = useMemo(() => JSON.stringify(initialOverlayOptions ?? {}), [initialOverlayOptions]);
  useEffect(() => {
    setOverlayOptions({ ...createDefaultOverlayOptions(), ...(initialOverlayOptions ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaySig]);

  const updateOverlay = useCallback(
    (patch: Partial<VideoOverlayOptions>) => {
      const next = { ...overlayOptions, ...patch };
      setOverlayOptions(next);
      onOverlayOptionsChange?.(next);
    },
    [overlayOptions, onOverlayOptionsChange]
  );

  // ---------- 음악 (단일 트랙) ----------
  const [bgmPresetId, setBgmPresetId] = useState(initialBgmPresetId || 'none');
  const [bgmVolume, setBgmVolume] = useState(initialBgmVolume ?? 0.3);
  const [libraryTrackId, setLibraryTrackId] = useState<string | null>(
    initialSelectedLibraryTrackId ?? null
  );
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(
    initialCustomAudioFile ?? null
  );

  useEffect(() => {
    setBgmPresetId(initialBgmPresetId || 'none');
  }, [initialBgmPresetId]);
  useEffect(() => {
    if (typeof initialBgmVolume === 'number') setBgmVolume(initialBgmVolume);
  }, [initialBgmVolume]);
  useEffect(() => {
    setLibraryTrackId(initialSelectedLibraryTrackId ?? null);
  }, [initialSelectedLibraryTrackId]);
  useEffect(() => {
    setCustomAudioFile(initialCustomAudioFile ?? null);
  }, [initialCustomAudioFile]);

  const changeVolume = useCallback(
    (volume: number) => {
      setBgmVolume(volume);
      onBgmChange?.(bgmPresetId, volume, libraryTrackId);
    },
    [bgmPresetId, libraryTrackId, onBgmChange]
  );

  const changeFit = useCallback(
    (fit: boolean) => updateOverlay({ bgmFitToVideo: fit }),
    [updateOverlay]
  );

  const removeMusic = useCallback(() => {
    setCustomAudioFile(null);
    setLibraryTrackId(null);
    onCustomAudioChange?.(null);
    onBgmChange?.('none', bgmVolume, null);
  }, [bgmVolume, onBgmChange, onCustomAudioChange]);

  const pickAudioFile = useCallback(
    (file: File) => {
      setCustomAudioFile(file);
      setLibraryTrackId(null);
      onCustomAudioChange?.(file);
      onBgmChange?.('none', bgmVolume, null);
    },
    [bgmVolume, onBgmChange, onCustomAudioChange]
  );

  // 보관함 음원을 선택하면 실제 병합에 쓰이는 File로 바꿔 커스텀 오디오로 적용한다.
  const applyLibraryTrack = useCallback(
    async (track: AudioLibraryTrack | null) => {
      if (!track) {
        removeMusic();
        return;
      }
      try {
        const file = await loadLibraryAudioFile(track);
        setCustomAudioFile(file);
        setLibraryTrackId(track.id);
        onCustomAudioChange?.(file);
        onBgmChange?.('none', bgmVolume, track.id);
      } catch {
        /* 네트워크 오류 시 기존 음악 유지 */
      }
    },
    [bgmVolume, onBgmChange, onCustomAudioChange, removeMusic]
  );

  // ---------- 인스펙터 / 선택 ----------
  const [activeInspector, setActiveInspector] = useState<InspectorTarget>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [trimSegment, setTrimSegment] = useState<HighlightSegment | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDateFormatOpen, setIsDateFormatOpen] = useState(false);
  const [isSubtitleDownloadOpen, setIsSubtitleDownloadOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(getStoredDateFormat);
  // 날짜 형식·나이 옵션은 오버레이 객체 밖의 저장값이라 변경 시 캔버스 재그리기를 명시적으로 트리거한다.
  const [settingsRevision, setSettingsRevision] = useState(0);
  const bumpSettings = useCallback(() => setSettingsRevision((v) => v + 1), []);
  // BYOK 설정/모델 선택은 localStorage를 갱신하므로 revision을 올려 상단 배지를 즉시 재계산한다.
  const [, setModelRevision] = useState(0);

  // 분석이 시작되면 모델 변경을 막고 모달을 닫는다.
  useEffect(() => {
    if (isProcessing) setIsModelModalOpen(false);
  }, [isProcessing]);
  const [exportResolution, setExportResolution] = useState<ExportResolution>('1080p');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSegment = useMemo(
    () => displaySegments.find((s) => s.id === selectedSegmentId) ?? displaySegments[0] ?? null,
    [displaySegments, selectedSegmentId]
  );

  const openLocation = useCallback((id: string) => {
    setSelectedSegmentId(id);
    setActiveInspector({ type: 'location', segmentId: id });
  }, []);

  const applyToVideo = useCallback(
    (sourceVideoId: string, locationName: string) => {
      setLocalSegments((prev) =>
        prev.map((s) => (s.sourceVideoId === sourceVideoId ? { ...s, locationName } : s))
      );
      onUpdateVideoLocation?.(sourceVideoId, locationName);
    },
    [onUpdateVideoLocation]
  );

  // ---------- 타임라인 모델 & 재생 ----------
  const frame = useMemo(
    () => previewFrame(orientation, portraitPlatform),
    [orientation, portraitPlatform]
  );
  const model = useMemo(
    () => buildTimeline(displaySegments, overlayOptions),
    [displaySegments, overlayOptions]
  );
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // 인스펙터가 요청한 인트로/아웃트로 구간 단독 미리보기 상태.
  const [previewRange, setPreviewRange] = useState<PreviewRange | null>(null);
  const previewRef = useRef<PreviewRange | null>(null);
  previewRef.current = previewRange;
  // 같은 템플릿을 다시 눌러도 0%부터 재생하도록 재생 요청마다 증가하는 토큰.
  const [previewSeq, setPreviewSeq] = useState(0);
  const lastPreviewTokenRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    if (playheadRef.current > model.total) {
      playheadRef.current = 0;
      setPlayhead(0);
    }
  }, [model.total]);

  const sectionBounds = useCallback((kind: 'intro' | 'outro') => {
    const key = kind === 'intro' ? '__intro__' : '__outro__';
    const item = modelRef.current.items.find((i) => i.key === key);
    return item ? { start: item.start, end: item.end } : null;
  }, []);

  useEffect(() => {
    if (!isPlaying || model.total <= 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const range = previewRef.current;
      const bounds = range ? sectionBounds(range.kind) : null;
      // 구간이 꺼져 있으면(모델에서 사라지면) 전체 재생으로 자연스럽게 폴백한다.
      const end = bounds?.end ?? modelRef.current.total;
      const next = playheadRef.current + dt;

      if (bounds && next >= end) {
        if (range?.loop) {
          playheadRef.current = bounds.start;
          setPlayhead(bounds.start);
          raf = requestAnimationFrame(step);
          return;
        }
        // 완성 프레임에 정지 — 0초로 튕겨 검은 첫 프레임이 보이지 않게 한다.
        const finalFrame = Math.max(bounds.start, end - 0.01);
        playheadRef.current = finalFrame;
        setPlayhead(finalFrame);
        setIsPlaying(false);
        return;
      }
      if (next >= modelRef.current.total) {
        playheadRef.current = 0;
        setPlayhead(0);
        setIsPlaying(false);
        return;
      }
      playheadRef.current = next;
      setPlayhead(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, model.total, sectionBounds]);

  const seek = useCallback((time: number) => {
    playheadRef.current = time;
    setPlayhead(time);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewRange(null);
    setIsPlaying(false);
  }, []);

  /** 문구 입력처럼 재시작 없이 선명한 대표 프레임에 고정할 때 사용한다. */
  const holdFrame = useCallback(
    (kind: 'intro' | 'outro', progress: number) => {
      const bounds = sectionBounds(kind);
      if (!bounds) return;
      const t = Math.min(
        bounds.end - 0.001,
        bounds.start + Math.max(0, Math.min(1, progress)) * (bounds.end - bounds.start)
      );
      setIsPlaying(false);
      playheadRef.current = t;
      setPlayhead(t);
    },
    [sectionBounds]
  );

  const playSection = useCallback(
    (kind: 'intro' | 'outro', loop: boolean) => {
      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setPreviewRange({ kind, loop });
      if (prefersReduced) {
        // 대표 프레임 고정이 구간 시작 seek에 덮어써지지 않도록 토큰을 미리 소비한다.
        lastPreviewTokenRef.current = `${kind}:${previewSeq}`;
        holdFrame(kind, 0.8);
        return;
      }
      setPreviewSeq((v) => v + 1);
      setIsPlaying(true);
    },
    [holdFrame, previewSeq]
  );

  // 템플릿 클릭으로 인트로/아웃트로가 방금 켜진 경우에도 모델이 갱신된 뒤
  // 같은 이펙트에서 구간 시작으로 이동해 0%→100% 재생을 시작한다.
  useEffect(() => {
    if (!previewRange) return;
    const key = previewRange.kind === 'intro' ? '__intro__' : '__outro__';
    const item = model.items.find((i) => i.key === key);
    if (!item) {
      setPreviewRange(null);
      setIsPlaying(false);
      return;
    }
    const token = `${previewRange.kind}:${previewSeq}`;
    if (lastPreviewTokenRef.current === token) return;
    lastPreviewTokenRef.current = token;
    playheadRef.current = item.start;
    setPlayhead(item.start);
  }, [previewRange, previewSeq, model.items]);

  const handlePreviewRequest = useCallback(
    (request: PreviewRequest) => {
      if (request.mode === 'hold') {
        holdFrame(request.kind, request.progress);
        return;
      }
      playSection(request.kind, request.loop);
    },
    [holdFrame, playSection]
  );

  // 타임라인 컷을 클릭하면 재생을 멈추고 해당 컷의 시작 프레임으로 이동한다.
  // 미리보기 오버레이는 현재 프레임의 컷에만 바인딩되므로 이 seek가 선택과 화면을 일치시킨다.
  const selectSegment = useCallback(
    (id: string) => {
      setSelectedSegmentId(id);
      setPreviewRange(null);
      setIsPlaying(false);
      const item = model.items.find((i) => i.kind === 'segment' && i.segment?.id === id);
      if (item) seek(item.start);
    },
    [model.items, seek]
  );

  // 인트로/아웃트로 칩을 누르면 인스펙터를 열고 해당 구간을 바로 재생한다.
  // 모션 감소 환경에서는 자동 재생 대신 문구가 선명한 대표 프레임에 정지한다.
  const openSection = useCallback(
    (kind: 'intro' | 'outro') => {
      setSelectedSegmentId(null);
      if (sectionBounds(kind)) playSection(kind, previewRef.current?.loop ?? false);
      else clearPreview();
      setActiveInspector({ type: kind });
    },
    [clearPreview, playSection, sectionBounds]
  );

  const openIntro = useCallback(() => openSection('intro'), [openSection]);
  const openOutro = useCallback(() => openSection('outro'), [openSection]);

  // 음악 트랙을 누르면 인트로/아웃트로와 같은 오른쪽 인스펙터를 연다.
  // 구간 미리보기는 음악과 무관하므로 정지한 뒤 패널만 전환한다.
  const openMusic = useCallback(() => {
    clearPreview();
    setActiveInspector({ type: 'music' });
  }, [clearPreview]);

  // 같은 음악 트랙을 한 번 더 누르면 인스펙터를 닫아 토글처럼 동작하게 한다.
  const toggleMusic = useCallback(() => {
    if (activeInspector?.type === 'music') {
      setActiveInspector(null);
      clearPreview();
      return;
    }
    openMusic();
  }, [activeInspector, clearPreview, openMusic]);

  // 하단 전체 재생 버튼은 구간 미리보기를 해제하고 타임라인 전체를 재생한다.
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setPreviewRange(null);
    setIsPlaying(true);
  }, [isPlaying]);

  // 룰러 드래그 시작 시 구간 미리보기를 해제한다.
  const onScrubStart = useCallback(() => clearPreview(), [clearPreview]);

  // ---------- 좌측 리스트 자동 접힘 + 사용자 토글 ----------
  const pendingVideos = videos.filter((v) => (v.segments?.length ?? 0) === 0);
  // 분석이 끝나면 컷 비행 착지를 기다리지 않고 도크가 자동으로 접힌다.
  // 비행 출발 좌표는 발사 시점(분석 중)에 이미 고정되므로 착지를 기다릴 필요가 없다.
  const autoDockCollapsed =
    !isProcessing && displaySegments.length > 0 && pendingVideos.length === 0;
  // null이면 위 자동 규칙을 따르고, 한 번이라도 토글하면 사용자의 선택을 항상 우선한다.
  const [dockPreference, setDockPreference] = useState<boolean | null>(null);
  const isDockOpen = dockPreference ?? !autoDockCollapsed;
  const toggleDock = useCallback(() => setDockPreference(!isDockOpen), [isDockOpen]);

  // 새 프로젝트로 영상 목록이 비면 자동 규칙으로 되돌린다.
  useEffect(() => {
    if (videos.length === 0) setDockPreference(null);
  }, [videos.length]);

  // ---------- 작업 이름 (파일명/표시용) ----------
  const projectName = useMemo(() => {
    const first = videos.find((v) => v.name);
    return first?.name?.replace(/\.[^/.]+$/, '') || '';
  }, [videos, ui]);

  // ---------- 상단 모델 배지 ----------
  const byokActive = isByokActive();
  const modelDisplay: StudioModelDisplay = useMemo(() => {
    if (byokActive) {
      const config = getStoredUserApiKeyConfig();
      const preset = getProviderPreset(config?.provider);
      const modelLabel = config?.model?.trim() || preset.defaultModel;
      return {
        isByok: true,
        label: `${preset.shortName || preset.name} · ${modelLabel}`,
        tooltip: ui('자체 AI 키 사용 중 · {provider} · {model}', {
          provider: preset.name,
          model: modelLabel,
        }),
        speedText: null,
        speedTier: null,
        usesTrainingData: false,
      };
    }
    const active = models.find((m) => m.id === selectedModel);
    const label = cleanModelName(active?.name || selectedModel) || selectedModel || ui('AI 모델');
    const speed = active?.speedTokensPerSecond;
    const hasSpeed = typeof speed === 'number' && Number.isFinite(speed) && speed > 0;
    const speedText = hasSpeed ? `${Math.round(speed).toLocaleString()} tok/s` : null;
    const policy = active?.dataPolicy?.training ? ui('학습에 사용됨') : ui('학습 미사용');
    return {
      isByok: false,
      label,
      tooltip: `${label}${active?.providerName ? ` · ${active.providerName}` : ''} · ${policy}${
        speedText ? ` · ${speedText}` : ''
      }`,
      speedText,
      speedTier: hasSpeed ? getSpeedTier(speed).key : null,
      usesTrainingData: Boolean(active?.dataPolicy?.training),
    };
  }, [byokActive, models, selectedModel, ui]);

  // ---------- 액션 ----------
  const startAnalysis = useCallback(() => {
    if (isProcessing || removingVideoIds.size > 0) return;
    // 설정 모달에서 바꾼 하이라이트 방식을 분석에도 그대로 반영한다.
    onStartAiAnalysis(
      overlayOptions,
      customAudioFile,
      bgmPresetId,
      bgmVolume,
      getStoredHighlightMode()
    );
  }, [isProcessing, removingVideoIds, onStartAiAnalysis, overlayOptions, customAudioFile, bgmPresetId, bgmVolume]);

  /**
   * 원본 영상 삭제 오케스트레이션.
   * 1) 해당 컷들을 타임라인에서 숨기고 재생/선택/인스펙터를 정리한다.
   * 2) 컷을 원본 카드로 역비행시키고, 카드 소멸이 끝나면 실제 상태 삭제를 호출한다.
   *    (blob URL 해제를 연출 뒤로 미뤄 고스트/썸네일이 도중에 깨지지 않게 한다.)
   */
  const handleRemoveVideoWithAnimation = useCallback(
    (videoId: string) => {
      if (isProcessing || removingVideoIds.has(videoId)) return;

      const targetSegments = localSegments.filter((s) => s.sourceVideoId === videoId);
      const sourceVideo = videos.find((v) => v.id === videoId);
      const cardEl = document.querySelector(
        `[data-cut-card-id="${videoId}"]`
      ) as HTMLElement | null;

      clearPreview();
      setReturningIds((prev) => {
        const next = new Set(prev);
        targetSegments.forEach((s) => next.add(s.id));
        return next;
      });
      setRemovingVideoIds((prev) => new Set(prev).add(videoId));

      if (targetSegments.some((s) => s.id === selectedSegmentId)) {
        setSelectedSegmentId(null);
      }
      if (
        activeInspector?.type === 'location' &&
        targetSegments.some((s) => s.id === activeInspector.segmentId)
      ) {
        setActiveInspector(null);
      }
      if (trimSegment && targetSegments.some((s) => s.id === trimSegment.id)) {
        setTrimSegment(null);
      }

      const finalize = () => {
        onRemoveVideo(videoId);
        setReturningIds((prev) => {
          const next = new Set(prev);
          targetSegments.forEach((s) => next.delete(s.id));
          return next;
        });
        setRemovingVideoIds((prev) => {
          const next = new Set(prev);
          next.delete(videoId);
          return next;
        });
        setLandedVideos((prev) => {
          if (!prev.has(videoId)) return prev;
          const next = new Set(prev);
          next.delete(videoId);
          return next;
        });
        targetSegments.forEach((s) => dispatchedIdsRef.current.delete(s.id));
      };

      if (targetSegments.length === 0) {
        // 아직 컷이 없는 영상은 역비행 없이 카드 소멸만 연출한다.
        const handle = collapseFlightCard(cardEl, finalize);
        activeReturnFlightsRef.current.add(handle);
        return;
      }

      // 가로 스크롤 영역 밖의 칩은 트랙 뷰포트 경계로 clamp해 허공에서 출발하지 않게 한다.
      const trackRect = (document.querySelector('.sv2-tracks') as HTMLElement | null)
        ?.getBoundingClientRect();
      const items = targetSegments.map((seg) => {
        const chipRect = (
          document.querySelector(`[data-cut-slot-id="${seg.id}"]`) as HTMLElement | null
        )?.getBoundingClientRect();
        let x = chipRect ? chipRect.left + chipRect.width / 2 : window.innerWidth * 0.65;
        let y = chipRect ? chipRect.top + chipRect.height / 2 : window.innerHeight * 0.82;
        if (trackRect) {
          x = Math.max(trackRect.left + 46, Math.min(trackRect.right - 46, x));
          y = Math.max(trackRect.top + 12, Math.min(trackRect.bottom - 12, y));
        }
        return { id: seg.id, thumbnailUrl: sourceVideo?.thumbnailUrl, from: { x, y } };
      });

      // 모션 축소 시 flyCutsOut이 onComplete를 동기 호출하므로 핸들을 미리 참조하지 않는다.
      let finished = false;
      const handleHolder: { current: FlightHandle | null } = { current: null };
      const handle = flyCutsOut(items, {
        toCardEl: cardEl,
        onComplete: () => {
          finished = true;
          if (handleHolder.current) activeReturnFlightsRef.current.delete(handleHolder.current);
          finalize();
        },
      });
      handleHolder.current = handle;
      if (!finished) activeReturnFlightsRef.current.add(handle);
    },
    [
      isProcessing,
      removingVideoIds,
      localSegments,
      videos,
      clearPreview,
      selectedSegmentId,
      activeInspector,
      trimSegment,
      onRemoveVideo,
    ]
  );

  const handleDateFormatChange = useCallback(
    (format: DateFormatOption) => {
      setStoredDateFormat(format);
      setDateFormat(format);
      bumpSettings();
    },
    [bumpSettings]
  );

  const handleHighlightModeChange = useCallback(
    (mode: HighlightMode) => {
      onHighlightModeChange?.(mode);
    },
    [onHighlightModeChange]
  );

  const handleResetProject = useCallback(() => {
    const confirmed = window.confirm(
      ui('현재 올린 영상과 편집 내용이 모두 사라져요. 새 작업을 시작할까요?')
    );
    if (!confirmed) return;
    setIsSettingsOpen(false);
    onReset?.();
  }, [onReset, ui]);

  const confirmExport = useCallback(
    async (res: ExportResolution) => {
      if (isProcessing || removingVideoIds.size > 0) return;
      setExportResolution(res);
      const stitched = await onReStitch(
        displaySegments,
        bgmPresetId,
        bgmVolume,
        customAudioFile,
        overlayOptions,
        res
      );
      if (stitched?.url) {
        const a = document.createElement('a');
        a.href = stitched.url;
        const title = overlayOptions.titleText?.trim() || result?.suggestedTitle?.trim() || 'penguincut';
        a.download = `${title}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    },
    [
      onReStitch,
      isProcessing,
      removingVideoIds,
      displaySegments,
      bgmPresetId,
      bgmVolume,
      customAudioFile,
      overlayOptions,
      result?.suggestedTitle,
    ]
  );

  if (!isWide) return <DesktopOnlyGate />;

  const focusVideo = trimSegment
    ? videos.find((v) => v.id === trimSegment.sourceVideoId)
    : undefined;

  // 타임라인 음악 칩과 오른쪽 인스펙터가 같은 상태·액션을 공유하도록 한 객체로 묶는다.
  const musicPanelProps = {
    bgmPresetId,
    bgmVolume,
    libraryTrackId,
    customAudioName: customAudioFile?.name ?? null,
    bgmFitToVideo: overlayOptions.bgmFitToVideo ?? false,
    onApplyTrack: applyLibraryTrack,
    onVolumeChange: changeVolume,
    onFitChange: changeFit,
    onPickFile: pickAudioFile,
    onRemove: removeMusic,
  };

  return (
    <div className="sv2-root">
      <StudioTopBar
        projectName={projectName}
        modelDisplay={modelDisplay}
        isLoadingModels={isLoadingModels}
        isProcessing={isProcessing}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onOpenLanguageModal={() => setIsLanguageModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDockOpen={isDockOpen}
        onToggleDock={toggleDock}
        onExport={() => setIsExportOpen(true)}
        canExport={displaySegments.length > 0 && !isProcessing}
        isExporting={isReStitching}
        orientation={orientation}
        onOrientationChange={(o) => onOrientationChange?.(o)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        disabled={isProcessing || removingVideoIds.size > 0}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length && !isProcessing && removingVideoIds.size === 0) onFilesSelected(files);
          e.target.value = '';
        }}
      />

      <div className="sv2-body">
        <UploadQueueDock
          videos={videos}
          isProcessing={isProcessing}
          isPreparingVideos={isPreparingVideos}
          collapsed={!isDockOpen}
          landedVideos={landedVideos}
          videoTasks={progress?.videoTasks}
          removingVideoIds={removingVideoIds}
          onFilesSelected={(files) => {
            if (!isProcessing && removingVideoIds.size === 0) onFilesSelected(files);
          }}
          onAddVideos={() => {
            if (!isProcessing) fileInputRef.current?.click();
          }}
          onRemoveVideo={handleRemoveVideoWithAnimation}
          onStartAnalysis={startAnalysis}
          onCancel={onCancelProcessing}
        />

        <div className="sv2-center" data-subtitle-refreshed={subtitleRefreshed}>
          <div className="sv2-stage-wrap">
            {isProcessing && (
              <div className="sv2-status-pill" role="status" aria-live="polite">
                <span className="sv2-spinner" />
                <span className="sv2-status-pill-text">
                  {progress?.statusMessage ||
                    ui('장면을 분석하고 있어요. 끝나면 타임라인에 바로 채워져요.')}
                </span>
                <div className="sv2-progress-bar sv2-status-pill-bar">
                  <div
                    className="sv2-progress-fill"
                    style={{ width: `${progress?.progressPercent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
            <CenterPreviewStage
              frame={frame}
              model={model}
              playhead={playhead}
              isPlaying={isPlaying}
              videos={videos}
              overlayOptions={overlayOptions}
              orientation={orientation}
              totalDuration={model.total}
              previewRange={previewRange}
              onTogglePlay={togglePlay}
              onPause={() => setIsPlaying(false)}
              onSeek={(time) => {
                setPreviewRange(null);
                seek(time);
              }}
              onOpenLocation={openLocation}
              onUpdateSegment={updateSegment}
              revision={settingsRevision}
            />
          </div>

          <TimelineDock
            segments={displaySegments}
            videos={videos}
            model={model}
            overlayOptions={overlayOptions}
            selectedSegmentId={selectedSegmentId}
            landingIds={landingIds}
            returningIds={returningIds}
            playhead={playhead}
            onSeek={seek}
            onScrubStart={onScrubStart}
            locked={isProcessing || removingVideoIds.size > 0}
            bgmPresetId={bgmPresetId}
            bgmVolume={bgmVolume}
            libraryTrackId={libraryTrackId}
            customAudioName={customAudioFile?.name ?? null}
            onOpenMusic={openMusic}
            onToggleMusic={toggleMusic}
            musicInspectorOpen={activeInspector?.type === 'music'}
            onSelect={selectSegment}
            onUpdateSegment={updateSegment}
            onDelete={deleteSegment}
            onTrim={setTrimSegment}
            onOpenLocation={openLocation}
            onOpenIntro={openIntro}
            onOpenOutro={openOutro}
            onReorder={reorderSegments}
            onVolumeChange={changeVolume}
            onRemoveMusic={removeMusic}
            onFitChange={(fit) => updateOverlay({ bgmFitToVideo: fit })}
          />
        </div>

        <RightInspectorDrawer
          target={activeInspector}
          segment={activeSegment}
          thumbnailUrl={videos.find((v) => v.id === activeSegment?.sourceVideoId)?.thumbnailUrl}
          overlayOptions={overlayOptions}
          orientation={orientation}
          onUpdateSegment={updateSegment}
          onApplyToVideo={applyToVideo}
          onOverlayChange={updateOverlay}
          onPreviewRequest={handlePreviewRequest}
          music={musicPanelProps}
          onClose={() => {
            setActiveInspector(null);
            clearPreview();
          }}
        />

        {trimSegment && (
          <Suspense fallback={null}>
            <SegmentTrimModal
              isOpen={Boolean(trimSegment)}
              onClose={() => setTrimSegment(null)}
              segment={trimSegment}
              sourceVideo={focusVideo}
              onSave={(segId, newStart, newEnd) => {
                updateSegment(segId, {
                  start: newStart,
                  end: newEnd,
                  duration: Math.max(0.1, newEnd - newStart),
                });
                setTrimSegment(null);
              }}
            />
          </Suspense>
        )}

        {isExportOpen && (
          <Suspense fallback={null}>
            <VideoExportModal
              isOpen={isExportOpen}
              onClose={() => setIsExportOpen(false)}
              currentResolution={exportResolution}
              onConfirmDownload={(res) => {
                setIsExportOpen(false);
                void confirmExport(res);
              }}
              totalDurationText={ui('{count}초', { count: Math.round(model.total) })}
              segmentCount={localSegments.length}
              isMobileDevice={!isWide}
              orientation={orientation}
            />
          </Suspense>
        )}

        {isModelModalOpen && (
          <Suspense fallback={null}>
            <ModelSelectorModal
              isOpen={isModelModalOpen}
              onClose={() => setIsModelModalOpen(false)}
              models={models}
              selectedModelId={selectedModel}
              onSelectModel={(id) => {
                onSelectModel(id);
                setModelRevision((v) => v + 1);
              }}
            />
          </Suspense>
        )}

        {isLanguageModalOpen && (
          <Suspense fallback={null}>
            <LanguageSelectorModal
              isOpen={isLanguageModalOpen}
              onClose={() => setIsLanguageModalOpen(false)}
            />
          </Suspense>
        )}

        {isSettingsOpen && (
          <Suspense fallback={null}>
            <StudioV2SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              isSubModalOpen={isDateFormatOpen}
              onChange={bumpSettings}
              dateFormat={dateFormat}
              onOpenDateFormat={() => setIsDateFormatOpen(true)}
              onDownloadSubtitles={() => {
                setIsSettingsOpen(false);
                setIsSubtitleDownloadOpen(true);
              }}
              canDownloadSubtitles={displaySegments.length > 0}
              onOpenFeedback={() => {
                setIsSettingsOpen(false);
                setIsFeedbackOpen(true);
              }}
              onOpenPatchNotes={() => {
                setIsSettingsOpen(false);
                setIsPatchNotesOpen(true);
              }}
              onResetProject={handleResetProject}
              onOverlayChange={updateOverlay}
              onHighlightModeChange={handleHighlightModeChange}
            />
          </Suspense>
        )}

        {isDateFormatOpen && (
          <Suspense fallback={null}>
            <DateFormatSelectorModal
              isOpen={isDateFormatOpen}
              onClose={() => setIsDateFormatOpen(false)}
              currentFormat={dateFormat}
              onSelectFormat={handleDateFormatChange}
            />
          </Suspense>
        )}

        {isSubtitleDownloadOpen && (
          <Suspense fallback={null}>
            <SubtitleDownloadModal
              isOpen={isSubtitleDownloadOpen}
              onClose={() => setIsSubtitleDownloadOpen(false)}
              segments={displaySegments}
              introDuration={overlayOptions.showIntro ? overlayOptions.introDurationSec ?? 2 : 0}
              bridgeDurationMap={result?.bridgeDurationMap}
              videoTitle={projectName}
            />
          </Suspense>
        )}

        {isFeedbackOpen && (
          <Suspense fallback={null}>
            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
          </Suspense>
        )}

        {isPatchNotesOpen && (
          <Suspense fallback={null}>
            <PatchNotesModal isOpen={isPatchNotesOpen} onClose={() => setIsPatchNotesOpen(false)} />
          </Suspense>
        )}

        {isReStitching && (
          <div className="sv2-processing sv2-processing-elevated">
            <div className="sv2-processing-card">
              <div className="sv2-processing-title">
                <Loader2 size={18} className="sv2-spin sv2-loader-inline" />
                {ui('MP4로 내보내고 있어요')}
              </div>
              <div className="sv2-processing-sub">
                {reStitchProgress?.statusMessage ||
                  ui('미리보기와 똑같은 화면으로 인코딩하고 있어요.')}
              </div>
              <div className="sv2-progress-bar sv2-progress-track">
                <div
                  className="sv2-progress-fill"
                  style={{ width: `${reStitchProgress?.progressPercent ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
