// src/services/previewCompositorBase.ts - GSAP 비의존 프리뷰 컴포지터 (커버 프레임/자막 오버레이)
// Shares the exact pixel-level rendering math with videoStitcher.ts & videoStitcherWebCodecs.ts
// 가로(16:9) 좌표는 기존과 픽셀 단위로 동일하고, 세로(9:16)는 플랫폼 세이프 영역 안에 배치한다.

import type { HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';
import {
  LANDSCAPE_PREVIEW_FRAME,
  fitCanvasFontSize,
  fitTextBlock,
  overlayFont,
  type FrameSpec,
} from './frameSpec.ts';
import {
  formatDateByPattern,
  formatDateWithAge,
  getStoredBirthDate,
  getStoredDateFormat,
  getStoredShowAge,
  parseDateTimeFromString,
} from './videoMetadata.ts';

export {
  COMPOSITOR_HEIGHT,
  COMPOSITOR_WIDTH,
  LANDSCAPE_PREVIEW_FRAME,
  OVERLAY_FONT_STACK,
  previewFrame,
  resolveFrameSpec,
} from './frameSpec.ts';

function clampRatio(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/**
 * 우상단에 표시할 촬영일을 포맷한다.
 * - recordedTimestamp(ms)가 있으면 가장 우선한다.
 * - 저장된 날짜 표기 형식(기본 YYYY.MM.DD)과 아이 나이 옵션, 현재 로케일을 함께 반영한다.
 * - 파싱에 실패하면 사용자가 입력한 원문을 그대로 돌려준다.
 * 미리보기와 내보내기가 같은 함수를 공유하므로 결과물과 화면이 항상 일치한다.
 */
function formatMetaDate(raw?: string, timestamp?: number): string {
  const value = (raw || '').trim();
  let date: Date | null = null;

  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const candidate = new Date(timestamp);
    if (!Number.isNaN(candidate.getTime())) date = candidate;
  }
  if (!date && value) {
    date = parseDateTimeFromString(value)?.date ?? null;
  }
  if (!date) return value;

  const base = formatDateByPattern(date, getStoredDateFormat());
  return formatDateWithAge(base, date, getStoredShowAge(), getStoredBirthDate());
}

/** 캔버스가 그리는 날짜·위치 텍스트 한 줄의 좌표·폰트·측정 정보. */
export interface MetaOverlayLine {
  text: string;
  font: string;
  color: string;
  /** 텍스트 오른쪽 끝 x (textAlign: 'right' 기준) */
  x: number;
  /** 텍스트 상단 y (textBaseline: 'top' 기준) */
  y: number;
  fontSize: number;
  width: number;
  height: number;
}

export interface MetaOverlayLayout {
  date: MetaOverlayLine | null;
  location: MetaOverlayLine | null;
}

/**
 * 날짜·위치 문구의 캔버스 배치를 순수 계산한다(그리지 않음).
 * drawLandscapeOverlay/drawPortraitOverlay와 미리보기 히트 영역이 같은 값을 쓰도록 해
 * 실제 자막 위치와 클릭/호버 영역이 픽셀 단위로 일치한다.
 */
export function computeMetaLayoutFromTexts(
  dateText: string,
  locationText: string,
  frame: FrameSpec,
  measureCtx?: CanvasRenderingContext2D | null
): MetaOverlayLayout {
  const empty: MetaOverlayLayout = { date: null, location: null };
  const ctx = measureCtx ?? getMeasureContext();
  if (!ctx || (!dateText && !locationText)) return empty;

  const u = frame.unit;
  const lineHeight = (fontSize: number) => Math.round(fontSize * 1.26);

  if (frame.orientation === 'portrait') {
    const { safeArea } = frame;
    const maxWidth = frame.width - safeArea.left - safeArea.right;
    if (maxWidth <= 0) return empty;
    const rightX = frame.width - safeArea.right - Math.round(8 * u);
    const halfWidth = Math.max(1, Math.round(maxWidth * 0.52));
    let metaY = safeArea.top;

    let date: MetaOverlayLine | null = null;
    if (dateText) {
      const fontSize = fitCanvasFontSize(
        ctx,
        dateText,
        halfWidth,
        Math.round(14 * u),
        (size) => overlayFont('600', size),
        Math.round(10 * u)
      );
      ctx.font = overlayFont('600', fontSize);
      date = {
        text: dateText,
        font: overlayFont('600', fontSize),
        color: 'rgba(255, 255, 255, 0.94)',
        x: rightX,
        y: metaY,
        fontSize,
        width: ctx.measureText(dateText).width,
        height: lineHeight(fontSize),
      };
      metaY += Math.round(fontSize * 1.4);
    }

    let location: MetaOverlayLine | null = null;
    if (locationText) {
      const fontSize = fitCanvasFontSize(
        ctx,
        locationText,
        halfWidth,
        Math.round(18 * u),
        (size) => overlayFont('bold', size),
        Math.round(11 * u)
      );
      ctx.font = overlayFont('bold', fontSize);
      location = {
        text: locationText,
        font: overlayFont('bold', fontSize),
        color: '#ffffff',
        x: rightX,
        y: metaY,
        fontSize,
        width: ctx.measureText(locationText).width,
        height: lineHeight(fontSize),
      };
    }
    return { date, location };
  }

  const rightX = frame.width - Math.round(32 * u);
  let cursorY = Math.round(28 * u);
  let date: MetaOverlayLine | null = null;
  if (dateText) {
    const fontSize = Math.round(15 * u);
    ctx.font = overlayFont('600', fontSize);
    date = {
      text: dateText,
      font: overlayFont('600', fontSize),
      color: 'rgba(255, 255, 255, 0.94)',
      x: rightX,
      y: cursorY,
      fontSize,
      width: ctx.measureText(dateText).width,
      height: lineHeight(fontSize),
    };
    cursorY += Math.round(19 * u);
  }

  let location: MetaOverlayLine | null = null;
  if (locationText) {
    const fontSize = fitCanvasFontSize(
      ctx,
      locationText,
      Math.round(frame.width * 0.45),
      Math.round(19 * u),
      (size) => overlayFont('bold', size),
      Math.round(12 * u)
    );
    ctx.font = overlayFont('bold', fontSize);
    location = {
      text: locationText,
      font: overlayFont('bold', fontSize),
      color: '#ffffff',
      x: rightX,
      y: cursorY,
      fontSize,
      width: ctx.measureText(locationText).width,
      height: lineHeight(fontSize),
    };
  }
  return { date, location };
}

/** 캔버스와 미리보기가 동일한 날짜·위치 문구를 쓰도록 텍스트만 추출한다. */
export function resolveMetaTexts(
  overlayOptions: VideoOverlayOptions | undefined,
  currentSegment?: HighlightSegment
): { dateText: string; locationText: string } {
  if (!overlayOptions) return { dateText: '', locationText: '' };
  return {
    dateText:
      overlayOptions.showDate === false
        ? ''
        : formatMetaDate(
            currentSegment?.subtitleDate || overlayOptions.subtitleDateText,
            currentSegment?.recordedTimestamp
          ),
    locationText:
      overlayOptions.showLocation === false
        ? ''
        : currentSegment?.locationName || overlayOptions.subtitleLocationText || '',
  };
}

function paintRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}

/** <video> 프레임, 썸네일 <img>, WebCodecs ImageBitmap 모두 같은 크롭 수학으로 그린다. */
export type PreviewFrameSource = HTMLVideoElement | HTMLImageElement | ImageBitmap;

/** DOM 생성자에 의존하지 않고(테스트 스텁 포함) 소스의 픽셀 크기를 얻는다. */
function getPreviewSourceSize(source: PreviewFrameSource): { width: number; height: number } {
  const video = source as HTMLVideoElement;
  if (typeof video.videoWidth === 'number' && video.videoWidth > 0) {
    return { width: video.videoWidth, height: video.videoHeight };
  }
  const image = source as HTMLImageElement;
  if (typeof image.naturalWidth === 'number' && image.naturalWidth > 0) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  const bitmap = source as ImageBitmap;
  return { width: bitmap.width || 0, height: bitmap.height || 0 };
}

/**
 * 프레임(가로 16:9 / 세로 9:16)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림 (개별 90도 회전 지원)
 * - 세로 출력에서 가로 원본은 `cropOffsetXRatio`(기본 0.5)로 좌우 위치를 조정한다.
 * - 가로 출력의 기존 크롭/중앙 정렬 수학은 그대로 유지한다.
 * - <video>가 디코더를 잃었을 때 즉시 썸네일 / WebCodecs 프레임으로 같은 레이아웃을 그릴 수 있게
 *   공용 소스 타입(HTMLVideoElement | HTMLImageElement | ImageBitmap)을 받는다.
 */
export function drawCompositorCoverFrame(
  ctx: CanvasRenderingContext2D,
  video: PreviewFrameSource,
  vItem?: VideoItem,
  segment?: HighlightSegment,
  frame: FrameSpec = LANDSCAPE_PREVIEW_FRAME
): void {
  const targetWidth = frame.width;
  const targetHeight = frame.height;
  const sourceSize = getPreviewSourceSize(video);
  const rawVW = sourceSize.width || vItem?.width || targetWidth;
  const rawVH = sourceSize.height || vItem?.height || targetHeight;
  // 세그먼트에 회전 값이 없으면(AI 분석 전/레거시 프로젝트) 원본 영상의 회전을 사용한다.
  const rotation = ((segment?.rotation ?? vItem?.rotation ?? 0) % 360 + 360) % 360;

  const isSideways = rotation === 90 || rotation === 270;
  const vW = isSideways ? rawVH : rawVW;
  const vH = isSideways ? rawVW : rawVH;

  const targetAspect = targetWidth / targetHeight;
  const srcAspect = vW / vH;

  const scale = Math.max(targetWidth / vW, targetHeight / vH);
  const renderW = vW * scale;
  const renderH = vH * scale;

  // 가로 원본을 세로 프레임에 넣을 때만 좌우 오프셋을 사용자 값으로 조정 (가로 출력은 항상 중앙 = 0.5)
  const cropXRatio = frame.orientation === 'portrait' ? clampRatio(segment?.cropOffsetXRatio, 0.5) : 0.5;
  const cropYRatio = clampRatio(segment?.cropOffsetYRatio, 0.25);

  const excessWidth = Math.max(0, renderW - targetWidth);
  const offsetX = -excessWidth * cropXRatio;
  let offsetY: number;

  if (vH > vW) {
    const excessHeight = renderH - targetHeight;
    offsetY = -excessHeight * cropYRatio;
  } else {
    offsetY = (targetHeight - renderH) / 2;
  }

  try {
    if (rotation === 0) {
      let sx = 0;
      let sy = 0;
      let sWidth = rawVW;
      let sHeight = rawVH;

      if (srcAspect > targetAspect) {
        // 1) 타깃보다 좌우로 넓은 영상 — 좌우 크롭 (세로 출력에서는 X 오프셋 반영)
        sHeight = rawVH;
        sWidth = Math.round(rawVH * targetAspect);
        sx = Math.round((rawVW - sWidth) * cropXRatio);
        sy = 0;
      } else if (srcAspect < targetAspect) {
        // 2) 타깃보다 세로로 긴 영상 — 상하 크롭
        sWidth = rawVW;
        sHeight = Math.round(rawVW / targetAspect);
        sx = 0;

        if (rawVH > rawVW) {
          const excessHeight = rawVH - sHeight;
          sy = Math.round(excessHeight * cropYRatio);
        } else {
          sy = Math.round((rawVH - sHeight) / 2);
        }
      }

      // 소스 좌표 범위 안전 클램핑
      sx = Math.max(0, Math.min(sx, Math.max(0, rawVW - sWidth)));
      sy = Math.max(0, Math.min(sy, Math.max(0, rawVH - sHeight)));

      // 대상 캔버스 전체를 정확하게 채움
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    } else {
      // 90°, 180°, 270° 회전 변환 렌더링
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, targetWidth, targetHeight);
      ctx.clip();

      const centerX = offsetX + renderW / 2;
      const centerY = offsetY + renderH / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);

      ctx.drawImage(
        video,
        (-rawVW * scale) / 2,
        (-rawVH * scale) / 2,
        rawVW * scale,
        rawVH * scale
      );
      ctx.restore();
    }
  } catch {
    // Ignore transient video decode states during rapid seeks
  }
}

let sharedMeasureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (sharedMeasureCtx !== undefined) return sharedMeasureCtx;
  sharedMeasureCtx =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  return sharedMeasureCtx;
}

/** 캔버스가 실제로 그리는 자막 박스의 픽셀 좌표·폰트 정보. DOM 편집창이 같은 값을 공유한다. */
export interface SubtitleOverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  padX: number;
  padY: number;
  lines: string[];
}

/**
 * 자막 문구와 프레임으로 실제 자막 박스 좌표를 계산한다(캔버스에 그리지 않는 순수 계산).
 * 내보내기·미리보기·인라인 편집창이 이 결과를 함께 쓰므로 위치·크기·폰트가 픽셀 단위로 일치한다.
 */
export function computeSubtitleOverlayBounds(
  text: string,
  frame: FrameSpec,
  measureCtx?: CanvasRenderingContext2D | null
): SubtitleOverlayBounds | null {
  const subText = text.trim();
  if (!subText) return null;

  const ctx = measureCtx ?? getMeasureContext();
  if (!ctx) return null;

  const u = frame.unit;
  if (frame.orientation === 'portrait') {
    const { safeArea } = frame;
    const maxWidth = frame.width - safeArea.left - safeArea.right;
    if (maxWidth <= 0) return null;

    const padX = Math.round(18 * u);
    const padY = Math.round(12 * u);
    const block = fitTextBlock(
      ctx,
      subText,
      maxWidth - padX * 2,
      Math.round(22 * u),
      Math.round(13 * u),
      3,
      (size) => overlayFont('bold', size)
    );
    const lineHeight = Math.round(block.fontSize * 1.26);
    ctx.font = overlayFont('bold', block.fontSize);
    const textWidth = Math.max(...block.lines.map((line) => ctx.measureText(line).width), 0);
    const width = Math.min(maxWidth, textWidth + padX * 2);
    const height = block.lines.length * lineHeight + padY * 2;
    const x = (frame.width - width) / 2;
    const preferredY = Math.round((frame.height * 2) / 3 - height / 2);
    const y = Math.max(safeArea.top, Math.min(preferredY, frame.height - safeArea.bottom - height));
    return {
      x,
      y,
      width,
      height,
      fontSize: block.fontSize,
      lineHeight,
      padX,
      padY,
      lines: block.lines,
    };
  }

  const padX = Math.round(20 * u);
  const padY = Math.round(8 * u);
  const marginX = Math.round(32 * u);
  const subMaxWidth = Math.max(1, frame.width - marginX * 2 - padX * 2);
  const block = fitTextBlock(
    ctx,
    subText,
    subMaxWidth,
    Math.round(24 * u),
    Math.round(16 * u),
    3,
    (size) => overlayFont('bold', size)
  );
  const lineHeight = Math.round(block.fontSize * 1.26);
  ctx.font = overlayFont('bold', block.fontSize);
  const textWidth = Math.max(...block.lines.map((line) => ctx.measureText(line).width), 0);
  const width = Math.min(frame.width - marginX * 2, textWidth + padX * 2);
  const height = block.lines.length * lineHeight + padY * 2;
  const x = (frame.width - width) / 2;
  const y = frame.height - Math.round(30 * u) - height;
  return { x, y, width, height, fontSize: block.fontSize, lineHeight, padX, padY, lines: block.lines };
}

/** 캔버스가 실제로 그리는 좌상단 제목 박스의 픽셀 좌표·폰트 정보. DOM 편집창이 같은 값을 공유한다. */
export interface TitleOverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  padX: number;
  padY: number;
  lines: string[];
}

/**
 * 제목 문구와 프레임으로 좌상단 제목 박스 좌표를 계산한다(캔버스에 그리지 않는 순수 계산).
 * 미리보기 캔버스와 인라인 편집창이 같은 결과를 쓰므로 위치·크기·폰트가 픽셀 단위로 일치한다.
 */
export function computeTitleOverlayBounds(
  text: string,
  frame: FrameSpec,
  measureCtx?: CanvasRenderingContext2D | null
): TitleOverlayBounds | null {
  if (!text.trim()) return null;

  const ctx = measureCtx ?? getMeasureContext();
  if (!ctx) return null;

  const u = frame.unit;
  if (frame.orientation === 'portrait') {
    const { safeArea } = frame;
    const maxWidth = frame.width - safeArea.left - safeArea.right;
    if (maxWidth <= 0) return null;

    const padX = Math.round(14 * u);
    const padY = Math.round(10 * u);
    const block = fitTextBlock(
      ctx,
      text.trim(),
      maxWidth - padX * 2,
      Math.round(26 * u),
      Math.round(15 * u),
      2,
      (size) => overlayFont('bold', size)
    );
    const lineHeight = Math.round(block.fontSize * 1.24);
    ctx.font = overlayFont('bold', block.fontSize);
    const textWidth = Math.max(...block.lines.map((line) => ctx.measureText(line).width), 0);
    return {
      x: safeArea.left,
      y: safeArea.top,
      width: Math.min(maxWidth, textWidth + padX * 2),
      height: block.lines.length * lineHeight + padY * 2,
      fontSize: block.fontSize,
      lineHeight,
      padX,
      padY,
      lines: block.lines,
    };
  }

  const padX = Math.round(14 * u);
  const height = Math.round(38 * u);
  const fontSize = Math.round(22 * u);
  ctx.font = overlayFont('bold', fontSize);
  return {
    x: Math.round(32 * u),
    y: Math.round(28 * u),
    width: ctx.measureText(text).width + padX * 2,
    height,
    fontSize,
    lineHeight: height,
    padX,
    padY: 0,
    lines: [text],
  };
}

/** 계산된 제목 박스를 캔버스에 그린다. 가로·세로 모두 같은 그리기 규칙을 쓴다. */
function paintTitleBox(
  oCtx: CanvasRenderingContext2D,
  bounds: TitleOverlayBounds,
  frame: FrameSpec
): void {
  oCtx.save();
  oCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  paintRoundedRect(oCtx, bounds.x, bounds.y, bounds.width, bounds.height, Math.round(6 * frame.unit));
  oCtx.fill();

  oCtx.fillStyle = '#ffffff';
  oCtx.textAlign = 'left';
  oCtx.textBaseline = 'middle';
  oCtx.font = overlayFont('bold', bounds.fontSize);
  bounds.lines.forEach((line, index) => {
    oCtx.fillText(
      line,
      bounds.x + bounds.padX,
      bounds.y + bounds.padY + bounds.lineHeight * (index + 0.5)
    );
  });
  oCtx.restore();
}

/** 계산된 자막 박스를 캔버스에 그린다. 가로·세로 모두 같은 그리기 규칙을 쓴다. */
function paintSubtitleBox(
  oCtx: CanvasRenderingContext2D,
  bounds: SubtitleOverlayBounds,
  frame: FrameSpec
): void {
  oCtx.save();
  oCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  paintRoundedRect(oCtx, bounds.x, bounds.y, bounds.width, bounds.height, Math.round(8 * frame.unit));
  oCtx.fill();

  oCtx.fillStyle = '#ffffff';
  oCtx.textAlign = 'center';
  oCtx.textBaseline = 'middle';
  oCtx.font = overlayFont('bold', bounds.fontSize);
  bounds.lines.forEach((line, index) => {
    oCtx.fillText(line, frame.width / 2, bounds.y + bounds.padY + bounds.lineHeight * (index + 0.5));
  });
  oCtx.restore();
}

function drawLandscapeOverlay(
  oCtx: CanvasRenderingContext2D,
  overlayOptions: VideoOverlayOptions,
  currentSegment: HighlightSegment | undefined,
  frame: FrameSpec,
  options?: SegmentOverlayDrawOptions
): boolean {
  const u = frame.unit;
  const targetWidth = frame.width;
  const targetHeight = frame.height;
  let hasAnyOverlay = false;
  // 자막 수정 단계에서는 상단 제목·채널을 숨기고 씬 자막과 날짜·장소만 그린다.
  const showHeader = !options?.captionOnly;
  const hasTitle = showHeader && Boolean(overlayOptions.showTitle && overlayOptions.titleText?.trim());

  // 1. 좌측 상단 영상 제목 — 인라인 편집 중에는 DOM 입력창이 같은 자리를 대체하므로 캔버스에서만 숨긴다.
  if (hasTitle && !options?.hideTitle) {
    const bounds = computeTitleOverlayBounds(overlayOptions.titleText, frame, oCtx);
    if (bounds) {
      hasAnyOverlay = true;
      paintTitleBox(oCtx, bounds, frame);
    }
  }

  // 1-1. 우측 상단: 1줄차 촬영일(저장된 표기 형식·나이 반영), 2줄차 위치 — 우측 정렬.
  // Center-Stage 스튜디오의 핵심 차별화 요소이며 내보내기에도 픽셀 단위로 동일하게 반영된다.
  // 배치 계산은 computeMetaLayoutFromTexts 한 곳에 두고 미리보기 히트 영역과 공유한다.
  const { dateText, locationText } = resolveMetaTexts(overlayOptions, currentSegment);
  const metaLayout = computeMetaLayoutFromTexts(dateText, locationText, frame, oCtx);
  const metaActive = Boolean(metaLayout.date || metaLayout.location);

  if (metaActive) {
    hasAnyOverlay = true;
    oCtx.save();
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    oCtx.shadowBlur = Math.round(5 * u);
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = Math.round(1.5 * u);
    oCtx.textAlign = 'right';
    oCtx.textBaseline = 'top';

    ([metaLayout.date, metaLayout.location] as const).forEach((line) => {
      if (!line) return;
      oCtx.font = line.font;
      oCtx.fillStyle = line.color;
      oCtx.fillText(line.text, line.x, line.y);
    });
    oCtx.restore();
  }

  // 2. 우측 상단 채널 이름 — 날짜·위치가 있으면 그 아래로 내려 겹치지 않게 한다.
  if (showHeader && overlayOptions.showChannel && overlayOptions.channelText) {
    hasAnyOverlay = true;
    oCtx.save();
    oCtx.font = overlayFont('bold', 22 * u);
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    oCtx.shadowBlur = Math.round(4 * u);
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = Math.round(2 * u);
    oCtx.textAlign = 'right';
    oCtx.textBaseline = 'middle';
    oCtx.fillText(
      overlayOptions.channelText,
      targetWidth - Math.round(32 * u),
      Math.round((metaActive ? 92 : 47) * u)
    );
    oCtx.restore();
  }

  // 3. 하단 중앙 씬 제목 자막 — 실제 박스 좌표는 computeSubtitleOverlayBounds가 계산한다.
  // 인라인 편집 중에는 DOM 입력창이 같은 자리에 그려지므로 캔버스 자막만 숨긴다.
  if (overlayOptions.showSubtitle && !options?.hideSubtitle) {
    const titlePart = currentSegment?.subtitleTitle ?? currentSegment?.reason ?? '';
    const bounds = computeSubtitleOverlayBounds(titlePart, frame, oCtx);
    if (bounds) {
      hasAnyOverlay = true;
      paintSubtitleBox(oCtx, bounds, frame);
    }
  }

  return hasAnyOverlay;
}

function drawPortraitOverlay(
  oCtx: CanvasRenderingContext2D,
  overlayOptions: VideoOverlayOptions,
  currentSegment: HighlightSegment | undefined,
  frame: FrameSpec,
  options?: SegmentOverlayDrawOptions
): boolean {
  const u = frame.unit;
  const { safeArea } = frame;
  const left = safeArea.left;
  const maxWidth = frame.width - safeArea.left - safeArea.right;
  if (maxWidth <= 0) return false;

  let hasAnyOverlay = false;
  let cursorY = safeArea.top;
  const showHeader = !options?.captionOnly;

  // 1. 좌측 상단 영상 제목 (최대 2줄, 폭에 맞춰 자동 축소)
  const titleText = overlayOptions.titleText?.trim() ?? '';
  const hasTitle = showHeader && Boolean(overlayOptions.showTitle && titleText);

  if (hasTitle) {
    const bounds = computeTitleOverlayBounds(titleText, frame, oCtx);
    if (bounds) {
      // 인라인 편집 중에는 캔버스 제목만 숨기고, 아래 채널명 배치를 위한 커서는 그대로 유지한다.
      if (!options?.hideTitle) {
        hasAnyOverlay = true;
        paintTitleBox(oCtx, bounds, frame);
      }
      cursorY = bounds.y + bounds.height;
    }
  }

  // 2. 세로에서는 채널명을 우상단 대신 제목 바로 아래에 배치
  const channelText = overlayOptions.channelText?.trim() ?? '';
  if (showHeader && overlayOptions.showChannel && channelText) {
    hasAnyOverlay = true;
    const gap = hasTitle ? Math.round(10 * u) : 0;
    const preferred = Math.round(18 * u);
    const size = fitCanvasFontSize(
      oCtx,
      channelText,
      maxWidth,
      preferred,
      (fontSize) => overlayFont('bold', fontSize),
      Math.round(12 * u)
    );
    const centerY = cursorY + gap + size / 2;

    oCtx.save();
    oCtx.font = overlayFont('bold', size);
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    oCtx.shadowBlur = Math.round(4 * u);
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = Math.round(2 * u);
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'middle';
    oCtx.fillText(channelText, left, centerY);
    oCtx.restore();

    cursorY = cursorY + gap + Math.round(size * 1.3);
  }

  // 3. 우측 상단: 날짜(yyyy.mm.dd) + 위치 2줄 (세이프 영역 우측 정렬)
  // 배치 계산은 computeMetaLayoutFromTexts 한 곳에 두고 미리보기 히트 영역과 공유한다.
  const { dateText, locationText } = resolveMetaTexts(overlayOptions, currentSegment);
  const metaLayout = computeMetaLayoutFromTexts(dateText, locationText, frame, oCtx);

  if (metaLayout.date || metaLayout.location) {
    hasAnyOverlay = true;
    oCtx.save();
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    oCtx.shadowBlur = Math.round(4 * u);
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = Math.round(1.5 * u);
    oCtx.textAlign = 'right';
    oCtx.textBaseline = 'top';

    ([metaLayout.date, metaLayout.location] as const).forEach((line) => {
      if (!line) return;
      oCtx.font = line.font;
      oCtx.fillStyle = line.color;
      oCtx.fillText(line.text, line.x, line.y);
    });
    oCtx.restore();
  }

  // 4. 씬 제목 자막 — 화면 2/3 높이(세이프 영역 clamping)의 실제 박스 좌표를 공유 헬퍼로 계산한다.
  // 인라인 편집 중에는 DOM 입력창이 같은 자리에 그려지므로 캔버스 자막만 숨긴다.
  if (overlayOptions.showSubtitle && !options?.hideSubtitle) {
    const titlePart = currentSegment?.subtitleTitle ?? currentSegment?.reason ?? '';
    const bounds = computeSubtitleOverlayBounds(titlePart, frame, oCtx);
    if (bounds) {
      hasAnyOverlay = true;
      paintSubtitleBox(oCtx, bounds, frame);
    }
  }

  return hasAnyOverlay;
}

/** 스텝별 프리뷰에서 오버레이 표시 범위를 제한할 때 쓰는 옵션 */
export interface SegmentOverlayDrawOptions {
  /** true면 상단 제목·채널을 숨기고 날짜/장소 + 씬 자막만 그린다 (자막 수정 단계용) */
  captionOnly?: boolean;
  /** true면 자막 박스만 숨긴다. DOM 인라인 편집창이 같은 자리를 대체할 때 사용한다. */
  hideSubtitle?: boolean;
  /** true면 좌상단 제목 박스만 숨긴다. DOM 인라인 편집창이 같은 자리를 대체할 때 사용한다. */
  hideTitle?: boolean;
}

/**
 * 프레임 위에 좌측 상단 타이틀, 날짜/위치, 채널명, 하단 중앙(세로는 2/3 높이) 자막을 합성한다.
 * 가로 레이아웃 좌표·폰트·그림자는 기존 스티처와 100% 동일하다.
 * @returns 실제로 그린 오버레이가 하나라도 있으면 true
 */
export function drawCompositorSegmentOverlay(
  oCtx: CanvasRenderingContext2D,
  overlayOptions?: VideoOverlayOptions,
  currentSegment?: HighlightSegment,
  frame: FrameSpec = LANDSCAPE_PREVIEW_FRAME,
  options?: SegmentOverlayDrawOptions
): boolean {
  if (!overlayOptions) return false;

  return frame.orientation === 'portrait'
    ? drawPortraitOverlay(oCtx, overlayOptions, currentSegment, frame, options)
    : drawLandscapeOverlay(oCtx, overlayOptions, currentSegment, frame, options);
}
