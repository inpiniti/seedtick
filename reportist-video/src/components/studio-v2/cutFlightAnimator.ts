// components/studio-v2/cutFlightAnimator.ts
// AI 분석이 끝난 컷이 좌측 리스트에서 하단 타임라인 슬롯으로
// '탁·탁·탁·탁·탁' 비행하며 착지하는 GSAP 연출 엔진.
// 원본 영상 삭제 시에는 flyCutsOut으로 컷을 타임라인에서 원본 카드로 역비행시킨 뒤 카드를 소멸시킨다.
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

// ---------------------------------------------------------------------------
// 원본 영상 삭제: 타임라인 컷 → 원본 카드 역비행 + 카드 소멸
// ---------------------------------------------------------------------------

export interface ReturnFlightItem {
  id: string;
  thumbnailUrl?: string;
  /** 출발 좌표 (타임라인 컷 칩 중심, viewport 기준) */
  from: { x: number; y: number };
}

interface ReturnFlightOptions {
  /** 각 고스트가 원본 카드에 닿을 때 호출 (컷 id) */
  onLand?: (id: string) => void;
  /** 역비행 + 카드 소멸이 모두 끝난 뒤 호출 (이 시점에 실제 상태 삭제) */
  onComplete?: () => void;
  /** 컷이 흡수될 원본 카드 DOM */
  toCardEl?: HTMLElement | null;
  duration?: number;
  stagger?: number;
}

/** 카드가 접히는 연출 값. flyCutsOut / collapseFlightCard가 함께 사용한다. */
const CARD_COLLAPSE_VARS: gsap.TweenVars = {
  opacity: 0,
  x: -14,
  scale: 0.94,
  maxHeight: 0,
  minHeight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  marginBottom: 0,
  borderWidth: 0,
  duration: 0.26,
  ease: 'power2.in',
  // 마지막 컷 흡수 탄성(scale)이 아직 진행 중이어도 카드 소멸이 이를 덮어쓴다.
  overwrite: 'auto',
};

/** 편집 중인 카드의 CSS transition과 GSAP 인라인 스타일이 겹치지 않도록 끈다. */
function prepareCardForCollapse(cardEl: HTMLElement) {
  cardEl.style.transition = 'none';
}

/**
 * 컷이 없는 영상(또는 모션 축소 환경)에서 카드만 부드럽게 접는다.
 * flyCutsOut의 마지막 단계와 동일한 연출을 사용한다.
 */
export function collapseFlightCard(
  cardEl: HTMLElement | null,
  onComplete: () => void
): FlightHandle {
  if (!cardEl?.isConnected || prefersReducedMotion()) {
    onComplete();
    return { cancel: () => {} };
  }
  prepareCardForCollapse(cardEl);
  const tween = gsap.to(cardEl, {
    ...CARD_COLLAPSE_VARS,
    onComplete: () => onComplete(),
  });
  return { cancel: () => tween.kill() };
}

/**
 * 타임라인 컷 고스트들을 원본 카드 쪽으로 역비행시킨다.
 * 각 컷이 카드에 흡수되면 onLand, 모든 흡수와 카드 소멸이 끝나면 onComplete가 호출된다.
 *
 * - 컷이 많으면 고스트를 최대 12개로 샘플링해 총 연출 시간이 늘어지지 않게 한다.
 * - onUpdate에서 카드의 최신 rect를 읽어 다른 카드가 접혀 위치가 밀려도 정확히 흡수한다.
 * - 모션 축소 환경에서는 고스트/카드 소멸 없이 즉시 onComplete한다.
 */
export function flyCutsOut(items: ReturnFlightItem[], opts: ReturnFlightOptions = {}): FlightHandle {
  const { onLand, onComplete, toCardEl, duration = 0.36, stagger = 0.06 } = opts;
  if (typeof document === 'undefined' || items.length === 0) {
    onComplete?.();
    return { cancel: () => {} };
  }
  if (prefersReducedMotion()) {
    let cancelled = false;
    items.forEach((item) => {
      if (!cancelled) onLand?.(item.id);
    });
    onComplete?.();
    return { cancel: () => { cancelled = true; } };
  }

  // 1초 컷처럼 컷 수가 많아도 고스트는 최대 12개만 날린다.
  const MAX_GHOSTS = 12;
  const groups: Array<{ item: ReturnFlightItem; ids: string[] }> = [];
  if (items.length <= MAX_GHOSTS) {
    items.forEach((item) => groups.push({ item, ids: [item.id] }));
  } else {
    for (let i = 0; i < MAX_GHOSTS; i++) {
      const start = Math.floor((i * items.length) / MAX_GHOSTS);
      const end = Math.min(
        items.length,
        Math.max(start + 1, Math.floor(((i + 1) * items.length) / MAX_GHOSTS))
      );
      const ids: string[] = [];
      for (let j = start; j < end; j++) ids.push(items[j].id);
      groups.push({ item: items[start], ids });
    }
  }

  const layer = document.createElement('div');
  layer.className = 'sv2-flight-layer';
  document.body.appendChild(layer);

  const step = Math.min(stagger, 0.4 / Math.max(1, groups.length));
  const ghosts = groups.map(({ item }) => {
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

  const pulseCard = () => {
    if (!toCardEl?.isConnected) return;
    gsap.fromTo(
      toCardEl,
      { scale: 1 },
      {
        scale: 1.05,
        duration: 0.1,
        ease: 'power1.out',
        yoyo: true,
        repeat: 1,
        overwrite: 'auto',
        clearProps: 'transform',
      }
    );
  };

  const tl = gsap.timeline({
    onComplete: () => {
      if (cancelled) return;
      layer.remove();
      onComplete?.();
    },
  });

  groups.forEach(({ item, ids }, index) => {
    const ghost = ghosts[index];
    const cardRect = toCardEl?.getBoundingClientRect();
    const fallbackTarget = cardRect
      ? { x: cardRect.left + cardRect.width / 2, y: cardRect.top + cardRect.height / 2 }
      : { x: 140, y: window.innerHeight / 2 };

    const start = { x: item.from.x, y: item.from.y };
    const apexY = Math.min(start.y, fallbackTarget.y) - 90 - index * 4;
    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      delay: index * step,
      onUpdate: () => {
        if (cancelled) return;
        let target = fallbackTarget;
        if (toCardEl?.isConnected) {
          const rect = toCardEl.getBoundingClientRect();
          target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        const apex = { x: (start.x + target.x) / 2, y: apexY };
        const p = quadBezier(start, apex, target, proxy.t);
        const scale = 1 - 0.4 * Math.sin(proxy.t * Math.PI);
        const rotate = Math.sin(proxy.t * Math.PI) * (index % 2 === 0 ? -12 : 12);
        ghost.style.transform = `translate3d(${p.x - 46}px, ${p.y - 30}px, 0) scale(${scale}) rotate(${rotate}deg)`;
        ghost.style.opacity = String(0.55 + 0.45 * Math.sin(Math.min(1, proxy.t + 0.2) * Math.PI));
      },
      onComplete: () => {
        if (cancelled) return;
        ghost.remove();
        pulseCard();
        ids.forEach((id) => onLand?.(id));
      },
    });
    tweens.push(tween);
    tl.add(tween, 0);
  });

  // 모든 컷이 흡수된 뒤 원본 카드를 접는다. 타임라인 맨 뒤에 붙이므로
  // tl.onComplete는 카드 소멸까지 끝난 시점에만 호출된다.
  if (toCardEl?.isConnected) {
    prepareCardForCollapse(toCardEl);
    tl.to(toCardEl, { ...CARD_COLLAPSE_VARS });
  }

  return {
    cancel: () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
      tl.kill();
      layer.remove();
    },
  };
}
