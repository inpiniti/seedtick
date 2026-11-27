// OutputLanguageGuard.ts — 한국어 출력 요청에 중국어·일본어 문자가 섞인 응답을 걸러낸다.

import type { ChatMessage, ChatResponse } from '../types.ts';

// CJK 통합 한자(확장 A)와 한자 호환 문자. 연속 두 글자 이상이면 중국어 문장으로 본다.
// 단독 한자는 한자 표기를 의도한 한국어 문장일 수 있어 허용한다.
const CHINESE_RUN_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]{2}/;
// 가나는 한국어 문장에 거의 쓰이지 않으므로 한 글자도 허용하지 않는다.
const KANA_PATTERN = /[\u3040-\u30FF]/;

/** 응답 본문에서 텍스트만 추출한다. 멀티모달 파트가 섞여 와도 텍스트 파트만 검사한다. */
export function extractMessageText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .join(' ');
}

export function hasForeignCjkScript(text: string): boolean {
  return CHINESE_RUN_PATTERN.test(text) || KANA_PATTERN.test(text);
}

/** 한국어만 기대하는 요청의 응답인지 확인한다. 중국어·일본어 문자가 있으면 거부한다. */
export function isKoreanOutput(response: ChatResponse): boolean {
  if (!Array.isArray(response.choices) || response.choices.length === 0) return false;
  return response.choices.every(
    (choice) => !hasForeignCjkScript(extractMessageText(choice?.message?.content))
  );
}
