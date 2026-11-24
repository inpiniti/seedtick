// src/components/studio-v2/EmptyStageAnimation.tsx
// 빈 스테이지에서 재생되는 흑백 라운드 느낌의 펭귄 산책 연출.
// 외부 영상이나 애니메이션 라이브러리 없이 캔버스 한 장으로 그린다.
import { useEffect, useRef } from 'react';
import {
  PENGUIN_LOGO_BOX,
  PENGUIN_LOGO_PATH,
} from '../common/penguinLogoPath.ts';

const PENGUIN_COUNT = 10;
const TAU = Math.PI * 2;
/** 펭귄 반경이 이 값보다 작으면 얼음판 안쪽으로 본다. */
const ICE_THRESHOLD = 0.6;
const CLIMB_SECONDS = 1.2;

interface Penguin {
  angle: number;
  radius: number;
  target: number;
  speed: number;
  phase: number;
  scale: number;
  dwell: number;
  climb: number;
}

const createPenguins = (): Penguin[] =>
  Array.from({ length: PENGUIN_COUNT }, (_, i) => {
    const start = 0.2 + Math.random() * 0.9;
    return {
      angle: (i / PENGUIN_COUNT) * TAU + Math.random() * 0.5,
      radius: start,
      target: 0.25 + Math.random() * 0.8,
      speed: (0.1 + Math.random() * 0.16) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * TAU,
      scale: 0.78 + Math.random() * 0.46,
      dwell: 1.5 + Math.random() * 4,
      climb: 0,
    };
  });

export const EmptyStageAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const penguinPath = new Path2D(PENGUIN_LOGO_PATH);
    const penguins = createPenguins();

    let width = 0;
    let height = 0;
    let raf = 0;
    let lastTime = 0;
    let wavePhase = 0;
    let gateAngle = -0.35;
    let running = false;

    const render = (time: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.42;
      const iceR = maxR * ICE_THRESHOLD;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 바다 — 얇은 물결 선만 반복해 흑백 톤을 유지한다.
      ctx.strokeStyle = '#ededed';
      ctx.lineWidth = 1;
      for (let y = 16; y < height; y += 26) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 8) {
          const waveY = y + Math.sin(x * 0.018 + y * 0.04 + wavePhase) * 3;
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }

      // 얼음 원과 회전하는 게이트 — 라운드 앤 라운드의 순환 동선을 차용한 오리지널 연출.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, iceR, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(17, 17, 17, 0.11)';
      ctx.lineWidth = 1;
      for (const ratio of [0.36, 0.68]) {
        ctx.beginPath();
        ctx.arc(0, 0, iceR * ratio, 0, TAU);
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(gateAngle);
      ctx.fillStyle = '#111111';
      for (let i = 0; i < 3; i += 1) {
        ctx.save();
        ctx.rotate((TAU / 3) * i);
        ctx.fillRect(-1.75, -iceR * 0.92, 3.5, iceR * 0.92);
        ctx.restore();
      }
      ctx.restore();

      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = 'rgba(17, 17, 17, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, iceR * 1.12, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // 아래쪽 펭귄이 위쪽 펭귄을 덮도록 그린다.
      const sorted = [...penguins].sort(
        (a, b) =>
          Math.sin(a.angle) * a.radius - Math.sin(b.angle) * b.radius
      );
      for (const penguin of sorted) {
        const distance = penguin.radius * maxR;
        const x = cx + Math.cos(penguin.angle) * distance;
        const y = cy + Math.sin(penguin.angle) * distance * 0.68;
        const onIce = distance < iceR;
        const size = (onIce ? 28 : 23) * penguin.scale;
        const bob = Math.sin(time * 5.5 + penguin.phase) * (onIce ? 1.6 : 0.7);
        const hop =
          penguin.climb > 0
            ? Math.sin((1 - penguin.climb / CLIMB_SECONDS) * Math.PI) * 7
            : 0;
        const bodyY = y - bob - hop;

        ctx.fillStyle = 'rgba(17, 17, 17, 0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, size * 0.3, size * 0.09, 0, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.translate(x, bodyY);
        if (!onIce) {
          ctx.strokeStyle = 'rgba(17, 17, 17, 0.4)';
          ctx.lineWidth = 1;
          for (const ripple of [1, 1.75]) {
            ctx.beginPath();
            ctx.ellipse(0, size * 0.52, size * 0.5 * ripple, size * 0.16 * ripple, 0, 0, TAU);
            ctx.stroke();
          }
        }

        const flip = Math.cos(penguin.angle) >= 0 ? 1 : -1;
        const scale = size / PENGUIN_LOGO_BOX.height;
        ctx.scale(flip * scale, scale);
        ctx.translate(
          -(PENGUIN_LOGO_BOX.x + PENGUIN_LOGO_BOX.width / 2),
          -(PENGUIN_LOGO_BOX.y + PENGUIN_LOGO_BOX.height)
        );
        ctx.fillStyle = '#111111';
        ctx.fill(penguinPath, 'evenodd');
        ctx.restore();
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      wavePhase += dt * 0.55;
      gateAngle += dt * 0.32;

      for (const penguin of penguins) {
        penguin.angle += penguin.speed * dt;
        penguin.climb = Math.max(0, penguin.climb - dt);
        penguin.dwell -= dt;
        if (penguin.dwell <= 0) {
          const goingInside = Math.random() < 0.5;
          const nextTarget = goingInside
            ? 0.18 + Math.random() * 0.33
            : 0.72 + Math.random() * 0.43;
          if ((penguin.radius < ICE_THRESHOLD) !== (nextTarget < ICE_THRESHOLD)) {
            penguin.climb = CLIMB_SECONDS;
          }
          penguin.target = nextTarget;
          penguin.dwell = 2.5 + Math.random() * 4;
        }
        penguin.radius += (penguin.target - penguin.radius) * Math.min(1, dt * 0.55);
      }

      render(now / 1000);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reducedMotion || running) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reducedMotion || !running) render(performance.now() / 1000);
    };

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div className="sv2-empty-stage">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
};
