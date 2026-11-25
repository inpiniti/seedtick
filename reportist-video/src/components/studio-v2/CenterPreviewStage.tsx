import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Tilt, TiltContent } from '@animate-ui/react/primitives/effects/tilt';
import {
  computeMetaLayoutFromTexts,
  drawCompositorCoverFrame,
  drawCompositorSegmentOverlay,
  resolveMetaTexts,
} from '../../services/previewCompositorBase.ts';
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
  const introOutroRef = useRef<IntroOutroModule | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const customIntroVideoRef = useRef<HTMLVideoElement>(null);
  const customOutroVideoRef = useRef<HTMLVideoElement>(null);
  const [customVideoUrls, setCustomVideoUrls] = useState<{ intro?: string; outro?: string }>({});

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
  // 예전에는 currentTime을 0.25초 이상 어긋날 때만 seek했고 영상 자체를 재생하지
  // 않았기 때문에, 정지된 프레임이 0.25초마다 한 번 바뀌는 ~4fps로 끊겨 보였다.
  // 재생 중에는 실제 비디오를 1배속으로 돌려 매 프레임 새 프레임을 그리게 하고,
  // 재생 시작/컷 전환/큰 드리프트에서만 seek해 디코더 플러시를 최소화한다.
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
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    const local = Math.max(0, Math.min(activeSegment.duration || 0, playhead - activeItem.start));
    const targetTime = Math.max(0, (activeSegment.start || 0) + local);
    const drift = Math.abs(video.currentTime - targetTime);

    if (!isPlaying) {
      if (!video.paused) {
        try {
          video.pause();
        } catch {
          /* 무시 */
        }
      }
      // 일시정지 중 스크러빙/컷 선택 시 해당 시점의 프레임으로 정확히 맞춘다.
      if (drift > 0.03) {
        try {
          video.currentTime = targetTime;
        } catch {
          /* 아직 seek 불가 */
        }
      }
      return;
    }

    if (video.paused) {
      // 재생 시작/컷 전환 직후에는 정확한 소스 시점으로 맞춘 뒤 재생한다.
      if (drift > 0.05) {
        try {
          video.currentTime = targetTime;
        } catch {
          /* 아직 seek 불가 */
        }
      }
      // 영상이 자연스럽게 끝난 경우(다음 컷 경계 직전) 되감아 다시 재생하지 않는다.
      if (video.currentTime < (activeSegment.end ?? Number.POSITIVE_INFINITY) - 0.02) {
        const p = video.play();
        if (p) p.catch(() => {});
      }
    } else if (drift > 0.3) {
      // 탭 백그라운드 복귀 등으로 타임라인과 어긋났을 때만 보정한다.
      try {
        video.currentTime = targetTime;
      } catch {
        /* 아직 seek 불가 */
      }
    }
  }, [isPlaying, playhead, activeItem, activeSegment]);

  // 스튜디오를 나갈 때 숨김 영상/사용자 영상이 계속 디코딩하지 않도록 정리한다.
  useEffect(() => {
    return () => {
      for (const video of videoRefs.current.values()) {
        try {
          video.pause();
        } catch {
          /* 무시 */
        }
      }
      customIntroVideoRef.current?.pause();
      customOutroVideoRef.current?.pause();
    };
  }, []);

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
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        drawCompositorCoverFrame(ctx, video, source, seg, frame);
      }
      // 영상이 아직 준비 안 됐어도 날짜·위치·자막은 검은 화면에 표시.
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
  }, [playhead, activeItem, frame, overlayOptions, videos, rendererReady, redrawTick, isEditingCaption, isEditingTitle, revision]);

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
        {videos.map((video) => (
          <video
            key={video.id}
            ref={(el) => {
              if (el) videoRefs.current.set(video.id, el);
              else videoRefs.current.delete(video.id);
            }}
            src={video.url}
            muted={isMuted}
            playsInline
            preload={isExporting ? 'none' : 'auto'}
            onLoadedData={() => setRedrawTick((t) => t + 1)}
            onSeeked={() => setRedrawTick((t) => t + 1)}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
              left: -9999,
            }}
          />
        ))}
        {activeItem?.kind === 'intro' && introVideoFile && customVideoUrls.intro && (
          <video
            ref={customIntroVideoRef}
            className="sv2-preview-custom-video"
            src={customVideoUrls.intro}
            muted={isMuted}
            playsInline
            preload={isExporting ? 'none' : 'auto'}
            onLoadedMetadata={() => setRedrawTick((t) => t + 1)}
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
            onLoadedMetadata={() => setRedrawTick((t) => t + 1)}
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
