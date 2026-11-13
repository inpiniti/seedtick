// src/services/hyperframesIntroOutroRenderer.ts - HyperFrames (GSAP deterministic seekable timeline)
// High-fidelity Motion Synthesis Engine for Cinematic Video Intros & Outros

import gsap from 'gsap';
import type { IntroTemplateId, OutroTemplateId, VideoOverlayOptions } from '../types/video.ts';

export const DEFAULT_INTRO_DURATION = 2.0;
export const DEFAULT_OUTRO_DURATION = 2.2;
export const HYPERFRAMES_FPS = 30;

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
  ctx.fillText(title, 0, 0);

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
    const metaM = ctx.measureText(metaStr);
    const padX = 20 * scale;
    const badgeW = metaM.width + padX * 2;
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
    ctx.fillText(metaStr, cx, metaY);
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

  const tileW = Math.round(38 * scale);
  const tileH = Math.round(58 * scale);
  const gap = Math.round(4 * scale);
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
      ctx.font = `bold ${Math.round(30 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
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
  ctx.fillText('BOARDING NOW  •  JOURNEY ARCHIVE', cx, cy - 72 * scale);

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
      ctx.fillText(subParts.join('  |  '), cx, cy + 54 * scale);
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
  ctx.fillText(title, 0, 0);

  // 하단 얇은 디바이더 및 채널명
  if (state.metaAlpha > 0.01) {
    ctx.globalAlpha = state.metaAlpha;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${Math.round(14 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    const ch = (options?.channelText || 'REPORTIST CINEMA').toUpperCase();
    ctx.fillText(ch, 0, 48 * scale);
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
    ctx.fillText(title, cx, cy - 16 * scale);

    if (state.metaAlpha > 0.01) {
      ctx.globalAlpha = state.metaAlpha;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      const meta = [
        options?.showDate !== false ? options?.subtitleDateText : null,
        options?.subtitleLocationText,
        options?.channelText,
      ].filter(Boolean).join('  •  ');
      if (meta) ctx.fillText(meta, cx, cy + 36 * scale);
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

  // 좌측: 감사 메시지 및 채널 프로필 링
  ctx.save();
  const leftX = w * 0.32;

  // 채널 펄스 링
  if (state.pulseRadius > 0) {
    const pulseR = (46 + state.pulseRadius * 24) * scale;
    ctx.strokeStyle = `rgba(203, 213, 225, ${(0.45 * (1 - state.pulseRadius)).toFixed(3)})`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(leftX, cy - 36 * scale, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 채널 원형 배지
  ctx.globalAlpha = state.channelAlpha;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.arc(leftX, cy - 36 * scale, 42 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 채널 이니셜
  const ch = (options?.channelText || 'Reportist').trim();
  const initial = ch.charAt(0).toUpperCase() || 'R';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(32 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, leftX, cy - 36 * scale);

  // 감사 타이틀
  ctx.globalAlpha = state.titleAlpha;
  const outroMsg = options?.outroText || 'Thank you for watching!';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(28 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillText(outroMsg, leftX, cy + 38 * scale);

  // 채널명 서브
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillText(ch, leftX, cy + 72 * scale);
  ctx.restore();

  // 우측: 유튜브 추천 영상 플레이스홀더 카드 (16:9 규격 가이드)
  if (state.cardAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = state.cardAlpha;
    const cardW = Math.round(380 * scale);
    const cardH = Math.round(214 * scale);
    const cardX = w * 0.72 - cardW / 2;
    const cardY = cy - cardH / 2;

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
 */
function drawMinimalFadeOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.globalAlpha = state.titleAlpha;
  const outroMsg = options?.outroText || 'Thank you for watching';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(34 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 14;
  ctx.fillText(outroMsg, cx, cy - 14 * scale);

  if (options?.channelText && state.channelAlpha > 0.01) {
    ctx.globalAlpha = state.channelAlpha;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${Math.round(20 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.fillText(options.channelText, cx, cy + 30 * scale);
  }
  ctx.restore();
}

/**
 * 아웃트로 템플릿 3: 루버 블라인드 클로징 (Curtain Split)
 */
function drawCurtainSplitOutro(
  ctx: CanvasRenderingContext2D,
  state: OutroGsapState,
  options: VideoOverlayOptions | undefined,
  w: number,
  h: number,
  scale: number
) {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, h);

  // 5단 사선 루버 블라인드가 닫히는 비주얼
  const sliceCount = 5;
  const sliceH = h / sliceCount;
  ctx.save();
  ctx.fillStyle = '#0d0d0d';
  for (let i = 0; i < sliceCount; i++) {
    const y = i * sliceH;
    const offset = Math.min(1, state.louverClose * 1.3 - i * 0.06);
    if (offset > 0) {
      const curW = w * Math.max(0, offset);
      ctx.fillRect(0, y, curW, sliceH + 1);
    }
  }
  ctx.restore();

  // 텍스트 등장
  const cx = w / 2;
  const cy = h / 2;
  if (state.titleAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = state.titleAlpha;
    const outroMsg = options?.outroText || 'The End';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(36 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(outroMsg, cx, cy - 16 * scale);

    if (options?.channelText) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold ${Math.round(20 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      ctx.fillText(options.channelText, cx, cy + 28 * scale);
    }
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
  const scale = w / 1280;

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
  const scale = w / 1280;

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
    default:
      drawModernEndcardOutro(ctx, state, options, w, h, scale);
      break;
  }
  controller.destroy();
}
