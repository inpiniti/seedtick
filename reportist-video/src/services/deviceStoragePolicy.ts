// src/services/deviceStoragePolicy.ts - 기기(모바일/데스크톱)별 환경 판별 단일 소스
//
// 모바일 Safari(iOS)와 데스크톱은 동일하게 IndexedDB `project_media` 스토어에
// 미디어 Blob을 저장하되(쓰기-once), 데스크톱 + OPFS 지원 환경은 OPFS를 우선 사용한다.
// 어떤 경우에도 대용량 Blob을 `projects` 레코드에 인라인 직렬화하지 않는다.

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
