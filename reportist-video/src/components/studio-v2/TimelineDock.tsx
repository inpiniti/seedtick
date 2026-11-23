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
import { useI18n } from '../../i18n/index.tsx';
import { formatClock } from './types.ts';
import {
  buildTimelineLayout,
  timeToTimelineX,
  timelineXToTime,
  type TimelineLayout,
  type TimelineModel,
} from './timelineModel.ts';
import { TimelineVideoTrack } from './TimelineVideoTrack.tsx';
import { TimelineMusicTrack } from './TimelineMusicTrack.tsx';

// components/studio-v2/TimelineDock.tsx — 하단 트랙 타임라인 + 룰러/플레이헤드.
// 트랙 라벨(72px, 영어/프랑스어 등 긴 이름 대응) + 행 간격(8px).
// CSS의 .sv2-track-label 폭과 반드시 일치해야 한다.
const TRACK_LABEL_OFFSET = 80;

interface TimelineDockProps {
  segments: HighlightSegment[];
  videos: VideoItem[];
  model: TimelineModel;
  overlayOptions: VideoOverlayOptions;
  selectedSegmentId: string | null;
  landingIds: Set<string>;
  /** 원본 삭제 연출 중 타임라인에서 숨길 컷 id */
  returningIds?: Set<string>;
  /** 분석 중에는 스트리밍 세그먼트와 충돌하지 않도록 편집을 잠근다. */
  locked?: boolean;
  /** 상위에서 미리 계산한 레이아웃을 넘기면 재계산 없이 그대로 사용한다. */
  layout?: TimelineLayout;
  /** 자막 정제 반영 후 짧게 강조 연출을 주기 위한 플래그. */
  subtitleRefreshed?: boolean;
  playhead: number;
  onSeek: (time: number) => void;
  /** 드래그 시작 시 재생을 멈추기 위한 훅(선택). */
  onScrubStart?: () => void;
  bgmPresetId: string;
  bgmVolume: number;
  libraryTrackId: string | null;
  customAudioName: string | null;
  /** 음악 트랙의 '교체' 버튼 등에서 오른쪽 인스펙터를 연다. */
  onOpenMusic: () => void;
  /** 음악 칩 클릭 시 오른쪽 인스펙터를 열거나, 이미 열려 있으면 닫는다. */
  onToggleMusic: () => void;
  /** 음악 인스펙터가 열려 있는지 (칩 활성 상태 표시). */
  musicInspectorOpen: boolean;
  onSelect: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onDelete: (id: string) => void;
  onTrim: (segment: HighlightSegment) => void;
  onOpenLocation: (id: string) => void;
  onOpenIntro: () => void;
  onOpenOutro: () => void;
  onReorder: (from: number, to: number) => void;
  onVolumeChange: (volume: number) => void;
  onRemoveMusic: () => void;
  onFitChange?: (fit: boolean) => void;
}

export const TimelineDock = (props: TimelineDockProps) => {
  const { ui } = useI18n();
  const { segments, model, playhead, onSeek, onScrubStart } = props;
  const hasSegments = segments.length > 0;
  const tracksRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [laneWidth, setLaneWidth] = useState(0);

  // 트랙 뷰포트 폭을 관찰해 칩이 가용 너비를 채우도록 레이아웃 스케일을 다시 계산한다.
  // 좌측 업로드 도크가 접히면 뷰포트가 커지고, ResizeObserver가 이를 따라 확장한다.
  useEffect(() => {
    const el = tracksRef.current;
    if (!el) return;
    const measure = () => {
      // 트랙 라벨(72px) + 행 간격(8px), 가로 스크롤바 여유 2px를 뺀 레인 가용 폭.
      const next = Math.max(0, Math.round(el.clientWidth - TRACK_LABEL_OFFSET - 2));
      setLaneWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasSegments]);

  const computedLayout = useMemo(
    () => buildTimelineLayout(model, { availableWidth: laneWidth }),
    [model, laneWidth]
  );
  const layout = props.layout ?? computedLayout;

  // 칩이 레인 안에 다 들어가면 룰러 라벨·재생 배지 같은 장식 요소가 만드는
  // 몇 픽셀 넘침 때문에 스크롤바가 뜨지 않도록 클립 모드로 전환한다.
  // 컷이 많아 정말 넘치면(auto) 기존처럼 가로 스크롤을 허용한다.
  const fitsLane = laneWidth > 0 && layout.totalWidth <= laneWidth;

  const playheadX = timeToTimelineX(layout, playhead);
  const playheadAtEnd = layout.totalWidth > 0 && playheadX >= layout.totalWidth - 56;

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
        <span className="sv2-timeline-label">{ui('타임라인')}</span>
        <span className="sv2-timeline-hint">
          {ui('컷을 클릭하면 미리보기에서 자막·위치를 바로 수정할 수 있어요 · 룰러를 드래그해 재생 위치를 옮기세요')}
        </span>
      </div>
      {hasSegments ? (
        <div className={`sv2-tracks${fitsLane ? ' sv2-tracks--fit' : ''}`} ref={tracksRef}>
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
                aria-label={ui('타임라인 재생 위치')}
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
                layout={layout}
                bgmFitToVideo={props.overlayOptions?.bgmFitToVideo ?? false}
                onRemove={props.onRemoveMusic}
              />
            </div>

            <div
              className="sv2-playhead"
              data-scrubbing={isScrubbing}
              data-at-end={playheadAtEnd}
              style={{ transform: `translate3d(${TRACK_LABEL_OFFSET + playheadX}px, 0, 0)` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="sv2-playhead-handle" />
              <div className="sv2-playhead-badge">{formatClock(playhead)}</div>
              <div className="sv2-playhead-line" />
            </div>
          </div>
        </div>
      ) : (
        <div className={`sv2-tracks${fitsLane ? ' sv2-tracks--fit' : ''}`} ref={tracksRef}>
          <TimelineMusicTrack
            {...props}
            bgmFitToVideo={props.overlayOptions?.bgmFitToVideo ?? false}
            onRemove={props.onRemoveMusic}
          />
          <div className="sv2-timeline-empty">
            {ui('AI 컷 분석이 끝나면 영상 트랙이 채워지고, 미리보기에서 자막을 바로 수정할 수 있어요. 음악은 미리 넣어둘 수 있어요.')}
          </div>
        </div>
      )}
    </div>
  );
};
