// src/data/patchNotesLocalization.ts - Patch Notes 로케일별 번역 로더
// 번역 데이터는 patchNotesLocales/{locale}.json 청크로 분리되어, 패치노트를 열 때
// 현재 언어 파일 하나만 내려받는다. (한국어는 원본 patchNotes.ts를 그대로 사용)
import type { Locale } from '../i18n/types.ts';
import { PATCH_RELEASES, type PatchRelease, type PatchCommit } from './patchNotes.ts';

interface LocalePatchNotes {
  releases: Record<string, { title: string; summary: string }>;
  commits: Record<string, string>;
}

type LazyLocale = Exclude<Locale, 'ko'>;

const LOCALE_LOADERS: Record<LazyLocale, () => Promise<{ default: LocalePatchNotes }>> = {
  en: () => import('./patchNotesLocales/en.json'),
  ja: () => import('./patchNotesLocales/ja.json'),
  zh: () => import('./patchNotesLocales/zh.json'),
  es: () => import('./patchNotesLocales/es.json'),
  fr: () => import('./patchNotesLocales/fr.json'),
  de: () => import('./patchNotesLocales/de.json'),
};

const translationCache: Partial<Record<LazyLocale, LocalePatchNotes>> = {};

async function loadTranslations(locale: LazyLocale): Promise<LocalePatchNotes | null> {
  const cached = translationCache[locale];
  if (cached) return cached;
  try {
    const mod = await LOCALE_LOADERS[locale]();
    translationCache[locale] = mod.default;
    return mod.default;
  } catch (err) {
    console.warn(`[PatchNotes] ${locale} 번역 로드 실패, 원본을 사용합니다:`, err);
    return null;
  }
}

/**
 * 현재 로케일에 맞는 릴리즈/커밋 번역을 적용한 패치노트를 반환한다.
 * 한국어는 원본이 한국어이므로 추가 청크 없이 즉시 반환한다.
 */
export async function getLocalizedPatchReleases(locale: Locale): Promise<PatchRelease[]> {
  if (locale === 'ko') return PATCH_RELEASES;

  const translations = await loadTranslations(locale as LazyLocale);
  if (!translations) return PATCH_RELEASES;

  return PATCH_RELEASES.map((rel) => {
    const relI18n = translations.releases[rel.version];
    const title = relI18n?.title || rel.title;
    const summary = relI18n?.summary || rel.summary;

    const localizedCommits: PatchCommit[] = rel.commits.map((commit) => {
      const message = translations.commits[commit.hash] || commit.message;
      const scopePrefix = commit.scope ? `(${commit.scope}): ` : ': ';
      return {
        ...commit,
        message,
        rawSubject: `${commit.type}${scopePrefix}${message}`,
      };
    });

    return {
      ...rel,
      title,
      summary,
      commits: localizedCommits,
    };
  });
}
