import type { Rect } from './types.ts';

/** 말풍선이 화면에 차지하는 사각형(스테이지 로컬 좌표). */
export interface BubbleBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 꼬리가 붙는 변. 이 변에서 화자(머리 위치) 쪽으로 꼬리가 뻗는다. */
export type BubbleTailSide = 'top' | 'bottom' | 'left' | 'right';

export interface BubblePlacement extends BubbleBox {
  tail: BubbleTailSide;
}

const MARGIN = 6;
const HEAD_OFFSET = 26;
const BODY_GAP = 12;

const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

function overlapArea(box: BubbleBox, other: BubbleBox | Rect): number {
  const left = Math.max(box.x, 'left' in other ? other.left : other.x);
  const top = Math.max(box.y, 'top' in other ? other.top : other.y);
  const right = Math.min(box.x + box.w, 'right' in other ? other.right : other.x + other.w);
  const bottom = Math.min(box.y + box.h, 'bottom' in other ? other.bottom : other.y + other.h);
  return right > left && bottom > top ? (right - left) * (bottom - top) : 0;
}

function clampToStage(box: BubbleBox, canvasWidth: number, canvasHeight: number): BubbleBox {
  return {
    ...box,
    x: clamp(box.x, MARGIN, Math.max(MARGIN, canvasWidth - box.w - MARGIN)),
    y: clamp(box.y, MARGIN, Math.max(MARGIN, canvasHeight - box.h - MARGIN)),
  };
}

export interface PlaceBubbleOptions {
  /** 화자의 접지점. */
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  /** 캔버스 위에 덮인 DOM(미리보기·상단바·대화 기록 등)의 팽창된 AABB. */
  obstacles: Rect[];
  /** 이미 배치된 다른 말풍선. */
  occupied: BubbleBox[];
  /** 화자가 스테이지 아래쪽에 있을 때 위쪽을 먼저 시도할지 여부. */
  preferAbove: boolean;
}

/**
 * 미리보기·상단바 같은 오버레이에 말풍선이 가리지 않도록 위/아래/좌/우 후보 중
 * 겹치는 면적이 가장 작은 위치를 고른다. 완전히 피할 수 있는 후보가 있으면 즉시 반환한다.
 */
export function placeBubble(o: PlaceBubbleOptions): BubblePlacement {
  const headY = o.anchorY - HEAD_OFFSET;
  const above: BubblePlacement = {
    x: o.anchorX - o.width / 2,
    y: o.anchorY - 36 - o.height,
    w: o.width,
    h: o.height,
    tail: 'bottom',
  };
  const below: BubblePlacement = {
    x: o.anchorX - o.width / 2,
    y: o.anchorY + BODY_GAP,
    w: o.width,
    h: o.height,
    tail: 'top',
  };
  const left: BubblePlacement = {
    x: o.anchorX - BODY_GAP - o.width,
    y: headY - o.height / 2,
    w: o.width,
    h: o.height,
    tail: 'right',
  };
  const right: BubblePlacement = {
    x: o.anchorX + BODY_GAP,
    y: headY - o.height / 2,
    w: o.width,
    h: o.height,
    tail: 'left',
  };

  const candidates = o.preferAbove
    ? [above, below, left, right]
    : [below, above, left, right];

  let best: BubblePlacement | null = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const box = clampToStage(candidate, o.canvasWidth, o.canvasHeight);
    let score = 0;
    // 오버레이(DOM)가 캔버스를 덮으면 풍선이 통째로 사라지므로 가중치를 둔다.
    for (const obstacle of o.obstacles) score += overlapArea(box, obstacle) * 2;
    for (const other of o.occupied) score += overlapArea(box, other);
    if (score === 0) return { ...box, tail: candidate.tail };
    if (score < bestScore) {
      bestScore = score;
      best = { ...box, tail: candidate.tail };
    }
  }
  return best ?? { ...clampToStage(above, o.canvasWidth, o.canvasHeight), tail: 'bottom' };
}
