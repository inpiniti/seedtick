// components/studio-v2/OnboardingCelebration.tsx
// 온보딩 완료 시 폭죽 연출 + 완료 안내. 외부 라이브러리 없이 캔버스로 그린다.
import { useEffect, useRef } from 'react';
import { PartyPopper } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';

interface OnboardingCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

const COLORS = ['#3182f6', '#60a5fa', '#e2e8f0', '#fbbf24', '#94a3b8'];
const AUTO_CLOSE_MS = 4200;

export const OnboardingCelebration = ({ isOpen, onClose }: OnboardingCelebrationProps) => {
  const { ui } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const burst = () => {
      const cx = width * (0.2 + Math.random() * 0.6);
      const cy = height * (0.18 + Math.random() * 0.42);
      const count = 60 + Math.floor(Math.random() * 30);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.1;
        const speed = 2 + Math.random() * 5;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
        });
      }
    };
    burst();
    const burstTimer = window.setInterval(burst, 620);

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += 0.055;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 * p.life + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const closeTimer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => {
      window.clearInterval(burstTimer);
      window.clearTimeout(closeTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sv2-celebration" role="dialog" aria-modal="true" aria-live="polite">
      <canvas ref={canvasRef} className="sv2-celebration-canvas" aria-hidden="true" />
      <div className="sv2-celebration-card">
        <div className="sv2-celebration-icon">
          <PartyPopper size={26} />
        </div>
        <h2>{ui('가이드를 마쳤어요. 이제 직접 만들어보세요!')}</h2>
        <p>{ui('튜토리얼을 따라 영상 하나를 완성했어요.')}</p>
        <button type="button" className="sv2-btn sv2-btn-primary" onClick={onClose}>
          {ui('확인')}
        </button>
      </div>
    </div>
  );
};
