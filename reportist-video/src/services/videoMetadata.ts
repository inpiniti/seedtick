// services/videoMetadata.ts - 영상 메타데이터(촬영일자, GPS 좌표) 추출 유틸리티
import { useState, useCallback } from 'react';
import type { HighlightSegment, VideoItem } from '../types/video.ts';

export type DateFormatOption =
  | 'YYYY.MM.DD'
  | 'YYYY-MM-DD'
  | 'YYYY/MM/DD'
  | 'YYYY년 M월 D일'
  | 'M월 D일'
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY';

export interface DateFormatItem {
  id: DateFormatOption;
  formatName: string;
  label: string;
  example: string;
  isDefault?: boolean;
}

export const DATE_FORMAT_STORAGE_KEY = 'reportist_video_date_format';
export const DEFAULT_DATE_FORMAT: DateFormatOption = 'YYYY.MM.DD';

export const SHOW_AGE_STORAGE_KEY = 'reportist_video_show_age';
export const BIRTH_DATE_STORAGE_KEY = 'reportist_video_birth_date';
export const SHOW_DATE_STORAGE_KEY = 'reportist_video_show_date';

export interface VideoMetadata {
  dateStr: string; // e.g. "2026.11.03"
  fullDateStr: string; // e.g. "2026년 11월 3일"
  recordedTimestamp?: number;
  latitude?: number;
  longitude?: number;
  locationQuery?: string;
  locationName?: string; // e.g. "어린이대공원"
}

/**
 * 저장된 날짜 표기 형식 불러오기 (기본값: YYYY.MM.DD)
 */
export function getStoredDateFormat(): DateFormatOption {
  try {
    const saved = localStorage.getItem(DATE_FORMAT_STORAGE_KEY) as DateFormatOption | null;
    if (
      saved &&
      (saved === 'YYYY.MM.DD' ||
        saved === 'YYYY-MM-DD' ||
        saved === 'YYYY/MM/DD' ||
        saved === 'YYYY년 M월 D일' ||
        saved === 'M월 D일' ||
        saved === 'MM/DD/YYYY' ||
        saved === 'DD/MM/YYYY')
    ) {
      return saved;
    }
  } catch {}
  return DEFAULT_DATE_FORMAT;
}

/**
 * 날짜 표기 형식 localStorage에 저장
 */
export function setStoredDateFormat(format: DateFormatOption): void {
  try {
    localStorage.setItem(DATE_FORMAT_STORAGE_KEY, format);
  } catch {}
}

/**
 * 나이 표시 옵션 활성화 여부 불러오기
 */
export function getStoredShowAge(): boolean {
  try {
    const saved = localStorage.getItem(SHOW_AGE_STORAGE_KEY);
    return saved === 'true';
  } catch {}
  return false;
}

/**
 * 나이 표시 옵션 localStorage에 저장
 */
export function setStoredShowAge(show: boolean): void {
  try {
    localStorage.setItem(SHOW_AGE_STORAGE_KEY, String(show));
  } catch {}
}

/**
 * 촬영 날짜 표시 옵션 활성화 여부 불러오기 (기본값: true)
 */
export function getStoredShowDate(): boolean {
  try {
    const saved = localStorage.getItem(SHOW_DATE_STORAGE_KEY);
    if (saved === null) return true;
    return saved === 'true';
  } catch {}
  return true;
}

/**
 * 촬영 날짜 표시 옵션 localStorage에 저장
 */
export function setStoredShowDate(show: boolean): void {
  try {
    localStorage.setItem(SHOW_DATE_STORAGE_KEY, String(show));
  } catch {}
}

/**
 * 생년월일(YYYY-MM-DD) 불러오기
 */
export function getStoredBirthDate(): string {
  try {
    return localStorage.getItem(BIRTH_DATE_STORAGE_KEY) || '';
  } catch {}
  return '';
}

/**
 * 생년월일 localStorage에 저장
 */
export function setStoredBirthDate(dateStr: string): void {
  try {
    localStorage.setItem(BIRTH_DATE_STORAGE_KEY, dateStr);
  } catch {}
}

/**
 * 날짜 문자열에서 끝에 붙은 나이 괄호(예: " (1살 8개월)", " (2살)") 제거
 */
export function stripAgeFromDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * 날짜 문자열(다양한 포맷) 및 선택적 시간(시:분:초)에서 Date 객체 파싱
 */
export function parseDateTimeFromString(str: string): { date: Date; hasTime: boolean } | null {
  if (!str) return null;
  const clean = stripAgeFromDate(str).trim();

  // 1. 시간 패턴 매칭 (HH:mm:ss 또는 HH:mm 또는 HH시 mm분 ss초)
  let hh = 0;
  let mm = 0;
  let ss = 0;
  let hasTime = false;

  const timeMatch = clean.match(/(?:[T\s](\d{1,2})[:시](\d{1,2})(?:[:분](\d{1,2})(?:초)?)?)/);
  if (timeMatch) {
    hh = parseInt(timeMatch[1], 10);
    mm = parseInt(timeMatch[2], 10);
    ss = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    hasTime = true;
  }

  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), hh, mm, ss);
    if (!isNaN(d.getTime())) return { date: d, hasTime };
  }

  // YYYY년 M월 D일
  const koYmd = clean.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koYmd) {
    const d = new Date(parseInt(koYmd[1], 10), parseInt(koYmd[2], 10) - 1, parseInt(koYmd[3], 10), hh, mm, ss);
    if (!isNaN(d.getTime())) return { date: d, hasTime };
  }

  // MM/DD/YYYY or DD/MM/YYYY
  const slash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const d = new Date(parseInt(slash[3], 10), parseInt(slash[1], 10) - 1, parseInt(slash[2], 10), hh, mm, ss);
    if (!isNaN(d.getTime())) return { date: d, hasTime };
  }

  // M월 D일 (연도 생략된 경우 현재 연도 기준)
  const koMd = clean.match(/^(\d{1,2})월\s*(\d{1,2})일/);
  if (koMd) {
    const curYear = new Date().getFullYear();
    const d = new Date(curYear, parseInt(koMd[1], 10) - 1, parseInt(koMd[2], 10), hh, mm, ss);
    if (!isNaN(d.getTime())) return { date: d, hasTime };
  }

  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) {
    const fallbackHasTime = /[:\d]{2,}:/.test(clean);
    return { date: fallback, hasTime: fallbackHasTime };
  }
  return null;
}

/**
 * 날짜 문자열(다양한 포맷)에서 Date 객체 파싱
 */
export function parseDateFromString(str: string): Date | null {
  const parsed = parseDateTimeFromString(str);
  return parsed ? parsed.date : null;
}

/**
 * 세그먼트의 실제 촬영 시점 타임스탬프 (밀리초) 계산
 * - 소스 영상의 메타데이터(mvhd, QuickTime, EXIF, 파일명, lastModified)의 촬영 시분초 반영
 * - 세그먼트의 영상 내 시작 오프셋(seg.start 초)을 정밀 가산
 * - 사용자가 수정한 subtitleDate에 시분초가 있을 경우 우선 반영
 */
export function calculateSegmentTimestamp(
  seg: HighlightSegment,
  videoMap: Map<string, VideoItem>
): number {
  const vItem = videoMap.get(seg.sourceVideoId);
  const startOffsetMs = Math.round((seg.start || 0) * 1000);

  // 1. 세그먼트에 명시적 recordedTimestamp가 있을 때
  if (typeof seg.recordedTimestamp === 'number' && !isNaN(seg.recordedTimestamp)) {
    return seg.recordedTimestamp;
  }

  // 2. 사용자가 subtitleDate를 입력/수정했을 때 파싱 시도
  if (seg.subtitleDate && seg.subtitleDate.trim()) {
    const parsed = parseDateTimeFromString(seg.subtitleDate);
    if (parsed) {
      if (parsed.hasTime) {
        // 사용자가 날짜뿐 아니라 시간(시분초)까지 명시한 경우
        return parsed.date.getTime() + startOffsetMs;
      }
      // 날짜만 있고 시간 정보가 없는 경우:
      // 소스 비디오의 recordedTimestamp가 있다면 그 비디오의 '시분초'를 유지하고 날짜만 변경
      if (vItem?.recordedTimestamp) {
        const origDate = new Date(vItem.recordedTimestamp + startOffsetMs);
        const combined = new Date(
          parsed.date.getFullYear(),
          parsed.date.getMonth(),
          parsed.date.getDate(),
          origDate.getHours(),
          origDate.getMinutes(),
          origDate.getSeconds(),
          origDate.getMilliseconds()
        );
        if (!isNaN(combined.getTime())) {
          return combined.getTime();
        }
      }
      return parsed.date.getTime() + startOffsetMs;
    }
  }

  // 3. 소스 비디오의 recordedTimestamp가 있을 때 (촬영일시 메타데이터 + 시작 오프셋)
  if (vItem?.recordedTimestamp) {
    return vItem.recordedTimestamp + startOffsetMs;
  }

  // 4. 소스 비디오의 file.lastModified 가 있을 때
  if (vItem?.file?.lastModified) {
    return vItem.file.lastModified + startOffsetMs;
  }

  // 5. fallback: seg.start 오프셋 기준 (동일 영상 내 순서 유지)
  return startOffsetMs;
}

/**
 * 세그먼트 목록을 촬영일시(날짜 및 시·분·초) 기준 시간순(오름차순)으로 정렬
 */
export function sortSegmentsByRecordedTime(
  segments: HighlightSegment[],
  videoMap: Map<string, VideoItem>
): HighlightSegment[] {
  return [...segments].sort((a, b) => {
    const tsA = calculateSegmentTimestamp(a, videoMap);
    const tsB = calculateSegmentTimestamp(b, videoMap);
    if (tsA !== tsB) {
      return tsA - tsB;
    }
    // 시간이 동일하면 소스 비디오 내 start 초 기준
    return a.start - b.start;
  });
}

/**
 * 세그먼트의 촬영 일시를 보기 좋은 문자열로 포맷팅 (날짜 + 시:분:초)
 */
export function formatSegmentRecordedDateTime(
  seg: HighlightSegment,
  videoMap: Map<string, VideoItem>
): { full: string; timeOnly: string; dateOnly: string } {
  const ts = calculateSegmentTimestamp(seg, videoMap);
  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    return { full: '', timeOnly: '', dateOnly: '' };
  }
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  return {
    full: `${year}.${month}.${day} ${hh}:${mm}:${ss}`,
    timeOnly: `${hh}:${mm}:${ss}`,
    dateOnly: `${year}.${month}.${day}`,
  };
}

/**
 * 만 나이 계산:
 * - 2살 이상: 만 나이만 표시 (예: "2살", "3살")
 * - 2살 미만: 개월수도 표시
 *   - 1살: 1살 X개월 (0개월일 땐 "1살")
 *   - 0살: X개월 (0개월일 땐 "0개월")
 */
export function calculateAgeText(
  birthDateInput: string | Date,
  targetDateInput: string | Date | number
): string | null {
  if (!birthDateInput || !targetDateInput) return null;

  const birth =
    typeof birthDateInput === 'string'
      ? parseDateFromString(birthDateInput) || new Date(birthDateInput)
      : birthDateInput;
  const target =
    typeof targetDateInput === 'number'
      ? new Date(targetDateInput)
      : typeof targetDateInput === 'string'
      ? parseDateFromString(targetDateInput) || new Date(targetDateInput)
      : targetDateInput;

  if (!birth || isNaN(birth.getTime()) || !target || isNaN(target.getTime())) {
    return null;
  }

  // 출생일 이전의 영상인 경우 표시하지 않음
  if (target.getTime() < birth.getTime()) {
    return null;
  }

  let years = target.getFullYear() - birth.getFullYear();
  let months = target.getMonth() - birth.getMonth();
  let days = target.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // 만 나이 (2살 이상은 살 단위만 표시)
  if (years >= 2) {
    return `${years}살`;
  }

  // 2살 미만: 개월수도 표시 (예: 1살 8개월, 1살)
  if (years === 1) {
    return months > 0 ? `1살 ${months}개월` : '1살';
  }

  // 0살 (1세 미만: 예: 8개월, 0개월)
  return `${months}개월`;
}

/**
 * 기본 날짜 문자열에 나이 정보 결합
 * 예: 2026.11.03 -> 2026.11.03 (1살 8개월)
 */
export function formatDateWithAge(
  baseDateStr: string,
  targetDateInput: string | Date | number,
  showAge: boolean,
  birthDate: string
): string {
  const cleanBase = stripAgeFromDate(baseDateStr);
  if (!showAge || !birthDate || !birthDate.trim()) {
    return cleanBase;
  }

  const ageText = calculateAgeText(birthDate, targetDateInput);
  if (!ageText) {
    return cleanBase;
  }

  return `${cleanBase} (${ageText})`;
}

/**
 * Date 객체 또는 타임스탬프를 지정된 패턴으로 포맷팅
 */
export function formatDateByPattern(
  dateInput: Date | number,
  pattern: DateFormatOption = getStoredDateFormat()
): string {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const pad2 = (n: number) => String(n).padStart(2, '0');

  switch (pattern) {
    case 'YYYY.MM.DD':
      return `${year}.${pad2(month)}.${pad2(day)}`;
    case 'YYYY-MM-DD':
      return `${year}-${pad2(month)}-${pad2(day)}`;
    case 'YYYY/MM/DD':
      return `${year}/${pad2(month)}/${pad2(day)}`;
    case 'YYYY년 M월 D일':
      return `${year}년 ${month}월 ${day}일`;
    case 'M월 D일':
      return `${month}월 ${day}일`;
    case 'MM/DD/YYYY':
      return `${pad2(month)}/${pad2(day)}/${year}`;
    case 'DD/MM/YYYY':
      return `${pad2(day)}/${pad2(month)}/${year}`;
    default:
      return `${year}.${pad2(month)}.${pad2(day)}`;
  }
}

/**
 * 지원하는 모든 날짜 포맷 목록 및 예시 반환
 */
export function getDateFormats(sampleDate: Date = new Date()): DateFormatItem[] {
  return [
    {
      id: 'YYYY.MM.DD',
      formatName: 'YYYY.MM.DD',
      label: '점 구분 (권장 기본값)',
      example: formatDateByPattern(sampleDate, 'YYYY.MM.DD'),
      isDefault: true,
    },
    {
      id: 'YYYY-MM-DD',
      formatName: 'YYYY-MM-DD',
      label: '하이픈 구분 (ISO 규격)',
      example: formatDateByPattern(sampleDate, 'YYYY-MM-DD'),
    },
    {
      id: 'YYYY/MM/DD',
      formatName: 'YYYY/MM/DD',
      label: '슬래시 구분',
      example: formatDateByPattern(sampleDate, 'YYYY/MM/DD'),
    },
    {
      id: 'YYYY년 M월 D일',
      formatName: 'YYYY년 M월 D일',
      label: '한국어 연월일',
      example: formatDateByPattern(sampleDate, 'YYYY년 M월 D일'),
    },
    {
      id: 'M월 D일',
      formatName: 'M월 D일',
      label: '간략형 월일',
      example: formatDateByPattern(sampleDate, 'M월 D일'),
    },
    {
      id: 'MM/DD/YYYY',
      formatName: 'MM/DD/YYYY',
      label: '미국식 (월/일/년)',
      example: formatDateByPattern(sampleDate, 'MM/DD/YYYY'),
    },
    {
      id: 'DD/MM/YYYY',
      formatName: 'DD/MM/YYYY',
      label: '유럽식 (일/월/년)',
      example: formatDateByPattern(sampleDate, 'DD/MM/YYYY'),
    },
  ];
}

/**
 * React 훅: 날짜 포맷 상태 관리
 */
export function useDateFormat() {
  const [dateFormat, setDateFormatState] = useState<DateFormatOption>(getStoredDateFormat);

  const setDateFormat = useCallback((newFormat: DateFormatOption) => {
    setStoredDateFormat(newFormat);
    setDateFormatState(newFormat);
  }, []);

  return { dateFormat, setDateFormat };
}

/**
 * QuickTime / MP4 컨테이너의 mvhd 박스 및 메타데이터 문자열에서 실제 촬영 일시를 파싱
 */
/**
 * 바이너리 텍스트(latin1)에서 특정 키 뒤에 나타나는 날짜 문자열 추출
 */
function findDateAfterKey(text: string, key: string, maxWindow = 350): Date | null {
  const idx = text.indexOf(key);
  if (idx === -1) return null;
  const chunk = text.slice(idx + key.length, idx + key.length + maxWindow);

  // 1. ISO 8601 포맷: 2024-05-12T14:32:05+09:00 또는 2024-05-12T14:32:05Z 또는 2024-05-12 14:32:05
  const isoMatch = chunk.match(
    /(\d{4})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])(?:[T\s]([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:([+-][0-2]\d:?[0-5]\d)|Z)?)?/
  );
  if (isoMatch) {
    const raw = isoMatch[0];
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
      return parsed;
    }
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const hh = isoMatch[4] ? parseInt(isoMatch[4], 10) : 12;
    const mm = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const ss = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    const fallbackDate = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(fallbackDate.getTime()) && fallbackDate.getFullYear() >= 2000 && fallbackDate.getFullYear() <= 2040) {
      return fallbackDate;
    }
  }

  // 2. 콜론 구분 EXIF 형식: 2024:05:12 14:32:05
  const colonMatch = chunk.match(
    /(\d{4}):(0[1-9]|1[0-2]):(0[1-9]|[12]\d|3[01])(?:\s+([01]\d|2[0-3]):([0-5]\d):([0-5]\d))?/
  );
  if (colonMatch) {
    const y = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10) - 1;
    const d = parseInt(colonMatch[3], 10);
    const hh = colonMatch[4] ? parseInt(colonMatch[4], 10) : 12;
    const mm = colonMatch[5] ? parseInt(colonMatch[5], 10) : 0;
    const ss = colonMatch[6] ? parseInt(colonMatch[6], 10) : 0;
    const dt = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2000 && dt.getFullYear() <= 2040) {
      return dt;
    }
  }

  return null;
}

/**
 * DataView에서 QuickTime/MP4 mvhd 박스의 creation_time 추출
 */
function findMvhdCreationDate(view: DataView): Date | null {
  const len = view.byteLength;
  for (let i = 0; i < len - 16; i++) {
    if (
      view.getUint8(i) === 0x6d &&
      view.getUint8(i + 1) === 0x76 &&
      view.getUint8(i + 2) === 0x68 &&
      view.getUint8(i + 3) === 0x64
    ) {
      const version = view.getUint8(i + 4);
      let creationSec = 0;
      if (version === 0) {
        creationSec = view.getUint32(i + 8, false); // big-endian
      } else if (version === 1 && i + 16 < len) {
        creationSec = Number(view.getBigUint64(i + 8, false));
      }
      // QuickTime epoch (1904-01-01 UTC) 차이: 2,082,844,800 초
      if (creationSec > 2082844800) {
        const unixMs = (creationSec - 2082844800) * 1000;
        const candidate = new Date(unixMs);
        const year = candidate.getFullYear();
        if (year >= 2000 && year <= 2040) {
          return candidate;
        }
      }
    }
  }
  return null;
}

/**
 * QuickTime / MP4 컨테이너의 mvhd 박스 및 메타데이터 문자열에서 실제 촬영 일시를 파싱
 * 
 * [아이폰 모바일 Safari 특성 대응]
 * - 아이폰 Photos 앱에서 Safari로 영상을 업로드할 때, iOS는 샌드박스로 영상을 export/트랜스코딩합니다.
 * - 이때 생성된 임시 파일의 file.lastModified와 mvhd.creation_time은 "방금 업로드한 오늘 시각"으로 설정됩니다.
 * - 반면 원본 촬영 일시는 QuickTime User Data / Meta box의 com.apple.quicktime.creationdate 에 안전하게 보존됩니다.
 * - 따라서 com.apple.quicktime.creationdate 와 EXIF 태그를 1순위로 탐색해야 아이폰에서도 진짜 촬영일자가 정확히 인식됩니다.
 */
export async function extractMediaRecordedDate(file: File): Promise<Date> {
  try {
    // 1. 헤더 (처음 4MB) 및 테일 (마지막 8MB) 버퍼 준비
    // 아이폰 4K 등 대용량 영상은 moov 박스가 파일 끝에 위치하므로 tail을 충분히 읽어야 함
    const headerChunkSize = Math.min(file.size, 1024 * 1024 * 4);
    const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const headerText = decoder.decode(headerBuffer);

    let tailBuffer: ArrayBuffer | null = null;
    let tailText = '';
    if (file.size > headerChunkSize) {
      const tailSize = Math.min(file.size - headerChunkSize, 1024 * 1024 * 8);
      const tailStart = file.size - tailSize;
      tailBuffer = await file.slice(tailStart).arrayBuffer();
      tailText = decoder.decode(tailBuffer);
    }

    // 1-A. [최우선 1순위] iPhone / Apple QuickTime 원본 촬영일시 태그 (com.apple.quicktime.creationdate)
    // iOS 카메라 앱이 기록하는 실제 촬영 일시 및 타임존 (+09:00 등)
    const appleHeaderDate = findDateAfterKey(headerText, 'com.apple.quicktime.creationdate');
    if (appleHeaderDate) return appleHeaderDate;

    if (tailText) {
      const appleTailDate = findDateAfterKey(tailText, 'com.apple.quicktime.creationdate');
      if (appleTailDate) return appleTailDate;
    }

    // 1-B. [2순위] QuickTime User Data ©day 태그
    const dayHeaderDate = findDateAfterKey(headerText, '\xa9day') || findDateAfterKey(headerText, '©day');
    if (dayHeaderDate) return dayHeaderDate;

    if (tailText) {
      const dayTailDate = findDateAfterKey(tailText, '\xa9day') || findDateAfterKey(tailText, '©day');
      if (dayTailDate) return dayTailDate;
    }

    // 1-C. [3순위] EXIF DateTimeOriginal / CreateDate (사진 및 일부 비디오)
    const exifRegex = /(\d{4}):(0[1-9]|1[0-2]):(0[1-9]|[12]\d|3[01])\s+([01]\d|2[0-3]):([0-5]\d):([0-5]\d)/;
    const exifHeaderMatch = headerText.match(exifRegex);
    if (exifHeaderMatch) {
      const [, y, m, d, hh, mm, ss] = exifHeaderMatch;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
        return parsed;
      }
    }

    if (tailText) {
      const exifTailMatch = tailText.match(exifRegex);
      if (exifTailMatch) {
        const [, y, m, d, hh, mm, ss] = exifTailMatch;
        const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
          return parsed;
        }
      }
    }

    // 1-D. [4순위] 파일명에서 날짜 패턴 파싱 (카톡 다운로드, 갤럭시 포맷, 클라우드 다운로드 등)
    const filenameDate = parseDateFromFilename(file.name);
    if (filenameDate) {
      return filenameDate;
    }

    // 1-E. [5순위] QuickTime / MP4 mvhd 박스 파싱 (컨테이너 생성 시간)
    // 원본 메타데이터가 없는 일반 MP4 파일의 경우 유용
    const mvhdHeaderDate = findMvhdCreationDate(new DataView(headerBuffer));
    if (mvhdHeaderDate) return mvhdHeaderDate;

    if (tailBuffer) {
      const mvhdTailDate = findMvhdCreationDate(new DataView(tailBuffer));
      if (mvhdTailDate) return mvhdTailDate;
    }
  } catch (err) {
    console.debug('[videoMetadata] 촬영일 메타데이터 파싱 건너뜀 (fallback으로 전환):', err);
  }

  // 2. 파일 시스템 수정일 (lastModified) fallback (데스크탑 업로드 시 원본 일시 보존됨)
  if (file.lastModified) {
    return new Date(file.lastModified);
  }

  return new Date();
}

/**
 * 파일명(filename)에서 촬영일 추출 시도 (카톡, 갤럭시, 아이폰 다운로드 등 메타데이터가 손실된 파일 지원)
 */
export function parseDateFromFilename(filename: string): Date | null {
  if (!filename) return null;
  const m1 = filename.match(/(\d{4})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[-_\s]?(\d{2})(\d{2})(\d{2}))?/);
  if (m1) {
    const y = parseInt(m1[1], 10);
    const m = parseInt(m1[2], 10) - 1;
    const d = parseInt(m1[3], 10);
    const hh = m1[4] ? parseInt(m1[4], 10) : 12;
    const mm = m1[5] ? parseInt(m1[5], 10) : 0;
    const ss = m1[6] ? parseInt(m1[6], 10) : 0;
    if (y >= 2000 && y <= 2040) {
      const candidate = new Date(y, m, d, hh, mm, ss);
      if (!isNaN(candidate.getTime())) return candidate;
    }
  }
  return null;
}

/**
 * 동영상/사진 파일에서 촬영 날짜를 안정적으로 포맷팅 (나이 옵션 활성화 시 나이 병기)
 */
export function formatVideoDate(
  file: File,
  pattern: DateFormatOption = getStoredDateFormat(),
  recordedDate?: Date,
  showAge: boolean = getStoredShowAge(),
  birthDate: string = getStoredBirthDate()
): { dateStr: string; fullDateStr: string; recordedTimestamp: number } {
  const d = recordedDate || (file.lastModified ? new Date(file.lastModified) : new Date());
  const baseDateStr = formatDateByPattern(d, pattern);
  const dateStr = formatDateWithAge(baseDateStr, d, showAge, birthDate);
  const fullDateStr = formatDateByPattern(d, 'YYYY년 M월 D일');

  return {
    dateStr,
    fullDateStr,
    recordedTimestamp: d.getTime(),
  };
}

/**
 * 사진(JPEG, WebP 등) 및 영상(MP4, MOV 등)에서 GPS 좌표를 파싱
 * - QuickTime com.apple.quicktime.location.ISO6709 또는 ©xyz
 * - ISO 6709 패턴 (+/-DD.DDDD+/-DDD.DDDD)
 * - EXIF GPS IFD 태그 (JPEG 등 사진 파일)
 */
export async function extractGpsFromVideoFile(file: File): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const headerChunkSize = Math.min(file.size, 1024 * 1024 * 4);
    const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const headerText = decoder.decode(headerBuffer);

    let tailText = '';
    if (file.size > headerChunkSize) {
      const tailSize = Math.min(file.size - headerChunkSize, 1024 * 1024 * 8);
      const tailStart = file.size - tailSize;
      const tailBuffer = await file.slice(tailStart).arrayBuffer();
      tailText = decoder.decode(tailBuffer);
    }

    const iso6709Regex = /([+-]\d{2,3}\.\d{3,})([+-]\d{2,3}\.\d{3,})/;

    // 1. Apple QuickTime location 메타데이터 키 검색
    for (const text of [headerText, tailText]) {
      if (!text) continue;
      const locKeyIdx = text.indexOf('com.apple.quicktime.location.ISO6709');
      if (locKeyIdx !== -1) {
        const chunk = text.slice(locKeyIdx + 36, locKeyIdx + 150);
        const match = chunk.match(iso6709Regex);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng };
          }
        }
      }

      // QuickTime ©xyz
      const xyzKeyIdx = text.indexOf('\xa9xyz') !== -1 ? text.indexOf('\xa9xyz') : text.indexOf('©xyz');
      if (xyzKeyIdx !== -1) {
        const chunk = text.slice(xyzKeyIdx + 4, xyzKeyIdx + 100);
        const match = chunk.match(iso6709Regex);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng };
          }
        }
      }

      // 일반 ISO 6709 검색
      const generalMatch = text.match(iso6709Regex);
      if (generalMatch) {
        const lat = parseFloat(generalMatch[1]);
        const lng = parseFloat(generalMatch[2]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { latitude: lat, longitude: lng };
        }
      }
    }

    // 2. EXIF GPS 태그 파싱 (사진 파일)
    const exifGps = parseExifGps(headerBuffer);
    if (exifGps) {
      return exifGps;
    }
  } catch (err) {
    console.debug('[videoMetadata] GPS 좌표 추출 건너뜀 (메타데이터 미포함):', err);
  }

  return null;
}

/**
 * EXIF 바이너리에서 GPSLatitude / GPSLongitude 태그 파싱
 */
function parseExifGps(buffer: ArrayBuffer): { latitude: number; longitude: number } | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 64) return null;
    let offset = 0;
    if (view.getUint16(0, false) === 0xffd8) {
      offset = 2;
      while (offset < view.byteLength - 4) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          const app1Length = view.getUint16(offset, false);
          const exifHeader = view.getUint32(offset + 2, false);
          if (exifHeader === 0x45786966) {
            const tiffStart = offset + 8;
            return extractGpsFromTiff(view, tiffStart);
          }
          offset += app1Length;
        } else if ((marker & 0xff00) === 0xff00 && marker !== 0xff00) {
          const len = view.getUint16(offset, false);
          offset += len;
        } else {
          break;
        }
      }
    }
  } catch {}
  return null;
}

function extractGpsFromTiff(view: DataView, tiffStart: number): { latitude: number; longitude: number } | null {
  try {
    const endian = view.getUint16(tiffStart, false);
    const little = endian === 0x4949;
    const ifdOffset = view.getUint32(tiffStart + 4, little);
    let current = tiffStart + ifdOffset;
    const numEntries = view.getUint16(current, little);
    current += 2;

    let gpsIfdOffset = 0;
    for (let i = 0; i < numEntries; i++) {
      const tag = view.getUint16(current, little);
      if (tag === 0x8825) {
        gpsIfdOffset = view.getUint32(current + 8, little);
        break;
      }
      current += 12;
    }

    if (!gpsIfdOffset) return null;

    let gpsPos = tiffStart + gpsIfdOffset;
    const gpsEntries = view.getUint16(gpsPos, little);
    gpsPos += 2;

    let latRef = 'N';
    let lngRef = 'E';
    let latOffset = 0;
    let lngOffset = 0;

    for (let i = 0; i < gpsEntries; i++) {
      const tag = view.getUint16(gpsPos, little);
      if (tag === 0x0001) {
        latRef = String.fromCharCode(view.getUint8(gpsPos + 8));
      } else if (tag === 0x0002) {
        latOffset = view.getUint32(gpsPos + 8, little);
      } else if (tag === 0x0003) {
        lngRef = String.fromCharCode(view.getUint8(gpsPos + 8));
      } else if (tag === 0x0004) {
        lngOffset = view.getUint32(gpsPos + 8, little);
      }
      gpsPos += 12;
    }

    if (latOffset && lngOffset) {
      const readRational = (off: number) => {
        const num = view.getUint32(tiffStart + off, little);
        const den = view.getUint32(tiffStart + off + 4, little);
        return den === 0 ? 0 : num / den;
      };

      const latDeg = readRational(latOffset);
      const latMin = readRational(latOffset + 8);
      const latSec = readRational(latOffset + 16);
      let lat = latDeg + latMin / 60 + latSec / 3600;
      if (latRef === 'S') lat = -lat;

      const lngDeg = readRational(lngOffset);
      const lngMin = readRational(lngOffset + 8);
      const lngSec = readRational(lngOffset + 16);
      let lng = lngDeg + lngMin / 60 + lngSec / 3600;
      if (lngRef === 'W') lng = -lng;

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch {}
  return null;
}

// 위경도 좌표 -> 장소명 메모리 캐시 (중복 호출 방지)
const locationCache = new Map<string, string>();

/**
 * GPS 위도/경도를 인간이 읽기 편한 장소명(맥 사진 앱 스타일 A안: 명소명 최우선)으로 역지오코딩 변환
 * 예: 어린이대공원, 해운대 해수욕장, 여의도 한강공원, 능동 등
 */
export async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<string> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (locationCache.has(cacheKey)) {
    return locationCache.get(cacheKey)!;
  }

  try {
    // BigDataCloud 클라이언트 전용 리버스 지오코딩 API (무료, CORS 완벽 지원, 브라우저 클라이언트 공식 지원)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const locality = typeof data.locality === 'string' ? data.locality.trim() : '';
        const city = typeof data.city === 'string' ? data.city.trim() : '';
        const adminList = Array.isArray(data.localityInfo?.administrative)
          ? data.localityInfo.administrative
          : [];

        // 자치구/일반구 (예: 광진구, 강남구, 분당구, 해운대구 등) 검색
        let district = '';
        for (const item of adminList) {
          if (typeof item?.name === 'string') {
            const nm = item.name.trim();
            if (/.+[구군]$/.test(nm) && nm !== city) {
              district = nm;
            }
          }
        }

        let placeName = '';
        if (locality) {
          if (district && district !== locality && !locality.includes(district)) {
            placeName = `${district} ${locality}`;
          } else if (
            city &&
            !city.includes('특별시') &&
            !city.includes('광역시') &&
            city !== locality &&
            !locality.includes(city)
          ) {
            placeName = `${city} ${locality}`;
          } else {
            placeName = locality;
          }
        } else if (district) {
          placeName = district;
        } else if (city) {
          placeName = city;
        } else if (data.principalSubdivision) {
          placeName = String(data.principalSubdivision).trim();
        } else if (data.countryName) {
          placeName = String(data.countryName).trim();
        }

        if (placeName) {
          locationCache.set(cacheKey, placeName);
          return placeName;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.debug('[videoMetadata] 역지오코딩 조회 건너뜀 (좌표 표기로 대체):', err);
  }

  const fallback = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
  locationCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * 파일 정보 종합 추출 (실제 촬영일 메타데이터 및 GPS, 역지오코딩 장소명 포함)
 */
export async function extractVideoMetadata(
  file: File,
  pattern: DateFormatOption = getStoredDateFormat()
): Promise<VideoMetadata> {
  const recordedDate = await extractMediaRecordedDate(file);
  const { dateStr, fullDateStr, recordedTimestamp } = formatVideoDate(file, pattern, recordedDate);
  const gps = await extractGpsFromVideoFile(file);
  let locationName: string | undefined = undefined;

  if (gps) {
    try {
      locationName = await reverseGeocodeCoordinates(gps.latitude, gps.longitude);
    } catch {}
  }

  return {
    dateStr,
    fullDateStr,
    recordedTimestamp,
    latitude: gps?.latitude,
    longitude: gps?.longitude,
    locationQuery: gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : undefined,
    locationName,
  };
}
