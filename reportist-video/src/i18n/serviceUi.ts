// src/i18n/serviceUi.ts
// React 컴포넌트 밖(서비스/유틸)에서 진행 상태 문구를 현재 UI 언어로 변환한다.
// I18nProvider의 ui()와 동일한 translateUi 레이어를 사용하므로 번역 키가
// 컴포넌트와 서비스 사이에서 일관된다.
import { getDictionaryWithFallback } from './dictionaries.ts';
import { getRuntimeLocale } from './localeState.ts';
import { translateUi } from './uiText.ts';

export function translateServiceUi(
  source: string,
  params?: Record<string, string | number>
): string {
  const locale = getRuntimeLocale();
  return translateUi(locale, getDictionaryWithFallback(locale), source, params);
}
