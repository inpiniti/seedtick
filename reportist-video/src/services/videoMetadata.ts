// services/videoMetadata.ts - 영상 메타데이터(촬영일자, GPS 좌표) 추출 유틸리티

export interface VideoMetadata {
  dateStr: string; // e.g. "9월 10일"
  fullDateStr: string; // e.g. "2024년 9월 10일"
  latitude?: number;
  longitude?: number;
  locationQuery?: string;
}

/**
 * 동영상 파일에서 촬영 날짜를 안정적으로 포맷팅
 */
export function formatVideoDate(file: File): { dateStr: string; fullDateStr: string } {
  const timestamp = file.lastModified || Date.now();
  const d = new Date(timestamp);
  
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();

  return {
    dateStr: `${month}월 ${day}일`,
    fullDateStr: `${year}년 ${month}월 ${day}일`,
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
 * 파일 정보 종합 추출
 */
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  const { dateStr, fullDateStr } = formatVideoDate(file);
  const gps = await extractGpsFromVideoFile(file);

  return {
    dateStr,
    fullDateStr,
    latitude: gps?.latitude,
    longitude: gps?.longitude,
    locationQuery: gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : undefined,
  };
}
