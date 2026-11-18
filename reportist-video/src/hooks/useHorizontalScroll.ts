import { useCallback, useEffect, useRef, useState } from 'react';

type DragState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  active: boolean;
};

/**
 * 가로로 넘치는 리스트를 마우스 휠·드래그로도 조작할 수 있게 한다.
 *
 * - 세로 휠(deltaY)을 가로 스크롤로 변환한다. 리스트 끝에 도달하면 이벤트를
 *   가로채지 않아 페이지 스크롤이 자연스럽게 이어진다.
 * - 마우스로 누른 뒤 좌우로 끌면 스크롤한다(터치는 기존 기동 스크롤 유지).
 *   드래그가 시작되면 같은 제스처의 클릭은 무시해 항목 선택이 함께 일어나지 않게 한다.
 *
 * 리스트가 조건부 렌더링되는 경우(예: 영상 업로드 전에는 없는 목록)를 위해
 * ref가 실제 노드에 붙을 때마다 이벤트를 다시 등록한다.
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  // 콜백 ref를 사용해 노드가 나중에 마운트/교체돼도 effect가 다시 실행되게 한다.
  const ref = useCallback((el: T | null) => setNode(el), []);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = node;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // 트랙패드 가로 제스처·쉬프트+휠은 브라우저가 이미 처리한다.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;

      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (maxScrollLeft <= 1) return;

      // Firefox 등 라인 단위 휠도 같은 체감이 되도록 픽셀 단위로 환산한다.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
      const delta = e.deltaY * unit;
      const atEdge =
        (delta > 0 && el.scrollLeft >= maxScrollLeft - 1) ||
        (delta < 0 && el.scrollLeft <= 1);
      if (atEdge) return;

      e.preventDefault();
      el.scrollLeft = Math.min(maxScrollLeft, Math.max(0, el.scrollLeft + delta));
    };

    const onPointerDown = (e: PointerEvent) => {
      // 마우스 왼쪽 버튼만 드래그 대상으로 한다.
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        active: false,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      if (!drag.active) {
        if (Math.abs(dx) < 4) return;
        drag.active = true;
        suppressClickRef.current = true;
        setIsDragging(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // 캡처 실패해도 window 리스너로 드래그는 계속 동작한다.
        }
      }

      e.preventDefault();
      el.scrollLeft = drag.startScrollLeft - dx;
    };

    const endDrag = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (drag.active) {
        try {
          if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        } catch {
          // 이미 해제된 경우 무시한다.
        }
      }
      dragRef.current = null;
      setIsDragging(false);
    };

    // 드래그 직후 발생하는 click으로 항목이 선택되지 않게 capture 단계에서 막는다.
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClickCapture, true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      dragRef.current = null;
      suppressClickRef.current = false;
      setIsDragging(false);
    };
  }, [node]);

  return { ref, isDragging };
}
