import { OUTLINE_WIDTH, PERSPECTIVE_Y, resolveSceneStyle, type SceneStyle } from './stageStyle.ts';
import type { Palette, Rect, Vec2 } from './types.ts';

const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, TAU);
}

function poly(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
  ctx.closePath();
}

/** 완전한 타원이 아니라 결정적으로 흔들린 점 집합으로 "깨진" 단면을 만든다. */
function makeIrregularEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number,
  seed: number
): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * TAU;
    const noise = Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453) % 1;
    const wobble = 1 + (noise - 0.5) * 0.12;
    points.push({
      x: cx + Math.cos(angle) * rx * wobble,
      y: cy + Math.sin(angle) * ry * wobble,
    });
  }
  return points;
}

/**
 * 윗면 + 옆면 2단 얼음. 앞쪽(화면 아래쪽) 절반만 아래로 복사해 벽을 만들고
 * 결정면 선을 넣어 원판이 아닌 두께 있는 얼음으로 보이게 한다.
 */
function drawIceSlab(
  ctx: CanvasRenderingContext2D,
  points: Vec2[],
  thickness: number,
  s: SceneStyle,
  lineWidth = OUTLINE_WIDTH
): void {
  const count = points.length;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= count;
  cy /= count;
  let rx = 0;
  let ry = 0;
  for (const p of points) {
    rx = Math.max(rx, Math.abs(p.x - cx));
    ry = Math.max(ry, Math.abs(p.y - cy));
  }

  ctx.fillStyle = s.shadow;
  ellipse(ctx, cx, cy + thickness + 2, rx, rx * PERSPECTIVE_Y * 0.5);
  ctx.fill();

  const bottom: Vec2[] = points.map((p) => ({ x: p.x, y: p.y + thickness }));
  const front: number[] = [];
  for (let i = 0; i < count; i++) {
    if (Math.sin((i / count) * TAU) > -0.02) front.push(i);
  }

  if (front.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[front[0]!]!.x, points[front[0]!]!.y);
    for (let k = 1; k < front.length; k++) {
      ctx.lineTo(points[front[k]!]!.x, points[front[k]!]!.y);
    }
    for (let k = front.length - 1; k >= 0; k--) {
      const i = front[k]!;
      ctx.lineTo(bottom[i]!.x, bottom[i]!.y);
    }
    ctx.closePath();
    ctx.fillStyle = s.iceSide;
    ctx.fill();
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = Math.max(1, lineWidth * 0.7);
    ctx.stroke();

    ctx.fillStyle = s.iceSideDeep;
    for (let k = 0; k < front.length - 1; k += 2) {
      const i = front[k]!;
      const j = front[k + 1]!;
      ctx.beginPath();
      ctx.moveTo(points[i]!.x, points[i]!.y);
      ctx.lineTo(bottom[i]!.x, bottom[i]!.y);
      ctx.lineTo(bottom[j]!.x, bottom[j]!.y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = s.line;
    ctx.lineWidth = 1;
    for (const i of front) {
      ctx.beginPath();
      ctx.moveTo(points[i]!.x, points[i]!.y);
      ctx.lineTo(bottom[i]!.x, bottom[i]!.y);
      ctx.stroke();
    }
  }

  poly(ctx, points);
  ctx.fillStyle = s.iceTop;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // 윗면 안쪽 광택선: 얼음 표면이 플랫 채움로만 끝나지 않게 한다.
  if (rx > 40) {
    ctx.strokeStyle = s.hi;
    ctx.lineWidth = 1;
    poly(
      ctx,
      points.map((p) => ({ x: cx + (p.x - cx) * 0.94, y: cy + (p.y - cy) * 0.94 }))
    );
    ctx.stroke();
  }
}

function drawDrift(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  s: SceneStyle
): void {
  ctx.fillStyle = s.snow;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  s: SceneStyle
): void {
  ctx.fillStyle = s.snowBg;
  ctx.fillRect(0, 0, width, height);
  const unit = Math.min(width, height);
  drawDrift(ctx, width * 0.04, height * 0.98, unit * 0.26, unit * 0.075, s);
  drawDrift(ctx, width * 0.96, height * 0.99, unit * 0.25, unit * 0.07, s);
  drawDrift(ctx, width * 0.03, height * 0.03, unit * 0.2, unit * 0.06, s);
  drawDrift(ctx, width * 0.97, height * 0.02, unit * 0.19, unit * 0.055, s);
}

/**
 * 미리보기창 아래에 자리 잡은 얼음 구멍.
 * 얼음판은 땅과 같은 높이로 깔리고, 두께는 구멍 안쪽 벽(뒷쪽 절반)에서만 보인다.
 */
function drawFrozenPond(
  ctx: CanvasRenderingContext2D,
  preview: Rect | null,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  s: SceneStyle
): void {
  const cx = preview ? (preview.left + preview.right) / 2 : width / 2;
  const cy = preview ? (preview.top + preview.bottom) / 2 : height / 2;
  const halfW = preview ? (preview.right - preview.left) / 2 : width * 0.36;
  const halfH = preview ? (preview.bottom - preview.top) / 2 : height * 0.26;
  const rx = halfW * 1.18;
  const ry = halfH * 1.32;
  if (rx < 24 || ry < 16) return;

  const innerRx = halfW * 1.02;
  const innerRy = halfH * 1.12;
  const wallH = clamp(Math.min(width, height) * 0.02, 8, 14);
  const outer = makeIrregularEllipse(cx, cy, rx, ry, 20, 3);
  const hole = makeIrregularEllipse(cx, cy, innerRx, innerRy, 20, 3);

  // 1. 구멍 바닥의 물. 그라데이션 대신 플랫 2톤으로 깊이만 표현한다.
  ctx.save();
  poly(ctx, hole);
  ctx.clip();
  ctx.fillStyle = s.waterLight;
  ctx.fillRect(cx - innerRx, cy - innerRy, innerRx * 2, innerRy * 2);
  ctx.fillStyle = s.waterDeep;
  ellipse(ctx, cx, cy + innerRy * 0.45, innerRx * 1.1, innerRy * 0.95);
  ctx.fill();
  ctx.restore();

  // 2. 구멍 안쪽 벽. 뒤쪽(화면 위쪽) 절반만 보이므로 그쪽 단면을 아래로 복사한다.
  const back: number[] = [];
  for (let i = 0; i < hole.length; i++) {
    if (Math.sin((i / hole.length) * TAU) < -0.02) back.push(i);
  }
  if (back.length > 1) {
    const lower = hole.map((p) => ({ x: p.x, y: p.y + wallH }));
    ctx.beginPath();
    ctx.moveTo(hole[back[0]!]!.x, hole[back[0]!]!.y);
    for (let k = 1; k < back.length; k++) {
      ctx.lineTo(hole[back[k]!]!.x, hole[back[k]!]!.y);
    }
    for (let k = back.length - 1; k >= 0; k--) {
      const i = back[k]!;
      ctx.lineTo(lower[i]!.x, lower[i]!.y);
    }
    ctx.closePath();
    ctx.fillStyle = s.iceSide;
    ctx.fill();
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = s.iceSideDeep;
    for (let k = 0; k < back.length - 1; k += 2) {
      const i = back[k]!;
      const j = back[k + 1]!;
      ctx.beginPath();
      ctx.moveTo(hole[i]!.x, hole[i]!.y);
      ctx.lineTo(lower[i]!.x, lower[i]!.y);
      ctx.lineTo(lower[j]!.x, lower[j]!.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = s.line;
    for (const i of back) {
      ctx.beginPath();
      ctx.moveTo(hole[i]!.x, hole[i]!.y);
      ctx.lineTo(lower[i]!.x, lower[i]!.y);
      ctx.stroke();
    }
  }

  // 3. 얼음판 윗면. 바깥 타원에서 구멍을 빼 도넛 모양으로 채운다. (바깥으로 튀어나오지 않음)
  ctx.beginPath();
  ctx.moveTo(outer[0]!.x, outer[0]!.y);
  for (let i = 1; i < outer.length; i++) ctx.lineTo(outer[i]!.x, outer[i]!.y);
  ctx.closePath();
  ctx.moveTo(hole[0]!.x, hole[0]!.y);
  for (let i = 1; i < hole.length; i++) ctx.lineTo(hole[i]!.x, hole[i]!.y);
  ctx.closePath();
  ctx.fillStyle = s.iceTop;
  ctx.fill('evenodd');
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();

  // 얼음판 가장자리 광택선
  ctx.strokeStyle = s.hi;
  ctx.lineWidth = 1;
  poly(
    ctx,
    outer.map((p) => ({ x: cx + (p.x - cx) * 0.96, y: cy + (p.y - cy) * 0.96 }))
  );
  ctx.stroke();

  // 4. 구멍에서 바깥으로 뻗는 균열
  ctx.strokeStyle = s.line;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU + 0.15;
    const mid = 0.45 + ((i * 7) % 5) * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerRx, cy + Math.sin(angle) * innerRy);
    ctx.lineTo(
      cx + Math.cos(angle + 0.06) * (innerRx + (rx - innerRx) * mid),
      cy + Math.sin(angle + 0.06) * (innerRy + (ry - innerRy) * mid)
    );
    ctx.lineTo(
      cx + Math.cos(angle - 0.03) * rx * 0.97,
      cy + Math.sin(angle - 0.03) * ry * 0.97
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 5. 얼음판 위에 얹힌 작은 얼음 조각
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * TAU + 0.4;
    const sx = cx + Math.cos(angle) * (innerRx + (rx - innerRx) * 0.55);
    const sy = cy + Math.sin(angle) * (innerRy + (ry - innerRy) * 0.55);
    poly(ctx, makeIrregularEllipse(sx, sy, rx * 0.055, ry * 0.06, 8, i + 11));
    ctx.fillStyle = s.iceTop;
    ctx.fill();
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // 6. 물 위에 띄운 작은 얼음 조각
  const floes: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [cx, cy - innerRy * 0.66, rx * 0.09, ry * 0.09, 5],
    [cx + rx * 0.1, cy + innerRy * 0.72, rx * 0.1, ry * 0.09, 9],
  ];
  for (const [fx, fy, frx, fry, seed] of floes) {
    drawIceSlab(ctx, makeIrregularEllipse(fx, fy, frx, fry, 8, seed), wallH * 0.6, s, 1.2);
  }

  // 7. 찰랑거리는 물결
  ctx.strokeStyle = s.ripple;
  ctx.lineWidth = 1.2;
  const t = reducedMotion ? 0 : now * 0.0014;
  for (let i = 0; i < 3; i++) {
    const phase = (t + i * 0.63) % 1;
    const scale = 0.18 + phase * 0.58;
    ctx.globalAlpha = (1 - phase) * 0.7;
    ellipse(ctx, cx + innerRx * 0.08, cy + innerRy * 0.1, innerRx * scale, innerRy * scale * 0.82);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 눈이 쌓인 소나무. 곡선 가지 + 윤곽 있는 눈 덮개 + 정수리 광택 호. */
function drawSnowyPine(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  seed: number,
  s: SceneStyle
): void {
  ctx.fillStyle = s.shadow;
  ellipse(ctx, x, groundY + 2, scale * 0.5, scale * 0.5 * PERSPECTIVE_Y);
  ctx.fill();

  ctx.fillStyle = s.coat;
  ctx.fillRect(x - scale * 0.06, groundY - scale * 0.6, scale * 0.12, scale * 0.6);

  for (let tier = 0; tier < 3; tier++) {
    const width = scale * (0.96 - tier * 0.21);
    const topY = groundY - scale * (0.5 + tier * 0.48);
    const baseY = topY + scale * 0.68;

    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.quadraticCurveTo(x + width * 0.55, topY + scale * 0.2, x + width / 2, baseY);
    ctx.quadraticCurveTo(x, baseY + scale * 0.1, x - width / 2, baseY);
    ctx.quadraticCurveTo(x - width * 0.55, topY + scale * 0.2, x, topY);
    ctx.closePath();
    ctx.fillStyle = s.tree;
    ctx.fill();
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = Math.min(OUTLINE_WIDTH, scale * 0.035);
    ctx.stroke();

    const capRatio = 0.5 + tier * 0.03 + ((seed + tier) % 3) * 0.03;
    const capY = topY + (baseY - topY) * capRatio;
    const half = width * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, topY + 1);
    ctx.quadraticCurveTo(x + half * 0.7, capY - scale * 0.1, x + half, capY);
    ctx.quadraticCurveTo(x + half * 0.6, capY + scale * 0.07, x + half * 0.3, capY - scale * 0.02);
    ctx.quadraticCurveTo(x, capY + scale * 0.06, x - half * 0.3, capY - scale * 0.02);
    ctx.quadraticCurveTo(x - half * 0.6, capY + scale * 0.07, x - half, capY);
    ctx.quadraticCurveTo(x - half * 0.7, capY - scale * 0.1, x, topY + 1);
    ctx.closePath();
    ctx.fillStyle = s.snow;
    ctx.fill();
    ctx.strokeStyle = s.line;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.strokeStyle = s.hi;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, topY + scale * 0.14, half * 0.42, Math.PI * 1.08, Math.PI * 1.5);
    ctx.stroke();

    // 가지 끝에 늘어진 작은 눈 덩어리
    ctx.fillStyle = s.snow;
    for (const side of [-1, 1]) {
      if ((seed + tier + (side + 1) / 2) % 2 === 0) continue;
      ellipse(ctx, x + side * width * 0.4, baseY - scale * 0.06, scale * 0.06, scale * 0.045);
      ctx.fill();
    }
  }
}

/** 눈이 쌓인 돌. 비대칭 베지어 덩어리 + 외곽 있는 눈 덮개. */
function drawSnowyRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  s: SceneStyle
): void {
  ctx.fillStyle = s.shadow;
  ellipse(ctx, x, groundY + 2, scale * 0.6, scale * 0.6 * PERSPECTIVE_Y);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - scale * 0.55, groundY);
  ctx.bezierCurveTo(
    x - scale * 0.5,
    groundY - scale * 0.5,
    x - scale * 0.1,
    groundY - scale * 0.66,
    x + scale * 0.1,
    groundY - scale * 0.62
  );
  ctx.bezierCurveTo(
    x + scale * 0.42,
    groundY - scale * 0.6,
    x + scale * 0.56,
    groundY - scale * 0.28,
    x + scale * 0.56,
    groundY
  );
  ctx.closePath();
  ctx.fillStyle = s.rock;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = Math.min(OUTLINE_WIDTH, scale * 0.06);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - scale * 0.5, groundY - scale * 0.12);
  ctx.quadraticCurveTo(x - scale * 0.2, groundY - scale * 0.64, x + scale * 0.05, groundY - scale * 0.62);
  ctx.quadraticCurveTo(x + scale * 0.34, groundY - scale * 0.6, x + scale * 0.48, groundY - scale * 0.18);
  ctx.quadraticCurveTo(x + scale * 0.1, groundY - scale * 0.3, x - scale * 0.5, groundY - scale * 0.12);
  ctx.closePath();
  ctx.fillStyle = s.snow;
  ctx.fill();
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** 얼음집(이글루). 잉크 블록선 + 외곽 있는 눈 덮개 + belly 색 출입구. */
function drawIgloo(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  s: SceneStyle
): void {
  const rx = scale * 0.9;
  const ry = scale * 0.76;

  ctx.fillStyle = s.shadow;
  ellipse(ctx, x, groundY + 2, rx * 1.08, rx * 1.08 * PERSPECTIVE_Y);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - rx, groundY);
  ctx.ellipse(x, groundY, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = s.iceTop;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - rx, groundY);
  ctx.ellipse(x, groundY, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = s.outline;
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = 1.2;
  for (const ratio of [0.34, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(x, groundY, rx * ratio, ry * ratio, 0, Math.PI, TAU);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const angle = Math.PI + (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * rx, groundY + Math.sin(angle) * ry);
    ctx.lineTo(x + Math.cos(angle) * rx * 0.36, groundY + Math.sin(angle) * ry * 0.36);
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(x - rx * 0.76, groundY - ry * 0.4);
  ctx.quadraticCurveTo(x - rx * 0.56, groundY - ry * 1.1, x, groundY - ry * 1.12);
  ctx.quadraticCurveTo(x + rx * 0.56, groundY - ry * 1.08, x + rx * 0.78, groundY - ry * 0.38);
  ctx.quadraticCurveTo(x + rx * 0.4, groundY - ry * 0.6, x, groundY - ry * 0.58);
  ctx.quadraticCurveTo(x - rx * 0.42, groundY - ry * 0.6, x - rx * 0.76, groundY - ry * 0.4);
  ctx.closePath();
  ctx.fillStyle = s.snow;
  ctx.fill();
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.strokeStyle = s.hi;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, groundY - ry * 0.82, rx * 0.3, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - rx * 0.28, groundY);
  ctx.lineTo(x - rx * 0.28, groundY - ry * 0.22);
  ctx.quadraticCurveTo(x, groundY - ry * 0.95, x + rx * 0.28, groundY - ry * 0.22);
  ctx.lineTo(x + rx * 0.28, groundY);
  ctx.closePath();
  ctx.fillStyle = s.mask;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

/** 배경 전체: 플랫 눈 바닥 → 입체 얼음 웅덩이 → 나무·돌·얼음집. */
export function drawSnowScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  palette: Palette,
  preview: Rect | null
): void {
  const s = resolveSceneStyle(palette);
  drawGround(ctx, width, height, s);
  drawFrozenPond(ctx, preview, width, height, now, reducedMotion, s);

  const unit = Math.min(width, height);
  const treeScale = clamp(unit / 12, 46, 72);
  const rockScale = clamp(unit / 26, 20, 34);
  const iglooScale = clamp(unit / 14, 40, 60);

  const trees: ReadonlyArray<readonly [number, number, number]> = [
    [0.05, 0.3, 1],
    [0.95, 0.26, 0.88],
    [0.07, 0.82, 0.94],
  ];
  trees.forEach(([px, py, factor], index) => {
    drawSnowyPine(ctx, width * px, height * py, treeScale * factor, index, s);
  });

  const rocks: ReadonlyArray<readonly [number, number]> = [
    [0.22, 0.92],
    [0.78, 0.95],
    [0.5, 0.97],
  ];
  for (const [px, py] of rocks) {
    drawSnowyRock(ctx, width * px, height * py, rockScale, s);
  }

  if (width > 560 && height > 420) {
    drawIgloo(ctx, width * 0.14, height * 0.62, iglooScale, s);
    drawIgloo(ctx, width * 0.86, height * 0.6, iglooScale * 0.8, s);
  }
}
