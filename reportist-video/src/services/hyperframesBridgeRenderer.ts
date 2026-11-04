// src/services/hyperframesBridgeRenderer.ts - HyperFrames (GSAP deterministic seekable timeline) Editorial Kinetic Louver & Mask-Split Typography Renderer

import gsap from 'gsap';
import type { HighlightSegment, VideoOverlayOptions } from '../types/video.ts';

export const CHAPTER_BRIDGE_DURATION = 1.3; // 1.3s (39 frames at 30fps) for crisp Wipe-In -> Hold/Reveal -> Wipe-Out rhythm
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
 * 날짜 롤링 효과: progress(0~1)에 따라 이전 날짜 숫자에서 다음 날짜 숫자로 정밀 오도미터처럼 전환
 */
function interpolateRollingDate(fromDate: string, toDate: string, rollProgress: number): string {
  if (!toDate) return '';
  if (!fromDate || fromDate === toDate || rollProgress >= 0.99) return toDate;
  if (rollProgress <= 0.01) return fromDate;

  const chars = toDate.split('');
  const fromChars = fromDate.split('');

  return chars
    .map((ch, idx) => {
      if (!/\d/.test(ch)) return ch;
      const charLockThreshold = 0.25 + (idx / Math.max(1, chars.length)) * 0.68;
      if (rollProgress >= charLockThreshold) {
        return ch;
      }
      const targetDigit = parseInt(ch, 10);
      const startDigit =
        idx < fromChars.length && /\d/.test(fromChars[idx])
          ? parseInt(fromChars[idx], 10)
          : (targetDigit + 5) % 10;

      const spinCycles = Math.floor(rollProgress * 12) + idx;
      const currentDigit = (startDigit + spinCycles) % 10;
      return String(currentDigit);
    })
    .join('');
}

const SLICE_COUNT = 5;

export interface BridgeGsapState {
  // 5개의 키네틱 슬라이스 진행률:
  // closeProgress[i]: 0 -> 1 (이전 장면을 덮으며 닫힘)
  // openProgress[i]: 0 -> 1 (다음 장면을 드러내며 열림)
  s0Close: number;
  s1Close: number;
  s2Close: number;
  s3Close: number;
  s4Close: number;
  s0Open: number;
  s1Open: number;
  s2Open: number;
  s3Open: number;
  s4Open: number;
  // 배경 영상 스케일 모션
  prevBgScale: number;
  nextBgScale: number;
  // 에디토리얼 센터 헤어라인 & 마스크 스플릿 타이포그래피
  hairlineProgress: number;
  hairlineAlpha: number;
  kickerY: number;
  kickerAlpha: number;
  headlineY: number;
  headlineAlpha: number;
  dateRollProgress: number;
  sublineY: number;
  sublineAlpha: number;
  ambientGlowAlpha: number;
}

/**
 * HyperFrames 패러다임:
 * 웹 팝업 같은 박스를 완전히 배제하고,
 * [Phase 1: 5단 스태거 루버 블라인드가 이전 장면을 샤-샤-샤-샥 덮음 (0.00s ~ 0.34s)]
 * -> [Phase 2: 0.12초의 정적 호흡 후 센터 헤어라인 위/아래 클리핑 마스크에서 에디토리얼 타이포가 솟아오름 (0.34s ~ 0.90s)]
 * -> [Phase 3: 타이포가 마스크 속으로 수렴한 뒤 루버 블라인드가 샤-샤-샤-샥 걷히며 다음 장면이 줌아웃으로 등장 (0.90s ~ 1.30s)]
 */
export function createHyperframesBridgeController(durationSec = CHAPTER_BRIDGE_DURATION) {
  const state: BridgeGsapState = {
    s0Close: 0,
    s1Close: 0,
    s2Close: 0,
    s3Close: 0,
    s4Close: 0,
    s0Open: 0,
    s1Open: 0,
    s2Open: 0,
    s3Open: 0,
    s4Open: 0,
    prevBgScale: 1.0,
    nextBgScale: 1.08,
    hairlineProgress: 0,
    hairlineAlpha: 0,
    kickerY: 28,
    kickerAlpha: 0,
    headlineY: 76,
    headlineAlpha: 0,
    dateRollProgress: 0,
    sublineY: -54,
    sublineAlpha: 0,
    ambientGlowAlpha: 0,
  };

  const tl = gsap.timeline({ paused: true });

  // ---------------------------------------------------------------------------
  // PHASE 1: Staggered Kinetic Louver Wipe-In (0.00s ~ 0.34s) - "샤-샤-샤-샥" 닫힘
  // ---------------------------------------------------------------------------
  tl.to(
    state,
    {
      prevBgScale: 1.05,
      duration: 0.36,
      ease: 'power2.in',
    },
    0
  );

  const closeKeys: Array<keyof BridgeGsapState> = ['s0Close', 's1Close', 's2Close', 's3Close', 's4Close'];
  closeKeys.forEach((key, idx) => {
    tl.to(
      state,
      {
        [key]: 1,
        duration: 0.22,
        ease: 'expo.out',
      },
      idx * 0.032 // 0.032초 간격의 찰진 스태거 리듬
    );
  });

  // ---------------------------------------------------------------------------
  // PHASE 2: Micro-Hold (0.34s ~ 0.42s) & Mask-Split Typography Reveal (0.36s ~ 0.88s)
  // 패널이 다 닫힌 직후 짧은 정적과 함께 중앙 수평 헤어라인이 그어지고 상/하 마스크에서 타이포가 등장
  // ---------------------------------------------------------------------------
  tl.to(
    state,
    {
      ambientGlowAlpha: 1,
      hairlineAlpha: 1,
      hairlineProgress: 1,
      duration: 0.22,
      ease: 'expo.out',
    },
    0.32
  );

  // 상단 챕터 인덱스 키커 (SCENE 04 / TIMELINE SHIFT)
  tl.to(
    state,
    {
      kickerY: 0,
      kickerAlpha: 1,
      duration: 0.24,
      ease: 'power3.out',
    },
    0.36
  );

  // 메인 헤드라인(날짜 또는 장소)이 중앙 헤어라인 위쪽 마스크에서 솟아오름
  tl.to(
    state,
    {
      headlineY: 0,
      headlineAlpha: 1,
      duration: 0.28,
      ease: 'expo.out',
    },
    0.38
  );

  tl.to(
    state,
    {
      dateRollProgress: 1,
      duration: 0.36,
      ease: 'power2.out',
    },
    0.38
  );

  // 서브 타이틀(장소 및 씬 설명)이 중앙 헤어라인 아래쪽 마스크에서 내려옴
  tl.to(
    state,
    {
      sublineY: 0,
      sublineAlpha: 1,
      duration: 0.28,
      ease: 'expo.out',
    },
    0.42
  );

  // ---------------------------------------------------------------------------
  // PHASE 3: Mask Retract (0.80s ~ 0.94s) -> Micro-Pause -> Louver Wipe-Out (0.94s ~ 1.30s)
  // 텍스트가 먼저 마스크 속으로 샥 들어가고, 0.05초의 여운 뒤 슬라이스가 샤-샤-샤-샥 열리며 다음 장면 등장
  // ---------------------------------------------------------------------------
  tl.to(
    state,
    {
      kickerY: -20,
      kickerAlpha: 0,
      headlineY: 72,
      headlineAlpha: 0,
      sublineY: -50,
      sublineAlpha: 0,
      duration: 0.15,
      ease: 'power3.in',
    },
    0.8
  );

  tl.to(
    state,
    {
      hairlineProgress: 0,
      hairlineAlpha: 0,
      ambientGlowAlpha: 0,
      duration: 0.16,
      ease: 'power3.inOut',
    },
    0.84
  );

  const openKeys: Array<keyof BridgeGsapState> = ['s0Open', 's1Open', 's2Open', 's3Open', 's4Open'];
  openKeys.forEach((key, idx) => {
    tl.to(
      state,
      {
        [key]: 1,
        duration: 0.23,
        ease: 'expo.inOut',
      },
      0.92 + idx * 0.034 // 위에서 아래로 샤-샤-샤-샥 걷히는 리듬
    );
  });

  tl.to(
    state,
    {
      nextBgScale: 1.0,
      duration: 0.42,
      ease: 'power2.out',
    },
    0.88
  );

  // HyperFrames 호환 레지스트리 노출
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
      drawNextVideoFrame?: () => void,
      drawPrevVideoFrame?: () => void
    ) {
      const clampedTime = Math.max(0, Math.min(durationSec, timeSec));
      tl.seek(clampedTime, false);

      ctx.save();

      // 1. 기저 비디오 프레임 렌더링:
      // 전반부(슬라이스가 닫히는 중, clampedTime < 0.45s)에는 "이전 장면(prevVideoFrame)"을 유지하고,
      // 슬라이스가 완전히 닫힌 시점(clampedTime >= 0.45s)부터는 뒤쪽 배경을 "다음 장면(nextVideoFrame)"으로 교체!
      const isOpeningPhase = clampedTime >= 0.45;
      if (!isOpeningPhase && drawPrevVideoFrame) {
        ctx.save();
        const cx = targetWidth / 2;
        const cy = targetHeight / 2;
        ctx.translate(cx, cy);
        ctx.scale(state.prevBgScale, state.prevBgScale);
        ctx.translate(-cx, -cy);
        drawPrevVideoFrame();
        ctx.restore();
      } else if (drawNextVideoFrame) {
        ctx.save();
        const cx = targetWidth / 2;
        const cy = targetHeight / 2;
        ctx.translate(cx, cy);
        ctx.scale(state.nextBgScale, state.nextBgScale);
        ctx.translate(-cx, -cy);
        drawNextVideoFrame();
        ctx.restore();
      } else {
        ctx.fillStyle = '#07090e';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // 2. 5단 키네틱 루버 블라인드(Staggered Louver Blades) 렌더링
      // 각 슬라이스가 사선 스큐(Skew) 엣지를 가지고 교차/순차 슬라이드하며 화면을 덮고 걷힘
      const closes = [state.s0Close, state.s1Close, state.s2Close, state.s3Close, state.s4Close];
      const opens = [state.s0Open, state.s1Open, state.s2Open, state.s3Open, state.s4Open];
      const sliceH = Math.ceil(targetHeight / SLICE_COUNT) + 2;
      const slant = 90; // 세련된 사선 각도 오프셋
      const totalSpanW = targetWidth + slant * 2;

      for (let i = 0; i < SLICE_COUNT; i++) {
        const cProg = Math.max(0, Math.min(1, closes[i]));
        const oProg = Math.max(0, Math.min(1, opens[i]));
        if (cProg <= 0.001 || oProg >= 0.999) continue;

        const yTop = i * Math.floor(targetHeight / SLICE_COUNT) - 1;
        const yBot = yTop + sliceH;

        // 닫힐 때는 왼쪽 -> 오른쪽으로 샥 덮이고, 열릴 때도 왼쪽 -> 오른쪽으로 샥 빠져나감 (일관된 방향성의 쾌감)
        const startX = -slant + oProg * totalSpanW;
        const endX = -slant + cProg * totalSpanW;
        if (endX <= startX + 0.5) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, yTop);
        ctx.lineTo(endX, yTop);
        ctx.lineTo(endX - slant, yBot);
        ctx.lineTo(startX - slant, yBot);
        ctx.closePath();

        // 깊고 고급스러운 매트 옵시디언 그라데이션 (단조로운 단색 대신 미세한 층감 부여)
        const bladeGrad = ctx.createLinearGradient(0, yTop, targetWidth, yBot);
        if (i % 2 === 0) {
          bladeGrad.addColorStop(0, '#090c12');
          bladeGrad.addColorStop(0.5, '#0f1420');
          bladeGrad.addColorStop(1, '#080b11');
        } else {
          bladeGrad.addColorStop(0, '#0b0f17');
          bladeGrad.addColorStop(0.5, '#121826');
          bladeGrad.addColorStop(1, '#090c12');
        }
        ctx.fillStyle = bladeGrad;
        ctx.fill();

        // 슬라이스간 미세한 수평 메탈릭 심(Seam) 라인 (패널이 맞물리는 기계적 디테일)
        if (i > 0 && cProg > 0.2 && oProg < 0.8) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, startX), yTop + 1);
          ctx.lineTo(Math.min(targetWidth, endX), yTop + 1);
          ctx.stroke();
        }

        // 리딩/트레일링 엣지 샴페인 골드 & 화이트 레이저 블레이드 광선 (샤샤샥 움직일 때만 반짝임)
        if (cProg > 0.02 && cProg < 0.98) {
          ctx.strokeStyle = 'rgba(245, 208, 125, 0.85)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(endX, yTop);
          ctx.lineTo(endX - slant, yBot);
          ctx.stroke();
        }
        if (oProg > 0.02 && oProg < 0.98) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startX, yTop);
          ctx.lineTo(startX - slant, yBot);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 3. 슬라이스가 닫혀 있는 동안의 은은한 에디토리얼 앰비언트 라이트 (박스 테두리 없음!)
      if (state.ambientGlowAlpha > 0.01) {
        ctx.save();
        const ambGrad = ctx.createRadialGradient(
          targetWidth / 2,
          targetHeight / 2,
          10,
          targetWidth / 2,
          targetHeight / 2,
          targetWidth * 0.45
        );
        ambGrad.addColorStop(0, `rgba(212, 175, 55, ${(0.09 * state.ambientGlowAlpha).toFixed(3)})`);
        ambGrad.addColorStop(0.5, `rgba(56, 189, 248, ${(0.05 * state.ambientGlowAlpha).toFixed(3)})`);
        ambGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ambGrad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // 배경에 아주 거대하고 옅은 워터마크 챕터 넘버 ("04") -> 편집 디자인 느낌 극대화
        const watermarkNum = String(info.chapterIndex).padStart(2, '0');
        ctx.font = '900 240px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.028 * state.ambientGlowAlpha).toFixed(4)})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(watermarkNum, targetWidth / 2, targetHeight / 2 - 10);
        ctx.restore();
      }

      // 4. 중앙 수평 에디토리얼 헤어라인 & 마스크 스플릿 타이포그래피 (팝업 카드 Zero!)
      const centerX = targetWidth / 2;
      const horizonY = Math.round(targetHeight * 0.52);

      if (state.hairlineAlpha > 0.01 && state.hairlineProgress > 0.01) {
        ctx.save();
        const maxLineW = Math.min(640, targetWidth * 0.56);
        const curLineW = maxLineW * state.hairlineProgress;

        const lineGrad = ctx.createLinearGradient(
          centerX - curLineW / 2,
          horizonY,
          centerX + curLineW / 2,
          horizonY
        );
        lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        lineGrad.addColorStop(0.2, `rgba(245, 208, 125, ${(0.75 * state.hairlineAlpha).toFixed(3)})`);
        lineGrad.addColorStop(0.5, `rgba(255, 255, 255, ${(0.95 * state.hairlineAlpha).toFixed(3)})`);
        lineGrad.addColorStop(0.8, `rgba(245, 208, 125, ${(0.75 * state.hairlineAlpha).toFixed(3)})`);
        lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX - curLineW / 2, horizonY);
        ctx.lineTo(centerX + curLineW / 2, horizonY);
        ctx.stroke();

        // 중앙 다이아몬드 액센트 포인트
        const dSize = 4 * state.hairlineProgress;
        ctx.fillStyle = `rgba(245, 208, 125, ${state.hairlineAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(centerX, horizonY - dSize);
        ctx.lineTo(centerX + dSize, horizonY);
        ctx.lineTo(centerX, horizonY + dSize);
        ctx.lineTo(centerX - dSize, horizonY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 4-A. 상단 마스크 영역 (horizonY 위쪽에서만 텍스트가 솟아오름)
      const mainDisplayDate = interpolateRollingDate(
        info.fromDate,
        info.toDate,
        state.dateRollProgress
      );
      const primaryHeadline = mainDisplayDate || info.toLocation || `CHAPTER 0${info.chapterIndex}`;

      if (state.headlineAlpha > 0.01 || state.kickerAlpha > 0.01) {
        ctx.save();
        // 상단 클리핑 마스크: horizonY 아래로는 절대 보이지 않음 (진짜 모션그래픽 마스크 리빌)
        ctx.beginPath();
        ctx.rect(0, horizonY - 160, targetWidth, 158);
        ctx.clip();

        // 상단 소형 에디토리얼 키커 (파란 알약 배지 대신 넓은 자간의 미니멀 레터링)
        if (state.kickerAlpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, state.kickerAlpha));
          const kickerLabel = info.isDateChanged
            ? `TIMELINE  •  SCENE ${String(info.chapterIndex).padStart(2, '0')} / ${String(info.totalChapters).padStart(2, '0')}`
            : info.isLocationChanged
            ? `LOCATION  •  SCENE ${String(info.chapterIndex).padStart(2, '0')} / ${String(info.totalChapters).padStart(2, '0')}`
            : `CHAPTER ${String(info.chapterIndex).padStart(2, '0')}  •  SCENE ${String(info.chapterIndex).padStart(2, '0')} / ${String(info.totalChapters).padStart(2, '0')}`;

          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.fillStyle = '#f5d07d'; // 샴페인 골드
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          if ('letterSpacing' in ctx) {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
          }
          ctx.fillText(kickerLabel, centerX, horizonY - 78 + state.kickerY);
          ctx.restore();
        }

        // 메인 헤드라인 (날짜 또는 장소)
        if (state.headlineAlpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, state.headlineAlpha));
          ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          if ('letterSpacing' in ctx) {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-1px';
          }
          ctx.fillText(primaryHeadline, centerX, horizonY - 12 + state.headlineY);
          ctx.restore();
        }

        ctx.restore();
      }

      // 4-B. 하단 마스크 영역 (horizonY 아래쪽에서만 서브 타이틀이 미끄러져 내려옴)
      if (state.sublineAlpha > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, horizonY + 2, targetWidth, 130);
        ctx.clip();

        ctx.globalAlpha = Math.max(0, Math.min(1, state.sublineAlpha));

        const subParts: string[] = [];
        if (mainDisplayDate && info.toLocation) {
          subParts.push(info.toLocation);
        }
        if (info.sceneTitle) {
          subParts.push(info.sceneTitle);
        }
        const sublineText = subParts.join('  ·  ') || `Scene #${info.chapterIndex}`;
        const truncatedSub =
          sublineText.length > 38 ? `${sublineText.slice(0, 37)}…` : sublineText;

        ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(truncatedSub, centerX, horizonY + 18 + state.sublineY);

        ctx.restore();
      }

      ctx.restore();
    },

    dispose() {
      tl.kill();
      if (typeof window !== 'undefined') {
        const w = window as unknown as { __timelines?: Record<string, gsap.core.Timeline> };
        if (w.__timelines?.chapterBridge === tl) {
          delete w.__timelines.chapterBridge;
        }
      }
    },
  };
}
