// services/videoStitcherWebCodecs.ts - GPU 하드웨어 가속(WebCodecs) 기반 고화질 60fps 무결점 비디오 병합 엔진
// VideoEncoder + mp4-muxer + OfflineAudioContext를 활용하여 실시간 녹화의 프레임 누락(Stuttering)을 완전 제거합니다.

import { Muxer } from 'mp4-muxer';
import { createExportMuxerTarget } from './exportMuxerTarget.ts';
import type { ExportResolution, FinalVideoResult, HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';
import {
  CHAPTER_BRIDGE_DURATION,
  computeBridgeDurationMap,
  createHyperframesBridgeController,
  evaluateChapterBridge,
} from './hyperframesBridgeRenderer.ts';
import {
  renderHyperframesIntroFrame,
  renderHyperframesOutroFrame,
  DEFAULT_INTRO_DURATION,
  DEFAULT_OUTRO_DURATION,
} from './hyperframesIntroOutroRenderer.ts';
import { scheduleBgmSynthTrack } from './audioSynth.ts';

export interface StitchVideosWebCodecsParams {
  videos: VideoItem[];
  allSegments: HighlightSegment[];
  onProgress?: (progressPercent: number, currentMessage: string) => void;
  onLog?: (message: string) => void;
  signal?: AbortSignal;
  bgmPresetId?: string;
  bgmVolume?: number;
  customAudioFile?: File | null;
  overlayOptions?: VideoOverlayOptions;
  resolution?: ExportResolution;
}

/**
 * 브라우저 환경에서 WebCodecs(VideoEncoder, VideoFrame) 지원 여부 확인
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof VideoEncoder === 'function' &&
    typeof VideoFrame === 'function'
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const IS_MOBILE =
  typeof navigator !== 'undefined' &&
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: DOMHighResTimeStamp, metadata: { mediaTime: number; presentedFrames: number }) => void
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

// 비디오 시크 후 실제 디코딩된 프레임이 GPU 텍스처에 올라올 때까지 대기하는 정밀 시크 헬퍼
function seekVideoElement(video: HTMLVideoElement, time: number, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const targetTime = Math.max(0, time);
    if (Math.abs(video.currentTime - targetTime) < 0.0005 && video.readyState >= 2 && !video.seeking) {
      resolve(true);
      return;
    }

    const vRvfc = video as VideoWithRvfc;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let rvfcHandle: number | null = null;
    let rvfcFired = false;

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      if (timer) clearTimeout(timer);
      if (rvfcHandle !== null && typeof vRvfc.cancelVideoFrameCallback === 'function') {
        try {
          vRvfc.cancelVideoFrameCallback(rvfcHandle);
        } catch {}
      }
    };

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    if (typeof vRvfc.requestVideoFrameCallback === 'function') {
      try {
        rvfcHandle = vRvfc.requestVideoFrameCallback(() => {
          rvfcFired = true;
          if (!video.seeking && video.readyState >= 2) {
            finish(true);
          }
        });
      } catch {}
    }

    const onSeeked = () => {
      if (rvfcFired) {
        finish(true);
        return;
      }
      // seeked 직후 컴포지터가 새 비디오 텍스처를 바인딩할 시간을 1프레임 보장
      requestAnimationFrame(() => {
        finish(true);
      });
    };

    const onError = () => finish(false);
    timer = setTimeout(() => finish(Math.abs(video.currentTime - targetTime) < 0.25), timeoutMs);

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    try {
      video.currentTime = targetTime;
    } catch {
      finish(false);
    }
  });
}

function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 6000): Promise<boolean> {
  if (video.readyState >= 3 && !video.seeking) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('playing', onReady);
      if (timer) clearTimeout(timer);
      resolve(ok);
    };
    const onReady = () => finish(true);
    timer = setTimeout(() => finish(video.readyState >= 2), timeoutMs);
    video.addEventListener('canplay', onReady);
    video.addEventListener('canplaythrough', onReady);
    video.addEventListener('playing', onReady);
  });
}

async function startVideoPlayback(video: HTMLVideoElement, timeoutMs = 4000): Promise<boolean> {
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.playsInline = true;
  video.playbackRate = 1.0;

  let playPromise: Promise<void>;
  try {
    playPromise = video.play();
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(!video.paused);
    }, timeoutMs);

    playPromise
      .then(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(true);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(false);
      });
  });
}

function waitForPlaybackAdvance(video: HTMLVideoElement, fromTime: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const vRvfc = video as VideoWithRvfc;
    let settled = false;
    let rvfcId: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.removeEventListener('timeupdate', check);
      if (intervalId) clearInterval(intervalId);
      if (timerId) clearTimeout(timerId);
      if (rvfcId !== null && typeof vRvfc.cancelVideoFrameCallback === 'function') {
        try {
          vRvfc.cancelVideoFrameCallback(rvfcId);
        } catch {}
      }
      resolve(ok);
    };

    const check = () => {
      if (video.currentTime > fromTime + 0.008 || video.ended) {
        finish(true);
      }
    };

    if (typeof vRvfc.requestVideoFrameCallback === 'function') {
      try {
        rvfcId = vRvfc.requestVideoFrameCallback((_, meta) => {
          if (meta.mediaTime >= fromTime) {
            finish(true);
          }
        });
      } catch {}
    }

    timerId = setTimeout(() => finish(video.currentTime > fromTime + 0.004), timeoutMs);
    video.addEventListener('timeupdate', check);
    intervalId = setInterval(check, 16);
  });
}

function waitForEncoderQueueBelow(encoder: VideoEncoder, maxQueueSize: number): Promise<void> {
  if (encoder.encodeQueueSize <= maxQueueSize) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      encoder.removeEventListener('dequeue', onDequeue);
      if (timer) clearTimeout(timer);
      resolve();
    };
    const onDequeue = () => {
      if (encoder.encodeQueueSize <= maxQueueSize) {
        finish();
      }
    };
    encoder.addEventListener('dequeue', onDequeue);
    timer = setTimeout(finish, 60);
  });
}

function loadVideoSource(video: HTMLVideoElement, url: string, timeoutMs = 12000): Promise<void> {
  if (video.src === url && video.readyState >= 1) return Promise.resolve();

  if (url.startsWith('blob:')) {
    video.removeAttribute('crossorigin');
    video.crossOrigin = null;
  } else {
    video.crossOrigin = 'anonymous';
    video.setAttribute('crossorigin', 'anonymous');
  }

  video.src = url;
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  try {
    video.load();
  } catch {}

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      if (timer) clearTimeout(timer);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`비디오 로드 실패 (code=${video.error?.code})`));
    };
    timer = setTimeout(() => {
      cleanup();
      if (video.readyState >= 1) resolve();
      else reject(new Error('비디오 메타데이터 로드 타임아웃'));
    }, timeoutMs);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

/**
 * WebCodecs GPU 가속 비디오 스티처
 */
export async function stitchVideosWebCodecs({
  videos,
  allSegments,
  onProgress,
  onLog,
  signal,
  bgmPresetId,
  bgmVolume = 0.35,
  customAudioFile,
  overlayOptions,
  resolution,
}: StitchVideosWebCodecsParams): Promise<FinalVideoResult> {
  if (allSegments.length === 0) {
    throw new Error('이어붙일 하이라이트 구간이 없습니다.');
  }

  // 페이지 내 다른 비디오가 하드웨어 디코더 리소스를 점유하지 않도록 일시정지 및 소스 임시 분리
  // (iOS WebKit은 프로세스당 하드웨어 비디오 디코더 슬롯이 극도로 제한되어 있어,
  // DOM의 프리뷰 <video>가 src를 물고 있으면 workerVideo가 소프트웨어 폴백되거나 심각한 프레임 드랍이 발생함)
  const suspendedDomVideos: Array<{
    el: HTMLVideoElement;
    srcAttr: string | null;
    currentTime: number;
  }> = [];

  if (typeof document !== 'undefined') {
    try {
      document.querySelectorAll('video').forEach((v) => {
        try {
          if (!v.paused) v.pause();
          const srcAttr = v.getAttribute('src');
          if (srcAttr) {
            suspendedDomVideos.push({
              el: v,
              srcAttr,
              currentTime: v.currentTime || 0,
            });
            v.removeAttribute('src');
            v.load();
          }
        } catch {}
      });
    } catch {}
  }

  // 해상도 결정: 전달된 옵션이 있거나, 없으면 데스크톱은 1080p, 모바일은 720p 권장 기본값
  const is1080p = resolution === '1080p' || (!resolution && !IS_MOBILE);
  const targetResolution: ExportResolution = is1080p ? '1080p' : '720p';
  const targetWidth = is1080p ? 1920 : 1280;
  const targetHeight = is1080p ? 1080 : 720;
  const scale = targetWidth / 1280; // 1.0 (720p) vs 1.5 (1080p)

  // 모바일/아이폰은 배터리 및 하드웨어 디코더 부하를 줄이고 인코딩 속도를 2배 단축하기 위해 30fps 적용, 데스크톱은 60fps 고주사율 유지
  const targetFps = IS_MOBILE ? 30 : 60;
  const targetBitrate = is1080p
    ? (IS_MOBILE ? 9_000_000 : 18_000_000)
    : (IS_MOBILE ? 4_500_000 : 10_000_000);
  const frameDurationMicros = Math.round(1_000_000 / targetFps);
  const queueBackpressureThreshold = IS_MOBILE ? 10 : 24;

  onLog?.(
    `🚀 WebCodecs GPU 하드웨어 가속 비디오 렌더러 시작 (${targetResolution} ${targetWidth}x${targetHeight} · ${targetFps}fps · ${
      IS_MOBILE ? '모바일 전력/메모리 최적화 모드' : '데스크톱 60fps 최고화질 모드'
    })`
  );

  // 모바일 병합 중 화면 꺼짐 방지 (Screen Wake Lock)
  let wakeLock: WakeLockSentinel | null = null;
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    };
    if (nav.wakeLock?.request) {
      wakeLock = await nav.wakeLock.request('screen');
    }
  } catch {}

  // 1. 비디오 맵 구성
  const videoMap = new Map<string, VideoItem>();
  for (const v of videos) {
    videoMap.set(v.id, v);
  }

  // 2. 렌더링 캔버스 생성 (iOS/WebKit에서 desynchronized: true는 VideoFrame 복사 시 텍스처 동기화 누락/티어링을 유발할 수 있으므로 표준 2D 컨텍스트 사용)
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스 2D 컨텍스트를 생성할 수 없습니다.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = IS_MOBILE ? 'medium' : 'high';

  // 3. 작업용 비디오 엘리먼트 (뷰포트 내부 우측 하단에 양수 z-index로 배치하여 iOS WebKit/Chromium의 백그라운드 레이어 디코더 스로틀링 원천 차단!)
  const workerVideo = document.createElement('video');
  workerVideo.muted = true;
  workerVideo.defaultMuted = true;
  workerVideo.volume = 0;
  workerVideo.playsInline = true;
  workerVideo.preload = 'auto';
  workerVideo.setAttribute('playsinline', '');
  workerVideo.setAttribute('webkit-playsinline', '');
  workerVideo.setAttribute('muted', '');
  workerVideo.style.cssText =
    'position:fixed;right:0;bottom:0;width:16px;height:16px;opacity:0.015;pointer-events:none;z-index:99998;';
  document.body.appendChild(workerVideo);

  // 4. 세그먼트별 오버레이 캔버스 단일 재사용 (100개 세그먼트 시 1.6GB 캔버스 사전 할당 대신 단 1개의 오프스크린 캔버스만 덮어쓰기)
  const sharedOverlayCanvas = document.createElement('canvas');
  sharedOverlayCanvas.width = targetWidth;
  sharedOverlayCanvas.height = targetHeight;
  const sharedOverlayCtx = sharedOverlayCanvas.getContext('2d');

  const renderSegmentOverlayToSharedCanvas = (currentSegment?: HighlightSegment): HTMLCanvasElement | null => {
    if (!overlayOptions || !sharedOverlayCtx) return null;
    const oCtx = sharedOverlayCtx;
    oCtx.clearRect(0, 0, targetWidth, targetHeight);

    let hasAnyOverlay = false;
    let titleBottomY = Math.round(28 * scale);
    const hasTitle = Boolean(overlayOptions.showTitle && overlayOptions.titleText?.trim());

    if (hasTitle) {
      hasAnyOverlay = true;
      oCtx.save();
      const titleFont = Math.round(22 * scale);
      oCtx.font = `bold ${titleFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      const text = overlayOptions.titleText || '';
      const metrics = oCtx.measureText(text);
      const padX = Math.round(14 * scale);
      const boxW = metrics.width + padX * 2;
      const boxH = Math.round(38 * scale);
      const x = Math.round(32 * scale);
      const y = Math.round(28 * scale);
      const roundR = Math.round(6 * scale);

      oCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      oCtx.beginPath();
      if (typeof oCtx.roundRect === 'function') {
        oCtx.roundRect(x, y, boxW, boxH, roundR);
      } else {
        oCtx.rect(x, y, boxW, boxH);
      }
      oCtx.fill();

      oCtx.fillStyle = '#ffffff';
      oCtx.textAlign = 'left';
      oCtx.textBaseline = 'middle';
      oCtx.fillText(text, x + padX, y + boxH / 2);
      oCtx.restore();

      titleBottomY = y + boxH;
    }

    const datePart =
      overlayOptions.showDate === false
        ? ''
        : currentSegment?.subtitleDate || overlayOptions.subtitleDateText || '';
    const locPart = currentSegment?.locationName || overlayOptions.subtitleLocationText || '';
    const metaParts = [datePart, locPart].filter(Boolean);
    const metaText = metaParts.join(' • ');

    if (metaText) {
      hasAnyOverlay = true;
      oCtx.save();
      const metaFont = Math.round(16 * scale);
      oCtx.font = `600 ${metaFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      oCtx.fillStyle = '#ffffff';
      oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      oCtx.shadowBlur = Math.round(4 * scale);
      oCtx.shadowOffsetX = 0;
      oCtx.shadowOffsetY = Math.round(1.5 * scale);
      oCtx.textAlign = 'left';
      oCtx.textBaseline = 'top';

      const metaX = hasTitle ? Math.round(34 * scale) : Math.round(32 * scale);
      const metaY = hasTitle ? titleBottomY + Math.round(7 * scale) : Math.round(28 * scale);
      oCtx.fillText(metaText, metaX, metaY);
      oCtx.restore();
    }

    if (overlayOptions.showChannel && overlayOptions.channelText) {
      hasAnyOverlay = true;
      oCtx.save();
      const chFont = Math.round(22 * scale);
      oCtx.font = `bold ${chFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      oCtx.fillStyle = '#ffffff';
      oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      oCtx.shadowBlur = Math.round(4 * scale);
      oCtx.shadowOffsetX = 0;
      oCtx.shadowOffsetY = Math.round(2 * scale);
      oCtx.textAlign = 'right';
      oCtx.textBaseline = 'middle';
      oCtx.fillText(overlayOptions.channelText, targetWidth - Math.round(32 * scale), Math.round(47 * scale));
      oCtx.restore();
    }

    if (overlayOptions.showSubtitle) {
      const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
      const subText = titlePart.trim();

      if (subText) {
        hasAnyOverlay = true;
        oCtx.save();
        const subFont = Math.round(24 * scale);
        oCtx.font = `bold ${subFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
        const metrics = oCtx.measureText(subText);
        const padX = Math.round(20 * scale);
        const boxW = metrics.width + padX * 2;
        const boxH = Math.round(46 * scale);
        const x = (targetWidth - boxW) / 2;
        const y = targetHeight - Math.round(76 * scale);
        const roundR = Math.round(8 * scale);

        oCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        oCtx.beginPath();
        if (typeof oCtx.roundRect === 'function') {
          oCtx.roundRect(x, y, boxW, boxH, roundR);
        } else {
          oCtx.rect(x, y, boxW, boxH);
        }
        oCtx.fill();

        oCtx.fillStyle = '#ffffff';
        oCtx.textAlign = 'center';
        oCtx.textBaseline = 'middle';
        oCtx.fillText(subText, targetWidth / 2, y + boxH / 2);
        oCtx.restore();
      }
    }

    return hasAnyOverlay ? sharedOverlayCanvas : null;
  };

  // 비디오 프레임 16:9 맞춤 스마트 크롭 드로잉
  const drawCoverFrame = (video: HTMLVideoElement, vItem?: VideoItem, segment?: HighlightSegment) => {
    const rawVW = video.videoWidth || vItem?.width || targetWidth;
    const rawVH = video.videoHeight || vItem?.height || targetHeight;
    const rotation = ((segment?.rotation ?? 0) % 360 + 360) % 360;

    const isSideways = rotation === 90 || rotation === 270;
    const vW = isSideways ? rawVH : rawVW;
    const vH = isSideways ? rawVW : rawVH;

    const targetAspect = targetWidth / targetHeight; // 16:9
    const srcAspect = vW / vH;

    const scale = Math.max(targetWidth / vW, targetHeight / vH);
    const renderW = vW * scale;
    const renderH = vH * scale;

    const offsetX = (targetWidth - renderW) / 2;
    let offsetY: number;

    if (vH > vW) {
      const excessHeight = renderH - targetHeight;
      const ratio = segment?.cropOffsetYRatio ?? 0.25;
      offsetY = -excessHeight * ratio;
    } else {
      offsetY = (targetHeight - renderH) / 2;
    }

    if (rotation === 0) {
      let sx = 0;
      let sy = 0;
      let sWidth = rawVW;
      let sHeight = rawVH;

      if (srcAspect > targetAspect) {
        sHeight = rawVH;
        sWidth = Math.round(rawVH * targetAspect);
        sx = Math.round((rawVW - sWidth) / 2);
        sy = 0;
      } else if (srcAspect < targetAspect) {
        sWidth = rawVW;
        sHeight = Math.round(rawVW / targetAspect);
        sx = 0;
        if (rawVH > rawVW) {
          const excessHeight = rawVH - sHeight;
          const ratio = segment?.cropOffsetYRatio ?? 0.25;
          sy = Math.round(excessHeight * ratio);
        } else {
          sy = Math.round((rawVH - sHeight) / 2);
        }
      }

      sx = Math.max(0, Math.min(sx, Math.max(0, rawVW - sWidth)));
      sy = Math.max(0, Math.min(sy, Math.max(0, rawVH - sHeight)));

      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, targetWidth, targetHeight);
      ctx.clip();

      const centerX = offsetX + renderW / 2;
      const centerY = offsetY + renderH / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);

      ctx.drawImage(
        video,
        (-rawVW * scale) / 2,
        (-rawVH * scale) / 2,
        rawVW * scale,
        rawVH * scale
      );
      ctx.restore();
    }
  };

  // 5. 총 예상 시간 및 브릿지 계산
  const plannedBridgeDurationMap = computeBridgeDurationMap(allSegments, overlayOptions);
  const totalPlannedBridgeDuration = Object.values(plannedBridgeDurationMap).reduce((sum, d) => sum + d, 0);
  const totalSegmentsDuration = allSegments.reduce((sum, s) => sum + s.duration, 0) + totalPlannedBridgeDuration;
  const actualBridgeDurationMap: Record<string, number> = {};
  const bridgeController = createHyperframesBridgeController(CHAPTER_BRIDGE_DURATION);

  // 6. Audio 준비 (Web Audio API OfflineAudioContext / AudioEncoder — 원본 비디오 오디오 + BGM 믹싱)
  const hasAudioSource = true;

  let audioEncoder: AudioEncoder | null = null;
  let audioDataAvailable = false;
  const audioSampleRate = 48000;
  const audioChannels = 2;

  // 7. Muxer 인스턴스 생성 (지원 시 OPFS 디스크 스트리밍, 미지원 시 메모리 버퍼)
  const exportTarget = await createExportMuxerTarget();
  const muxer = new Muxer({
    target: exportTarget.target,
    video: {
      codec: 'avc',
      width: targetWidth,
      height: targetHeight,
    },
    audio: hasAudioSource && typeof AudioEncoder === 'function' ? {
      codec: 'aac',
      numberOfChannels: audioChannels,
      sampleRate: audioSampleRate,
    } : undefined,
    fastStart: exportTarget.fastStart,
    firstTimestampBehavior: 'offset',
  });

  // 8. VideoEncoder 초기화
  let videoEncoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      // mp4-muxer v5.2.2+: decoderConfig.colorSpace가 null이면 colr() 박스 생성 시 크래시 발생.
      // null → undefined로 정규화해 muxer 내부 `colorSpace ? colr(track) : null` 조건이 올바르게 동작하도록 한다.
      if (meta?.decoderConfig && meta.decoderConfig.colorSpace === null) {
        (meta.decoderConfig as { colorSpace: undefined }).colorSpace = undefined;
      }
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error('[WebCodecs] VideoEncoder error:', e);
      videoEncoderError = new Error(e.message || 'VideoEncoder 인코딩 오류');
    },
  });

  // 고품질 H.264 하드웨어 가속 설정
  // 1080p 60fps는 Level 4.2 (avc1.64002a), 1080p 30fps/720p 60fps는 Level 4.0 (avc1.640028)
  const candidateCodecs = is1080p
    ? ['avc1.64002a', 'avc1.640028', 'avc1.4d4028', 'avc1.420028', 'avc1.42001f']
    : ['avc1.640028', 'avc1.4d401f', 'avc1.42001f'];

  let chosenCodec = is1080p ? 'avc1.640028' : 'avc1.640028';
  for (const c of candidateCodecs) {
    const probeConfig: VideoEncoderConfig = {
      codec: c,
      width: targetWidth,
      height: targetHeight,
      bitrate: targetBitrate,
      framerate: targetFps,
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'avc' },
    };
    try {
      const probeSupport = await VideoEncoder.isConfigSupported(probeConfig);
      if (probeSupport.supported) {
        chosenCodec = c;
        break;
      }
    } catch {}
  }

  const videoEncoderConfig: VideoEncoderConfig = {
    codec: chosenCodec,
    width: targetWidth,
    height: targetHeight,
    bitrate: targetBitrate,
    framerate: targetFps,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' },
  };
  videoEncoder.configure(videoEncoderConfig);

  // 9. 오디오 인코더 설정
  if (hasAudioSource && typeof AudioEncoder === 'function') {
    try {
      const audioConfig: AudioEncoderConfig = {
        codec: 'mp4a.40.2', // AAC-LC
        sampleRate: audioSampleRate,
        numberOfChannels: audioChannels,
        bitrate: 192_000, // 192kbps
      };
      const audioSupport = await AudioEncoder.isConfigSupported(audioConfig);
      if (audioSupport.supported) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            muxer.addAudioChunk(chunk, meta);
          },
          error: (e) => {
            console.warn('[WebCodecs] AudioEncoder warning:', e);
          },
        });
        audioEncoder.configure(audioConfig);
        audioDataAvailable = true;
      }
    } catch (err) {
      console.warn('[WebCodecs] AudioEncoder 초기화 건너뜀 (무음 처리):', err);
    }
  }

  let totalFramesEncoded = 0;
  let currentTimestampMicros = 0;

  // 프레임 푸시 헬퍼 (캔버스를 VideoFrame으로 변환 후 인코더에 푸시)
  // 주의: 스트림 중간에 videoEncoder.flush()를 호출하면 하드웨어 H.264 레퍼런스/B-프레임 파이프라인이
  // 강제 드레인되어 20~50ms 블로킹 및 끊김이 발생하므로, dequeue 이벤트 기반 비차단 백프레셔만 사용!
  const pushCanvasFrame = async (isKeyFrame = false) => {
    if (signal?.aborted) throw new Error('작업 취소');
    if (videoEncoderError) throw videoEncoderError;

    const frame = new VideoFrame(canvas, {
      timestamp: currentTimestampMicros,
      duration: frameDurationMicros,
    });

    videoEncoder.encode(frame, { keyFrame: isKeyFrame || totalFramesEncoded % (targetFps * 2) === 0 });
    frame.close(); // GPU 메모리 누수 방지

    totalFramesEncoded++;
    currentTimestampMicros += frameDurationMicros;

    if (videoEncoder.encodeQueueSize > queueBackpressureThreshold) {
      await waitForEncoderQueueBelow(videoEncoder, Math.max(4, queueBackpressureThreshold >> 1));
    }
  };

  // 진행률 보고 헬퍼 (모바일에서는 React 상태 업데이트 주기를 완화하여 메인 스레드/디코더 간섭 최소화)
  const progressThrottleMs = IS_MOBILE ? 220 : 120;
  let lastProgressReportAt = 0;
  const reportProgress = (pct: number, message: string, force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressReportAt < progressThrottleMs) return;
    lastProgressReportAt = now;
    onProgress?.(Math.min(98, Math.max(1, Math.round(pct))), message);
  };

  /**
   * 실시간 프리뷰와 동일한 하드웨어 연속 순차 재생(workerVideo.play()) 파이프라인으로
   * GOP 재탐색(seek thrashing) 없이 매 프레임을 부드럽게 캡처하여 CFR VideoEncoder에 공급하는 핵심 헬퍼.
   *
   * 핵심 개선:
   * - 기존에는 벽시계(dtSec) 보간값(smoothElapsedSec)이 실제 디코더(rawMediaElapsed)보다 앞서가면서
   *   디코더가 아직 이전 프레임에 머물러 있는데도 루프를 탈출해 동일 프레임을 중복 인코딩하고,
   *   이후 디코더가 새 프레임을 낼 때 중간 프레임을 건너뛰는(Frame Drop & Stutter) 현상이 있었음.
   * - 이제 requestVideoFrameCallback(rvfc)의 정밀 mediaTime 및 실제 디코딩된 미디어 진행 시간을
   *   유일한 진실 공급원(Single Source of Truth)으로 삼아, 실제 비디오 프레임이 전진했을 때만 캡처함.
   */
  const encodeVideoRangeSequentially = async (params: {
    rangeStart: number;
    rangeEnd: number;
    videoItem?: VideoItem;
    segment?: HighlightSegment;
    overlayCanvas?: HTMLCanvasElement | null;
    forceFirstKeyFrame?: boolean;
    keepPlayingOnEnd?: boolean;
    onFrameProgress?: (elapsedSec: number) => void;
  }): Promise<void> => {
    const {
      rangeStart,
      rangeEnd,
      videoItem,
      segment,
      overlayCanvas,
      forceFirstKeyFrame = false,
      keepPlayingOnEnd = false,
      onFrameProgress,
    } = params;

    const duration = Math.max(0.05, rangeEnd - rangeStart);
    const segFrames = Math.max(2, Math.round(duration * targetFps));
    const segTimeStep = duration / segFrames;

    // 1. 시작 위치가 현재 위치와 다르면 정확히 1회만 시크 후 디코더 준비 대기
    if (Math.abs(workerVideo.currentTime - rangeStart) > 0.04 || workerVideo.readyState < 2) {
      try {
        workerVideo.pause();
      } catch {}
      await seekVideoElement(workerVideo, rangeStart, 8000);
      await waitForVideoReady(workerVideo, 5000);
    }

    // 첫 프레임 즉시 합성
    drawCoverFrame(workerVideo, videoItem, segment);
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0);
    }

    // 2. 하드웨어 연속 재생 시작 (프리뷰와 동일한 순차 디코딩 파이프라인)
    const isPlaying = await startVideoPlayback(workerVideo, 4000);
    if (isPlaying) {
      await waitForPlaybackAdvance(workerVideo, rangeStart, 1200);

      const vRvfc = workerVideo as VideoWithRvfc;
      const hasRvfc = typeof vRvfc.requestVideoFrameCallback === 'function';
      let latestRvfcMediaTime = workerVideo.currentTime;
      let rvfcHandle: number | null = null;
      let loopActive = true;
      let frameNotifyResolve: (() => void) | null = null;

      const notifyFrameWaiter = () => {
        if (frameNotifyResolve) {
          const r = frameNotifyResolve;
          frameNotifyResolve = null;
          r();
        }
      };

      const registerRvfc = () => {
        if (!loopActive || !hasRvfc) return;
        try {
          rvfcHandle = vRvfc.requestVideoFrameCallback!((_, meta) => {
            if (!loopActive) return;
            latestRvfcMediaTime = meta.mediaTime;
            notifyFrameWaiter();
            registerRvfc();
          });
        } catch {}
      };
      registerRvfc();

      // rvfc 이벤트 또는 짧은 타임아웃(최대 maxWaitMs)까지 대기하는 정밀 신호 헬퍼
      const waitForNextVideoTick = (maxWaitMs: number): Promise<void> =>
        new Promise((resolve) => {
          let done = false;
          const timer = setTimeout(() => {
            if (done) return;
            done = true;
            if (frameNotifyResolve === onSignal) frameNotifyResolve = null;
            resolve();
          }, maxWaitMs);
          const onSignal = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve();
          };
          frameNotifyResolve = onSignal;
        });

      try {
        let lastMediaTimeSeen = Math.max(workerVideo.currentTime, latestRvfcMediaTime);
        let lastMediaAdvanceWall = performance.now();

        for (let f = 0; f < segFrames; f++) {
          if (signal?.aborted) throw new Error('작업 취소');
          if (videoEncoderError) throw videoEncoderError;

          const targetElapsedSec = f * segTimeStep;
          const targetMediaTime = Math.min(rangeEnd, rangeStart + targetElapsedSec);

          if (f > 0) {
            // 하드웨어 디코더가 실제로 targetElapsedSec 시점의 프레임을 디코딩해 내놓을 때까지 대기
            while (!signal?.aborted) {
              // 인코더 백프레셔가 걸려있다면 비디오를 잠시 일시정지해 디코더가 프레임을 혼자 흘려보내지(Drop) 않게 보호!
              if (videoEncoder.encodeQueueSize > queueBackpressureThreshold) {
                try {
                  workerVideo.pause();
                } catch {}
                await waitForEncoderQueueBelow(videoEncoder, Math.max(4, queueBackpressureThreshold >> 1));
                if (!workerVideo.ended && workerVideo.currentTime < rangeEnd - 0.02) {
                  void workerVideo.play().catch(() => {});
                }
                lastMediaAdvanceWall = performance.now();
              }

              if (workerVideo.paused && !workerVideo.ended && workerVideo.currentTime < rangeEnd - 0.03) {
                void workerVideo.play().catch(() => {});
              }

              const curMediaPos = hasRvfc
                ? Math.max(workerVideo.currentTime, latestRvfcMediaTime)
                : workerVideo.currentTime;
              const now = performance.now();

              if (Math.abs(curMediaPos - lastMediaTimeSeen) >= 0.001) {
                lastMediaTimeSeen = curMediaPos;
                lastMediaAdvanceWall = now;
              }

              const rawMediaElapsed = Math.max(0, curMediaPos - rangeStart);
              // requestVideoFrameCallback 미지원 환경에서만 제한적 보간(최대 22ms)을 허용하고,
              // iOS Safari / Chrome 등 rvfc 지원 환경에서는 100% 실제 디코딩된 미디어 시간만 신뢰함
              const fallbackInterpSec = !hasRvfc && !workerVideo.paused && !workerVideo.seeking
                ? Math.min(0.022, Math.max(0, (now - lastMediaAdvanceWall) / 1000))
                : 0;
              const effectiveElapsed = workerVideo.ended
                ? duration
                : rawMediaElapsed + fallbackInterpSec;

              // 허용 오차: 1/4 프레임(약 8ms @ 30fps, 4ms @ 60fps) 이내로 실제 프레임이 도달했을 때 캡처
              const toleranceSec = segTimeStep * 0.28;
              if (
                effectiveElapsed >= targetElapsedSec - toleranceSec ||
                curMediaPos >= rangeEnd - 0.015 ||
                workerVideo.ended
              ) {
                break;
              }

              // 만약 iOS 디코더 스톨 또는 백그라운드 전환 등으로 재생이 450ms 이상 멈췄다면 즉시 목표 시점으로 정밀 시크 후 재생 재개
              if (now - lastMediaAdvanceWall > 450) {
                await seekVideoElement(workerVideo, targetMediaTime, 2500);
                latestRvfcMediaTime = workerVideo.currentTime;
                lastMediaTimeSeen = workerVideo.currentTime;
                lastMediaAdvanceWall = performance.now();
                if (workerVideo.paused && !workerVideo.ended && workerVideo.currentTime < rangeEnd - 0.03) {
                  void workerVideo.play().catch(() => {});
                }
                break;
              }

              const remainMs = (targetElapsedSec - effectiveElapsed) * 1000;
              await waitForNextVideoTick(Math.min(12, Math.max(2, Math.ceil(remainMs * 0.85))));
            }
          }

          // 현재 하드웨어 디코더가 출력 중인 최신 프레임을 캔버스에 합성 후 인코딩
          drawCoverFrame(workerVideo, videoItem, segment);
          if (overlayCanvas) {
            ctx.drawImage(overlayCanvas, 0, 0);
          }

          await pushCanvasFrame(f === 0 && forceFirstKeyFrame);
          onFrameProgress?.(targetElapsedSec);
        }
      } finally {
        loopActive = false;
        notifyFrameWaiter();
        if (rvfcHandle !== null && typeof vRvfc.cancelVideoFrameCallback === 'function') {
          try {
            vRvfc.cancelVideoFrameCallback(rvfcHandle);
          } catch {}
        }
        if (!keepPlayingOnEnd) {
          try {
            workerVideo.pause();
          } catch {}
        }
      }
      return;
    }

    // 3. 폴백: 자동재생이 차단된 특수 환경에서는 정밀 시크(30fps 스텝 + 텍스처 동기화)로 렌더링
    const stepSampleStride = targetFps >= 60 ? 2 : 1;
    for (let f = 0; f < segFrames; f++) {
      if (signal?.aborted) throw new Error('작업 취소');

      if (f % stepSampleStride === 0) {
        const targetMediaTime = Math.min(
          rangeStart + f * segTimeStep,
          Math.max(rangeStart, rangeEnd - 0.015)
        );
        await seekVideoElement(workerVideo, targetMediaTime, 2500);
        drawCoverFrame(workerVideo, videoItem, segment);
        if (overlayCanvas) {
          ctx.drawImage(overlayCanvas, 0, 0);
        }
      }

      await pushCanvasFrame(f === 0 && forceFirstKeyFrame);
      onFrameProgress?.(f * segTimeStep);
    }
  };

  // 사용자 지정 인트로/아웃트로 동영상 파일 렌더링 헬퍼
  const renderCustomVideoClip = async (clipFile: File, label: string, isFirstKeyFrame: boolean): Promise<number> => {
    reportProgress(label === '시작 인트로' ? 2 : 96, `${label} 영상 로드 및 합성 중...`, true);
    const blobUrl = URL.createObjectURL(clipFile);
    try {
      await loadVideoSource(workerVideo, blobUrl, 12000);
      const clipDuration =
        workerVideo.duration && Number.isFinite(workerVideo.duration) && workerVideo.duration > 0
          ? workerVideo.duration
          : 0;
      if (clipDuration <= 0.05) return 0;

      await encodeVideoRangeSequentially({
        rangeStart: 0,
        rangeEnd: clipDuration,
        forceFirstKeyFrame: isFirstKeyFrame,
        keepPlayingOnEnd: false,
      });
      return clipDuration;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const prevFrameBufferCanvas = document.createElement('canvas');
  prevFrameBufferCanvas.width = targetWidth;
  prevFrameBufferCanvas.height = targetHeight;
  const prevFrameBufferCtx = prevFrameBufferCanvas.getContext('2d');

  const nextFrameBufferCanvas = document.createElement('canvas');
  nextFrameBufferCanvas.width = targetWidth;
  nextFrameBufferCanvas.height = targetHeight;
  const nextFrameBufferCtx = nextFrameBufferCanvas.getContext('2d');

  try {
    let actualIntroDuration = 0;
    let actualOutroDuration = 0;

    // -------------------------------------------------------------------------
    // STEP A. 인트로 렌더링 (사용자 지정 비디오 클립 우선, 없으면 타이틀 카드)
    // -------------------------------------------------------------------------
    if (overlayOptions?.showIntro) {
      if (overlayOptions.introVideoFile) {
        actualIntroDuration = await renderCustomVideoClip(overlayOptions.introVideoFile, '시작 인트로', true);
      } else {
        const introSec = overlayOptions.introDurationSec || DEFAULT_INTRO_DURATION;
        const introFrames = Math.round(introSec * targetFps);
        actualIntroDuration = introSec;
        reportProgress(2, `HyperFrames 인트로 모션 생성 중 (${overlayOptions.introTemplate || 'kinetic-slide'})...`, true);

        for (let f = 0; f < introFrames; f++) {
          if (signal?.aborted) throw new Error('작업 취소');
          const progress = f / introFrames;
          renderHyperframesIntroFrame(ctx, progress, overlayOptions, targetWidth, targetHeight);
          await pushCanvasFrame(f === 0);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP B. 하이라이트 세그먼트 프레임 렌더링 (실시간 프리뷰와 동일한 순차 하드웨어 디코딩)
    // -------------------------------------------------------------------------
    let totalSegmentTimeProcessed = 0;

    for (let segIdx = 0; segIdx < allSegments.length; segIdx++) {
      if (signal?.aborted) throw new Error('작업 취소');
      const segment = allSegments[segIdx];
      const videoItem = videoMap.get(segment.sourceVideoId);
      const overlayCanvas = renderSegmentOverlayToSharedCanvas(segment);

      if (!videoItem || !videoItem.url) {
        throw new Error(`[${segment.sourceVideoId}] 비디오 URL을 찾을 수 없습니다.`);
      }

      const prevSeg = segIdx > 0 ? allSegments[segIdx - 1] : null;
      const isSourceSwitch = Boolean(prevSeg && prevSeg.sourceVideoId !== segment.sourceVideoId);

      // 다른 원본 영상으로 전환할 때(예: 18개 영상 연속 병합) 이전 비디오 디코더 파이프라인을 명시적으로 비운 뒤 로드하여
      // iOS WebKit VideoToolbox 하드웨어 디코더 재할당 지연 및 초반 프레임 드랍 방지
      if (isSourceSwitch) {
        try {
          workerVideo.pause();
          workerVideo.removeAttribute('src');
          workerVideo.load();
        } catch {}
      }

      // 비디오 소스 로드
      await loadVideoSource(workerVideo, videoItem.url, 12000);

      const bridgeInfo = prevSeg
        ? evaluateChapterBridge(prevSeg, segment, segIdx, allSegments.length, overlayOptions)
        : null;

      // 챕터 전환 브릿지 트랜지션 (이전 세그먼트가 있고 날짜/장소가 변경된 경우)
      if (bridgeInfo?.shouldBridge) {
        try {
          workerVideo.pause();
        } catch {}
        await seekVideoElement(workerVideo, segment.start, 8000);
        await waitForVideoReady(workerVideo, 6000);

        const bridgeFrames = Math.round(CHAPTER_BRIDGE_DURATION * targetFps);
        actualBridgeDurationMap[segment.id] = CHAPTER_BRIDGE_DURATION;

        // 다음 장면 첫 프레임 캐싱
        if (nextFrameBufferCtx) {
          drawCoverFrame(workerVideo, videoItem, segment);
          nextFrameBufferCtx.drawImage(canvas, 0, 0);
        }

        for (let bf = 0; bf < bridgeFrames; bf++) {
          if (signal?.aborted) throw new Error('작업 취소');
          const timeSec = (bf / bridgeFrames) * CHAPTER_BRIDGE_DURATION;
          bridgeController.seekAndRender(
            ctx,
            timeSec,
            targetWidth,
            targetHeight,
            bridgeInfo,
            () => {
              if (nextFrameBufferCanvas) ctx.drawImage(nextFrameBufferCanvas, 0, 0);
            },
            () => {
              if (prevFrameBufferCanvas) ctx.drawImage(prevFrameBufferCanvas, 0, 0);
            }
          );
          await pushCanvasFrame(bf === 0);

          reportProgress(
            ((totalSegmentTimeProcessed + timeSec) / (totalSegmentsDuration || 1)) * 95,
            `챕터 전환 브릿지 합성 중 (${bridgeInfo.chapterIndex}장)...`
          );
        }
        totalSegmentTimeProcessed += CHAPTER_BRIDGE_DURATION;
      }

      // 다음 세그먼트가 동일 비디오에서 연속 이어지고 브릿지가 없다면 재생 상태를 끊지 않고 유지
      const nextSeg = segIdx + 1 < allSegments.length ? allSegments[segIdx + 1] : null;
      const nextBridge = nextSeg
        ? evaluateChapterBridge(segment, nextSeg, segIdx + 1, allSegments.length, overlayOptions)
        : null;
      const canKeepPlayingToNext = Boolean(
        nextSeg &&
          nextSeg.sourceVideoId === segment.sourceVideoId &&
          !nextBridge?.shouldBridge &&
          Math.abs(nextSeg.start - segment.end) < 0.08
      );

      await encodeVideoRangeSequentially({
        rangeStart: segment.start,
        rangeEnd: segment.end,
        videoItem,
        segment,
        overlayCanvas,
        forceFirstKeyFrame: segIdx === 0 && actualIntroDuration === 0,
        keepPlayingOnEnd: canKeepPlayingToNext,
        onFrameProgress: (elapsedSec) => {
          const currentSegProgressSec = totalSegmentTimeProcessed + elapsedSec;
          reportProgress(
            (currentSegProgressSec / (totalSegmentsDuration || 1)) * 95,
            `구간 ${segIdx + 1}/${allSegments.length} GPU 인코딩 중: [${videoItem.name || ''}]`
          );
        },
      });

      totalSegmentTimeProcessed += segment.duration;

      // 브릿지 연결을 위해 현재 구간 마지막 프레임 스냅샷 저장
      if (prevFrameBufferCtx) {
        prevFrameBufferCtx.drawImage(canvas, 0, 0);
      }
    }

    // -------------------------------------------------------------------------
    // STEP C. 아웃트로 렌더링 (사용자 지정 비디오 클립 우선, 없으면 엔드 카드)
    // -------------------------------------------------------------------------
    if (overlayOptions?.showOutro) {
      if (overlayOptions.outroVideoFile) {
        actualOutroDuration = await renderCustomVideoClip(overlayOptions.outroVideoFile, '종료 아웃트로', false);
      } else {
        const outroSec = overlayOptions.outroDurationSec || DEFAULT_OUTRO_DURATION;
        const outroFrames = Math.round(outroSec * targetFps);
        actualOutroDuration = outroSec;
        reportProgress(96, `HyperFrames 아웃트로 모션 생성 중 (${overlayOptions.outroTemplate || 'modern-endcard'})...`, true);

        for (let f = 0; f < outroFrames; f++) {
          if (signal?.aborted) throw new Error('작업 취소');
          const progress = f / outroFrames;
          renderHyperframesOutroFrame(ctx, progress, overlayOptions, targetWidth, targetHeight);
          await pushCanvasFrame(f === 0);
        }
      }
    }

    // 비디오 인코딩이 끝났으므로 오디오 믹싱 진입 전에 workerVideo 하드웨어 디코더 버퍼를 즉시 반환
    try {
      workerVideo.pause();
      workerVideo.removeAttribute('src');
      workerVideo.load();
    } catch {}

    // -------------------------------------------------------------------------
    // STEP D. 오디오 렌더링 & AudioEncoder 주입 (원본 비디오 오디오 + BGM 믹싱)
    // -------------------------------------------------------------------------
    const totalVideoDurationSec = actualIntroDuration + totalSegmentsDuration + actualOutroDuration;

    if (audioEncoder && audioDataAvailable) {
      try {
        reportProgress(97, '오디오 트랙 고화질 믹싱 및 동기화 중...', true);
        const totalSampleCount = Math.max(1024, Math.ceil(totalVideoDurationSec * audioSampleRate));
        const offlineAudioCtx = new OfflineAudioContext(audioChannels, totalSampleCount, audioSampleRate);

        // 원본 비디오 오디오 디코딩 헬퍼 (표준 AudioContext 우선 시도 후 2차 fallback)
        const readVideoArrayBuffer = async (vItem: VideoItem): Promise<ArrayBuffer | null> => {
          try {
            if (vItem.file && vItem.file.size > 0) {
              return await vItem.file.arrayBuffer();
            }
            if (vItem.url) {
              try {
                const resp = await fetch(vItem.url);
                if (resp.ok) return await resp.arrayBuffer();
              } catch (fetchErr) {
                console.warn(`[WebCodecs] 비디오 ${vItem.name || vItem.id} URL 읽기 실패:`, fetchErr);
              }
            }
          } catch (err) {
            console.warn(`[WebCodecs] 비디오 ${vItem.name || vItem.id} 파일 읽기 실패:`, err);
          }
          return null;
        };

        const decodeVideoAudio = async (vItem: VideoItem): Promise<AudioBuffer | null> => {
          try {
            // decodeAudioData는 전달된 ArrayBuffer를 detach하므로, fallback 시에는 파일을 다시 읽는다.
            // (성공 경로에서 전체 파일을 한 번 더 복사하지 않아 피크 메모리를 줄인다.)
            let ab = await readVideoArrayBuffer(vItem);
            if (!ab || ab.byteLength === 0) return null;

            const AudioCtxCtor =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

            // 1차: 표준 AudioContext로 디코딩 (대다수 브라우저에서 MP4 비디오 컨테이너 오디오 디코딩 지원)
            if (AudioCtxCtor) {
              try {
                const stdCtx = new AudioCtxCtor({ sampleRate: audioSampleRate });
                const decoded = await Promise.race([
                  stdCtx.decodeAudioData(ab),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
                ]);
                void stdCtx.close().catch(() => {});
                if (decoded && decoded.duration > 0) return decoded;
              } catch (e1) {
                console.warn(`[WebCodecs] 표준 AudioContext 디코딩 경고 (${vItem.name || vItem.id}):`, e1);
              }
              ab = await readVideoArrayBuffer(vItem);
              if (!ab || ab.byteLength === 0) return null;
            }

            // 2차: offlineAudioCtx로 시도
            try {
              const decoded = await offlineAudioCtx.decodeAudioData(ab);
              if (decoded && decoded.duration > 0) return decoded;
            } catch (e2) {
              console.warn(`[WebCodecs] OfflineAudioContext 디코딩 경고 (${vItem.name || vItem.id}):`, e2);
            }

            return null;
          } catch (err) {
            console.warn(`[WebCodecs] 비디오 ${vItem.name || vItem.id} 오디오 추출 실패:`, err);
            return null;
          }
        };

        // 각 비디오가 마지막으로 등장하는 세그먼트 인덱스를 사전 계산하여 GC 유도
        const lastSegmentIdxByVideoId = new Map<string, number>();
        for (let idx = 0; idx < allSegments.length; idx++) {
          lastSegmentIdxByVideoId.set(allSegments[idx].sourceVideoId, idx);
        }

        // 1) 각 비디오 클립의 원본 오디오 디코딩 및 타임라인에 배치 (배경음악 유무와 관계없이 항상 원본 소리 보존!)
        const decodedVideoAudioCache = new Map<string, AudioBuffer | null>();
        let timelineAudioCursorSec = actualIntroDuration;

        for (let segIdx = 0; segIdx < allSegments.length; segIdx++) {
          const seg = allSegments[segIdx];
          if (segIdx > 0 && actualBridgeDurationMap[seg.id]) {
            timelineAudioCursorSec += actualBridgeDurationMap[seg.id];
          }

          const vItem = videoMap.get(seg.sourceVideoId);
          if (vItem) {
            if (!decodedVideoAudioCache.has(vItem.id)) {
              const fullDecodedBuf = await decodeVideoAudio(vItem);
              decodedVideoAudioCache.set(vItem.id, fullDecodedBuf);
            }

            const fullAudioBuf = decodedVideoAudioCache.get(vItem.id);
            if (fullAudioBuf && seg.duration > 0.05) {
              try {
                const safeOffset = Math.max(0, Math.min(seg.start, Math.max(0, fullAudioBuf.duration - 0.02)));
                const safeDuration = Math.max(0.02, Math.min(seg.duration, fullAudioBuf.duration - safeOffset));

                const segSource = offlineAudioCtx.createBufferSource();
                segSource.buffer = fullAudioBuf;

                const segGain = offlineAudioCtx.createGain();
                const userVol = typeof seg.volume === 'number' && Number.isFinite(seg.volume) ? seg.volume : 1.0;
                const targetVol = Math.max(0, Math.min(2.0, userVol));

                const startT = timelineAudioCursorSec;
                const endT = timelineAudioCursorSec + seg.duration;
                const fadeSec = Math.min(0.02, safeDuration * 0.1);

                // 세그먼트 경계 팝 노이즈 방지 마이크로 페이드 (시간 역전 방지)
                if (fadeSec > 0.005 && endT - fadeSec > startT + fadeSec) {
                  segGain.gain.setValueAtTime(0.001, startT);
                  segGain.gain.linearRampToValueAtTime(targetVol, startT + fadeSec);
                  segGain.gain.setValueAtTime(targetVol, endT - fadeSec);
                  segGain.gain.linearRampToValueAtTime(0.001, endT);
                } else {
                  segGain.gain.setValueAtTime(targetVol, startT);
                }

                segSource.connect(segGain);
                segGain.connect(offlineAudioCtx.destination);
                segSource.start(startT, safeOffset, safeDuration);
              } catch (segAudioErr) {
                console.warn(`[WebCodecs] 세그먼트 ${seg.id} 오디오 배치 경고:`, segAudioErr);
              }
            }

            // 이 비디오의 마지막 세그먼트까지 처리를 마쳤다면 원본 AudioBuffer 캐시 메모리 해제
            if (lastSegmentIdxByVideoId.get(vItem.id) === segIdx) {
              decodedVideoAudioCache.delete(vItem.id);
            }
          }

          timelineAudioCursorSec += seg.duration;
        }
        decodedVideoAudioCache.clear();

        // 2) 배경음악 믹싱: 사용자 지정 오디오 파일 또는 BGM 프리셋
        if (customAudioFile) {
          try {
            let ab = await customAudioFile.arrayBuffer();
            let decoded: AudioBuffer | null = null;
            try {
              decoded = await offlineAudioCtx.decodeAudioData(ab);
            } catch {
              const AudioCtxCtor =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              if (AudioCtxCtor) {
                // offline 디코딩 실패 시 버퍼가 detach되므로 파일에서 다시 읽는다.
                ab = await customAudioFile.arrayBuffer();
                const stdCtx = new AudioCtxCtor({ sampleRate: audioSampleRate });
                decoded = await stdCtx.decodeAudioData(ab);
                void stdCtx.close().catch(() => {});
              }
            }

            if (decoded) {
              const srcNode = offlineAudioCtx.createBufferSource();
              srcNode.buffer = decoded;

              const fitToVideo = Boolean(overlayOptions?.bgmFitToVideo);
              const targetMusicDuration = Math.max(0.1, totalVideoDurationSec);

              if (fitToVideo && decoded.duration > 0 && targetMusicDuration > 0) {
                const calculatedRate = decoded.duration / targetMusicDuration;
                srcNode.playbackRate.value = Math.max(0.1, Math.min(10.0, calculatedRate));
                srcNode.loop = false;
              } else {
                srcNode.loop = totalVideoDurationSec > decoded.duration;
              }

              const gain = offlineAudioCtx.createGain();
              gain.gain.value = Math.max(0, Math.min(1, bgmVolume));

              srcNode.connect(gain);
              gain.connect(offlineAudioCtx.destination);
              // 배경음악(BGM)은 영상 시작(0초)부터 전체 영상에 맞춰 흐르도록 시작
              srcNode.start(0);
            }
          } catch (bgmErr) {
            console.warn('[WebCodecs] 커스텀 BGM 디코딩 경고:', bgmErr);
          }
        } else if (bgmPresetId && bgmPresetId !== 'none') {
          // BGM 프리셋 신디사이저 사운드트랙 오프라인 렌더링 믹싱
          try {
            scheduleBgmSynthTrack(
              offlineAudioCtx,
              offlineAudioCtx.destination,
              bgmPresetId,
              totalVideoDurationSec,
              bgmVolume
            );
          } catch (synthErr) {
            console.warn('[WebCodecs] BGM 프리셋 신스 믹싱 경고:', synthErr);
          }
        }

        const renderedBuffer = await offlineAudioCtx.startRendering();

        // 1024 샘플 청크 단위로 AudioData 생성 후 AudioEncoder에 전달
        const chunkSize = 1024;
        const numChunks = Math.ceil(renderedBuffer.length / chunkSize);

        for (let i = 0; i < numChunks; i++) {
          const offset = i * chunkSize;
          const length = Math.min(chunkSize, renderedBuffer.length - offset);
          const timestampMicros = Math.round((offset / audioSampleRate) * 1_000_000);

          // planar float32 오디오 데이터 생성
          const plane0 = renderedBuffer.getChannelData(0).subarray(offset, offset + length);
          const plane1 = (renderedBuffer.numberOfChannels > 1
            ? renderedBuffer.getChannelData(1)
            : plane0
          ).subarray(offset, offset + length);

          const planarBuffer = new Float32Array(length * 2);
          planarBuffer.set(plane0, 0);
          planarBuffer.set(plane1, length);

          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: audioSampleRate,
            numberOfFrames: length,
            numberOfChannels: 2,
            timestamp: timestampMicros,
            data: planarBuffer,
          });

          audioEncoder.encode(audioData);
          audioData.close();
        }

        await audioEncoder.flush();
        audioEncoder.close();
      } catch (audioErr) {
        console.warn('[WebCodecs] 오디오 인코딩 처리 중 경고 (무음 지속):', audioErr);
      }
    }

    // -------------------------------------------------------------------------
    // STEP E. 인코더 플러시 및 최종 MP4 Blob 생성
    // -------------------------------------------------------------------------
    reportProgress(98, 'MP4 컨테이너 고화질 패키징 중...', true);
    await videoEncoder.flush();
    videoEncoder.close();

    muxer.finalize();
    const finalBlob = await exportTarget.finalize();
    if (finalBlob.size === 0) {
      throw new Error('WebCodecs로 생성된 비디오 파일의 크기가 0바이트입니다.');
    }

    const finalUrl = URL.createObjectURL(finalBlob);
    const originalTotalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

    onLog?.(
      `🎉 GPU 하드웨어 가속 병합 완료: ${(finalBlob.size / (1024 * 1024)).toFixed(1)}MB · ${totalFramesEncoded}프레임 (${targetFps}fps 무결점)`
    );
    onProgress?.(100, `${targetFps}fps 초고화질 하이라이트 영상이 완성되었습니다!`);

    return {
      blob: finalBlob,
      url: finalUrl,
      duration: Math.round(totalVideoDurationSec * 10) / 10,
      width: targetWidth,
      height: targetHeight,
      resolution: targetResolution,
      introDuration: Math.round(actualIntroDuration * 10) / 10,
      outroDuration: Math.round(actualOutroDuration * 10) / 10,
      bridgeDurationMap: actualBridgeDurationMap,
      segments: allSegments,
      originalTotalDuration: Math.round(originalTotalDuration * 10) / 10,
      fileSize: finalBlob.size,
    };
  } finally {
    try {
      if (wakeLock) {
        void wakeLock.release().catch(() => {});
        wakeLock = null;
      }
      bridgeController.dispose();
      try {
        workerVideo.pause();
        workerVideo.removeAttribute('src');
        workerVideo.srcObject = null;
        workerVideo.load();
      } catch {}
      workerVideo.remove();
      for (const c of [canvas, sharedOverlayCanvas, prevFrameBufferCanvas, nextFrameBufferCanvas]) {
        try {
          c.width = 0;
          c.height = 0;
        } catch {}
      }
      // 임시로 디코더 슬롯을 반환했던 DOM 프리뷰 비디오 복원
      for (const item of suspendedDomVideos) {
        try {
          if (item.srcAttr && item.el.isConnected) {
            item.el.setAttribute('src', item.srcAttr);
            item.el.load();
            if (item.currentTime > 0) {
              const restoreTime = item.currentTime;
              item.el.addEventListener(
                'loadedmetadata',
                () => {
                  try {
                    item.el.currentTime = restoreTime;
                  } catch {}
                },
                { once: true }
              );
            }
          }
        } catch {}
      }
    } catch {}
  }
}
