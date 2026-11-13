// src/hooks/useIsMobileViewport.ts
import { useEffect, useState } from 'react';

/**
 * matchMedia 기반 모바일 뷰포트 감지 훅.
 * - 터치 기기에서 검색창 autoFocus로 키보드가 강제로 올라오는 UX 문제를 막거나
 * - 뷰포트 폭에 따라 셸/시트 레이아웃을 전환할 때 사용한다.
 * SSR 안전(기본값: false)을 지킨다.
 */
export function useIsMobileViewport(maxWidth = 640): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // 구형 iOS Safari
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return isMobile;
}
