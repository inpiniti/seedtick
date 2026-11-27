import { OUTLINE_WIDTH, PERSPECTIVE_Y, resolveSceneStyle, type SceneStyle } from './stageStyle.ts';
import type { Palette, Rect, Vec2 } from './types.ts';

const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** 동물과 함께 y 오름차순으로 정렬해 그리는 입체 소품 단위. */
export interface SceneryDrawable {
  y: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** 위치마다 고정된 0~1 의사난수. */
function hash(n: number): number {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

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

/** 점 사이 중점을 지나는 2차 베지어 곡선으로 닫힌 매끈한 윤곽을 그린다. */
function traceSmooth(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  const n = points.length;
  const last = points[n - 1]!;
  const first = points[0]!;
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % n]!;
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

/** 꼭짓점만 부드럽게 둥글린 다각형. 동물 외곽선처럼 각이 찌르지 않게 한다. */
function roundedPoly(ctx: CanvasRenderingContext2D, points: Vec2[], radius: number): void {
  const n = points.length;
  const last = points[n - 1]!;
  const first = points[0]!;
  ctx.beginPath();
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % n]!;
    ctx.arcTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2, radius);
  }
  ctx.closePath();
}

/** 동물 발밑과 같은 문법의 납작 타원 그림자. */
function groundShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  s: SceneStyle
): void {
  ctx.fillStyle = s.shadow;
  ellipse(ctx, x, y + 1.8, rx, rx * PERSPECTIVE_Y * 0.58);
  ctx.fill();
}

/** 다크모드에서는 동물과 동일하게 밝은 외곽 림을 먼저 둘러 윤곽선이 배경에 묻히지 않게 한다. */
function strokeOuterRim(
  ctx: CanvasRenderingContext2D,
  trace: () => void,
  s: SceneStyle,
  lineWidth = OUTLINE_WIDTH
): void {
  if (!s.dark) return;
  trace();
  ctx.strokeStyle = s.outerRim;
  ctx.lineWidth = lineWidth + 1.15;
  ctx.stroke();
}

/* ────────────────────────── 바닥 & 중앙 해빙 웅덩이 ────────────────────────── */

interface PondGeometry {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  a: number;
  b: number;
  padSide: number;
}

function getPondGeometry(
  preview: Rect | null,
  width: number,
  height: number
): PondGeometry | null {
  if (!preview) return null;
  const rawW = (preview.right - preview.left) / 2;
  const rawH = (preview.bottom - preview.top) / 2;
  if (rawW < 24 || rawH < 18) return null;

  const unit = Math.min(width, height);
  const padSide = clamp(unit * 0.044, 24, 38);
  const padTop = clamp(unit * 0.038, 20, 32);
  const bottomRoom = Math.max(0, height - preview.bottom);
  // 빈 상태 안내 문구(.sv2-preview-empty-copy, preview 하단 +16~56px)를 가로지르지 않도록 여유를 둔다.
  const padBottom =
    bottomRoom > 96
      ? clamp(unit * 0.088, 64, 74)
      : clamp(bottomRoom * 0.48, 18, 32);

  const top = Math.max(18, preview.top - padTop);
  const bottom = Math.min(height - 18, preview.bottom + padBottom);
  const left = Math.max(18, preview.left - padSide);
  const right = Math.min(width - 18, preview.right + padSide);

  return {
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
    halfW: rawW,
    halfH: rawH,
    a: (right - left) / 2,
    b: (bottom - top) / 2,
    padSide,
  };
}

/** 톱니 노이즈 없이 저주파 고조파만 섞은 둥근 초타원 해빙 윤곽. */
function makePondOutline(g: PondGeometry): Vec2[] {
  const segments = 48;
  const points: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * TAU;
    const c = Math.cos(theta);
    const sn = Math.sin(theta);
    const wave =
      1 +
      0.024 * Math.sin(theta * 3 + 0.7) +
      0.015 * Math.cos(theta * 5 - 0.5) +
      0.009 * Math.sin(theta * 7 + 1.3);
    points.push({
      x: g.cx + Math.sign(c) * Math.pow(Math.abs(c), 0.68) * g.a * wave,
      y: g.cy + Math.sign(sn) * Math.pow(Math.abs(sn), 0.68) * g.b * wave,
    });
  }
  return points;
}

function insidePond(g: PondGeometry | null, x: number, y: number, margin: number): boolean {
  if (!g) return false;
  const nx = Math.abs(x - g.cx) / (g.a + margin);
  const ny = Math.abs(y - g.cy) / (g.b + margin);
  return Math.pow(nx, 2.8) + Math.pow(ny, 2.8) < 1;
}

/** 외곽선 없는 은은한 눈 둔덕 패치 + 사스트루기(바람결 눈무늬). 가장자리 반원은 절대 그리지 않는다. */
function drawSnowField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pond: PondGeometry | null,
  s: SceneStyle
): void {
  ctx.fillStyle = s.snowBg;
  ctx.fillRect(0, 0, width, height);

  // 외곽선 없이 눈빛 농담만 살짝 주는 완만한 설원 패치(모서리에 걸치지 않도록 내부에만 배치).
  const patches: ReadonlyArray<readonly [number, number, number, number]> = [
    [0.14, 0.34, 0.09, 0.055],
    [0.16, 0.76, 0.11, 0.06],
    [0.86, 0.28, 0.095, 0.055],
    [0.85, 0.72, 0.105, 0.06],
    [0.48, 0.9, 0.12, 0.045],
  ];
  ctx.fillStyle = s.snowDrift;
  for (const [fx, fy, rxRatio, ryRatio] of patches) {
    const x = width * fx;
    const y = height * fy;
    if (insidePond(pond, x, y, 40)) continue;
    ellipse(ctx, x, y, width * rxRatio, height * ryRatio);
    ctx.fill();
  }

  // 바람에 쓸린 남극 눈결(사스트루기).
  const stepX = 108;
  const stepY = 74;
  ctx.strokeStyle = s.sastrugi;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let row = 0; row * stepY < height; row++) {
    for (let col = 0; col * stepX < width; col++) {
      const id = col * 131 + row * 977;
      if (hash(id * 0.37) < 0.48) continue;
      const x = (col + 0.5) * stepX + (hash(id * 0.71) - 0.5) * stepX * 0.7;
      const y = (row + 0.5) * stepY + (hash(id * 1.13) - 0.5) * stepY * 0.55;
      if (x < 32 || x > width - 32 || y < 26 || y > height - 26) continue;
      if (insidePond(pond, x, y, 26)) continue;
      const len = 13 + hash(id * 0.29) * 14;
      ctx.moveTo(x - len / 2, y);
      ctx.quadraticCurveTo(x, y - 2.2, x + len / 2, y + 0.4);
      const len2 = len * 0.55;
      const ox = x + len * 0.22;
      const oy = y + 4.2;
      ctx.moveTo(ox - len2 / 2, oy);
      ctx.quadraticCurveTo(ox, oy - 1.4, ox + len2 / 2, oy + 0.3);
    }
  }
  ctx.stroke();
}

/** 물 위에 떠 있는 통통한 소형 유빙 조각. */
function drawFloatingFloe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  thickness: number,
  phase: number,
  seed: number,
  s: SceneStyle
): void {
  ctx.strokeStyle = s.ripple;
  ctx.lineWidth = 1.15;
  ctx.globalAlpha = (1 - phase) * 0.72;
  ellipse(ctx, x, y + thickness * 0.65, rx * (1.12 + phase * 0.55), ry * (1.12 + phase * 0.55));
  ctx.stroke();
  ctx.globalAlpha = 1;

  const pts: Vec2[] = [];
  const seg = 10;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    const w = 1 + (hash(seed * 13 + i) - 0.5) * 0.16;
    pts.push({ x: x + Math.cos(a) * rx * w, y: y + Math.sin(a) * ry * w });
  }

  // 아래로 보이는 2.5D 얼음 옆면.
  const lower = pts.map((p) => ({ x: p.x, y: p.y + thickness }));
  ctx.beginPath();
  traceSmooth(ctx, lower);
  ctx.fillStyle = s.iceSide;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // 눈 덮인 유빙 윗면.
  ctx.beginPath();
  traceSmooth(ctx, pts);
  ctx.fillStyle = s.snow;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

/**
 * 미리보기창 주변에 열린 남극 해빙 웅덩이(폴리냐).
 * 톱니 다각형 대신 매끈한 곡선 해안선과 2단 얼음 절벽으로 동물 그림체와 톤을 맞춘다.
 */
function drawSeaIcePond(
  ctx: CanvasRenderingContext2D,
  g: PondGeometry,
  now: number,
  reducedMotion: boolean,
  s: SceneStyle
): void {
  const hole = makePondOutline(g);
  const wallH = clamp(g.padSide * 0.32, 8, 13);
  const shifted = (dy: number): Vec2[] => hole.map((p) => ({ x: p.x, y: p.y + dy }));
  const rimOuter = hole.map((p) => ({
    x: g.cx + (p.x - g.cx) * 1.028,
    y: g.cy + (p.y - g.cy) * 1.038,
  }));
  const t = reducedMotion ? 0 : now * 0.001;

  // 물가 바깥쪽을 따라 살짝 도톰하게 쌓인 눈 턱(외곽선 없이 설원과 부드럽게 이어진다).
  ctx.beginPath();
  traceSmooth(ctx, rimOuter);
  ctx.fillStyle = s.snow;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  traceSmooth(ctx, hole);
  ctx.clip();

  // 1. 차분한 2톤 남극 바닷물.
  ctx.fillStyle = s.waterLight;
  ctx.fillRect(g.cx - g.a - 10, g.cy - g.b - 10, g.a * 2 + 20, g.b * 2 + 20);

  ctx.beginPath();
  traceSmooth(ctx, shifted(wallH));
  traceSmooth(ctx, shifted(wallH * 2.35));
  ctx.fillStyle = s.waterDeep;
  ctx.fill('evenodd');

  // 2. 위쪽(먼 쪽) 해빙 단면 벽. 톱니 삼각형 없이 부드러운 음영 블록과 세로 결만 둔다.
  ctx.beginPath();
  traceSmooth(ctx, hole);
  traceSmooth(ctx, shifted(wallH));
  ctx.fillStyle = s.iceSide;
  ctx.fill('evenodd');

  ctx.save();
  ctx.beginPath();
  traceSmooth(ctx, hole);
  traceSmooth(ctx, shifted(wallH));
  ctx.clip('evenodd');

  // 좌우 모서리 곡면에 은은한 깊은 얼음 톤을 얹어 입체감을 준다.
  ctx.fillStyle = s.iceSideDeep;
  ellipse(ctx, g.cx - g.a * 0.72, g.cy - g.b * 0.45, g.a * 0.34, g.b * 0.42);
  ctx.fill();
  ellipse(ctx, g.cx + g.a * 0.74, g.cy - g.b * 0.42, g.a * 0.32, g.b * 0.4);
  ctx.fill();

  ctx.strokeStyle = s.line;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let i = 0; i < hole.length; i += 4) {
    const p = hole[i]!;
    if (p.y > g.cy) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + wallH);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  traceSmooth(ctx, shifted(wallH));
  ctx.stroke();

  // 3. 좌우 물길에만 잔잔한 윤슬과 유빙을 띄워 하단 중앙 안내 문구 뒤는 깨끗이 비운다.
  ctx.strokeStyle = s.ripple;
  ctx.lineWidth = 1.35;
  const glints: ReadonlyArray<readonly [number, number, number]> = [
    [g.cx - g.a * 0.84, g.cy - g.b * 0.18, 9],
    [g.cx - g.a * 0.88, g.cy + g.b * 0.28, 11],
    [g.cx + g.a * 0.85, g.cy - g.b * 0.22, 10],
    [g.cx + g.a * 0.87, g.cy + g.b * 0.24, 8],
    [g.cx - g.a * 0.56, g.cy + g.b * 0.8, 11],
    [g.cx + g.a * 0.58, g.cy + g.b * 0.78, 10],
  ];
  glints.forEach(([gx, gy, len], i) => {
    const pulse = Math.sin(t * 1.3 + i * 1.6);
    ctx.globalAlpha = 0.32 + 0.42 * pulse * pulse;
    ctx.beginPath();
    ctx.moveTo(gx - len / 2, gy);
    ctx.quadraticCurveTo(gx, gy - 1.5, gx + len / 2, gy);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  const floeScale = clamp(g.padSide * 0.34, 8, 13);
  const floes: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [g.cx - g.a * 0.64, g.cy + g.b * 0.74, floeScale * 1.1, floeScale * 0.64, 5],
    [g.cx + g.a * 0.66, g.cy + g.b * 0.72, floeScale * 0.92, floeScale * 0.56, 11],
    [g.cx + g.a * 0.88, g.cy + g.b * 0.05, floeScale * 0.78, floeScale * 0.52, 17],
  ];
  floes.forEach(([fx, fy, frx, fry, seed], i) => {
    const bob = reducedMotion ? 0 : Math.sin(now * 0.0015 + i * 2.2) * 1.0;
    const phase = reducedMotion ? 0.38 : (t * 0.42 + i * 0.33) % 1;
    drawFloatingFloe(ctx, fx, fy + bob, frx, fry, Math.max(2.6, floeScale * 0.24), phase, seed, s);
  });

  ctx.restore();

  // 4. 동물과 같은 굵기의 둥근 잉크 해안선.
  ctx.beginPath();
  traceSmooth(ctx, hole);
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
}

/* ────────────────────────── 남극 입체 소품 (동물 그림체 통일) ────────────────────────── */

/**
 * 남극 특유의 탁상형 빙산(윗면이 평평한 눈 대지 + 수직 빙벽).
 * 2.5D 곡면 바닥과 둥근 눈 처마, 상단 광택 호로 캐릭터와 같은 조형 언어를 쓴다.
 */
function drawTabularBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  w: number,
  h: number,
  seed: number,
  s: SceneStyle
): void {
  const hw = w * 0.5;
  const topHalfW = hw * 0.92;
  const baseDrop = Math.max(3, w * 0.13);
  const topDepth = Math.max(4.5, w * 0.22);
  const topY = gy - h;
  const ridgeShift = (hash(seed * 3.1) - 0.5) * w * 0.14;
  const ridgeX = x + ridgeShift;

  groundShadow(ctx, x, gy + baseDrop * 0.35, hw * 1.08, s);

  const traceBody = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - hw, gy - h * 0.06);
    ctx.quadraticCurveTo(x - hw * 1.02, topY + topDepth * 0.5, x - topHalfW, topY + topDepth * 0.15);
    ctx.quadraticCurveTo(x, topY - topDepth * 0.55, x + topHalfW, topY + topDepth * 0.18);
    ctx.quadraticCurveTo(x + hw * 1.02, topY + topDepth * 0.55, x + hw, gy - h * 0.06);
    ctx.quadraticCurveTo(x + ridgeShift * 0.4, gy + baseDrop, x - hw, gy - h * 0.06);
    ctx.closePath();
  };

  strokeOuterRim(ctx, traceBody, s);
  traceBody();
  ctx.fillStyle = s.iceTop;
  ctx.fill();

  ctx.save();
  traceBody();
  ctx.clip();

  // 오른쪽 빙벽 음영면.
  ctx.fillStyle = s.iceSide;
  ctx.beginPath();
  ctx.moveTo(ridgeX, topY - topDepth);
  ctx.lineTo(x + hw + 4, topY - topDepth);
  ctx.lineTo(x + hw + 4, gy + baseDrop + 4);
  ctx.lineTo(ridgeX + w * 0.03, gy + baseDrop + 4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = s.line;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ridgeX, topY + topDepth * 0.55);
  ctx.lineTo(ridgeX + w * 0.02, gy + baseDrop * 0.7);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 윗면 평평한 눈 덮개 + 귀엽게 흘러내린 스캘럽 처마.
  const capBottom = topY + topDepth * 0.85;
  ctx.beginPath();
  ctx.moveTo(x - hw - 3, topY - topDepth);
  ctx.lineTo(x + hw + 3, topY - topDepth);
  ctx.lineTo(x + hw + 2, capBottom);
  ctx.quadraticCurveTo(x + hw * 0.5, capBottom + 2.6, ridgeX, capBottom + 0.6);
  ctx.quadraticCurveTo(x - hw * 0.48, capBottom + 2.8, x - hw - 2, capBottom - 0.4);
  ctx.closePath();
  ctx.fillStyle = s.snow;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - hw - 1, capBottom - 0.4);
  ctx.quadraticCurveTo(x - hw * 0.48, capBottom + 2.8, ridgeX, capBottom + 0.6);
  ctx.quadraticCurveTo(x + hw * 0.5, capBottom + 2.6, x + hw + 1, capBottom);
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.05;
  ctx.stroke();

  // 동물 정수리와 동일한 광택 호.
  ctx.strokeStyle = s.hi;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x - hw * 0.22, topY + topDepth * 0.42, Math.max(3, hw * 0.42), Math.PI * 1.08, Math.PI * 1.52);
  ctx.stroke();

  ctx.restore();

  traceBody();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
}

function drawTabularCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  k: number,
  seed: number,
  s: SceneStyle
): void {
  const flip = seed % 2 === 0 ? 1 : -1;
  drawTabularBlock(ctx, x - flip * 5 * k, gy - 2 * k, 34 * k, 25 * k, seed, s);
  drawTabularBlock(ctx, x + flip * 14 * k, gy + 5 * k, 20 * k, 14 * k, seed + 3, s);
}

/** 반원이 아닌 비대칭 봉우리 + 2.5D 곡면 바닥을 가진 남극 누나탁 바위. */
function drawNunatakRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  w: number,
  h: number,
  seed: number,
  s: SceneStyle
): void {
  const dir = seed % 2 === 0 ? 1 : -1;
  const hw = w * 0.5;
  const baseDrop = Math.max(2.4, w * 0.12);
  const peakX = x - dir * w * 0.12;
  const peakY = gy - h;
  const shoulderX = x + dir * w * 0.24;
  const shoulderY = gy - h * 0.68;

  const pts: Vec2[] = [
    { x: x - hw, y: gy - h * 0.08 },
    { x: x - hw * 0.82, y: dir > 0 ? gy - h * 0.62 : gy - h * 0.44 },
    { x: peakX, y: peakY },
    { x: x + dir * w * 0.06, y: gy - h * 0.76 },
    { x: shoulderX, y: shoulderY },
    { x: x + hw, y: gy - h * 0.1 },
    { x: x + hw * 0.35, y: gy + baseDrop },
    { x: x - hw * 0.35, y: gy + baseDrop },
  ];
  const r = Math.min(4, w * 0.14);
  const trace = (): void => roundedPoly(ctx, pts, r);

  groundShadow(ctx, x, gy + baseDrop * 0.35, hw * 1.08, s);
  strokeOuterRim(ctx, trace, s, 1.5);
  trace();
  ctx.fillStyle = s.rock;
  ctx.fill();

  ctx.save();
  trace();
  ctx.clip();

  ctx.fillStyle = s.rockDeep;
  poly(ctx, [
    { x: peakX, y: peakY },
    { x: x + hw + 4, y: peakY },
    { x: x + hw + 4, y: gy + baseDrop + 4 },
    { x: x + w * 0.04, y: gy + baseDrop + 4 },
  ]);
  ctx.fill();

  // 봉우리 위에 소복이 얹힌 눈 모자.
  const capY = gy - h * 0.58;
  ctx.beginPath();
  ctx.moveTo(x - hw - 2, peakY - 4);
  ctx.lineTo(x + hw + 2, peakY - 4);
  ctx.lineTo(x + hw + 2, capY);
  ctx.quadraticCurveTo(x + w * 0.16, capY + 2.4, x - w * 0.04, capY - 0.5);
  ctx.quadraticCurveTo(x - w * 0.26, capY + 2.2, x - hw - 2, capY - 0.8);
  ctx.closePath();
  ctx.fillStyle = s.snow;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - hw, capY - 0.8);
  ctx.quadraticCurveTo(x - w * 0.26, capY + 2.2, x - w * 0.04, capY - 0.5);
  ctx.quadraticCurveTo(x + w * 0.16, capY + 2.4, x + hw, capY);
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  trace();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawRockPair(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  k: number,
  seed: number,
  s: SceneStyle
): void {
  drawNunatakRock(ctx, x - 5 * k, gy - 1 * k, 25 * k, 17 * k, seed, s);
  drawNunatakRock(ctx, x + 10 * k, gy + 4 * k, 15 * k, 10.5 * k, seed + 1, s);
}

/** 남극 탐험대 A형 설원 텐트. 펭귄 부리 톤과 맞춘 파스텔 옐로로 포근한 포인트를 준다. */
function drawExpeditionTent(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  k: number,
  now: number,
  reducedMotion: boolean,
  s: SceneStyle
): void {
  const w = 42 * k;
  const h = 29 * k;
  const hw = w * 0.5;
  const ridgeFrontX = x - 6 * k;
  const ridgeFrontY = gy - h;
  const ridgeBackX = x + 9 * k;
  const ridgeBackY = gy - h * 0.92;
  const frontLeftX = x - hw;
  const frontLeftY = gy + 1 * k;
  const frontMidX = x + 4 * k;
  const frontMidY = gy + 4.5 * k;
  const backRightX = x + hw;
  const backRightY = gy - 2.5 * k;

  groundShadow(ctx, x, gy + 2 * k, hw * 1.12, s);

  // 양옆 고정 로프와 작은 팩.
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(ridgeFrontX, ridgeFrontY + 3 * k);
  ctx.lineTo(frontLeftX - 6 * k, gy + 1 * k);
  ctx.moveTo(ridgeBackX, ridgeBackY + 3 * k);
  ctx.lineTo(backRightX + 5 * k, gy - 1 * k);
  ctx.stroke();

  const traceTent = (): void => {
    ctx.beginPath();
    ctx.moveTo(frontLeftX, frontLeftY);
    ctx.quadraticCurveTo(x - hw * 0.72, gy - h * 0.56, ridgeFrontX, ridgeFrontY);
    ctx.lineTo(ridgeBackX, ridgeBackY);
    ctx.quadraticCurveTo(x + hw * 0.82, gy - h * 0.5, backRightX, backRightY);
    ctx.quadraticCurveTo(x + hw * 0.56, gy + 2.5 * k, frontMidX, frontMidY);
    ctx.quadraticCurveTo(x - hw * 0.42, gy + 4.2 * k, frontLeftX, frontLeftY);
    ctx.closePath();
  };

  strokeOuterRim(ctx, traceTent, s);
  traceTent();
  ctx.fillStyle = s.tent;
  ctx.fill();

  ctx.save();
  traceTent();
  ctx.clip();

  // 옆면 음영 슬로프.
  ctx.fillStyle = s.tentShade;
  ctx.beginPath();
  ctx.moveTo(ridgeFrontX, ridgeFrontY - 2);
  ctx.lineTo(backRightX + 4, ridgeBackY - 2);
  ctx.lineTo(backRightX + 4, frontMidY + 6);
  ctx.lineTo(frontMidX, frontMidY + 2);
  ctx.quadraticCurveTo(x - 1 * k, gy - h * 0.46, ridgeFrontX, ridgeFrontY);
  ctx.closePath();
  ctx.fill();

  // 마룻대 능선 위에 살짝 얹힌 눈과 광택선.
  ctx.strokeStyle = s.hi;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ridgeFrontX + 1.5 * k, ridgeFrontY + 1.5 * k);
  ctx.lineTo(ridgeBackX - 2 * k, ridgeBackY + 1.5 * k);
  ctx.stroke();

  // 옆면의 작은 둥근 탐험창.
  const winX = x + 9.5 * k;
  const winY = gy - h * 0.44;
  ellipse(ctx, winX, winY, 3.3 * k, 3.1 * k);
  ctx.fillStyle = s.snow;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // 앞면 둥근 삼각 출입구.
  const doorCx = x - 6.2 * k;
  ctx.beginPath();
  ctx.moveTo(doorCx - 5.8 * k, gy + 4 * k);
  ctx.quadraticCurveTo(doorCx - 4.2 * k, gy - h * 0.52, doorCx, gy - h * 0.58);
  ctx.quadraticCurveTo(doorCx + 4.4 * k, gy - h * 0.5, doorCx + 6.2 * k, gy + 4.5 * k);
  ctx.closePath();
  ctx.fillStyle = s.coat;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.35;
  ctx.stroke();

  // 능선 선.
  ctx.beginPath();
  ctx.moveTo(ridgeFrontX, ridgeFrontY);
  ctx.quadraticCurveTo(x - 1 * k, gy - h * 0.46, frontMidX, frontMidY);
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.35;
  ctx.stroke();

  ctx.restore();

  traceTent();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();

  // 꼭대기에 살랑이는 작은 삼각 깃발.
  const wave = reducedMotion ? 0 : Math.sin(now * 0.0042 + x) * 1.1 * k;
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(ridgeFrontX, ridgeFrontY);
  ctx.lineTo(ridgeFrontX, ridgeFrontY - 6.5 * k);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ridgeFrontX, ridgeFrontY - 6.5 * k);
  ctx.quadraticCurveTo(
    ridgeFrontX + 4 * k,
    ridgeFrontY - 6.2 * k - wave * 0.5,
    ridgeFrontX + 7.5 * k,
    ridgeFrontY - 4.2 * k + wave * 0.5
  );
  ctx.lineTo(ridgeFrontX, ridgeFrontY - 2 * k);
  ctx.closePath();
  ctx.fillStyle = s.stripe;
  ctx.fill();
  ctx.lineWidth = 1.15;
  ctx.stroke();
}

/** 설원 루트 표시용 작은 대나무/탐험 깃발. */
function drawRouteFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  k: number,
  color: string,
  now: number,
  reducedMotion: boolean,
  s: SceneStyle
): void {
  const h = 22 * k;
  const top = gy - h;
  const fw = 11.5 * k;
  const fh = 7.5 * k;
  const wave = reducedMotion ? 0 : Math.sin(now * 0.004 + x * 0.05) * 1.3 * k;

  groundShadow(ctx, x, gy + 1, 4.5 * k, s);

  const tracePole = (): void => {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, top);
  };
  strokeOuterRim(ctx, tracePole, s, 1.45);
  tracePole();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.45;
  ctx.stroke();

  const traceBanner = (): void => {
    ctx.beginPath();
    ctx.moveTo(x, top + 0.5);
    ctx.quadraticCurveTo(x + fw * 0.5, top - wave, x + fw, top + fh * 0.38 + wave * 0.5);
    ctx.quadraticCurveTo(x + fw * 0.5, top + fh - wave * 0.6, x, top + fh);
    ctx.closePath();
  };
  strokeOuterRim(ctx, traceBanner, s, 1.25);
  traceBanner();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  ctx.fillStyle = s.outline;
  ellipse(ctx, x, top - 0.8, 1.5 * k, 1.5 * k);
  ctx.fill();
}

/** 남극점 세리머니 표지봉(사선 줄무늬 기둥 + 크롬 구체 + 양옆 탐험 깃발). */
function drawPoleMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  k: number,
  now: number,
  reducedMotion: boolean,
  s: SceneStyle
): void {
  drawRouteFlag(ctx, x - 15 * k, gy - 4 * k, k * 0.82, s.flagA, now, reducedMotion, s);
  drawRouteFlag(ctx, x + 12 * k, gy - 5 * k, k * 0.82, s.flagB, now + 650, reducedMotion, s);

  groundShadow(ctx, x, gy + 1.5, 9.5 * k, s);
  const pw = 5.8 * k;
  const ph = 31 * k;
  const left = x - pw / 2;
  const top = gy - ph;

  const tracePost = (): void => {
    ctx.beginPath();
    ctx.roundRect(left, top, pw, ph, pw * 0.45);
  };
  strokeOuterRim(ctx, tracePost, s, 1.5);
  ctx.save();
  tracePost();
  ctx.fillStyle = s.pole;
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = s.stripe;
  const band = 6.6 * k;
  for (let y = top - band; y < gy; y += band) {
    poly(ctx, [
      { x: left - 1, y: y + band * 0.44 },
      { x: left + pw + 1, y },
      { x: left + pw + 1, y: y + band * 0.48 },
      { x: left - 1, y: y + band * 0.92 },
    ]);
    ctx.fill();
  }
  ctx.restore();

  tracePost();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const br = 6.6 * k;
  const by = top - br * 0.72;
  const traceBall = (): void => ellipse(ctx, x, by, br, br);
  strokeOuterRim(ctx, traceBall, s);
  ctx.save();
  traceBall();
  ctx.fillStyle = s.metal;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = s.metalDeep;
  ellipse(ctx, x + br * 0.44, by + br * 0.52, br, br);
  ctx.fill();
  ctx.restore();

  traceBall();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();

  ctx.fillStyle = s.hi;
  ellipse(ctx, x - br * 0.36, by - br * 0.38, br * 0.28, br * 0.2);
  ctx.fill();
}

/** 남극 기지 방향 이정표(눈 얹힌 화살표 표지판 두 개). */
function drawSignpost(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  k: number,
  s: SceneStyle
): void {
  groundShadow(ctx, x, gy + 1.5, 8.5 * k, s);

  const pw = 4.4 * k;
  const ph = 31 * k;
  const tracePost = (): void => {
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, gy - ph, pw, ph, pw * 0.45);
  };
  strokeOuterRim(ctx, tracePost, s, 1.45);
  tracePost();
  ctx.fillStyle = s.rock;
  ctx.fill();
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 1.45;
  ctx.stroke();

  const drawBoard = (cy: number, dir: 1 | -1, fill: string, snowCap: boolean): void => {
    const bw = 13 * k;
    const bh = 3.6 * k;
    const tip = x + dir * (bw + 3.8 * k);
    const tail = x - dir * bw * 0.68;
    const pts: Vec2[] = [
      { x: tail, y: cy - bh },
      { x: x + dir * bw * 0.75, y: cy - bh },
      { x: tip, y: cy },
      { x: x + dir * bw * 0.75, y: cy + bh },
      { x: tail, y: cy + bh },
    ];
    const trace = (): void => roundedPoly(ctx, pts, 1.8 * k);
    strokeOuterRim(ctx, trace, s, 1.35);
    trace();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = 1.35;
    ctx.stroke();

    // 표지판 안쪽의 귀여운 약식 글자 선.
    ctx.strokeStyle = s.line;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x - 4.5 * k, cy);
    ctx.lineTo(x + 1.5 * k, cy);
    ctx.moveTo(x + 3.8 * k, cy);
    ctx.lineTo(x + 6.4 * k, cy);
    ctx.stroke();

    if (snowCap) {
      ctx.beginPath();
      ctx.moveTo(tail + 1 * k, cy - bh);
      ctx.quadraticCurveTo(x, cy - bh - 3.2 * k, x + dir * bw * 0.65, cy - bh);
      ctx.closePath();
      ctx.fillStyle = s.snow;
      ctx.fill();
      ctx.strokeStyle = s.outline;
      ctx.lineWidth = 1.15;
      ctx.stroke();
    }
  };

  drawBoard(gy - 16 * k, 1, s.signB, false);
  drawBoard(gy - 25 * k, -1, s.signA, true);
}

/* ────────────────────────── 배치 & 장애물 연동 ────────────────────────── */

type PropKind = 'tabular' | 'rock' | 'tent' | 'pole' | 'signpost' | 'flag';

interface PropSpot {
  fx: number;
  fy: number;
  kind: PropKind;
  /** k=1 기준 가로·세로 반경(px). DOM UI·물길·가장자리 회피에 사용한다. */
  rx: number;
  ry: number;
  seed: number;
}

/**
 * 상단 좌측 토론 카드(fx<0.34, fy<0.24)와 하단 우측 버튼(fx>0.82, fy>0.88),
 * 화면 모서리 밖 반원 클리핑을 모두 피해 여백에 고르게 배치한다.
 */
const PROPS: ReadonlyArray<PropSpot> = [
  { fx: 0.085, fy: 0.34, kind: 'tabular', rx: 28, ry: 18, seed: 2 },
  { fx: 0.19, fy: 0.48, kind: 'flag', rx: 10, ry: 8, seed: 1 },
  { fx: 0.11, fy: 0.69, kind: 'tent', rx: 28, ry: 18, seed: 3 },
  { fx: 0.21, fy: 0.88, kind: 'rock', rx: 20, ry: 13, seed: 4 },
  { fx: 0.46, fy: 0.91, kind: 'flag', rx: 10, ry: 8, seed: 5 },
  { fx: 0.62, fy: 0.12, kind: 'tabular', rx: 24, ry: 16, seed: 6 },
  { fx: 0.84, fy: 0.2, kind: 'signpost', rx: 18, ry: 14, seed: 7 },
  { fx: 0.92, fy: 0.35, kind: 'rock', rx: 19, ry: 13, seed: 8 },
  { fx: 0.89, fy: 0.55, kind: 'pole', rx: 22, ry: 14, seed: 9 },
  { fx: 0.83, fy: 0.8, kind: 'tabular', rx: 28, ry: 18, seed: 11 },
];

interface ResolvedProp {
  spot: PropSpot;
  x: number;
  y: number;
  k: number;
  obstacle: Rect;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function resolveProps(
  width: number,
  height: number,
  pond: PondGeometry | null,
  domObstacles: Rect[]
): ResolvedProp[] {
  if (width < 460 || height < 340) return [];
  const k = clamp(Math.min(width, height) / 720, 0.82, 1.15);
  const resolved: ResolvedProp[] = [];

  for (const spot of PROPS) {
    const rx = spot.rx * k;
    const ry = spot.ry * k;
    const x = width * spot.fx;
    const y = height * spot.fy;
    if (x - rx < 16 || x + rx > width - 16 || y - ry * 2.1 < 18 || y + ry * 0.6 > height - 16) {
      continue;
    }
    if (insidePond(pond, x, y - ry * 0.3, rx + 14)) continue;

    const visualBox: Rect = {
      left: x - rx,
      top: y - ry * 2,
      right: x + rx,
      bottom: y + ry * 0.5,
    };
    if (domObstacles.some((o) => rectsOverlap(visualBox, o))) continue;

    // 동물 발밑이 소품 바닥을 뚫고 지나가지 않도록 접지부만 좁게 막는다.
    const obstacle: Rect = {
      left: x - rx * 0.82,
      top: y - ry * 0.65,
      right: x + rx * 0.82,
      bottom: y + ry * 0.55 + 8,
    };
    resolved.push({ spot, x, y, k, obstacle });
  }
  return resolved;
}

/** 동물이 해빙 물속이나 소품 한가운데를 밟지 않도록 길찾기 격자에 추가할 장애물 AABB를 계산한다. */
export function collectSceneryObstacles(
  width: number,
  height: number,
  preview: Rect | null,
  domObstacles: Rect[] = []
): Rect[] {
  const pond = getPondGeometry(preview, width, height);
  const obstacles: Rect[] = [];
  if (pond) {
    obstacles.push({
      left: pond.cx - pond.a - 8,
      top: pond.cy - pond.b - 6,
      right: pond.cx + pond.a + 8,
      bottom: pond.cy + pond.b + 14,
    });
  }
  for (const prop of resolveProps(width, height, pond, domObstacles)) {
    obstacles.push(prop.obstacle);
  }
  return obstacles;
}

/** 발자국·동물보다 아래에 깔리는 설원 바닥과 중앙 해빙 웅덩이. */
export function drawSnowGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  palette: Palette,
  preview: Rect | null
): void {
  const s = resolveSceneStyle(palette);
  const pond = getPondGeometry(preview, width, height);
  drawSnowField(ctx, width, height, pond, s);
  if (pond) drawSeaIcePond(ctx, pond, now, reducedMotion, s);
}

/** 동물들과 같은 y 깊이 정렬에 참여하는 남극 소품 드로어블 목록. */
export function getSceneryProps(
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  palette: Palette,
  preview: Rect | null,
  domObstacles: Rect[] = []
): SceneryDrawable[] {
  const s = resolveSceneStyle(palette);
  const pond = getPondGeometry(preview, width, height);
  return resolveProps(width, height, pond, domObstacles).map(({ spot, x, y, k }) => ({
    y,
    draw: (ctx: CanvasRenderingContext2D): void => {
      switch (spot.kind) {
        case 'tabular':
          drawTabularCluster(ctx, x, y, k, spot.seed, s);
          break;
        case 'rock':
          drawRockPair(ctx, x, y, k, spot.seed, s);
          break;
        case 'tent':
          drawExpeditionTent(ctx, x, y, k, now, reducedMotion, s);
          break;
        case 'pole':
          drawPoleMarker(ctx, x, y, k, now, reducedMotion, s);
          break;
        case 'signpost':
          drawSignpost(ctx, x, y, k, s);
          break;
        case 'flag':
          drawRouteFlag(
            ctx,
            x,
            y,
            k,
            spot.seed % 2 === 0 ? s.flagB : s.flagA,
            now,
            reducedMotion,
            s
          );
          break;
      }
    },
  }));
}

/** 단독 배경 렌더가 필요할 때를 위한 통합 헬퍼. */
export function drawSnowScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  palette: Palette,
  preview: Rect | null
): void {
  drawSnowGround(ctx, width, height, now, reducedMotion, palette, preview);
  for (const prop of getSceneryProps(width, height, now, reducedMotion, palette, preview)) {
    prop.draw(ctx);
  }
}
