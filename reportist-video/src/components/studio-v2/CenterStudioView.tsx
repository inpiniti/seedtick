import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cleanModelName, getSpeedTier } from '../../services/modelMetrics.ts';
import {
  getProviderPreset,
  getStoredUserApiKeyConfig,
  isByokActive,
} from '../../services/userApiKeyService.ts';
import { previewFrame } from '../../services/frameSpec.ts';
import { getStoredAutoSortByRecordedTime, sortSegmentsByRecordedTime } from '../../services/videoMetadata.ts';
import { loadLibraryAudioFile, type AudioLibraryTrack } from '../../data/audioLibrary.ts';
import type {
  ExportResolution,
  HighlightSegment,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { DesktopOnlyGate } from './DesktopOnlyGate.tsx';
import { StudioTopBar, type StudioModelDisplay } from './StudioTopBar.tsx';
import { UploadQueueDock } from './UploadQueueDock.tsx';
import { CenterPreviewStage } from './CenterPreviewStage.tsx';
import { TimelineDock } from './TimelineDock.tsx';
import { RightInspectorDrawer } from './RightInspectorDrawer.tsx';
import { flyCutsIn, type FlightHandle } from './cutFlightAnimator.ts';
import { buildTimeline } from './timelineModel.ts';
import {
  DEFAULT_OVERLAY_OPTIONS,
  type InspectorTarget,
  type StudioV2Props,
} from './types.ts';
import './studioV2.css';

// 무거운 모달은 지연 로드
const SegmentTrimModal = lazy(() =>
  import('../studio/SegmentTrimModal.tsx').then((m) => ({ default: m.SegmentTrimModal }))
);
const AudioLibraryModal = lazy(() =>
  import('../studio/AudioLibraryModal.tsx').then((m) => ({ default: m.AudioLibraryModal }))
);
const VideoExportModal = lazy(() =>
  import('../studio/VideoExportModal.tsx').then((m) => ({ default: m.VideoExportModal }))
);
const ModelSelectorModal = lazy(() =>
  import('../studio/ModelSelectorModal.tsx').then((m) => ({ default: m.ModelSelectorModal }))
);

/**
 * CenterStudioView — PC 전용 "미리보기 중심" 스튜디오 V2 최상위 셸.
 * App의 상태/핸들러를 그대로 재사용하고, UI 레이아웃·상태 전이만 새로 구현한다.
 */
export const CenterStudioView = (props: StudioV2Props) => {
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
    currentProjectId,
    saveStatus,
    projectSummaries,
    isLoadingProjects,
    onOpenProject,
    onViewProjects,
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

  // 비행 상태는 ref를 진실 원본으로 두어 거의 동시에 완료되는 여러 배치가 서로를 덮어쓰지 않게 한다.
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const landingIdsRef = useRef<Set<string>>(new Set());
  const dispatchedIdsRef = useRef<Set<string>>(
    new Set((result?.segments ?? []).map((s) => s.id))
  );
  const idToSourceRef = useRef<Map<string, string>>(new Map());
  const activeFlightsRef = useRef<Set<FlightHandle>>(new Set());
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

  // 언마운트 시 남은 비행을 모두 정리한다.
  useEffect(() => {
    const flights = activeFlightsRef.current;
    return () => {
      flights.forEach((h) => h.cancel());
      flights.clear();
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

  // 분석 중에는 스트리밍 데이터와 편집 상태가 충돌하지 않도록 모든 세그먼트 편집을 막는다.
  const updateSegment = useCallback(
    (id: string, patch: Partial<HighlightSegment>) => {
      if (isProcessing) return;
      const next = localSegments.map((s) => (s.id === id ? { ...s, ...patch } : s));
      setLocalSegments(next);
      commitSegments(next);
    },
    [isProcessing, localSegments, commitSegments]
  );

  const deleteSegment = useCallback(
    (id: string) => {
      if (isProcessing) return;
      const next = localSegments.filter((s) => s.id !== id);
      setLocalSegments(next);
      commitSegments(next);
      setSelectedSegmentId((prev) => (prev === id ? null : prev));
    },
    [isProcessing, localSegments, commitSegments]
  );

  const reorderSegments = useCallback(
    (from: number, to: number) => {
      if (isProcessing || from === to) return;
      const next = [...localSegments];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      setLocalSegments(next);
      commitSegments(next);
    },
    [isProcessing, localSegments, commitSegments]
  );

  // ---------- 오버레이 옵션 ----------
  const [overlayOptions, setOverlayOptions] = useState<VideoOverlayOptions>(() => ({
    ...DEFAULT_OVERLAY_OPTIONS,
    ...(initialOverlayOptions ?? {}),
  }));
  const overlaySig = useMemo(() => JSON.stringify(initialOverlayOptions ?? {}), [initialOverlayOptions]);
  useEffect(() => {
    setOverlayOptions({ ...DEFAULT_OVERLAY_OPTIONS, ...(initialOverlayOptions ?? {}) });
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
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

  useEffect(() => {
    if (playheadRef.current > model.total) {
      playheadRef.current = 0;
      setPlayhead(0);
    }
  }, [model.total]);

  useEffect(() => {
    if (!isPlaying || model.total <= 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = playheadRef.current + dt;
      if (next >= model.total) {
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
  }, [isPlaying, model.total]);

  const seek = useCallback((time: number) => {
    playheadRef.current = time;
    setPlayhead(time);
  }, []);

  // ---------- 좌측 리스트 소멸 조건 ----------
  const pendingVideos = videos.filter((v) => (v.segments?.length ?? 0) === 0);
  // 마지막 컷이 완전히 착지한 뒤에만 도크가 접힌다(비행 중 출발점이 사라지지 않게).
  const dockCollapsed =
    !isProcessing &&
    displaySegments.length > 0 &&
    pendingVideos.length === 0 &&
    landingIds.size === 0;

  // ---------- 프로젝트명 ----------
  const projectName = useMemo(() => {
    const found = projectSummaries?.find((p) => p.id === currentProjectId);
    return found?.title || '새 프로젝트';
  }, [projectSummaries, currentProjectId]);

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
        tooltip: `자체 AI 키 사용 중 · ${preset.name} · ${modelLabel}`,
        speedText: null,
        speedTier: null,
        usesTrainingData: false,
      };
    }
    const active = models.find((m) => m.id === selectedModel);
    const label = cleanModelName(active?.name || selectedModel) || selectedModel || 'AI 모델';
    const speed = active?.speedTokensPerSecond;
    const hasSpeed = typeof speed === 'number' && Number.isFinite(speed) && speed > 0;
    const speedText = hasSpeed ? `${Math.round(speed).toLocaleString()} tok/s` : null;
    const policy = active?.dataPolicy?.training ? '학습에 사용됨' : '학습 미사용';
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
  }, [byokActive, models, selectedModel]);

  // ---------- 액션 ----------
  const startAnalysis = useCallback(() => {
    onStartAiAnalysis(overlayOptions, customAudioFile, bgmPresetId, bgmVolume);
  }, [onStartAiAnalysis, overlayOptions, customAudioFile, bgmPresetId, bgmVolume]);

  const confirmExport = useCallback(
    async (res: ExportResolution) => {
      if (isProcessing) return;
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
        a.download = `${projectName || 'penguincut'}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    },
    [onReStitch, isProcessing, displaySegments, bgmPresetId, bgmVolume, customAudioFile, overlayOptions, projectName]
  );

  if (!isWide) return <DesktopOnlyGate />;

  const focusVideo = trimSegment
    ? videos.find((v) => v.id === trimSegment.sourceVideoId)
    : undefined;

  return (
    <div className="sv2-root">
      <StudioTopBar
        projectName={projectName}
        saveStatus={saveStatus}
        modelDisplay={modelDisplay}
        isLoadingModels={isLoadingModels}
        isProcessing={isProcessing}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onAddVideos={() => fileInputRef.current?.click()}
        onOpenProjects={() => onViewProjects?.() ?? onOpenProject?.(currentProjectId || '')}
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
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFilesSelected(files);
          e.target.value = '';
        }}
      />

      <div className="sv2-body">
        <UploadQueueDock
          videos={videos}
          isProcessing={isProcessing}
          isPreparingVideos={isPreparingVideos}
          collapsed={dockCollapsed}
          landedVideos={landedVideos}
          videoTasks={progress?.videoTasks}
          onFilesSelected={onFilesSelected}
          onRemoveVideo={onRemoveVideo}
          onStartAnalysis={startAnalysis}
          onCancel={onCancelProcessing}
        />

        <div className="sv2-center" data-subtitle-refreshed={subtitleRefreshed}>
          <div className="sv2-stage-wrap">
            {isProcessing && (
              <div className="sv2-status-pill" role="status" aria-live="polite">
                <span className="sv2-spinner" />
                <span className="sv2-status-pill-text">
                  {progress?.statusMessage || '장면을 분석하고 있어요. 끝나면 타임라인에 바로 채워져요.'}
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
              selectedSegmentId={selectedSegmentId}
              orientation={orientation}
              totalDuration={model.total}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onSeek={seek}
              onOpenLocation={openLocation}
              onUpdateSegment={updateSegment}
            />
          </div>

          <TimelineDock
            segments={displaySegments}
            videos={videos}
            model={model}
            overlayOptions={overlayOptions}
            selectedSegmentId={selectedSegmentId}
            landingIds={landingIds}
            playhead={playhead}
            onSeek={seek}
            onScrubStart={() => setIsPlaying(false)}
            locked={isProcessing}
            bgmPresetId={bgmPresetId}
            bgmVolume={bgmVolume}
            libraryTrackId={libraryTrackId}
            customAudioName={customAudioFile?.name ?? null}
            onSelect={setSelectedSegmentId}
            onUpdateSegment={updateSegment}
            onDelete={deleteSegment}
            onTrim={setTrimSegment}
            onOpenLocation={openLocation}
            onOpenIntro={() => setActiveInspector({ type: 'intro' })}
            onOpenOutro={() => setActiveInspector({ type: 'outro' })}
            onReorder={reorderSegments}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onVolumeChange={changeVolume}
            onRemoveMusic={removeMusic}
            onPickAudioFile={pickAudioFile}
          />
        </div>

        <RightInspectorDrawer
          target={activeInspector}
          segment={activeSegment}
          thumbnailUrl={videos.find((v) => v.id === activeSegment?.sourceVideoId)?.thumbnailUrl}
          overlayOptions={overlayOptions}
          onUpdateSegment={updateSegment}
          onApplyToVideo={applyToVideo}
          onOverlayChange={updateOverlay}
          onClose={() => setActiveInspector(null)}
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

        {isLibraryOpen && (
          <Suspense fallback={null}>
            <AudioLibraryModal
              isOpen={isLibraryOpen}
              onClose={() => setIsLibraryOpen(false)}
              selectedTrackId={libraryTrackId}
              hasAppliedAudio={Boolean(customAudioFile)}
              onApply={applyLibraryTrack}
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
              totalDurationText={`${Math.round(model.total)}초`}
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

        {isReStitching && (
          <div className="sv2-processing sv2-processing-elevated">
            <div className="sv2-processing-card">
              <div className="sv2-processing-title">
                <Loader2 size={18} className="sv2-spin sv2-loader-inline" />
                MP4로 내보내고 있어요
              </div>
              <div className="sv2-processing-sub">
                {reStitchProgress?.statusMessage || '미리보기와 똑같은 화면으로 인코딩하고 있어요.'}
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
