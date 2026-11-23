import { useEffect, useRef, useState } from 'react';
import { MapPin, Type } from 'lucide-react';

// components/studio-v2/PreviewInteractiveOverlay.tsx
// 캔버스 위에 포개지는 투명 히트 레이어.
// 우상단 위치 / 하단 자막을 직접 클릭해 바로 수정한다. (캔버스에는 절대 그려지지 않음)

interface PreviewInteractiveOverlayProps {
  locationLabel: string;
  dateLabel: string;
  caption: string;
  enabled: boolean;
  onLocationClick: () => void;
  onCaptionCommit: (text: string) => void;
}

export const PreviewInteractiveOverlay = ({
  locationLabel,
  dateLabel,
  caption,
  enabled,
  onLocationClick,
  onCaptionCommit,
}: PreviewInteractiveOverlayProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(caption);
  }, [caption]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!enabled) return null;

  const commit = () => {
    onCaptionCommit(draft);
    setEditing(false);
  };

  return (
    <div className="sv2-overlay-layer">
      <button
        type="button"
        className="sv2-hit sv2-hit-location"
        onClick={onLocationClick}
        title="위치 수정"
      >
        <span className="sv2-hit-hint">
          <MapPin size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          {locationLabel || `${dateLabel} · 위치 추가`}
        </span>
      </button>

      <div
        className="sv2-hit sv2-hit-caption"
        onClick={() => {
          if (!editing) setEditing(true);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="sv2-caption-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(caption);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="sv2-hit-hint">
            <Type size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {caption || '자막 클릭해서 수정'}
          </span>
        )}
      </div>
    </div>
  );
};
