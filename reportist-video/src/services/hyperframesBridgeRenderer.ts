// src/services/hyperframesBridgeRenderer.ts - HyperFrames (GSAP deterministic seekable timeline)
// Modular Chapter Bridge: 5 Date Templates x 5 Location Templates Combinable Renderer

import gsap from 'gsap';
import type {
  BridgeDateTemplateId,
  BridgeLocationTemplateId,
  HighlightSegment,
  VideoOverlayOptions,
} from '../types/video.ts';

export const CHAPTER_BRIDGE_DURATION = 2.2; // 2.2s (66 frames at 30fps) so viewers clearly recognize From -> To
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
  travelVehicle: 'plane' | 'car';
  dateTemplate: BridgeDateTemplateId;
  locationTemplate: BridgeLocationTemplateId;
}

/**
 * 날짜/장소 문자열에서 비교용 정규화 텍스트 추출 (연령 표기 등 부가 괄호는 제외하고 비교하거나 전체 비교)
 */
function normalizeMeta(str?: string): string {
  return (str || '').trim();
}

/**
 * 장소 이름이나 거리에서 이동 수단(비행기 vs 자동차) 자동 판별
 */
function detectTravelVehicle(
  prevSeg: HighlightSegment,
  nextSeg: HighlightSegment,
  fromLoc: string,
  toLoc: string
): 'plane' | 'car' {
  const combined = `${fromLoc} ${toLoc}`.toLowerCase();
  const planeKeywords = [
    '공항', '제주', '일본', '도쿄', '오사카', '후쿠오카', '방콕', '베트남', '다낭',
    '타이베이', '대만', '유럽', '파리', '런던', '미국', '하와이', '괌', '사이판',
    '싱가포르', '발리', '호주', 'airport', 'jeju', 'tokyo', 'osaka', 'paris', 'london',
  ];
  if (planeKeywords.some((k) => combined.includes(k))) {
    return 'plane';
  }
  if (
    prevSeg.latitude != null &&
    prevSeg.longitude != null &&
    nextSeg.latitude != null &&
    nextSeg.longitude != null
  ) {
    const dLat = Math.abs(prevSeg.latitude - nextSeg.latitude);
    const dLon = Math.abs(prevSeg.longitude - nextSeg.longitude);
    if (Math.hypot(dLat, dLon) > 2.2) {
      return 'plane';
    }
  }
  return 'car';
}

/**
 * 브릿지 발동 규칙:
 * 1. skipChapterBridge 플래그가 설정되어 있으면 건너뜁니다.
 * 2. 원본 영상만 바뀐 경우는 전환 없이 계속 진행, 오직 날짜 또는 장소가 실제로 바뀌었을 때만 발동합니다.
 * 3. 템플릿은 세그먼트 개별 오버라이드 -> 전역 설정(overlayOptions) -> 기본값 순으로 결정됩니다.
 */
export function evaluateChapterBridge(
  prevSegment: HighlightSegment | undefined,
  nextSegment: HighlightSegment,
  nextIndex: number,
  totalSegments: number,
  overlayOptions?: VideoOverlayOptions
): ChapterBridgeTransitionInfo {
  const enabled = overlayOptions?.showChapterBridge !== false;
  const dateTemplate: BridgeDateTemplateId =
    nextSegment.bridgeDateTemplateOverride ||
    overlayOptions?.chapterBridgeDateTemplate ||
    'flip-clock';
  const locationTemplate: BridgeLocationTemplateId =
    nextSegment.bridgeLocationTemplateOverride ||
    overlayOptions?.chapterBridgeLocationTemplate ||
    'winding-route';

  if (!prevSegment || !enabled || nextSegment.skipChapterBridge) {
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
      travelVehicle: 'car',
      dateTemplate,
      locationTemplate,
    };
  }

  const dateVisible = overlayOptions?.showDate !== false;
  const fallbackDate = dateVisible ? normalizeMeta(overlayOptions?.subtitleDateText) : '';
  const fallbackLoc = normalizeMeta(overlayOptions?.subtitleLocationText);

  const fromDate = dateVisible
    ? normalizeMeta(prevSegment.subtitleDate) || fallbackDate
    : '';
  const toDate = dateVisible
    ? normalizeMeta(nextSegment.subtitleDate) || fallbackDate
    : '';

  const fromLocation = normalizeMeta(prevSegment.locationName) || fallbackLoc;
  const toLocation = normalizeMeta(nextSegment.locationName) || fallbackLoc;

  const isDateChanged = Boolean(fromDate && toDate && fromDate !== toDate);
  const isLocationChanged = Boolean(fromLocation && toLocation && fromLocation !== toLocation);
  const isSourceChanged = prevSegment.sourceVideoId !== nextSegment.sourceVideoId;

  const shouldBridge = isDateChanged || isLocationChanged;
  const sceneTitle = normalizeMeta(nextSegment.subtitleTitle || nextSegment.reason);
  const travelVehicle = detectTravelVehicle(prevSegment, nextSegment, fromLocation, toLocation);

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
    travelVehicle,
    dateTemplate,
    locationTemplate,
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

const SLICE_COUNT = 5;

export interface BridgeGsapState {
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
  prevBgScale: number;
  nextBgScale: number;
  stageAlpha: number;
  stageY: number;
  flipProgress: number; // 날짜 진행률 (0 -> 1)
  routeProgress: number; // 장소 진행률 (0 -> 1)
  destPulse: number; // 도착 펄스 (0 -> 1)
}

function extractCoreDate(raw: string) {
  const match = raw.match(/^([^\(\[]+)/);
  return (match ? match[1] : raw).trim();
}

function extractSuffix(raw: string) {
  const match = raw.match(/([\([].+)$/);
  return match ? match[1].trim() : '';
}

/* =====================================================================
 * [날짜 1번] 아날로그 플립 탁상시계 (Split-Flap Flip Clock)
 * ===================================================================== */
function drawSplitFlapTile(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  tileW: number,
  tileH: number,
  fromChar: string,
  toChar: string,
  charFlipProgress: number
) {
  const x = centerX - tileW / 2;
  const y = centerY - tileH / 2;
  const halfH = tileH / 2;
  const radius = 8;

  if (fromChar === toChar && !/[0-9A-Za-z가-힣]/.test(toChar)) {
    ctx.save();
    ctx.font = `800 ${Math.round(tileH * 0.58)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
    ctx.fillStyle = '#f5d07d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toChar, centerX, centerY + 2);
    ctx.restore();
    return;
  }

  const isSameChar = fromChar === toChar;
  const totalSteps = isSameChar ? 1 : 4;
  const scaledProg = Math.max(0, Math.min(0.9999, charFlipProgress)) * totalSteps;
  const stepIndex = Math.floor(scaledProg);
  const localFlap = isSameChar ? 0 : scaledProg - stepIndex;

  const getCharAtStep = (step: number): string => {
    if (step <= 0) return fromChar || '0';
    if (step >= totalSteps) return toChar || '0';
    if (/\d/.test(toChar)) {
      const startNum = /\d/.test(fromChar) ? parseInt(fromChar, 10) : 0;
      const endNum = parseInt(toChar, 10);
      const interpolated = Math.round(startNum + ((endNum - startNum + 10) % 10) * (step / totalSteps)) % 10;
      return String(interpolated);
    }
    return step >= totalSteps / 2 ? toChar : fromChar;
  };

  const currentChar = charFlipProgress >= 0.995 ? toChar : getCharAtStep(stepIndex);
  const nextChar = charFlipProgress >= 0.995 ? toChar : getCharAtStep(stepIndex + 1);

  const drawHalfCard = (
    half: 'top' | 'bottom',
    charToDraw: string,
    scaleY = 1,
    brightness = 1
  ) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(1, scaleY);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    if (half === 'top') {
      ctx.rect(x, y, tileW, halfH - 1);
    } else {
      ctx.rect(x, centerY + 1, tileW, halfH - 1);
    }
    ctx.clip();

    const bgGrad = ctx.createLinearGradient(x, y, x, y + tileH);
    if (half === 'top') {
      bgGrad.addColorStop(0, '#1e1e1e');
      bgGrad.addColorStop(0.5, '#151515');
      bgGrad.addColorStop(1, '#111111');
    } else {
      bgGrad.addColorStop(0, '#141414');
      bgGrad.addColorStop(1, '#1c1c1c');
    }
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, tileW, tileH, radius);
    } else {
      ctx.rect(x, y, tileW, tileH);
    }
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = `900 ${Math.round(tileH * 0.66)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
    ctx.fillStyle = charFlipProgress >= 0.995 ? '#ffffff' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(charToDraw, centerX, centerY + 2);

    if (brightness < 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - brightness).toFixed(3)})`;
      ctx.fillRect(x, y, tileW, tileH);
    } else if (brightness > 1) {
      ctx.fillStyle = `rgba(255, 255, 255, ${((brightness - 1) * 0.35).toFixed(3)})`;
      ctx.fillRect(x, y, tileW, tileH);
    }

    ctx.restore();
  };

  if (!isSameChar && charFlipProgress > 0.005 && charFlipProgress < 0.995) {
    drawHalfCard('top', nextChar, 1, 0.92);
    drawHalfCard('bottom', currentChar, 1, 0.95);

    if (localFlap < 0.5) {
      const flapScale = Math.max(0.04, Math.cos(localFlap * Math.PI));
      drawHalfCard('top', currentChar, flapScale, 1 - localFlap * 0.65);
    } else {
      const flapScale = Math.max(0.04, Math.sin((localFlap - 0.5) * Math.PI));
      drawHalfCard('bottom', nextChar, flapScale, 0.75 + (localFlap - 0.5) * 0.5);
    }
  } else {
    const finalChar = charFlipProgress >= 0.5 ? toChar : fromChar;
    drawHalfCard('top', finalChar, 1, 1);
    drawHalfCard('bottom', finalChar, 1, 0.96);
  }

  ctx.save();
  ctx.fillStyle = '#070707';
  ctx.fillRect(x, centerY - 1.2, tileW, 2.4);
  ctx.fillStyle = 'rgba(245, 208, 125, 0.55)';
  ctx.fillRect(x + 1, centerY - 3, 2.5, 6);
  ctx.fillRect(x + tileW - 3.5, centerY - 3, 2.5, 6);
  ctx.restore();
}

function renderDate1_FlipClock(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  progress: number,
  bothActive: boolean
) {
  const clockCenterY = bothActive ? centerY - Math.round(95 * scale) : centerY - Math.round(12 * scale);

  ctx.save();
  ctx.font = `700 ${Math.round(13 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillStyle = '#f5d07d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(4 * scale)}px`;
  }
  ctx.fillText('DATE CHANGE', centerX, clockCenterY - Math.round((bothActive ? 68 : 84) * scale));
  ctx.restore();

  const fromCore = extractCoreDate(info.fromDate);
  const toCore = extractCoreDate(info.toDate);
  const maxLen = Math.max(fromCore.length, toCore.length);
  const paddedFrom = fromCore.padEnd(maxLen, ' ');
  const paddedTo = toCore.padEnd(maxLen, ' ');

  const tileH = Math.round((bothActive ? 74 : 92) * scale);
  const digitW = Math.round((bothActive ? 50 : 62) * scale);
  const punctW = Math.round((bothActive ? 22 : 26) * scale);
  const gap = Math.round(6 * scale);

  const charWidths = paddedTo.split('').map((ch) =>
    /[0-9A-Za-z가-힣]/.test(ch) ? digitW : punctW
  );
  const totalClockW = charWidths.reduce((acc, w) => acc + w, 0) + Math.max(0, maxLen - 1) * gap;

  const framePadX = Math.round(22 * scale);
  const framePadY = Math.round(14 * scale);
  ctx.save();
  ctx.fillStyle = 'rgba(7, 7, 7, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = Math.round(24 * scale);
  ctx.shadowOffsetY = Math.round(8 * scale);
  ctx.beginPath();
  const frameRadius = Math.round(16 * scale);
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(
      centerX - totalClockW / 2 - framePadX,
      clockCenterY - tileH / 2 - framePadY,
      totalClockW + framePadX * 2,
      tileH + framePadY * 2,
      frameRadius
    );
  } else {
    ctx.rect(
      centerX - totalClockW / 2 - framePadX,
      clockCenterY - tileH / 2 - framePadY,
      totalClockW + framePadX * 2,
      tileH + framePadY * 2
    );
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.stroke();
  ctx.restore();

  let cursorX = centerX - totalClockW / 2;
  for (let i = 0; i < maxLen; i++) {
    const w = charWidths[i];
    const tileCenterX = cursorX + w / 2;
    const staggerOffset = (i / Math.max(1, maxLen - 1)) * 0.28;
    const localProg = Math.max(0, Math.min(1, (progress - staggerOffset) / (1 - 0.28)));
    drawSplitFlapTile(ctx, tileCenterX, clockCenterY, w, tileH, paddedFrom[i], paddedTo[i], localProg);
    cursorX += w + gap;
  }

  const fromSuffix = extractSuffix(info.fromDate);
  const toSuffix = extractSuffix(info.toDate);
  const summaryY = clockCenterY + tileH / 2 + Math.round((bothActive ? 34 : 46) * scale);

  ctx.save();
  ctx.font = `600 ${Math.round(18 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
  ctx.textBaseline = 'middle';
  const leftLabel = `${fromCore}${fromSuffix ? ' ' + fromSuffix : ''}`;
  const rightLabel = `${toCore}${toSuffix ? ' ' + toSuffix : ''}`;
  const arrowStr = '   →   ';
  const leftW = ctx.measureText(leftLabel).width;
  const arrowW = ctx.measureText(arrowStr).width;
  const rightW = ctx.measureText(rightLabel).width;
  const totalSummaryW = leftW + arrowW + rightW;
  const startSumX = centerX - totalSummaryW / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.fillText(leftLabel, startSumX, summaryY);
  ctx.fillStyle = '#f5d07d';
  ctx.fillText(arrowStr, startSumX + leftW, summaryY);
  ctx.fillStyle = progress > 0.75 ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
  ctx.font = `700 ${Math.round(19 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
  ctx.fillText(rightLabel, startSumX + leftW + arrowW, summaryY);
  ctx.restore();
}

/* =====================================================================
 * [날짜 2번] 럭셔리 워치 회전 (Luxury Watch Hand Spin)
 * ===================================================================== */
function renderDate2_WatchSpin(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  progress: number,
  bothActive: boolean
) {
  const watchCenterY = bothActive ? centerY - Math.round(92 * scale) : centerY - Math.round(8 * scale);
  const radius = Math.round((bothActive ? 52 : 68) * scale);

  ctx.save();
  ctx.font = `700 ${Math.round(12 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TIME TRAVEL', centerX, watchCenterY - radius - Math.round(28 * scale));

  // 시계 베젤 외부 링
  const bezelGrad = ctx.createLinearGradient(centerX - radius, watchCenterY - radius, centerX + radius, watchCenterY + radius);
  bezelGrad.addColorStop(0, '#f5d07d');
  bezelGrad.addColorStop(0.5, '#78350f');
  bezelGrad.addColorStop(1, '#f5d07d');
  ctx.strokeStyle = bezelGrad;
  ctx.lineWidth = Math.round(6 * scale);
  ctx.beginPath();
  ctx.arc(centerX, watchCenterY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 시계 내부 다이얼
  ctx.fillStyle = '#090909';
  ctx.beginPath();
  ctx.arc(centerX, watchCenterY, radius - Math.round(3 * scale), 0, Math.PI * 2);
  ctx.fill();

  // 12개 인덱스 틱
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const isMajor = i % 3 === 0;
    const tickLen = isMajor ? Math.round(8 * scale) : Math.round(4 * scale);
    const r1 = radius - Math.round(7 * scale);
    const r2 = r1 - tickLen;
    ctx.strokeStyle = isMajor ? '#f5d07d' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * r1, watchCenterY + Math.sin(angle) * r1);
    ctx.lineTo(centerX + Math.cos(angle) * r2, watchCenterY + Math.sin(angle) * r2);
    ctx.stroke();
  }

  // 바늘 고속 회전 (3바퀴 = 6 * PI)
  const spinAngle = progress * Math.PI * 6;
  const minuteAngle = spinAngle;
  const hourAngle = spinAngle / 12;

  // 시침
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, 3.5 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX, watchCenterY);
  ctx.lineTo(centerX + Math.cos(hourAngle - Math.PI / 2) * (radius * 0.52), watchCenterY + Math.sin(hourAngle - Math.PI / 2) * (radius * 0.52));
  ctx.stroke();

  // 분침
  ctx.strokeStyle = '#f5d07d';
  ctx.lineWidth = Math.max(1.5, 2.2 * scale);
  ctx.beginPath();
  ctx.moveTo(centerX, watchCenterY);
  ctx.lineTo(centerX + Math.cos(minuteAngle - Math.PI / 2) * (radius * 0.78), watchCenterY + Math.sin(minuteAngle - Math.PI / 2) * (radius * 0.78));
  ctx.stroke();

  // 센터 핀
  ctx.fillStyle = '#f5d07d';
  ctx.beginPath();
  ctx.arc(centerX, watchCenterY, Math.round(4 * scale), 0, Math.PI * 2);
  ctx.fill();

  // 하단 날짜 표시 배지
  const fromCore = extractCoreDate(info.fromDate);
  const toCore = extractCoreDate(info.toDate);
  const displayDate = progress > 0.65 ? toCore : fromCore;

  const badgeY = watchCenterY + radius + Math.round((bothActive ? 30 : 38) * scale);
  ctx.font = `800 ${Math.round(20 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillStyle = progress > 0.65 ? '#ffffff' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayDate, centerX, badgeY);

  ctx.font = `600 ${Math.round(13 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillStyle = '#f5d07d';
  ctx.fillText(`${fromCore}  →  ${toCore}`, centerX, badgeY + Math.round(24 * scale));
  ctx.restore();
}

/* =====================================================================
 * [날짜 3번] 일력 달력 넘기기 (Tear-off Calendar)
 * ===================================================================== */
function renderDate3_CalendarPage(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  progress: number,
  bothActive: boolean
) {
  const calCenterY = bothActive ? centerY - Math.round(95 * scale) : centerY - Math.round(14 * scale);
  const cardW = Math.round((bothActive ? 220 : 260) * scale);
  const cardH = Math.round((bothActive ? 120 : 140) * scale);
  const x = centerX - cardW / 2;
  const y = calCenterY - cardH / 2;

  ctx.save();
  // 1) 밑에 깔린 새 날짜 카드 (Next Date)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, cardW, cardH, 12);
  } else {
    ctx.rect(x, y, cardW, cardH);
  }
  ctx.fill();

  // 레드 상단 헤더
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x, y, cardW, Math.round(32 * scale));
  ctx.font = `700 ${Math.round(13 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEW DATE', centerX, y + Math.round(16 * scale));

  // 새 날짜 텍스트
  const toCore = extractCoreDate(info.toDate);
  ctx.font = `900 ${Math.round(28 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(toCore, centerX, y + Math.round(76 * scale));

  // 2) 윗장 (찢겨져 날아가는 이전 날짜 카드)
  if (progress < 0.98) {
    ctx.save();
    const tearY = -progress * 130 * scale;
    const tearX = progress * 60 * scale;
    const tearRotate = progress * 0.45;
    const tearAlpha = Math.max(0, 1 - progress * 1.2);

    ctx.translate(centerX + tearX, calCenterY + tearY);
    ctx.rotate(tearRotate);
    ctx.globalAlpha = tearAlpha;

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    } else {
      ctx.rect(-cardW / 2, -cardH / 2, cardW, cardH);
    }
    ctx.fill();

    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, Math.round(32 * scale));
    ctx.font = `700 ${Math.round(13 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PREVIOUS', 0, -cardH / 2 + Math.round(16 * scale));

    const fromCore = extractCoreDate(info.fromDate);
    ctx.font = `900 ${Math.round(28 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#1e293b';
    ctx.fillText(fromCore, 0, Math.round(16 * scale));

    ctx.restore();
  }

  // 상단 바인더 링 2개
  const ringX1 = centerX - Math.round(50 * scale);
  const ringX2 = centerX + Math.round(50 * scale);
  [ringX1, ringX2].forEach((rx) => {
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(rx, y - 2, Math.round(7 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rx, y - 2, Math.round(3.5 * scale), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/* =====================================================================
 * [날짜 4번] 미니멀 매거진 에디토리얼 (Editorial Date)
 * ===================================================================== */
function renderDate4_MinimalEditorial(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  progress: number,
  bothActive: boolean
) {
  const edCenterY = bothActive ? centerY - Math.round(92 * scale) : centerY - Math.round(14 * scale);

  ctx.save();
  ctx.font = `600 ${Math.round(13 * scale)}px "Times New Roman", Georgia, serif`;
  ctx.fillStyle = '#f5d07d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(6 * scale)}px`;
  }
  ctx.fillText('CHAPTER DATE TRANSIT', centerX, edCenterY - Math.round(54 * scale));

  // 얇은 골드 구분선
  const lineW = Math.round((bothActive ? 320 : 420) * scale * Math.min(1, progress * 1.5));
  ctx.strokeStyle = 'rgba(245, 208, 125, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - lineW / 2, edCenterY - Math.round(36 * scale));
  ctx.lineTo(centerX + lineW / 2, edCenterY - Math.round(36 * scale));
  ctx.stroke();

  // 대형 타이포 전환
  const fromCore = extractCoreDate(info.fromDate);
  const toCore = extractCoreDate(info.toDate);
  const curDate = progress > 0.5 ? toCore : fromCore;

  ctx.font = `800 ${Math.round((bothActive ? 32 : 40) * scale)}px "Times New Roman", Georgia, serif`;
  ctx.fillStyle = progress > 0.5 ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(curDate, centerX, edCenterY);

  ctx.font = `500 ${Math.round(16 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${fromCore}   →   ${toCore}`, centerX, edCenterY + Math.round(42 * scale));

  ctx.restore();
}

/* =====================================================================
 * [날짜 5번] 네온 디지털 카운트다운 (Neon Digital HUD)
 * ===================================================================== */
function renderDate5_NeonDigital(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  progress: number,
  bothActive: boolean
) {
  const neonCenterY = bothActive ? centerY - Math.round(92 * scale) : centerY - Math.round(14 * scale);
  const boxW = Math.round((bothActive ? 340 : 420) * scale);
  const boxH = Math.round((bothActive ? 90 : 110) * scale);

  ctx.save();
  // 네온 사이버 프레임
  ctx.fillStyle = 'rgba(8, 8, 8, 0.9)';
  ctx.strokeStyle = progress > 0.8 ? '#10b981' : '#94a3b8';
  ctx.lineWidth = 2;
  ctx.shadowColor = progress > 0.8 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(148, 163, 184, 0.8)';
  ctx.shadowBlur = Math.round(16 * scale);

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(centerX - boxW / 2, neonCenterY - boxH / 2, boxW, boxH, 8);
  } else {
    ctx.rect(centerX - boxW / 2, neonCenterY - boxH / 2, boxW, boxH);
  }
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // HUD 라벨
  ctx.font = `700 ${Math.round(11 * scale)}px monospace`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('>> CHRONO SYNC // DIGITAL COUNTER', centerX - boxW / 2 + 14, neonCenterY - boxH / 2 + 10);

  // 글리치 숫자 롤링
  const fromCore = extractCoreDate(info.fromDate);
  const toCore = extractCoreDate(info.toDate);
  let displayText = toCore;
  if (progress < 0.8) {
    const randomSeed = Math.floor(progress * 100);
    displayText = toCore.replace(/\d/g, (d) => String((parseInt(d, 10) + randomSeed) % 10));
  }

  ctx.font = `900 ${Math.round((bothActive ? 30 : 38) * scale)}px monospace`;
  ctx.fillStyle = progress > 0.8 ? '#34d399' : '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, centerX, neonCenterY + Math.round(12 * scale));

  ctx.restore();
}

/* =====================================================================
 * [장소 1번] 로드트립 패스파인더 (Winding Dashed Route)
 * ===================================================================== */
function sampleWindingPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  t: number
): { x: number; y: number; angle: number } {
  const clamped = Math.max(0, Math.min(1, t));
  const dx = endX - startX;
  const dy = endY - startY;

  const baseX = startX + dx * clamped;
  const baseY = startY + dy * clamped;

  const waveAmplitude = 44;
  const waveOffsetY =
    Math.sin(clamped * Math.PI * 2) * waveAmplitude * Math.sin(clamped * Math.PI) -
    Math.sin(clamped * Math.PI) * 18;

  const dt = 0.008;
  const t2 = Math.min(1, clamped + dt);
  const t1 = Math.max(0, clamped - dt);
  const x2 = startX + dx * t2;
  const y2 =
    startY +
    dy * t2 +
    Math.sin(t2 * Math.PI * 2) * waveAmplitude * Math.sin(t2 * Math.PI) -
    Math.sin(t2 * Math.PI) * 18;
  const x1 = startX + dx * t1;
  const y1 =
    startY +
    dy * t1 +
    Math.sin(t1 * Math.PI * 2) * waveAmplitude * Math.sin(t1 * Math.PI) -
    Math.sin(t1 * Math.PI) * 18;

  const angle = Math.atan2(y2 - y1, x2 - x1);

  return {
    x: baseX,
    y: baseY + waveOffsetY,
    angle,
  };
}

function drawTravelVehicleIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  vehicle: 'plane' | 'car'
) {
  ctx.save();
  ctx.translate(x, y);

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
  glow.addColorStop(0, 'rgba(245, 208, 125, 0.95)');
  glow.addColorStop(0.5, 'rgba(203, 213, 225, 0.35)');
  glow.addColorStop(1, 'rgba(203, 213, 225, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  if (vehicle === 'plane') {
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(5, -3);
    ctx.lineTo(-4, -15);
    ctx.lineTo(-8, -15);
    ctx.lineTo(-3, -3);
    ctx.lineTo(-11, -2);
    ctx.lineTo(-15, -8);
    ctx.lineTo(-17, -8);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-17, 8);
    ctx.lineTo(-15, 8);
    ctx.lineTo(-11, 2);
    ctx.lineTo(-3, 3);
    ctx.lineTo(-8, 15);
    ctx.lineTo(-4, 15);
    ctx.lineTo(5, 3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.rotate(angle * 0.45);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#f5d07d';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-11, -1, 22, 7, 3);
    } else {
      ctx.rect(-11, -1, 22, 7);
    }
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-7, -1);
    ctx.lineTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(8, -1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f5d07d';
    ctx.beginPath();
    ctx.arc(-6, 6, 3.2, 0, Math.PI * 2);
    ctx.arc(6, 6, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function renderLocation1_WindingRoute(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  targetWidth: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  routeProgress: number,
  destPulse: number,
  bothActive: boolean
) {
  const mapCenterY = bothActive ? centerY + Math.round(115 * scale) : centerY + Math.round(6 * scale);
  const routeSpanW = Math.min(620 * scale, targetWidth * 0.52);
  const startX = centerX - routeSpanW / 2;
  const endX = centerX + routeSpanW / 2;
  const startY = mapCenterY + Math.round(12 * scale);
  const endY = mapCenterY - Math.round(12 * scale);

  if (!bothActive) {
    ctx.save();
    ctx.font = `700 ${Math.round(13 * scale)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(4 * scale)}px`;
    }
    ctx.fillText('LOCATION ROUTE', centerX, mapCenterY - Math.round(105 * scale));
    ctx.restore();
  }

  const sampleSteps = 64;
  ctx.save();
  ctx.beginPath();
  for (let s = 0; s <= sampleSteps; s++) {
    const pt = sampleWindingPath(startX, startY, endX, endY, s / sampleSteps);
    if (s === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = Math.max(1.5, 2.5 * scale);
  ctx.setLineDash([Math.round(6 * scale), Math.round(9 * scale)]);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  const activeSteps = Math.max(1, Math.round(sampleSteps * routeProgress));
  if (routeProgress > 0.01) {
    ctx.save();
    ctx.beginPath();
    for (let s = 0; s <= activeSteps; s++) {
      const t = Math.min(routeProgress, s / sampleSteps);
      const pt = sampleWindingPath(startX, startY, endX, endY, t);
      if (s === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = '#f5d07d';
    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.setLineDash([Math.round(10 * scale), Math.round(8 * scale)]);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(245, 208, 125, 0.55)';
    ctx.shadowBlur = Math.round(10 * scale);
    ctx.stroke();
    ctx.restore();
  }

  // 출발지 핀
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(startX, startY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(startX, startY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const fromLocLabel = info.fromLocation || '이전 장소';
  ctx.font = `700 ${bothActive ? 20 : 24}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(fromLocLabel, startX, startY + 22);

  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
  ctx.fillText('FROM', startX, startY - 26);
  ctx.restore();

  // 목적지 핀 & 펄스
  const arrived = routeProgress >= 0.95;
  ctx.save();
  if (destPulse > 0.01) {
    const pulseRadius = 12 + destPulse * 34;
    const pulseAlpha = Math.max(0, (1 - destPulse) * 0.75);
    ctx.strokeStyle = `rgba(203, 213, 225, ${pulseAlpha.toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(endX, endY, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const pinColor = arrived ? '#cbd5e1' : '#64748b';
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = pinColor;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(endX, endY, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = arrived ? '#f5d07d' : '#94a3b8';
  ctx.beginPath();
  ctx.arc(endX, endY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  const toLocLabel = info.toLocation || '다음 장소';
  ctx.font = `800 ${bothActive ? 22 : 28}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
  ctx.fillStyle = arrived ? '#ffffff' : 'rgba(226, 232, 240, 0.65)';
  if (arrived) {
    ctx.shadowColor = 'rgba(203, 213, 225, 0.5)';
    ctx.shadowBlur = 14;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(toLocLabel, endX, endY + 22);
  ctx.shadowColor = 'transparent';

  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
  ctx.fillStyle = arrived ? '#cbd5e1' : 'rgba(148, 163, 184, 0.7)';
  ctx.fillText('TO', endX, endY - 28);
  ctx.restore();

  // 이동 차량/비행기
  const currentPos = sampleWindingPath(startX, startY, endX, endY, routeProgress);
  drawTravelVehicleIcon(ctx, currentPos.x, currentPos.y, currentPos.angle, info.travelVehicle);
}

/* =====================================================================
 * [장소 2번] 3D 와이어프레임 지구본 & 포물선 아크 (Globe Arc)
 * ===================================================================== */
function renderLocation2_GlobeSpin(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  routeProgress: number,
  destPulse: number,
  bothActive: boolean
) {
  const globeCenterY = bothActive ? centerY + Math.round(110 * scale) : centerY + Math.round(6 * scale);
  const globeR = Math.round((bothActive ? 55 : 75) * scale);

  ctx.save();
  // 1) 지구본 와이어프레임 구체
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(centerX, globeCenterY, globeR, 0, Math.PI * 2);
  ctx.stroke();

  // 회전하는 경도선
  const rot = routeProgress * 0.8;
  for (let i = -2; i <= 2; i++) {
    const rx = Math.cos(rot + (i * Math.PI) / 4) * globeR;
    ctx.beginPath();
    ctx.ellipse(centerX, globeCenterY, Math.abs(rx), globeR, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 위도선
  for (let j = -2; j <= 2; j++) {
    const yOff = (j * globeR) / 3;
    const rAtY = Math.sqrt(Math.max(0, globeR * globeR - yOff * yOff));
    ctx.beginPath();
    ctx.ellipse(centerX, globeCenterY + yOff, rAtY, rAtY * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2) 포물선 비행 아크 (좌측 출발지 -> 우측 목적지)
  const arcSpanX = globeR * 1.8;
  const startX = centerX - arcSpanX / 2;
  const endX = centerX + arcSpanX / 2;
  const arcPeakY = globeCenterY - globeR - Math.round(25 * scale);

  // 포물선 점선 가이드
  ctx.strokeStyle = 'rgba(245, 208, 125, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(startX, globeCenterY);
  ctx.quadraticCurveTo(centerX, arcPeakY, endX, globeCenterY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 아크 위를 날아가는 비행기
  const t = routeProgress;
  const currentX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * centerX + t * t * endX;
  const currentY = (1 - t) * (1 - t) * globeCenterY + 2 * (1 - t) * t * arcPeakY + t * t * globeCenterY;
  drawTravelVehicleIcon(ctx, currentX, currentY, t < 0.5 ? -0.4 : 0.4, 'plane');

  // 좌우 장소 라벨
  ctx.font = `700 ${Math.round(18 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText(info.fromLocation || '출발지', startX - 16, globeCenterY);

  ctx.fillStyle = routeProgress >= 0.95 ? '#cbd5e1' : '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText(info.toLocation || '도착지', endX + 16, globeCenterY);

  ctx.restore();
}

/* =====================================================================
 * [장소 3번] 보딩패스 티켓 & 도착 스탬프 (Boarding Pass & Stamp)
 * ===================================================================== */
function renderLocation3_BoardingPass(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  routeProgress: number,
  bothActive: boolean
) {
  const passCenterY = bothActive ? centerY + Math.round(112 * scale) : centerY + Math.round(10 * scale);
  const ticketW = Math.round((bothActive ? 420 : 520) * scale);
  const ticketH = Math.round((bothActive ? 110 : 130) * scale);
  const x = centerX - ticketW / 2;
  const y = passCenterY - ticketH / 2;

  ctx.save();
  // 티켓 배경
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, ticketW, ticketH, 12);
  } else {
    ctx.rect(x, y, ticketW, ticketH);
  }
  ctx.fill();
  ctx.stroke();

  // 좌우 절취 홈
  ctx.fillStyle = '#070707';
  ctx.beginPath();
  ctx.arc(x, passCenterY, 12 * scale, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + ticketW, passCenterY, 12 * scale, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.fill();

  // 상단 헤더
  ctx.font = `700 ${Math.round(10 * scale)}px monospace`;
  ctx.fillStyle = '#f5d07d';
  ctx.textAlign = 'left';
  ctx.fillText('BOARDING PASS // TICKET', x + 24 * scale, y + 20 * scale);

  // FROM / TO
  const fromLoc = info.fromLocation || 'ORIGIN';
  const toLoc = info.toLocation || 'DESTINATION';

  ctx.font = `800 ${Math.round(24 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(fromLoc, x + 30 * scale, passCenterY + 4 * scale);

  ctx.textAlign = 'right';
  ctx.fillText(toLoc, x + ticketW - 30 * scale, passCenterY + 4 * scale);

  // 중앙 화살표/비행기
  ctx.font = `700 ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.fillText('✈ ───→', centerX, passCenterY + 4 * scale);

  // 붉은색 고무도장 쾅! (ARRIVED Stamp)
  if (routeProgress >= 0.7) {
    ctx.save();
    const stampProg = Math.min(1, (routeProgress - 0.7) / 0.2);
    const stampScale = 1.5 - stampProg * 0.5;
    ctx.translate(x + ticketW - 60 * scale, passCenterY + 4 * scale);
    ctx.rotate(-0.25);
    ctx.scale(stampScale, stampScale);
    ctx.globalAlpha = stampProg;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-45 * scale, -16 * scale, 90 * scale, 32 * scale, 4);
    } else {
      ctx.rect(-45 * scale, -16 * scale, 90 * scale, 32 * scale);
    }
    ctx.stroke();

    ctx.font = `900 ${Math.round(13 * scale)}px sans-serif`;
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ARRIVED', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

/* =====================================================================
 * [장소 4번] 미니멀 매거진 에디토리얼 장소 (Editorial Location)
 * ===================================================================== */
function renderLocation4_MinimalEditorial(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  routeProgress: number,
  bothActive: boolean
) {
  const edCenterY = bothActive ? centerY + Math.round(115 * scale) : centerY + Math.round(10 * scale);

  ctx.save();
  ctx.font = `600 ${Math.round(12 * scale)}px "Times New Roman", Georgia, serif`;
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(5 * scale)}px`;
  }
  ctx.fillText('NEXT DESTINATION', centerX, edCenterY - Math.round(40 * scale));

  const fromLoc = info.fromLocation || '출발지';
  const toLoc = info.toLocation || '도착지';

  ctx.font = `700 ${Math.round((bothActive ? 24 : 32) * scale)}px "Times New Roman", Georgia, serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${fromLoc}   ───→   ${toLoc}`, centerX, edCenterY);

  // 하단 진행선
  const lineW = Math.round(300 * scale * routeProgress);
  ctx.strokeStyle = '#f5d07d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - lineW / 2, edCenterY + Math.round(32 * scale));
  ctx.lineTo(centerX + lineW / 2, edCenterY + Math.round(32 * scale));
  ctx.stroke();

  ctx.restore();
}

/* =====================================================================
 * [장소 5번] GPS 내비게이션 & 네온 HUD (GPS Cyber Navigation)
 * ===================================================================== */
function renderLocation5_GpsCyber(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number,
  info: ChapterBridgeTransitionInfo,
  routeProgress: number,
  destPulse: number,
  bothActive: boolean
) {
  const gpsCenterY = bothActive ? centerY + Math.round(112 * scale) : centerY + Math.round(8 * scale);
  const hudW = Math.round((bothActive ? 480 : 580) * scale);
  const hudH = Math.round((bothActive ? 120 : 140) * scale);
  const x = centerX - hudW / 2;
  const y = gpsCenterY - hudH / 2;

  ctx.save();
  // 1) HUD 반투명 하우징 & 사이안 보더
  ctx.fillStyle = 'rgba(8, 8, 8, 0.88)';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(148, 163, 184, 0.45)';
  ctx.shadowBlur = Math.round(14 * scale);

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, hudW, hudH, 8);
  } else {
    ctx.rect(x, y, hudW, hudH);
  }
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // 2) 3D 투시 원근 도로 그리드 (소실점으로 모이는 도로선)
  const vanishX = centerX;
  const vanishY = y + Math.round(18 * scale);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  const gridL = x + Math.round(40 * scale);
  const gridR = x + hudW - Math.round(40 * scale);
  const roadBotY = y + hudH - Math.round(24 * scale);

  for (let g = 0; g <= 4; g++) {
    const rx = gridL + ((gridR - gridL) * g) / 4;
    ctx.beginPath();
    ctx.moveTo(vanishX, vanishY);
    ctx.lineTo(rx, roadBotY);
    ctx.stroke();
  }

  // 3) 내비게이션 경로 셰브론 화살표 질주 (>> >> >>)
  const chevronCount = 5;
  const arrived = routeProgress >= 0.95;
  for (let c = 0; c < chevronCount; c++) {
    const cT = ((routeProgress * 2 + c / chevronCount) % 1);
    const cY = vanishY + (roadBotY - vanishY) * cT;
    const cSpan = Math.round((20 + cT * 40) * scale);
    ctx.strokeStyle = arrived ? '#10b981' : '#cbd5e1';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale * cT);
    ctx.beginPath();
    ctx.moveTo(vanishX - cSpan, cY - 4);
    ctx.lineTo(vanishX, cY);
    ctx.lineTo(vanishX + cSpan, cY - 4);
    ctx.stroke();
  }

  // 4) 상단 내비 상태 안내 문구
  ctx.font = `700 ${Math.round(11 * scale)}px monospace`;
  ctx.fillStyle = arrived ? '#34d399' : '#cbd5e1';
  ctx.textAlign = 'left';
  ctx.fillText(
    arrived ? '>> DESTINATION ARRIVED // ROUTE COMPLETE' : '>> GPS ROUTE RE-CALCULATING...',
    x + 18,
    y + 16
  );

  // 5) 출발지 -> 도착지 대형 안내판
  const fromLoc = info.fromLocation || 'CURRENT';
  const toLoc = info.toLocation || 'TARGET';

  ctx.font = `700 ${Math.round(16 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.textAlign = 'left';
  ctx.fillText(`FROM: ${fromLoc}`, x + 24 * scale, y + hudH - Math.round(18 * scale));

  ctx.font = `900 ${Math.round((bothActive ? 20 : 24) * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = arrived ? '#ffffff' : '#cbd5e1';
  ctx.textAlign = 'right';
  ctx.fillText(`TO: ${toLoc}`, x + hudW - 24 * scale, y + hudH - Math.round(18 * scale));

  // 타깃 크로스헤어
  if (arrived || destPulse > 0.05) {
    ctx.save();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vanishX, vanishY + 12, 10 + destPulse * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * HyperFrames 결정론적 타임라인 컨트롤러 (총 2.2초)
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
    stageAlpha: 0,
    stageY: 20,
    flipProgress: 0,
    routeProgress: 0,
    destPulse: 0,
  };

  const tl = gsap.timeline({ paused: true });

  // 1. 5단 루버 와이프 인 (0.00s ~ 0.32s)
  tl.to(state, { prevBgScale: 1.04, duration: 0.34, ease: 'power2.in' }, 0);

  const closeKeys: Array<keyof BridgeGsapState> = ['s0Close', 's1Close', 's2Close', 's3Close', 's4Close'];
  closeKeys.forEach((key, idx) => {
    tl.to(
      state,
      {
        [key]: 1,
        duration: 0.21,
        ease: 'expo.out',
      },
      idx * 0.028
    );
  });

  // 2. 메인 스테이지 등장 (0.28s ~ 0.50s)
  tl.to(
    state,
    {
      stageAlpha: 1,
      stageY: 0,
      duration: 0.24,
      ease: 'power3.out',
    },
    0.28
  );

  // 3. 날짜 플립 & 장소 이동 애니메이션 (0.68s ~ 1.48s)
  tl.to(
    state,
    {
      flipProgress: 1,
      duration: 0.78,
      ease: 'power2.inOut',
    },
    0.68
  );

  tl.to(
    state,
    {
      routeProgress: 1,
      duration: 0.82,
      ease: 'power2.inOut',
    },
    0.66
  );

  tl.to(
    state,
    {
      destPulse: 1,
      duration: 0.36,
      ease: 'power2.out',
    },
    1.42
  );

  // 4. 스테이지 수렴 (1.76s ~ 1.90s)
  tl.to(
    state,
    {
      stageAlpha: 0,
      stageY: -18,
      duration: 0.15,
      ease: 'power2.in',
    },
    1.76
  );

  // 5. 5단 루버 와이프 아웃 (1.86s ~ 2.20s)
  const openKeys: Array<keyof BridgeGsapState> = ['s0Open', 's1Open', 's2Open', 's3Open', 's4Open'];
  openKeys.forEach((key, idx) => {
    tl.to(
      state,
      {
        [key]: 1,
        duration: 0.22,
        ease: 'expo.inOut',
      },
      1.86 + idx * 0.03
    );
  });

  tl.to(
    state,
    {
      nextBgScale: 1.0,
      duration: 0.42,
      ease: 'power2.out',
    },
    1.78
  );

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

      // 기저 비디오 프레임
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
        ctx.fillStyle = '#070707';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      const scale = targetWidth / 1280;

      // 5단 사선 루버 블라인드
      const closes = [state.s0Close, state.s1Close, state.s2Close, state.s3Close, state.s4Close];
      const opens = [state.s0Open, state.s1Open, state.s2Open, state.s3Open, state.s4Open];
      const sliceH = Math.ceil(targetHeight / SLICE_COUNT) + 2;
      const slant = Math.round(90 * scale);
      const totalSpanW = targetWidth + slant * 2;

      for (let i = 0; i < SLICE_COUNT; i++) {
        const cProg = Math.max(0, Math.min(1, closes[i]));
        const oProg = Math.max(0, Math.min(1, opens[i]));
        if (cProg <= 0.001 || oProg >= 0.999) continue;

        const yTop = i * Math.floor(targetHeight / SLICE_COUNT) - 1;
        const yBot = yTop + sliceH;

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

        const bladeGrad = ctx.createLinearGradient(0, yTop, targetWidth, yBot);
        if (i % 2 === 0) {
          bladeGrad.addColorStop(0, '#0a0a0a');
          bladeGrad.addColorStop(0.5, '#0f0f0f');
          bladeGrad.addColorStop(1, '#080808');
        } else {
          bladeGrad.addColorStop(0, '#0b0b0b');
          bladeGrad.addColorStop(0.5, '#121212');
          bladeGrad.addColorStop(1, '#0a0a0a');
        }
        ctx.fillStyle = bladeGrad;
        ctx.fill();

        if (i > 0 && cProg > 0.2 && oProg < 0.8) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, startX), yTop + 1);
          ctx.lineTo(Math.min(targetWidth, endX), yTop + 1);
          ctx.stroke();
        }

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

      // 메인 연출 스테이지
      if (state.stageAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, state.stageAlpha));
        ctx.translate(0, state.stageY);

        const centerX = targetWidth / 2;
        const centerY = targetHeight / 2;

        const ambGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          10,
          centerX,
          centerY,
          targetWidth * 0.45
        );
        ambGrad.addColorStop(0, 'rgba(245, 208, 125, 0.09)');
        ambGrad.addColorStop(0.5, 'rgba(203, 213, 225, 0.05)');
        ambGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ambGrad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const showDateSection = info.isDateChanged;
        const showLocationSection = info.isLocationChanged;
        const bothActive = showDateSection && showLocationSection;

        // [A] 날짜 변경 연출 (선택된 템플릿에 따라 분기)
        if (showDateSection) {
          switch (info.dateTemplate) {
            case 'watch-spin':
              renderDate2_WatchSpin(ctx, centerX, centerY, scale, info, state.flipProgress, bothActive);
              break;
            case 'calendar-page':
              renderDate3_CalendarPage(ctx, centerX, centerY, scale, info, state.flipProgress, bothActive);
              break;
            case 'minimal-editorial':
              renderDate4_MinimalEditorial(ctx, centerX, centerY, scale, info, state.flipProgress, bothActive);
              break;
            case 'neon-digital':
              renderDate5_NeonDigital(ctx, centerX, centerY, scale, info, state.flipProgress, bothActive);
              break;
            case 'flip-clock':
            default:
              renderDate1_FlipClock(ctx, centerX, centerY, scale, info, state.flipProgress, bothActive);
              break;
          }
        }

        // [B] 장소 변경 연출 (선택된 템플릿에 따라 분기)
        if (showLocationSection) {
          switch (info.locationTemplate) {
            case 'globe-spin':
              renderLocation2_GlobeSpin(ctx, centerX, centerY, scale, info, state.routeProgress, state.destPulse, bothActive);
              break;
            case 'boarding-pass':
              renderLocation3_BoardingPass(ctx, centerX, centerY, scale, info, state.routeProgress, bothActive);
              break;
            case 'minimal-editorial':
              renderLocation4_MinimalEditorial(ctx, centerX, centerY, scale, info, state.routeProgress, bothActive);
              break;
            case 'gps-cyber':
              renderLocation5_GpsCyber(ctx, centerX, centerY, scale, info, state.routeProgress, state.destPulse, bothActive);
              break;
            case 'winding-route':
            default:
              renderLocation1_WindingRoute(ctx, centerX, centerY, targetWidth, scale, info, state.routeProgress, state.destPulse, bothActive);
              break;
          }
        }

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
