import type { Palette, Rect } from './types.ts';

const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** 동물 그림체(잉크 선 + 단색 채움)에 맞춘 설원 배경 팔레트. */
interface SceneryStyle {
  dark: boolean;
  line: string;
  faint: string;
  snow: string;
  snowShade: string;
  ice: string;
  iceShade: string;
  water: string;
  waterDeep: string;
  ripple: string;
  tree: string;
  rock: string;
}

function styleOf(palette: Palette): SceneryStyle {
  const dark = palette.snowBg === '#0e1116';
  return dark
    ? {
        dark,
        line: 'rgba(226, 235, 245, 0.38)',
        faint: 'rgba(226, 235, 245, 0.18)',
        snow: '#252f3b',
        snowShade: '#1a222c',
        ice: '#2d3a48',
        iceShade: '#1f2a35',
        water: '#122c3e',
        waterDeep: '#0a1d2b',
        ripple: 'rgba(190, 220, 245, 0.38)',
        tree: '#3a4756',
        rock: '#2f3a46',
      }
    : {
        dark,
        line: 'rgba(15, 23, 42, 0.30)',
        faint: 'rgba(15, 23, 42, 0.14)',
        snow: '#ffffff',
        snowShade: '#e7eef6',
        ice: '#eaf2fa',
        iceShade: '#d7e6f3',
        water: '#bcdcf0',
        waterDeep: '#92c4e4',
        ripple: 'rgba(255, 255, 255, 0.62)',
        tree: '#93a9c0',
        rock: '#b7c5d4',
      };
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

/** 눈 더미. 옅은 윤곽만 주어 flat 화면에 높낮이를 만든다. */
function drawDrift(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  s: SceneryStyle
): void {
  ctx.save();
  ctx.fillStyle = s.snow;
  ctx.strokeStyle = s.faint;
  ctx.lineWidth = 1;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  s: SceneryStyle
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (s.dark) {
    gradient.addColorStop(0, '#0e1116');
    gradient.addColorStop(1, '#151e29');
  } else {
    gradient.addColorStop(0, '#fbfcfe');
    gradient.addColorStop(1, '#e9f1f9');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 모서리와 하단에 쌓인 눈. 미리보기 뒤로 밀려 자연스러운 설원이 된다.
  const unit = Math.min(width, height);
  drawDrift(ctx, width * 0.04, height * 0.97, unit * 0.26, unit * 0.075, s);
  drawDrift(ctx, width * 0.96, height * 0.98, unit * 0.25, unit * 0.07, s);
  drawDrift(ctx, width * 0.03, height * 0.05, unit * 0.2, unit * 0.06, s);
  drawDrift(ctx, width * 0.97, height * 0.03, unit * 0.19, unit * 0.055, s);
}

/**
 * 미리보기창 아래에 자리 잡은 원형 얼음 구멍.
 * 실제 원형을 2.5D 시점에 맞춰 살짝 납작한 타원으로 그린다.
 */
function drawFrozenPond(
  ctx: CanvasRenderingContext2D,
  preview: Rect | null,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  s: SceneryStyle
): void {
  const cx = preview ? (preview.left + preview.right) / 2 : width / 2;
  const cy = preview ? (preview.top + preview.bottom) / 2 : height / 2;
  const halfW = preview ? (preview.right - preview.left) / 2 : width * 0.36;
  const halfH = preview ? (preview.bottom - preview.top) / 2 : height * 0.26;
  const rx = halfW * 1.08;
  const ry = halfH * 1.24;
  if (rx < 24 || ry < 16) return;

  ctx.save();

  // 바깥 얼음판
  ctx.fillStyle = s.ice;
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.3;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();
  ctx.stroke();

  // 얼음 가장자리의 얇은 그림자
  ctx.strokeStyle = s.faint;
  ctx.lineWidth = 3;
  ellipse(ctx, cx, cy, rx * 1.035, ry * 1.05);
  ctx.stroke();

  // 물 웅덩이
  const water = ctx.createLinearGradient(cx, cy - ry * 0.8, cx, cy + ry * 0.8);
  water.addColorStop(0, s.water);
  water.addColorStop(1, s.waterDeep);
  ctx.fillStyle = water;
  ellipse(ctx, cx, cy, rx * 0.87, ry * 0.84);
  ctx.fill();

  // 가장자리를 따라 톱니처럼 깨진 얼음 조각
  ctx.fillStyle = s.iceShade;
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1;
  const shards = 15;
  for (let i = 0; i < shards; i++) {
    const angle = (i / shards) * TAU + 0.17;
    const inner = 0.82 + (i % 3) * 0.014;
    const outer = 0.99 + (i % 2) * 0.018;
    const nextAngle = ((i + 0.62) / shards) * TAU + 0.17;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * rx * inner, cy + Math.sin(angle) * ry * inner);
    ctx.lineTo(cx + Math.cos(angle + 0.05) * rx * outer, cy + Math.sin(angle + 0.05) * ry * outer);
    ctx.lineTo(cx + Math.cos(nextAngle) * rx * outer, cy + Math.sin(nextAngle) * ry * outer);
    ctx.lineTo(cx + Math.cos(nextAngle) * rx * inner, cy + Math.sin(nextAngle) * ry * inner);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 물 위의 잔얼음
  for (const [fx, fy, fr] of [
    [-0.45, -0.24, 0.1],
    [0.42, 0.3, 0.085],
    [0.08, -0.48, 0.07],
  ] as const) {
    ctx.fillStyle = s.ice;
    ctx.strokeStyle = s.faint;
    ellipse(ctx, cx + rx * fx, cy + ry * fy, rx * fr, ry * fr * 0.8);
    ctx.fill();
    ctx.stroke();
  }

  // 찰랑거리는 물결 (움직임을 줄인 설정에서는 고정)
  ctx.strokeStyle = s.ripple;
  ctx.lineWidth = 1.2;
  const t = reducedMotion ? 0 : now * 0.0014;
  for (let i = 0; i < 3; i++) {
    const phase = (t + i * 0.63) % 1;
    const scale = 0.18 + phase * 0.58;
    ctx.globalAlpha = (1 - phase) * 0.7;
    ctx.beginPath();
    ctx.ellipse(
      cx + rx * 0.08,
      cy + ry * 0.1,
      rx * scale,
      ry * scale * 0.82,
      0,
      0,
      TAU
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 눈이 쌓인 소나무. 세 겹 가지 위에 하얀 눈이 얹혀 있다. */
function drawSnowyPine(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  s: SceneryStyle
): void {
  ctx.save();
  ctx.fillStyle = s.snowShade;
  ellipse(ctx, x, groundY + 1, scale * 0.52, scale * 0.18);
  ctx.fill();

  ctx.fillStyle = s.tree;
  ctx.fillRect(x - scale * 0.07, groundY - scale * 0.62, scale * 0.14, scale * 0.62);

  for (let tier = 0; tier < 3; tier++) {
    const width = scale * (0.96 - tier * 0.21);
    const topY = groundY - scale * (0.52 + tier * 0.5);
    const baseY = topY + scale * 0.72;

    ctx.fillStyle = s.tree;
    ctx.strokeStyle = s.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + width / 2, baseY);
    ctx.quadraticCurveTo(x, baseY + scale * 0.1, x - width / 2, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 가지 끝에 얹힌 눈. 아래쪽이 물결처럼 휘어져 나무색이 남는다.
    const capY = topY + (baseY - topY) * 0.58;
    const capHalf = width * 0.3;
    ctx.fillStyle = s.snow;
    ctx.beginPath();
    ctx.moveTo(x, topY + scale * 0.02);
    ctx.quadraticCurveTo(x + capHalf * 0.72, capY - scale * 0.14, x + capHalf, capY);
    ctx.quadraticCurveTo(x + capHalf * 0.72, capY + scale * 0.09, x + capHalf * 0.42, capY - scale * 0.02);
    ctx.quadraticCurveTo(x + capHalf * 0.2, capY + scale * 0.09, x, capY - scale * 0.01);
    ctx.quadraticCurveTo(x - capHalf * 0.2, capY + scale * 0.09, x - capHalf * 0.42, capY - scale * 0.02);
    ctx.quadraticCurveTo(x - capHalf * 0.72, capY + scale * 0.09, x - capHalf, capY);
    ctx.quadraticCurveTo(x - capHalf * 0.72, capY - scale * 0.14, x, topY + scale * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 눈이 쌓인 돌. */
function drawSnowyRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  s: SceneryStyle
): void {
  ctx.save();
  ctx.fillStyle = s.snowShade;
  ellipse(ctx, x, groundY + 1, scale * 0.62, scale * 0.18);
  ctx.fill();

  ctx.fillStyle = s.rock;
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.55, groundY);
  ctx.quadraticCurveTo(x - scale * 0.5, groundY - scale * 0.62, x - scale * 0.1, groundY - scale * 0.66);
  ctx.quadraticCurveTo(x + scale * 0.38, groundY - scale * 0.7, x + scale * 0.56, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = s.snow;
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.52, groundY - scale * 0.14);
  ctx.quadraticCurveTo(x - scale * 0.24, groundY - scale * 0.68, x + scale * 0.05, groundY - scale * 0.66);
  ctx.quadraticCurveTo(x + scale * 0.36, groundY - scale * 0.64, x + scale * 0.5, groundY - scale * 0.2);
  ctx.quadraticCurveTo(x + scale * 0.2, groundY - scale * 0.34, x - scale * 0.16, groundY - scale * 0.3);
  ctx.quadraticCurveTo(x - scale * 0.38, groundY - scale * 0.26, x - scale * 0.52, groundY - scale * 0.14);
  ctx.fill();
  ctx.restore();
}

/** 얼음집(이글루). 반원 돔에 얼음 블록 선과 출입구를 그린다. */
function drawIgloo(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  s: SceneryStyle
): void {
  ctx.save();
  const rx = scale * 0.92;
  const ry = scale * 0.78;

  ctx.fillStyle = s.snowShade;
  ellipse(ctx, x, groundY + 1, rx * 1.1, ry * 0.2);
  ctx.fill();

  ctx.fillStyle = s.ice;
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - rx, groundY);
  ctx.ellipse(x, groundY, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 블록 틈: 돔 안쪽만 클리핑해서 그린다.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - rx, groundY);
  ctx.ellipse(x, groundY, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1.1;
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

  // 지붕에 얹힌 눈
  ctx.fillStyle = s.snow;
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.78, groundY - ry * 0.42);
  ctx.quadraticCurveTo(x - rx * 0.6, groundY - ry * 1.12, x, groundY - ry * 1.14);
  ctx.quadraticCurveTo(x + rx * 0.58, groundY - ry * 1.1, x + rx * 0.8, groundY - ry * 0.4);
  ctx.quadraticCurveTo(x + rx * 0.4, groundY - ry * 0.62, x, groundY - ry * 0.6);
  ctx.quadraticCurveTo(x - rx * 0.44, groundY - ry * 0.62, x - rx * 0.78, groundY - ry * 0.42);
  ctx.fill();

  // 출입구
  const doorW = rx * 0.3;
  const doorH = ry * 0.44;
  ctx.fillStyle = s.dark ? '#0c1118' : '#9fb6ca';
  ctx.beginPath();
  ctx.moveTo(x - doorW, groundY);
  ctx.lineTo(x - doorW, groundY - doorH * 0.5);
  ctx.quadraticCurveTo(x, groundY - doorH * 1.5, x + doorW, groundY - doorH * 0.5);
  ctx.lineTo(x + doorW, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = s.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** 배경 전체: 눈 바닥 → 원형 얼음 웅덩이 → 나무·돌·얼음집. */
export function drawSnowScenery(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  palette: Palette,
  preview: Rect | null
): void {
  const s = styleOf(palette);
  drawGround(ctx, width, height, s);
  drawFrozenPond(ctx, preview, width, height, now, reducedMotion, s);

  const scale = clamp(Math.min(width, height) / 9, 44, 86);
  const trees: ReadonlyArray<readonly [number, number, number]> = [
    [0.045, 0.3, 1],
    [0.955, 0.26, 0.86],
    [0.08, 0.82, 0.94],
    [0.92, 0.86, 0.78],
  ];
  for (const [px, py, factor] of trees) {
    drawSnowyPine(ctx, width * px, height * py, scale * factor, s);
  }

  const rocks: ReadonlyArray<readonly [number, number, number]> = [
    [0.19, 0.41, 0.9],
    [0.82, 0.43, 0.78],
    [0.24, 0.92, 0.72],
    [0.78, 0.95, 0.86],
    [0.5, 0.97, 0.6],
  ];
  for (const [px, py, factor] of rocks) {
    drawSnowyRock(ctx, width * px, height * py, scale * factor, s);
  }

  if (width > 560 && height > 420) {
    drawIgloo(ctx, width * 0.14, height * 0.62, scale * 0.92, s);
    drawIgloo(ctx, width * 0.86, height * 0.6, scale * 0.74, s);
  }
}
