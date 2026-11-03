// services/videoMetadata.ts - 영상 메타데이터(촬영일자, GPS 좌표) 추출 유틸리티
import { useState, useCallback } from 'react';

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

export interface VideoMetadata {
  dateStr: string; // e.g. "2026.11.03"
  fullDateStr: string; // e.g. "2026년 11월 3일"
  recordedTimestamp?: number;
  latitude?: number;
  longitude?: number;
  locationQuery?: string;
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
 * 날짜 문자열(다양한 포맷)에서 Date 객체 파싱
 */
export function parseDateFromString(str: string): Date | null {
  if (!str) return null;
  const clean = stripAgeFromDate(str);

  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY년 M월 D일
  const koYmd = clean.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koYmd) {
    const d = new Date(parseInt(koYmd[1], 10), parseInt(koYmd[2], 10) - 1, parseInt(koYmd[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // MM/DD/YYYY or DD/MM/YYYY
  const slash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const d = new Date(parseInt(slash[3], 10), parseInt(slash[1], 10) - 1, parseInt(slash[2], 10));
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;
  return null;
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
export async function extractMediaRecordedDate(file: File): Promise<Date> {
  try {
    // 1. MP4 / MOV / 사진 파일의 헤더 (처음 2MB)
    const headerChunkSize = Math.min(file.size, 1024 * 1024 * 2);
    const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    const view = new DataView(headerBuffer);

    // 1-A. MP4 / QuickTime mvhd 박스 파싱
    // mvhd 네 바이트: 'm'(0x6D), 'v'(0x76), 'h'(0x68), 'd'(0x64)
    for (let i = 0; i < bytes.length - 16; i++) {
      if (
        bytes[i] === 0x6d &&
        bytes[i + 1] === 0x76 &&
        bytes[i + 2] === 0x68 &&
        bytes[i + 3] === 0x64
      ) {
        const version = view.getUint8(i + 4);
        let creationSec = 0;
        if (version === 0) {
          creationSec = view.getUint32(i + 8, false); // big-endian
        } else if (version === 1 && i + 16 < bytes.length) {
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

    // 1-B. iPhone / Android QuickTime text 메타데이터 (com.apple.quicktime.creationdate 또는 ©day)
    const decoder = new TextDecoder('latin1');
    const headerText = decoder.decode(headerBuffer);

    const appleMatch = headerText.match(
      /com\.apple\.quicktime\.creationdate[^\d]*(\d{4}[-/.][01]\d[-/.][0-3]\d(?:[T\s][0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:[+-][0-2]\d:?[0-5]\d|Z)?)?)/i
    );
    if (appleMatch && appleMatch[1]) {
      const parsed = new Date(appleMatch[1]);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
        return parsed;
      }
    }

    // 1-C. EXIF DateTimeOriginal (JPEG/사진 또는 비디오 EXIF 태그): "YYYY:MM:DD HH:MM:SS"
    const exifMatch = headerText.match(
      /(\d{4}):(0[1-9]|1[0-2]):(0[1-9]|[12]\d|3[01])\s+([01]\d|2[0-3]):([0-5]\d):([0-5]\d)/
    );
    if (exifMatch) {
      const [, y, m, d, hh, mm, ss] = exifMatch;
      const parsed = new Date(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss)
      );
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
        return parsed;
      }
    }

    // 1-D. 파일 끝부분(tail 1MB)에서도 QuickTime moov가 있을 수 있음
    if (file.size > headerChunkSize) {
      const tailStart = Math.max(0, file.size - 1024 * 1024);
      const tailBuffer = await file.slice(tailStart).arrayBuffer();
      const tailText = decoder.decode(tailBuffer);

      const tailAppleMatch = tailText.match(
        /com\.apple\.quicktime\.creationdate[^\d]*(\d{4}[-/.][01]\d[-/.][0-3]\d(?:[T\s][0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:[+-][0-2]\d:?[0-5]\d|Z)?)?)/i
      );
      if (tailAppleMatch && tailAppleMatch[1]) {
        const parsed = new Date(tailAppleMatch[1]);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2040) {
          return parsed;
        }
      }

      // Tail mvhd
      const tailBytes = new Uint8Array(tailBuffer);
      const tailView = new DataView(tailBuffer);
      for (let i = 0; i < tailBytes.length - 16; i++) {
        if (
          tailBytes[i] === 0x6d &&
          tailBytes[i + 1] === 0x76 &&
          tailBytes[i + 2] === 0x68 &&
          tailBytes[i + 3] === 0x64
        ) {
          const version = tailView.getUint8(i + 4);
          let creationSec = 0;
          if (version === 0) {
            creationSec = tailView.getUint32(i + 8, false);
          } else if (version === 1 && i + 16 < tailBytes.length) {
            creationSec = Number(tailView.getBigUint64(i + 8, false));
          }
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
    }
  } catch (err) {
    console.debug('[videoMetadata] 촬영일 메타데이터 파싱 건너뜀 (fallback으로 전환):', err);
  }

  // 2. 파일 시스템 수정일 (lastModified) fallback
  if (file.lastModified) {
    return new Date(file.lastModified);
  }

  return new Date();
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
 * MP4 / MOV 파일의 메타데이터(QuickTime / ISO Base Media Format)에서 GPS 좌표를 파싱
 * iPhone / Android 영상에 기록된 ISO 6709 좌표 포맷 (예: +35.1587+129.1604/ 또는 +37.5665+126.9780)을 검색
 */
export async function extractGpsFromVideoFile(file: File): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // moov atom은 파일 앞단(Fast-start) 또는 뒷단에 위치할 수 있으므로 처음 2MB와 끝 1MB를 검색
    const headerChunkSize = Math.min(file.size, 1024 * 1024 * 2);
    const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const headerText = decoder.decode(headerBuffer);

    // ISO 6709 패턴: +/-DD.DDDD+/-DDD.DDDD (위도, 경도)
    const iso6709Regex = /([+-]\d{2}\.\d{3,})([+-]\d{3}\.\d{3,})/;
    let match = headerText.match(iso6709Regex);

    if (!match && file.size > headerChunkSize) {
      const tailStart = Math.max(0, file.size - 1024 * 1024);
      const tailBuffer = await file.slice(tailStart).arrayBuffer();
      const tailText = decoder.decode(tailBuffer);
      match = tailText.match(iso6709Regex);
    }

    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch (err) {
    console.debug('[videoMetadata] GPS 좌표 추출 건너뜀 (메타데이터 미포함):', err);
  }

  return null;
}

/**
 * 파일 정보 종합 추출 (실제 촬영일 메타데이터 및 GPS)
 */
export async function extractVideoMetadata(
  file: File,
  pattern: DateFormatOption = getStoredDateFormat()
): Promise<VideoMetadata> {
  const recordedDate = await extractMediaRecordedDate(file);
  const { dateStr, fullDateStr, recordedTimestamp } = formatVideoDate(file, pattern, recordedDate);
  const gps = await extractGpsFromVideoFile(file);

  return {
    dateStr,
    fullDateStr,
    recordedTimestamp,
    latitude: gps?.latitude,
    longitude: gps?.longitude,
    locationQuery: gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : undefined,
  };
}
