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
  duration?: number; // 초 단위 재생 시간
  width?: number; // 영상 너비 (px)
  height?: number; // 영상 높이 (px)
  rotation?: number; // 회전 각도 (0, 90, 180, 270)
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
 * QuickTime / MP4 컨테이너의 moov/mvhd 박스 및 메타데이터 문자열에서 실제 촬영 일시를 파싱
 */

/**
 * MP4/QuickTime 파일의 Atom 헤더를 점프하여 `moov` 박스를 찾아 그 버퍼를 반환.
 * 수백 MB~GB 단위의 대용량 파일에서도 파일 전체를 메모리에 올리지 않고 헤더(8~16B)만 순회하여
 * moov 박스의 위치와 크기를 알아낸 뒤 해당 구간만 효율적으로 읽음.
 */
async function extractMoovBuffer(file: File): Promise<ArrayBuffer | null> {
  try {
    const fileSize = file.size;
    let offset = 0;
    let iterations = 0;

    // 최대 150개 상위 atom 순회
    while (offset + 8 <= fileSize && iterations < 150) {
      iterations++;
      const headerBuf = await file.slice(offset, offset + 16).arrayBuffer();
      if (headerBuf.byteLength < 8) break;

      const view = new DataView(headerBuf);
      let boxSize = view.getUint32(0, false);
      const boxType = String.fromCharCode(
        view.getUint8(4),
        view.getUint8(5),
        view.getUint8(6),
        view.getUint8(7)
      );

      let headerSize = 8;
      if (boxSize === 1) {
        if (headerBuf.byteLength < 16) break;
        boxSize = Number(view.getBigUint64(8, false));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = fileSize - offset;
      }

      if (boxSize < headerSize || isNaN(boxSize) || !isFinite(boxSize)) break;

      if (boxType === 'moov') {
        const safeBoxEnd = Math.min(fileSize, offset + boxSize);
        const actualMoovLen = safeBoxEnd - offset;
        const maxDirectRead = 1024 * 1024 * 1.5; // 1.5MB 이하 moov는 통째로 읽기

        if (actualMoovLen <= maxDirectRead) {
          return await file.slice(offset, safeBoxEnd).arrayBuffer();
        }

        // 대용량 moov (중간이 수십 MB의 stbl 샘플 테이블인 경우):
        // 실제 촬영일/GPS가 위치한 앞단(mvhd, tkhd, mdhd, meta) 768KB와 뒷단(udta, meta, ilst) 768KB만 핀포인트 추출하여 OOM 원천 차단
        const halfWindow = 768 * 1024;
        const [moovHead, moovTail] = await Promise.all([
          file.slice(offset, offset + halfWindow).arrayBuffer(),
          file.slice(safeBoxEnd - halfWindow, safeBoxEnd).arrayBuffer(),
        ]);
        const combined = new Uint8Array(moovHead.byteLength + moovTail.byteLength);
        combined.set(new Uint8Array(moovHead), 0);
        combined.set(new Uint8Array(moovTail), moovHead.byteLength);
        return combined.buffer;
      }

      offset += boxSize;
    }
  } catch (err) {
    console.debug('[videoMetadata] moov 박스 점프 탐색 건너뜀:', err);
  }
  return null;
}

/**
 * 바이너리 텍스트(latin1)에서 특정 키 뒤에 나타나는 날짜 문자열 추출
 * Apple QuickTime keys/ilst 구조 대응을 위해 maxWindow 기본값을 65536(64KB)로 설정
 */
function findDateAfterKey(text: string, key: string, maxWindow = 65536): Date | null {
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
 * 텍스트 청크에서 유효한 ISO 8601 및 메타데이터 일시를 전역 검색
 * - Google Photos 다운로드 시 생성된 메타데이터, XMP, 안드로이드/QuickTime 범용 대응
 */
function findIsoDateInText(text: string): Date | null {
  if (!text) return null;

  // 1. 메타데이터 힌트 키워드 주변 매칭 우선
  const hintRegex = /(?:creationdate|CreateDate|DateTimeOriginal|DateTime|creation_time|xmp:CreateDate)[^\w\d]{0,50}?([12]\d{3}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d)(?:[T\s](?:[01]\d|2[0-3]):(?:[0-5]\d):(?:[0-5]\d)(?:\.\d+)?(?:(?:[+-][0-2]\d:?[0-5]\d)|Z)?)?)/i;
  const hintMatch = text.match(hintRegex);
  if (hintMatch && hintMatch[1]) {
    const parsed = new Date(hintMatch[1]);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
      return parsed;
    }
  }

  // 2. 표준 ISO 8601 패턴 (초 단위까지 있는 타임스탬프)
  const fullIsoRegex = /\b(20[0-3]\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d)[T\s]([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:([+-][0-2]\d:?[0-5]\d)|Z)?\b/g;
  let match: RegExpExecArray | null;
  while ((match = fullIsoRegex.exec(text)) !== null) {
    const raw = match[0];
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
      return parsed;
    }
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const hh = parseInt(match[4], 10);
    const mm = parseInt(match[5], 10);
    const ss = parseInt(match[6], 10);
    const dt = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2000 && dt.getFullYear() <= 2040) {
      return dt;
    }
  }

  return null;
}

/**
 * DataView에서 QuickTime/MP4 mvhd, tkhd, mdhd 박스의 creation_time 추출
 * QuickTime epoch (1904-01-01 UTC) 차이: 2,082,844,800 초
 */
function findMp4HeaderDates(view: DataView): Date[] {
  const dates: Date[] = [];
  const len = view.byteLength;
  const targetBoxes = ['mvhd', 'tkhd', 'mdhd'];

  for (let i = 0; i < len - 16; i++) {
    const b0 = view.getUint8(i);
    const b1 = view.getUint8(i + 1);
    const b2 = view.getUint8(i + 2);
    const b3 = view.getUint8(i + 3);

    for (const tag of targetBoxes) {
      if (
        b0 === tag.charCodeAt(0) &&
        b1 === tag.charCodeAt(1) &&
        b2 === tag.charCodeAt(2) &&
        b3 === tag.charCodeAt(3)
      ) {
        const version = view.getUint8(i + 4);
        let creationSec = 0;
        if (version === 0) {
          creationSec = view.getUint32(i + 8, false); // big-endian
        } else if (version === 1 && i + 16 < len) {
          creationSec = Number(view.getBigUint64(i + 8, false));
        }

        if (creationSec > 2082844800) {
          const unixMs = (creationSec - 2082844800) * 1000;
          const candidate = new Date(unixMs);
          const year = candidate.getFullYear();
          if (year >= 2000 && year <= 2040) {
            dates.push(candidate);
          }
        }
      }
    }
  }
  return dates;
}

export interface ParsedMp4VisualMeta {
  duration: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * QuickTime / MP4 moov 버퍼의 mvhd 및 tkhd 박스를 순수 바이너리로 파싱하여
 * <video> 엘리먼트 생성 및 하드웨어 디코더 가동 없이 영상의 재생 길이, 해상도, 회전 각도를 0.05ms 만에 즉각 추출.
 * (아이폰 WebKit의 하드웨어 디코더 경합 및 대량 업로드 시 Jetsam 메모리 크래시 원천 차단)
 */
export function findMp4VisualMeta(view: DataView): ParsedMp4VisualMeta | null {
  const len = view.byteLength;
  let duration = 0;
  let width = 0;
  let height = 0;
  let rotation = 0;
  let foundMvhd = false;
  let foundTkhd = false;

  for (let i = 0; i < len - 28; i++) {
    const b0 = view.getUint8(i);
    const b1 = view.getUint8(i + 1);
    const b2 = view.getUint8(i + 2);
    const b3 = view.getUint8(i + 3);

    // 'mvhd' = [109, 118, 104, 100]
    if (!foundMvhd && b0 === 109 && b1 === 118 && b2 === 104 && b3 === 100) {
      const version = view.getUint8(i + 4);
      let timescale = 0;
      let dur = 0;
      if (version === 0 && i + 24 <= len) {
        timescale = view.getUint32(i + 16, false);
        dur = view.getUint32(i + 20, false);
      } else if (version === 1 && i + 36 <= len) {
        timescale = view.getUint32(i + 24, false);
        dur = Number(view.getBigUint64(i + 28, false));
      }
      if (timescale > 0 && dur > 0) {
        duration = dur / timescale;
        foundMvhd = true;
      }
    }

    // 'tkhd' = [116, 107, 104, 100]
    if (!foundTkhd && b0 === 116 && b1 === 107 && b2 === 104 && b3 === 100) {
      const version = view.getUint8(i + 4);
      let matrixOffset = 0;
      let widthOffset = 0;
      if (version === 0 && i + 88 <= len) {
        matrixOffset = i + 44;
        widthOffset = i + 80;
      } else if (version === 1 && i + 100 <= len) {
        matrixOffset = i + 56;
        widthOffset = i + 92;
      }

      if (widthOffset > 0 && widthOffset + 8 <= len) {
        const rawW = view.getUint16(widthOffset, false);
        const rawH = view.getUint16(widthOffset + 4, false);

        if (rawW > 0 && rawH > 0) {
          const a = view.getInt32(matrixOffset, false);
          const b = view.getInt32(matrixOffset + 4, false);
          const c = view.getInt32(matrixOffset + 12, false);
          const d = view.getInt32(matrixOffset + 16, false);

          let rot = 0;
          if (a === 0 && b > 0 && c < 0 && d === 0) {
            rot = 90;
          } else if (a < 0 && b === 0 && c === 0 && d < 0) {
            rot = 180;
          } else if (a === 0 && b < 0 && c > 0 && d === 0) {
            rot = 270;
          }

          rotation = rot;
          if (rot === 90 || rot === 270) {
            width = rawH;
            height = rawW;
          } else {
            width = rawW;
            height = rawH;
          }
          foundTkhd = true;
        }
      }
    }

    if (foundMvhd && foundTkhd) break;
  }

  if (duration > 0 && width > 0 && height > 0) {
    return { duration, width, height, rotation };
  }
  return null;
}

/**
 * 바이너리 EXIF(JPEG/TIFF/HEIC)에서 DateTimeOriginal (0x9003) 또는 CreateDate (0x9004) 파싱
 */
function parseExifDate(buffer: ArrayBuffer): Date | null {
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
            return extractDateFromTiff(view, tiffStart);
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

function extractDateFromTiff(view: DataView, tiffStart: number): Date | null {
  try {
    const endian = view.getUint16(tiffStart, false);
    const little = endian === 0x4949;
    const ifdOffset = view.getUint32(tiffStart + 4, little);
    let current = tiffStart + ifdOffset;
    const numEntries = view.getUint16(current, little);
    current += 2;

    let subIfdOffset = 0;
    let dateStrOffset = 0;

    for (let i = 0; i < numEntries; i++) {
      const tag = view.getUint16(current, little);
      if (tag === 0x8769) {
        // Exif IFD Pointer
        subIfdOffset = view.getUint32(current + 8, little);
      } else if (tag === 0x0132) {
        // DateTime (IFD0)
        dateStrOffset = view.getUint32(current + 8, little);
      }
      current += 12;
    }

    // Exif IFD에서 DateTimeOriginal (0x9003) 또는 DateTimeDigitized (0x9004) 탐색
    if (subIfdOffset > 0) {
      let subPos = tiffStart + subIfdOffset;
      const subEntries = view.getUint16(subPos, little);
      subPos += 2;
      for (let i = 0; i < subEntries; i++) {
        const tag = view.getUint16(subPos, little);
        if (tag === 0x9003 || tag === 0x9004) {
          dateStrOffset = view.getUint32(subPos + 8, little);
          break;
        }
        subPos += 12;
      }
    }

    if (dateStrOffset > 0) {
      const strPos = tiffStart + dateStrOffset;
      let str = '';
      for (let j = 0; j < 19 && strPos + j < view.byteLength; j++) {
        const ch = view.getUint8(strPos + j);
        if (ch === 0) break;
        str += String.fromCharCode(ch);
      }
      // "2024:05:12 14:32:05"
      const match = str.match(/^(\d{4}):(0[1-9]|1[0-2]):(0[1-9]|[12]\d)\s+([01]\d|2[0-3]):([0-5]\d):([0-5]\d)/);
      if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1;
        const d = parseInt(match[3], 10);
        const hh = parseInt(match[4], 10);
        const mm = parseInt(match[5], 10);
        const ss = parseInt(match[6], 10);
        const parsed = new Date(y, m, d, hh, mm, ss);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
          return parsed;
        }
      }
    }
  } catch {}
  return null;
}

interface MetadataScanSlices {
  headerBuffer: ArrayBuffer;
  allBuffers: ArrayBuffer[];
  allTexts: string[];
}

/**
 * 촬영일시 및 GPS 추출에 필요한 최소한의 헤더/moov/테일 슬라이스를 단 1회만 경량 로드 (최대 ~2MB 이하)
 * 기존에는 촬영일과 GPS에서 각각 최대 44MB 버퍼 + 88MB 문자열을 중복 생성하여 모바일 Safari OOM을 유발했음.
 */
async function loadMetadataScanSlices(file: File): Promise<MetadataScanSlices> {
  const moovBuffer = await extractMoovBuffer(file);
  const decoder = new TextDecoder('latin1');
  const moovText = moovBuffer ? decoder.decode(moovBuffer) : '';

  // moov가 이미 확보된 경우 EXIF/ftyp 확인용 256KB만 읽고, 없는 경우에도 512KB로 제한
  const maxHeaderBytes = moovBuffer ? 256 * 1024 : 512 * 1024;
  const headerChunkSize = Math.min(file.size, maxHeaderBytes);
  const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
  const headerText = decoder.decode(headerBuffer);

  let tailBuffer: ArrayBuffer | null = null;
  let tailText = '';
  if (file.size > headerChunkSize) {
    const maxTailBytes = moovBuffer ? 256 * 1024 : 512 * 1024;
    const tailSize = Math.min(file.size - headerChunkSize, maxTailBytes);
    const tailStart = file.size - tailSize;
    tailBuffer = await file.slice(tailStart).arrayBuffer();
    tailText = decoder.decode(tailBuffer);
  }

  return {
    headerBuffer,
    allBuffers: [moovBuffer, headerBuffer, tailBuffer].filter(Boolean) as ArrayBuffer[],
    allTexts: [moovText, headerText, tailText].filter(Boolean),
  };
}

/**
 * QuickTime / MP4 컨테이너의 moov/mvhd 박스 및 메타데이터 문자열에서 실제 촬영 일시를 파싱
 * 
 * [아이폰 모바일 Safari 및 구글 포토 웹 다운로드 대응]
 * - 구글 포토에서 다운로드하거나 iOS Photos에서 업로드할 때 file.lastModified는 "다운로드한 날짜"로 변경됨.
 * - 원본 촬영일시는 QuickTime com.apple.quicktime.creationdate, XMP 메타데이터, ISO 8601 문자열,
 *   mvhd/tkhd 박스 생성시간, 파일명 등에 안전하게 보존되어 있으므로 다단계로 정밀 파싱.
 */
export async function extractMediaRecordedDate(
  file: File,
  sharedSlices?: MetadataScanSlices
): Promise<Date> {
  try {
    const { headerBuffer, allBuffers, allTexts } =
      sharedSlices || (await loadMetadataScanSlices(file));

    // 1-A. [최우선 1순위] iPhone / Apple QuickTime 원본 촬영일시 태그 (com.apple.quicktime.creationdate)
    // iOS 카메라 앱이 기록하는 실제 촬영 일시 및 타임존 (+09:00 등)
    for (const text of allTexts) {
      const appleDate = findDateAfterKey(text, 'com.apple.quicktime.creationdate');
      if (appleDate) return appleDate;
    }

    // 1-B. [2순위] QuickTime User Data ©day 태그
    for (const text of allTexts) {
      const dayDate = findDateAfterKey(text, '\xa9day') || findDateAfterKey(text, '©day');
      if (dayDate) return dayDate;
    }

    // 1-C. [3순위] 버퍼 내 ISO 8601 및 메타데이터(XMP, Android, Google Photos) 타임스탬프 전역 스캔
    for (const text of allTexts) {
      const isoDate = findIsoDateInText(text);
      if (isoDate) return isoDate;
    }

    // 1-D. [4순위] EXIF 바이너리 DateTimeOriginal / CreateDate (사진 및 일부 비디오)
    const exifDate = parseExifDate(headerBuffer);
    if (exifDate) return exifDate;

    // 1-E. [5순위] QuickTime / MP4 mvhd, tkhd, mdhd 컨테이너 생성 시간 파싱
    for (const buf of allBuffers) {
      const headerDates = findMp4HeaderDates(new DataView(buf));
      if (headerDates.length > 0) {
        // 가장 오래된 유효 일시 채택
        headerDates.sort((a, b) => a.getTime() - b.getTime());
        return headerDates[0];
      }
    }

    // 1-F. [6순위] 파일명에서 날짜 패턴 파싱 (카톡 다운로드, 갤럭시 포맷, 클라우드 다운로드 등)
    const filenameDate = parseDateFromFilename(file.name);
    if (filenameDate) {
      return filenameDate;
    }
  } catch (err) {
    console.debug('[videoMetadata] 촬영일 메타데이터 파싱 건너뜀 (fallback으로 전환):', err);
  }

  // 2. 파일 시스템 수정일 (lastModified) fallback (데스크톱 원본 파일 보존 시 유효)
  if (file.lastModified) {
    return new Date(file.lastModified);
  }

  return new Date();
}

/**
 * 파일명(filename)에서 촬영일 추출 시도 (구글 포토, 카톡, 갤럭시, 아이폰 다운로드 등 메타데이터가 손실된 파일 지원)
 */
export function parseDateFromFilename(filename: string): Date | null {
  if (!filename) return null;

  // 1. 표준 날짜+시간 패턴: YYYY-MM-DD[-_ ]HHmmss 또는 YYYYMMDD[-_ ]HHmmss 또는 YYYY.MM.DD
  // 예: VID_20241109_143205.mp4, 2024-11-09 14.32.05.mp4, PXL_20241109_143205123.mp4, Screenshot_20241109-143205.png
  const m1 = filename.match(
    /(?:VID_|IMG_|PXL_|MOV_|Screenshot_|Photos-\d+_|kakaotalk_|signal-)?(\d{4})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d)(?:[-_\s.]?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2}))?/i
  );
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

  // 2. Unix timestamp (밀리초 13자리: 1731140000000, 2020~2035년 사이)
  const mEpochMs = filename.match(/\b(1[6-9]\d{11})\b/);
  if (mEpochMs) {
    const ms = parseInt(mEpochMs[1], 10);
    const dt = new Date(ms);
    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2020 && dt.getFullYear() <= 2040) {
      return dt;
    }
  }

  // 3. Unix timestamp (초 10자리: 1731140000, 2020~2035년 사이)
  const mEpochSec = filename.match(/\b(1[6-9]\d{8})\b/);
  if (mEpochSec) {
    const sec = parseInt(mEpochSec[1], 10);
    const dt = new Date(sec * 1000);
    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2020 && dt.getFullYear() <= 2040) {
      return dt;
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
export async function extractGpsFromVideoFile(
  file: File,
  sharedSlices?: MetadataScanSlices
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { headerBuffer, allTexts } =
      sharedSlices || (await loadMetadataScanSlices(file));

    const iso6709Regex = /([+-]\d{2,3}\.\d{3,})([+-]\d{2,3}\.\d{3,})/;

    // 1. Apple QuickTime location 메타데이터 키 검색 (최대 64KB 범위 스캔)
    for (const text of allTexts) {
      const locKeyIdx = text.indexOf('com.apple.quicktime.location.ISO6709');
      if (locKeyIdx !== -1) {
        const chunk = text.slice(locKeyIdx + 36, locKeyIdx + 65536);
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
        const chunk = text.slice(xyzKeyIdx + 4, xyzKeyIdx + 1024);
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
  let sharedSlices: MetadataScanSlices | undefined = undefined;
  try {
    sharedSlices = await loadMetadataScanSlices(file);
  } catch {}

  const recordedDate = await extractMediaRecordedDate(file, sharedSlices);
  const { dateStr, fullDateStr, recordedTimestamp } = formatVideoDate(file, pattern, recordedDate);
  const gps = await extractGpsFromVideoFile(file, sharedSlices);

  let visualMeta: ParsedMp4VisualMeta | null = null;
  if (sharedSlices) {
    for (const buf of sharedSlices.allBuffers) {
      visualMeta = findMp4VisualMeta(new DataView(buf));
      if (visualMeta) break;
    }
    sharedSlices.allTexts.length = 0;
    sharedSlices.allBuffers.length = 0;
    sharedSlices = undefined;
  }

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
    duration: visualMeta?.duration,
    width: visualMeta?.width,
    height: visualMeta?.height,
    rotation: visualMeta?.rotation,
  };
}
