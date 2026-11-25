// src/hooks/useTheme.ts — 클래스 기반 라이트/다크 테마 상태.
// Animate UI ThemeToggler는 테마 값과 setter를 직접 받으므로 next-themes 없이
// 이 훅만으로 localStorage 영속화와 <html>.dark 토글을 처리한다.

import { useCallback, useEffect, useState } from 'react';
import type { Resolved, ThemeSelection } from '@animate-ui/react/primitives/effects/theme-toggler';

const STORAGE_KEY = 'penguincut-theme';
const VALID_THEMES: readonly ThemeSelection[] = ['light', 'dark', 'system'];

function readStoredTheme(): ThemeSelection {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as ThemeSelection)) {
      return stored as ThemeSelection;
    }
  } catch {
    // 저장소가 막힌 브라우저(시크릿 모드 등)에서는 라이트로 시작한다.
  }
  return 'light';
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function resolveTheme(theme: ThemeSelection, systemDark: boolean): Resolved {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** <html> 클래스를 실제 테마와 동기화한다. */
export function applyThemeClass(resolved: Resolved): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0e1116' : '#f8f9fa');
}

/** React 마운트 전에 호출해 저장된 다크 테마가 깜빡이지 않게 한다. */
export function applyStoredTheme(): void {
  applyThemeClass(resolveTheme(readStoredTheme(), prefersDark()));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeSelection>(readStoredTheme);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemeSelection) => {
    if (!VALID_THEMES.includes(next)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장 실패는 무시하고 현재 세션에만 테마를 적용한다.
    }
    setThemeState(next);
    // View Transitions 미지원 브라우저에서는 ThemeToggler가 클래스를 바꾸지
    // 않으므로 여기서 직접 적용한다.
    applyThemeClass(resolveTheme(next, prefersDark()));
  }, []);

  return { theme, resolvedTheme, setTheme };
}
