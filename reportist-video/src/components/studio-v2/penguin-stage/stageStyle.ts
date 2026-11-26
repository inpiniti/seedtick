import type { Palette } from './types.ts';

/** 동물 그림자·설원 소품 접지점이 공유하는 2.5D 납작 비율. */
export const PERSPECTIVE_Y = 0.58;

/** 동물 외곽선과 설원 소품 외곽선이 공유하는 굵기. */
export const OUTLINE_WIDTH = 1.65;

/** 동물 그림체 문법(불투명 잉크 선 + 플랫 채움)을 설원 소품에도 그대로 적용한다. */
export interface SceneStyle {
  dark: boolean;
  outline: string;
  line: string;
  snowBg: string;
  snow: string;
  snowShade: string;
  coat: string;
  mask: string;
  iceTop: string;
  iceSide: string;
  iceSideDeep: string;
  waterLight: string;
  waterDeep: string;
  ripple: string;
  tree: string;
  rock: string;
  shadow: string;
  hi: string;
}

export function resolveSceneStyle(palette: Palette): SceneStyle {
  const dark = palette.snowBg === '#0e1116';
  return dark
    ? {
        dark,
        outline: palette.outline,
        line: 'rgba(17, 22, 29, 0.72)',
        snowBg: palette.snowBg,
        snow: '#252f3b',
        snowShade: '#1a222c',
        coat: palette.coat,
        mask: palette.faceMask,
        iceTop: '#2d3a48',
        iceSide: '#2b4b63',
        iceSideDeep: '#1d3a50',
        waterLight: '#173247',
        waterDeep: '#0c2030',
        ripple: 'rgba(190, 220, 245, 0.38)',
        tree: '#3a4756',
        rock: '#2f3a46',
        shadow: palette.shadow,
        hi: 'rgba(255, 255, 255, 0.26)',
      }
    : {
        dark,
        outline: palette.outline,
        line: 'rgba(24, 30, 39, 0.68)',
        snowBg: palette.snowBg,
        snow: '#ffffff',
        snowShade: '#e7eef6',
        coat: palette.coat,
        mask: palette.faceMask,
        iceTop: '#eaf3fb',
        iceSide: '#a9d2ea',
        iceSideDeep: '#79b0d6',
        waterLight: '#c6e2f3',
        waterDeep: '#8fc0e0',
        ripple: 'rgba(255, 255, 255, 0.62)',
        tree: '#93a9c0',
        rock: '#b7c5d4',
        shadow: palette.shadow,
        hi: 'rgba(255, 255, 255, 0.7)',
      };
}
