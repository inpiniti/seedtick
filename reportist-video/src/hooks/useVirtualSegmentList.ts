import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface VirtualSegmentItem {
  index: number;
  start: number;
  size: number;
}

interface VirtualSegmentListOptions {
  count: number;
  estimateSize: (index: number) => number;
  overscan?: number;
}

/**
 * 컷 목록용 경량 가상 스크롤러.
 *
 * - 470개가 넘는 컷도 화면에 보이는 행(+overscan)만 렌더링한다.
 * - 선택된 씬은 타임코드·구도 편집기가 펼쳐져 행 높이가 달라지므로, 렌더된 행의
 *   실제 높이를 DOM에서 측정해 누적 오프셋에 반영한다. (고정 높이 가정 시
 *   펼쳐진 행 아래쪽이 밀리거나 겹치는 문제를 막는다.)
 */
export function useVirtualSegmentList({
  count,
  estimateSize,
  overscan = 4,
}: VirtualSegmentListOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const refCacheRef = useRef<Map<number, (el: HTMLElement | null) => void>>(new Map());
  const heightsRef = useRef<Map<number, number>>(new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  // 측정값이 갱신될 때마다 렌더를 한 번 더 돌려 sizes/offsets를 다시 계산한다.
  const [, forceMeasureRender] = useState(0);

  // 렌더마다 측정: 선택 변경으로 행이 펼쳐지/접히거나 내용이 바뀌면 높이를 갱신한다.
  useLayoutEffect(() => {
    let changed = false;
    rowElsRef.current.forEach((el, index) => {
      const height = el.getBoundingClientRect().height;
      if (height > 0 && Math.abs((heightsRef.current.get(index) ?? -1) - height) > 1) {
        heightsRef.current.set(index, height);
        changed = true;
      }
    });
    if (changed) forceMeasureRender((v) => v + 1);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    const syncViewport = () => setViewportHeight(el.clientHeight);
    syncViewport();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncViewport) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, []);

  const sizes: number[] = [];
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < count; i += 1) {
    const size = heightsRef.current.get(i) ?? estimateSize(i);
    sizes[i] = size;
    offsets[i] = acc;
    acc += size;
  }
  offsets[count] = acc;
  const totalSize = acc;

  // 이분 탐색: 화면 상단/하단에 위치한 행의 인덱스를 찾는다.
  const findIndexAt = (position: number) => {
    let lo = 0;
    let hi = Math.max(0, count - 1);
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= position) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  // 뷰포트를 아직 측정하지 못한 첫 렌더에서는 앞부분만 그린다.
  const start = viewportHeight > 0 ? Math.max(0, findIndexAt(scrollTop) - overscan) : 0;
  const end =
    viewportHeight > 0
      ? Math.min(count, findIndexAt(scrollTop + viewportHeight) + overscan + 1)
      : Math.min(count, 8);

  const virtualItems: VirtualSegmentItem[] = [];
  for (let i = start; i < end; i += 1) {
    virtualItems.push({ index: i, start: offsets[i], size: sizes[i] });
  }

  // 인덱스별 ref 콜백을 캐싱해 렌더마다 ref가 갈아끼워지지 않게 한다.
  const setRowRef = useCallback((index: number) => {
    let fn = refCacheRef.current.get(index);
    if (!fn) {
      fn = (el: HTMLElement | null) => {
        if (el) rowElsRef.current.set(index, el);
        else rowElsRef.current.delete(index);
      };
      refCacheRef.current.set(index, fn);
    }
    return fn;
  }, []);

  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const scrollToIndex = useCallback((index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const top = offsetsRef.current[index];
    if (typeof top !== 'number') return;
    el.scrollTo({ top, behavior: 'smooth' });
  }, []);

  return { containerRef, virtualItems, totalSize, setRowRef, scrollToIndex };
}
