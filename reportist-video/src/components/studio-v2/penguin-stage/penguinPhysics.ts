import {
  EDGE_MARGIN,
  ejectFromObstacles,
  findNearestWalkable,
  findPath,
  isCellWalkable,
  isPathBlocked,
  isPointInObstacle,
  type NavGrid,
} from './navigationGrid.ts';
import type { AnimalGait } from './species.ts';
import type { Footprint, PenguinState, Vec2 } from './types.ts';

/** 보행 속도·가속도. normalize된 dt 기반이라 60Hz/120Hz 모두 동일한 속도다. */
const MAX_SPEED = 46;
const MAX_ACCEL = 260;
const SLOW_RADIUS = 34;
const ARRIVE_RADIUS = 5;
const TURN_SPEED = 9;
const CORNER_LOOKAHEAD = 18;
const WALK_STRIDE = 7;
const FOOT_OFFSET = 3.6;
/** 우클릭 명령이 없으면 이만큼 기다린 뒤 혼자 산책을 시작한다. */
const WANDER_IDLE_MS = 5200;
const WANDER_SPEED_SCALE = 0.58;
const WANDER_MIN_DISTANCE = 70;
const WANDER_MAX_DISTANCE = 280;

export const FOOTPRINT_LIFETIME = 7200;
export const MAX_FOOTPRINTS = 160;

const approach = (current: number, target: number, maxDelta: number): number => {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
};

/** 각도를 최단 경로로 보간한다. 코너를 둥글게 도는 조향에 사용. */
function shortestAngleLerp(from: number, to: number, maxStep: number): number {
  const twoPi = Math.PI * 2;
  let diff = (to - from) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  return from + Math.max(-maxStep, Math.min(maxStep, diff));
}

export function createPenguin(x: number, y: number, now: number): PenguinState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    heading: Math.PI / 2,
    walkCycle: 0,
    prevWalkSin: 0,
    moveBlend: 0,
    waypoints: [],
    target: null,
    lookOffset: 0,
    lookTarget: 0,
    nextIdleAt: now + 2600 + Math.random() * 2600,
    idleUntil: 0,
    flapUntil: 0,
    nextBlinkAt: now + 2000 + Math.random() * 2200,
    blinkUntil: 0,
    squash: 0,
    nextWanderAt: now + WANDER_IDLE_MS + Math.random() * 1600,
    isWandering: false,
  };
}

/** 명령 후 다시 배회할 때까지의 유휴 시간을 초기화한다. */
export function resetWanderTimer(state: PenguinState, now: number): void {
  state.isWandering = false;
  state.nextWanderAt = now + WANDER_IDLE_MS + Math.random() * 1600;
}

/** 장애물 회피가 반영된 산책 목적지를 무작위로 고른다. */
function pickWanderGoal(grid: NavGrid, from: Vec2): Vec2 | null {
  const minX = EDGE_MARGIN + 12;
  const minY = EDGE_MARGIN + 12;
  const maxX = grid.width - EDGE_MARGIN - 12;
  const maxY = grid.height - EDGE_MARGIN - 12;
  if (maxX <= minX || maxY <= minY) return null;

  for (let attempt = 0; attempt < 14; attempt++) {
    const raw = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
    const distance = Math.hypot(raw.x - from.x, raw.y - from.y);
    if (distance < WANDER_MIN_DISTANCE || distance > WANDER_MAX_DISTANCE) continue;
    const goal = findNearestWalkable(grid, raw);
    if (Math.hypot(goal.x - raw.x, goal.y - raw.y) > 26) continue;
    return goal;
  }
  return null;
}

/** 새 목적지로 경로를 갈아탄다. 속도·위치를 유지해 멈칫하지 않는다. */
export function setDestination(
  state: PenguinState,
  waypoints: Vec2[],
  target: Vec2,
  now: number
): void {
  state.waypoints = waypoints;
  state.target = target;
  state.lookTarget = 0;
  state.lookOffset *= 0.4;
  state.nextIdleAt = now + 3000 + Math.random() * 3000;
  resetWanderTimer(state, now);
}

/**
 * 장애물 지도가 바뀐 뒤 물리 상태를 정리한다.
 * 이미 이동 가능한 위치와 유효한 경로는 그대로 둔다. 매번 셀 중심으로 스냅하면
 * 프레임 사이의 미세 이동이 되돌아와 제자리에서 걷는 것처럼 보인다
 * (AI 분석 중 상태 문구·타임라인 변경으로 지도가 자주 갱신될수록 심해진다).
 */
export function reconcilePenguin(state: PenguinState, grid: NavGrid): void {
  const position = { x: state.x, y: state.y };
  if (!isCellWalkable(grid, position) || isPointInObstacle(grid, position)) {
    const walkable = findNearestWalkable(grid, position);
    state.x = walkable.x;
    state.y = walkable.y;
  }

  if (!state.target) return;
  const goalBlocked =
    !isCellWalkable(grid, state.target) || isPointInObstacle(grid, state.target);
  const pathBlocked = isPathBlocked(grid, { x: state.x, y: state.y }, state.waypoints);
  if (!goalBlocked && !pathBlocked) return;

  // 목적지나 경로가 새 장애물에 막힌 경우에만 경로를 다시 계산한다.
  const goal = goalBlocked ? findNearestWalkable(grid, state.target) : state.target;
  state.waypoints = findPath(grid, { x: state.x, y: state.y }, goal);
  state.target = goal;
}

/**
 * 한 프레임 물리 적분. 착지(영교차점) 순간 새 발자국을 반환한다.
 * 호출자가 grid를 넘기므로 리사이즈로 갇힌 위치는 즉시 밀어낸다.
 */
export function stepPenguin(
  state: PenguinState,
  dt: number,
  now: number,
  grid: NavGrid,
  gait: AnimalGait = 'waddle',
  extraVelocity: Vec2 = { x: 0, y: 0 },
  speedScale = 1
): Footprint[] {
  const maxSpeed = gait === 'hop' ? 55 : gait === 'trot' ? 52 : MAX_SPEED;
  const walkStride = gait === 'hop' ? 8.4 : WALK_STRIDE;
  const ejected = ejectFromObstacles(
    { x: state.x, y: state.y },
    grid.obstacles,
    grid.width,
    grid.height
  );
  state.x = ejected.x;
  state.y = ejected.y;

  // 모서리를 미리 돌아나가도록 웨이포인트를 한 번에 넘겨 consume한다.
  while (state.waypoints.length > 0) {
    const wp = state.waypoints[0];
    const dx = wp.x - state.x;
    const dy = wp.y - state.y;
    const dist = Math.hypot(dx, dy);
    if (state.waypoints.length > 1 && dist < CORNER_LOOKAHEAD) {
      state.waypoints.shift();
      continue;
    }
    if (dist < ARRIVE_RADIUS) {
      state.waypoints.shift();
      continue;
    }
    break;
  }

  if (state.waypoints.length === 0) {
    if (state.target !== null) state.target = null;
    if (state.isWandering) {
      // 산책 도착 — 잠시 쉬었다가 다시 배회한다.
      state.isWandering = false;
      state.nextWanderAt = now + 2200 + Math.random() * 3200;
    }
    if (now >= state.nextWanderAt) {
      const from = { x: state.x, y: state.y };
      const goal = pickWanderGoal(grid, from);
      const path = goal ? findPath(grid, from, goal) : [];
      if (goal && path.length > 0) {
        state.waypoints = path;
        state.target = goal;
        state.isWandering = true;
        state.nextWanderAt = Number.POSITIVE_INFINITY;
        state.lookTarget = 0;
        state.lookOffset *= 0.5;
        state.nextIdleAt = now + 4000;
      } else {
        state.nextWanderAt = now + 1400;
      }
    }
    state.moveBlend = approach(state.moveBlend, 0, dt * 2.4);
    state.vx = approach(state.vx, 0, MAX_ACCEL * dt);
    state.vy = approach(state.vy, 0, MAX_ACCEL * dt);
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    // 멈추면 천천히 정면을 돌아보며 서 있다 (급하게 확 돌지 않게 보간).
    state.heading = shortestAngleLerp(state.heading, Math.PI / 2, dt * 1.6);

    if (now >= state.nextIdleAt) {
      state.nextIdleAt = now + 3000 + Math.random() * 3000;
      if (Math.random() < 0.62) {
        state.lookTarget = (Math.random() * 2 - 1) * 0.35;
        state.idleUntil = now + 900 + Math.random() * 900;
      } else {
        state.flapUntil = now + 260;
        state.lookTarget = 0;
      }
    }
    if (now >= state.idleUntil) state.lookTarget = 0;
  } else {
    const wp = state.waypoints[0];
    const dx = wp.x - state.x;
    const dy = wp.y - state.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed =
      maxSpeed *
      speedScale *
      (state.isWandering ? WANDER_SPEED_SCALE : 1) *
      Math.min(1, dist / SLOW_RADIUS);
    const desiredVx = (dx / dist) * speed + extraVelocity.x;
    const desiredVy = (dy / dist) * speed + extraVelocity.y;

    let steerX = desiredVx - state.vx;
    let steerY = desiredVy - state.vy;
    const steerMag = Math.hypot(steerX, steerY);
    const maxSteer = MAX_ACCEL * dt;
    if (steerMag > maxSteer) {
      steerX = (steerX / steerMag) * maxSteer;
      steerY = (steerY / steerMag) * maxSteer;
    }
    state.vx += steerX;
    state.vy += steerY;
    state.x += state.vx * dt;
    state.y += state.vy * dt;

    if (Math.hypot(state.vx, state.vy) > 0.5) {
      const desiredHeading = Math.atan2(state.vy, state.vx);
      state.heading = shortestAngleLerp(state.heading, desiredHeading, TURN_SPEED * dt);
    }
    state.moveBlend = approach(state.moveBlend, 1, dt * 3.2);
  }

  state.lookOffset += (state.lookTarget - state.lookOffset) * Math.min(1, dt * 3.5);
  state.squash = Math.max(0, state.squash - dt * 5.5);

  if (now >= state.nextBlinkAt) {
    state.blinkUntil = now + 110;
    state.nextBlinkAt = now + 3200 + Math.random() * 2300;
  }

  const speedNow = Math.hypot(state.vx, state.vy);
  state.walkCycle += (speedNow / walkStride) * dt;
  const currentSin = Math.sin(state.walkCycle);
  const footprints: Footprint[] = [];

  if (speedNow > 6 && state.moveBlend > 0.2) {
    const previous = state.prevWalkSin;
    let signs: Array<1 | -1> = [];
    if (gait === 'hop') {
      if (previous >= 0 && currentSin < 0) signs = [-1, 1];
    } else if (previous <= 0 && currentSin > 0) signs = [1];
    else if (previous >= 0 && currentSin < 0) signs = [-1];

    if (signs.length > 0) {
      const nx = -Math.sin(state.heading);
      const ny = Math.cos(state.heading) * 0.58;
      for (const sign of signs) {
        footprints.push({
          x: state.x + sign * FOOT_OFFSET * nx,
          y: state.y + sign * FOOT_OFFSET * ny,
          angle: state.heading + sign * 0.22,
          sign,
          bornAt: now,
        });
      }
      state.squash = Math.min(1, state.squash + (gait === 'hop' ? 0.85 : 0.7));
    }
  }
  state.prevWalkSin = currentSin;

  return footprints;
}

export function pruneFootprints(footprints: Footprint[], now: number): void {
  while (
    footprints.length > 0 &&
    (now - footprints[0].bornAt > FOOTPRINT_LIFETIME || footprints.length > MAX_FOOTPRINTS)
  ) {
    footprints.shift();
  }
}
