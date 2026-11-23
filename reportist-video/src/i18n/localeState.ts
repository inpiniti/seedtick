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

/** 언어 전환 버튼에 표시할 짧은 코드 (한국어는 KO 대신 KR 사용). */
const LANGUAGE_CODE_MAP: Record<Locale, string> = {
  en: 'EN',
  ko: 'KR',
  ja: 'JA',
  zh: 'ZH',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
};

export function getLanguageCode(locale: Locale): string {
  return LANGUAGE_CODE_MAP[locale] || locale.toUpperCase();
}

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

/**
 * 현재 런타임 UI 언어 반환.
 * 우선순위: URL의 ?lang= → localStorage → 영어(기본).
 * 브라우저/OS 언어는 자동 감지하지 않는다. 한국어 브라우저라도 `?lang=ko`나
 * 언어 선택 전에는 영어로 열리며, 랜딩 페이지의 `/ko/` 링크로 들어온 경우에만
 * `?lang=ko`가 붙어 한국어로 시작한다.
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

  runtimeLocale = DEFAULT_LOCALE;
  return runtimeLocale;
}

export function setRuntimeLocale(locale: Locale): void {
  if (isSupportedLocale(locale)) {
    runtimeLocale = locale;
  }
}

/**
 * 현재 UI 언어에 대응하는 마케팅 랜딩 경로.
 * 영어는 루트(/), 나머지 로케일은 /<code>/ (seo/content.mjs의 locale.path와 동일).
 * URL의 ?lang=가 localStorage보다 우선하므로, 스튜디오에서 언어를 바꿔 URL이
 * 이전 언어로 남아 있어도 로고 클릭 시 실제 보고 있는 언어의 랜딩으로 이동한다.
 */
export function getLandingPath(locale: Locale = getRuntimeLocale()): string {
  return locale === 'en' ? '/' : `/${locale}/`;
}

/**
 * Intl.DateTimeFormat 등에 사용할 BCP 47 로케일 태그
 */
export function getIntlLocale(locale: Locale = getRuntimeLocale()): string {
  return INTL_LOCALE_MAP[locale] || INTL_LOCALE_MAP.en;
}
