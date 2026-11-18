// src/services/hyperframesIntroOutroRenderer.ts - HyperFrames (GSAP deterministic seekable timeline)
// High-fidelity Motion Synthesis Engine for Cinematic Video Intros & Outros

import gsap from 'gsap';
import type { IntroTemplateId, OutroTemplateId, VideoOverlayOptions } from '../types/video.ts';
import {
  DEFAULT_INTRO_DURATION,
  DEFAULT_OUTRO_DURATION,
  HYPERFRAMES_FPS,
} from './introOutroDefaults.ts';

export { DEFAULT_INTRO_DURATION, DEFAULT_OUTRO_DURATION, HYPERFRAMES_FPS } from './introOutroDefaults.ts';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface IntroGsapState {
  progress: number;
  titleAlpha: number;
  titleY: number;
  titleScale: number;
  titleLetterSpacing: number;
  metaAlpha: number;
  metaY: number;
  shutterProgress: number;
  countdownNumber: number;
  countdownRingAngle: number;
  flareAlpha: number;
  flareXRatio: number;
  flipProgress: number;
  glowIntensity: number;
}

export interface OutroGsapState {
  progress: number;
  titleAlpha: number;
  titleY: number;
  channelAlpha: number;
  channelScale: number;
  cardAlpha: number;
  cardScale: number;
  louverClose: number;
  pulseRadius: number;
  vignetteAlpha: number;
  panelClose: number;
  typeProgress: number;
  burstProgress: number;
  flashAlpha: number;
}

// ============================================================================
// Controller Factory (Seekable GSAP Timeline)
// ============================================================================

export function createHyperframesIntroController(
  template: IntroTemplateId = 'kinetic-slide',
  durationSec = DEFAULT_INTRO_DURATION
) {
  const state: IntroGsapState = {
    progress: 0,
    titleAlpha: 0,
    titleY: 48,
    titleScale: 0.92,
    titleLetterSpacing: 0,
    metaAlpha: 0,
    metaY: 24,
    shutterProgress: 0,
    countdownNumber: 3,
    countdownRingAngle: 0,
    flareAlpha: 0,
    flareXRatio: 0,
    flipProgress: 0,
    glowIntensity: 0,
  };

  const tl = gsap.timeline({ paused: true });

  if (template === 'kinetic-slide') {
    // 탄성 있는 모던 볼드 키네틱 슬라이드
    tl.to(
      state,
      {
        titleAlpha: 1,
        titleY: 0,
        titleScale: 1,
        glowIntensity: 1,
        duration: durationSec * 0.42,
        ease: 'back.out(1.8)',
      },
      0
    )
      .to(
        state,
        {
          metaAlpha: 1,
          metaY: 0,
          duration: durationSec * 0.35,
          ease: 'power2.out',
        },
        durationSec * 0.22
      )
      // 종료 전 부드러운 아웃 전환 준비
      .to(
        state,
        {
          titleScale: 1.03,
          glowIntensity: 0.6,
          duration: durationSec * 0.4,
          ease: 'sine.inOut',
        },
        durationSec * 0.45
      );
  } else if (template === 'split-flap') {
    // 아날로그 플립보드 회전 타임라인
    tl.to(
      state,
      {
        flipProgress: 1,
        duration: durationSec * 0.65,
        ease: 'power2.out',
      },
      0.05
    ).to(
      state,
      {
        metaAlpha: 1,
        metaY: 0,
        duration: durationSec * 0.3,
        ease: 'power2.out',
      },
      durationSec * 0.35
    );
  } else if (template === 'cinematic-letterbox') {
    // 시네마틱 아나모픽 렌즈 플레어 & 레터스페이싱 확장
    tl.to(
      state,
      {
        shutterProgress: 1,
        duration: durationSec * 0.3,
        ease: 'power2.out',
      },
      0
    )
      .to(
        state,
        {
          flareAlpha: 1,
          flareXRatio: 1,
          duration: durationSec * 0.55,
          ease: 'power1.inOut',
        },
        0.05
      )
      .to(
        state,
        {
          titleAlpha: 1,
          titleScale: 1,
          titleLetterSpacing: 6,
          glowIntensity: 1,
          duration: durationSec * 0.6,
          ease: 'power2.out',
        },
        0.1
      )
      .to(
        state,
        {
          metaAlpha: 1,
          metaY: 0,
          duration: durationSec * 0.35,
          ease: 'power2.out',
        },
        durationSec * 0.35
      );
  } else if (template === 'film-countdown') {
    // 빈티지 필름 3-2-1 카운트다운
    const countDuration = (durationSec * 0.55) / 3;
    tl.set(state, { countdownNumber: 3 }, 0)
      .to(state, { countdownRingAngle: Math.PI * 2, duration: countDuration, ease: 'linear' }, 0)
      .set(state, { countdownNumber: 2, countdownRingAngle: 0 }, countDuration)
      .to(state, { countdownRingAngle: Math.PI * 2, duration: countDuration, ease: 'linear' }, countDuration)
      .set(state, { countdownNumber: 1, countdownRingAngle: 0 }, countDuration * 2)
      .to(state, { countdownRingAngle: Math.PI * 2, duration: countDuration, ease: 'linear' }, countDuration * 2)
      .to(
        state,
        {
          shutterProgress: 1,
          titleAlpha: 1,
          titleScale: 1,
          glowIntensity: 1,
          duration: durationSec * 0.35,
          ease: 'back.out(1.5)',
        },
        durationSec * 0.58
      )
      .to(
        state,
        {
          metaAlpha: 1,
          metaY: 0,
          duration: durationSec * 0.28,
          ease: 'power2.out',
        },
        durationSec * 0.68
      );
  }

  return {
    seek: (progress: number): IntroGsapState => {
      const clamped = Math.max(0, Math.min(1, progress));
      state.progress = clamped;
      tl.seek(clamped * durationSec);
      return state;
    },
    destroy: () => tl.kill(),
  };
}

export function createHyperframesOutroController(
  template: OutroTemplateId = 'modern-endcard',
  durationSec = DEFAULT_OUTRO_DURATION
) {
  const state: OutroGsapState = {
    progress: 0,
    titleAlpha: 0,
    titleY: 36,
    channelAlpha: 0,
    channelScale: 0.85,
    cardAlpha: 0,
    cardScale: 0.9,
    louverClose: 0,
    pulseRadius: 0,
    vignetteAlpha: 0,
    panelClose: 0,
    typeProgress: 0,
    burstProgress: 0,
    flashAlpha: 0,
  };

  const tl = gsap.timeline({ paused: true });

  if (template === 'modern-endcard') {
    // 모던 유튜브 엔드카드 (추천 영상 가이드 + 채널 펄스 링)
    tl.to(
      state,
      {
        cardAlpha: 1,
        cardScale: 1,
        vignetteAlpha: 0.8,
        duration: durationSec * 0.4,
        ease: 'power2.out',
      },
      0
    )
      .to(
        state,
        {
          titleAlpha: 1,
          titleY: 0,
          duration: durationSec * 0.35,
          ease: 'back.out(1.4)',
        },
        durationSec * 0.15
      )
      .to(
        state,
        {
          channelAlpha: 1,
          channelScale: 1,
          duration: durationSec * 0.35,
          ease: 'back.out(1.6)',
        },
        durationSec * 0.25
      )
      .to(
        state,
        {
          pulseRadius: 1,
          duration: durationSec * 0.6,
          repeat: 1,
          ease: 'sine.inOut',
        },
        durationSec * 0.3
      );
  } else if (template === 'minimal-fade') {
    // 감성적 미니멀 비네트 페이드
    tl.to(
      state,
      {
        vignetteAlpha: 1,
        duration: durationSec * 0.5,
        ease: 'power1.inOut',
      },
      0
    )
      .to(
        state,
        {
          titleAlpha: 1,
          titleY: 0,
          duration: durationSec * 0.45,
          ease: 'power2.out',
        },
        durationSec * 0.1
      )
      .to(
        state,
        {
          channelAlpha: 1,
          channelScale: 1,
          duration: durationSec * 0.4,
          ease: 'power2.out',
        },
        durationSec * 0.25
      );
  } else if (template === 'curtain-split') {
    // 루버 블라인드가 닫히며 클로징
    tl.to(
      state,
      {
        louverClose: 1,
        duration: durationSec * 0.45,
        ease: 'power2.inOut',
      },
      0
    )
      .to(
        state,
        {
          titleAlpha: 1,
          titleY: 0,
          channelAlpha: 1,
          channelScale: 1,
          duration: durationSec * 0.4,
          ease: 'back.out(1.5)',
        },
        durationSec * 0.28
      );
  } else if (template === 'slide-panel') {
    // 좌우 패널이 중앙으로 슬라이드해 만나며 로고/문구 등장
    tl.to(
      state,
      {
        panelClose: 1,
        duration: durationSec * 0.52,
        ease: 'power3.inOut',
      },
      0
    )
      .to(
        state,
        {
          titleAlpha: 1,
          titleY: 0,
          duration: durationSec * 0.4,
          ease: 'power2.out',
        },
        durationSec * 0.4
      )
      .to(
        state,
        {
          channelAlpha: 1,
          channelScale: 1,
          duration: durationSec * 0.35,
          ease: 'sine.out',
        },
        durationSec * 0.55
      );
  } else if (template === 'typewriter-credits') {
    // 모노스페이스 타이핑 & 깜빡이는 커서
    tl.to(
      state,
      {
        typeProgress: 1,
        duration: durationSec * 0.66,
        ease: 'none',
      },
      durationSec * 0.04
    ).to(
      state,
      {
        channelAlpha: 1,
        channelScale: 1,
        duration: durationSec * 0.3,
        ease: 'power2.out',
      },
      durationSec * 0.62
    );
  } else if (template === 'light-burst') {
    // 방사형 광선 확장 + 오프닝 플래시
    tl.to(
      state,
      {
        flashAlpha: 1,
        duration: durationSec * 0.12,
        ease: 'power2.out',
      },
      0
    )
      .to(
        state,
        {
          flashAlpha: 0,
          duration: durationSec * 0.45,
          ease: 'power2.in',
        },
        durationSec * 0.12
      )
      .to(
        state,
        {
          burstProgress: 1,
          duration: durationSec * 0.72,
          ease: 'power2.out',
        },
        0
      )
      .to(
        state,
        {
          titleAlpha: 1,
          titleY: 0,
          duration: durationSec * 0.4,
          ease: 'back.out(1.4)',
        },
        durationSec * 0.3
      )
      .to(
        state,
        {
          channelAlpha: 1,
          channelScale: 1,
          duration: durationSec * 0.35,
          ease: 'power2.out',
        },
        durationSec * 0.45
      );
  }

  return {
    seek: (progress: number): OutroGsapState => {
      const clamped = Math.max(0, Math.min(1, progress));
      state.progress = clamped;
      tl.seek(clamped * durationSec);
      return state;
    },
    destroy: () => tl.kill(),
  };
}

// ============================================================================
// Canvas 2D Rendering Primitives
// ============================================================================

/**
 * 템플릿 1: 키네틱 슬라이드 (Kinetic Slide)
 */
function drawKineticSlideIntro(
  ctx: CanvasRenderingContext2D,
  state: IntroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  // 1. 방사형 앰비언트 글로우 배경
  const cx = w / 2;
  const cy = h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 40 * scale, cx, cy, 540 * scale);
  grad.addColorStop(0, `rgba(203, 213, 225, ${(0.22 * state.glowIntensity).toFixed(3)})`);
  grad.addColorStop(0.55, `rgba(15, 23, 42, 0.85)`);
  grad.addColorStop(1, '#050505');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 미세한 모던 테크 도트 그리드
  ctx.save();
  ctx.globalAlpha = 0.12 * state.glowIntensity;
  ctx.fillStyle = '#cbd5e1';
  const dotStep = Math.round(48 * scale);
  for (let x = dotStep / 2; x < w; x += dotStep) {
    for (let y = dotStep / 2; y < h; y += dotStep) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 2. 메인 타이틀
  const title = (options?.titleText || 'Highlights').trim();
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, state.titleAlpha));
  ctx.translate(cx, cy - 24 * scale + state.titleY * scale);
  ctx.scale(state.titleScale, state.titleScale);

  // 글로우 그림자
  ctx.shadowColor = 'rgba(203, 213, 225, 0.55)';
  ctx.shadowBlur = Math.round(28 * scale * state.glowIntensity);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(44 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 0, 0, w * 0.86);

  // 상단 하이라이트 액센트 바
  const titleMetrics = ctx.measureText(title);
  const barW = Math.min(w * 0.6, titleMetrics.width * 0.85);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-barW / 2, -Math.round(36 * scale), barW, Math.max(2, 3 * scale));
  ctx.restore();

  // 3. 서브 메타 태그 (날짜, 장소, 채널명)
  const metaParts = [
    options?.showDate !== false ? options?.subtitleDateText : null,
    options?.subtitleLocationText,
    options?.channelText,
  ].filter(Boolean) as string[];

  if (metaParts.length > 0 && state.metaAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, state.metaAlpha));
    const metaY = cy + 44 * scale + state.metaY * scale;

    ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 캡슐 배지 그리기
    const metaStr = metaParts.join('  •  ');
    ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    const metaM = ctx.measureText(metaStr);
    const padX = 20 * scale;
    const badgeW = Math.min(w * 0.9, metaM.width + padX * 2);
    const badgeH = 34 * scale;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cx - badgeW / 2, metaY - badgeH / 2, badgeW, badgeH, 17 * scale);
    } else {
      ctx.rect(cx - badgeW / 2, metaY - badgeH / 2, badgeW, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(metaStr, cx, metaY, badgeW - 16 * scale);
    ctx.restore();
  }
}

/**
 * 템플릿 2: 아날로그 스플릿-플랩 보드 (Split-Flap Retro Board)
 */
function drawSplitFlapIntro(
  ctx: CanvasRenderingContext2D,
  state: IntroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  // 다크 보드 배경
  ctx.fillStyle = '#090909';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const title = (options?.titleText || 'HIGHLIGHTS').toUpperCase().trim();
  const chars = Array.from(title.slice(0, 22)); // 가로 최대 22자
  if (chars.length === 0) return;

  // 세로 프레임에서도 보드가 넘치지 않도록 전체 타일 폭을 프레임 폭의 90%로 맞춘다.
  const rawTileW = 38 * scale;
  const rawGap = 4 * scale;
  const rawTotalW = chars.length * rawTileW + (chars.length - 1) * rawGap;
  const fit = Math.min(1, (w * 0.9) / Math.max(1, rawTotalW));
  const tileW = Math.round(rawTileW * fit);
  const tileH = Math.round(58 * scale * fit);
  const gap = Math.round(rawGap * fit);
  const totalW = chars.length * tileW + (chars.length - 1) * gap;
  let startX = cx - totalW / 2 + tileW / 2;

  ctx.save();
  chars.forEach((targetChar, idx) => {
    // 글자별 시차 딜레이 적용
    const charDelay = (idx / chars.length) * 0.4;
    const charProgress = Math.max(
      0,
      Math.min(1, (state.flipProgress - charDelay) / (1 - charDelay))
    );

    const x = startX + idx * (tileW + gap);
    const y = cy - 16 * scale;

    // 타일 백그라운드 & 상하 힌지
    const tileLeft = x - tileW / 2;
    const tileTop = y - tileH / 2;
    const halfH = tileH / 2;

    ctx.fillStyle = '#141414';
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(tileLeft, tileTop, tileW, tileH, 5 * scale);
    } else {
      ctx.rect(tileLeft, tileTop, tileW, tileH);
    }
    ctx.fill();
    ctx.stroke();

    // 중간 분할선
    ctx.fillStyle = '#050505';
    ctx.fillRect(tileLeft, y - 1, tileW, 2);

    // 표시 글자 (플립 중에는 랜덤 아스키 거치다가 완성)
    let displayChar = targetChar;
    if (charProgress < 0.85 && targetChar !== ' ') {
      const glyphs = 'ABCDEFGHIJKLMN0123456789';
      const rIdx = Math.floor((state.flipProgress * 20 + idx * 7) % glyphs.length);
      displayChar = glyphs[rIdx];
    }

    if (displayChar !== ' ') {
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.round(30 * scale * fit)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayChar, x, y);
    }
  });
  ctx.restore();

  // 상단 공항/철도 스타일 전광판 안내 라벨
  ctx.save();
  ctx.fillStyle = '#f59e0b';
  ctx.font = `bold ${Math.round(13 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BOARDING NOW  •  JOURNEY ARCHIVE', cx, cy - 72 * scale, w * 0.9);

  // 하단 메타정보
  if (state.metaAlpha > 0.01) {
    ctx.globalAlpha = state.metaAlpha;
    const subParts = [
      options?.showDate !== false ? options?.subtitleDateText : null,
      options?.subtitleLocationText,
      options?.channelText,
    ].filter(Boolean);
    if (subParts.length > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 ${Math.round(17 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      ctx.fillText(subParts.join('  |  '), cx, cy + 54 * scale, w * 0.9);
    }
  }
  ctx.restore();
}

/**
 * 템플릿 3: 시네마틱 레터박스 & 아나모픽 렌즈 플레어
 */
function drawCinematicLetterboxIntro(
  ctx: CanvasRenderingContext2D,
  state: IntroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  const cx = w / 2;
  const cy = h / 2;

  // 배경 딥 시네마틱 블랙
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, w, h);

  // 아나모픽 수평 렌즈 플레어 라인
  if (state.flareAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = state.flareAlpha;
    const flareY = cy;
    const flareGrad = ctx.createLinearGradient(0, flareY, w, flareY);
    flareGrad.addColorStop(0, 'rgba(203, 213, 225, 0)');
    flareGrad.addColorStop(0.5, 'rgba(203, 213, 225, 0.85)');
    flareGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');

    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, flareY - 1.5 * scale, w, 3 * scale);

    // 플레어 중심 핫스팟
    const spotX = w * state.flareXRatio;
    const spotGrad = ctx.createRadialGradient(spotX, flareY, 0, spotX, flareY, 120 * scale);
    spotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    spotGrad.addColorStop(0.4, 'rgba(203, 213, 225, 0.5)');
    spotGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.arc(spotX, flareY, 120 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 상하 시네마틱 레터박스 셔터 (2.39:1 시네마 비율 느낌)
  const barH = (h * 0.12 * state.shutterProgress);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, barH);
  ctx.fillRect(0, h - barH, w, barH);

  // 골드/화이트 시네마틱 타이틀
  const title = (options?.titleText || 'CINEMATIC MOMENTS').trim();
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, state.titleAlpha));
  ctx.translate(cx, cy - 14 * scale);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `600 ${Math.round(40 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", serif, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = Math.round(18 * scale);
  ctx.fillText(title, 0, 0, w * 0.88);

  // 하단 얇은 디바이더 및 채널명
  if (state.metaAlpha > 0.01) {
    ctx.globalAlpha = state.metaAlpha;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${Math.round(14 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    const ch = (options?.channelText || 'REPORTIST CINEMA').toUpperCase();
    ctx.fillText(ch, 0, 48 * scale, w * 0.9);
  }
  ctx.restore();
}

/**
 * 템플릿 4: 빈티지 필름 카운트다운 (Vintage Film 3-2-1)
 */
function drawFilmCountdownIntro(
  ctx: CanvasRenderingContext2D,
  state: IntroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  const cx = w / 2;
  const cy = h / 2;

  // 필름 베이스 그레이
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, w, h);

  if (state.shutterProgress < 0.95) {
    // 1단계: 3-2-1 원형 카운트다운
    ctx.save();
    // 십자 레티클 (Crosshair)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // 동심원 2개
    const r1 = Math.round(110 * scale);
    const r2 = Math.round(135 * scale);
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
    ctx.arc(cx, cy, r2, 0, Math.PI * 2);
    ctx.stroke();

    // 시계방향 스위프 와이프 (Sweep Sector)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r2, -Math.PI / 2, -Math.PI / 2 + state.countdownRingAngle, false);
    ctx.closePath();
    ctx.fill();

    // 카운트다운 숫자
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(80 * scale)}px -apple-system, BlinkMacSystemFont, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(state.countdownNumber), cx, cy);
    ctx.restore();
  } else {
    // 2단계: 타이틀 등장
    ctx.save();
    ctx.globalAlpha = state.titleAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(44 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 16;
    const title = options?.titleText || 'Highlights';
    ctx.fillText(title, cx, cy - 16 * scale, w * 0.88);

    if (state.metaAlpha > 0.01) {
      ctx.globalAlpha = state.metaAlpha;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      const meta = [
        options?.showDate !== false ? options?.subtitleDateText : null,
        options?.subtitleLocationText,
        options?.channelText,
      ].filter(Boolean).join('  •  ');
      if (meta) ctx.fillText(meta, cx, cy + 36 * scale, w * 0.9);
    }
    ctx.restore();
  }
}

// ============================================================================
// Outro Canvas 2D Rendering Primitives
// ============================================================================

/**
 * 아웃트로 템플릿 1: 모던 유튜브 엔드카드 (Modern Endcard)
 */
function drawModernEndcardOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  // 비네트 다크 배경
  ctx.fillStyle = '#070707';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const isPortrait = h > w;

  // 좌측(가로) / 상단 중앙(세로): 감사 메시지 및 채널 프로필 링
  ctx.save();
  const leftX = isPortrait ? cx : w * 0.32;
  const badgeY = isPortrait ? cy - 150 * scale : cy - 36 * scale;
  const badgeR = (isPortrait ? 48 : 42) * scale;

  // 채널 펄스 링
  if (state.pulseRadius > 0) {
    const pulseR = ((isPortrait ? 52 : 46) + state.pulseRadius * 24) * scale;
    ctx.strokeStyle = `rgba(203, 213, 225, ${(0.45 * (1 - state.pulseRadius)).toFixed(3)})`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(leftX, badgeY, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 채널 원형 배지
  ctx.globalAlpha = state.channelAlpha;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.arc(leftX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 채널 이니셜
  const ch = (options?.channelText || 'Reportist').trim();
  const initial = ch.charAt(0).toUpperCase() || 'R';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(32 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, leftX, badgeY);

  // 감사 타이틀
  ctx.globalAlpha = state.titleAlpha;
  const outroMsg = options?.outroText || 'Thank you for watching!';
  const outroMsgY = isPortrait ? cy - 36 * scale : cy + 38 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round((isPortrait ? 30 : 28) * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillText(outroMsg, leftX, outroMsgY, w * 0.86);

  // 채널명 서브
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillText(ch, leftX, isPortrait ? cy + 8 * scale : cy + 72 * scale, w * 0.8);
  ctx.restore();

  // 우측(가로) / 하단 중앙(세로): 추천 영상 플레이스홀더 카드
  if (state.cardAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = state.cardAlpha;
    const cardW = isPortrait ? Math.min(w * 0.82, 420 * scale) : Math.round(380 * scale);
    const cardH = Math.round(cardW * (9 / 16));
    const cardX = isPortrait ? cx - cardW / 2 : w * 0.72 - cardW / 2;
    const cardY = isPortrait ? cy + 64 * scale : cy - cardH / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cardX, cardY, cardW, cardH, 12 * scale);
    } else {
      ctx.rect(cardX, cardY, cardW, cardH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // 카드 내부 텍스트 안내
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${Math.round(15 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT RECOMMENDED VIDEO', cardX + cardW / 2, cardY + cardH / 2);
    ctx.restore();
  }
}

/**
 * 아웃트로 템플릿 2: 미니멀 잔상 페이드 (Minimal Fade)
 * 부드러운 레디얼 글로우 + 얇은 액센트 라인 + 느린 타이포 암전.
 * (루버 블라인드의 기계적 셔터와 대비되는 '빛이 꺼지는' 연출)
 */
function drawMinimalFadeOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const v = clamp01(state.vignetteAlpha);
  const t = clamp01(state.titleAlpha);

  // 중앙에서 퍼지는 은은한 글로우 + 가장자리 비네트
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
  glow.addColorStop(0, `rgba(99, 102, 241, ${(0.2 * v).toFixed(3)})`);
  glow.addColorStop(0.4, `rgba(30, 41, 59, ${(0.72 * v).toFixed(3)})`);
  glow.addColorStop(1, `rgba(0, 0, 0, ${Math.min(1, 0.5 + v * 0.5).toFixed(3)})`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // 타이틀과 함께 자라나는 가는 가로 액센트 라인
  if (t > 0.01) {
    ctx.save();
    ctx.globalAlpha = t;
    const lineHalf = Math.min(w * 0.34, 380 * scale) * t;
    const lineY = cy - 66 * scale + state.titleY * scale * 0.25;
    const accent = ctx.createLinearGradient(cx - lineHalf, 0, cx + lineHalf, 0);
    accent.addColorStop(0, 'rgba(165, 180, 252, 0)');
    accent.addColorStop(0.5, 'rgba(199, 210, 254, 0.9)');
    accent.addColorStop(1, 'rgba(165, 180, 252, 0)');
    ctx.fillStyle = accent;
    ctx.fillRect(cx - lineHalf, lineY, lineHalf * 2, Math.max(1, 1.5 * scale));
    ctx.restore();
  }

  // 얇고 우아한 타이포가 위로 떠오르며 암전
  if (t > 0.01) {
    ctx.save();
    ctx.globalAlpha = t;
    const outroMsg = options?.outroText || 'Thank you for watching';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `300 ${Math.round(38 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 24 * scale;
    ctx.fillText(outroMsg, cx, cy - 10 * scale + state.titleY * scale, w * 0.86);
    ctx.restore();
  }

  if (options?.channelText && state.channelAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.channelAlpha);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.channelText, cx, cy + 44 * scale, w * 0.9);
    ctx.restore();
  }
}

/**
 * 아웃트로 템플릿 3: 루버 블라인드 클로징 (Curtain Split)
 * 메탈 사선 셔터가 위에서 아래로 연달아 닫히며 크레딧을 가린 뒤,
 * 셔터 틈으로 클로징 문구가 드러나는 기계적 연출.
 */
function drawCurtainSplitOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#080a0f';
  ctx.fillRect(0, 0, w, h);

  // 7단 메탈 사선 루버가 순차적으로 닫힘
  const sliceCount = 7;
  const sliceH = h / sliceCount;
  const close = clamp01(state.louverClose);
  const stagger = 0.05;
  const span = 1 - (sliceCount - 1) * stagger;
  const skew = Math.min(sliceH * 0.5, 26 * scale);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  for (let i = 0; i < sliceCount; i++) {
    const y = i * sliceH;
    const local = clamp01((close - i * stagger) / span);
    if (local <= 0) continue;
    const curW = w * local;

    // 밝은 상단 → 어두운 하단 메탈 그라데이션
    const metal = ctx.createLinearGradient(0, y, 0, y + sliceH);
    metal.addColorStop(0, '#2b3546');
    metal.addColorStop(0.45, '#151d29');
    metal.addColorStop(1, '#0a0e15');
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(0, y + skew);
    ctx.lineTo(curW, y);
    ctx.lineTo(curW, y + sliceH);
    ctx.lineTo(0, y + sliceH + skew);
    ctx.closePath();
    ctx.fill();

    // 닫히는 중인 셔터의 밝은-leading 엣지
    if (local < 1) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      ctx.moveTo(curW, y);
      ctx.lineTo(curW, y + sliceH);
      ctx.stroke();
    }
    // 셔터 사이 가는 틈(그림자) 라인
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.beginPath();
    ctx.moveTo(0, y + sliceH + skew);
    ctx.lineTo(curW, y + sliceH);
    ctx.stroke();
  }
  ctx.restore();

  // 텍스트 등장 (셔터가 거의 닫힌 뒤)
  const cx = w / 2;
  const cy = h / 2;
  if (state.titleAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.titleAlpha);
    const outroMsg = options?.outroText || 'The End';
    ctx.fillStyle = '#f1f5f9';
    ctx.font = `bold ${Math.round(36 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 18 * scale;
    ctx.fillText(outroMsg, cx, cy - 16 * scale, w * 0.88);

    if (options?.channelText) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 ${Math.round(19 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      ctx.fillText(options.channelText, cx, cy + 30 * scale, w * 0.9);
    }
    ctx.restore();
  }
}

/**
 * 아웃트로 템플릿 4: 슬라이드 패널 (Slide Panel)
 * 좌우 두 패널이 중앙으로 미끄러져 만나며 가는 시안 라인이 번쩍인다.
 */
function drawSlidePanelOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#070a10';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const p = clamp01(state.panelClose);
  const panelW = w / 2 + 2;

  // 좌측 패널
  const left = ctx.createLinearGradient(0, 0, panelW, 0);
  left.addColorStop(0, '#0f172a');
  left.addColorStop(1, '#1e293b');
  ctx.fillStyle = left;
  ctx.fillRect(-panelW + panelW * p, 0, panelW, h);

  // 우측 패널
  const right = ctx.createLinearGradient(w, 0, w - panelW, 0);
  right.addColorStop(0, '#0f172a');
  right.addColorStop(1, '#1e293b');
  ctx.fillStyle = right;
  ctx.fillRect(w - panelW * p, 0, panelW, h);

  // 패널이 만날 때 중앙 시안 심 라인 번쩍
  if (p > 0.85) {
    ctx.save();
    ctx.globalAlpha = clamp01((p - 0.85) / 0.15);
    const seam = ctx.createLinearGradient(cx - 70 * scale, 0, cx + 70 * scale, 0);
    seam.addColorStop(0, 'rgba(56, 189, 248, 0)');
    seam.addColorStop(0.5, 'rgba(56, 189, 248, 0.95)');
    seam.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = seam;
    const seamH = Math.max(1, 2 * scale);
    ctx.fillRect(cx - 70 * scale, cy - 96 * scale, 140 * scale, seamH);
    ctx.fillRect(cx - 70 * scale, cy + 96 * scale, 140 * scale, seamH);
    ctx.restore();
  }

  if (state.titleAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.titleAlpha);
    const outroMsg = options?.outroText || 'Thank you for watching';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold ${Math.round(40 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 24 * scale;
    ctx.fillText(outroMsg, cx, cy - 14 * scale + state.titleY * scale, w * 0.82);
    ctx.restore();
  }
  if (options?.channelText && state.channelAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.channelAlpha);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `600 ${Math.round(19 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.channelText, cx, cy + 40 * scale, w * 0.9);
    ctx.restore();
  }
}

/**
 * 아웃트로 템플릿 5: 타이프라이터 크레딧 (Typewriter Credits)
 * 모노스페이스 글자가 한 글자씩 찍히고 블록 커서가 깜빡이는 레트로 터미널 연출.
 */
function drawTypewriterCreditsOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#050805';
  ctx.fillRect(0, 0, w, h);

  // CRT 스캔라인
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#86efac';
  const scanStep = Math.max(3, Math.round(5 * scale));
  for (let y = 0; y < h; y += scanStep) {
    ctx.fillRect(0, y, w, Math.max(1, scale));
  }
  ctx.restore();

  const cx = w / 2;
  const cy = h / 2;
  const full = options?.outroText || 'Thank you for watching';
  const chars = Array.from(full);
  const typed = chars.slice(0, Math.floor(clamp01(state.typeProgress) * chars.length)).join('');

  ctx.save();
  const monoFont = (px: number) =>
    `${Math.round(px * scale)}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
  ctx.font = monoFont(34);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#86efac';
  ctx.shadowColor = 'rgba(134, 239, 172, 0.55)';
  ctx.shadowBlur = 16 * scale;
  ctx.fillText(typed, cx, cy - 14 * scale, w * 0.84);

  // 타이핑된 텍스트 바로 뒤에 깜빡이는 블록 커서
  const typedWidth = ctx.measureText(typed).width;
  const cursorX = cx + typedWidth / 2 + 6 * scale;
  if (cursorX < w * 0.95 && Math.sin(state.progress * Math.PI * 30) > 0) {
    ctx.globalAlpha = 1;
    ctx.fillRect(cursorX, cy - 14 * scale - 17 * scale, Math.max(2, 9 * scale), 34 * scale);
  }
  ctx.restore();

  if (options?.channelText && state.channelAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.channelAlpha);
    ctx.fillStyle = '#4ade80';
    ctx.font = monoFont(18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`> ${options.channelText}`, cx, cy + 44 * scale, w * 0.9);
    ctx.restore();
  }
}

/**
 * 아웃트로 템플릿 6: 라이트 버스트 (Light Burst)
 * 중심에서 방사형 광선이 터져 나오며 오프닝 플래시가 번쩍이고 골드 타이포가 등장.
 */
function drawLightBurstOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const burst = clamp01(state.burstProgress);

  // 회전하는 방사형 광선
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.progress * Math.PI * 0.35);
  const rayCount = 24;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const inner = 40 * scale;
    const outer = (130 + burst * 700) * scale;
    const spread = 0.018 + (i % 2) * 0.012;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle - spread) * inner, Math.sin(angle - spread) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.lineTo(Math.cos(angle + spread) * inner, Math.sin(angle + spread) * inner);
    ctx.closePath();
    ctx.fillStyle =
      i % 2 === 0
        ? `rgba(250, 204, 21, ${(0.18 * (1 - burst * 0.45)).toFixed(3)})`
        : `rgba(251, 146, 60, ${(0.12 * (1 - burst * 0.4)).toFixed(3)})`;
    ctx.fill();
  }
  ctx.restore();

  // 중심 코어 글로우
  const coreR = (70 + burst * 340) * scale;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  core.addColorStop(0, `rgba(255, 247, 214, ${(0.85 * (1 - burst * 0.5)).toFixed(3)})`);
  core.addColorStop(0.32, `rgba(251, 191, 36, ${(0.32 * (1 - burst * 0.4)).toFixed(3)})`);
  core.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  // 오프닝 화이트 플래시
  if (state.flashAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.flashAlpha) * 0.9;
    ctx.fillStyle = '#fff8e1';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (state.titleAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.titleAlpha);
    const outroMsg = options?.outroText || 'Thank you for watching';
    ctx.fillStyle = '#fffbeb';
    ctx.font = `bold ${Math.round(42 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(251, 191, 36, 0.75)';
    ctx.shadowBlur = 30 * scale;
    ctx.fillText(outroMsg, cx, cy - 16 * scale + state.titleY * scale, w * 0.86);
    ctx.restore();
  }
  if (options?.channelText && state.channelAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp01(state.channelAlpha);
    ctx.fillStyle = '#fcd34d';
    ctx.font = `600 ${Math.round(19 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.channelText, cx, cy + 42 * scale, w * 0.9);
    ctx.restore();
  }
}

// ============================================================================
// Public Entry Points
// ============================================================================

export function renderHyperframesIntroFrame(
  ctx: CanvasRenderingContext2D,
  progress: number,
  options?: VideoOverlayOptions,
  w = 1280,
  h = 720
): void {
  const template = options?.introTemplate || 'kinetic-slide';
  const duration = options?.introDurationSec || DEFAULT_INTRO_DURATION;
  const controller = createHyperframesIntroController(template, duration);
  const state = controller.seek(progress);
  const scale = Math.min(w, h) / 720;

  switch (template) {
    case 'kinetic-slide':
      drawKineticSlideIntro(ctx, state, options, w, h, scale);
      break;
    case 'split-flap':
      drawSplitFlapIntro(ctx, state, options, w, h, scale);
      break;
    case 'cinematic-letterbox':
      drawCinematicLetterboxIntro(ctx, state, options, w, h, scale);
      break;
    case 'film-countdown':
      drawFilmCountdownIntro(ctx, state, options, w, h, scale);
      break;
    default:
      drawKineticSlideIntro(ctx, state, options, w, h, scale);
      break;
  }
  controller.destroy();
}

export function renderHyperframesOutroFrame(
  ctx: CanvasRenderingContext2D,
  progress: number,
  options?: VideoOverlayOptions,
  w = 1280,
  h = 720
): void {
  const template = options?.outroTemplate || 'modern-endcard';
  const duration = options?.outroDurationSec || DEFAULT_OUTRO_DURATION;
  const controller = createHyperframesOutroController(template, duration);
  const state = controller.seek(progress);
  const scale = Math.min(w, h) / 720;

  switch (template) {
    case 'modern-endcard':
      drawModernEndcardOutro(ctx, state, options, w, h, scale);
      break;
    case 'minimal-fade':
      drawMinimalFadeOutro(ctx, state, options, w, h, scale);
      break;
    case 'curtain-split':
      drawCurtainSplitOutro(ctx, state, options, w, h, scale);
      break;
    case 'slide-panel':
      drawSlidePanelOutro(ctx, state, options, w, h, scale);
      break;
    case 'typewriter-credits':
      drawTypewriterCreditsOutro(ctx, state, options, w, h, scale);
      break;
    case 'light-burst':
      drawLightBurstOutro(ctx, state, options, w, h, scale);
      break;
    default:
      drawModernEndcardOutro(ctx, state, options, w, h, scale);
      break;
  }
  controller.destroy();
}
