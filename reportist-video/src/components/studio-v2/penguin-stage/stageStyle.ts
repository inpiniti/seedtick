import type { Palette } from './types.ts';

/** 동물 그림자·설원 소품 접지점이 공유하는 2.5D 납작 비율. */
export const PERSPECTIVE_Y = 0.58;

/** 동물 외곽선과 설원 소품 외곽선이 공유하는 굵기. */
export const OUTLINE_WIDTH = 1.65;

/**
 * 동물 그림체 문법(둥근 잉크 외곽선 + 차분한 슬레이트/파스텔 셀 채움 + 다크모드 외곽 림 + 상단 광택 호)을
 * 남극 지형·소품에도 그대로 적용한다.
 */
export interface SceneStyle {
  dark: boolean;
  outline: string;
  outerRim: string;
  line: string;
  /** 바람에 깎인 눈결(사스트루기) 선. */
  sastrugi: string;
  snowBg: string;
  snowDrift: string;
  snow: string;
  /** 텐트 출입구 등 어두운 음영부(펭귄 등 털색 계열). */
  coat: string;
  iceTop: string;
  iceSide: string;
  iceSideDeep: string;
  waterLight: string;
  waterDeep: string;
  ripple: string;
  rock: string;
  rockDeep: string;
  tent: string;
  tentShade: string;
  signA: string;
  signB: string;
  pole: string;
  stripe: string;
  metal: string;
  metalDeep: string;
  flagA: string;
  flagB: string;
  shadow: string;
  hi: string;
}

export function resolveSceneStyle(palette: Palette): SceneStyle {
  const dark = palette.snowBg === '#0e1116';
  return dark
    ? {
        dark,
        outline: palette.outline,
        outerRim: palette.outerRim,
        line: 'rgba(17, 22, 29, 0.72)',
        sastrugi: 'rgba(186, 208, 232, 0.07)',
        snowBg: palette.snowBg,
        snowDrift: 'rgba(255, 255, 255, 0.025)',
        snow: '#2c3745',
        coat: '#0b0f14',
        iceTop: '#263646',
        iceSide: '#233f55',
        iceSideDeep: '#193144',
        waterLight: '#152c3f',
        waterDeep: '#0d1f2e',
        ripple: 'rgba(195, 224, 246, 0.36)',
        rock: '#4b5564',
        rockDeep: '#39424f',
        tent: '#cfa349',
        tentShade: '#ab8333',
        signA: '#354353',
        signB: '#465261',
        pole: '#d8dfe8',
        stripe: '#c46868',
        metal: '#9da9b8',
        metalDeep: '#6c7989',
        flagA: '#d4a647',
        flagB: '#5a89ab',
        shadow: palette.shadow,
        hi: 'rgba(255, 255, 255, 0.28)',
      }
    : {
        dark,
        outline: palette.outline,
        outerRim: palette.outerRim,
        line: 'rgba(24, 30, 39, 0.56)',
        sastrugi: 'rgba(30, 44, 62, 0.08)',
        // 동물 흰 배·눈 덮개(#ffffff)가 자연스럽게 살아나도록 바닥만 은은한 극지 쿨 화이트로 깐다.
        snowBg: '#f3f6fa',
        snowDrift: 'rgba(255, 255, 255, 0.72)',
        snow: '#ffffff',
        coat: palette.coat,
        iceTop: '#e3eff9',
        iceSide: '#bcd7eb',
        iceSideDeep: '#9cc0dc',
        waterLight: '#cfe3f2',
        waterDeep: '#b0cfe6',
        ripple: 'rgba(255, 255, 255, 0.78)',
        rock: '#6c7787',
        rockDeep: '#555f6e',
        tent: '#f6ce72',
        tentShade: '#e5b857',
        signA: '#dfe8f2',
        signB: '#f6ebd2',
        pole: '#ffffff',
        stripe: '#df7878',
        metal: '#e5ebf2',
        metalDeep: '#b7c3d0',
        flagA: '#f5c758',
        flagB: '#95bedc',
        shadow: palette.shadow,
        hi: 'rgba(255, 255, 255, 0.86)',
      };
}
