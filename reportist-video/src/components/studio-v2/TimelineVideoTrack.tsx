import { Scissors, Trash2, RotateCw, MapPin, Clapperboard, Flag } from 'lucide-react';
import type { HighlightSegment, VideoItem, VideoOverlayOptions } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { formatShootDate } from './types.ts';
import type { TimelineLayout, TimelineModel } from './timelineModel.ts';

// components/studio-v2/TimelineVideoTrack.tsx — [인트로] + 컷 블록 + [아웃트로]

interface TimelineVideoTrackProps {
  segments: HighlightSegment[];
  videos: VideoItem[];
  model: TimelineModel;
  overlayOptions: VideoOverlayOptions;
  selectedSegmentId: string | null;
  landingIds: Set<string>;
  /** 원본 삭제 연출 중 타임라인에서 숨길 컷 id */
  returningIds?: Set<string>;
  locked?: boolean;
  layout: TimelineLayout;
  playhead: number;
  onSeek: (time: number) => void;
  onSelect: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onDelete: (id: string) => void;
  onTrim: (segment: HighlightSegment) => void;
  onOpenLocation: (id: string) => void;
  onOpenIntro: () => void;
  onOpenOutro: () => void;
  onReorder: (from: number, to: number) => void;
}

export const TimelineVideoTrack = ({
  segments,
  videos,
  model,
  overlayOptions,
  selectedSegmentId,
  landingIds,
  returningIds,
  locked = false,
  layout,
  playhead,
  onSeek,
  onSelect,
  onUpdateSegment,
  onDelete,
  onTrim,
  onOpenLocation,
  onOpenIntro,
  onOpenOutro,
  onReorder,
}: TimelineVideoTrackProps) => {
  const { ui } = useI18n();
  const thumbFor = (seg: HighlightSegment) =>
    videos.find((v) => v.id === seg.sourceVideoId)?.thumbnailUrl;

  const spanFor = (key: string) => layout.spans.find((span) => span.key === key);
  const chipStyle = (key: string) => {
    const span = spanFor(key);
    return span ? { width: span.width, minWidth: span.width, maxWidth: span.width } : undefined;
  };
  const isPlaying = (key: string) => {
    const span = spanFor(key);
    return Boolean(span && span.active && playhead >= span.start && playhead < span.end);
  };
  /** 컷을 클릭했을 때 현재 위치가 그 컷 밖이면 시작점으로 이동해 미리보기도 같이 바꾼다. */
  const seekInto = (key: string) => {
    const span = spanFor(key);
    if (span?.active && (playhead < span.start || playhead >= span.end)) onSeek(span.start);
  };

  return (
    <div className="sv2-track-row">
      <div className="sv2-track-label">
        <Clapperboard size={13} /> {ui('영상')}
      </div>
      <div className="sv2-track-lane" style={{ width: layout.totalWidth, paddingRight: 0 }}>
        <button
          type="button"
          className="sv2-chip sv2-chip-special"
          data-empty={!overlayOptions.showIntro}
          data-playing={isPlaying('__intro__')}
          style={chipStyle('__intro__')}
          onClick={() => onOpenIntro()}
          title={ui('인트로 설정')}
        >
          <span className="sv2-chip-title">{ui('인트로')}</span>
          <span className="sv2-chip-sub">
            {overlayOptions.showIntro
              ? ui('{count}초', { count: model.introDuration.toFixed(1) })
              : ui('꺼짐')}
          </span>
        </button>

        {segments.map((seg, index) => (
          <div
            key={seg.id}
            className="sv2-chip"
            data-selected={selectedSegmentId === seg.id}
            data-landing={landingIds.has(seg.id)}
            data-returning={returningIds?.has(seg.id) ?? false}
            data-playing={isPlaying(seg.id)}
            style={chipStyle(seg.id)}
            data-cut-slot-id={seg.id}
            data-locked={locked}
            draggable={!locked}
            onDragStart={(e) => {
              if (locked) return;
              e.dataTransfer.setData('text/sv2-index', String(index));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (locked) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              if (locked) return;
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/sv2-index'));
              if (Number.isFinite(from) && from !== index) onReorder(from, index);
            }}
            onClick={() => {
              if (locked) return;
              onSelect(seg.id);
              seekInto(seg.id);
            }}
            title={seg.reason || seg.subtitleTitle || ui('컷')}
          >
            {thumbFor(seg) && <img className="sv2-chip-thumb" src={thumbFor(seg)} alt="" />}
            {!locked && selectedSegmentId === seg.id && (
              <div className="sv2-chip-mini-toolbar" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="sv2-mini-btn" onClick={() => onTrim(seg)} title={ui('트림')}>
                  <Scissors size={13} />
                </button>
                <button
                  type="button"
                  className="sv2-mini-btn"
                  onClick={() =>
                    onUpdateSegment(seg.id, { rotation: (((seg.rotation ?? 0) + 90) % 360 + 360) % 360 })
                  }
                  title={ui('90° 회전')}
                >
                  <RotateCw size={13} />
                </button>
                <button type="button" className="sv2-mini-btn" onClick={() => onOpenLocation(seg.id)} title={ui('위치')}>
                  <MapPin size={13} />
                </button>
                <button type="button" className="sv2-mini-btn" data-danger="true" onClick={() => onDelete(seg.id)} title={ui('삭제')}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}
            <span className="sv2-chip-title">
              {seg.subtitleTitle || ui('컷 {index}', { index: index + 1 })}
            </span>
            <span className="sv2-chip-sub">
              {formatShootDate(seg) || ui('{count}초', { count: seg.duration?.toFixed(1) ?? '?' })}
            </span>
          </div>
        ))}

        <button
          type="button"
          className="sv2-chip sv2-chip-special"
          data-empty={!overlayOptions.showOutro}
          data-playing={isPlaying('__outro__')}
          style={chipStyle('__outro__')}
          onClick={() => onOpenOutro()}
          title={ui('아웃트로 설정')}
        >
          <span className="sv2-chip-title"><Flag size={12} style={{ verticalAlign: -2 }} /> {ui('아웃트로')}</span>
          <span className="sv2-chip-sub">
            {overlayOptions.showOutro
              ? ui('{count}초', { count: model.outroDuration.toFixed(1) })
              : ui('꺼짐')}
          </span>
        </button>
      </div>
    </div>
  );
};
