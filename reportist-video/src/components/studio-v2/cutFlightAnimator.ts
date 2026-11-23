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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 컷 고스트 카드들을 출발지 → 타임라인 슬롯으로 순차 비행시킨다.
 * 각 카드가 착지하는 순간 onLand가 호출되어 실제 칩이 보이게 된다.
 *
 * - 동시에 여러 배치가 발사되어도 서로의 핸들을 취소하지 않는다(호출자가 핸들 Set으로 관리).
 * - onUpdate에서 목적 슬롯의 최신 rect를 읽어, 정렬로 슬롯이 밀려도 정확히 자기 자리에 착지한다.
 * - 모션 축소 환경에서는 고스트 없이 즉시 착지 처리한다.
 */
export function flyCutsIn(items: FlightItem[], opts: FlightOptions = {}): FlightHandle {
  const { onLand, onComplete, duration = 0.44, stagger = 0.09 } = opts;
  if (typeof document === 'undefined' || items.length === 0) {
    onComplete?.();
    return { cancel: () => {} };
  }

  // 모션 축소: 비행 연출 없이 바로 착지 + 카드 완료 처리
  if (prefersReducedMotion()) {
    let cancelled = false;
    items.forEach((item) => {
      if (!cancelled) onLand?.(item.id);
    });
    onComplete?.();
    return { cancel: () => { cancelled = true; } };
  }

  const layer = document.createElement('div');
  layer.className = 'sv2-flight-layer';
  document.body.appendChild(layer);

  // 착지 슬롯이 가로 스크롤 영역 밖이면 한 번만 부드럽게 노출한다.
  const firstVisibleTo = items.find((item) => item.toEl?.isConnected)?.toEl;
  if (firstVisibleTo) {
    try {
      firstVisibleTo.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    } catch {
      /* 구형 브라우저에서는 무시 */
    }
  }

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
    const fallbackTarget = toRect
      ? { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 }
      : { x: item.from.x + 260, y: item.from.y + 120 };

    const start = { x: item.from.x, y: item.from.y };
    // 포물선 꼭대기 높이는 발사 시점의 목표를 기준으로 고정하고,
    // 끝점만 매 프레임 최신 슬롯 위치로 추종한다.
    const apexY = Math.min(start.y, fallbackTarget.y) - 130 - index * 6;
    const proxy = { t: 0 };

    const tween = gsap.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      delay: index * stagger,
      onUpdate: () => {
        if (cancelled) return;
        let target = fallbackTarget;
        if (item.toEl?.isConnected) {
          const rect = item.toEl.getBoundingClientRect();
          target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        const apex = { x: (start.x + target.x) / 2, y: apexY };
        const p = quadBezier(start, apex, target, proxy.t);
        const scale = 1 - 0.45 * Math.sin(proxy.t * Math.PI);
        const rotate = Math.sin(proxy.t * Math.PI) * (index % 2 === 0 ? 14 : -14);
        ghost.style.transform = `translate3d(${p.x - 46}px, ${p.y - 30}px, 0) scale(${scale}) rotate(${rotate}deg)`;
        ghost.style.opacity = String(0.55 + 0.45 * Math.sin(Math.min(1, proxy.t + 0.2) * Math.PI));
      },
      onComplete: () => {
        if (cancelled) return;
        ghost.remove();
        if (item.toEl?.isConnected) {
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
