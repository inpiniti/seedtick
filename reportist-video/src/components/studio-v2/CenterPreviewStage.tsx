import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
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
import { resolveTimelineItem, type TimelineModel } from './timelineModel.ts';
import { PreviewInteractiveOverlay } from './PreviewInteractiveOverlay.tsx';
import { EmptyStageAnimation } from './EmptyStageAnimation.tsx';

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
  /** 설정 모달에서 날짜 형식·나이 옵션을 바꾼 경우 캔버스를 다시 그리기 위한 신호. */
  revision?: number;
  onTogglePlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onOpenLocation: (segmentId: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onUpdateOverlay: (patch: Partial<VideoOverlayOptions>) => void;
}

export const CenterPreviewStage = ({
  frame,
  model,
  playhead,
  isPlaying,
  videos,
  overlayOptions,
  orientation,
  totalDuration,
  previewRange,
  revision = 0,
  onTogglePlay,
  onPause,
  onSeek,
  onOpenLocation,
  onUpdateSegment,
  onUpdateOverlay,
}: CenterPreviewStageProps) => {
  const { dict, ui } = useI18n();
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

  // 컷이 없으면 미리보기·재생바 대신 흑백 펭귄 산책 연출을 보여준다.
  if (!hasContent) return <EmptyStageAnimation />;

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
        {activeItem?.kind === 'intro' && introVideoFile && customVideoUrls.intro && (
          <video
            ref={customIntroVideoRef}
            className="sv2-preview-custom-video"
            src={customVideoUrls.intro}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={() => setRedrawTick((t) => t + 1)}
          />
        )}
        {activeItem?.kind === 'outro' && outroVideoFile && customVideoUrls.outro && (
          <video
            ref={customOutroVideoRef}
            className="sv2-preview-custom-video"
            src={customVideoUrls.outro}
            muted
            playsInline
            preload="auto"
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

      <div className="sv2-transport">
        <button
          type="button"
          className="sv2-play-btn"
          onClick={onTogglePlay}
          aria-label={isPlaying ? ui('일시정지') : ui('재생')}
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
          aria-label={ui('재생 위치')}
        />
      </div>
    </>
  );
};
