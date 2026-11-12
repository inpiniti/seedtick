// src/services/introOutroStorage.ts
// 인트로 & 아웃트로 모션 디폴트 설정의 로컬 스토리지 영속화(Persistence) 관리자

import type { IntroTemplateId, OutroTemplateId } from '../types/video.ts';
import {
  DEFAULT_INTRO_DURATION,
  DEFAULT_OUTRO_DURATION,
} from './hyperframesIntroOutroRenderer.ts';

const STORAGE_KEYS = {
  SHOW_INTRO: 'reportist_show_intro_default',
  INTRO_TEMPLATE: 'reportist_intro_template_default',
  INTRO_DURATION: 'reportist_intro_duration_default',
  SHOW_OUTRO: 'reportist_show_outro_default',
  OUTRO_TEMPLATE: 'reportist_outro_template_default',
  OUTRO_DURATION: 'reportist_outro_duration_default',
  OUTRO_TEXT: 'reportist_outro_text_default',
} as const;

export interface StoredIntroOutroDefaults {
  showIntro: boolean;
  introTemplate: IntroTemplateId;
  introDurationSec: number;
  showOutro: boolean;
  outroTemplate: OutroTemplateId;
  outroDurationSec: number;
  outroText: string;
}

/**
 * 시작 인트로 활성화 여부 기본값 불러오기 (기본: true)
 */
export function getStoredShowIntro(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOW_INTRO);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

export function setStoredShowIntro(show: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SHOW_INTRO, String(show));
  } catch {}
}

/**
 * 인트로 템플릿 기본값 불러오기 (기본: 'kinetic-slide')
 */
export function getStoredIntroTemplate(): IntroTemplateId {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.INTRO_TEMPLATE);
    if (
      saved === 'kinetic-slide' ||
      saved === 'split-flap' ||
      saved === 'cinematic-letterbox' ||
      saved === 'film-countdown'
    ) {
      return saved as IntroTemplateId;
    }
  } catch {}
  return 'kinetic-slide';
}

export function setStoredIntroTemplate(tpl: IntroTemplateId): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INTRO_TEMPLATE, tpl);
  } catch {}
}

/**
 * 인트로 재생 길이(초) 기본값 불러오기 (기본: 2.0)
 */
export function getStoredIntroDuration(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.INTRO_DURATION);
    if (saved) {
      const num = parseFloat(saved);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  } catch {}
  return DEFAULT_INTRO_DURATION;
}

export function setStoredIntroDuration(sec: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INTRO_DURATION, String(sec));
  } catch {}
}

/**
 * 종료 아웃트로 활성화 여부 기본값 불러오기 (기본: true)
 */
export function getStoredShowOutro(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOW_OUTRO);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

export function setStoredShowOutro(show: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SHOW_OUTRO, String(show));
  } catch {}
}

/**
 * 아웃트로 템플릿 기본값 불러오기 (기본: 'modern-endcard')
 */
export function getStoredOutroTemplate(): OutroTemplateId {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.OUTRO_TEMPLATE);
    if (
      saved === 'modern-endcard' ||
      saved === 'minimal-fade' ||
      saved === 'curtain-split'
    ) {
      return saved as OutroTemplateId;
    }
  } catch {}
  return 'modern-endcard';
}

export function setStoredOutroTemplate(tpl: OutroTemplateId): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OUTRO_TEMPLATE, tpl);
  } catch {}
}

/**
 * 아웃트로 재생 길이(초) 기본값 불러오기 (기본: 2.2)
 */
export function getStoredOutroDuration(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.OUTRO_DURATION);
    if (saved) {
      const num = parseFloat(saved);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  } catch {}
  return DEFAULT_OUTRO_DURATION;
}

export function setStoredOutroDuration(sec: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OUTRO_DURATION, String(sec));
  } catch {}
}

/**
 * 아웃트로 클로징 감사 문구 기본값 불러오기
 */
export function getStoredOutroText(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.OUTRO_TEXT);
    if (saved !== null) return saved;
  } catch {}
  return '';
}

export function setStoredOutroText(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OUTRO_TEXT, text);
  } catch {}
}

/**
 * 모든 인트로 & 아웃트로 기본 설정 객체 일괄 로드
 */
export function getStoredIntroOutroDefaults(): StoredIntroOutroDefaults {
  return {
    showIntro: getStoredShowIntro(),
    introTemplate: getStoredIntroTemplate(),
    introDurationSec: getStoredIntroDuration(),
    showOutro: getStoredShowOutro(),
    outroTemplate: getStoredOutroTemplate(),
    outroDurationSec: getStoredOutroDuration(),
    outroText: getStoredOutroText(),
  };
}

/**
 * 모든 인트로 & 아웃트로 기본 설정 객체 일괄 저장
 */
export function setStoredIntroOutroDefaults(settings: Partial<StoredIntroOutroDefaults>): void {
  if (settings.showIntro !== undefined) setStoredShowIntro(settings.showIntro);
  if (settings.introTemplate !== undefined) setStoredIntroTemplate(settings.introTemplate);
  if (settings.introDurationSec !== undefined) setStoredIntroDuration(settings.introDurationSec);
  if (settings.showOutro !== undefined) setStoredShowOutro(settings.showOutro);
  if (settings.outroTemplate !== undefined) setStoredOutroTemplate(settings.outroTemplate);
  if (settings.outroDurationSec !== undefined) setStoredOutroDuration(settings.outroDurationSec);
  if (settings.outroText !== undefined) setStoredOutroText(settings.outroText);
}
