import type { ScrollFadeProps } from '@animate-ui/react/primitives/effects/scroll-fade';

/**
 * 스크롤 가능한 패널에 공통으로 쓰는 페이드 설정.
 * 가장자리 44px를 깎고, 경계 항목은 5% 축소 + 6px 블러로 눌러준다.
 * (기본값 40px·3%·4px보다 경계가 또렷해 '페이드가 약하다'는 느낌을 줄인다.)
 */
export const scrollFadePanelProps = {
  orientation: 'vertical',
  size: 44,
  shrink: 0.05,
  blur: 6,
} satisfies Partial<ScrollFadeProps>;

/** 탐색 메뉴처럼 글자 블러가 부담스러운 영역은 마스크만 적용한다. */
export const scrollFadeNavProps = {
  orientation: 'vertical',
  size: 28,
  shrink: 0,
  blur: 0,
} satisfies Partial<ScrollFadeProps>;
