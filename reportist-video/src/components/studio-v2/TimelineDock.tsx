import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  HighlightSegment,
  VideoItem,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { formatClock } from './types.ts';
import {
  buildTimelineLayout,
  timeToTimelineX,
  timelineXToTime,
  type TimelineModel,
} from './timelineModel.ts';
import { TimelineVideoTrack } from './TimelineVideoTrack.tsx';
import { TimelineMusicTrack } from './TimelineMusicTrack.tsx';

// components/studio-v2/TimelineDock.tsx — 하단 트랙 타임라인 + 룰러/플레이헤드.
// 트랙 라벨(56px) + 행 간격(8px). CSS의 .sv2-track-label 폭과 반드시 일치해야 한다.
const TRACK_LABEL_OFFSET = 64;

interface TimelineDockProps {
  segments: HighlightSegment[];
  videos: VideoItem[];
  model: TimelineModel;
  overlayOptions: VideoOverlayOptions;
  selectedSegmentId: string | null;
  landingIds: Set<string>;
  /** 분석 중에는 스트리밍 세그먼트와 충돌하지 않도록 편집을 잠근다. */
  locked?: boolean;
  playhead: number;
  onSeek: (time: number) => void;
  /** 드래그 시작 시 재생을 멈추기 위한 훅(선택). */
  onScrubStart?: () => void;
  bgmPresetId: string;
  bgmVolume: number;
  libraryTrackId: string | null;
  customAudioName: string | null;
  onSelect: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onDelete: (id: string) => void;
  onTrim: (segment: HighlightSegment) => void;
  onOpenLocation: (id: string) => void;
  onOpenIntro: () => void;
  onOpenOutro: () => void;
  onReorder: (from: number, to: number) => void;
  onOpenLibrary: () => void;
  onVolumeChange: (volume: number) => void;
  onRemoveMusic: () => void;
  onPickAudioFile: (file: File) => void;
}

export const TimelineDock = (props: TimelineDockProps) => {
  const { segments, model, playhead, onSeek, onScrubStart } = props;
  const hasSegments = segments.length > 0;
  const layout = useMemo(() => buildTimelineLayout(model), [model]);
  const tracksRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const playheadX = timeToTimelineX(layout, playhead);

  // 플레이헤드가 가로 스크롤 뷰포트 밖으로 나가면 따라 스크롤한다.
  useEffect(() => {
    const el = tracksRef.current;
    if (!el) return;
    const x = TRACK_LABEL_OFFSET + timeToTimelineX(layout, playhead);
    const margin = 48;
    const left = el.scrollLeft;
    const right = left + el.clientWidth;
    if (x > right - margin) {
      el.scrollLeft = x - el.clientWidth + margin;
    } else if (x < left + margin) {
      el.scrollLeft = Math.max(0, x - margin);
    }
  }, [playhead, layout]);

  const ticks = useMemo(() => {
    const total = model.total;
    if (total <= 0) return [];
    const step = total <= 12 ? 1 : total <= 30 ? 2 : 5;
    const result: { x: number; label: string }[] = [];
    for (let t = 0; t <= total; t += step) {
      result.push({ x: timeToTimelineX(layout, t), label: formatClock(t) });
    }
    return result;
  }, [model.total, layout]);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const ruler = rulerRef.current;
      if (!ruler) return;
      const rect = ruler.getBoundingClientRect();
      onSeek(timelineXToTime(layout, clientX - rect.left));
    },
    [layout, onSeek]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsScrubbing(true);
    onScrubStart?.();
    seekFromPointer(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    seekFromPointer(event.clientX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsScrubbing(false);
  };

  return (
    <div className="sv2-timeline">
      <div className="sv2-timeline-head">
        <span className="sv2-timeline-label">타임라인</span>
        <span className="sv2-timeline-hint">
          컷을 끌어 순서를 바꾸고, 클릭해서 트림·회전·자막 수정 · 인트로/아웃트로 설정
        </span>
      </div>
      {hasSegments ? (
        <div className="sv2-tracks" ref={tracksRef}>
          <div className="sv2-tracks-inner">
            <div className="sv2-ruler-row">
              <div className="sv2-track-label sv2-ruler-label" aria-hidden="true" />
              <div
                className="sv2-ruler"
                ref={rulerRef}
                style={{ width: layout.totalWidth }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                role="slider"
                aria-label="타임라인 재생 위치"
                aria-valuemin={0}
                aria-valuemax={Math.round(model.total)}
                aria-valuenow={Math.round(playhead)}
                aria-valuetext={formatClock(playhead)}
                tabIndex={0}
              >
                {ticks.map((tick) => (
                  <div key={tick.label} className="sv2-ruler-tick" style={{ left: tick.x }}>
                    <span className="sv2-ruler-tick-label">{tick.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sv2-track-lanes">
              <TimelineVideoTrack {...props} layout={layout} playhead={playhead} onSeek={onSeek} />
              <TimelineMusicTrack
                {...props}
                onRemove={props.onRemoveMusic}
                onPickFile={props.onPickAudioFile}
              />
            </div>

            <div
              className="sv2-playhead"
              data-scrubbing={isScrubbing}
              style={{ transform: `translate3d(${TRACK_LABEL_OFFSET + playheadX}px, 0, 0)` }}
            >
              <div className="sv2-playhead-handle" />
              <div className="sv2-playhead-badge">{formatClock(playhead)}</div>
              <div className="sv2-playhead-line" />
            </div>
          </div>
        </div>
      ) : (
        <div className="sv2-tracks" ref={tracksRef}>
          <TimelineMusicTrack
            {...props}
            onRemove={props.onRemoveMusic}
            onPickFile={props.onPickAudioFile}
          />
          <div className="sv2-timeline-empty">
            AI 컷 분석이 끝나면 여기에 영상 트랙이 채워집니다. 음악은 미리 1곡 넣어둘 수 있어요.
          </div>
        </div>
      )}
    </div>
  );
};
