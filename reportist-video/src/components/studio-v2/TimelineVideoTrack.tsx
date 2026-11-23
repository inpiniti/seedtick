import { Scissors, Trash2, RotateCw, MapPin, Clapperboard, Flag } from 'lucide-react';
import type { HighlightSegment, VideoItem, VideoOverlayOptions } from '../../types/video.ts';
import { formatShootDate } from './types.ts';
import type { TimelineModel } from './timelineModel.ts';

// components/studio-v2/TimelineVideoTrack.tsx — [인트로] + 컷 블록 + [아웃트로]

interface TimelineVideoTrackProps {
  segments: HighlightSegment[];
  videos: VideoItem[];
  model: TimelineModel;
  overlayOptions: VideoOverlayOptions;
  selectedSegmentId: string | null;
  landingIds: Set<string>;
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
  onSelect,
  onUpdateSegment,
  onDelete,
  onTrim,
  onOpenLocation,
  onOpenIntro,
  onOpenOutro,
  onReorder,
}: TimelineVideoTrackProps) => {
  const thumbFor = (seg: HighlightSegment) =>
    videos.find((v) => v.id === seg.sourceVideoId)?.thumbnailUrl;

  return (
    <div className="sv2-track-row">
      <div className="sv2-track-label">
        <Clapperboard size={13} /> 영상
      </div>
      <div className="sv2-track-lane">
        <button
          type="button"
          className="sv2-chip sv2-chip-special"
          data-empty={!overlayOptions.showIntro}
          onClick={onOpenIntro}
          title="인트로 설정"
        >
          <span className="sv2-chip-title">인트로</span>
          <span className="sv2-chip-sub">{overlayOptions.showIntro ? `${model.introDuration.toFixed(1)}초` : '꺼짐'}</span>
        </button>

        {segments.map((seg, index) => (
          <div
            key={seg.id}
            className="sv2-chip"
            data-selected={selectedSegmentId === seg.id}
            data-landing={landingIds.has(seg.id)}
            data-cut-slot-id={seg.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/sv2-index', String(index));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/sv2-index'));
              if (Number.isFinite(from) && from !== index) onReorder(from, index);
            }}
            onClick={() => onSelect(seg.id)}
            title={seg.reason || seg.subtitleTitle || '컷'}
          >
            {thumbFor(seg) && <img className="sv2-chip-thumb" src={thumbFor(seg)} alt="" />}
            {selectedSegmentId === seg.id && (
              <div className="sv2-chip-mini-toolbar" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="sv2-mini-btn" onClick={() => onTrim(seg)} title="트림">
                  <Scissors size={13} />
                </button>
                <button
                  type="button"
                  className="sv2-mini-btn"
                  onClick={() =>
                    onUpdateSegment(seg.id, { rotation: (((seg.rotation ?? 0) + 90) % 360 + 360) % 360 })
                  }
                  title="90° 회전"
                >
                  <RotateCw size={13} />
                </button>
                <button type="button" className="sv2-mini-btn" onClick={() => onOpenLocation(seg.id)} title="위치">
                  <MapPin size={13} />
                </button>
                <button type="button" className="sv2-mini-btn" data-danger="true" onClick={() => onDelete(seg.id)} title="삭제">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
            <span className="sv2-chip-title">{seg.subtitleTitle || `컷 ${index + 1}`}</span>
            <span className="sv2-chip-sub">
              {formatShootDate(seg) || `${seg.duration?.toFixed(1) ?? '?'}초`}
            </span>
          </div>
        ))}

        <button
          type="button"
          className="sv2-chip sv2-chip-special"
          data-empty={!overlayOptions.showOutro}
          onClick={onOpenOutro}
          title="아웃트로 설정"
        >
          <span className="sv2-chip-title"><Flag size={12} style={{ verticalAlign: -2 }} /> 아웃트로</span>
          <span className="sv2-chip-sub">{overlayOptions.showOutro ? `${model.outroDuration.toFixed(1)}초` : '꺼짐'}</span>
        </button>
      </div>
    </div>
  );
};
