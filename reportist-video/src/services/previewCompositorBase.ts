// src/services/previewCompositorBase.ts - GSAP 비의존 프리뷰 컴포지터 (커버 프레임/자막 오버레이)
// Shares the exact pixel-level rendering math with videoStitcher.ts & videoStitcherWebCodecs.ts

import type { HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';

export const COMPOSITOR_WIDTH = 1280;
export const COMPOSITOR_HEIGHT = 720;

/**
 * 16:9 캔버스(1280x720)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림 (개별 90도 회전 지원)
 */
export function drawCompositorCoverFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  vItem?: VideoItem,
  segment?: HighlightSegment,
  targetWidth = COMPOSITOR_WIDTH,
  targetHeight = COMPOSITOR_HEIGHT
): void {
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

  const offsetX = (targetWidth - renderW) / 2;
  let offsetY: number;

  if (vH > vW) {
    const excessHeight = renderH - targetHeight;
    const ratio = segment?.cropOffsetYRatio ?? 0.25;
    offsetY = -excessHeight * ratio;
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
        sHeight = rawVH;
        sWidth = Math.round(rawVH * targetAspect);
        sx = Math.round((rawVW - sWidth) / 2);
        sy = 0;
      } else if (srcAspect < targetAspect) {
        sWidth = rawVW;
        sHeight = Math.round(rawVW / targetAspect);
        sx = 0;

        if (rawVH > rawVW) {
          const excessHeight = rawVH - sHeight;
          const ratio = segment?.cropOffsetYRatio ?? 0.25;
          sy = Math.round(excessHeight * ratio);
        } else {
          sy = Math.round((rawVH - sHeight) / 2);
        }
      }

      sx = Math.max(0, Math.min(sx, Math.max(0, rawVW - sWidth)));
      sy = Math.max(0, Math.min(sy, Math.max(0, rawVH - sHeight)));

      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    } else {
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

/**
 * 16:9 캔버스(1280x720) 위에 좌측 상단 타이틀, 날짜/위치, 우측 상단 채널명, 하단 중앙 자막을 합성
 * (videoStitcher.ts의 createSegmentOverlayCanvas와 100% 동일한 좌표·폰트·그림자 규격)
 */
export function drawCompositorSegmentOverlay(
  oCtx: CanvasRenderingContext2D,
  overlayOptions?: VideoOverlayOptions,
  currentSegment?: HighlightSegment,
  targetWidth = COMPOSITOR_WIDTH,
  targetHeight = COMPOSITOR_HEIGHT
): void {
  if (!overlayOptions) return;

  let titleBottomY = 28;
  const hasTitle = Boolean(overlayOptions.showTitle && overlayOptions.titleText?.trim());

  // 1. 좌측 상단 영상 제목
  if (hasTitle) {
    oCtx.save();
    oCtx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
    const text = overlayOptions.titleText;
    const metrics = oCtx.measureText(text);
    const padX = 14;
    const boxW = metrics.width + padX * 2;
    const boxH = 38;
    const x = 32;
    const y = 28;

    oCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    oCtx.beginPath();
    if (typeof oCtx.roundRect === 'function') {
      oCtx.roundRect(x, y, boxW, boxH, 6);
    } else {
      oCtx.rect(x, y, boxW, boxH);
    }
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
    oCtx.save();
    oCtx.font = '600 16px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    oCtx.shadowBlur = 4;
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = 1.5;
    oCtx.textAlign = 'left';
    oCtx.textBaseline = 'top';

    const metaX = hasTitle ? 34 : 32;
    const metaY = hasTitle ? titleBottomY + 7 : 28;
    oCtx.fillText(metaText, metaX, metaY);
    oCtx.restore();
  }

  // 2. 우측 상단 채널 이름
  if (overlayOptions.showChannel && overlayOptions.channelText) {
    oCtx.save();
    oCtx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    oCtx.shadowBlur = 4;
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = 2;
    oCtx.textAlign = 'right';
    oCtx.textBaseline = 'middle';
    oCtx.fillText(overlayOptions.channelText, targetWidth - 32, 47);
    oCtx.restore();
  }

  // 3. 하단 중앙 씬 제목 자막
  if (overlayOptions.showSubtitle) {
    const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
    const subText = titlePart.trim();

    if (subText) {
      oCtx.save();
      oCtx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      const metrics = oCtx.measureText(subText);
      const padX = 20;
      const boxW = metrics.width + padX * 2;
      const boxH = 46;
      const x = (targetWidth - boxW) / 2;
      const y = targetHeight - 76;

      oCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      oCtx.beginPath();
      if (typeof oCtx.roundRect === 'function') {
        oCtx.roundRect(x, y, boxW, boxH, 8);
      } else {
        oCtx.rect(x, y, boxW, boxH);
      }
      oCtx.fill();

      oCtx.fillStyle = '#ffffff';
      oCtx.textAlign = 'center';
      oCtx.textBaseline = 'middle';
      oCtx.fillText(subText, targetWidth / 2, y + boxH / 2);
      oCtx.restore();
    }
  }
}
