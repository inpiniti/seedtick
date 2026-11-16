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

/**
 * 프레임(가로 16:9 / 세로 9:16)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림 (개별 90도 회전 지원)
 * - 세로 출력에서 가로 원본은 `cropOffsetXRatio`(기본 0.5)로 좌우 위치를 조정한다.
 * - 가로 출력의 기존 크롭/중앙 정렬 수학은 그대로 유지한다.
 */
export function drawCompositorCoverFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  vItem?: VideoItem,
  segment?: HighlightSegment,
  frame: FrameSpec = LANDSCAPE_PREVIEW_FRAME
): void {
  const targetWidth = frame.width;
  const targetHeight = frame.height;
  const rawVW = video.videoWidth || vItem?.width || targetWidth;
  const rawVH = video.videoHeight || vItem?.height || targetHeight;
  const rotation = ((segment?.rotation ?? 0) % 360 + 360) % 360;

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

function drawLandscapeOverlay(
  oCtx: CanvasRenderingContext2D,
  overlayOptions: VideoOverlayOptions,
  currentSegment: HighlightSegment | undefined,
  frame: FrameSpec
): boolean {
  const u = frame.unit;
  const targetWidth = frame.width;
  const targetHeight = frame.height;
  let hasAnyOverlay = false;
  let titleBottomY = Math.round(28 * u);
  const hasTitle = Boolean(overlayOptions.showTitle && overlayOptions.titleText?.trim());

  // 1. 좌측 상단 영상 제목
  if (hasTitle) {
    hasAnyOverlay = true;
    oCtx.save();
    oCtx.font = overlayFont('bold', 22 * u);
    const text = overlayOptions.titleText;
    const metrics = oCtx.measureText(text);
    const padX = Math.round(14 * u);
    const boxW = metrics.width + padX * 2;
    const boxH = Math.round(38 * u);
    const x = Math.round(32 * u);
    const y = Math.round(28 * u);

    oCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    paintRoundedRect(oCtx, x, y, boxW, boxH, Math.round(6 * u));
    oCtx.fill();

    oCtx.fillStyle = '#ffffff';
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'middle';
    oCtx.fillText(text, x + padX, y + boxH / 2);
    oCtx.restore();

    titleBottomY = y + boxH;
  }

  // 1-1. 좌측 상단 문구 아래: 흰색 글씨로 날짜 및 위치 표시
  const datePart =
    overlayOptions.showDate === false
      ? ''
      : currentSegment?.subtitleDate || overlayOptions.subtitleDateText || '';
  const locPart = currentSegment?.locationName || overlayOptions.subtitleLocationText || '';
  const metaParts = [datePart, locPart].filter(Boolean);
  const metaText = metaParts.join(' • ');

  if (metaText) {
    hasAnyOverlay = true;
    oCtx.save();
    oCtx.font = overlayFont('600', 16 * u);
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    oCtx.shadowBlur = Math.round(4 * u);
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = Math.round(1.5 * u);
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'top';

    const metaX = hasTitle ? Math.round(34 * u) : Math.round(32 * u);
    const metaY = hasTitle ? titleBottomY + Math.round(7 * u) : Math.round(28 * u);
    oCtx.fillText(metaText, metaX, metaY);
    oCtx.restore();
  }

  // 2. 우측 상단 채널 이름
  if (overlayOptions.showChannel && overlayOptions.channelText) {
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
    oCtx.fillText(overlayOptions.channelText, targetWidth - Math.round(32 * u), Math.round(47 * u));
    oCtx.restore();
  }

  // 3. 하단 중앙 씬 제목 자막
  if (overlayOptions.showSubtitle) {
    const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
    const subText = titlePart.trim();

    if (subText) {
      hasAnyOverlay = true;
      oCtx.save();
      oCtx.font = overlayFont('bold', 24 * u);
      const metrics = oCtx.measureText(subText);
      const padX = Math.round(20 * u);
      const boxW = metrics.width + padX * 2;
      const boxH = Math.round(46 * u);
      const x = (targetWidth - boxW) / 2;
      const y = targetHeight - Math.round(76 * u);

      oCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      paintRoundedRect(oCtx, x, y, boxW, boxH, Math.round(8 * u));
      oCtx.fill();

      oCtx.fillStyle = '#ffffff';
      oCtx.textAlign = 'center';
      oCtx.textBaseline = 'middle';
      oCtx.fillText(subText, targetWidth / 2, y + boxH / 2);
      oCtx.restore();
    }
  }

  return hasAnyOverlay;
}

function drawPortraitOverlay(
  oCtx: CanvasRenderingContext2D,
  overlayOptions: VideoOverlayOptions,
  currentSegment: HighlightSegment | undefined,
  frame: FrameSpec
): boolean {
  const u = frame.unit;
  const { safeArea } = frame;
  const left = safeArea.left;
  const maxWidth = frame.width - safeArea.left - safeArea.right;
  if (maxWidth <= 0) return false;

  let hasAnyOverlay = false;
  let cursorY = safeArea.top;

  // 1. 좌측 상단 영상 제목 (최대 2줄, 폭에 맞춰 자동 축소)
  const titleText = overlayOptions.titleText?.trim() ?? '';
  const hasTitle = Boolean(overlayOptions.showTitle && titleText);

  if (hasTitle) {
    hasAnyOverlay = true;
    const padX = Math.round(14 * u);
    const padY = Math.round(10 * u);
    const titleMaxWidth = maxWidth - padX * 2;
    const block = fitTextBlock(
      oCtx,
      titleText,
      titleMaxWidth,
      Math.round(26 * u),
      Math.round(15 * u),
      2,
      (size) => overlayFont('bold', size)
    );
    const lineHeight = Math.round(block.fontSize * 1.24);
    oCtx.font = overlayFont('bold', block.fontSize);
    const textWidth = Math.max(...block.lines.map((line) => oCtx.measureText(line).width), 0);
    const boxW = Math.min(maxWidth, textWidth + padX * 2);
    const boxH = block.lines.length * lineHeight + padY * 2;
    const x = left;
    const y = cursorY;

    oCtx.save();
    oCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    paintRoundedRect(oCtx, x, y, boxW, boxH, Math.round(6 * u));
    oCtx.fill();

    oCtx.fillStyle = '#ffffff';
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'middle';
    block.lines.forEach((line, index) => {
      oCtx.fillText(line, x + padX, y + padY + lineHeight * (index + 0.5));
    });
    oCtx.restore();

    cursorY = y + boxH;
  }

  // 2. 세로에서는 채널명을 우상단 대신 제목 바로 아래에 배치
  const channelText = overlayOptions.channelText?.trim() ?? '';
  if (overlayOptions.showChannel && channelText) {
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

  // 3. 날짜 및 위치 (제목/채널 아래, 흰색 그림자 텍스트)
  const datePart =
    overlayOptions.showDate === false
      ? ''
      : currentSegment?.subtitleDate || overlayOptions.subtitleDateText || '';
  const locPart = currentSegment?.locationName || overlayOptions.subtitleLocationText || '';
  const metaText = [datePart, locPart].filter(Boolean).join(' • ');

  if (metaText) {
    hasAnyOverlay = true;
    const gap = hasTitle || (overlayOptions.showChannel && channelText) ? Math.round(6 * u) : 0;
    const size = fitCanvasFontSize(
      oCtx,
      metaText,
      maxWidth - Math.round(4 * u),
      Math.round(15 * u),
      (fontSize) => overlayFont('600', fontSize),
      Math.round(11 * u)
    );

    oCtx.save();
    oCtx.font = overlayFont('600', size);
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    oCtx.shadowBlur = Math.round(4 * u);
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = Math.round(1.5 * u);
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'top';
    oCtx.fillText(metaText, left + Math.round(2 * u), cursorY + gap);
    oCtx.restore();
  }

  // 4. 씬 제목 자막 — 화면 2/3 높이에 줄바꿈 박스로 표시
  if (overlayOptions.showSubtitle) {
    const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
    const subText = titlePart.trim();

    if (subText) {
      hasAnyOverlay = true;
      const padX = Math.round(18 * u);
      const padY = Math.round(12 * u);
      const subMaxWidth = maxWidth - padX * 2;
      const block = fitTextBlock(
        oCtx,
        subText,
        subMaxWidth,
        Math.round(22 * u),
        Math.round(13 * u),
        3,
        (size) => overlayFont('bold', size)
      );
      const lineHeight = Math.round(block.fontSize * 1.26);
      oCtx.font = overlayFont('bold', block.fontSize);
      const textWidth = Math.max(...block.lines.map((line) => oCtx.measureText(line).width), 0);
      const boxW = Math.min(maxWidth, textWidth + padX * 2);
      const boxH = block.lines.length * lineHeight + padY * 2;
      const x = (frame.width - boxW) / 2;
      const preferredY = Math.round((frame.height * 2) / 3 - boxH / 2);
      const minY = safeArea.top;
      const maxY = frame.height - safeArea.bottom - boxH;
      const y = Math.max(minY, Math.min(preferredY, Math.max(minY, maxY)));

      oCtx.save();
      oCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      paintRoundedRect(oCtx, x, y, boxW, boxH, Math.round(8 * u));
      oCtx.fill();

      oCtx.fillStyle = '#ffffff';
      oCtx.textAlign = 'center';
      oCtx.textBaseline = 'middle';
      block.lines.forEach((line, index) => {
        oCtx.fillText(line, frame.width / 2, y + padY + lineHeight * (index + 0.5));
      });
      oCtx.restore();
    }
  }

  return hasAnyOverlay;
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
  frame: FrameSpec = LANDSCAPE_PREVIEW_FRAME
): boolean {
  if (!overlayOptions) return false;

  return frame.orientation === 'portrait'
    ? drawPortraitOverlay(oCtx, overlayOptions, currentSegment, frame)
    : drawLandscapeOverlay(oCtx, overlayOptions, currentSegment, frame);
}
