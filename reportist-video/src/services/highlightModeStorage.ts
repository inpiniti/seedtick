// src/services/highlightModeStorage.ts
// 마지막으로 선택한 하이라이트 방식(감성 하이라이트 / 1초 컷 편집)을 기기에 기억한다.
import type { HighlightMode } from '../types/video.ts';

export const HIGHLIGHT_MODE_STORAGE_KEY = 'penguincut_highlight_mode_v1';
export const DEFAULT_HIGHLIGHT_MODE: HighlightMode = 'story';

export function normalizeHighlightMode(value: unknown): HighlightMode {
  return value === 'quick-cut' ? 'quick-cut' : 'story';
}

export function getStoredHighlightMode(): HighlightMode {
  try {
    const saved = localStorage.getItem(HIGHLIGHT_MODE_STORAGE_KEY);
    if (saved) return normalizeHighlightMode(saved);
  } catch {
    // localStorage를 쓸 수 없는 환경(프라이빗 모드 등)은 기본값 사용
  }
  return DEFAULT_HIGHLIGHT_MODE;
}

export function setStoredHighlightMode(mode: HighlightMode): void {
  try {
    localStorage.setItem(HIGHLIGHT_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
