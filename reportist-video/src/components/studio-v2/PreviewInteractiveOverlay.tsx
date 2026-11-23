import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MapPin } from 'lucide-react';
import {
  OVERLAY_FONT_STACK,
  computeSubtitleOverlayBounds,
  computeTitleOverlayBounds,
  type SubtitleOverlayBounds,
  type TitleOverlayBounds,
} from '../../services/previewCompositorBase.ts';
import type { FrameSpec } from '../../services/frameSpec.ts';
import { useI18n } from '../../i18n/index.tsx';

// components/studio-v2/PreviewInteractiveOverlay.tsx
// 캔버스 위에 포개지는 투명 히트 레이어.
// 제목·자막 히트 영역은 캔버스가 그린 실제 박스와 같은 좌표·폰트를 공유한다.
// 호버 시 글자를 다시 그리지 않고 얇은 테두리 + 안내 배지만 보여 주어
// 텍스트가 겹쳐 뭉개지거나 큰 반투명 박스가 영상을 가리지 않는다.
// 부모가 activeSegment 기준으로 key를 고정하므로 다른 컷으로 넘어가면 드래프트가 초기화된다.

type EditableKind = 'title' | 'caption';
type EditableBounds = SubtitleOverlayBounds | TitleOverlayBounds;

interface EditableTextOverlayProps {
  kind: EditableKind;
  frame: FrameSpec;
  text: string;
  enabled: boolean;
  /** 비어 있을 때 히트박스 크기를 잡을 문구 (현지화된 '제목 추가' / '자막 추가'). */
  emptyLabel: string;
  editLabel: string;
  addLabel: string;
  affordanceLabel: string;
  addAffordanceLabel: string;
  placeholder: string;
  textAlign: 'left' | 'center';
  computeBounds: (value: string, frame: FrameSpec) => EditableBounds | null;
  onCommit: (value: string) => void;
  onEditingChange: (kind: EditableKind, editing: boolean) => void;
}

/** 캔버스 텍스트 위에 얹히는 인라인 편집창. 제목과 자막이 같은 동작·스타일 규칙을 쓴다. */
const EditableTextOverlay = ({
  kind,
  frame,
  text,
  enabled,
  emptyLabel,
  editLabel,
  addLabel,
  affordanceLabel,
  addAffordanceLabel,
  placeholder,
  textAlign,
  computeBounds,
  onCommit,
  onEditingChange,
}: EditableTextOverlayProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;

  // 타이핑 중에도 박스가 캔버스 텍스트처럼 글자 길이에 맞춰 늘어난다.
  // 비어 있으면 현지화된 '추가' 문구로 기준 박스 위치를 잡는다.
  const bounds = useMemo(() => {
    const value = editing ? draft : text || emptyLabel;
    return computeBounds(value, frame) ?? computeBounds(emptyLabel, frame);
  }, [editing, draft, text, emptyLabel, frame, computeBounds]);

  useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 컷 전환 등으로 언마운트될 때 부모의 편집 플래그가 남지 않게 정리한다.
  useEffect(() => () => onEditingChangeRef.current(kind, false), [kind]);

  const startEditing = () => {
    if (editing) return;
    committedRef.current = false;
    setDraft(text);
    setEditing(true);
    onEditingChange(kind, true);
  };

  const finish = (save: boolean) => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (save) onCommit(draft);
    setEditing(false);
    onEditingChange(kind, false);
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
        textAlign,
      }
    : undefined;

  if (!enabled || !bounds) return null;

  return (
    <div
      className={`sv2-hit sv2-hit-${kind}`}
      data-editing={editing}
      data-empty={!text}
      style={boxStyle}
      onClick={startEditing}
      title={text ? editLabel : addLabel}
    >
      {!editing && (
        <span className={`sv2-${kind}-affordance`}>
          {text ? affordanceLabel : addAffordanceLabel}
        </span>
      )}
      {editing && (
        <textarea
          ref={inputRef}
          className={`sv2-${kind}-input`}
          style={textStyle}
          value={draft}
          placeholder={placeholder}
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
  );
};

interface PreviewInteractiveOverlayProps {
  frame: FrameSpec;
  title: string;
  showTitle: boolean;
  locationLabel: string;
  dateLabel: string;
  caption: string;
  onLocationClick: () => void;
  onTitleCommit: (text: string) => void;
  onCaptionCommit: (text: string) => void;
  /** 편집 시작/종료와 대상을 부모에 알려 캔버스 텍스트 숨김·일시정지에 사용한다. */
  onEditingChange: (kind: EditableKind, editing: boolean) => void;
  /** 영상 자막 표시가 꺼져 있으면 캔버스와 인터랙션을 일치시키기 위해 히트박스도 숨긴다. */
  showSubtitle?: boolean;
}

export const PreviewInteractiveOverlay = ({
  frame,
  title,
  showTitle,
  locationLabel,
  dateLabel,
  caption,
  onLocationClick,
  onTitleCommit,
  onCaptionCommit,
  onEditingChange,
  showSubtitle = true,
}: PreviewInteractiveOverlayProps) => {
  const { ui } = useI18n();
  const addCaptionText = ui('자막 추가');
  const addTitleText = ui('제목 추가');

  return (
    <div className="sv2-overlay-layer">
      <EditableTextOverlay
        kind="title"
        frame={frame}
        text={title}
        enabled={showTitle}
        emptyLabel={addTitleText}
        editLabel={ui('클릭해서 제목 수정')}
        addLabel={ui('클릭해서 제목 추가')}
        affordanceLabel={ui('클릭해서 수정')}
        addAffordanceLabel={ui('+ 제목 추가')}
        placeholder={ui('제목을 입력하세요')}
        textAlign="left"
        computeBounds={computeTitleOverlayBounds}
        onCommit={onTitleCommit}
        onEditingChange={onEditingChange}
      />
      <button
        type="button"
        className="sv2-hit sv2-hit-location"
        onClick={onLocationClick}
        title={ui('위치 수정')}
      >
        <span className="sv2-hit-hint">
          <MapPin size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          {locationLabel || ui('{date} · 위치 추가', { date: dateLabel })}
        </span>
      </button>
      <EditableTextOverlay
        kind="caption"
        frame={frame}
        text={caption}
        enabled={showSubtitle}
        emptyLabel={addCaptionText}
        editLabel={ui('클릭해서 자막 수정')}
        addLabel={ui('클릭해서 자막 추가')}
        affordanceLabel={ui('클릭해서 수정')}
        addAffordanceLabel={ui('+ 자막 추가')}
        placeholder={ui('자막을 입력하세요')}
        textAlign="center"
        computeBounds={computeSubtitleOverlayBounds}
        onCommit={onCaptionCommit}
        onEditingChange={onEditingChange}
      />
    </div>
  );
};
