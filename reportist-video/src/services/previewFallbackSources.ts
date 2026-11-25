// services/previewFallbackSources.ts
// 미리보기 <video>가 디코더를 잃었을 때 검은 화면 대신 그릴 이미지 소스 캐시.
//
// 1단계: 이미 분석 중 구워 둔 원본 썸네일(data/blob URL)을 즉시 <img>로 그린다.
// 2단계: 썸네일이 없고 <video>가 복구 불가 판정된 영상은 WebCodecs로 해당 컷
//        시점의 키프레임을 1회 디코딩해 data URL로 캐시한 뒤 그린다.
// 두 소스 모두 previewCompositorBase.drawCompositorCoverFrame의 공용 크롭 수학을 쓴다.

import { decodeKeyframesNearTimes } from './mp4KeyframeDecoder.ts';

const loadedThumbnails = new Map<string, HTMLImageElement>();
const loadingThumbnails = new Map<string, HTMLImageElement>();
const decodedFrames = new Map<string, string>();
const pendingDecodes = new Map<string, Promise<void>>();

/**
 * URL에 대응하는 로딩 완료 <img>를 반환한다. 아직이면 비동기 로드를 시작하고
 * null을 돌려 호출자가 다른 폴백을 시도하도록 한다. 로드 완료 시 onReady로 재그리기를 요청한다.
 */
export function getCachedThumbnail(
  url: string | undefined | null,
  onReady: () => void
): HTMLImageElement | null {
  if (!url) return null;

  const cached = loadedThumbnails.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;

  let image = loadingThumbnails.get(url);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      loadingThumbnails.delete(url);
      loadedThumbnails.set(url, image!);
      onReady();
    };
    image.onerror = () => {
      loadingThumbnails.delete(url);
    };
    image.src = url;
    loadingThumbnails.set(url, image);
  }
  return null;
}

/** 이미 디코딩되어 캐시된 WebCodecs 프레임 data URL. */
export function getCachedCodecFrame(key: string): string | undefined {
  return decodedFrames.get(key);
}

/**
 * <video> 재생 불가 영상의 컷 시점 키프레임을 WebCodecs로 1회 디코딩한다.
 * 동일 key(영상+컷) 요청은 중복 디코딩하지 않고 기존 Promise를 재사용한다.
 */
export function requestCodecFrame(
  key: string,
  file: Blob,
  timeSec: number,
  rotationOffset: number | undefined,
  targetWidth: number,
  onReady: () => void
): void {
  if (decodedFrames.has(key) || pendingDecodes.has(key)) return;

  const promise = decodeKeyframesNearTimes(file, [timeSec], {
    targetWidth: Math.max(2, Math.min(targetWidth, 540)),
    rotationOffset,
    timeoutMs: 8_000,
  })
    .then((frames) => {
      const url = frames?.[0]?.dataUrl;
      if (url) {
        decodedFrames.set(key, url);
        onReady();
      }
    })
    .catch(() => {
      /* 디코딩 실패 시 썸네일 폴백도 없으면 검은 배경 + 자막이 유지된다. */
    })
    .finally(() => {
      pendingDecodes.delete(key);
    });

  pendingDecodes.set(key, promise);
}
