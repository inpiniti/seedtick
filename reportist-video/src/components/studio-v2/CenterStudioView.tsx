import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { previewFrame } from '../../services/frameSpec.ts';
import { loadLibraryAudioFile, type AudioLibraryTrack } from '../../data/audioLibrary.ts';
import type {
  ExportResolution,
  HighlightSegment,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { DesktopOnlyGate } from './DesktopOnlyGate.tsx';
import { StudioTopBar } from './StudioTopBar.tsx';
import { UploadQueueDock } from './UploadQueueDock.tsx';
import { CenterPreviewStage } from './CenterPreviewStage.tsx';
import { TimelineDock } from './TimelineDock.tsx';
import { RightInspectorDrawer } from './RightInspectorDrawer.tsx';
import { flyCutsIn } from './cutFlightAnimator.ts';
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

const THEME_KEY = 'sv2_theme';

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

  // ---------- 테마 (라이트 기본, 전환 가능) ----------
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
    return stored === 'dark' ? 'dark' : 'light';
  });
  const changeTheme = useCallback((next: 'light' | 'dark') => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage 차단 환경 무시 */
    }
  }, []);

  // ---------- 세그먼트 (App의 finalResult와 양방향 동기화) ----------
  const [localSegments, setLocalSegments] = useState<HighlightSegment[]>(
    () => result?.segments ?? []
  );
  const [landedVideos, setLandedVideos] = useState<Set<string>>(new Set());
  const prevSegmentsRef = useRef<HighlightSegment[]>(result?.segments ?? []);

  useEffect(() => {
    const incoming = result?.segments ?? [];
    const prevIds = new Set(prevSegmentsRef.current.map((s) => s.id));
    const newOnes = incoming.filter((s) => !prevIds.has(s.id));
    prevSegmentsRef.current = incoming;

    if (incoming.length === 0) {
      setLocalSegments([]);
      setLandedVideos(new Set());
      return;
    }
    setLocalSegments(incoming);

    if (newOnes.length === 0) return;

    // 칩이 DOM에 마운트된 뒤 출발/도착 좌표를 잡고 '탁탁탁' 비행을 시작한다.
    let cancelled = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelled) return;
        const items = newOnes.map((seg) => {
          const card = document.querySelector(`[data-cut-card-id="${seg.sourceVideoId}"]`);
          const rect = card?.getBoundingClientRect();
          const slot = document.querySelector(
            `[data-cut-slot-id="${seg.id}"]`
          ) as HTMLElement | null;
          return {
            id: seg.id,
            thumbnailUrl: videos.find((v) => v.id === seg.sourceVideoId)?.thumbnailUrl,
            from: rect
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : { x: 140, y: window.innerHeight / 2 },
            toEl: slot,
          };
        });
        setLandingIds(new Set(newOnes.map((s) => s.id)));
        flyCutsIn(items, {
          onLand: (id) => {
            setLandingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            const landed = newOnes.find((s) => s.id === id);
            if (landed) {
              setLandedVideos((prev) => new Set(prev).add(landed.sourceVideoId));
            }
          },
        });
      })
    );
    return () => {
      cancelled = true;
    };
    // videos는 비행 출발 좌표 계산에만 쓰이므로 의존성에서 제외해 재分析的 loop를 막는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.segments]);

  const commitSegments = useCallback(
    (next: HighlightSegment[]) => {
      if (result) props.onUpdateFinalResult({ ...result, segments: next });
    },
    [result, props]
  );

  const updateSegment = useCallback(
    (id: string, patch: Partial<HighlightSegment>) => {
      const next = localSegments.map((s) => (s.id === id ? { ...s, ...patch } : s));
      setLocalSegments(next);
      commitSegments(next);
    },
    [localSegments, commitSegments]
  );

  const deleteSegment = useCallback(
    (id: string) => {
      const next = localSegments.filter((s) => s.id !== id);
      setLocalSegments(next);
      commitSegments(next);
      setSelectedSegmentId((prev) => (prev === id ? null : prev));
    },
    [localSegments, commitSegments]
  );

  const reorderSegments = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = [...localSegments];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      setLocalSegments(next);
      commitSegments(next);
    },
    [localSegments, commitSegments]
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
  const [landingIds, setLandingIds] = useState<Set<string>>(new Set());
  const [trimSegment, setTrimSegment] = useState<HighlightSegment | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportResolution, setExportResolution] = useState<ExportResolution>('1080p');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSegment = useMemo(
    () => localSegments.find((s) => s.id === selectedSegmentId) ?? localSegments[0] ?? null,
    [localSegments, selectedSegmentId]
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
  const model = useMemo(() => buildTimeline(localSegments, overlayOptions), [localSegments, overlayOptions]);
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
  const dockCollapsed = !isProcessing && localSegments.length > 0 && pendingVideos.length === 0;

  // ---------- 프로젝트명 ----------
  const projectName = useMemo(() => {
    const found = projectSummaries?.find((p) => p.id === currentProjectId);
    return found?.title || '새 프로젝트';
  }, [projectSummaries, currentProjectId]);

  // ---------- 액션 ----------
  const startAnalysis = useCallback(() => {
    onStartAiAnalysis(overlayOptions, customAudioFile, bgmPresetId, bgmVolume);
  }, [onStartAiAnalysis, overlayOptions, customAudioFile, bgmPresetId, bgmVolume]);

  const confirmExport = useCallback(
    async (res: ExportResolution) => {
      setExportResolution(res);
      const stitched = await onReStitch(
        localSegments,
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
    [onReStitch, localSegments, bgmPresetId, bgmVolume, customAudioFile, overlayOptions, projectName]
  );

  if (!isWide) return <DesktopOnlyGate />;

  const focusVideo = trimSegment
    ? videos.find((v) => v.id === trimSegment.sourceVideoId)
    : undefined;

  return (
    <div className="sv2-root" data-studio-theme={theme}>
      <StudioTopBar
        projectName={projectName}
        saveStatus={saveStatus}
        models={models}
        selectedModel={selectedModel}
        isLoadingModels={isLoadingModels}
        onSelectModel={onSelectModel}
        onAddVideos={() => fileInputRef.current?.click()}
        onOpenProjects={() => onViewProjects?.() ?? onOpenProject?.(currentProjectId || '')}
        onExport={() => setIsExportOpen(true)}
        canExport={localSegments.length > 0}
        isExporting={isReStitching}
        orientation={orientation}
        onOrientationChange={(o) => onOrientationChange?.(o)}
        theme={theme}
        onThemeChange={changeTheme}
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
          onFilesSelected={onFilesSelected}
          onRemoveVideo={onRemoveVideo}
          onStartAnalysis={startAnalysis}
          onCancel={onCancelProcessing}
        />

        <div className="sv2-center">
          <div className="sv2-stage-wrap">
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
            segments={localSegments}
            videos={videos}
            model={model}
            overlayOptions={overlayOptions}
            selectedSegmentId={selectedSegmentId}
            landingIds={landingIds}
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

        {isProcessing && (
          <div className="sv2-processing">
            <div className="sv2-processing-card">
              <div className="sv2-processing-title">
                <span className="sv2-spinner" style={{ display: 'inline-block', marginRight: 10, verticalAlign: -3 }} />
                AI가 컷을 고르는 중…
              </div>
              <div className="sv2-processing-sub">
                {progress?.statusMessage || '영상이 분석되면 컷이 하나씩 타임라인으로 "탁탁탁" 들어옵니다.'}
              </div>
              <div className="sv2-progress-bar" style={{ height: 6 }}>
                <div className="sv2-progress-fill" style={{ width: `${progress?.progressPercent ?? 0}%` }} />
              </div>
            </div>
          </div>
        )}

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

        {isReStitching && (
          <div className="sv2-processing" style={{ zIndex: 60 }}>
            <div className="sv2-processing-card">
              <div className="sv2-processing-title">
                <Loader2 size={18} style={{ verticalAlign: -4, marginRight: 8 }} className="sv2-spin" />
                MP4로 내보내는 중…
              </div>
              <div className="sv2-processing-sub">
                {reStitchProgress?.statusMessage || '미리보기와 똑같은 화면으로 인코딩하고 있어요.'}
              </div>
              <div className="sv2-progress-bar" style={{ height: 6 }}>
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
