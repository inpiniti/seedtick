// components/studio-v2/cutFlightAnimator.ts
// AI 분석이 끝난 컷이 좌측 리스트에서 하단 타임라인 슬롯으로
// '탁·탁·탁·탁·탁' 비행하며 착지하는 GSAP 연출 엔진.
// 추가 라이브러리 없이 gsap 코어만 사용하고, 베지어 곡선은 프록시 트윈으로 계산한다.

import gsap from 'gsap';

export interface FlightItem {
  id: string;
  thumbnailUrl?: string;
  /** 출발 좌표 (좌측 업로드 카드 중심, viewport 기준) */
  from: { x: number; y: number };
  /** 목적 슬롯 DOM (착지 후 탄성 연출에 사용) */
  toEl?: HTMLElement | null;
}

export interface FlightHandle {
  cancel: () => void;
}

interface FlightOptions {
  onLand?: (id: string) => void;
  onComplete?: () => void;
  /** 개별 비행 시간(초) */
  duration?: number;
  /** 컷 사이 간격(초) */
  stagger?: number;
}

function quadBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/**
 * 컷 고스트 카드들을 출발지 → 타임라인 슬롯으로 순차 비행시킨다.
 * 각 카드가 착지하는 순간 onLand가 호출되어 실제 칩이 보이게 된다.
 */
export function flyCutsIn(items: FlightItem[], opts: FlightOptions = {}): FlightHandle {
  const { onLand, onComplete, duration = 0.44, stagger = 0.09 } = opts;
  if (typeof document === 'undefined' || items.length === 0) {
    onComplete?.();
    return { cancel: () => {} };
  }

  const layer = document.createElement('div');
  layer.className = 'sv2-flight-layer';
  document.body.appendChild(layer);

  const ghosts = items.map((item) => {
    const ghost = document.createElement('img');
    ghost.className = 'sv2-flight-ghost';
    ghost.src = item.thumbnailUrl || '';
    ghost.alt = '';
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.transform = `translate3d(${item.from.x - 46}px, ${item.from.y - 30}px, 0)`;
    layer.appendChild(ghost);
    return ghost;
  });

  const tweens: gsap.core.Tween[] = [];
  let cancelled = false;

  const tl = gsap.timeline({
    onComplete: () => {
      if (cancelled) return;
      layer.remove();
      onComplete?.();
    },
  });

  items.forEach((item, index) => {
    const ghost = ghosts[index];
    const toRect = item.toEl?.getBoundingClientRect();
    const target = toRect
      ? { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 }
      : { x: item.from.x + 260, y: item.from.y + 120 };

    const start = { x: item.from.x, y: item.from.y };
    const apex = {
      x: (start.x + target.x) / 2,
      y: Math.min(start.y, target.y) - 130 - index * 6,
    };
    const proxy = { t: 0 };

    const tween = gsap.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      delay: index * stagger,
      onUpdate: () => {
        if (cancelled) return;
        const p = quadBezier(start, apex, target, proxy.t);
        const scale = 1 - 0.45 * Math.sin(proxy.t * Math.PI);
        const rotate = Math.sin(proxy.t * Math.PI) * (index % 2 === 0 ? 14 : -14);
        ghost.style.transform = `translate3d(${p.x - 46}px, ${p.y - 30}px, 0) scale(${scale}) rotate(${rotate}deg)`;
        ghost.style.opacity = String(0.55 + 0.45 * Math.sin(Math.min(1, proxy.t + 0.2) * Math.PI));
      },
      onComplete: () => {
        if (cancelled) return;
        ghost.remove();
        if (item.toEl) {
          gsap.fromTo(
            item.toEl,
            { scale: 1.16, filter: 'brightness(1.5)' },
            {
              scale: 1,
              filter: 'brightness(1)',
              duration: 0.26,
              ease: 'back.out(2.2)',
              clearProps: 'transform,filter',
            }
          );
        }
        onLand?.(item.id);
      },
    });
    tweens.push(tween);
    tl.add(tween, 0);
  });

  return {
    cancel: () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
      tl.kill();
      layer.remove();
    },
  };
}
