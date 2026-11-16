// src/services/frameSpec.ts - 출력 프레임(가로 16:9 / 세로 9:16) 정의를 한 곳에서 관리
// 미리보기·내보내기·모션 그래픽·썸네일이 모두 이 스펙을 기준으로 그려져야 WYSIWYG가 유지된다.

import type {
  ExportResolution,
  PortraitPlatform,
  VideoOrientation,
} from '../types/video.ts';

export type { PortraitPlatform, VideoOrientation };

export interface FrameSafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FrameSpec {
  orientation: VideoOrientation;
  width: number;
  height: number;
  /** 레이아웃 기준 배율 = 짧은 변 / 720 (가로 720p=1, 1080p=1.5, 세로 720p=1, 1080p=1.5) */
  unit: number;
  portraitPlatform?: PortraitPlatform;
  /** 플랫폼 UI(상태바·캡션·버튼)에 가리지 않는 안전 영역 (px) */
  safeArea: FrameSafeArea;
}

export const DEFAULT_PORTRAIT_PLATFORM: PortraitPlatform = 'instagram';

export const PORTRAIT_PLATFORMS: readonly PortraitPlatform[] = ['instagram', 'youtube', 'tiktok'];

/**
 * 플랫폼별 세로(9:16) 세이프 영역 비율.
 * - top/bottom: 프레임 높이 대비
 * - left/right: 프레임 폭 대비
 * 숏폼 UI(상단 상태바, 하단 캡션·진행바, 우측 액션 레일)를 피하도록 여유 있게 잡는다.
 */
export const PORTRAIT_SAFE_AREA_RATIOS: Record<PortraitPlatform, FrameSafeArea> = {
  instagram: { top: 0.09, bottom: 0.2, left: 0.06, right: 0.1 },
  youtube: { top: 0.08, bottom: 0.14, left: 0.06, right: 0.11 },
  tiktok: { top: 0.09, bottom: 0.21, left: 0.06, right: 0.15 },
};

export function normalizeOrientation(orientation?: VideoOrientation | null): VideoOrientation {
  return orientation === 'portrait' ? 'portrait' : 'landscape';
}

export function isPortraitOrientation(orientation?: VideoOrientation | null): boolean {
  return normalizeOrientation(orientation) === 'portrait';
}

export function resolvePortraitPlatform(platform?: PortraitPlatform | null): PortraitPlatform {
  return platform && PORTRAIT_PLATFORMS.includes(platform) ? platform : DEFAULT_PORTRAIT_PLATFORM;
}

const EMPTY_SAFE_AREA: FrameSafeArea = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * 방향 + 해상도(짧은 변 기준)로 실제 캔버스 크기와 레이아웃 단위를 계산한다.
 * - 720p  가로: 1280x720   / 세로: 720x1280
 * - 1080p 가로: 1920x1080  / 세로: 1080x1920
 * 가로 결과는 기존 파이프라인과 픽셀 단위로 동일하다(unit = width / 1280 = 1 또는 1.5).
 */
export function resolveFrameSpec(
  orientation: VideoOrientation = 'landscape',
  resolution: ExportResolution = '720p',
  portraitPlatform?: PortraitPlatform
): FrameSpec {
  const isPortrait = normalizeOrientation(orientation) === 'portrait';
  const shortSide = resolution === '1080p' ? 1080 : 720;

  if (!isPortrait) {
    return {
      orientation: 'landscape',
      width: Math.round((shortSide * 16) / 9),
      height: shortSide,
      unit: shortSide / 720,
      safeArea: EMPTY_SAFE_AREA,
    };
  }

  const platform = resolvePortraitPlatform(portraitPlatform);
  const height = Math.round((shortSide * 16) / 9);
  const ratios = PORTRAIT_SAFE_AREA_RATIOS[platform];

  return {
    orientation: 'portrait',
    width: shortSide,
    height,
    unit: shortSide / 720,
    portraitPlatform: platform,
    safeArea: {
      top: Math.round(height * ratios.top),
      bottom: Math.round(height * ratios.bottom),
      left: Math.round(shortSide * ratios.left),
      right: Math.round(shortSide * ratios.right),
    },
  };
}

/** 스튜디오 미리보기용 프레임 (항상 720p, 짧은 변 720) */
export function previewFrame(
  orientation: VideoOrientation = 'landscape',
  portraitPlatform?: PortraitPlatform
): FrameSpec {
  return resolveFrameSpec(orientation, '720p', portraitPlatform);
}

export const LANDSCAPE_PREVIEW_FRAME: FrameSpec = resolveFrameSpec('landscape', '720p');

/** @deprecated 프레임 정의는 resolveFrameSpec/previewFrame을 사용하세요. 가로 720p 호환 상수 */
export const COMPOSITOR_WIDTH = LANDSCAPE_PREVIEW_FRAME.width;
/** @deprecated 프레임 정의는 resolveFrameSpec/previewFrame을 사용하세요. 가로 720p 호환 상수 */
export const COMPOSITOR_HEIGHT = LANDSCAPE_PREVIEW_FRAME.height;

export const OVERLAY_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';

export type OverlayFontWeight = 'bold' | '600' | '500';

export function overlayFont(weight: OverlayFontWeight, size: number): string {
  return `${weight} ${Math.max(1, Math.round(size))}px ${OVERLAY_FONT_STACK}`;
}

/**
 * maxWidth 안에 들어가도록 글자 크기를 줄인다. (최소 minSize까지)
 * ctx.font는 마지막으로 측정한 폰트로 남는다.
 */
export function fitCanvasFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredSize: number,
  buildFont: (size: number) => string,
  minSize = Math.max(10, preferredSize * 0.55)
): number {
  let size = Math.max(1, preferredSize);
  const floor = Math.max(1, Math.min(minSize, preferredSize));
  ctx.font = buildFont(size);
  while (size > floor && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = buildFont(size);
  }
  return size;
}

/**
 * maxWidth에 맞춰 단어 단위로 줄바꿈하고, 한 단어가 폭을 넘으면 글자 단위로 자른다.
 * 반환된 모든 줄은 maxWidth 이하이다.
 */
export function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (maxWidth <= 0) return [normalized];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushLongWord = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (chunk && ctx.measureText(next).width > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = '';
    }

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      const remainder = pushLongWord(word);
      // 마지막 조각은 다음 단어와 이어붙일 수 있도록 current로 넘긴다.
      current = remainder;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [normalized];
}

function ellipsizeLine(ctx: CanvasRenderingContext2D, line: string, maxWidth: number, force = false): string {
  if (!force && ctx.measureText(line).width <= maxWidth) return line;
  const ellipsis = '…';
  let result = line;
  while (result.length > 0 && ctx.measureText(`${result}${ellipsis}`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result ? `${result}${ellipsis}` : ellipsis;
}

/**
 * 여러 줄 텍스트 블록을 maxWidth 안에 맞춘다.
 * 글자 크기를 preferred → min까지 줄여 maxLines 안에 들어가게 하고,
 * 그래도 넘치면 마지막 줄을 말줄임 처리한다.
 */
export function fitTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
  maxLines: number,
  buildFont: (size: number) => string
): { fontSize: number; lines: string[] } {
  const floor = Math.max(1, Math.min(minSize, preferredSize));
  let size = Math.max(1, preferredSize);
  let lines: string[] = [];

  for (; size >= floor; size -= 1) {
    ctx.font = buildFont(size);
    lines = wrapTextLines(ctx, text, maxWidth);
    if (lines.length <= maxLines) {
      return { fontSize: size, lines };
    }
  }

  ctx.font = buildFont(floor);
  lines = wrapTextLines(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const lastIndex = lines.length - 1;
    lines[lastIndex] = ellipsizeLine(ctx, lines[lastIndex], maxWidth, true);
  }
  return { fontSize: floor, lines };
}
