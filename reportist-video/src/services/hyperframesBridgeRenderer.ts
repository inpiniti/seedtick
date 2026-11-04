// src/services/hyperframesBridgeRenderer.ts - HyperFrames (GSAP deterministic seekable timeline) chapter bridge renderer

import gsap from 'gsap';
import type { HighlightSegment, VideoOverlayOptions } from '../types/video.ts';

export const CHAPTER_BRIDGE_DURATION = 1.2; // 1.2s (36 frames at 30fps)
export const CHAPTER_BRIDGE_FPS = 30;
export const CHAPTER_BRIDGE_FRAMES = Math.round(CHAPTER_BRIDGE_DURATION * CHAPTER_BRIDGE_FPS);

export interface ChapterBridgeTransitionInfo {
  shouldBridge: boolean;
  fromDate: string;
  toDate: string;
  fromLocation: string;
  toLocation: string;
  sceneTitle: string;
  chapterIndex: number;
  totalChapters: number;
  isDateChanged: boolean;
  isLocationChanged: boolean;
  isSourceChanged: boolean;
}

/**
 * 안B 규칙: 이전 클립과 비교하여 날짜(subtitleDate), 위치(locationName), 또는 원본 영상(sourceVideoId)이
 * 변경되었을 때만 챕터 브릿지 삽입 여부를 판정합니다.
 */
export function evaluateChapterBridge(
  prevSegment: HighlightSegment | undefined,
  nextSegment: HighlightSegment,
  nextIndex: number,
  totalSegments: number,
  overlayOptions?: VideoOverlayOptions
): ChapterBridgeTransitionInfo {
  const enabled = overlayOptions?.showChapterBridge !== false;
  if (!prevSegment || !enabled) {
    return {
      shouldBridge: false,
      fromDate: '',
      toDate: '',
      fromLocation: '',
      toLocation: '',
      sceneTitle: '',
      chapterIndex: nextIndex + 1,
      totalChapters: totalSegments,
      isDateChanged: false,
      isLocationChanged: false,
      isSourceChanged: false,
    };
  }

  const fallbackDate = overlayOptions?.subtitleDateText?.trim() || '';
  const fallbackLoc = overlayOptions?.subtitleLocationText?.trim() || '';

  const fromDate = (prevSegment.subtitleDate || fallbackDate).trim();
  const toDate = (nextSegment.subtitleDate || fallbackDate).trim();

  const fromLocation = (prevSegment.locationName || fallbackLoc).trim();
  const toLocation = (nextSegment.locationName || fallbackLoc).trim();

  const isDateChanged = Boolean(fromDate && toDate && fromDate !== toDate);
  const isLocationChanged = Boolean(fromLocation && toLocation && fromLocation !== toLocation);
  const isSourceChanged = prevSegment.sourceVideoId !== nextSegment.sourceVideoId;

  const shouldBridge = isDateChanged || isLocationChanged || isSourceChanged;
  const sceneTitle = (nextSegment.subtitleTitle || nextSegment.reason || `Scene #${nextIndex + 1}`).trim();

  return {
    shouldBridge,
    fromDate,
    toDate: toDate || fromDate,
    fromLocation,
    toLocation: toLocation || fromLocation,
    sceneTitle,
    chapterIndex: nextIndex + 1,
    totalChapters: totalSegments,
    isDateChanged,
    isLocationChanged,
    isSourceChanged,
  };
}

/**
 * 전체 세그먼트 배열에 대해 각 세그먼트(id) 직전에 삽입될 브릿지 시간(초) 맵을 계산합니다.
 */
export function computeBridgeDurationMap(
  segments: HighlightSegment[],
  overlayOptions?: VideoOverlayOptions
): Record<string, number> {
  const map: Record<string, number> = {};
  if (!segments || segments.length <= 1) return map;
  if (overlayOptions?.showChapterBridge === false) return map;

  for (let i = 1; i < segments.length; i++) {
    const info = evaluateChapterBridge(
      segments[i - 1],
      segments[i],
      i,
      segments.length,
      overlayOptions
    );
    if (info.shouldBridge) {
      map[segments[i].id] = CHAPTER_BRIDGE_DURATION;
    }
  }
  return map;
}

/**
 * 날짜 롤링 효과: progress(0~1)에 따라 이전 날짜 숫자에서 다음 날짜 숫자로 슬롯머신처럼 스크램블/롤링
 */
function interpolateRollingDate(fromDate: string, toDate: string, rollProgress: number): string {
  if (!toDate) return '';
  if (!fromDate || fromDate === toDate || rollProgress >= 0.99) return toDate;
  if (rollProgress <= 0.01) return fromDate;

  // 오른쪽(일/월)부터 순차적으로 확정되거나 전체 숫자가 부드럽게 보간
  const chars = toDate.split('');
  const fromChars = fromDate.split('');

  return chars
    .map((ch, idx) => {
      if (!/\d/.test(ch)) return ch;
      // 각 자리마다 멈추는 타이밍을 살짝 다르게 (왼쪽 연도부터 오른쪽 일자 순으로 lock)
      const charLockThreshold = 0.35 + (idx / Math.max(1, chars.length)) * 0.6;
      if (rollProgress >= charLockThreshold) {
        return ch;
      }
      const targetDigit = parseInt(ch, 10);
      const startDigit =
        idx < fromChars.length && /\d/.test(fromChars[idx])
          ? parseInt(fromChars[idx], 10)
          : (targetDigit + 5) % 10;

      // 빠른 슬롯 회전 숫자 계산
      const spinCycles = Math.floor(rollProgress * 14) + idx;
      const currentDigit = (startDigit + spinCycles) % 10;
      return String(currentDigit);
    })
    .join('');
}

export interface BridgeGsapState {
  backdropAlpha: number;
  bgScale: number;
  cardAlpha: number;
  cardY: number;
  cardScale: number;
  badgeScale: number;
  badgeAlpha: number;
  dateRollProgress: number;
  dateY: number;
  dateAlpha: number;
  pinDropY: number;
  pinScale: number;
  pinAlpha: number;
  pinRippleScale: number;
  pinRippleAlpha: number;
  titleAlpha: number;
  titleY: number;
  lineProgress: number;
  outroFade: number;
}

/**
 * HyperFrames 패러다임: GSAP paused timeline을 생성하고 `tl.seek(timeSec)`으로 결정론적(Deterministic) 프레임을 렌더링합니다.
 */
export function createHyperframesBridgeController(durationSec = CHAPTER_BRIDGE_DURATION) {
  const state: BridgeGsapState = {
    backdropAlpha: 0,
    bgScale: 1.12,
    cardAlpha: 0,
    cardY: 36,
    cardScale: 0.94,
    badgeScale: 0.6,
    badgeAlpha: 0,
    dateRollProgress: 0,
    dateY: 16,
    dateAlpha: 0,
    pinDropY: -28,
    pinScale: 0.4,
    pinAlpha: 0,
    pinRippleScale: 0.5,
    pinRippleAlpha: 0,
    titleAlpha: 0,
    titleY: 18,
    lineProgress: 0,
    outroFade: 1,
  };

  const tl = gsap.timeline({ paused: true });

  // 1. 배경 딤 및 줌아웃 (0s ~ duration)
  tl.to(
    state,
    {
      backdropAlpha: 0.76,
      duration: 0.25,
      ease: 'power2.out',
    },
    0
  );
  tl.to(
    state,
    {
      bgScale: 1.0,
      duration: durationSec,
      ease: 'power1.out',
    },
    0
  );

  // 2. 메인 글래스 카드 등장 (0.04s ~ 0.36s)
  tl.to(
    state,
    {
      cardAlpha: 1,
      cardY: 0,
      cardScale: 1,
      duration: 0.32,
      ease: 'back.out(1.4)',
    },
    0.04
  );

  // 3. 상단 챕터 배지 팝업 (0.08s ~ 0.34s)
  tl.to(
    state,
    {
      badgeAlpha: 1,
      badgeScale: 1,
      duration: 0.26,
      ease: 'back.out(1.8)',
    },
    0.08
  );

  // 4. 날짜 롤링 카운터 (0.10s ~ 0.68s)
  tl.to(
    state,
    {
      dateAlpha: 1,
      dateY: 0,
      duration: 0.22,
      ease: 'power3.out',
    },
    0.1
  );
  tl.to(
    state,
    {
      dateRollProgress: 1,
      duration: 0.54,
      ease: 'power2.out',
    },
    0.12
  );

  // 5. 액센트 구분선 확장 (0.16s ~ 0.52s)
  tl.to(
    state,
    {
      lineProgress: 1,
      duration: 0.36,
      ease: 'power3.out',
    },
    0.16
  );

  // 6. GPS 핀 드롭 & 리플 효과 (0.18s ~ 0.65s)
  tl.to(
    state,
    {
      pinAlpha: 1,
      pinDropY: 0,
      pinScale: 1,
      duration: 0.34,
      ease: 'back.out(2.2)',
    },
    0.18
  );
  tl.to(
    state,
    {
      pinRippleScale: 2.2,
      pinRippleAlpha: 0.65,
      duration: 0.2,
      ease: 'power1.out',
    },
    0.32
  );
  tl.to(
    state,
    {
      pinRippleScale: 3.1,
      pinRippleAlpha: 0,
      duration: 0.28,
      ease: 'power2.out',
    },
    0.52
  );

  // 7. 하단 씬 타이틀 슬라이드업 (0.24s ~ 0.56s)
  tl.to(
    state,
    {
      titleAlpha: 1,
      titleY: 0,
      duration: 0.32,
      ease: 'power3.out',
    },
    0.24
  );

  // 8. 마지막 0.22초 동안 다음 클립 본편으로 부드럽게 페이드아웃 전환
  const fadeOutStart = Math.max(0.75, durationSec - 0.22);
  tl.to(
    state,
    {
      outroFade: 0,
      cardScale: 1.03,
      cardY: -12,
      duration: durationSec - fadeOutStart,
      ease: 'power2.in',
    },
    fadeOutStart
  );

  // HyperFrames 호환 레지스트리 노출 (디버깅 및 표준 인터페이스)
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __timelines?: Record<string, gsap.core.Timeline> };
    w.__timelines = w.__timelines || {};
    w.__timelines.chapterBridge = tl;
  }

  return {
    seekAndRender(
      ctx: CanvasRenderingContext2D,
      timeSec: number,
      targetWidth: number,
      targetHeight: number,
      info: ChapterBridgeTransitionInfo,
      drawNextVideoFrame?: () => void
    ) {
      const clampedTime = Math.max(0, Math.min(durationSec, timeSec));
      tl.seek(clampedTime, false);

      const masterAlpha = Math.max(0, Math.min(1, state.cardAlpha * state.outroFade));
      const overlayAlpha = Math.max(0, Math.min(1, state.backdropAlpha * state.outroFade));

      ctx.save();

      // 1. 배경: 다음 클립의 첫 장면(살짝 줌아웃 모션) 또는 다크 시네마틱 배경
      if (drawNextVideoFrame) {
        ctx.save();
        const cx = targetWidth / 2;
        const cy = targetHeight / 2;
        ctx.translate(cx, cy);
        ctx.scale(state.bgScale, state.bgScale);
        ctx.translate(-cx, -cy);
        drawNextVideoFrame();
        ctx.restore();
      } else {
        ctx.fillStyle = '#080c14';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // 2. 시네마틱 다크 비네팅 + 블루 글로우 배경 오버레이
      ctx.fillStyle = `rgba(8, 12, 20, ${overlayAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const radial = ctx.createRadialGradient(
        targetWidth / 2,
        targetHeight / 2,
        20,
        targetWidth / 2,
        targetHeight / 2,
        520
      );
      radial.addColorStop(0, `rgba(49, 130, 246, ${(0.24 * masterAlpha).toFixed(3)})`);
      radial.addColorStop(0.6, `rgba(15, 23, 42, ${(0.4 * overlayAlpha).toFixed(3)})`);
      radial.addColorStop(1, 'rgba(8, 12, 20, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 3. 중앙 브릿지 모션 카드
      ctx.save();
      const centerX = targetWidth / 2;
      const centerY = targetHeight / 2 + state.cardY;
      ctx.translate(centerX, centerY);
      ctx.scale(state.cardScale, state.cardScale);
      ctx.translate(-centerX, -centerY);
      ctx.globalAlpha = masterAlpha;

      const cardW = 680;
      const cardH = 250;
      const cardX = (targetWidth - cardW) / 2;
      const cardY = centerY - cardH / 2;

      // 카드 배경 & 테두리
      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(cardX, cardY, cardW, cardH, 22);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();

      // 3-1. 상단 CHAPTER 배지
      ctx.save();
      const badgeY = cardY + 38;
      ctx.translate(centerX, badgeY);
      ctx.scale(state.badgeScale, state.badgeScale);
      ctx.translate(-centerX, -badgeY);
      ctx.globalAlpha = masterAlpha * Math.max(0, Math.min(1, state.badgeAlpha));

      const badgeLabel = info.isDateChanged
        ? `TIMELINE JUMP  •  SCENE ${info.chapterIndex}/${info.totalChapters}`
        : info.isLocationChanged
        ? `LOCATION SHIFT  •  SCENE ${info.chapterIndex}/${info.totalChapters}`
        : `CHAPTER ${String(info.chapterIndex).padStart(2, '0')} / ${String(info.totalChapters).padStart(2, '0')}`;

      ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace';
      const badgeMetrics = ctx.measureText(badgeLabel);
      const bPadX = 16;
      const bW = badgeMetrics.width + bPadX * 2;
      const bH = 28;
      const bX = centerX - bW / 2;
      const bY = badgeY - bH / 2;

      const badgeGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY + bH);
      badgeGrad.addColorStop(0, '#2563eb');
      badgeGrad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = badgeGrad;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bX, bY, bW, bH, 999);
      } else {
        ctx.rect(bX, bY, bW, bH);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, centerX, badgeY + 0.5);
      ctx.restore();

      // 3-2. 날짜 슬롯 롤링 카운터 (또는 클립 전환 타이틀)
      const displayDate = interpolateRollingDate(
        info.fromDate,
        info.toDate,
        state.dateRollProgress
      );

      ctx.save();
      ctx.globalAlpha = masterAlpha * Math.max(0, Math.min(1, state.dateAlpha));
      const datePosY = cardY + 94 + state.dateY;

      if (displayDate) {
        ctx.font = '900 40px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(49, 130, 246, 0.45)';
        ctx.shadowBlur = 14;
        ctx.fillText(displayDate, centerX, datePosY);
      } else {
        ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.sceneTitle, centerX, datePosY);
      }
      ctx.restore();

      // 3-3. 액센트 라인 애니메이션
      if (state.lineProgress > 0.01) {
        ctx.save();
        const maxLineW = 240;
        const curLineW = maxLineW * state.lineProgress;
        const lineY = cardY + 134;
        const lineGrad = ctx.createLinearGradient(
          centerX - curLineW / 2,
          lineY,
          centerX + curLineW / 2,
          lineY
        );
        lineGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
        lineGrad.addColorStop(0.5, 'rgba(96, 165, 250, 0.9)');
        lineGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = lineGrad;
        ctx.fillRect(centerX - curLineW / 2, lineY, curLineW, 2);
        ctx.restore();
      }

      // 3-4. GPS 위치 스탬프 & 핀 드롭 또는 씬 서브타이틀
      const hasLocation = Boolean(info.toLocation);
      const bottomRowY = cardY + 172;

      if (hasLocation) {
        ctx.save();
        ctx.globalAlpha = masterAlpha * Math.max(0, Math.min(1, state.pinAlpha));
        ctx.font = '700 21px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        const locText = info.toLocation;
        const locMetrics = ctx.measureText(locText);
        const totalLocWidth = 24 + locMetrics.width;
        const pinX = centerX - totalLocWidth / 2 + 8;
        const pinY = bottomRowY + state.pinDropY;

        // 핀 리플 원
        if (state.pinRippleAlpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = masterAlpha * state.pinRippleAlpha;
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pinX, bottomRowY + 2, 7 * state.pinRippleScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 벡터 맵 핀 아이콘 그리기
        ctx.save();
        ctx.translate(pinX, pinY);
        ctx.scale(state.pinScale, state.pinScale);
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, -4, 7, Math.PI, 0, false);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -4, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 장소 텍스트
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(locText, pinX + 14, bottomRowY);
        ctx.restore();

        // 하단 씬 요약 캡션
        if (displayDate && info.sceneTitle) {
          ctx.save();
          ctx.globalAlpha = masterAlpha * Math.max(0, Math.min(1, state.titleAlpha));
          ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`"${info.sceneTitle}"`, centerX, cardY + 212 + state.titleY);
          ctx.restore();
        }
      } else if (displayDate && info.sceneTitle) {
        // 장소가 없을 때는 씬 제목을 큼직하게 하단에 표시
        ctx.save();
        ctx.globalAlpha = masterAlpha * Math.max(0, Math.min(1, state.titleAlpha));
        ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.sceneTitle, centerX, cardY + 186 + state.titleY);
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();
    },
    dispose() {
      tl.kill();
    },
  };
}
