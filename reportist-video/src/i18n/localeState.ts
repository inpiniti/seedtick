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

/**
 * 현재 런타임 UI 언어 반환.
 * 최초 호출 시 localStorage에 저장된 언어를 읽고, 이후 I18nProvider가 setRuntimeLocale로 동기화한다.
 */
export function getRuntimeLocale(): Locale {
  if (runtimeLocale) return runtimeLocale;
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      runtimeLocale = saved;
      return saved;
    }
  } catch {}
  runtimeLocale = DEFAULT_LOCALE;
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
