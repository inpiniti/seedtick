// ResetAtParser.ts - 제공사 응답에 담긴 리셋 시각을 파싱한다.
//
// 일일 소진은 "자정"이 아니라 소진 시점부터 24시간(또는 제공사가 알려준 리셋 시각)까지다.
// 제공사가 x-ratelimit-reset / retry-after 헤더나 에러 메시지에 시각을 주면 그 값을 우선 사용하고,
// 없으면 호출 시점 + 24시간을 사용한다.

export const DAILY_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

// 비정상적으로 먼 미래 시각(또는 과거 시각)은 신뢰하지 않는다.
const MAX_RESET_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_PAST_SKEW_MS = 60_000;

const ISO_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/gi;
const KEYED_EPOCH_PATTERN = /(?:reset|retry|available|until)[\w"'.:=\s-]{0,24}(\d{10,13})/gi;
const RESET_CONTEXT_PATTERN =
  /(?:resets?|resetting|retry(?:\s+after)?|try again|available in|wait|until|초기화|리셋|재시도|사용 가능|다시 시도)[^.!?\n]{0,80}/gi;
// "1시간 30분 후 사용 가능"처럼 시간 표현이 앞에 오는 한국어 문구도 읽는다.
const RESET_TRAILING_CONTEXT_PATTERN = /[^.!?\n]{0,60}(?:초기화|리셋|재시도|사용 가능|다시 시도)/gi;
// 한국어 단어 뒤에서는 \b가 동작하지 않으므로 (?!\w)를 사용한다.
const HOUR_PATTERN = /(\d{1,3})\s*(?:h|hr|hrs|hour|hours|시간)(?!\w)/gi;
const MINUTE_PATTERN = /(\d{1,3})\s*(?:m|min|mins|minute|minutes|분)(?!\w)/gi;
const SECOND_PATTERN = /(\d{1,3})\s*(?:s|sec|secs|second|seconds|초)(?!\w)/gi;
const CLOCK_PATTERN = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;

export const RESET_HEADER_NAMES = [
  'x-ratelimit-reset',
  'x-ratelimit-reset-at',
  'retry-after',
] as const;

function toEpochMs(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d{10}$/.test(trimmed)) return Number(trimmed) * 1000;
  if (/^\d{13}$/.test(trimmed)) return Number(trimmed);
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlausible(target: number, now: number): boolean {
  return target > now - MAX_PAST_SKEW_MS && target <= now + MAX_RESET_WINDOW_MS;
}

function matchAll(text: string, pattern: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while (true) {
    match = pattern.exec(text);
    if (match === null) break;
    matches.push(match);
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  return matches;
}

/** "4h 30m", "in 90 seconds", "8:23:45", "1시간 30분" 같은 상대 시간을 밀리초로 합산한다. */
function parseRelativeDuration(context: string): number | null {
  let totalMs = 0;
  let found = false;

  for (const match of matchAll(context, HOUR_PATTERN)) {
    totalMs += Number(match[1]) * 3_600_000;
    found = true;
  }
  for (const match of matchAll(context, MINUTE_PATTERN)) {
    totalMs += Number(match[1]) * 60_000;
    found = true;
  }
  for (const match of matchAll(context, SECOND_PATTERN)) {
    totalMs += Number(match[1]) * 1000;
    found = true;
  }
  for (const match of matchAll(context, CLOCK_PATTERN)) {
    totalMs += Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000 + Number(match[3]) * 1000;
    found = true;
  }

  return found && totalMs > 0 ? totalMs : null;
}

/**
 * 헤더 값 또는 에러 메시지에서 리셋 시각(epoch ms)을 추출한다.
 * 판단할 수 없으면 null을 반환한다.
 */
export function parseResetAt(
  hint: string | null | undefined,
  now: number = Date.now()
): number | null {
  if (!hint) return null;
  const text = String(hint);
  const candidates: number[] = [];

  // 헤더처럼 값 자체가 시각인 경우
  const direct = toEpochMs(text);
  if (direct !== null && isPlausible(direct, now)) candidates.push(direct);

  // ISO 8601 (본문/JSON 어디에 있든)
  for (const match of matchAll(text, ISO_PATTERN)) {
    const parsed = Date.parse(match[0]);
    if (Number.isFinite(parsed) && isPlausible(parsed, now)) candidates.push(parsed);
  }

  // "reset_at": 1764230400 처럼 키와 붙어 있는 유닉스 타임스탬프
  for (const match of matchAll(text, KEYED_EPOCH_PATTERN)) {
    const parsed = toEpochMs(match[1]);
    if (parsed !== null && isPlausible(parsed, now)) candidates.push(parsed);
  }

  // "try again in 3h 12m", "reset in 00:45:10" 같은 상대 시간
  for (const pattern of [RESET_CONTEXT_PATTERN, RESET_TRAILING_CONTEXT_PATTERN]) {
    for (const match of matchAll(text, pattern)) {
      const durationMs = parseRelativeDuration(match[0]);
      if (durationMs !== null) {
        const target = now + durationMs;
        if (isPlausible(target, now)) candidates.push(target);
      }
    }
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

/** 제공사 응답 헤더에서 리셋 시각 힌트를 읽는다. 우선순위는 헤더 이름 순서다. */
export function readResetAtHeader(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  for (const name of RESET_HEADER_NAMES) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

/** 파싱 실패 시 사용할 기본 리셋 시각: 소진 시점 + 24시간. */
export function fallbackResetAt(now: number = Date.now()): number {
  return now + DAILY_QUOTA_WINDOW_MS;
}
