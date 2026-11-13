// src/services/deviceStoragePolicy.ts - 기기(모바일/데스크톱)별 영상 보관 정책 단일 소스
//
// 모바일 Safari(iOS)는 대용량 Blob을 IndexedDB/OPFS에 반복 기록할 때
// 탭 OOM과 Safari 앱 용량 폭증이 발생한다. 따라서 모바일에서는 원본 영상을
// 기기에 보관하지 않고, 편집 메타데이터와 소용량 완성본만 별도로 유지한다.

/**
 * 모바일(iOS/Android) 환경 여부.
 * iPadOS 13+는 데스크톱 UA(MacIntel)로 보고되므로 터치 포인트로 함께 판별한다.
 */
export function isMobileStorageEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * 모바일에서 완성본 비디오 1개를 보관할 최대 크기.
 * 이 한도를 넘는 완성본은 IndexedDB/OPFS에 기록하지 않는다.
 */
export const MOBILE_FINAL_RESULT_MAX_BYTES = 60 * 1024 * 1024;

/**
 * 모바일에서 기기에 보관하는 최근 완성본 프로젝트 수.
 * 오래된 프로젝트의 완성본은 자동으로 정리하고 편집 메타데이터만 남긴다.
 */
export const MOBILE_FINAL_RESULT_KEEP_COUNT = 2;
