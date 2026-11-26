import { ejectFromObstacles, type NavGrid } from './navigationGrid.ts';
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
    heading: 0.65,
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
  };
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
}

/**
 * 한 프레임 물리 적분. 착지(영교차점) 순간 새 발자국을 반환한다.
 * 호출자가 grid를 넘기므로 리사이즈로 갇힌 위치는 즉시 밀어낸다.
 */
export function stepPenguin(
  state: PenguinState,
  dt: number,
  now: number,
  grid: NavGrid
): Footprint[] {
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
    state.moveBlend = approach(state.moveBlend, 0, dt * 2.4);
    state.vx = approach(state.vx, 0, MAX_ACCEL * dt);
    state.vy = approach(state.vy, 0, MAX_ACCEL * dt);
    state.x += state.vx * dt;
    state.y += state.vy * dt;

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
    const speed = MAX_SPEED * Math.min(1, dist / SLOW_RADIUS);
    const desiredVx = (dx / dist) * speed;
    const desiredVy = (dy / dist) * speed;

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
  state.walkCycle += (speedNow / WALK_STRIDE) * dt;
  const currentSin = Math.sin(state.walkCycle);
  const footprints: Footprint[] = [];

  if (speedNow > 6 && state.moveBlend > 0.2) {
    const previous = state.prevWalkSin;
    let sign: 1 | -1 | null = null;
    if (previous <= 0 && currentSin > 0) sign = 1;
    else if (previous >= 0 && currentSin < 0) sign = -1;

    if (sign !== null) {
      const nx = -Math.sin(state.heading);
      const ny = Math.cos(state.heading) * 0.58;
      footprints.push({
        x: state.x + sign * FOOT_OFFSET * nx,
        y: state.y + sign * FOOT_OFFSET * ny,
        angle: state.heading + sign * 0.22,
        sign,
        bornAt: now,
      });
      state.squash = Math.min(1, state.squash + 0.7);
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
