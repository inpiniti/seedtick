import { FOOTPRINT_LIFETIME } from './penguinPhysics.ts';
import { ANIMAL_PROFILES, type AnimalSpecies, type AnimalProfile } from './species.ts';
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

/** 설계 목업의 resolveCutePalette('pastel', dark) 값을 그대로 이식했다. */
export function resolvePalette(dark: boolean): Palette {
  if (dark) {
    return {
      snowBg: '#0e1116',
      inkRgb: '242, 244, 246',
      outline: '#11161d',
      outerRim: 'rgba(242, 244, 246, 0.85)',
      coat: '#384150',
      coatHighlight: 'rgba(255, 255, 255, 0.28)',
      faceMask: '#d9dfe7',
      belly: '#f8fafc',
      eye: '#11161d',
      beakFill: '#f6c453',
      footFill: '#f0b942',
      cheek: 'rgba(244, 138, 158, 0.62)',
      shadow: 'rgba(0, 0, 0, 0.45)',
    };
  }
  return {
    snowBg: '#f8f9fa',
    inkRgb: '15, 23, 42',
    outline: '#181e27',
    outerRim: 'rgba(255, 255, 255, 0.85)',
    coat: '#3d4451',
    coatHighlight: 'rgba(255, 255, 255, 0.55)',
    faceMask: '#e3e7ec',
    belly: '#ffffff',
    eye: '#141922',
    beakFill: '#f7c552',
    footFill: '#f5be45',
    cheek: 'rgba(244, 138, 158, 0.60)',
    shadow: 'rgba(15, 23, 42, 0.11)',
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
  species: AnimalSpecies;
}

/** 레이어 순서: 눈송이 → 발자국 → 목표 파동 → 동물. */
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
    ctx.ellipse(o.state.target.x, o.state.target.y, 1.8, 1.8 * PERSPECTIVE_Y, 0, 0, TAU);
    ctx.fill();
  }
  if (o.species === 'penguin') {
    drawPenguin(ctx, o.state, o.palette, o.now, o.reducedMotion);
  } else {
    drawGenericAnimal(ctx, o.state, o.palette, ANIMAL_PROFILES[o.species], o.now, o.reducedMotion);
  }
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
    ctx.ellipse(0, 0, 3.6, 2.0 * PERSPECTIVE_Y, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.inkRgb, rimAlpha);
    ctx.lineWidth = 1;
    if (p > 0.45) ctx.setLineDash([2.2 * (1 - p) + 0.6, 2.5 * p]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.8, 2.2 * PERSPECTIVE_Y, 0, Math.PI, TAU);
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
    ctx.strokeStyle = rgba(palette.inkRgb, 0.32 * (1 - local) * (i === 0 ? 1 : 0.6));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(ping.x, ping.y, radius, radius * PERSPECTIVE_Y, 0, 0, TAU);
    ctx.stroke();
  }
}

/** 설계 목업의 babyBodyPath — 정수리(-35)부터 접지점(-0.6)까지의 아기 펭귄 실루엣. */
function babyBodyPath(ctx: CanvasRenderingContext2D, ws: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -35.0);
  ctx.bezierCurveTo(6.6 * ws, -35.0, 10.0 * ws, -30.2, 9.7 * ws, -24.0);
  ctx.bezierCurveTo(9.5 * ws, -21.0, 8.1 * ws, -19.5, 8.2 * ws, -18.0);
  ctx.bezierCurveTo(11.4 * ws, -14.2, 12.8 * ws, -9.2, 11.5 * ws, -4.8);
  ctx.bezierCurveTo(10.0 * ws, -1.2, 5.2 * ws, -0.6, 0, -0.6);
  ctx.bezierCurveTo(-5.2 * ws, -0.6, -10.0 * ws, -1.2, -11.5 * ws, -4.8);
  ctx.bezierCurveTo(-12.8 * ws, -9.2, -11.4 * ws, -14.2, -8.2 * ws, -18.0);
  ctx.bezierCurveTo(-8.1 * ws, -19.5, -9.5 * ws, -21.0, -9.7 * ws, -24.0);
  ctx.bezierCurveTo(-10.0 * ws, -30.2, -6.6 * ws, -35.0, 0, -35.0);
  ctx.closePath();
}

/** 세 발가락 물갈퀴 발. */
function drawWebbedFoot(
  ctx: CanvasRenderingContext2D,
  sign: number,
  offsetX: number,
  offsetY: number,
  lift: number,
  stride: number,
  palette: Palette
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY - lift + stride * 0.45);
  ctx.scale(sign, 1);
  ctx.rotate(-0.06 + stride * 0.04);
  ctx.fillStyle = palette.footFill;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(2.2, -2.2);
  ctx.quadraticCurveTo(6.8, -1.2, 9.4, 0.9);
  ctx.quadraticCurveTo(9.8, 2.2, 7.6, 2.1);
  ctx.quadraticCurveTo(6.8, 3.4, 5.0, 2.7);
  ctx.quadraticCurveTo(3.6, 4.0, 2.2, 2.8);
  ctx.quadraticCurveTo(1.2, 0.6, 2.2, -2.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** 몸옆을 감싸는 도톰한 물방울 날개. */
function drawCozyFlipper(
  ctx: CanvasRenderingContext2D,
  sign: number,
  ws: number,
  flapAngle: number,
  palette: Palette
): void {
  ctx.save();
  ctx.translate(sign * 8.2 * ws, -17.8);
  ctx.scale(sign, 1);
  ctx.rotate(flapAngle);
  ctx.fillStyle = palette.coat;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 1.45;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.5);
  ctx.bezierCurveTo(3.2, 2.2, 4.0, 7.2, 1.4, 10.2);
  ctx.bezierCurveTo(-0.4, 11.4, -2.6, 9.6, -2.4, 6.4);
  ctx.bezierCurveTo(-2.3, 3.8, -1.8, 1.6, -0.4, -0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.5, 0.3);
  ctx.bezierCurveTo(3.2, 2.6, 4.0, 7.2, 1.4, 10.2);
  ctx.bezierCurveTo(-0.4, 11.4, -2.6, 9.6, -2.3, 6.2);
  ctx.quadraticCurveTo(-2.1, 3.8, -1.4, 2.0);
  ctx.stroke();
  ctx.restore();
}

/** 목업의 drawCuteBabyPenguin을 그대로 이식. */
function drawPenguin(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  pal: Palette,
  now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = p.moveBlend;

  const bounce = reducedMotion ? 0 : Math.abs(Math.sin(phi)) * move;
  const roll = reducedMotion ? 0 : Math.sin(phi) * 0.11 * move;
  const squash = reducedMotion ? 0 : p.squash;
  const sx = 1 + 0.04 * bounce + 0.04 * squash;
  const sy = 1 - 0.05 * bounce - 0.04 * squash;
  const ws = 1 - 0.11 * side * side;

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = pal.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 11.2 * sx, 11.2 * PERSPECTIVE_Y * sy, 0, 0, TAU);
  ctx.fill();

  const lStride = Math.sin(phi + Math.PI) * 2.6 * move;
  const rStride = Math.sin(phi) * 2.6 * move;
  const lLift = Math.max(0, -Math.cos(phi + Math.PI)) * 2.0 * move;
  const rLift = Math.max(0, -Math.cos(phi)) * 2.0 * move;
  drawWebbedFoot(ctx, -1, side * 0.8, 0.2, lLift, lStride, pal);
  drawWebbedFoot(ctx, 1, side * 0.8, 0.2, rLift, rStride, pal);

  ctx.save();
  ctx.translate(0, -bounce * 1.6);
  ctx.rotate(roll + side * 0.04 * move);
  ctx.scale(sx, sy);

  if (Math.abs(side) > 0.42) {
    const farSign = side > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(farSign * 7.5 * ws, -17.2);
    ctx.scale(farSign, 1);
    ctx.rotate(-0.35 - Math.sin(phi) * 0.22 * move);
    ctx.fillStyle = pal.coat;
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(3.8, 1.4, 4.8, 6.2, 2.2, 8.4);
    ctx.bezierCurveTo(0.6, 9.2, -1.2, 7.2, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (pal.snowBg === '#0e1116') {
    babyBodyPath(ctx, ws);
    ctx.strokeStyle = pal.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  babyBodyPath(ctx, ws);
  ctx.fillStyle = pal.coat;
  ctx.fill();

  if (front > -0.35) {
    const vis = Math.min(1, (front + 0.35) / 0.55);
    const mx = side * 4.5;
    ctx.save();
    babyBodyPath(ctx, ws);
    ctx.clip();
    ctx.globalAlpha = vis;

    ctx.fillStyle = pal.faceMask;
    ctx.beginPath();
    ctx.moveTo(mx, -21.8);
    ctx.bezierCurveTo(mx + 1.6, -28.0, mx + 7.5, -27.8, mx + 7.7, -21.8);
    ctx.bezierCurveTo(mx + 7.8, -19.2, mx + 6.3, -18.0, mx + 6.6, -16.4);
    ctx.bezierCurveTo(mx + 9.8, -12.6, mx + 10.6, -6.4, mx + 8.4, -2.6);
    ctx.bezierCurveTo(mx + 5.6, -0.4, mx - 5.6, -0.4, mx - 8.4, -2.6);
    ctx.bezierCurveTo(mx - 10.6, -6.4, mx - 9.8, -12.6, mx - 6.6, -16.4);
    ctx.bezierCurveTo(mx - 6.3, -18.0, mx - 7.8, -19.2, mx - 7.7, -21.8);
    ctx.bezierCurveTo(mx - 7.5, -27.8, mx - 1.6, -28.0, mx, -21.8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.belly;
    ctx.beginPath();
    ctx.ellipse(mx * 1.04, -8.4, 7.8, 6.7, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = pal.coatHighlight;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(0, -24.5, 8.3 * ws, Math.PI * 1.08, Math.PI * 1.48);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = pal.coat;
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.ellipse(-side * 1.2, -2.0, 2.8, 1.7, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  babyBodyPath(ctx, ws);
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  if (front > -0.25) {
    const fx = side * 4.3;
    const eyeY = -22.7;
    const beakY = -21.2;
    const blink = now < p.blinkUntil;

    ctx.fillStyle = pal.cheek;
    if (side > -0.74) {
      const rx = fx + 3.8 * (1 - Math.max(0, side) * 0.35);
      ctx.beginPath();
      ctx.ellipse(rx, -18.6, 1.75, 0.95, 0, 0, TAU);
      ctx.fill();
    }
    if (side < 0.74) {
      const lx = fx - 3.8 * (1 - Math.max(0, -side) * 0.35);
      ctx.beginPath();
      ctx.ellipse(lx, -18.6, 1.75, 0.95, 0, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = pal.eye;
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 1.35;
    const eyeSpread = 3.75;
    if (side < 0.78) {
      const lx = fx - eyeSpread * (1 - Math.max(0, side) * 0.45);
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(lx - 1.2, eyeY);
        ctx.lineTo(lx + 1.2, eyeY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(lx, eyeY, 1.15, 1.85, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (side > -0.78) {
      const rx = fx + eyeSpread * (1 - Math.max(0, -side) * 0.45);
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(rx - 1.2, eyeY);
        ctx.lineTo(rx + 1.2, eyeY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(rx, eyeY, 1.15, 1.85, 0, 0, TAU);
        ctx.fill();
      }
    }

    const bx = fx + side * 1.4;
    const bw = 2.75 * (1 - 0.16 * Math.abs(side));
    ctx.fillStyle = pal.beakFill;
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx - bw, beakY - 0.3);
    ctx.quadraticCurveTo(bx, beakY - 1.1, bx + bw + side * 0.9, beakY - 0.25);
    ctx.bezierCurveTo(
      bx + bw + side * 1.1,
      beakY + 2.5,
      bx - bw,
      beakY + 2.5,
      bx - bw,
      beakY - 0.3
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const flap = Math.sin(phi) * 0.20 * move;
  if (Math.abs(side) <= 0.42) {
    drawCozyFlipper(ctx, -1, ws, flap, pal);
    drawCozyFlipper(ctx, 1, ws, -flap, pal);
  } else {
    const nearSign = side > 0 ? -1 : 1;
    ctx.save();
    ctx.translate(nearSign * 1.6 * ws, -17.2);
    ctx.scale(-nearSign, 1);
    ctx.rotate(0.12 + flap);
    ctx.fillStyle = pal.coat;
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(-1.2, -0.5);
    ctx.bezierCurveTo(2.8, 1.8, 3.4, 7.2, 0.8, 9.8);
    ctx.bezierCurveTo(-1.2, 10.6, -3.0, 8.2, -2.2, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.2, 0.4);
    ctx.bezierCurveTo(2.8, 2.2, 3.4, 7.2, 0.8, 9.8);
    ctx.bezierCurveTo(-1.2, 10.6, -3.0, 8.2, -2.1, 3.4);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* 펭귄 외 11종 — 같은 그림체(팔레트·M자 마스크·콩알 눈·볼터치·광택 호)를 유지하며
   귀·꼬리·얼굴 무늬만 바꾼다.                                                  */
/* -------------------------------------------------------------------------- */

function babyAnimalBody(ctx: CanvasRenderingContext2D, w: number, top: number): void {
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.bezierCurveTo(6.6 * w, top, 10.0 * w, top + 4.8, 9.7 * w, top + 11);
  ctx.bezierCurveTo(9.5 * w, top + 14, 8.1 * w, top + 15.5, 8.2 * w, top + 17);
  ctx.bezierCurveTo(11.4 * w, top + 20.8, 12.8 * w, top + 25.8, 11.5 * w, top + 30.2);
  ctx.bezierCurveTo(10.0 * w, top + 33.8, 5.2 * w, top + 34.4, 0, top + 34.4);
  ctx.bezierCurveTo(-5.2 * w, top + 34.4, -10.0 * w, top + 33.8, -11.5 * w, top + 30.2);
  ctx.bezierCurveTo(-12.8 * w, top + 25.8, -11.4 * w, top + 20.8, -8.2 * w, top + 17);
  ctx.bezierCurveTo(-8.1 * w, top + 15.5, -9.5 * w, top + 14, -9.7 * w, top + 11);
  ctx.bezierCurveTo(-10.0 * w, top + 4.8, -6.6 * w, top, 0, top);
  ctx.closePath();
}

function drawEars(
  ctx: CanvasRenderingContext2D,
  profile: AnimalProfile,
  coat: string,
  outline: string,
  inner: string,
  w: number,
  top: number
): void {
  if (profile.ear === 'none') return;
  ctx.fillStyle = coat;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  for (const s of [-1, 1]) {
    ctx.save();
    if (profile.ear === 'pointed') {
      ctx.translate(s * 5.6 * w, top + 4);
      ctx.rotate(s * 0.22);
      ctx.beginPath();
      ctx.moveTo(-3.2, 1.6);
      ctx.quadraticCurveTo(-3.6, -8, 0, -10.5);
      ctx.quadraticCurveTo(3.6, -8, 3.2, 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (profile.earInner) {
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.moveTo(-1.7, -0.6);
        ctx.quadraticCurveTo(-1.9, -6, 0, -8);
        ctx.quadraticCurveTo(1.9, -6, 1.7, -0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = coat;
      }
    } else if (profile.ear === 'round') {
      ctx.beginPath();
      ctx.ellipse(s * 7.4 * w, top + 2.5, 4.1 * w, 4.3, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (profile.earInner) {
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.ellipse(s * 7.4 * w, top + 2.5, 2.1 * w, 2.3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = coat;
      }
    } else if (profile.ear === 'long') {
      ctx.translate(s * 4.2 * w, top - 4);
      ctx.rotate(s * 0.12);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.9 * w, 10.5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (profile.earInner) {
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.ellipse(0, -0.5, 1.35 * w, 7.6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = coat;
      }
    } else if (profile.ear === 'floppy') {
      ctx.translate(s * 8.6 * w, top + 13);
      ctx.rotate(s * 0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.4, 7.2, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (profile.ear === 'tuft') {
      ctx.beginPath();
      ctx.moveTo(s * 2, top + 2);
      ctx.lineTo(s * 5.5, top - 7);
      ctx.lineTo(s * 7, top + 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  profile: AnimalProfile,
  coat: string,
  outline: string,
  w: number,
  top: number,
  side: number
): void {
  if (profile.tail === 'none') return;
  ctx.save();
  ctx.translate(-side * 9 * w - 9, top + 27);
  ctx.rotate(-side * 0.5);
  ctx.fillStyle = coat;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-side * 8, -3, -side * 11, -14, -side * 5, -20);
  ctx.bezierCurveTo(-side * 1, -23, side * 4, -18, side * 3, -12);
  ctx.bezierCurveTo(side * 2, -6, side * 2, -2, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (profile.tail === 'ringed') {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(-side * 3, -4 - i * 5, 4.3, 1.5, side * 0.3, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPaw(
  ctx: CanvasRenderingContext2D,
  sign: number,
  offsetX: number,
  lift: number,
  stride: number,
  fill: string,
  outline: string
): void {
  ctx.save();
  ctx.translate(offsetX, 0.6 - lift + stride * 0.4);
  ctx.scale(sign, 1);
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(1.8, 0.9, 3.6, 2.2, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  for (const toe of [3.4, 5.4, 7.4]) {
    ctx.beginPath();
    ctx.ellipse(toe, -0.2, 1.25, 1.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawGenericAnimal(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  pal: Palette,
  profile: AnimalProfile,
  now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = p.moveBlend;
  const bounce = reducedMotion ? 0 : Math.abs(Math.sin(phi)) * move;
  const roll = reducedMotion ? 0 : Math.sin(phi) * 0.11 * move;
  const squash = reducedMotion ? 0 : p.squash;
  const sx = 1 + 0.04 * bounce + 0.04 * squash;
  const sy = 1 - 0.05 * bounce - 0.04 * squash;
  const w = profile.width;
  const top = profile.top;
  const dark = pal.snowBg === '#0e1116';
  const coat = dark ? profile.coatDark : profile.coatLight;
  const maskColor = dark ? profile.maskDark : profile.maskLight;
  const bellyColor = dark ? profile.bellyDark : profile.bellyLight;

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = pal.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 11.2 * w * sx, 11.2 * PERSPECTIVE_Y * sy, 0, 0, TAU);
  ctx.fill();

  drawTail(ctx, profile, coat, pal.outline, w, top, side);
  drawEars(ctx, profile, coat, pal.outline, maskColor, w, top);

  const stride = Math.sin(phi) * 2.6 * move;
  const lift = Math.max(0, -Math.cos(phi)) * 2.0 * move;
  if (profile.foot === 'paw') {
    drawPaw(ctx, -1, side * 0.8 - 1.6, lift, -stride, coat, pal.outline);
    drawPaw(ctx, 1, side * 0.8 + 1.6, -lift + 2 * move, stride, coat, pal.outline);
  } else {
    drawWebbedFoot(ctx, -1, side * 0.8, 0.2, lift, -stride, pal);
    drawWebbedFoot(ctx, 1, side * 0.8, 0.2, -lift, stride, pal);
  }

  ctx.save();
  ctx.translate(0, -bounce * 1.6);
  ctx.rotate(roll + side * 0.04 * move);
  ctx.scale(sx, sy);

  if (dark) {
    babyAnimalBody(ctx, w, top);
    ctx.strokeStyle = pal.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  babyAnimalBody(ctx, w, top);
  ctx.fillStyle = coat;
  ctx.fill();

  if (front > -0.35) {
    const vis = Math.min(1, (front + 0.35) / 0.55);
    const mx = side * 4.5 * w;
    ctx.save();
    babyAnimalBody(ctx, w, top);
    ctx.clip();
    ctx.globalAlpha = vis;

    if (profile.face === 'bandit') {
      ctx.fillStyle = 'rgba(20, 25, 34, 0.82)';
      ctx.beginPath();
      ctx.ellipse(mx, top + 12.3, 8.4 * w, 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = maskColor;
      ctx.beginPath();
      ctx.ellipse(mx, top + 17.2, 6.6 * w, 5.4, 0, 0, TAU);
      ctx.fill();
    } else if (profile.face === 'patch') {
      ctx.fillStyle = maskColor;
      ctx.beginPath();
      ctx.ellipse(mx, top + 15, 8.6 * w, 9.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 25, 34, 0.88)';
      for (const e of [-3.75, 3.75]) {
        ctx.beginPath();
        ctx.ellipse(mx + e, top + 12.3, 2.5, 3.2, 0, 0, TAU);
        ctx.fill();
      }
    } else if (profile.face === 'heart') {
      ctx.fillStyle = maskColor;
      ctx.beginPath();
      ctx.moveTo(mx, top + 13.2);
      ctx.bezierCurveTo(mx + 1.6, top + 7, mx + 7.5, top + 7.2, mx + 7.7, top + 13.2);
      ctx.bezierCurveTo(mx + 7.8, top + 15.8, mx + 6.3, top + 17, mx + 6.6, top + 18.6);
      ctx.bezierCurveTo(mx + 9.8, top + 22.4, mx + 10.6, top + 28.6, mx + 8.4, top + 32.4);
      ctx.bezierCurveTo(mx + 5.6, top + 34.6, mx - 5.6, top + 34.6, mx - 8.4, top + 32.4);
      ctx.bezierCurveTo(mx - 10.6, top + 28.6, mx - 9.8, top + 22.4, mx - 6.6, top + 18.6);
      ctx.bezierCurveTo(mx - 6.3, top + 17, mx - 7.8, top + 15.8, mx - 7.7, top + 13.2);
      ctx.bezierCurveTo(mx - 7.5, top + 7.2, mx - 1.6, top + 7, mx, top + 13.2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = maskColor;
      ctx.beginPath();
      ctx.ellipse(mx, top + 15.5, 7.6 * w, 8.8, 0, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = bellyColor;
    ctx.beginPath();
    ctx.ellipse(mx * 1.04, top + 26.6, 7.8 * w, 6.7, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = pal.coatHighlight;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(0, top + 10.5, 8.3 * w, Math.PI * 1.08, Math.PI * 1.48);
    ctx.stroke();
    ctx.restore();
  }

  babyAnimalBody(ctx, w, top);
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  if (front > -0.25) {
    const fx = side * 4.3;
    const eyeY = top + 12.3;
    const blink = now < p.blinkUntil;
    const spread = 3.75 * profile.eyeScale;

    ctx.fillStyle = pal.cheek;
    for (const s of [-1, 1]) {
      const ex = fx + s * 3.8 * (1 - Math.max(0, s * side) * 0.35);
      ctx.beginPath();
      ctx.ellipse(ex, top + 16.4, 1.75, 0.95, 0, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = pal.eye;
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 1.35;
    for (const s of [-1, 1]) {
      if (s * side < -0.78) continue;
      const ex = fx + s * spread * (1 - Math.max(0, -s * side) * 0.45);
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(ex - 1.2, eyeY);
        ctx.lineTo(ex + 1.2, eyeY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 1.15 * profile.eyeScale, 1.85 * profile.eyeScale, 0, 0, TAU);
        ctx.fill();
      }
    }

    if (profile.nose === 'beak') {
      ctx.fillStyle = pal.beakFill;
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(fx + side * 1.4, top + 13.8, 2.6, 1.7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else {
      if (profile.muzzle) {
        ctx.fillStyle = bellyColor;
        ctx.beginPath();
        ctx.ellipse(fx + side * 1.2, top + 17.6, 3.1, 2.2, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.ellipse(fx + side * 1.8, top + (profile.muzzle ? 16.4 : 15.2), 1.5, 1.15, 0, 0, TAU);
      ctx.fill();
    }
  }

  const flap = Math.sin(phi) * 0.2 * move;
  if (Math.abs(side) <= 0.42) {
    drawCozyFlipper(ctx, -1, w, flap, pal);
    drawCozyFlipper(ctx, 1, w, -flap, pal);
  } else {
    const nearSign = side > 0 ? -1 : 1;
    ctx.save();
    ctx.translate(nearSign * 1.6 * w, top + 17.2);
    ctx.scale(-nearSign, 1);
    ctx.rotate(0.12 + flap);
    ctx.fillStyle = coat;
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(-1.2, -0.5);
    ctx.bezierCurveTo(2.8, 1.8, 3.4, 7.2, 0.8, 9.8);
    ctx.bezierCurveTo(-1.2, 10.6, -3.0, 8.2, -2.2, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.2, 0.4);
    ctx.bezierCurveTo(2.8, 2.2, 3.4, 7.2, 0.8, 9.8);
    ctx.bezierCurveTo(-1.2, 10.6, -3.0, 8.2, -2.1, 3.4);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}
