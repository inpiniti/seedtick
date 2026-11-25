import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpNarrowWide, ListOrdered, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';

// components/studio-v2/VideoContextMenu.tsx
// 좌측 원본 영상 카드 우클릭 메뉴. fixed 좌표에 띄워 스크롤 영역에 잘리지 않게 한다.

export type VideoContextAction =
  | 'delete'
  | 'deleteAbove'
  | 'deleteBelow'
  | 'sortAsc'
  | 'sortDesc'
  | 'sortNone';

interface VideoContextMenuProps {
  x: number;
  y: number;
  /** 위쪽/아래쪽 삭제 대상이 없으면 해당 항목을 비활성화한다. */
  hasAbove: boolean;
  hasBelow: boolean;
  onSelect: (action: VideoContextAction) => void;
  onClose: () => void;
}

export const VideoContextMenu = ({
  x,
  y,
  hasAbove,
  hasBelow,
  onSelect,
  onClose,
}: VideoContextMenuProps) => {
  const { ui } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // 메뉴가 화면 밖으로 나가지 않도록 실제 크기를 잰 뒤 클램프한다.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onScroll);
    // 독 리스트 스크롤 시 커서와 메뉴가 어긋나므로 닫는다.
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const run = (action: VideoContextAction) => () => {
    onClose();
    onSelect(action);
  };

  const menu = (
    <div
      ref={menuRef}
      className="sv2-context-menu"
      role="menu"
      aria-label={ui('원본 영상 메뉴')}
      style={{ left: position.left, top: position.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className="sv2-context-menu-item"
        data-danger="true"
        onClick={run('delete')}
      >
        <Trash2 size={14} />
        <span>{ui('삭제')}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="sv2-context-menu-item"
        data-danger="true"
        disabled={!hasAbove}
        onClick={run('deleteAbove')}
      >
        <ArrowUpNarrowWide size={14} />
        <span>{ui('위쪽 삭제')}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="sv2-context-menu-item"
        data-danger="true"
        disabled={!hasBelow}
        onClick={run('deleteBelow')}
      >
        <ArrowDownWideNarrow size={14} />
        <span>{ui('아래쪽 삭제')}</span>
      </button>

      <div className="sv2-context-menu-divider" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="sv2-context-menu-item"
        onClick={run('sortAsc')}
      >
        <ArrowDownUp size={14} />
        <span>{ui('정렬(시간 오름차순)')}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="sv2-context-menu-item"
        onClick={run('sortDesc')}
      >
        <ArrowDownUp size={14} />
        <span>{ui('정렬(시간 내림차순)')}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="sv2-context-menu-item"
        onClick={run('sortNone')}
      >
        <ListOrdered size={14} />
        <span>{ui('정렬(없음)')}</span>
      </button>
    </div>
  );

  // 독의 overflow/transform에 관계없이 커서 위치에 정확히 띄우도록 body에 포털한다.
  return typeof document === 'undefined' ? menu : createPortal(menu, document.body);
};
