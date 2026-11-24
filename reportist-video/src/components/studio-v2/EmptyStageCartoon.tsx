// src/components/studio-v2/EmptyStageCartoon.tsx
// 빈 스테이지용 흑백 손그림 카툰 애니메이션.
// 얼음 언덕(빙산·이글루) 위를 걷던 펭귄이 바다로 점프해 헤엄치고 다시 올라온다.
// 외부 이미지 에셋 없이 캔버스 경로만으로 그린다.
import { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const PENGUIN_COUNT = 10;
const W = 1000;
const H = 600;
const HORIZON = H * 0.52;
const ICE_Y = HORIZON - 14;
const WATER_Y = HORIZON + 62;

type PenguinState = 'walk' | 'jump' | 'swim' | 'climb';

interface Penguin {
  x: number;
  y: number;
  state: PenguinState;
  timer: number;
  duration: number;
  fromX: number;
  toX: number;
  dir: number;
  size: number;
  speed: number;
  phase: number;
}

/** 위치 기반 의사 난수 — 스케치 선의 흔들림을 프레임마다 고정한다. */
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const sketchLine = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  wobble = 2
) => {
  const steps = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 16));
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const jx = (hash(seed * 17 + i * 7) - 0.5) * wobble;
    const jy = (hash(seed * 31 + i * 11) - 0.5) * wobble;
    ctx.lineTo(x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy);
  }
  ctx.stroke();
};

const sketchEllipse = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  wobble = 2
) => {
  const steps = 28;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * TAU;
    const jitter = (hash(seed * 23 + i * 5) - 0.5) * wobble;
    ctx.lineTo(
      cx + Math.cos(a) * (rx + jitter),
      cy + Math.sin(a) * (ry + jitter)
    );
  }
  ctx.stroke();
};

const hatch = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  seed: number,
  count = 8
) => {
  ctx.beginPath();
  for (let i = 0; i < count; i += 1) {
    const x = cx - width / 2 + (i / count) * width + hash(seed + i) * 6;
    const y = cy + hash(seed * 7 + i) * height;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 9, y - 11);
  }
  ctx.stroke();
};

const drawIgloo = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(0, 0, 62, Math.PI, TAU);
  ctx.lineTo(62, 0);
  ctx.lineTo(-62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = 1.6;
  for (const radius of [22, 40, 56]) {
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.arc(0, 0, radius, Math.PI, TAU);
    ctx.stroke();
  }
  for (const angle of [-1.05, -0.52, 0, 0.52, 1.05]) {
    const y = -Math.abs(Math.sin(angle));
    sketchLine(
      ctx,
      Math.cos(angle) * 22,
      y * 22,
      Math.cos(angle) * 60,
      y * 60,
      71 + Math.round(angle * 100)
    );
  }

  ctx.lineWidth = 2.4;
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(-19, 0);
  ctx.lineTo(-19, -9);
  ctx.arc(0, -9, 19, Math.PI, TAU);
  ctx.lineTo(19, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawBerg = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.lineTo(-width * 0.22, -height * 0.72);
  ctx.lineTo(width * 0.05, -height);
  ctx.lineTo(width * 0.3, -height * 0.58);
  ctx.lineTo(width / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.3;
  sketchLine(ctx, -width * 0.22, -height * 0.72, -width * 0.05, 0, seed + 3);
  sketchLine(ctx, width * 0.05, -height, width * 0.12, 0, seed + 9);
  ctx.restore();
};

const drawPenguin = (ctx: CanvasRenderingContext2D, p: Penguin, time: number) => {
  const swimming = p.state === 'swim';
  const airborne = p.state === 'jump' || p.state === 'climb';
  const stride = Math.sin(time * 9 + p.phase);
  const scale = p.size / 60;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.dir * scale, scale);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2.4 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (swimming) {
    ctx.strokeStyle = 'rgba(17,17,17,0.45)';
    ctx.lineWidth = 1.6 / scale;
    sketchEllipse(ctx, 0, 20, 40, 9, Math.round(p.phase * 10), 1.2);
  }

  // 날개 — 수영할 때는 노처럼, 걸을 때는 살짝 흔들린다.
  ctx.fillStyle = '#111111';
  ctx.save();
  ctx.translate(-19, -2);
  ctx.rotate(swimming ? -0.9 + stride * 0.5 : -0.25 + stride * 0.18);
  sketchEllipse(ctx, 0, 0, 8, 20, Math.round(p.phase * 13), 0.8);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 19, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(19, -2);
  ctx.rotate(swimming ? 0.9 - stride * 0.5 : 0.25 - stride * 0.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 19, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 몸 — 흰 배와 검은 등.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 34, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 21, 28, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(6, 6, 15, 23, 0.08, 0, TAU);
  ctx.fill();

  // 머리·눈·부리.
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(2, -34, 18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(9, -38, 3.4, 0, TAU);
  ctx.arc(-2, -38, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(17, -33);
  ctx.lineTo(30, -30);
  ctx.lineTo(17, -26);
  ctx.closePath();
  ctx.fill();

  // 발 — 걷고 있을 때만 번갈아 움직인다.
  if (!swimming && !airborne) {
    ctx.fillStyle = '#111111';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 10, 31);
      ctx.rotate(side * stride * 0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
};

const createPenguins = (): Penguin[] =>
  Array.from({ length: PENGUIN_COUNT }, (_, i) => {
    const swimming = i % 3 === 0;
    return {
      x: 90 + Math.random() * (W - 180),
      y: swimming ? WATER_Y + Math.random() * 26 : ICE_Y,
      state: swimming ? 'swim' : 'walk',
      timer: Math.random() * 3,
      duration: 1,
      fromX: 0,
      toX: 0,
      dir: Math.random() < 0.5 ? -1 : 1,
      size: 46 + Math.random() * 16,
      speed: 22 + Math.random() * 26,
      phase: Math.random() * TAU,
    };
  });

export const EmptyStageCartoon = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const penguins = createPenguins();
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let running = false;
    let previous = 0;
    let elapsed = 0;

    const render = (time: number) => {
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#111111';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 얼음 언덕 윤곽.
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, HORIZON + 16);
      for (let x = 0; x <= W; x += 25) {
        ctx.lineTo(x, HORIZON + Math.sin(x * 0.013) * 8 + (hash(x) - 0.5) * 3);
      }
      ctx.stroke();
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 18; i += 1) {
        const x = 30 + i * 56;
        hatch(ctx, x, HORIZON - 34, 30, 30, 100 + i, 4);
      }

      drawIgloo(ctx, 190, ICE_Y - 4);
      drawBerg(ctx, 660, ICE_Y + 2, 150, 96, 11);
      drawBerg(ctx, 870, ICE_Y + 4, 104, 66, 29);

      // 바다 — 손그림 물결이 서서히 흐른다.
      ctx.lineWidth = 1.7;
      for (let row = 0; row < 7; row += 1) {
        const baseY = HORIZON + 40 + row * 38;
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 16) {
          const y =
            baseY +
            Math.sin(x * 0.021 + time * 1.1 + row * 0.7) * 5 +
            Math.sin(x * 0.048 - time * 0.7 + row) * 2;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (const penguin of penguins) drawPenguin(ctx, penguin, time);
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      elapsed += dt;

      for (const p of penguins) {
        p.timer += dt;
        if (p.state === 'walk') {
          p.x += p.speed * p.dir * dt;
          if (p.x < 60 || p.x > W - 60 || p.timer > 4 + (p.phase % 2)) {
            p.state = 'jump';
            p.timer = 0;
            p.duration = 0.85;
            p.fromX = p.x;
            p.toX = 110 + Math.random() * (W - 220);
            p.dir = p.toX >= p.x ? 1 : -1;
          }
        } else if (p.state === 'jump') {
          const t = Math.min(1, p.timer / p.duration);
          p.x = p.fromX + (p.toX - p.fromX) * t;
          p.y = ICE_Y - Math.sin(t * Math.PI) * 92 + (WATER_Y - ICE_Y) * t;
          if (t >= 1) {
            p.state = 'swim';
            p.timer = 0;
            p.y = WATER_Y + Math.random() * 24;
          }
        } else if (p.state === 'swim') {
          p.x += p.speed * 0.55 * p.dir * dt;
          p.y = WATER_Y + 12 + Math.sin(elapsed * 3 + p.phase) * 7;
          if (p.x < 60 || p.x > W - 60) p.dir *= -1;
          if (p.timer > 3 + (p.phase % 3)) {
            p.state = 'climb';
            p.timer = 0;
            p.duration = 0.9;
            p.fromX = p.x;
            p.toX = 100 + Math.random() * (W - 200);
            p.dir = p.toX >= p.x ? 1 : -1;
          }
        } else {
          const t = Math.min(1, p.timer / p.duration);
          p.x = p.fromX + (p.toX - p.fromX) * t;
          p.y = WATER_Y - Math.sin(t * Math.PI) * 92 + (ICE_Y - WATER_Y) * t;
          if (t >= 1) {
            p.state = 'walk';
            p.timer = 0;
            p.y = ICE_Y;
          }
        }
      }

      render(elapsed);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reducedMotion || running) return;
      running = true;
      previous = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      if (reducedMotion || !running) render(elapsed);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div className="sv2-empty-stage-cartoon">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
};
