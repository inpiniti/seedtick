// src/services/previewCompositorIntroOutro.ts - GSAP 기반 인트로/아웃트로 프리뷰 렌더러
// 프리뷰에서 인트로/아웃트로 구간에 진입한 때만 지연 로딩된다.

import type { VideoOverlayOptions } from '../types/video.ts';
import {
  renderHyperframesIntroFrame,
  renderHyperframesOutroFrame,
} from './hyperframesIntroOutroRenderer.ts';
import { LANDSCAPE_PREVIEW_FRAME, type FrameSpec } from './frameSpec.ts';

/**
 * 시작 인트로 타이틀 시퀀스 레터 렌더러 (HyperFrames 모션 그래픽)
 */
export function drawCompositorIntroFrame(
  ctx: CanvasRenderingContext2D,
  progress: number, // 0.0 ~ 1.0
  overlayOptions?: VideoOverlayOptions,
  frame: FrameSpec = LANDSCAPE_PREVIEW_FRAME
): void {
  renderHyperframesIntroFrame(ctx, progress, overlayOptions, frame.width, frame.height);
}

/**
 * 종료 아웃트로 엔딩 카드 레터 렌더러 (HyperFrames 모션 그래픽)
 */
export function drawCompositorOutroFrame(
  ctx: CanvasRenderingContext2D,
  progress: number, // 0.0 ~ 1.0
  overlayOptions?: VideoOverlayOptions,
  frame: FrameSpec = LANDSCAPE_PREVIEW_FRAME
): void {
  renderHyperframesOutroFrame(ctx, progress, overlayOptions, frame.width, frame.height);
}
