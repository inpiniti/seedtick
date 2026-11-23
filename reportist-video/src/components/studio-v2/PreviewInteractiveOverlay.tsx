import { useEffect, useRef, useState } from 'react';
import { MapPin, Type } from 'lucide-react';

// components/studio-v2/PreviewInteractiveOverlay.tsx
// 캔버스 위에 포개지는 투명 히트 레이어.
// 우상단 위치는 인스펙터로, 하단(세로는 2/3 높이) 자막은 제자리에서 바로 수정한다.
// 부모가 activeSegment 기준으로 key를 고정하므로 다른 컷으로 넘어가면 드래프트가 초기화된다.

interface PreviewInteractiveOverlayProps {
  locationLabel: string;
  dateLabel: string;
  caption: string;
  onLocationClick: () => void;
  onCaptionCommit: (text: string) => void;
  /** 편집 시작/종료를 부모에 알려 캔버스 자막 숨김·일시정지에 사용한다. */
  onEditingChange: (editing: boolean) => void;
}

export const PreviewInteractiveOverlay = ({
  locationLabel,
  dateLabel,
  caption,
  onLocationClick,
  onCaptionCommit,
  onEditingChange,
}: PreviewInteractiveOverlayProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;

  // 다른 컷의 자막이 들어와도 편집 중 드래프트는 덮어쓰지 않는다.
  useEffect(() => {
    if (!editing) setDraft(caption);
  }, [caption, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 컷 전환 등으로 언마운트될 때 부모의 편집 플래그가 남지 않게 정리한다.
  useEffect(() => () => onEditingChangeRef.current(false), []);

  const startEditing = () => {
    if (editing) return;
    committedRef.current = false;
    setDraft(caption);
    setEditing(true);
    onEditingChange(true);
  };

  const finish = (save: boolean) => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (save) onCaptionCommit(draft);
    setEditing(false);
    onEditingChange(false);
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
        data-editing={editing}
        data-empty={!caption}
        onClick={startEditing}
        title={caption || '클릭해서 자막 추가'}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="sv2-caption-input"
            value={draft}
            placeholder="자막을 입력하세요"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finish(true)}
            onKeyDown={(e) => {
              // 한글·일본어 IME 조합 중 Enter는 확정이 아니라 조합 문자이므로 저장하지 않는다.
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="sv2-hit-hint">
            <Type size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {caption || '자막 추가'}
          </span>
        )}
      </div>
    </div>
  );
};
