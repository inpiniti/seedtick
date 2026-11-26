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

/** html.dark 토글에 맞춘 두 팔레트만 사용한다. 채도 있는 색은 일절 없다. */
export function resolvePalette(dark: boolean): Palette {
  if (dark) {
    return {
      snowBg: '#0e1116',
      bodyWhite: '#f2f4f6',
      inkPrimary: '#f2f4f6',
      inkTrack: 'rgba(242, 244, 246, 0.25)',
      snowFlake: 'rgba(242, 244, 246, 0.18)',
      coatFill: '#222831',
      bellyFill: '#f2f4f6',
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
    coatFill: '#0f172a',
    bellyFill: '#ffffff',
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

  // 1. 접지 그림자
  const shadowRadius = 8.2 * (1 - bounce * 0.03);
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

  // 2. 왼발·오른발 교차 스윙
  drawFeet(ctx, theta, phi, move, palette);

  // 3. 뒤쪽 날개 (몸통에 반쯤 가려진 채로 먼저 그린다)
  if (Math.abs(side) > 0.25) {
    ctx.save();
    ctx.translate(-side * 7.2, -11);
    ctx.rotate(-side * 0.45);
    ctx.fillStyle = palette.coatFill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 3.2, -4.6, side * 5.4, -1.2);
    ctx.quadraticCurveTo(side * 3.0, 2.2, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 4. 일체형 달걀 실루엣 + clip() 턱시도 면 분할 + 은선 제거
  bodyPath(ctx);
  ctx.fillStyle = palette.coatFill;
  ctx.fill();
  if (front > -0.35) {
    ctx.save();
    ctx.clip();
    const offsetX = side * 4.2 * (1 - Math.max(0, -front));
    ctx.fillStyle = palette.bellyFill;
    ctx.beginPath();
    ctx.ellipse(offsetX, -11.5, 6.6, 11.2, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(offsetX * 0.65, -21.2, 4.5, 4.1, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    bodyPath(ctx);
  }
  ctx.strokeStyle = palette.inkPrimary;
  ctx.lineWidth = 1.8 / ((scaleX + scaleY) / 2);
  ctx.stroke();

  // 5. 부리·눈 (뒷모습에서는 노출하지 않는다)
  if (front > -0.25) {
    drawBeak(ctx, side, palette);
    drawEyes(ctx, s, side, palette, now);
  }

  // 6. 앞쪽 날개
  drawFrontFlipper(ctx, side, phi, move, palette);

  ctx.restore();
}

function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.bezierCurveTo(6.4, -27, 8.7, -19, 8.7, -12);
  ctx.bezierCurveTo(8.7, -5, 5.6, -2, 0, -2);
  ctx.bezierCurveTo(-5.6, -2, -8.7, -5, -8.7, -12);
  ctx.bezierCurveTo(-8.7, -19, -6.4, -27, 0, -27);
  ctx.closePath();
}

function drawFeet(
  ctx: CanvasRenderingContext2D,
  theta: number,
  phi: number,
  move: number,
  palette: Palette
): void {
  const forwardX = Math.cos(theta);
  const forwardY = Math.sin(theta) * PERSPECTIVE_Y;
  const normalX = -Math.sin(theta);
  const normalY = Math.cos(theta) * PERSPECTIVE_Y;

  for (const sign of [1, -1] as const) {
    const arg = sign === 1 ? phi : phi + Math.PI;
    const stride = Math.sin(arg) * 3.8 * move;
    const lift = Math.max(0, -Math.cos(arg)) * 2.2 * move;
    const x = normalX * sign * 3.6 + forwardX * stride;
    const y = normalY * sign * 3.6 + forwardY * stride - lift;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(theta + sign * 0.22);
    ctx.fillStyle = palette.inkPrimary;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 1.9, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawBeak(ctx: CanvasRenderingContext2D, side: number, palette: Palette): void {
  const y = -18.5;
  ctx.fillStyle = palette.inkPrimary;
  ctx.beginPath();
  if (Math.abs(side) < 0.25) {
    ctx.moveTo(-1.8, y - 0.6);
    ctx.lineTo(1.8, y - 0.6);
    ctx.lineTo(0, y + 2.4);
  } else {
    const x = side * 6;
    ctx.moveTo(x, y - 1.5);
    ctx.lineTo(x + side * 3.6, y + 0.1);
    ctx.lineTo(x, y + 1.7);
  }
  ctx.closePath();
  ctx.fill();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  s: PenguinState,
  side: number,
  palette: Palette,
  now: number
): void {
  const eyeY = -20.5;
  const blink = now < s.blinkUntil;
  const positions =
    Math.abs(side) < 0.55 ? [-2.3 + side, 2.3 + side] : [side * 3.4];

  for (const ex of positions) {
    if (blink) {
      ctx.strokeStyle = palette.inkPrimary;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex - 1.3, eyeY);
      ctx.lineTo(ex + 1.3, eyeY);
      ctx.stroke();
    } else {
      ctx.fillStyle = palette.inkPrimary;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 1.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = palette.bellyFill;
      ctx.beginPath();
      ctx.arc(ex - 0.35, eyeY - 0.4, 0.38, 0, TAU);
      ctx.fill();
    }
  }
}

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
    if (frontView) ctx.translate(dir * 7.6, -12);
    else ctx.translate(-side * 1.5, -12);
    ctx.rotate(dir * (0.3 + Math.sin(phi + (dir < 0 ? Math.PI : 0)) * 0.28 * move));
    ctx.strokeStyle = palette.inkPrimary;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -2.2);
    ctx.quadraticCurveTo(dir * 4.4, -1.4, dir * 6.6, 3.2);
    ctx.stroke();
    ctx.restore();
  }
}
