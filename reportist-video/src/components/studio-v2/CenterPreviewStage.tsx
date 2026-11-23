import { useEffect, useRef, useState } from 'react';
import { Film, Pause, Play } from 'lucide-react';
import {
  drawCompositorCoverFrame,
  drawCompositorSegmentOverlay,
} from '../../services/previewCompositorBase.ts';
import type { FrameSpec } from '../../services/frameSpec.ts';
import type {
  HighlightSegment,
  VideoItem,
  VideoOrientation,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { formatClock, formatShootDate } from './types.ts';
import { resolveTimelineItem, type TimelineModel } from './timelineModel.ts';
import { PreviewInteractiveOverlay } from './PreviewInteractiveOverlay.tsx';

type IntroOutroModule = typeof import('../../services/previewCompositorIntroOutro.ts');

interface CenterPreviewStageProps {
  frame: FrameSpec;
  model: TimelineModel;
  playhead: number;
  isPlaying: boolean;
  videos: VideoItem[];
  overlayOptions: VideoOverlayOptions;
  selectedSegmentId: string | null;
  orientation: VideoOrientation;
  totalDuration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onOpenLocation: (segmentId: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
}

export const CenterPreviewStage = ({
  frame,
  model,
  playhead,
  isPlaying,
  videos,
  overlayOptions,
  selectedSegmentId,
  orientation,
  totalDuration,
  onTogglePlay,
  onSeek,
  onOpenLocation,
  onUpdateSegment,
}: CenterPreviewStageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const introOutroRef = useRef<IntroOutroModule | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);

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

  const activeItem = resolveTimelineItem(model, playhead);
  const activeSegment = activeItem?.kind === 'segment' ? activeItem.segment ?? null : null;
  const effectiveSegment =
    model.items.find((i) => i.segment?.id === selectedSegmentId)?.segment ?? activeSegment;

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
        const local = Math.max(0, Math.min(seg.duration || 0, playhead - activeItem.start));
        const targetTime = Math.max(0, (seg.start || 0) + local);
        if (Math.abs(video.currentTime - targetTime) > 0.25) {
          try {
            video.currentTime = targetTime;
          } catch {
            /* 아직 seek 불가 */
          }
        }
        drawCompositorCoverFrame(ctx, video, source, seg, frame);
      }
      // 영상이 아직 준비 안 됐어도 날짜·위치·자막은 검은 화면에 표시
      drawCompositorSegmentOverlay(ctx, overlayOptions, seg, frame);
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
  }, [playhead, activeItem, frame, overlayOptions, videos, rendererReady, redrawTick]);

  const hasContent = model.items.length > 0;
  const locationLabel =
    effectiveSegment?.locationName || overlayOptions.subtitleLocationText || '';
  const captionLabel = effectiveSegment?.subtitleTitle || '';

  return (
    <>
      <div className="sv2-stage-meta">
        <div className="sv2-stage-meta-sub">
          {hasContent
            ? `${model.items.filter((i) => i.kind === 'segment').length}개 컷 · 날짜·위치나 자막을 눌러 바로 수정할 수 있어요`
            : '영상을 추가하면 여기에 미리보기가 나타나요'}
        </div>
      </div>

      {hasContent ? (
        <div
          className="sv2-preview-frame"
          data-orientation={orientation}
          style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        >
          <canvas
            ref={canvasRef}
            width={frame.width}
            height={frame.height}
            aria-label="영상 미리보기"
          />
          {videos.map((video) => (
            <video
              key={video.id}
              ref={(el) => {
                if (el) videoRefs.current.set(video.id, el);
                else videoRefs.current.delete(video.id);
              }}
              src={video.url}
              muted
              playsInline
              preload="auto"
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
          <PreviewInteractiveOverlay
            locationLabel={locationLabel}
            dateLabel={formatShootDate(effectiveSegment)}
            caption={captionLabel}
            enabled={Boolean(effectiveSegment)}
            onLocationClick={() =>
              effectiveSegment && onOpenLocation(effectiveSegment.id)
            }
            onCaptionCommit={(text) =>
              effectiveSegment && onUpdateSegment(effectiveSegment.id, { subtitleTitle: text })
            }
          />
        </div>
      ) : (
        <div className="sv2-preview-frame" data-orientation={orientation}>
          <div className="sv2-preview-empty">
            <div className="sv2-empty-icon"><Film size={28} /></div>
            <strong>영상을 추가하면 여기에 미리보기가 나타나요</strong>
            <span>영상을 올리면 왼쪽에 파일이 나열되고, AI 컷을 누르면 타임라인에 채워져요.</span>
          </div>
        </div>
      )}

      <div className="sv2-transport">
        <button
          type="button"
          className="sv2-play-btn"
          onClick={onTogglePlay}
          disabled={!hasContent}
          aria-label={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
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
          disabled={!hasContent}
          aria-label="재생 위치"
        />
      </div>
    </>
  );
};
