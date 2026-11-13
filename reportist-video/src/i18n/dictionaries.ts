// src/i18n/dictionaries.ts - Locale dictionary registry with lazy loading
import type { Dictionary, Locale } from './types.ts';
import { en } from './locales/en.ts';
import { ko } from './locales/ko.ts';

// 한국어/영어는 첫 화면에서 바로 쓰이므로 즉시 포함하고,
// 나머지 로케일은 선택 시점에 별도 청크로 내려받는다.
const EAGER_DICTIONARIES: Partial<Record<Locale, Dictionary>> = { en, ko };

const LAZY_LOADERS: Record<Exclude<Locale, 'en' | 'ko'>, () => Promise<Dictionary>> = {
  ja: () => import('./locales/ja.ts').then((m) => m.ja),
  zh: () => import('./locales/zh.ts').then((m) => m.zh),
  es: () => import('./locales/es.ts').then((m) => m.es),
  fr: () => import('./locales/fr.ts').then((m) => m.fr),
  de: () => import('./locales/de.ts').then((m) => m.de),
};

const loadedDictionaries: Partial<Record<Locale, Dictionary>> = { ...EAGER_DICTIONARIES };
const inflightLoads: Partial<Record<Locale, Promise<Dictionary>>> = {};

export function getLoadedDictionary(locale: Locale): Dictionary | undefined {
  return loadedDictionaries[locale];
}

export function getDictionaryWithFallback(locale: Locale): Dictionary {
  return loadedDictionaries[locale] ?? en;
}

export function loadLocaleDictionary(locale: Locale): Promise<Dictionary> {
  const loaded = loadedDictionaries[locale];
  if (loaded) return Promise.resolve(loaded);

  const inflight = inflightLoads[locale];
  if (inflight) return inflight;

  const loader = LAZY_LOADERS[locale as Exclude<Locale, 'en' | 'ko'>];
  if (!loader) return Promise.resolve(en);

  const pending = loader()
    .then((dictionary) => {
      loadedDictionaries[locale] = dictionary;
      return dictionary;
    })
    .finally(() => {
      delete inflightLoads[locale];
    });

  inflightLoads[locale] = pending;
  return pending;
}

// 초기 렌더 전에 현재 로케일을 미리 받아 언어 깜빡임을 방지한다.
export async function preloadInitialLocale(locale: Locale): Promise<void> {
  if (loadedDictionaries[locale]) return;
  try {
    await loadLocaleDictionary(locale);
  } catch {
    // 로케일 청크 로드 실패 시 영어로 폴백
  }
}
