// VideoContextMenu.tsx — 좌측 원본 영상 카드의 우클릭 메뉴.
// Animate UI(Base UI) ContextMenu 프리미티브를 감싸서 포커스 이동·호버 하이라이트·
// 포털 충돌 처리와 열고 닫는 애니메이션을 라이브러리에 맡긴다.
import React from 'react';
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpNarrowWide, ListOrdered, Trash2 } from 'lucide-react';
import { ContextMenu as AnimateContextMenu } from '@animate-ui/react/primitives/base-ui/context-menu';
import { useI18n } from '../../i18n/index.tsx';
import type { VideoSortMode } from './types.ts';
import './videoContextMenu.css';

interface VideoContextMenuProps {
  /** 메뉴를 붙일 원본 영상 카드. Trigger가 이 요소를 그대로 렌더한다. */
  children: React.ReactElement;
  /** 분석 중이거나 삭제 연출 중이면 메뉴를 붙이지 않는다. */
  disabled?: boolean;
  hasAbove: boolean;
  hasBelow: boolean;
  onDelete: () => void;
  onDeleteAbove: () => void;
  onDeleteBelow: () => void;
  onSort: (mode: VideoSortMode) => void;
}

export const VideoContextMenu = ({
  children,
  disabled = false,
  hasAbove,
  hasBelow,
  onDelete,
  onDeleteAbove,
  onDeleteBelow,
  onSort,
}: VideoContextMenuProps) => {
  const { ui } = useI18n();

  if (disabled) return children;

  return (
    <AnimateContextMenu.Root>
      <AnimateContextMenu.Trigger render={children} />
      <AnimateContextMenu.Portal>
        <AnimateContextMenu.Positioner
          className="sv2-context-positioner"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <AnimateContextMenu.Popup
            className="sv2-context-popup"
            aria-label={ui('원본 영상 메뉴')}
          >
            <AnimateContextMenu.Item className="sv2-context-item" onClick={onDelete}>
              <Trash2 size={14} />
              <span>{ui('삭제')}</span>
            </AnimateContextMenu.Item>
            <AnimateContextMenu.Item
              className="sv2-context-item"
              disabled={!hasAbove}
              onClick={onDeleteAbove}
            >
              <ArrowUpNarrowWide size={14} />
              <span>{ui('위쪽 삭제')}</span>
            </AnimateContextMenu.Item>
            <AnimateContextMenu.Item
              className="sv2-context-item"
              disabled={!hasBelow}
              onClick={onDeleteBelow}
            >
              <ArrowDownWideNarrow size={14} />
              <span>{ui('아래쪽 삭제')}</span>
            </AnimateContextMenu.Item>

            <AnimateContextMenu.Separator className="sv2-context-separator" />

            <AnimateContextMenu.Item className="sv2-context-item" onClick={() => onSort('asc')}>
              <ArrowDownUp size={14} />
              <span>{ui('정렬(시간 오름차순)')}</span>
            </AnimateContextMenu.Item>
            <AnimateContextMenu.Item className="sv2-context-item" onClick={() => onSort('desc')}>
              <ArrowDownUp size={14} />
              <span>{ui('정렬(시간 내림차순)')}</span>
            </AnimateContextMenu.Item>
            <AnimateContextMenu.Item className="sv2-context-item" onClick={() => onSort('none')}>
              <ListOrdered size={14} />
              <span>{ui('정렬(없음)')}</span>
            </AnimateContextMenu.Item>
          </AnimateContextMenu.Popup>
        </AnimateContextMenu.Positioner>
      </AnimateContextMenu.Portal>
    </AnimateContextMenu.Root>
  );
};
