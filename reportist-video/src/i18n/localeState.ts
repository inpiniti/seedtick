// src/i18n/localeState.ts - React 컴포넌트 외부(서비스/유틸)에서도 현재 UI 언어를 참조할 수 있는 런타임 로케일 상태
import type { Locale } from './types.ts';

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'reportist_video_language';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de'];

const INTL_LOCALE_MAP: Record<Locale, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  zh: 'zh-CN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
};

let runtimeLocale: Locale | null = null;

function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** `?lang=ko` 같은 링크로 들어온 경우 해당 언어를 우선 적용한다. */
function getQueryLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = new URLSearchParams(window.location.search).get('lang');
    if (isSupportedLocale(value)) return value;
  } catch {}
  return null;
}

/** 저장된 설정이 없을 때 브라우저/OS 언어를 UI 언어로 매핑한다. */
function getBrowserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null;
  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const tag of languages) {
    if (!tag) continue;
    const base = tag.toLowerCase().split('-')[0];
    if (isSupportedLocale(base)) return base;
  }
  return null;
}

/**
 * 현재 런타임 UI 언어 반환.
 * 우선순위: URL의 ?lang= → localStorage → 브라우저 언어 → 영어.
 * 이후 I18nProvider가 setRuntimeLocale로 동기화한다.
 */
export function getRuntimeLocale(): Locale {
  if (runtimeLocale) return runtimeLocale;

  const queryLocale = getQueryLocale();
  if (queryLocale) {
    runtimeLocale = queryLocale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, queryLocale);
    } catch {}
    return queryLocale;
  }

  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      runtimeLocale = saved;
      return saved;
    }
  } catch {}

  runtimeLocale = getBrowserLocale() ?? DEFAULT_LOCALE;
  return runtimeLocale;
}

export function setRuntimeLocale(locale: Locale): void {
  if (isSupportedLocale(locale)) {
    runtimeLocale = locale;
  }
}

/**
 * Intl.DateTimeFormat 등에 사용할 BCP 47 로케일 태그
 */
export function getIntlLocale(locale: Locale = getRuntimeLocale()): string {
  return INTL_LOCALE_MAP[locale] || INTL_LOCALE_MAP.en;
}
