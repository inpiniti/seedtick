// src/services/hyperframesBridgeRenderer.ts - HyperFrames (GSAP deterministic seekable timeline)
// Split-Flap Flip Clock (Date Change) & Winding Dashed Route Travel (Location Change) Renderer

import gsap from 'gsap';
import type { HighlightSegment, VideoOverlayOptions } from '../types/video.ts';

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
    // 위경도 차이가 약 2.2도(약 220km) 이상이면 비행기 연출
    if (Math.hypot(dLat, dLon) > 2.2) {
      return 'plane';
    }
  }
  return 'car';
}

/**
 * 브릿지 발동 규칙:
 * 원본 영상(sourceVideoId)만 바뀐 경우에는 브릿지를 삽입하지 않고 계속 진행!
 * 오직 이전 클립과 비교하여 날짜(subtitleDate) 또는 장소(locationName)가 실제로 변경되었을 때만 발동합니다.
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
      travelVehicle: 'car',
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

  // 요구사항: 원본 영상만 바뀐 경우는 전환 영상 없이 계속 진행. 오직 날짜 또는 장소가 바뀐 경우만!
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
  // 5단 사선 루버 블라인드 개폐
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
  // 컨텐츠 마스터 등장/퇴장
  stageAlpha: number;
  stageY: number;
  // 플립 탁상시계(Split-Flap) 진행률 (0: 이전 날짜 정지 -> 0~1: 플립 회전 -> 1: 새 날짜 정지)
  flipProgress: number;
  // 구불구불한 점선 경로(Winding Route) 이동 진행률 (0: 출발지 대기 -> 0~1: 이동 -> 1: 도착지 도착)
  routeProgress: number;
  destPulse: number;
}

/**
 * 2차/3차 구불구불한 경로(Winding S-Curve) 위의 좌표(x, y)와 접선 각도(angle)를 계산합니다.
 * 너무 직선이 아닌 지도 위 여행 경로처럼 완만한 S자 곡선을 형성합니다.
 */
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

  // 기본 선형 보간 + 1.5주기의 사인파 곡률로 자연스럽게 구불구불한 여행 궤적 생성
  const baseX = startX + dx * clamped;
  const baseY = startY + dy * clamped;

  // 시작점(t=0)과 끝점(t=1)에서는 정확히 0이 되는 엔벨로프(sin(pi * t))와 S자 굴곡 결합
  const waveAmplitude = 44;
  const waveOffsetY =
    Math.sin(clamped * Math.PI * 2) * waveAmplitude * Math.sin(clamped * Math.PI) -
    Math.sin(clamped * Math.PI) * 18;

  // 미분값(접선 기울기)을 수치적으로 계산하여 자동차/비행기 진행 방향 회전각 산출
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

/**
 * 아날로그 플립 탁상시계(Split-Flap) 단일 타일 렌더링 헬퍼
 * - 상단/하단 분할 베젤, 좌우 회전축 홈, 3D 플립 리프(Leaf) 애니메이션을 그립니다.
 */
function drawSplitFlapTile(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  tileW: number,
  tileH: number,
  fromChar: string,
  toChar: string,
  charFlipProgress: number // 0 ~ 1
) {
  const x = centerX - tileW / 2;
  const y = centerY - tileH / 2;
  const halfH = tileH / 2;
  const radius = 8;

  // 구분자('.', '-', ' ')는 플립 타일 대신 깔끔한 콜론/도트로 표시
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

  // 글자가 바뀌지 않은 자리는 고정 플립 타일로 유지하되 미세한 입체감만 부여
  const isSameChar = fromChar === toChar;
  const totalSteps = isSameChar ? 1 : 4; // 바뀌는 숫자는 드르륵 4번 넘어가며 목표 숫자로 안착!
  const scaledProg = Math.max(0, Math.min(0.9999, charFlipProgress)) * totalSteps;
  const stepIndex = Math.floor(scaledProg);
  const localFlap = isSameChar ? 0 : scaledProg - stepIndex; // 현재 1장 넘어가는 0~1 위상

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

    // 플립 타일 배경
    const bgGrad = ctx.createLinearGradient(x, y, x, y + tileH);
    if (half === 'top') {
      bgGrad.addColorStop(0, '#1e2638');
      bgGrad.addColorStop(0.5, '#151b28');
      bgGrad.addColorStop(1, '#111622');
    } else {
      bgGrad.addColorStop(0, '#141a26');
      bgGrad.addColorStop(1, '#1c2436');
    }
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, tileW, tileH, radius);
    } else {
      ctx.rect(x, y, tileW, tileH);
    }
    ctx.fill();

    // 타일 테두리
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 텍스트 렌더링
    ctx.font = `900 ${Math.round(tileH * 0.66)}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace`;
    ctx.fillStyle = charFlipProgress >= 0.995 ? '#ffffff' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(charToDraw, centerX, centerY + 2);

    // 3D 플립 회전 음영 오버레이
    if (brightness < 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - brightness).toFixed(3)})`;
      ctx.fillRect(x, y, tileW, tileH);
    } else if (brightness > 1) {
      ctx.fillStyle = `rgba(255, 255, 255, ${((brightness - 1) * 0.35).toFixed(3)})`;
      ctx.fillRect(x, y, tileW, tileH);
    }

    ctx.restore();
  };

  // 1) 베이스 레이어:
  // 위쪽 절반에는 이미 새로 드러나는 nextChar의 상단이 깔려 있고,
  // 아래쪽 절반에는 아직 덮이기 전인 currentChar의 하단이 깔려 있음
  if (!isSameChar && charFlipProgress > 0.005 && charFlipProgress < 0.995) {
    drawHalfCard('top', nextChar, 1, 0.92);
    drawHalfCard('bottom', currentChar, 1, 0.95);

    // 2) 회전하는 플립 날개(Flap Leaf):
    // localFlap 0.0 ~ 0.5: 위쪽 currentChar 날개가 앞으로 숙여지며 내려옴 (scaleY: 1 -> 0)
    // localFlap 0.5 ~ 1.0: 아래쪽 nextChar 날개가 수평선에서 아래로 펼쳐짐 (scaleY: 0 -> 1)
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

  // 3) 중앙 스플릿 힌지(Hinge) 분할선 & 양옆 금속 핀 디테일
  ctx.save();
  ctx.fillStyle = '#07090e';
  ctx.fillRect(x, centerY - 1.2, tileW, 2.4);

  // 좌우 작은 힌지 노치
  ctx.fillStyle = 'rgba(245, 208, 125, 0.55)';
  ctx.fillRect(x + 1, centerY - 3, 2.5, 6);
  ctx.fillRect(x + tileW - 3.5, centerY - 3, 2.5, 6);
  ctx.restore();
}

/**
 * 이동 수단 아이콘(자동차 / 비행기) 벡터 드로잉 헬퍼
 */
function drawTravelVehicleIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  vehicle: 'plane' | 'car'
) {
  ctx.save();
  ctx.translate(x, y);

  // glowing aura around moving vehicle
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
  glow.addColorStop(0, 'rgba(245, 208, 125, 0.95)');
  glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
  glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  if (vehicle === 'plane') {
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;

    // 세련된 제트 비행기 실루엣 (오른쪽 +X 방향 기준)
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
    // 자동차는 곡선 기울기를 절반만 반영하여 뒤집히지 않고 귀엽고 세련되게 주행
    ctx.rotate(angle * 0.45);

    // 원형 메달리온 배지 위에 미니멀 투어링 카 아이콘
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
    // 차체 루프 + 바디
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

    // 바퀴 2개
    ctx.fillStyle = '#f5d07d';
    ctx.beginPath();
    ctx.arc(-6, 6, 3.2, 0, Math.PI * 2);
    ctx.arc(6, 6, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * HyperFrames 결정론적 타임라인 컨트롤러 (총 2.2초)
 * - 0.00s ~ 0.32s: 5단 사선 루버 블라인드가 이전 장면을 샤-샤-샤-샥 덮음
 * - 0.32s ~ 0.68s: [인지 홀드 1] 이전 날짜 / 출발지 장소를 또렷하게 보여줌
 * - 0.68s ~ 1.48s: [핵심 애니메이션] 플립 탁상시계가 탁-탁-탁 넘어가거나, 구불구불한 점선 궤적을 따라 아이콘이 목적지로 이동
 * - 1.48s ~ 1.84s: [인지 홀드 2] 바뀐 새 날짜 / 도착지 장소를 확실히 각인
 * - 1.84s ~ 2.20s: 5단 사선 루버 블라인드가 샤-샤-샤-샥 걷히며 다음 장면 등장
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

  // 2. 스테이지 등장 (0.28s ~ 0.50s) -> 0.68s까지 "이전 날짜 / 출발지"가 그대로 유지되어 사용자가 먼저 인지!
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

  // 3. 플립 탁상시계 회전 & 구불구불 점선 이동 (0.68s ~ 1.48s, 충분한 0.8초 동안 또렷하게 연출!)
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

  // 목적지 도착 시 핀 파동 펄스 (1.42s ~ 1.78s)
  tl.to(
    state,
    {
      destPulse: 1,
      duration: 0.36,
      ease: 'power2.out',
    },
    1.42
  );

  // 4. 새 날짜/장소 충분히 인지(1.48s ~ 1.78s) 후 스테이지 수렴 (1.76s ~ 1.90s)
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

  // 5. 5단 루버 와이프 아웃 (1.86s ~ 2.20s) - 샤-샤-샤-샥 열리며 다음 장면 등장
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

      // 1. 기저 비디오 프레임 (0.45초 전까지는 이전 장면 유지, 이후 다음 장면 대기)
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

      // 2. 5단 사선 루버 블라인드(Staggered Louver Blades)
      const closes = [state.s0Close, state.s1Close, state.s2Close, state.s3Close, state.s4Close];
      const opens = [state.s0Open, state.s1Open, state.s2Open, state.s3Open, state.s4Open];
      const sliceH = Math.ceil(targetHeight / SLICE_COUNT) + 2;
      const slant = 90;
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

      // 3. 메인 연출 스테이지 (날짜 플립 탁상시계 / 장소 구불구불 점선 이동)
      if (state.stageAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, state.stageAlpha));
        ctx.translate(0, state.stageY);

        const centerX = targetWidth / 2;
        const centerY = targetHeight / 2;

        // 은은한 라디얼 배경 글로우
        const ambGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          10,
          centerX,
          centerY,
          targetWidth * 0.45
        );
        ambGrad.addColorStop(0, 'rgba(245, 208, 125, 0.09)');
        ambGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
        ambGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ambGrad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const showDateSection = info.isDateChanged;
        const showLocationSection = info.isLocationChanged;
        const bothActive = showDateSection && showLocationSection;

        // ---------------------------------------------------------------------
        // [A] 날짜 변경 연출: 아날로그 스플릿 플립 탁상시계 (Split-Flap Flip Clock)
        // ---------------------------------------------------------------------
        if (showDateSection) {
          const clockCenterY = bothActive ? centerY - 95 : centerY - 12;

          // 상단 미니멀 라벨
          ctx.save();
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.fillStyle = '#f5d07d';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if ('letterSpacing' in ctx) {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
          }
          ctx.fillText('DATE CHANGE', centerX, clockCenterY - (bothActive ? 68 : 84));
          ctx.restore();

          // 나이 괄호 등 부가 텍스트는 분리하고 핵심 날짜 문자열을 플립 타일로 구성
          const extractCoreDate = (raw: string) => {
            const match = raw.match(/^([^\(\[]+)/);
            return (match ? match[1] : raw).trim();
          };
          const extractSuffix = (raw: string) => {
            const match = raw.match(/([\([].+)$/);
            return match ? match[1].trim() : '';
          };

          const fromCore = extractCoreDate(info.fromDate);
          const toCore = extractCoreDate(info.toDate);
          const maxLen = Math.max(fromCore.length, toCore.length);
          const paddedFrom = fromCore.padEnd(maxLen, ' ');
          const paddedTo = toCore.padEnd(maxLen, ' ');

          const tileH = bothActive ? 74 : 92;
          const digitW = bothActive ? 50 : 62;
          const punctW = bothActive ? 22 : 26;
          const gap = 6;

          const charWidths = paddedTo.split('').map((ch) =>
            /[0-9A-Za-z가-힣]/.test(ch) ? digitW : punctW
          );
          const totalClockW =
            charWidths.reduce((acc, w) => acc + w, 0) + Math.max(0, maxLen - 1) * gap;

          // 플립 시계 하우징 프레임 (실제 탁상시계 같은 묵직한 메탈릭 베젤)
          const framePadX = 22;
          const framePadY = 14;
          ctx.save();
          ctx.fillStyle = 'rgba(7, 10, 16, 0.85)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 8;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(
              centerX - totalClockW / 2 - framePadX,
              clockCenterY - tileH / 2 - framePadY,
              totalClockW + framePadX * 2,
              tileH + framePadY * 2,
              16
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

          // 각 자리별 스태거를 적용해 왼쪽부터 오른쪽으로 드르륵 착! 착! 착! 넘어가는 플립 렌더링
          let cursorX = centerX - totalClockW / 2;
          for (let i = 0; i < maxLen; i++) {
            const w = charWidths[i];
            const tileCenterX = cursorX + w / 2;
            const staggerOffset = (i / Math.max(1, maxLen - 1)) * 0.28;
            const localProg = Math.max(
              0,
              Math.min(1, (state.flipProgress - staggerOffset) / (1 - 0.28))
            );

            drawSplitFlapTile(
              ctx,
              tileCenterX,
              clockCenterY,
              w,
              tileH,
              paddedFrom[i],
              paddedTo[i],
              localProg
            );
            cursorX += w + gap;
          }

          // 플립 시계 아래에 "이전 날짜 → 새 날짜" 비교 표시 (사용자가 전/후 날짜를 한눈에 인지!)
          const fromSuffix = extractSuffix(info.fromDate);
          const toSuffix = extractSuffix(info.toDate);
          const summaryY = clockCenterY + tileH / 2 + (bothActive ? 34 : 46);

          ctx.save();
          ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace';
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

          ctx.fillStyle = state.flipProgress > 0.75 ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
          ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Pretendard Variable", monospace';
          ctx.fillText(rightLabel, startSumX + leftW + arrowW, summaryY);
          ctx.restore();
        }

        // ---------------------------------------------------------------------
        // [B] 장소 변경 연출: 구불구불한 점선 경로(Winding Dashed Route) + 자동차/비행기 이동
        // ---------------------------------------------------------------------
        if (showLocationSection) {
          const mapCenterY = bothActive ? centerY + 115 : centerY + 6;
          const routeSpanW = Math.min(620, targetWidth * 0.52);
          const startX = centerX - routeSpanW / 2;
          const endX = centerX + routeSpanW / 2;
          const startY = mapCenterY + 12;
          const endY = mapCenterY - 12;

          // 상단 미니멀 라벨 (장소 단독 변경 시에만 상단 표시)
          if (!bothActive) {
            ctx.save();
            ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if ('letterSpacing' in ctx) {
              (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
            }
            ctx.fillText('LOCATION ROUTE', centerX, mapCenterY - 105);
            ctx.restore();
          }

          // 1) 전체 경로의 옅은 베이스 가이드 점선
          const sampleSteps = 64;
          ctx.save();
          ctx.beginPath();
          for (let s = 0; s <= sampleSteps; s++) {
            const pt = sampleWindingPath(startX, startY, endX, endY, s / sampleSteps);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 9]);
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();

          // 2) 이동 수단이 지나간 자리에 실시간으로 생기는 밝은 샴페인 골드 구불구불 점선(Active Dashed Trail)
          const activeSteps = Math.max(1, Math.round(sampleSteps * state.routeProgress));
          if (state.routeProgress > 0.01) {
            ctx.save();
            ctx.beginPath();
            for (let s = 0; s <= activeSteps; s++) {
              const t = Math.min(state.routeProgress, (s / sampleSteps));
              const pt = sampleWindingPath(startX, startY, endX, endY, t);
              if (s === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = '#f5d07d';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 8]);
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(245, 208, 125, 0.55)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.restore();
          }

          // 3) 출발지 포인트 (Origin Pin & 이전 장소명)
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

          // 출발지 텍스트
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

          // 4) 도착지 포인트 (Destination Pin & 새 장소명 + 도착 리플 파동)
          const arrived = state.routeProgress >= 0.95;
          ctx.save();

          if (state.destPulse > 0.01) {
            const pulseRadius = 12 + state.destPulse * 34;
            const pulseAlpha = Math.max(0, (1 - state.destPulse) * 0.75);
            ctx.strokeStyle = `rgba(56, 189, 248, ${pulseAlpha.toFixed(3)})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(endX, endY, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
          }

          // 도착지 위치 마커 핀
          const pinColor = arrived ? '#38bdf8' : '#64748b';
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

          // 도착지 장소명 (도착 시 밝은 화이트 & 스케일 강조)
          const toLocLabel = info.toLocation || '다음 장소';
          ctx.font = `800 ${bothActive ? 22 : 28}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
          ctx.fillStyle = arrived ? '#ffffff' : 'rgba(226, 232, 240, 0.65)';
          if (arrived) {
            ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
            ctx.shadowBlur = 14;
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(toLocLabel, endX, endY + 22);
          ctx.shadowColor = 'transparent';

          ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.fillStyle = arrived ? '#38bdf8' : 'rgba(148, 163, 184, 0.7)';
          ctx.fillText('TO', endX, endY - 28);
          ctx.restore();

          // 5) 구불구불한 경로 위를 실제로 달리는 이동 수단(자동차/비행기) 아이콘
          const currentPos = sampleWindingPath(startX, startY, endX, endY, state.routeProgress);
          drawTravelVehicleIcon(
            ctx,
            currentPos.x,
            currentPos.y,
            currentPos.angle,
            info.travelVehicle
          );
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
