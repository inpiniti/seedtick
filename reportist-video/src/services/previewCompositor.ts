// src/services/previewCompositor.ts - 프리뷰 컴포지터 호환 진입점
// GSAP이 필요한 인트로/아웃트로 렌더러는 previewCompositorIntroOutro.ts로 분리되어 있다.
// 초기 번들에서는 previewCompositorBase.ts만 정적 import하고, 인트로/아웃트로는 지연 로딩한다.

export * from './previewCompositorBase.ts';
export * from './previewCompositorIntroOutro.ts';
