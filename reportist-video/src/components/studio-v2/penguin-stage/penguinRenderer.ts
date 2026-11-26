import { FOOTPRINT_LIFETIME } from './penguinPhysics.ts';
import type {
  Footprint,
  Palette,
  PenguinState,
  Ping,
  SnowParticle,
} from './types.ts';

const TAU = Math.PI * 2;
const PERSPECTIVE_Y = 0.58;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
const rgba = (rgb: string, alpha: number): string => `rgba(${rgb}, ${alpha})`;

/** 다크 토글 + 아기 펭귄 원포인트(노란 부리·발, 볼터치) 팔레트. */
export function resolvePalette(dark: boolean): Palette {
  if (dark) {
    return {
      snowBg: '#0e1116',
      bodyWhite: '#f2f4f6',
      inkPrimary: '#f2f4f6',
      inkTrack: 'rgba(242, 244, 246, 0.25)',
      snowFlake: 'rgba(242, 244, 246, 0.18)',
      coatFill: '#3a414d',
      bellyFill: '#f2f4f6',
      chestFill: '#c9d1da',
      accentFill: '#f6b545',
      accentShade: '#e59a34',
      blushFill: 'rgba(240, 138, 125, 0.42)',
      eyeFill: '#1b2029',
      outlineFill: '#e6ebf1',
      contactShadow: 'rgba(0, 0, 0, 0.38)',
      inkRgb: '242, 244, 246',
    };
  }
  return {
    snowBg: '#f8f9fa',
    bodyWhite: '#ffffff',
    inkPrimary: '#0f172a',
    inkTrack: 'rgba(15, 23, 42, 0.28)',
    snowFlake: 'rgba(15, 23, 42, 0.18)',
    coatFill: '#3d4451',
    bellyFill: '#ffffff',
    chestFill: '#dfe5ec',
    accentFill: '#f6b545',
    accentShade: '#e59a34',
    blushFill: 'rgba(240, 138, 125, 0.5)',
    eyeFill: '#1b2029',
    outlineFill: '#2b313b',
    contactShadow: 'rgba(15, 23, 42, 0.12)',
    inkRgb: '15, 23, 42',
  };
}

const PARTICLE_COUNT = 42;

export function createParticles(width: number, height: number): SnowParticle[] {
  const particles: SnowParticle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.8 + Math.random() * 0.8,
      vx: 3 + Math.random() * 5,
      vy: 8 + Math.random() * 8,
      phase: Math.random() * TAU,
      opacity: 0.12 + Math.random() * 0.12,
    });
  }
  return particles;
}

export function stepParticles(
  particles: SnowParticle[],
  dt: number,
  width: number,
  height: number,
  reducedMotion: boolean
): void {
  if (reducedMotion) return;
  for (const p of particles) {
    p.x += (p.vx + Math.sin(p.phase) * 1.2) * dt;
    p.y += p.vy * dt;
    p.phase += dt * 1.4;
    if (p.y > height + 4) {
      p.y = -4;
      p.x = Math.random() * width;
    }
    if (p.x > width + 4) p.x = -4;
    if (p.x < -6) p.x = width + 4;
  }
}

export interface RenderOptions {
  width: number;
  height: number;
  now: number;
  state: PenguinState;
  footprints: Footprint[];
  particles: SnowParticle[];
  ping: Ping | null;
  palette: Palette;
  reducedMotion: boolean;
}

/** 레이어 순서: 눈송이 → 발자국 → 목표 파동 → 펭귄. */
export function renderScene(ctx: CanvasRenderingContext2D, o: RenderOptions): void {
  ctx.clearRect(0, 0, o.width, o.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawParticles(ctx, o.particles, o.palette);
  drawFootprints(ctx, o.footprints, o.palette, o.now);
  if (o.ping) drawPing(ctx, o.ping, o.palette, o.now);
  if (o.state.target) {
    ctx.fillStyle = rgba(o.palette.inkRgb, 0.35);
    ctx.beginPath();
    ctx.ellipse(
      o.state.target.x,
      o.state.target.y,
      1.8,
      1.8 * PERSPECTIVE_Y,
      0,
      0,
      TAU
    );
    ctx.fill();
  }
  drawPenguin(ctx, o.state, o.palette, o.now, o.reducedMotion);
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: SnowParticle[],
  palette: Palette
): void {
  for (const p of particles) {
    ctx.fillStyle = rgba(palette.inkRgb, p.opacity);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
  }
}

/** 내경 수축 + 음영 완화 + 점선 가장자리 분해의 3단계 눈 덮임. */
function drawFootprints(
  ctx: CanvasRenderingContext2D,
  footprints: Footprint[],
  palette: Palette,
  now: number
): void {
  for (const fp of footprints) {
    const age = now - fp.bornAt;
    const p = clamp(age / FOOTPRINT_LIFETIME, 0, 1);
    if (p >= 1) continue;

    const scale = 1 - 0.42 * p * p;
    const fillAlpha = 0.16 * Math.pow(1 - p, 1.8);
    const rimAlpha = 0.3 * Math.pow(1 - p, 2.2);

    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.angle);
    ctx.scale(scale, scale);

    ctx.fillStyle = rgba(palette.inkRgb, fillAlpha);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 1.9 * PERSPECTIVE_Y, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = rgba(palette.inkRgb, rimAlpha);
    ctx.lineWidth = 1;
    if (p > 0.45) ctx.setLineDash([2.2 * (1 - p) + 0.6, 2.5 * p]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 2.1 * PERSPECTIVE_Y, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPing(
  ctx: CanvasRenderingContext2D,
  ping: Ping,
  palette: Palette,
  now: number
): void {
  const t = (now - ping.bornAt) / 450;
  if (t < 0 || t >= 1) return;
  for (let i = 0; i < 2; i++) {
    const local = clamp(t - i * 0.18, 0, 1);
    if (local <= 0) continue;
    const radius = 2 + local * 14;
    ctx.strokeStyle = rgba(palette.inkRgb, 0.3 * (1 - local) * (i === 0 ? 1 : 0.6));
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(ping.x, ping.y, radius, radius * PERSPECTIVE_Y, 0, 0, TAU);
    ctx.stroke();
  }
}

/**
 * 아기 펭귄 프로시저럴 드로잉.
 * 볼 pivot(0,0) 기준, 뒤→앞 순서(Painter's Algorithm)로 그려 은선이 겹치지 않는다.
 */
function drawPenguin(
  ctx: CanvasRenderingContext2D,
  s: PenguinState,
  palette: Palette,
  now: number,
  reducedMotion: boolean
): void {
  const theta = s.heading + s.lookOffset * (1 - s.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = s.walkCycle;
  const move = s.moveBlend;
  const bounce = reducedMotion ? 0 : Math.abs(Math.sin(phi)) * move;
  const roll = reducedMotion ? 0 : Math.sin(phi) * 0.13 * move;
  const lean = side * 0.06 * move;
  const squash = reducedMotion ? 0 : s.squash;
  const scaleX = 1 + 0.05 * bounce + 0.04 * squash;
  const scaleY = 1 - 0.06 * bounce - 0.05 * squash;
  const faceOffset = side * 3.8 * (1 - Math.max(0, -front));
  const avgScale = (scaleX + scaleY) / 2;

  // 1. 접지 그림자
  const shadowRadius = 9.2 * (1 - bounce * 0.03);
  ctx.fillStyle = palette.contactShadow;
  ctx.beginPath();
  ctx.ellipse(
    s.x,
    s.y + 1,
    shadowRadius * scaleX,
    shadowRadius * PERSPECTIVE_Y * scaleY,
    0,
    0,
    TAU
  );
  ctx.fill();

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(roll + lean);
  ctx.scale(scaleX, scaleY);

  // 2. 노란 물갈퀴 발 (세 발가락, 정면에서도 세로 막대가 되지 않게 각도를 제한)
  drawFeet(ctx, theta, phi, move, palette);

  // 3. 뒤쪽 날개
  if (Math.abs(side) > 0.25) drawBackFlipper(ctx, side, palette);

  // 4. 큰 머리 + 살짝 잘록한 목 + 통통한 배의 일체형 실루엣
  bodyPath(ctx);
  ctx.fillStyle = palette.coatFill;
  ctx.fill();
  if (front > -0.35) {
    ctx.save();
    ctx.clip();

    // 연회색 가슴 + 순백색 둥근 배 (투톤)
    ctx.fillStyle = palette.chestFill;
    ctx.beginPath();
    ctx.ellipse(faceOffset, -9.2, 7.8, 8.0, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.bellyFill;
    ctx.beginPath();
    ctx.ellipse(faceOffset, -6.0, 6.8, 4.6, 0, 0, TAU);
    ctx.fill();

    // M자(하트) 이마 마스크 — 두 혹 사이의 중앙이 살짝 파인다
    faceMaskPath(ctx, faceOffset);
    ctx.fillStyle = palette.bellyFill;
    ctx.fill();

    drawBlush(ctx, side, palette, faceOffset);
    if (front > -0.25) drawEyes(ctx, s, side, palette, now, faceOffset);
    ctx.restore();

    bodyPath(ctx);
  }
  ctx.strokeStyle = palette.outlineFill;
  ctx.lineWidth = 1.3 / avgScale;
  ctx.stroke();

  // 5. 둥글납작한 만두 부리 (실루엣 밖으로 살짝 튀어나온다)
  if (front > -0.25) drawBeak(ctx, side, palette, faceOffset);

  // 6. 몸옆을 감싸는 도톰한 물방울 날개
  drawFrontFlipper(ctx, side, phi, move, palette);

  ctx.restore();
}

/** 정수리 → 볼 → 살짝 잘록한 목 → 통통한 아랫배 → 접지점. */
function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.bezierCurveTo(5.4, -28, 8.5, -25, 8.5, -20.5);
  ctx.bezierCurveTo(8.5, -17.8, 8.0, -15.4, 7.6, -13.6);
  ctx.bezierCurveTo(8.8, -12.2, 10, -10, 10, -7.2);
  ctx.bezierCurveTo(10, -3.6, 7.4, -1.2, 0, -1.2);
  ctx.bezierCurveTo(-7.4, -1.2, -10, -3.6, -10, -7.2);
  ctx.bezierCurveTo(-10, -10, -8.8, -12.2, -7.6, -13.6);
  ctx.bezierCurveTo(-8.0, -15.4, -8.5, -17.8, -8.5, -20.5);
  ctx.bezierCurveTo(-8.5, -25, -5.4, -28, 0, -28);
  ctx.closePath();
}

function faceMaskPath(ctx: CanvasRenderingContext2D, offsetX: number): void {
  ctx.beginPath();
  ctx.moveTo(offsetX - 5.6, -20.8);
  ctx.bezierCurveTo(offsetX - 6.0, -24.0, offsetX - 3.4, -25.2, offsetX, -22.4);
  ctx.bezierCurveTo(offsetX + 3.4, -25.2, offsetX + 6.0, -24.0, offsetX + 5.6, -20.8);
  ctx.bezierCurveTo(offsetX + 5.4, -17.0, offsetX + 4.0, -15.2, offsetX, -15.2);
  ctx.bezierCurveTo(offsetX - 4.0, -15.2, offsetX - 5.4, -17.0, offsetX - 5.6, -20.8);
  ctx.closePath();
}

function drawFeet(
  ctx: CanvasRenderingContext2D,
  theta: number,
  phi: number,
  move: number,
  palette: Palette
): void {
  const side = Math.cos(theta);
  const forwardX = Math.cos(theta);
  const forwardY = Math.sin(theta) * PERSPECTIVE_Y;
  const normalX = -Math.sin(theta);
  const normalY = Math.cos(theta) * PERSPECTIVE_Y;

  for (const sign of [1, -1] as const) {
    const arg = sign === 1 ? phi : phi + Math.PI;
    const stride = Math.sin(arg) * 3.6 * move;
    const lift = Math.max(0, -Math.cos(arg)) * 2.2 * move;
    const x = normalX * sign * 4.2 + forwardX * stride;
    const y = normalY * sign * 4.2 + forwardY * stride - lift;

    ctx.save();
    ctx.translate(x, y);
    // heading 그대로 회전시키면 정면에서 세로 막대가 되므로 ±0.4rad로 제한한다.
    ctx.rotate(side * 0.2 + sign * 0.16);
    ctx.scale(1, 0.78);
    ctx.fillStyle = palette.accentFill;
    ctx.beginPath();
    ctx.ellipse(0, 0.55, 2.6, 1.4, 0, 0, TAU);
    ctx.fill();
    for (const toe of [-1.7, 0, 1.7]) {
      ctx.beginPath();
      ctx.ellipse(toe, -0.7, 0.95, 1.15, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBackFlipper(
  ctx: CanvasRenderingContext2D,
  side: number,
  palette: Palette
): void {
  ctx.save();
  ctx.translate(-side * 7.0, -10.5);
  ctx.rotate(-side * 0.32);
  ctx.fillStyle = palette.coatFill;
  ctx.beginPath();
  ctx.moveTo(0, -2.5);
  ctx.quadraticCurveTo(-side * 3.2, -2.0, -side * 4.2, 3.2);
  ctx.quadraticCurveTo(-side * 1.4, 2.6, 0, 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBlush(
  ctx: CanvasRenderingContext2D,
  side: number,
  palette: Palette,
  offsetX: number
): void {
  ctx.fillStyle = palette.blushFill;
  const directions = Math.abs(side) < 0.55 ? [-1, 1] : [side];
  for (const dir of directions) {
    ctx.beginPath();
    ctx.ellipse(offsetX + dir * 4.7, -17.4, 1.8, 1.0, 0, 0, TAU);
    ctx.fill();
  }
}

/** 넓고 낮게 배치한 세로 타원 콩알 눈 + 짧은 가로선 깜빡임. */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  s: PenguinState,
  side: number,
  palette: Palette,
  now: number,
  offsetX: number
): void {
  const eyeY = -19.8;
  const blink = now < s.blinkUntil;
  const positions =
    Math.abs(side) < 0.55
      ? [offsetX - 3.0, offsetX + 3.0]
      : [offsetX + side * 3.4];

  for (const ex of positions) {
    if (blink) {
      ctx.strokeStyle = palette.eyeFill;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(ex - 1.5, eyeY + 0.3);
      ctx.quadraticCurveTo(ex, eyeY + 1.1, ex + 1.5, eyeY + 0.3);
      ctx.stroke();
    } else {
      ctx.fillStyle = palette.eyeFill;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 1.5, 2.0, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = palette.bellyFill;
      ctx.beginPath();
      ctx.arc(ex - 0.45, eyeY - 0.8, 0.6, 0, TAU);
      ctx.fill();
    }
  }
}

function drawBeak(
  ctx: CanvasRenderingContext2D,
  side: number,
  palette: Palette,
  offsetX: number
): void {
  const y = -16.6;
  const frontView = Math.abs(side) < 0.3;
  ctx.fillStyle = palette.accentFill;
  ctx.beginPath();
  if (frontView) {
    ctx.moveTo(offsetX - 2.4, y - 0.9);
    ctx.quadraticCurveTo(offsetX, y - 2.1, offsetX + 2.4, y - 0.9);
    ctx.quadraticCurveTo(offsetX + 2.1, y + 1.5, offsetX, y + 1.8);
    ctx.quadraticCurveTo(offsetX - 2.1, y + 1.5, offsetX - 2.4, y - 0.9);
  } else {
    const x = offsetX + side * 4.4;
    ctx.moveTo(x - side * 1.2, y - 1.3);
    ctx.quadraticCurveTo(x + side * 2.4, y - 1.0, x + side * 2.2, y + 0.4);
    ctx.quadraticCurveTo(x + side * 0.8, y + 1.7, x - side * 1.2, y + 0.8);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.accentShade;
  ctx.beginPath();
  if (frontView) {
    ctx.ellipse(offsetX, y + 1.0, 1.7, 0.5, 0, 0, TAU);
  } else {
    ctx.ellipse(offsetX + side * 4.8, y + 0.9, 1.3, 0.45, 0, 0, TAU);
  }
  ctx.fill();
}

/** 선이 아니라 면으로 채운 물방울 날개. */
function drawFrontFlipper(
  ctx: CanvasRenderingContext2D,
  side: number,
  phi: number,
  move: number,
  palette: Palette
): void {
  const frontView = Math.abs(side) < 0.25;
  const directions = frontView ? [-1, 1] : [side];
  for (const dir of directions) {
    ctx.save();
    ctx.translate(dir * 7.0, -10.0);
    ctx.rotate(dir * (-0.08 + Math.sin(phi + (dir < 0 ? Math.PI : 0)) * 0.2 * move));
    ctx.fillStyle = palette.coatFill;
    ctx.beginPath();
    ctx.moveTo(0, -2.6);
    ctx.quadraticCurveTo(dir * 3.2, -2.0, dir * 3.6, 2.4);
    ctx.quadraticCurveTo(dir * 1.3, 2.0, 0, 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
