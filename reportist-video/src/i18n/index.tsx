// src/i18n/index.tsx - I18n Context, Provider, and Hooks for Reportist Video
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { Locale, Dictionary, LocaleInfo } from './types.ts';
import { LOCALES } from './types.ts';
import {
  LOCALE_STORAGE_KEY,
  getRuntimeLocale,
  setRuntimeLocale,
} from './localeState.ts';
import { en } from './locales/en.ts';
import { ko } from './locales/ko.ts';
import { ja } from './locales/ja.ts';
import { zh } from './locales/zh.ts';
import { es } from './locales/es.ts';
import { fr } from './locales/fr.ts';
import { de } from './locales/de.ts';

export * from './types.ts';
export { DEFAULT_LOCALE } from './localeState.ts';

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  ko,
  ja,
  zh,
  es,
  fr,
  de,
};

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

  const dict = useMemo(() => DICTIONARIES[locale] || DICTIONARIES.en, [locale]);

  const currentLocaleInfo = useMemo(
    () => LOCALES.find((l) => l.code === locale) || LOCALES[0],
    [locale]
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    if (nextLocale in DICTIONARIES) {
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
          let fallback: any = DICTIONARIES.en;
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
