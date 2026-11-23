import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MapPin } from 'lucide-react';
import {
  OVERLAY_FONT_STACK,
  computeSubtitleOverlayBounds,
} from '../../services/previewCompositorBase.ts';
import type { FrameSpec } from '../../services/frameSpec.ts';

// components/studio-v2/PreviewInteractiveOverlay.tsx
// 캔버스 위에 포개지는 투명 히트 레이어.
// 자막 히트 영역은 캔버스가 그린 실제 자막 박스와 같은 좌표·폰트를 공유한다.
// 호버 시 글자를 다시 그리지 않고 얇은 테두리 + 위쪽 안내 배지만 보여 주어
// 자막이 겹쳐 뭉개지거나 큰 반투명 박스가 영상을 가리지 않는다.
// 부모가 activeSegment 기준으로 key를 고정하므로 다른 컷으로 넘어가면 드래프트가 초기화된다.

interface PreviewInteractiveOverlayProps {
  frame: FrameSpec;
  locationLabel: string;
  dateLabel: string;
  caption: string;
  onLocationClick: () => void;
  onCaptionCommit: (text: string) => void;
  /** 편집 시작/종료를 부모에 알려 캔버스 자막 숨김·일시정지에 사용한다. */
  onEditingChange: (editing: boolean) => void;
}

export const PreviewInteractiveOverlay = ({
  frame,
  locationLabel,
  dateLabel,
  caption,
  onLocationClick,
  onCaptionCommit,
  onEditingChange,
}: PreviewInteractiveOverlayProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;

  // 타이핑 중에도 박스가 캔버스 자막처럼 글자 길이에 맞춰 늘어난다.
  // 자막이 비어 있으면 '자막 추가' 문구로 기준 박스 위치를 잡는다.
  const bounds = useMemo(() => {
    const text = editing ? draft : caption || '자막 추가';
    return (
      computeSubtitleOverlayBounds(text, frame) ?? computeSubtitleOverlayBounds('자막 추가', frame)
    );
  }, [editing, draft, caption, frame]);

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

  const boxStyle: CSSProperties | undefined = bounds
    ? {
        left: `${(bounds.x / frame.width) * 100}%`,
        top: `${(bounds.y / frame.height) * 100}%`,
        width: `${(bounds.width / frame.width) * 100}%`,
        height: `${(bounds.height / frame.height) * 100}%`,
        borderRadius: `${((8 * frame.unit) / frame.width) * 100}cqw`,
      }
    : undefined;

  const textStyle: CSSProperties | undefined = bounds
    ? {
        fontFamily: OVERLAY_FONT_STACK,
        fontSize: `${(bounds.fontSize / frame.width) * 100}cqw`,
        lineHeight: bounds.lineHeight / bounds.fontSize,
        padding: `${(bounds.padY / frame.width) * 100}cqw ${(bounds.padX / frame.width) * 100}cqw`,
        borderRadius: `${((8 * frame.unit) / frame.width) * 100}cqw`,
      }
    : undefined;

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
        style={boxStyle}
        onClick={startEditing}
        title={caption ? '클릭해서 자막 수정' : '클릭해서 자막 추가'}
      >
        {!editing && (
          <span className="sv2-caption-affordance">
            {caption ? '클릭해서 수정' : '+ 자막 추가'}
          </span>
        )}
        {editing && (
          <textarea
            ref={inputRef}
            className="sv2-caption-input"
            style={textStyle}
            value={draft}
            placeholder="자막을 입력하세요"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
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
        )}
      </div>
    </div>
  );
};
