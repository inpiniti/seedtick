import type { Rect, Vec2 } from './types.ts';

/** 장애물로 취급할 실제 DOM. 스테이지 여백만 펭귄이 걸어갈 수 있다. */
export const OBSTACLE_SELECTORS = [
  // 상단바·미리보기·재생바 위에는 동물이 올라가지 않는다.
  '.sv2-topbar',
  '.sv2-preview-empty-tilt',
  '.sv2-preview-empty-copy',
  '.sv2-preview-frame',
  '.sv2-preview-toggles',
  '.sv2-display-bar',
  '.sv2-transport',
  '.sv2-shared-frame',
  '.sv2-shared-meta',
  '.sv2-shared-details',
  '.sv2-status-pill',
  '.sv2-stage-meta',
  '.sv2-discussion-topic',
  '.sv2-discussion-controls',
  '.sv2-transcript',
] as const;

export const CELL = 12;
export const PAD_X = 18;
export const PAD_Y = 14;
export const PAD_BOTTOM = 24;
export const EDGE_MARGIN = 16;

export interface NavGrid {
  width: number;
  height: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
  /** 팽창된 장애물 AABB. Line-of-Sight 판정에 재사용한다. */
  obstacles: Rect[];
}

interface Cell {
  c: number;
  r: number;
}

const SQRT2_MINUS_1 = Math.SQRT2 - 1;
const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** 화면에 실제로 보이는(4px 초과) 장애물만 로컬 좌표 AABB로 수집·팽창한다. */
export function collectObstacles(root: HTMLElement, origin: DOMRect): Rect[] {
  const obstacles: Rect[] = [];
  for (const selector of OBSTACLE_SELECTORS) {
    const nodes = root.querySelectorAll<HTMLElement>(selector);
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 4 || rect.height <= 4) continue;
      obstacles.push({
        left: rect.left - origin.left - PAD_X,
        top: rect.top - origin.top - PAD_Y,
        right: rect.right - origin.left + PAD_X,
        bottom: rect.bottom - origin.top + PAD_BOTTOM,
      });
    }
  }
  return obstacles;
}

/** 12px 격자를 빌드한다. 외곽 여백과 팽창 장애물 내부를 blocked로 표시. */
export function buildGrid(width: number, height: number, obstacles: Rect[]): NavGrid {
  const cols = Math.max(1, Math.ceil(width / CELL));
  const rows = Math.max(1, Math.ceil(height / CELL));
  const blocked = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      let isBlocked =
        x < EDGE_MARGIN ||
        x > width - EDGE_MARGIN ||
        y < EDGE_MARGIN ||
        y > height - EDGE_MARGIN;
      if (!isBlocked) {
        for (const o of obstacles) {
          if (x > o.left && x < o.right && y > o.top && y < o.bottom) {
            isBlocked = true;
            break;
          }
        }
      }
      blocked[r * cols + c] = isBlocked ? 1 : 0;
    }
  }

  return { width, height, cols, rows, blocked, obstacles };
}

/** 점을 가장 가까운 이동 가능 셀 중심으로 나선형 탐색해 투영한다. */
export function findNearestWalkable(grid: NavGrid, p: Vec2): Vec2 {
  const center = clamp(Math.floor(p.x / CELL), 0, grid.cols - 1);
  const midRow = clamp(Math.floor(p.y / CELL), 0, grid.rows - 1);
  const startId = midRow * grid.cols + center;
  if (!grid.blocked[startId]) return cellCenter(grid, startId);

  const maxRing = Math.max(grid.cols, grid.rows);
  for (let ring = 1; ring <= maxRing; ring++) {
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const r = midRow + dr;
        const c = center + dc;
        if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue;
        const id = r * grid.cols + c;
        if (grid.blocked[id]) continue;
        const point = cellCenter(grid, id);
        const dist = (point.x - p.x) ** 2 + (point.y - p.y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = point;
        }
      }
    }
    if (best) return best;
  }
  return { x: clamp(p.x, EDGE_MARGIN, grid.width - EDGE_MARGIN), y: clamp(p.y, EDGE_MARGIN, grid.height - EDGE_MARGIN) };
}

/** resize 후 펭귄이 장애물에 갇혔을 때 가장 가까운 바깥으로 밀어낸다. */
export function ejectFromObstacles(
  p: Vec2,
  obstacles: Rect[],
  width: number,
  height: number
): Vec2 {
  let x = clamp(p.x, EDGE_MARGIN, Math.max(EDGE_MARGIN, width - EDGE_MARGIN));
  let y = clamp(p.y, EDGE_MARGIN, Math.max(EDGE_MARGIN, height - EDGE_MARGIN));
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const o of obstacles) {
      if (x <= o.left || x >= o.right || y <= o.top || y >= o.bottom) continue;
      const dl = x - o.left;
      const dr = o.right - x;
      const dt = y - o.top;
      const db = o.bottom - y;
      const min = Math.min(dl, dr, dt, db);
      if (min === dl) x = o.left - 1;
      else if (min === dr) x = o.right + 1;
      else if (min === dt) y = o.top - 1;
      else y = o.bottom + 1;
      moved = true;
    }
    if (!moved) break;
  }
  return {
    x: clamp(x, EDGE_MARGIN, Math.max(EDGE_MARGIN, width - EDGE_MARGIN)),
    y: clamp(y, EDGE_MARGIN, Math.max(EDGE_MARGIN, height - EDGE_MARGIN)),
  };
}

/** 8방향 A* + 벽 여유 가중치 + Line-of-Sight String-Pulling. */
export function findPath(grid: NavGrid, start: Vec2, goal: Vec2): Vec2[] {
  const startCell = toCell(grid, start);
  const goalCell = toCell(grid, goal);
  const total = grid.cols * grid.rows;
  const startId = startCell.r * grid.cols + startCell.c;
  const goalId = goalCell.r * grid.cols + goalCell.c;

  if (grid.blocked[startId] || grid.blocked[goalId]) return [goal];

  const gScore = new Float32Array(total).fill(Infinity);
  const fScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heap = new MinHeap();

  gScore[startId] = 0;
  fScore[startId] = heuristic(startCell, goalCell);
  heap.push(startId, fScore[startId]);

  while (heap.size > 0) {
    const id = heap.pop();
    if (closed[id]) continue;
    if (id === goalId) break;
    closed[id] = 1;

    const r = Math.floor(id / grid.cols);
    const c = id % grid.cols;

    for (const [dc, dr, len] of NEIGHBORS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;
      const nid = nr * grid.cols + nc;
      if (grid.blocked[nid] || closed[nid]) continue;

      // 대각선이 장애물 모서리를 가로지르지 못하게 한다.
      if (dc !== 0 && dr !== 0) {
        if (grid.blocked[r * grid.cols + nc] || grid.blocked[nr * grid.cols + c]) continue;
      }

      // Soft Clearance: 벽에 붙은 셀은 비용을 살짝 올려 모서리 긁음을 방지.
      let penalty = 0;
      if (
        (nc > 0 && grid.blocked[nr * grid.cols + nc - 1]) ||
        (nc < grid.cols - 1 && grid.blocked[nr * grid.cols + nc + 1]) ||
        (nr > 0 && grid.blocked[(nr - 1) * grid.cols + nc]) ||
        (nr < grid.rows - 1 && grid.blocked[(nr + 1) * grid.cols + nc])
      ) {
        penalty = 0.4;
      }

      const tentative = gScore[id] + len * CELL + penalty;
      if (tentative < gScore[nid]) {
        cameFrom[nid] = id;
        gScore[nid] = tentative;
        fScore[nid] = tentative + heuristic({ c: nc, r: nr }, goalCell);
        heap.push(nid, fScore[nid]);
      }
    }
  }

  if (startId !== goalId && cameFrom[goalId] === -1) return [goal];

  const cells: Vec2[] = [];
  let cursor = goalId;
  while (cursor !== -1) {
    cells.push(cellCenter(grid, cursor));
    cursor = cameFrom[cursor];
  }
  cells.reverse();

  const points = [start, ...cells, goal];
  return stringPull(points, grid.obstacles).slice(1);
}

function toCell(grid: NavGrid, p: Vec2): Cell {
  return {
    c: clamp(Math.floor(p.x / CELL), 0, grid.cols - 1),
    r: clamp(Math.floor(p.y / CELL), 0, grid.rows - 1),
  };
}

function cellCenter(grid: NavGrid, id: number): Vec2 {
  return {
    x: ((id % grid.cols) + 0.5) * CELL,
    y: (Math.floor(id / grid.cols) + 0.5) * CELL,
  };
}

function heuristic(a: Cell, b: Cell): number {
  const dc = Math.abs(a.c - b.c);
  const dr = Math.abs(a.r - b.r);
  const max = Math.max(dc, dr);
  const min = Math.min(dc, dr);
  return (max + SQRT2_MINUS_1 * min) * CELL;
}

/** 격자 계단을 제거하고 장애물 모서리를 도는 자유 각도 웨이포인트만 남긴다. */
function stringPull(points: Vec2[], obstacles: Rect[]): Vec2[] {
  if (points.length <= 2) return points;
  const result: Vec2[] = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let farthest = anchor + 1;
    for (let i = anchor + 2; i < points.length; i++) {
      if (hasLineOfSight(points[anchor], points[i], obstacles)) farthest = i;
    }
    result.push(points[farthest]);
    anchor = farthest;
  }
  return result;
}

/** Liang-Barsky 선분-AABB 교차 판정. */
function hasLineOfSight(a: Vec2, b: Vec2, obstacles: Rect[]): boolean {
  for (const o of obstacles) {
    if (segmentIntersectsRect(a, b, o)) return false;
  }
  return true;
}

function segmentIntersectsRect(a: Vec2, b: Vec2, r: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: ReadonlyArray<readonly [number, number]> = [
    [-dx, a.x - r.left],
    [dx, r.right - a.x],
    [-dy, a.y - r.top],
    [dy, r.bottom - a.y],
  ];
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return true;
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    let i = this.ids.length;
    this.ids.push(id);
    this.keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop() ?? 0;
    const lastKey = this.keys.pop() ?? 0;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.ids.length && this.keys[left] < this.keys[smallest]) smallest = left;
        if (right < this.ids.length && this.keys[right] < this.keys[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(smallest, i);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const id = this.ids[a];
    this.ids[a] = this.ids[b];
    this.ids[b] = id;
    const key = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = key;
  }
}
