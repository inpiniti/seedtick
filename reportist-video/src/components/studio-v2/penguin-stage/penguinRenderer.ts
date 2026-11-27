import { placeBubble, type BubbleBox } from './bubblePlacement.ts';
import { FOOTPRINT_LIFETIME } from './penguinPhysics.ts';
import { drawSnowGround, getSceneryProps, type SceneryDrawable } from './snowScenery.ts';
import { PERSPECTIVE_Y } from './stageStyle.ts';
import {
  getAgentTheme,
  getSpeciesTheme,
  type AnimalSpecies,
  type SpeciesTheme,
} from './species.ts';
import type {
  Footprint,
  Palette,
  PenguinState,
  Ping,
  Rect,
  SnowParticle,
  StageAgent,
} from './types.ts';

const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
const rgba = (rgb: string, alpha: number): string => `rgba(${rgb}, ${alpha})`;

/** 말풍선 글자·행간·최대 너비. 미리보기에서도 잘 읽히도록 함께 키운다. */
const BUBBLE_BODY_FONT = 13;
const BUBBLE_HEADER_FONT = 11;
const BUBBLE_LINE_HEIGHT = 16;
const BUBBLE_TEXT_MAX_WIDTH = 188;
const BUBBLE_MAX_WIDTH = 235;

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

/** 계속 내리는 눈. 앞뒤 겹을 나눠 깊이감을 준다. */
const PARTICLE_COUNT = 110;

export function createParticles(width: number, height: number): SnowParticle[] {
  const particles: SnowParticle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.1 + Math.random() * 1.9,
      vx: 5 + Math.random() * 10,
      vy: 16 + Math.random() * 22,
      phase: Math.random() * TAU,
      opacity: 0.28 + Math.random() * 0.42,
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
    p.x += (p.vx + Math.sin(p.phase) * 3.5) * dt;
    p.y += p.vy * dt;
    p.phase += dt * 1.1;
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
  agents: StageAgent[];
  footprints: Footprint[];
  particles: SnowParticle[];
  ping: Ping | null;
  palette: Palette;
  reducedMotion: boolean;
  selectedSpecies: AnimalSpecies;
  /** 캔버스 위의 DOM 오버레이 영역. 말풍선을 이 밖에 배치한다. */
  obstacles: Rect[];
  /** 중앙 미리보기창 위치. 원형 얼음 웅덩이를 이 아래에 그린다. */
  previewRect: Rect | null;
}

/** 레이어 순서: 설원 바닥·해빙 → 눈송이(뒤) → 발자국·파동 → 소품+개체(y 정렬) → 말풍선 → 눈송이(앞). */
export function renderScene(ctx: CanvasRenderingContext2D, o: RenderOptions): void {
  ctx.clearRect(0, 0, o.width, o.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawSnowGround(
    ctx,
    o.width,
    o.height,
    o.now,
    o.reducedMotion,
    o.palette,
    o.previewRect
  );
  drawParticles(ctx, o.particles, o.palette, false);
  drawFootprints(ctx, o.footprints, o.palette, o.now);
  if (o.ping) drawPing(ctx, o.ping, o.palette, o.now);

  const dark = o.palette.snowBg === '#0e1116';
  const selected = o.agents.find((agent) => agent.species === o.selectedSpecies);
  if (selected?.physics.target) {
    ctx.fillStyle = rgba(o.palette.inkRgb, 0.35);
    ctx.beginPath();
    ctx.ellipse(
      selected.physics.target.x,
      selected.physics.target.y,
      1.8,
      1.8 * PERSPECTIVE_Y,
      0,
      0,
      TAU
    );
    ctx.fill();
  }

  // 소품과 개체를 접지점 y 오름차순(먼 것부터)으로 함께 그려 2.5D 깊이와 가림 순서를 일치시킨다.
  const drawables: SceneryDrawable[] = getSceneryProps(
    o.width,
    o.height,
    o.now,
    o.reducedMotion,
    o.palette,
    o.previewRect,
    o.obstacles
  );
  for (const agent of o.agents) {
    const isSelected = agent === selected;
    drawables.push({
      y: agent.physics.y,
      draw: (c: CanvasRenderingContext2D): void => {
        if (isSelected) {
          drawSelectionRing(c, agent.physics.x, agent.physics.y, o.now, o.palette, o.reducedMotion);
        }
        drawAgent(
          c,
          agent.physics,
          isSelected
            ? getSpeciesTheme(agent.species, dark)
            : getAgentTheme(agent.species, dark, false),
          agent.species,
          o.now,
          o.reducedMotion
        );
      },
    });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const item of drawables) {
    item.draw(ctx);
  }

  drawBubbles(ctx, o.agents, o.now, o.width, o.height, o.palette, o.obstacles);
  drawParticles(ctx, o.particles, o.palette, true);
}

function paletteFromTheme(t: SpeciesTheme, dark: boolean): Palette {
  return {
    snowBg: dark ? '#0e1116' : '#f8f9fa',
    inkRgb: dark ? '242, 244, 246' : '15, 23, 42',
    outline: t.outline,
    outerRim: t.outerRim,
    coat: t.coat,
    coatHighlight: t.hi,
    faceMask: t.mask,
    belly: t.belly,
    eye: '#141922',
    beakFill: t.nose,
    footFill: t.paw,
    cheek: t.blush,
    shadow: t.shadow,
  };
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  state: PenguinState,
  theme: SpeciesTheme,
  species: AnimalSpecies,
  now: number,
  reducedMotion: boolean
): void {
  const dark = theme.dark;
  if (species === 'penguin') {
    drawPenguin(ctx, state, paletteFromTheme(theme, dark), now, reducedMotion);
  } else if (species === 'owl') {
    drawOwlChibi(ctx, state, theme, now, reducedMotion);
  } else if (species === 'deer') {
    drawDeerChibi(ctx, state, theme, now, reducedMotion);
  } else if (species === 'elephant') {
    drawElephantChibi(ctx, state, theme, now, reducedMotion);
  } else if (species === 'hedgehog') {
    drawHedgehogChibi(ctx, state, theme, now, reducedMotion);
  } else if (species === 'frog') {
    drawFrogChibi(ctx, state, theme, now, reducedMotion);
  } else {
    drawChibiMammal(ctx, state, theme, now, reducedMotion);
  }
}

/** 선택 개체 발밑에 깔리는 2.5D 이중 타원 링. */
function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  now: number,
  palette: Palette,
  reducedMotion: boolean
): void {
  const pulse = reducedMotion ? 0 : Math.sin(now * 0.003) * 1.1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(palette.inkRgb, 0.55);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 12.5, 12.5 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.inkRgb, 0.22);
  ctx.lineWidth = 1;
  ctx.setLineDash([3.2, 3.6]);
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 16 + pulse, (16 + pulse) * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(palette.inkRgb, 0.45);
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 1.6, 1.6 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const bubbleImages = new Map<string, HTMLImageElement>();

function getBubbleImage(url: string): HTMLImageElement | null {
  let image = bubbleImages.get(url);
  if (!image) {
    image = new Image();
    image.src = url;
    bubbleImages.set(url, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

/** 말풍선 텍스트를 줄바꿈만 한다. 끝까지 모두 표시하기 위해 줄 수는 제한하지 않는다. */
function wrapBubbleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    const candidate = current + char;
    const keepTogether = /[?!.,~…!?]/.test(char);
    if (current && !keepTogether && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** 개체 위치에 따라 위/아래/좌/우로 열리는 말풍선. 오버레이·다른 풍선과 겹치지 않게 배치한다. */
function drawBubbles(
  ctx: CanvasRenderingContext2D,
  agents: StageAgent[],
  now: number,
  width: number,
  height: number,
  palette: Palette,
  obstacles: Rect[]
): void {
  const dark = palette.snowBg === '#0e1116';
  const background = dark ? 'rgba(22, 27, 34, 0.94)' : 'rgba(255, 255, 255, 0.95)';
  const foreground = dark ? '#f2f4f6' : '#1b2029';
  const placed: BubbleBox[] = [];

  ctx.save();
  ctx.font = `600 ${BUBBLE_BODY_FONT}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';

  // 최신 발언부터 배치해야 좋은 자리를 차지하고, 오래된 풍선은 그 뒤를 피해 놓인다.
  const speaking = agents
    .flatMap((agent) => (agent.bubble ? [{ agent, bornAt: agent.bubble.bornAt }] : []))
    .sort((a, b) => b.bornAt - a.bornAt);

  for (const { agent } of speaking) {
    const bubble = agent.bubble;
    if (!bubble) continue;
    const age = now - bubble.bornAt;
    if (age < 0 || (!bubble.persistent && age > bubble.durationMs)) continue;
    const progress = age / bubble.durationMs;
    const fadingIn = progress < 0.08;
    const fadingOut = !bubble.persistent && progress > 0.88;
    const appear = fadingIn ? progress / 0.08 : fadingOut ? (1 - progress) / 0.12 : 1;
    const alpha = appear * (bubble.opacity ?? 1);
    if (alpha <= 0) continue;

    const image = bubble.imageUrl ? getBubbleImage(bubble.imageUrl) : null;
    const header = bubble.header ?? '';
    const lines = wrapBubbleText(ctx, bubble.text, BUBBLE_TEXT_MAX_WIDTH);
    const imageHeight = image ? 34 : 0;
    ctx.font = `700 ${BUBBLE_HEADER_FONT}px system-ui, sans-serif`;
    const headerWidth = header ? ctx.measureText(header).width + 16 : 0;
    ctx.font = `600 ${BUBBLE_BODY_FONT}px system-ui, sans-serif`;
    const bubbleWidth = clamp(
      Math.max(52, headerWidth, ...lines.map((line) => ctx.measureText(line).width + 16)),
      52,
      BUBBLE_MAX_WIDTH
    );
    const bubbleHeight =
      (header ? BUBBLE_LINE_HEIGHT : 0) + lines.length * BUBBLE_LINE_HEIGHT + 12 + imageHeight;

    const anchorX = agent.physics.x;
    const anchorY = agent.physics.y;
    const { x, y, w, h, tail } = placeBubble({
      anchorX,
      anchorY,
      width: bubbleWidth,
      height: bubbleHeight,
      canvasWidth: width,
      canvasHeight: height,
      obstacles,
      occupied: placed,
      preferAbove: anchorY > height * 0.5,
    });
    placed.push({ x, y, w, h });

    ctx.globalAlpha = alpha;
    ctx.fillStyle = background;
    ctx.strokeStyle = rgba(palette.inkRgb, 0.55);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // 말하는 개체(머리 위치) 쪽을 가리키는 꼬리. 풍선이 옆으로 이동해도 화자를 가리킨다.
    ctx.beginPath();
    if (tail === 'top' || tail === 'bottom') {
      const tx = clamp(anchorX, x + 8, x + w - 8);
      if (tail === 'bottom') {
        ctx.moveTo(tx - 4, y + h - 1);
        ctx.lineTo(tx, y + h + 6);
        ctx.lineTo(tx + 4, y + h - 1);
      } else {
        ctx.moveTo(tx - 4, y + 1);
        ctx.lineTo(tx, y - 6);
        ctx.lineTo(tx + 4, y + 1);
      }
    } else {
      const ty = clamp(anchorY - 22, y + 8, y + h - 8);
      if (tail === 'left') {
        ctx.moveTo(x + 1, ty - 4);
        ctx.lineTo(x - 6, ty);
        ctx.lineTo(x + 1, ty + 4);
      } else {
        ctx.moveTo(x + w - 1, ty - 4);
        ctx.lineTo(x + w + 6, ty);
        ctx.lineTo(x + w - 1, ty + 4);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    let textY = y + 7;
    if (header) {
      ctx.font = `700 ${BUBBLE_HEADER_FONT}px system-ui, sans-serif`;
      ctx.fillStyle = rgba(palette.inkRgb, 0.62);
      ctx.fillText(header, x + 8, textY);
      textY += BUBBLE_LINE_HEIGHT;
    }
    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 7, textY, w - 14, 30, 5);
      ctx.clip();
      ctx.drawImage(image, x + 7, textY, w - 14, 30);
      ctx.restore();
      textY += 34;
    }
    ctx.font = `600 ${BUBBLE_BODY_FONT}px system-ui, sans-serif`;
    ctx.fillStyle = foreground;
    for (const line of lines) {
      ctx.fillText(line, x + 8, textY);
      textY += BUBBLE_LINE_HEIGHT;
    }
  }
  ctx.restore();
}

/** 앞(큰 눈송이)·뒤(작은 눈송이) 겹을 나눠 그린다. */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: SnowParticle[],
  palette: Palette,
  foreground: boolean
): void {
  const dark = palette.snowBg === '#0e1116';
  for (const p of particles) {
    if ((p.r > 2.1) !== foreground) continue;
    const alpha = p.opacity * (foreground ? 0.62 : 0.78);
    ctx.fillStyle = dark
      ? `rgba(255, 255, 255, ${alpha})`
      : rgba(palette.inkRgb, alpha * 0.55);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    if (p.r > 2.5) {
      ctx.fillStyle = dark ? `rgba(255, 255, 255, ${alpha * 0.7})` : `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.22, p.y - p.r * 0.22, p.r * 0.45, 0, TAU);
      ctx.fill();
    }
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

    // 선택 여부와 무관하게 모든 발자국이 또렷하게 보이도록 천천히 옅어진다.
    const scale = 1 - 0.28 * p * p;
    const fillAlpha = 0.24 * Math.pow(1 - p, 1.4);
    const rimAlpha = 0.44 * Math.pow(1 - p, 1.6);

    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = rgba(palette.inkRgb, fillAlpha);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.0, 2.2 * PERSPECTIVE_Y, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.inkRgb, rimAlpha);
    ctx.lineWidth = 1.2;
    if (p > 0.55) ctx.setLineDash([2.2 * (1 - p) + 0.6, 2.5 * p]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.2, 2.4 * PERSPECTIVE_Y, 0, Math.PI, TAU);
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
/* 펭귄 외 11종 — 설계 명세서 3.3절 코드 1:1 이식                              */
/* -------------------------------------------------------------------------- */

function traceCatHeadWithEars(ctx: CanvasRenderingContext2D, ws: number): void {
  ctx.beginPath();
  ctx.moveTo(-3.4 * ws, -31.8);
  ctx.quadraticCurveTo(0, -32.4, 3.4 * ws, -31.8);
  ctx.bezierCurveTo(5.5 * ws, -35.8, 8.2 * ws, -38.8, 9.4 * ws, -38.2);
  ctx.bezierCurveTo(10.6 * ws, -37.5, 10.6 * ws, -32.6, 9.8 * ws, -28.6);
  ctx.bezierCurveTo(11.6 * ws, -25.4, 11.2 * ws, -20.2, 6.8 * ws, -18.4);
  ctx.quadraticCurveTo(0, -17.2, -6.8 * ws, -18.4);
  ctx.bezierCurveTo(-11.2 * ws, -20.2, -11.6 * ws, -25.4, -9.8 * ws, -28.6);
  ctx.bezierCurveTo(-10.6 * ws, -32.6, -10.6 * ws, -37.5, -9.4 * ws, -38.2);
  ctx.bezierCurveTo(-8.2 * ws, -38.8, -5.5 * ws, -35.8, -3.4 * ws, -31.8);
  ctx.closePath();
}

function traceFoxHeadWithEars(ctx: CanvasRenderingContext2D, ws: number): void {
  ctx.beginPath();
  ctx.moveTo(-3.2 * ws, -31.6);
  ctx.quadraticCurveTo(0, -32.2, 3.2 * ws, -31.6);
  ctx.bezierCurveTo(5.8 * ws, -37.2, 9.6 * ws, -41.2, 11.0 * ws, -40.2);
  ctx.bezierCurveTo(12.2 * ws, -39.2, 11.8 * ws, -32.8, 10.2 * ws, -28.2);
  ctx.bezierCurveTo(12.6 * ws, -25.6, 13.2 * ws, -22.2, 10.6 * ws, -20.6);
  ctx.quadraticCurveTo(5.5 * ws, -17.5, 0, -17.4);
  ctx.quadraticCurveTo(-5.5 * ws, -17.5, -10.6 * ws, -20.6);
  ctx.bezierCurveTo(-13.2 * ws, -22.2, -12.6 * ws, -25.6, -10.2 * ws, -28.2);
  ctx.bezierCurveTo(-11.8 * ws, -32.8, -12.2 * ws, -39.2, -11.0 * ws, -40.2);
  ctx.bezierCurveTo(-9.6 * ws, -41.2, -5.8 * ws, -37.2, -3.2 * ws, -31.6);
  ctx.closePath();
}

function traceMammalTorso(
  ctx: CanvasRenderingContext2D,
  wScale: number,
  hTop: number,
  bWidth: number
): void {
  const bw = bWidth * wScale;
  ctx.beginPath();
  ctx.moveTo(-5.8 * wScale, hTop);
  ctx.lineTo(5.8 * wScale, hTop);
  ctx.bezierCurveTo(8.8 * wScale, hTop + 3.5, bw, hTop + 9.5, bw * 0.92, -3.6);
  ctx.bezierCurveTo(bw * 0.78, -0.8, 4.2 * wScale, -0.5, 0, -0.5);
  ctx.bezierCurveTo(-4.2 * wScale, -0.5, -bw * 0.78, -0.8, -bw * 0.92, -3.6);
  ctx.bezierCurveTo(-bw, hTop + 9.5, -8.8 * wScale, hTop + 3.5, -5.8 * wScale, hTop);
  ctx.closePath();
}

function traceRoundHead(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  cy: number
): void {
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
}

function traceFluffyKoalaEar(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-2.5, -4.5);
  ctx.bezierCurveTo(1.5, -6.5, 6.2, -4.5, 5.4, -0.6);
  ctx.bezierCurveTo(7.0, 1.8, 5.2, 5.4, 1.8, 4.6);
  ctx.bezierCurveTo(0.2, 6.4, -3.5, 5.0, -3.2, 1.5);
  ctx.closePath();
}

function drawMammalArms(
  ctx: CanvasRenderingContext2D,
  t: SpeciesTheme,
  ws: number,
  walkSin: number,
  move: number,
  armFill: string
): void {
  const swing = walkSin * 0.22 * move;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 6.8 * ws, -14.8);
    ctx.scale(s, 1);
    ctx.rotate(0.18 + s * swing);
    ctx.fillStyle = armFill;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(-0.8, -0.6);
    ctx.bezierCurveTo(2.4, 0.8, 2.8, 5.2, 0.8, 6.8);
    ctx.bezierCurveTo(-0.8, 7.6, -2.5, 6.0, -2.0, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.4, 0.2);
    ctx.bezierCurveTo(2.5, 1.4, 2.8, 5.2, 0.8, 6.8);
    ctx.bezierCurveTo(-0.8, 7.6, -2.5, 6.0, -1.9, 2.8);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMammalFeet(
  ctx: CanvasRenderingContext2D,
  t: SpeciesTheme,
  side: number,
  phi: number,
  move: number,
  isHop: boolean
): void {
  for (const s of [-1, 1]) {
    const phase = isHop ? phi : s === 1 ? phi : phi + Math.PI;
    const lift = isHop
      ? Math.max(0, Math.sin(phi)) * 3.2 * move
      : Math.max(0, -Math.cos(phase)) * 2.0 * move;
    const stride = isHop ? Math.cos(phi) * 1.6 * move : Math.sin(phase) * 2.2 * move;
    const fx = s * (t.id === 'rabbit' ? 4.4 : 4.2) + side * 0.8;
    const fy = 0.4 - lift + stride * 0.35;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.fillStyle = t.paw;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, t.id === 'rabbit' ? 3.5 : 2.8, 1.85, s * -0.12, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-0.7, 0.6);
    ctx.lineTo(-0.7, 1.5);
    ctx.moveTo(0.8, 0.6);
    ctx.lineTo(0.8, 1.5);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSpeciesTail(
  ctx: CanvasRenderingContext2D,
  t: SpeciesTheme,
  side: number,
  phi: number,
  move: number,
  now: number,
  reducedMotion: boolean
): void {
  const wag = reducedMotion ? 0 : Math.sin(now * 0.008 + phi) * (0.14 + 0.18 * move);
  const tailDir = side >= -0.15 ? -1 : 1;

  ctx.save();
  if (t.id === 'cat') {
    ctx.translate(tailDir * 6.8, -5.5);
    ctx.scale(tailDir, 1);
    ctx.rotate(wag * 0.8);
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(5.5, -1.0, 8.2, -8.5, 4.8, -13.5);
    ctx.quadraticCurveTo(3.0, -16.2, 5.8, -17.4);
    ctx.stroke();
    ctx.strokeStyle = t.coat;
    ctx.lineWidth = 2.1;
    ctx.stroke();
  } else if (t.id === 'dog') {
    ctx.translate(tailDir * 7.2, -6.5);
    ctx.scale(tailDir, 1);
    ctx.rotate(wag * 1.6);
    ctx.fillStyle = t.coat;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.quadraticCurveTo(5.5, -2.5, 6.2, -8.2);
    ctx.quadraticCurveTo(3.2, -9.0, 0.2, -2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (t.id === 'rabbit') {
    ctx.translate(tailDir * 7.6, -4.6);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 3.3, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (t.id === 'fox') {
    ctx.translate(tailDir * 6.5, -5.8);
    ctx.scale(tailDir, 1);
    ctx.rotate(wag * 0.6);
    const foxTailPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(6.5, 0.8, 12.6, -4.2, 11.8, -11.6);
      ctx.bezierCurveTo(11.2, -14.8, 7.6, -15.6, 5.4, -12.6);
      ctx.bezierCurveTo(2.8, -9.2, 1.8, -3.8, 0, 0);
      ctx.closePath();
    };
    foxTailPath();
    ctx.fillStyle = t.coat;
    ctx.fill();
    ctx.save();
    foxTailPath();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(5.2, -9.8);
    ctx.lineTo(7.4, -8.2);
    ctx.lineTo(9.4, -10.2);
    ctx.lineTo(13.2, -9.2);
    ctx.lineTo(13.2, -16.8);
    ctx.lineTo(4.2, -16.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    foxTailPath();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (t.id === 'squirrel') {
    ctx.translate(tailDir * 5.8, -5.2);
    ctx.scale(tailDir, 1);
    ctx.rotate(wag * 0.45);
    ctx.fillStyle = t.coat;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.55;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(10.5, 1.0, 16.8, -7.8, 14.5, -18.5);
    ctx.bezierCurveTo(13.2, -25.2, 6.2, -26.5, 5.0, -21.2);
    ctx.bezierCurveTo(4.4, -18.0, 7.6, -16.2, 7.2, -12.8);
    ctx.bezierCurveTo(6.8, -8.5, 2.5, -3.5, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9.4, -20.0, 2.5, Math.PI * 0.2, Math.PI * 1.45);
    ctx.stroke();
  } else if (t.id === 'raccoon') {
    ctx.translate(tailDir * 6.4, -5.4);
    ctx.scale(tailDir, 1);
    ctx.rotate(wag * 0.55);
    const racPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(8.2, 1.4, 14.4, -3.6, 13.2, -11.6);
      ctx.bezierCurveTo(12.2, -15.8, 7.0, -15.8, 4.8, -11.8);
      ctx.bezierCurveTo(2.6, -8.0, 1.6, -3.5, 0, 0);
      ctx.closePath();
    };
    racPath();
    ctx.fillStyle = t.coat;
    ctx.fill();
    ctx.save();
    racPath();
    ctx.clip();
    ctx.fillStyle = t.accent;
    for (const [rx, ry] of [
      [4.2, -3.0],
      [7.8, -6.8],
      [11.2, -11.2],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(rx, ry, 1.85, 5.8, 0.65, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    racPath();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (t.archetype === 'ursine' && Math.abs(side) > 0.3) {
    ctx.translate(tailDir * 8.2, -5.0);
    ctx.fillStyle = t.id === 'panda' ? '#ffffff' : t.coat;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawOwlChibi(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  t: SpeciesTheme,
  now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = reducedMotion ? 0 : p.moveBlend;
  const bounce = Math.abs(Math.sin(phi)) * move;
  const roll = Math.sin(phi) * 0.09 * move;
  const ws = 1 - 0.08 * side * side;

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = t.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 11.0, 11.0 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.fill();

  for (const s of [-1, 1]) {
    const lift = Math.max(0, -Math.cos(s === 1 ? phi : phi + Math.PI)) * 1.8 * move;
    ctx.save();
    ctx.translate(s * 3.8 + side * 0.6, 0.4 - lift);
    ctx.fillStyle = t.paw;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.3;
    for (const tx of [-1.4, 0, 1.4]) {
      ctx.beginPath();
      ctx.ellipse(tx, 0, 1.0, 1.8, tx * 0.15, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, -bounce * 1.5);
  ctx.rotate(roll);

  const owlPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-4.0 * ws, -31.8);
    ctx.quadraticCurveTo(0, -32.6, 4.0 * ws, -31.8);
    ctx.quadraticCurveTo(8.5 * ws, -35.8, 11.4 * ws, -34.6);
    ctx.quadraticCurveTo(11.6 * ws, -31.2, 9.8 * ws, -28.4);
    ctx.bezierCurveTo(13.4 * ws, -23.0, 13.6 * ws, -10.5, 10.2 * ws, -4.0);
    ctx.bezierCurveTo(7.8 * ws, -0.8, -7.8 * ws, -0.8, -10.2 * ws, -4.0);
    ctx.bezierCurveTo(-13.6 * ws, -10.5, -13.4 * ws, -23.0, -9.8 * ws, -28.4);
    ctx.quadraticCurveTo(-11.6 * ws, -31.2, -11.4 * ws, -34.6);
    ctx.quadraticCurveTo(-8.5 * ws, -35.8, -4.0 * ws, -31.8);
    ctx.closePath();
  };

  if (t.dark) {
    owlPath();
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  owlPath();
  ctx.fillStyle = t.coat;
  ctx.fill();

  if (front > -0.35) {
    const vis = Math.min(1, (front + 0.35) / 0.55);
    const mx = side * 3.8;
    ctx.save();
    owlPath();
    ctx.clip();
    ctx.globalAlpha = vis;

    ctx.fillStyle = t.belly;
    ctx.beginPath();
    ctx.ellipse(mx, -8.5, 8.8, 7.8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(124, 105, 91, 0.45)';
    ctx.lineWidth = 1.15;
    for (const [cx, cy] of [
      [-3.2, -9.5],
      [0, -8.8],
      [3.2, -9.5],
      [-1.8, -5.8],
      [1.8, -5.8],
    ] as const) {
      ctx.beginPath();
      ctx.arc(mx + cx, cy, 1.5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    ctx.fillStyle = t.mask;
    ctx.beginPath();
    ctx.ellipse(mx - 3.8, -22.2, 5.2, 5.0, 0, 0, TAU);
    ctx.ellipse(mx + 3.8, -22.2, 5.2, 5.0, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = t.coat;
    ctx.beginPath();
    ctx.moveTo(mx - 3.2, -28.5);
    ctx.quadraticCurveTo(mx, -23.0, mx + 3.2, -28.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  owlPath();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  if (front > -0.25) {
    const fx = side * 3.8;
    const eyeY = -22.2;
    const blink = now < p.blinkUntil;
    ctx.fillStyle = t.blush;
    ctx.beginPath();
    ctx.ellipse(fx - 5.2, -18.6, 1.7, 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fx + 5.2, -18.6, 1.7, 0.9, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#141922';
    ctx.strokeStyle = '#141922';
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      if (s * side < -0.78) continue;
      const ex = fx + s * 3.8;
      if (blink) {
        ctx.beginPath();
        ctx.arc(ex, eyeY + 0.5, 1.9, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(ex, eyeY, 2.25, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 0.65, eyeY - 0.65, 0.65, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#141922';
      }
    }
    ctx.fillStyle = t.nose;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(fx, -21.8);
    ctx.quadraticCurveTo(fx + 1.9, -20.2, fx, -18.3);
    ctx.quadraticCurveTo(fx - 1.9, -20.2, fx, -21.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const flap = Math.sin(phi) * 0.18 * move;
  for (const s of [-1, 1]) {
    if (Math.abs(side) > 0.45 && s * side > 0) continue;
    ctx.save();
    ctx.translate(s * 9.8 * ws, -18.2);
    ctx.scale(s, 1);
    ctx.rotate(s * flap);
    ctx.fillStyle = t.accent;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(-0.5, 0);
    ctx.bezierCurveTo(3.4, 2.4, 3.8, 8.8, 0.6, 11.4);
    ctx.bezierCurveTo(-1.2, 12.0, -2.6, 9.2, -2.0, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawChibiMammal(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  t: SpeciesTheme,
  now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = reducedMotion ? 0 : p.moveBlend;
  const isHop = t.gait === 'hop';

  const bounce = isHop
    ? Math.max(0, Math.sin(phi)) * 3.4 * move
    : Math.abs(Math.sin(phi)) * 1.5 * move;
  const roll = isHop ? Math.cos(phi) * 0.05 * move : Math.sin(phi) * 0.09 * move;
  const squash = reducedMotion ? 0 : p.squash;
  const sx = 1 + 0.03 * squash;
  const sy = 1 - 0.04 * squash;
  const ws = 1 - 0.1 * side * side;

  const torsoWidth =
    t.archetype === 'ursine'
      ? 10.6
      : t.archetype === 'koala'
        ? 9.6
        : t.archetype === 'rodent'
          ? 8.2
          : t.archetype === 'bunny'
            ? 8.8
            : 9.0;

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = t.shadow;
  ctx.beginPath();
  ctx.ellipse(
    0,
    1.8,
    (torsoWidth + 1.4) * sx,
    (torsoWidth + 1.4) * PERSPECTIVE_Y * sy,
    0,
    0,
    TAU
  );
  ctx.fill();

  drawMammalFeet(ctx, t, side, phi, move, isHop);

  ctx.save();
  ctx.translate(0, -bounce);
  ctx.rotate(roll + side * 0.04 * move);
  ctx.scale(sx, sy);

  drawSpeciesTail(ctx, t, side, phi, move, now, reducedMotion);

  if (t.dark) {
    traceMammalTorso(ctx, ws, -19.2, torsoWidth);
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  traceMammalTorso(ctx, ws, -19.2, torsoWidth);
  ctx.fillStyle = t.coat;
  ctx.fill();

  ctx.save();
  traceMammalTorso(ctx, ws, -19.2, torsoWidth);
  ctx.clip();
  if (t.id === 'panda') {
    ctx.fillStyle = t.accent;
    ctx.fillRect(-14, -19.5, 28, 6.2);
  } else if (front > -0.35) {
    ctx.fillStyle = t.belly;
    ctx.beginPath();
    ctx.ellipse(side * 2.8, -8.0, torsoWidth * 0.62 * ws, 6.2, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  traceMammalTorso(ctx, ws, -19.2, torsoWidth);
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();

  if (t.id === 'polar-bear') {
    ctx.fillStyle = '#e05a5a';
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.roundRect(-7.6 * ws, -19.0, 15.2 * ws, 3.6, 1.8);
    ctx.fill();
    ctx.stroke();
    if (front > -0.2) {
      ctx.beginPath();
      ctx.roundRect(side * 2.2 + 1.2, -17.2, 3.3, 5.4, 1.4);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 등 뒤로 걸어갈 때는 팔이 몸에 가려져 보이지 않는다.
  if (front > -0.35) {
    drawMammalArms(ctx, t, ws, Math.sin(phi), move, t.id === 'panda' ? t.accent : t.coat);
  }

  const headR = t.archetype === 'ursine' ? 10.6 : t.archetype === 'rodent' ? 9.6 : 10.2;
  const headY = -24.8;

  const drawBackEars = (mode: 'stroke' | 'fill'): void => {
    const earBob = isHop ? Math.sin(phi - 0.5) * 0.08 * move : 0;
    for (const s of [-1, 1]) {
      ctx.save();
      if (t.id === 'rabbit') {
        ctx.translate(s * 3.5 * ws, headY - 6.8);
        ctx.rotate(s * (0.11 + earBob));
        ctx.beginPath();
        ctx.moveTo(-2.5, 2.0);
        ctx.bezierCurveTo(-3.6, -4.5, -3.2, -14.2, 0, -15.2);
        ctx.bezierCurveTo(3.2, -14.2, 3.6, -4.5, 2.5, 2.0);
        ctx.closePath();
        if (mode === 'stroke') {
          if (t.dark) {
            ctx.strokeStyle = t.outerRim;
            ctx.lineWidth = 3.2;
            ctx.stroke();
          }
          ctx.strokeStyle = t.outline;
          ctx.lineWidth = 3.3;
          ctx.stroke();
        } else {
          ctx.fillStyle = t.coat;
          ctx.fill();
          ctx.fillStyle = t.innerEar;
          ctx.beginPath();
          ctx.ellipse(0, -6.6, 1.35, 5.8, 0, 0, TAU);
          ctx.fill();
        }
      } else if (t.id === 'koala') {
        ctx.translate(s * 8.6 * ws, headY - 2.0);
        ctx.scale(s, 1);
        traceFluffyKoalaEar(ctx);
        if (mode === 'stroke') {
          if (t.dark) {
            ctx.strokeStyle = t.outerRim;
            ctx.lineWidth = 3.2;
            ctx.stroke();
          }
          ctx.strokeStyle = t.outline;
          ctx.lineWidth = 3.3;
          ctx.stroke();
        } else {
          ctx.fillStyle = t.coat;
          ctx.fill();
          ctx.fillStyle = t.innerEar;
          ctx.beginPath();
          ctx.arc(1.2, 0.2, 2.8, 0, TAU);
          ctx.fill();
        }
      } else if (t.archetype === 'ursine' || t.id === 'raccoon' || t.id === 'squirrel') {
        const ex = s * (t.id === 'squirrel' ? 7.2 : 7.8) * ws;
        const ey = headY - (t.id === 'squirrel' ? 6.8 : 6.4);
        const er = t.id === 'panda' || t.archetype === 'ursine' ? 4.0 : 3.6;
        ctx.translate(ex, ey);
        ctx.beginPath();
        ctx.arc(0, 0, er, 0, TAU);
        if (mode === 'stroke') {
          if (t.dark) {
            ctx.strokeStyle = t.outerRim;
            ctx.lineWidth = 3.2;
            ctx.stroke();
          }
          ctx.strokeStyle = t.outline;
          ctx.lineWidth = 3.3;
          ctx.stroke();
        } else {
          ctx.fillStyle = t.id === 'panda' ? t.accent : t.coat;
          ctx.fill();
          if (t.id !== 'panda') {
            ctx.fillStyle = t.innerEar;
            ctx.beginPath();
            ctx.arc(0, 0.2, er * 0.52, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
  };

  if (t.id === 'cat' || t.id === 'fox') {
    const traceFn = t.id === 'cat' ? traceCatHeadWithEars : traceFoxHeadWithEars;
    if (t.dark) {
      traceFn(ctx, ws);
      ctx.strokeStyle = t.outerRim;
      ctx.lineWidth = 2.8;
      ctx.stroke();
    }
    traceFn(ctx, ws);
    ctx.fillStyle = t.coat;
    ctx.fill();

    ctx.save();
    traceFn(ctx, ws);
    ctx.clip();
    if (front > -0.3) {
      for (const s of [-1, 1]) {
        ctx.fillStyle = t.innerEar;
        ctx.beginPath();
        if (t.id === 'cat') {
          ctx.moveTo(s * 4.8 * ws, -31.2);
          ctx.lineTo(s * 8.6 * ws, -36.0);
          ctx.lineTo(s * 8.8 * ws, -29.8);
        } else {
          ctx.moveTo(s * 5.2 * ws, -31.0);
          ctx.lineTo(s * 9.8 * ws, -38.0);
          ctx.lineTo(s * 9.6 * ws, -29.4);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    if (front > -0.35) {
      const mx = side * 3.8;
      if (t.id === 'fox') {
        ctx.fillStyle = t.mask;
        ctx.beginPath();
        ctx.moveTo(mx, -21.8);
        ctx.bezierCurveTo(mx + 1.8, -26.4, mx + 8.6, -26.2, mx + 12.6, -21.2);
        ctx.lineTo(mx + 12.6, -15.0);
        ctx.lineTo(mx - 12.6, -15.0);
        ctx.lineTo(mx - 12.6, -21.2);
        ctx.bezierCurveTo(mx - 8.6, -26.2, mx - 1.8, -26.4, mx, -21.8);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 1.5;
        for (const tx of [-2.2, 0, 2.2]) {
          ctx.beginPath();
          ctx.moveTo(mx * 0.5 + tx, -32.2);
          ctx.lineTo(mx * 0.5 + tx * 0.85, -29.2);
          ctx.stroke();
        }
        ctx.fillStyle = t.mask;
        ctx.beginPath();
        ctx.ellipse(mx, -20.4, 6.2, 3.8, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    traceFn(ctx, ws);
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.7;
    ctx.stroke();
  } else {
    drawBackEars('stroke');
    if (t.dark) {
      traceRoundHead(ctx, headR * ws, headR * 0.86, headY);
      ctx.strokeStyle = t.outerRim;
      ctx.lineWidth = 3.2;
      ctx.stroke();
    }
    traceRoundHead(ctx, headR * ws, headR * 0.86, headY);
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 3.3;
    ctx.stroke();

    drawBackEars('fill');
    traceRoundHead(ctx, headR * ws, headR * 0.86, headY);
    ctx.fillStyle = t.coat;
    ctx.fill();

    if (front > -0.35) {
      const vis = Math.min(1, (front + 0.35) / 0.55);
      const mx = side * 3.8;
      ctx.save();
      traceRoundHead(ctx, headR * ws, headR * 0.86, headY);
      ctx.clip();
      ctx.globalAlpha = vis;

      if (t.id === 'dog') {
        ctx.fillStyle = t.mask;
        ctx.beginPath();
        ctx.ellipse(mx, headY + 3.4, 7.6, 5.2, 0, 0, TAU);
        ctx.fill();
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(mx + s * 3.2, headY - 3.0, 1.5, 1.0, s * -0.2, 0, TAU);
          ctx.fill();
        }
      } else if (t.id === 'raccoon') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(mx, headY + 0.4, 9.0, 5.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = t.accent;
        ctx.fillRect(mx - 0.9, headY - 8.6, 1.8, 6.2);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(mx + s * 4.2, headY + 1.0, 4.1, 2.8, s * 0.22, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(mx, headY + 4.2, 4.2, 3.0, 0, 0, TAU);
        ctx.fill();
      } else if (t.id === 'squirrel') {
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.ellipse(mx * 0.4, headY - 6.8, 7.5, 3.6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = t.mask;
        ctx.beginPath();
        ctx.ellipse(mx, headY + 3.6, 6.8, 4.4, 0, 0, TAU);
        ctx.fill();
      }

      ctx.strokeStyle = t.hi;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.arc(0, headY, (headR - 1.6) * ws, Math.PI * 1.12, Math.PI * 1.46);
      ctx.stroke();
      ctx.restore();
    }

    if (t.id === 'dog') {
      for (const s of [-1, 1]) {
        if (s * side < -0.82) continue;
        ctx.save();
        ctx.translate(s * 8.4 * ws + side * 0.6, headY - 3.6);
        ctx.scale(s, 1);
        ctx.rotate(0.18 + Math.sin(phi) * 0.08 * move);
        ctx.fillStyle = t.accent;
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-1.8, -1.2);
        ctx.quadraticCurveTo(3.2, -1.4, 4.0, 4.2);
        ctx.quadraticCurveTo(4.2, 8.8, 1.2, 9.2);
        ctx.quadraticCurveTo(-1.8, 9.0, -2.0, 3.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (front > -0.25) {
    const fx = side * 3.8;
    const eyeY = -23.6;
    const blink = now < p.blinkUntil;

    if (t.id === 'panda') {
      ctx.fillStyle = t.accent;
      for (const s of [-1, 1]) {
        if (s * side < -0.78) continue;
        const ex = fx + s * 3.8 * (1 - Math.max(0, -s * side) * 0.4);
        ctx.beginPath();
        ctx.ellipse(ex, eyeY + 0.5, 2.5, 3.2, s * 0.32, 0, TAU);
        ctx.fill();
      }
    }

    ctx.fillStyle = t.blush;
    for (const s of [-1, 1]) {
      if (s * side < -0.72) continue;
      const cx = fx + s * 5.2 * (1 - Math.max(0, s * side) * 0.35);
      ctx.beginPath();
      ctx.ellipse(cx, -20.4, 1.75, 0.95, 0, 0, TAU);
      ctx.fill();
    }

    for (const s of [-1, 1]) {
      if (s * side < -0.78) continue;
      const ex = fx + s * 3.8 * (1 - Math.max(0, -s * side) * 0.42);
      const isDarkPatch = t.id === 'panda' || t.id === 'raccoon';
      ctx.lineWidth = 1.35;
      if (blink) {
        ctx.strokeStyle = isDarkPatch ? '#ffffff' : '#141922';
        ctx.beginPath();
        ctx.moveTo(ex - 1.2, eyeY);
        ctx.lineTo(ex + 1.2, eyeY);
        ctx.stroke();
      } else if (isDarkPatch) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 1.45, 2.0, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#11161d';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY + 0.15, 0.95, 1.35, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#141922';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 1.15, 1.82, 0, 0, TAU);
        ctx.fill();
      }
    }

    const nx = fx + side * 1.1;
    if (t.id === 'koala') {
      ctx.fillStyle = t.nose;
      ctx.strokeStyle = t.outline;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(nx, -21.2, 2.35, 3.1, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(nx - 0.6, -22.4, 0.6, 0, TAU);
      ctx.fill();
    } else if (t.archetype === 'ursine') {
      ctx.fillStyle = t.mask;
      ctx.beginPath();
      ctx.ellipse(nx, -20.6, 3.4, 2.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = t.nose;
      ctx.beginPath();
      ctx.ellipse(nx, -21.5, 1.55, 1.05, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = t.outline;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(nx, -20.5);
      ctx.lineTo(nx, -19.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = t.nose;
      ctx.beginPath();
      ctx.ellipse(nx, -21.5, 1.35, 0.95, 0, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = t.outline;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(nx - 1.5, -19.9);
      ctx.quadraticCurveTo(nx - 0.7, -19.2, nx, -20.3);
      ctx.quadraticCurveTo(nx + 0.7, -19.2, nx + 1.5, -19.9);
      ctx.stroke();

      if (t.id === 'cat') {
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = 1.0;
        for (const s of [-1, 1]) {
          if (s * side < -0.65) continue;
          const wx = fx + s * 6.8;
          ctx.beginPath();
          ctx.moveTo(wx, -21.6);
          ctx.lineTo(wx + s * 3.0, -22.2);
          ctx.moveTo(wx, -20.0);
          ctx.lineTo(wx + s * 3.1, -19.8);
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* 신규 4종 — 기존 12종의 그림체 문법(외곽선 1.65, 콩알 눈 1.15×1.82,            */
/* 볼터치 1.75×0.95, 정수리 광택 호, PERSPECTIVE_Y 그림자)을 그대로 유지하며      */
/* 귀·무늬가 아니라 체형 실루엣 자체를 종별로 바꾼다.                            */
/* -------------------------------------------------------------------------- */

/** 신규 종 공통 얼굴: 콩알 눈 · 볼터치 · 작은 코 · ω 입. */
function drawCuteFace(
  ctx: CanvasRenderingContext2D,
  t: SpeciesTheme,
  fx: number,
  eyeY: number,
  side: number
): void {
  ctx.fillStyle = t.blush;
  for (const s of [-1, 1]) {
    if (s * side < -0.72) continue;
    ctx.beginPath();
    ctx.ellipse(fx + s * 5.2, eyeY + 3.2, 1.75, 0.95, 0, 0, TAU);
    ctx.fill();
  }
  for (const s of [-1, 1]) {
    if (s * side < -0.78) continue;
    ctx.beginPath();
    ctx.ellipse(fx + s * 3.8, eyeY, 1.15, 1.82, 0, 0, TAU);
    ctx.fillStyle = '#141922';
    ctx.fill();
  }
  ctx.fillStyle = t.nose;
  ctx.beginPath();
  ctx.ellipse(fx, eyeY + 2.0, 1.3, 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(fx - 1.5, eyeY + 3.6);
  ctx.quadraticCurveTo(fx - 0.7, eyeY + 4.3, fx, eyeY + 3.2);
  ctx.quadraticCurveTo(fx + 0.7, eyeY + 4.3, fx + 1.5, eyeY + 3.6);
  ctx.stroke();
}

/** 사슴 — 긴 목 + 짧게 갈라진 뿔 + 등 점무늬 + 가는 다리. */
function drawDeerChibi(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  t: SpeciesTheme,
  _now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = reducedMotion ? 0 : p.moveBlend;
  const bounce = Math.abs(Math.sin(phi)) * 1.5 * move;
  const roll = Math.sin(phi) * 0.09 * move;
  const ws = 1 - 0.1 * side * side;
  const fx = side * 3.8;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = t.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 9.4, 9.4 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.fill();

  // 가는 다리 — 좌우 반대 위상으로 총총걸음.
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 2.3;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const phase = s === 1 ? phi : phi + Math.PI;
    const lift = Math.max(0, -Math.cos(phase)) * 2 * move;
    ctx.beginPath();
    ctx.moveTo(s * 3.2 * ws, -6 - lift);
    ctx.lineTo(s * 3.6 * ws, -lift);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, -bounce);
  ctx.rotate(roll + side * 0.04 * move);

  // 긴 목은 몸보다 먼저 그려 머리와 자연스럽게 이어진다.
  ctx.beginPath();
  ctx.moveTo(-3.8 * ws, -20);
  ctx.lineTo(3.8 * ws, -20);
  ctx.bezierCurveTo(3.2 * ws, -26, 3.0 * ws, -31, 2.4 * ws, -32.5);
  ctx.lineTo(-2.4 * ws, -32.5);
  ctx.bezierCurveTo(-3.0 * ws, -31, -3.2 * ws, -26, -3.8 * ws, -20);
  ctx.closePath();
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();

  traceMammalTorso(ctx, ws, -20.2, 8);
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();
  if (front > -0.35) {
    ctx.save();
    traceMammalTorso(ctx, ws, -20.2, 8);
    ctx.clip();
    ctx.fillStyle = t.mask;
    for (const d of [[-3.6, -12], [0, -14], [3.6, -12]] as const) {
      ctx.beginPath();
      ctx.arc(d[0] * ws, d[1], 1.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // 등 뒤로 걸어갈 때는 팔이 몸에 가려져 보이지 않는다.
  if (front > -0.35) {
    drawMammalArms(ctx, t, ws, Math.sin(phi), move, t.coat);
  }

  // 작은 잎귀.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 7.4 * ws, -31);
    ctx.rotate(s * 0.5);
    ctx.fillStyle = t.coat;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 정수리에서 mildly 갈라진 짧은 뿔.
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 2.4 * ws, -35);
    ctx.lineTo(s * 3.2 * ws, -40.5);
    ctx.moveTo(s * 3.2 * ws, -39);
    ctx.lineTo(s * 7.0 * ws, -41.8);
    ctx.moveTo(s * 2.8 * ws, -37);
    ctx.lineTo(s * 6.2 * ws, -37.5);
    ctx.stroke();
  }

  if (t.dark) {
    ctx.beginPath();
    ctx.ellipse(0, -31, 8.6 * ws, 7.6, 0, 0, TAU);
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  traceRoundHead(ctx, 8.6 * ws, 7.6, -31);
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();
  if (front > -0.35) {
    ctx.save();
    traceRoundHead(ctx, 8.6 * ws, 7.6, -31);
    ctx.clip();
    ctx.fillStyle = t.belly;
    ctx.beginPath();
    ctx.ellipse(fx, -28.6, 5.2, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = t.hi;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(0, -31, 7.0 * ws, Math.PI * 1.12, Math.PI * 1.46);
    ctx.stroke();
  }
  if (front > -0.25) drawCuteFace(ctx, t, fx, -29.8, side);

  ctx.restore();
  ctx.restore();
}

/** 코끼리 — 머리 폭에 가까운 부채귀 + 아래로 굽는 코 + 작은 상아. */
function drawElephantChibi(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  t: SpeciesTheme,
  _now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = reducedMotion ? 0 : p.moveBlend;
  const bounce = Math.abs(Math.sin(phi)) * 1.5 * move;
  const roll = Math.sin(phi) * 0.09 * move;
  const ws = 1 - 0.1 * side * side;
  const fx = side * 4.0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = t.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 13.4, 13.4 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.fill();

  // 넓적한 발.
  for (const s of [-1, 1]) {
    const phase = s === 1 ? phi : phi + Math.PI;
    const lift = Math.max(0, -Math.cos(phase)) * 1.8 * move;
    ctx.save();
    ctx.translate(s * 5.2 + side * 0.6, 0.4 - lift);
    ctx.fillStyle = t.paw;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.0, 1.7, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, -bounce);
  ctx.rotate(roll + side * 0.04 * move);

  traceMammalTorso(ctx, ws, -18.6, 12);
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();

  // 부채귀는 머리보다 먼저, 몸통 변환 안에서 그려 따로 놀지 않는다.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 11 * ws, -27);
    ctx.scale(s, 1);
    if (t.dark) {
      ctx.beginPath();
      ctx.ellipse(1, -1, 7.5, 9.5, 0, 0, TAU);
      ctx.strokeStyle = t.outerRim;
      ctx.lineWidth = 2.8;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(1, -1, 7.5, 9.5, 0, 0, TAU);
    ctx.fillStyle = t.coat;
    ctx.fill();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.65;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(1, -1, 4.6, 6, 0, 0, TAU);
    ctx.fillStyle = t.innerEar;
    ctx.fill();
    ctx.restore();
  }

  if (t.dark) {
    ctx.beginPath();
    ctx.ellipse(0, -27, 11.2 * ws, 9.6, 0, 0, TAU);
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  traceRoundHead(ctx, 11.2 * ws, 9.6, -27);
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();
  ctx.strokeStyle = t.hi;
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.arc(0, -27, 9.6 * ws, Math.PI * 1.12, Math.PI * 1.46);
  ctx.stroke();

  if (front > -0.25) {
    ctx.fillStyle = t.blush;
    for (const s of [-1, 1]) {
      if (s * side < -0.72) continue;
      ctx.beginPath();
      ctx.ellipse(fx + s * 6, -23.5, 1.75, 0.95, 0, 0, TAU);
      ctx.fill();
    }
    for (const s of [-1, 1]) {
      if (s * side < -0.78) continue;
      ctx.beginPath();
      ctx.ellipse(fx + s * 4.4, -26.2, 1.15, 1.82, 0, 0, TAU);
      ctx.fillStyle = '#141922';
      ctx.fill();
    }

    // 코는 얼굴 앞에서 진행 방향 쪽으로 굽는다. 옆으로 걸을 때도 몸 중앙에
    // 남지 않도록 fx만큼 옮기고 side 방향으로 기울인다.
    // 윗변을 closePath()로 이으면 기울인 코가 얼굴을 가로지르는 선으로 보이므로
    // 열린 경로로 두고 fill()의 암묵적 닫힘만 사용한다.
    const traceTrunk = (): void => {
      ctx.beginPath();
      ctx.moveTo(-2.6, 0);
      ctx.bezierCurveTo(-3.4, 6, -2.6, 12, 0.6, 13.5);
      ctx.bezierCurveTo(3.4, 12.5, 3.2, 7.5, 2.4, 0.2);
    };
    ctx.save();
    ctx.translate(fx, -23);
    ctx.rotate(-side * 0.55);
    if (t.dark) {
      traceTrunk();
      ctx.strokeStyle = t.outerRim;
      ctx.lineWidth = 2.8;
      ctx.stroke();
    }
    traceTrunk();
    ctx.fillStyle = t.coat;
    ctx.fill();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = 0.9;
    for (const y of [5, 8, 11]) {
      ctx.beginPath();
      ctx.moveTo(-1.8, y);
      ctx.lineTo(2, y);
      ctx.stroke();
    }

    // 작은 크림색 상아도 코와 같은 회전 좌표계에서 그린다.
    // 얼굴 좌표(fx)에 그대로 두면 기울인 코 위에 상아 윤곽이 겹쳐 선이 교차한다.
    ctx.fillStyle = t.belly;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 3, 2);
      ctx.quadraticCurveTo(s * 4.2, 5, s * 2.8, 6.5);
      ctx.quadraticCurveTo(s * 2, 4.5, s * 3, 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

/** 고슴도치 — 납작한 몸 + 둥근 가시 능선 + 뾰족 주둥이. */
function drawHedgehogChibi(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  t: SpeciesTheme,
  _now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = reducedMotion ? 0 : p.moveBlend;
  const bounce = Math.abs(Math.sin(phi)) * 1.5 * move;
  const roll = Math.sin(phi) * 0.09 * move;
  const ws = 1 - 0.1 * side * side;
  const fx = side * 3.8;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = t.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 12.4, 12.4 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.fill();

  for (const s of [-1, 1]) {
    const phase = s === 1 ? phi : phi + Math.PI;
    const lift = Math.max(0, -Math.cos(phase)) * 1.8 * move;
    ctx.save();
    ctx.translate(s * 4.2 + side * 0.6, 0.4 - lift);
    ctx.fillStyle = t.paw;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, -bounce);
  ctx.rotate(roll + side * 0.04 * move);

  traceMammalTorso(ctx, ws, -15.5, 12);
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();

  // 등 가시 — 끝이 둥근 낮은 능선을 하나의 폐곡선으로 이어 붙인다.
  const spinePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-12 * ws, -14);
    ctx.bezierCurveTo(-13 * ws, -20, -9 * ws, -25, -4 * ws, -26);
    ctx.bezierCurveTo(0, -28, 6 * ws, -27, 10 * ws, -24);
    ctx.bezierCurveTo(13 * ws, -21, 13 * ws, -16, 12 * ws, -14);
    ctx.lineTo(8 * ws, -12);
    ctx.lineTo(-8 * ws, -12);
    ctx.closePath();
  };
  if (t.dark) {
    spinePath();
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  spinePath();
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  for (let i = -9; i <= 9; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i * ws, -24 + Math.abs(i) * 0.25);
    ctx.lineTo((i + 1) * ws, -20 + Math.abs(i) * 0.2);
    ctx.stroke();
  }

  if (front > -0.35) {
    // 얼굴은 크림색 타원 + 아래로 뾰족해지는 주둥이.
    ctx.beginPath();
    ctx.ellipse(fx, -17.5, 7.4, 6, 0, 0, TAU);
    ctx.fillStyle = t.mask;
    ctx.fill();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx - 2.4, -15);
    ctx.quadraticCurveTo(fx, -11.5, fx + 2.4, -15);
    ctx.quadraticCurveTo(fx, -13.6, fx - 2.4, -15);
    ctx.closePath();
    ctx.fillStyle = t.belly;
    ctx.fill();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#141922';
    for (const s of [-1, 1]) {
      if (s * side < -0.78) continue;
      ctx.beginPath();
      ctx.ellipse(fx + s * 3.4, -18.2, 1.05, 1.7, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = t.blush;
    for (const s of [-1, 1]) {
      if (s * side < -0.72) continue;
      ctx.beginPath();
      ctx.ellipse(fx + s * 5.4, -15.8, 1.6, 0.9, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = t.nose;
    ctx.beginPath();
    ctx.ellipse(fx, -13.6, 1.2, 0.85, 0, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

/** 개구리 — 낮고 넓은 몸 + 머리에 붙은 눈혹 + 둥근 발가락 패드. */
function drawFrogChibi(
  ctx: CanvasRenderingContext2D,
  p: PenguinState,
  t: SpeciesTheme,
  _now: number,
  reducedMotion: boolean
): void {
  const theta = p.heading + p.lookOffset * (1 - p.moveBlend);
  const side = Math.cos(theta);
  const front = Math.sin(theta);
  const phi = p.walkCycle;
  const move = reducedMotion ? 0 : p.moveBlend;
  const hop = t.gait === 'hop';
  const bounce = hop ? Math.max(0, Math.sin(phi)) * 3.2 * move : 0;
  const roll = hop ? Math.cos(phi) * 0.05 * move : 0;
  const ws = 1 - 0.1 * side * side;
  const fx = side * 3.8;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = t.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 1.8, 12.6, 12.6 * PERSPECTIVE_Y, 0, 0, TAU);
  ctx.fill();

  // 양발 동시 깡충 — 발가락은 둥근 패드 3개.
  for (const s of [-1, 1]) {
    const lift = hop ? Math.max(0, Math.sin(phi)) * 3 * move : 0;
    ctx.save();
    ctx.translate(s * 5 + side * 0.6, 0.4 - lift);
    ctx.fillStyle = t.accent;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.3;
    for (const toe of [-2.6, 0, 2.6]) {
      ctx.beginPath();
      ctx.ellipse(toe * ws, 0, 1.5, 1.1, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, -bounce);
  ctx.rotate(roll + side * 0.04 * move);
  if (p.squash > 0 && !reducedMotion) {
    ctx.scale(1 + 0.03 * p.squash, 1 - 0.04 * p.squash);
  }

  // 낮고 넓은 하나의 몸 윤곽.
  const bodyPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-12 * ws, -14);
    ctx.bezierCurveTo(-13 * ws, -6, -8 * ws, -0.8, 0, -0.8);
    ctx.bezierCurveTo(8 * ws, -0.8, 13 * ws, -6, 12 * ws, -14);
    ctx.closePath();
  };
  if (t.dark) {
    bodyPath();
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  bodyPath();
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();
  if (front > -0.35) {
    ctx.beginPath();
    ctx.ellipse(fx, -6.5, 7.4 * ws, 4.6, 0, 0, TAU);
    ctx.fillStyle = t.belly;
    ctx.fill();
  }

  // 낮고 넓은 머리.
  if (t.dark) {
    ctx.beginPath();
    ctx.ellipse(0, -17, 11 * ws, 6.6, 0, 0, TAU);
    ctx.strokeStyle = t.outerRim;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, -17, 11 * ws, 6.6, 0, 0, TAU);
  ctx.fillStyle = t.coat;
  ctx.fill();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = 1.65;
  ctx.stroke();

  // 머리에 붙은 눈혹 — 기존 콩알 눈 크기를 유지하되 흰 테두리로 도드라지게.
  for (const s of [-1, 1]) {
    if (s * side < -0.78) continue;
    const ex = s * 6.2 * ws;
    ctx.beginPath();
    ctx.arc(ex, -21, 3.4, 0, TAU);
    ctx.fillStyle = t.coat;
    ctx.fill();
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, -21, 2.2, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex, -21, 1.2, 0, TAU);
    ctx.fillStyle = '#141922';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 0.4, -21.5, 0.45, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  if (front > -0.25) {
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-5.5 * ws, -14.2);
    ctx.quadraticCurveTo(fx, -11.8, 5.5 * ws, -14.2);
    ctx.stroke();
    ctx.fillStyle = t.blush;
    for (const s of [-1, 1]) {
      if (s * side < -0.72) continue;
      ctx.beginPath();
      ctx.ellipse(fx + s * 7.6, -15.6, 1.75, 0.95, 0, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();
  ctx.restore();
}
