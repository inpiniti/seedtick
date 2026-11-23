import { Subtitles } from 'lucide-react';
import { useState } from 'react';
import type { HighlightSegment } from '../../types/video.ts';

// components/studio-v2/TimelineSubtitleTrack.tsx — 컷별 자동 장면 자막 & 인라인 수정.

interface TimelineSubtitleTrackProps {
  segments: HighlightSegment[];
  landingIds: Set<string>;
  selectedSegmentId: string | null;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onSelect: (id: string) => void;
}

export const TimelineSubtitleTrack = ({
  segments,
  landingIds,
  selectedSegmentId,
  onUpdateSegment,
  onSelect,
}: TimelineSubtitleTrackProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="sv2-track-row">
      <div className="sv2-track-label">
        <Subtitles size={13} /> 자막
      </div>
      <div className="sv2-track-lane">
        {segments.map((seg, index) => (
          <div
            key={seg.id}
            className="sv2-chip sv2-chip-subtitle"
            data-selected={selectedSegmentId === seg.id}
            data-landing={landingIds.has(seg.id)}
            onClick={() => {
              onSelect(seg.id);
              setEditingId(seg.id);
              setDraft(seg.subtitleTitle || '');
            }}
            title="클릭해서 자막 수정"
          >
            {editingId === seg.id ? (
              <input
                className="sv2-subtitle-edit"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  onUpdateSegment(seg.id, { subtitleTitle: draft });
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateSegment(seg.id, { subtitleTitle: draft });
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="sv2-chip-title">{seg.subtitleTitle || `자막 ${index + 1}`}</span>
                <span className="sv2-chip-sub">자동 추출</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
