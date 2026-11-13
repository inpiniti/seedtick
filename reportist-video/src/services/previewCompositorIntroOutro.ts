// src/services/previewCompositorIntroOutro.ts - GSAP 기반 인트로/아웃트로 프리뷰 렌더러
// 프리뷰에서 인트로/아웃트로 구간에 진입할 때만 지연 로딩한다.

import type { VideoOverlayOptions } from '../types/video.ts';
import {
  renderHyperframesIntroFrame,
  renderHyperframesOutroFrame,
} from './hyperframesIntroOutroRenderer.ts';
import { COMPOSITOR_WIDTH, COMPOSITOR_HEIGHT } from './previewCompositorBase.ts';

/**
 * 시작 인트로 타이틀 시퀀스 프레임 렌더링 (HyperFrames 모션 엔진)
 */
export function drawCompositorIntroFrame(
  ctx: CanvasRenderingContext2D,
  progress: number, // 0.0 ~ 1.0
  overlayOptions?: VideoOverlayOptions,
  targetWidth = COMPOSITOR_WIDTH,
  targetHeight = COMPOSITOR_HEIGHT
): void {
  renderHyperframesIntroFrame(ctx, progress, overlayOptions, targetWidth, targetHeight);
}

/**
 * 종료 아웃트로 엔딩 카드 프레임 렌더링 (HyperFrames 모션 엔진)
 */
export function drawCompositorOutroFrame(
  ctx: CanvasRenderingContext2D,
  progress: number, // 0.0 ~ 1.0
  overlayOptions?: VideoOverlayOptions,
  targetWidth = COMPOSITOR_WIDTH,
  targetHeight = COMPOSITOR_HEIGHT
): void {
  renderHyperframesOutroFrame(ctx, progress, overlayOptions, targetWidth, targetHeight);
}
