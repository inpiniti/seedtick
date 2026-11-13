// src/i18n/index.tsx - I18n Context, Provider, and Hooks for Reportist Video
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { Locale, Dictionary, LocaleInfo } from './types.ts';
import { LOCALES } from './types.ts';
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  getRuntimeLocale,
  setRuntimeLocale,
} from './localeState.ts';
import { en } from './locales/en.ts';
import {
  getDictionaryWithFallback,
  getLoadedDictionary,
  loadLocaleDictionary,
} from './dictionaries.ts';

export * from './types.ts';
export { DEFAULT_LOCALE } from './localeState.ts';
export { loadLocaleDictionary } from './dictionaries.ts';

/**
 * Helper to interpolate template string like "Total {count} videos" with { count: 5 }
 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [key, val]) => {
    return acc.replaceAll(`{${key}}`, String(val));
  }, template);
}

interface I18nContextType {
  locale: Locale;
  setLocale: (next: Locale) => void;
  dict: Dictionary;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  locales: LocaleInfo[];
  currentLocaleInfo: LocaleInfo;
  interpolate: (template: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLocale(): Locale {
  return getRuntimeLocale();
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [dict, setDict] = useState<Dictionary>(() => getDictionaryWithFallback(getInitialLocale()));

  // 로케일이 바뀌면 해당 사전 청크를 지연 로드한다. (en/ko는 즉시 사용 가능)
  useEffect(() => {
    if (getLoadedDictionary(locale)) {
      setDict(getDictionaryWithFallback(locale));
      return;
    }
    let cancelled = false;
    loadLocaleDictionary(locale)
      .then((dictionary) => {
        if (!cancelled) setDict(dictionary);
      })
      .catch(() => {
        if (!cancelled) setDict(getDictionaryWithFallback('en'));
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const currentLocaleInfo = useMemo(
    () => LOCALES.find((l) => l.code === locale) || LOCALES[0],
    [locale]
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(nextLocale)) {
      setRuntimeLocale(nextLocale);
      setLocaleState(nextLocale);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      } catch {}
    }
  }, []);

  // Update HTML head attributes & title when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = dict.meta.title;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute('content', dict.meta.description);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', dict.meta.title);
    }
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', dict.meta.description);
    }
  }, [locale, dict]);

  // Nested key resolver: t('header.selectModel') or t('sequencer.clipsCount', { count: 3 })
  const t = useCallback(
    (keyPath: string, params?: Record<string, string | number>): string => {
      const parts = keyPath.split('.');
      let current: any = dict;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          // Fallback to English if key missing
          let fallback: any = en;
          for (const fPart of parts) {
            if (fallback && typeof fallback === 'object' && fPart in fallback) {
              fallback = fallback[fPart];
            } else {
              return keyPath;
            }
          }
          current = fallback;
          break;
        }
      }
      if (typeof current === 'string') {
        return interpolate(current, params);
      }
      return keyPath;
    },
    [dict]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        dict,
        t,
        locales: LOCALES,
        currentLocaleInfo,
        interpolate,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
