// src/i18n/uiText.ts
// 하드코딩된 한국어 UI 문구를 현재 언어로 변환하는 보조 번역 레이어.
//
// 기존 딕셔너리(dict)에 같은 문구가 이미 번역되어 있으면 그 번역을 그대로 재사용하고,
// 아직 딕셔너리에 없는 새 문구만 uiText 오버라이드 테이블에서 찾는다.
// 이렇게 하면 새 화면에 남아 있던 한국어 하드코딩을 키 체계를 다시 만들지 않고도
// 기존 다국어 번역과 일관되게 연결할 수 있다.
import type { Dictionary, Locale } from './types.ts';
import { ko } from './locales/ko.ts';
import { en } from './locales/en.ts';
import { uiEn } from './ui/en.ts';
import { uiJa } from './ui/ja.ts';
import { uiZh } from './ui/zh.ts';
import { uiEs } from './ui/es.ts';
import { uiFr } from './ui/fr.ts';
import { uiDe } from './ui/de.ts';

const UI_OVERRIDES: Record<Locale, Record<string, string>> = {
  en: uiEn,
  ko: {},
  ja: uiJa,
  zh: uiZh,
  es: uiEs,
  fr: uiFr,
  de: uiDe,
};

// 오버라이드 테이블의 키를 공백 정규화해 조회용 인덱스로 만든다.
// (여러 줄 문구나 줄바꿈이 섞인 문구도 같은 키로 찾을 수 있게 한다.)
const UI_OVERRIDE_INDEX: Record<Locale, Map<string, string>> = {} as Record<
  Locale,
  Map<string, string>
>;
for (const [locale, table] of Object.entries(UI_OVERRIDES) as Array<[Locale, Record<string, string>]>) {
  const index = new Map<string, string>();
  for (const [key, value] of Object.entries(table)) {
    const normalizedKey = key.replace(/\s+/g, ' ').trim();
    if (normalizedKey && !index.has(normalizedKey)) index.set(normalizedKey, value);
  }
  UI_OVERRIDE_INDEX[locale] = index;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// 문장 부호·공백만 다른 문구를 같은 문구로 묶어 기존 딕셔너리 번역을 최대한 재사용한다.
// (예: '영상 올리기.' → '영상 올리기', '취소!' → '취소')
// {count} 같은 치환자는 그대로 남겨야 하므로 중괄호는 지우지 않는다.
function looseText(value: string): string {
  return normalizeText(value)
    .replace(/[.,!?~…·:'"()[\]<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function flattenDictionary(
  value: unknown,
  prefix = '',
  out: Record<string, string> = {}
): Record<string, string> {
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      out[path] = child;
    } else if (child && typeof child === 'object') {
      flattenDictionary(child, path, out);
    }
  }
  return out;
}

const KO_DICTIONARY_FLAT = flattenDictionary(ko);

// 한국어 원문 → 딕셔너리 키 경로 (예: '영상 올리기' → 'header.uploadedVideos')
const KO_TEXT_TO_KEY = new Map<string, string>();
for (const [key, value] of Object.entries(KO_DICTIONARY_FLAT)) {
  const normalized = normalizeText(value);
  if (!normalized) continue;
  if (!KO_TEXT_TO_KEY.has(normalized)) {
    KO_TEXT_TO_KEY.set(normalized, key);
  }
}

// 문장 부호만 다른 문구도 찾을 수 있도록 한 번 더 느슨한 인덱스를 만든다.
const KO_LOOSE_TO_KEY = new Map<string, string>();
for (const [key, value] of Object.entries(KO_DICTIONARY_FLAT)) {
  const loose = looseText(value);
  if (!loose) continue;
  if (!KO_LOOSE_TO_KEY.has(loose)) {
    KO_LOOSE_TO_KEY.set(loose, key);
  }
}

const EN_DICTIONARY_FLAT = flattenDictionary(en);

function getByPath(dictionary: Dictionary, path: string): string | undefined {
  let current: any = dictionary;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function interpolateUi(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, template);
}

export function translateUi(
  locale: Locale,
  dictionary: Dictionary,
  source: string,
  params?: Record<string, string | number>
): string {
  if (!source) return source;

  // JSX에서 문장 앞뒤 간격을 맞추려고 넣은 공백은 번역문에도 그대로 유지한다.
  // (예: {ui('원본 ')}값{ui('초 ')} → 'Source 5.0s')
  const leading = source.match(/^\s+/)?.[0] ?? '';
  const trailing = source.match(/\s+$/)?.[0] ?? '';
  const core = source.slice(leading.length, source.length - trailing.length);
  const normalized = normalizeText(core);
  if (!normalized) return source;

  const wrap = (value: string) => `${leading}${interpolateUi(value, params)}${trailing}`;

  // 한국어 화면에서는 원문을 그대로 사용한다.
  if (locale === 'ko') return interpolateUi(source, params);

  // 1) 기존 딕셔너리에 같은 한국어 문구가 있으면 해당 번역을 재사용한다.
  const dictionaryKey = KO_TEXT_TO_KEY.get(normalized) ?? KO_LOOSE_TO_KEY.get(looseText(normalized));
  if (dictionaryKey) {
    const localized = getByPath(dictionary, dictionaryKey);
    if (localized && normalizeText(localized) !== normalized) {
      return wrap(localized);
    }
    const fallback = EN_DICTIONARY_FLAT[dictionaryKey];
    if (fallback && normalizeText(fallback) !== normalized) {
      return wrap(fallback);
    }
  }

  // 2) 새로 추가된 화면 문구는 오버라이드 테이블에서 찾는다.
  const table = UI_OVERRIDE_INDEX[locale] ?? UI_OVERRIDE_INDEX.en;
  const template = table.get(normalized) ?? UI_OVERRIDE_INDEX.en.get(normalized);
  return wrap(template ?? normalized);
}
