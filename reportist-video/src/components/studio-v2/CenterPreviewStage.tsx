import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Tilt, TiltContent } from '@animate-ui/react/primitives/effects/tilt';
import {
  computeMetaLayoutFromTexts,
  drawCompositorCoverFrame,
  drawCompositorSegmentOverlay,
  resolveMetaTexts,
} from '../../services/previewCompositorBase.ts';
import {
  getCachedCodecFrame,
  getCachedThumbnail,
  requestCodecFrame,
} from '../../services/previewFallbackSources.ts';
import type { FrameSpec } from '../../services/frameSpec.ts';
import type {
  HighlightSegment,
  VideoItem,
  VideoOrientation,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { formatClock, formatShootDate, type PreviewRange } from './types.ts';
import { getLocalizedTemplateMeta } from '../studio/introOutroOptions.ts';
import { useI18n } from '../../i18n/index.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';
import { resolveTimelineItem, type TimelineModel } from './timelineModel.ts';
import {
  firstFrameSeekTime,
  needsPreviewSeek,
  resolvePreviewVideoSlots,
} from './previewVideoSlots.ts';
import { PreviewInteractiveOverlay } from './PreviewInteractiveOverlay.tsx';
import { PreviewDisplayToggles } from './PreviewDisplayToggles.tsx';

type IntroOutroModule = typeof import('../../services/previewCompositorIntroOutro.ts');

interface CenterPreviewStageProps {
  frame: FrameSpec;
  model: TimelineModel;
  playhead: number;
  isPlaying: boolean;
  videos: VideoItem[];
  overlayOptions: VideoOverlayOptions;
  orientation: VideoOrientation;
  totalDuration: number;
  previewRange?: PreviewRange | null;
  /** 내보내기 중에는 <video> 선로드를 중단해 디코더/GPU 경합을 막는다. */
  isExporting?: boolean;
  /** AI 분석 중에도 예열 슬롯을 꺼 백그라운드 WebCodecs 디코더와 경합하지 않는다. */
  isProcessing?: boolean;
  /** 설정 모달에서 날짜 형식·나이 옵션을 바꾼 경우 캔버스를 다시 그리기 위한 신호. */
  revision?: number;
  /** 미리보기 소리 on/off. 원본 영상 현장음과 BGM에 함께 적용된다. */
  isMuted: boolean;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onOpenLocation: (segmentId: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onUpdateOverlay: (patch: Partial<VideoOverlayOptions>) => void;
}

const CenterPreviewStageImpl = ({
  frame,
  model,
  playhead,
  isPlaying,
  videos,
  overlayOptions,
  orientation,
  totalDuration,
  previewRange,
  isExporting = false,
  isProcessing = false,
  revision = 0,
  isMuted,
  onToggleMute,
  onTogglePlay,
  onPause,
  onSeek,
  onOpenLocation,
  onUpdateSegment,
  onUpdateOverlay,
}: CenterPreviewStageProps) => {
  const { dict, ui, t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const videoRefCallbacks = useRef(new Map<string, (el: HTMLVideoElement | null) => void>());
  /** 슬롯 해제용 load()가 내는 error 이벤트와 실제 디코더 오류를 구분한다. */
  const releasedVideos = useRef(new WeakSet<HTMLVideoElement>());
  /** 0초 시작 컷의 첫 프레임 업로드 여부(영상 id별 1회). */
  const seekedOnce = useRef(new Set<string>());
  const errorRetries = useRef(new Map<string, number>());
  const introOutroRef = useRef<IntroOutroModule | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);
  const [failedVideoIds, setFailedVideoIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const customIntroVideoRef = useRef<HTMLVideoElement>(null);
  const customOutroVideoRef = useRef<HTMLVideoElement>(null);
  const [customVideoUrls, setCustomVideoUrls] = useState<{ intro?: string; outro?: string }>({});

  const bumpRedraw = useCallback(() => setRedrawTick((tick) => tick + 1), []);

  // 사용자가 직접 올린 인트로/아웃트로 영상은 blob URL로 프리뷰에도 그대로 표시한다.
  const introVideoFile = overlayOptions.introVideoFile;
  const outroVideoFile = overlayOptions.outroVideoFile;
  useEffect(() => {
    const introUrl = introVideoFile ? URL.createObjectURL(introVideoFile) : undefined;
    const outroUrl = outroVideoFile ? URL.createObjectURL(outroVideoFile) : undefined;
    setCustomVideoUrls({ intro: introUrl, outro: outroUrl });
    return () => {
      if (introUrl) URL.revokeObjectURL(introUrl);
      if (outroUrl) URL.revokeObjectURL(outroUrl);
    };
  }, [introVideoFile, outroVideoFile]);

  // GSAP 인트로/아웃트로 렌더러는 별도 청크로 지연 로드
  useEffect(() => {
    let alive = true;
    import('../../services/previewCompositorIntroOutro.ts')
      .then((m) => {
        if (alive) {
          introOutroRef.current = m;
          setRendererReady(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 오버레이는 현재 캔버스에 그려진 컷에만 바인딩한다. 인트로·아웃트로 화면 위에
  // 선택한 컷의 자막·위치가 겹치지 않도록 selectedSegmentId 폴백을 쓰지 않는다.
  const activeItem = resolveTimelineItem(model, playhead);
  const activeSegment = activeItem?.kind === 'segment' ? activeItem.segment ?? null : null;

  /**
   * 모든 원본을 동시에 마운트하지 않고 활성 컷 + 다음 컷(최대 2개)만 <video>로 유지한다.
   * 분석/내보내기 중에는 예열 슬롯을 끄고 활성 1개도 metadata로만 연다.
   */
  const slotSpecs = useMemo(
    () =>
      resolvePreviewVideoSlots(model, activeSegment, playhead, {
        isExporting,
        isProcessing,
      }),
    [model, activeSegment, playhead, isExporting, isProcessing]
  );

  /** 네이티브 디코더 슬롯을 즉시 반환한다(DOM 노드는 React가 정리). */
  const releaseSlotVideo = useCallback((video: HTMLVideoElement) => {
    try {
      video.pause();
      releasedVideos.current.add(video);
      video.removeAttribute('src');
      video.load();
    } catch {
      /* 무시 */
    }
  }, []);

  const markVideoFailed = useCallback((id: string) => {
    setFailedVideoIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const handleSourceVideoReady = useCallback((id: string) => {
    setFailedVideoIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /**
   * <video> 디코더 오류를 조용히 삼키지 않고 기록한 뒤 1회 재로드, 그래도 실패하면
   * 썸네일/WebCodecs 시각 폴백으로 전환한다.
   */
  const handleSourceVideoError = useCallback(
    (id: string, el: HTMLVideoElement) => {
      if (releasedVideos.current.has(el)) return;
      const mediaError = el.error;
      console.warn('[CenterPreviewStage] 미리보기 영상 디코더 오류', {
        videoId: id,
        code: mediaError?.code,
        message: mediaError?.message,
      });
      const retries = errorRetries.current.get(id) ?? 0;
      if (retries < 1) {
        errorRetries.current.set(id, retries + 1);
        setTimeout(() => {
          const current = videoRefs.current.get(id);
          if (!current || releasedVideos.current.has(current)) return;
          try {
            current.load();
          } catch {
            /* 무시 */
          }
        }, 300);
        return;
      }
      markVideoFailed(id);
    },
    [markVideoFailed]
  );

  /** ref 콜백은 렌더마다 새로 만들면 매번 null→element가 호출되어 디코더가 초기화된다. */
  const getVideoRefCallback = useCallback(
    (videoId: string) => {
      let callback = videoRefCallbacks.current.get(videoId);
      if (!callback) {
        callback = (el) => {
          if (el) {
            videoRefs.current.set(videoId, el);
            releasedVideos.current.delete(el);
            errorRetries.current.delete(videoId);
          } else {
            const previous = videoRefs.current.get(videoId);
            if (previous) {
              releaseSlotVideo(previous);
              videoRefs.current.delete(videoId);
              seekedOnce.current.delete(videoId);
            }
          }
        };
        videoRefCallbacks.current.set(videoId, callback);
      }
      return callback;
    },
    [releaseSlotVideo]
  );

  // 구간 진행률에 맞춰 직접 업로드한 영상의 프레임을 동기화한다(모션 캔버스 대신 표시).
  useEffect(() => {
    if (!activeItem || (activeItem.kind !== 'intro' && activeItem.kind !== 'outro')) return;
    const isIntro = activeItem.kind === 'intro';
    const file = isIntro ? introVideoFile : outroVideoFile;
    const video = isIntro ? customIntroVideoRef.current : customOutroVideoRef.current;
    if (!file || !video || video.readyState < 1) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const progress = Math.max(
      0,
      Math.min(1, (playhead - activeItem.start) / Math.max(0.01, activeItem.end - activeItem.start))
    );
    const target = progress * video.duration;
    if (Math.abs(video.currentTime - target) > 0.08) {
      try {
        video.currentTime = target;
      } catch {
        /* 아직 seek 불가 */
      }
    }
  }, [playhead, activeItem, introVideoFile, outroVideoFile, customVideoUrls, redrawTick]);

  // 숨김 <video>를 재생 클록으로 동기화한다.
  // readyState >= 1(HAVE_METADATA)에서 바로 시크를 걸어 프레임 디코딩을 깨운다.
  // 예전에는 readyState < 2에서 일찍 return 해 시크가 호출되지 않고 영구 정지했다.
  useEffect(() => {
    const sources = videoRefs.current;
    const activeId = activeSegment?.sourceVideoId;

    // 현재 컷이 아닌 숨김 영상은 모두 멈춘다(디코더 슬롯 낭비 방지).
    for (const [id, video] of sources) {
      if (id !== activeId && !video.paused) {
        try {
          video.pause();
        } catch {
          /* 무시 */
        }
      }
    }

    if (!activeSegment || !activeItem || activeItem.kind !== 'segment') {
      for (const video of sources.values()) {
        if (!video.paused) {
          try {
            video.pause();
          } catch {
            /* 무시 */
          }
        }
      }
      return;
    }
    const video = sources.get(activeSegment.sourceVideoId);
    if (!video || video.readyState < 1) return;

    const local = Math.max(0, Math.min(activeSegment.duration || 0, playhead - activeItem.start));
    const targetTime = Math.max(0, (activeSegment.start || 0) + local);
    const firstSeek = firstFrameSeekTime(
      targetTime,
      seekedOnce.current.has(activeSegment.sourceVideoId)
    );
    const desired = firstSeek ?? targetTime;

    if (!isPlaying) {
      if (!video.paused) {
        try {
          video.pause();
        } catch {
          /* 무시 */
        }
      }
      // 일시정지 중 스크러빙/컷 선택 시 해당 시점의 프레임으로 정확히 맞춘다.
      if (firstSeek !== null || needsPreviewSeek(video.currentTime, desired, false)) {
        try {
          video.currentTime = desired;
          seekedOnce.current.add(activeSegment.sourceVideoId);
        } catch {
          /* 아직 seek 불가 */
        }
      }
      return;
    }

    if (video.paused) {
      // 재생 시작/컷 전환 직후에는 정확한 소스 시점으로 맞춘 뒤 재생한다.
      if (firstSeek !== null || Math.abs(video.currentTime - desired) > 0.05) {
        try {
          video.currentTime = desired;
          seekedOnce.current.add(activeSegment.sourceVideoId);
        } catch {
          /* 아직 seek 불가 */
        }
      }
      // 영상이 자연스럽게 끝난 경우(다음 컷 경계 직전) 되감아 다시 재생하지 않는다.
      if (video.currentTime < (activeSegment.end ?? Number.POSITIVE_INFINITY) - 0.02) {
        const p = video.play();
        if (p) p.catch(() => {});
      }
    } else if (needsPreviewSeek(video.currentTime, targetTime, true)) {
      // 탭 백그라운드 복귀 등으로 타임라인과 어긋났을 때만 보정한다.
      try {
        video.currentTime = targetTime;
      } catch {
        /* 아직 seek 불가 */
      }
    }
  }, [isPlaying, playhead, activeItem, activeSegment, redrawTick]);

  // GPU 프로세스 크래시/재시작 후 캔버스 컨텍스트를 복구한다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onLost = (event: Event) => {
      event.preventDefault();
      console.warn('[CenterPreviewStage] 미리보기 캔버스 컨텍스트 손실 — 복구 대기');
    };
    const onRestored = () => {
      console.info('[CenterPreviewStage] 미리보기 캔버스 컨텍스트 복구');
      bumpRedraw();
    };
    canvas.addEventListener('contextlost', onLost);
    canvas.addEventListener('contextrestored', onRestored);
    return () => {
      canvas.removeEventListener('contextlost', onLost);
      canvas.removeEventListener('contextrestored', onRestored);
    };
  }, [bumpRedraw]);

  // 스튜디오를 나갈 때 숨김 영상/사용자 영상이 계속 디코딩하지 않도록 정리한다.
  useEffect(() => {
    return () => {
      for (const video of videoRefs.current.values()) {
        releaseSlotVideo(video);
      }
      videoRefs.current.clear();
      customIntroVideoRef.current?.pause();
      customOutroVideoRef.current?.pause();
    };
  }, [releaseSlotVideo]);

  // 프레임 렌더 — playhead가 바뀔 때마다 캔버스에 현재 합성 결과를 그린다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, frame.width, frame.height);

    if (!activeItem) return;

    if (activeItem.kind === 'segment' && activeItem.segment) {
      const seg = activeItem.segment;
      const source = videos.find((v) => v.id === seg.sourceVideoId);
      const video = videoRefs.current.get(seg.sourceVideoId);
      const videoReady = Boolean(video && video.readyState >= 2 && video.videoWidth > 0);

      if (video && videoReady && !failedVideoIds.has(seg.sourceVideoId)) {
        drawCompositorCoverFrame(ctx, video, source, seg, frame);
      } else if (source) {
        // 이미지 폴백은 회전이 픽셀에 구워져 있으므로 회전값을 다시 적용하지 않는다.
        const flatSegment = { ...seg, rotation: 0 };
        const flatSource = { ...source, rotation: 0 };
        // 1단계: 분석 중 생성된 썸네일을 즉시 깔아 검은 화면을 없앤다.
        const thumbnail = getCachedThumbnail(source.thumbnailUrl, bumpRedraw);
        if (thumbnail) {
          drawCompositorCoverFrame(ctx, thumbnail, flatSource, flatSegment, frame);
        } else if (failedVideoIds.has(seg.sourceVideoId)) {
          // 2단계: <video> 복구 불가 영상은 WebCodecs로 컷 시점 키프레임을 1회 디코딩한다.
          const key = `${seg.sourceVideoId}:${seg.id}`;
          const cachedUrl = getCachedCodecFrame(key);
          const frameImage = cachedUrl ? getCachedThumbnail(cachedUrl, bumpRedraw) : null;
          if (frameImage) {
            drawCompositorCoverFrame(ctx, frameImage, flatSource, flatSegment, frame);
          } else if (!cachedUrl) {
            const local = Math.max(0, Math.min(seg.duration || 0, playhead - activeItem.start));
            const targetTime = Math.max(0, (seg.start || 0) + local);
            requestCodecFrame(
              key,
              source.file,
              targetTime,
              seg.rotation ?? source.rotation,
              frame.width,
              bumpRedraw
            );
          }
        }
      }
      // 영상이 아직 준비 안 됐어도 날짜·위치·자막은 표시한다.
      // 인라인 편집 중에는 DOM 입력창이 같은 자리를 대체하므로 해당 캔버스 텍스트만 숨긴다.
      drawCompositorSegmentOverlay(ctx, overlayOptions, seg, frame, {
        hideSubtitle: isEditingCaption,
        hideTitle: isEditingTitle,
      });
      return;
    }

    const renderer = introOutroRef.current;
    if (!renderer) return;
    const progress = Math.max(
      0,
      Math.min(1, (playhead - activeItem.start) / Math.max(0.01, activeItem.end - activeItem.start))
    );
    if (activeItem.kind === 'intro') {
      renderer.drawCompositorIntroFrame(ctx, progress, overlayOptions, frame);
    } else if (activeItem.kind === 'outro') {
      renderer.drawCompositorOutroFrame(ctx, progress, overlayOptions, frame);
    }
  }, [
    playhead,
    activeItem,
    frame,
    overlayOptions,
    videos,
    rendererReady,
    redrawTick,
    isEditingCaption,
    isEditingTitle,
    revision,
    failedVideoIds,
    bumpRedraw,
  ]);

  const hasContent = model.items.length > 0;
  const locationLabel = activeSegment?.locationName || overlayOptions.subtitleLocationText || '';
  // 캔버스와 같은 폴백을 사용한다. 빈 문자열로 지운 컷은 reason으로 되돌아가지 않고 '자막 추가'만 보인다.
  const captionLabel = activeSegment?.subtitleTitle ?? activeSegment?.reason ?? '';
  // 위치 히트 영역이 실제 캔버스 텍스트와 픽셀 단위로 같은 자리에 오도록 배치를 공유한다.
  const metaLayout = useMemo(() => {
    const { dateText, locationText } = resolveMetaTexts(overlayOptions, activeSegment ?? undefined);
    return computeMetaLayoutFromTexts(dateText, locationText, frame);
  }, [overlayOptions, activeSegment, frame, revision]);
  const previewLabel = previewRange
    ? (previewRange.kind === 'intro' ? introVideoFile : outroVideoFile)
      ? ui('직접 올린 영상')
      : getLocalizedTemplateMeta(
          dict,
          previewRange.kind,
          previewRange.kind === 'intro' ? overlayOptions.introTemplate : overlayOptions.outroTemplate
        ).name
    : '';

  // 컷이 없어도 빈 화면 대신 영상 미리보기 박스를 보여준다.
  if (!hasContent) {
    return (
      <div className="sv2-preview-empty" data-orientation={orientation}>
        <Tilt maxTilt={8} className="sv2-preview-empty-tilt">
          <TiltContent className="sv2-preview-empty-card">
            <span className="sv2-preview-empty-sheen" aria-hidden="true" />
            <span className="sv2-preview-empty-play" aria-hidden="true">
              <Play size={26} fill="currentColor" strokeWidth={1.5} />
            </span>
          </TiltContent>
        </Tilt>
        <div className="sv2-preview-empty-copy">
          <strong>{ui('영상을 추가하면 미리보기가 나타나요')}</strong>
          <span>{ui('원본 영상을 올리면 컷과 자막을 여기서 확인할 수 있어요')}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sv2-stage-meta">
        <div className="sv2-stage-meta-sub">
          {ui('{count}개 컷 · 제목·날짜·위치나 자막을 눌러 바로 수정할 수 있어요', {
            count: model.items.filter((i) => i.kind === 'segment').length,
          })}
        </div>
      </div>

      <div
        className="sv2-preview-frame"
        data-orientation={orientation}
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
      >
        <canvas
          ref={canvasRef}
          width={frame.width}
          height={frame.height}
          aria-label={ui('영상 미리보기')}
        />
        {slotSpecs.map(({ videoId, preload }) => {
          const sourceVideo = videos.find((v) => v.id === videoId);
          if (!sourceVideo) return null;
          return (
            <video
              key={videoId}
              className="sv2-preview-source-video"
              ref={getVideoRefCallback(videoId)}
              src={sourceVideo.url}
              muted={isMuted}
              playsInline
              preload={preload}
              onLoadedMetadata={bumpRedraw}
              onCanPlay={() => {
                handleSourceVideoReady(videoId);
                bumpRedraw();
              }}
              onLoadedData={() => {
                handleSourceVideoReady(videoId);
                bumpRedraw();
              }}
              onSeeked={() => {
                seekedOnce.current.add(videoId);
                bumpRedraw();
              }}
              onError={(event) => handleSourceVideoError(videoId, event.currentTarget)}
            />
          );
        })}
        {activeItem?.kind === 'intro' && introVideoFile && customVideoUrls.intro && (
          <video
            ref={customIntroVideoRef}
            className="sv2-preview-custom-video"
            src={customVideoUrls.intro}
            muted={isMuted}
            playsInline
            preload={isExporting ? 'none' : 'auto'}
            onLoadedMetadata={bumpRedraw}
          />
        )}
        {activeItem?.kind === 'outro' && outroVideoFile && customVideoUrls.outro && (
          <video
            ref={customOutroVideoRef}
            className="sv2-preview-custom-video"
            src={customVideoUrls.outro}
            muted={isMuted}
            playsInline
            preload={isExporting ? 'none' : 'auto'}
            onLoadedMetadata={bumpRedraw}
          />
        )}
        {previewRange && (
          <div className="sv2-preview-badge" aria-live="polite">
            <span className="sv2-preview-badge-dot" data-playing={isPlaying} />
            {ui(previewRange.kind === 'intro' ? '인트로' : '아웃트로')} {ui('미리보기')} · {previewLabel}
          </div>
        )}
        {activeSegment && (
          <PreviewInteractiveOverlay
            key={activeSegment.id}
            frame={frame}
            title={overlayOptions.titleText || ''}
            showTitle={overlayOptions.showTitle !== false}
            locationLabel={locationLabel}
            dateLabel={formatShootDate(activeSegment)}
            metaLayout={metaLayout}
            caption={captionLabel}
            onLocationClick={() => onOpenLocation(activeSegment.id)}
            onTitleCommit={(text) => onUpdateOverlay({ titleText: text, showTitle: true })}
            onCaptionCommit={(text) =>
              onUpdateSegment(activeSegment.id, { subtitleTitle: text })
            }
            onEditingChange={(kind, editing) => {
              // 편집 시작 시 재생을 멈춰 컷이 바뀌는 동안 드래프트가 날아가지 않게 한다.
              if (editing) onPause();
              if (kind === 'title') setIsEditingTitle(editing);
              else setIsEditingCaption(editing);
            }}
            showSubtitle={overlayOptions.showSubtitle !== false}
            showLocation={overlayOptions.showLocation !== false}
          />
        )}
      </div>

      <PreviewDisplayToggles overlayOptions={overlayOptions} onUpdateOverlay={onUpdateOverlay} />

      <div className="sv2-transport">
        <button
          type="button"
          className="sv2-play-btn"
          onClick={onTogglePlay}
          aria-label={isPlaying ? ui('일시정지') : ui('재생')}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <Tooltip content={isMuted ? t('player.unmute') : t('player.mute')}>
          <button
            type="button"
            className="sv2-sound-btn"
            onClick={onToggleMute}
            aria-label={isMuted ? t('player.unmute') : t('player.mute')}
            aria-pressed={!isMuted}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </Tooltip>
        <span className="sv2-transport-time">
          {formatClock(playhead)} / {formatClock(totalDuration)}
        </span>
        <input
          className="sv2-scrub"
          type="range"
          min={0}
          max={Math.max(0.1, totalDuration)}
          step={0.01}
          value={Math.min(playhead, totalDuration)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label={ui('재생 위치')}
        />
      </div>
    </>
  );
};

/** 내보내기 진행률 갱신(상위 리렌더) 때 프리뷰 전체가 다시 그려지지 않도록 분리한다. */
export const CenterPreviewStage = memo(CenterPreviewStageImpl);
