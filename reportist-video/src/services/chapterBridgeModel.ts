// src/services/chapterBridgeModel.ts - Chapter bridge 계산 로직 (GSAP 비의존)
// 프리뷰/내보내기 렌더러와 분리해 초기 번들에서 GSAP을 제거한다.
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
