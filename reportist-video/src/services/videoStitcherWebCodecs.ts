// services/videoStitcherWebCodecs.ts - GPU 하드웨어 가속(WebCodecs) 기반 고화질 60fps 무결점 비디오 병합 엔진
// VideoEncoder + mp4-muxer + OfflineAudioContext를 활용하여 실시간 녹화의 프레임 누락(Stuttering)을 완전 제거합니다.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { FinalVideoResult, HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';
import {
  CHAPTER_BRIDGE_DURATION,
  computeBridgeDurationMap,
  createHyperframesBridgeController,
  evaluateChapterBridge,
} from './hyperframesBridgeRenderer.ts';

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
}: StitchVideosWebCodecsParams): Promise<FinalVideoResult> {
  if (allSegments.length === 0) {
    throw new Error('이어붙일 하이라이트 구간이 없습니다.');
  }

  // 페이지 내 다른 비디오가 하드웨어 디코더 리소스를 점유하지 않도록 일시정지
  if (typeof document !== 'undefined') {
    try {
      document.querySelectorAll('video').forEach((v) => {
        try {
          if (!v.paused) v.pause();
        } catch {}
      });
    } catch {}
  }

  // 모바일/아이폰은 배터리 및 하드웨어 디코더 부하를 줄이고 인코딩 속도를 2배 단축하기 위해 30fps 적용, 데스크톱은 60fps 고주사율 유지
  const targetFps = IS_MOBILE ? 30 : 60;
  const targetBitrate = IS_MOBILE ? 4_500_000 : 10_000_000;
  const frameDurationMicros = Math.round(1_000_000 / targetFps);
  const queueBackpressureThreshold = IS_MOBILE ? 10 : 24;

  onLog?.(
    `🚀 WebCodecs GPU 하드웨어 가속 비디오 렌더러 시작 (${targetFps}fps · ${
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

  const targetWidth = 1280;
  const targetHeight = 720;

  // 1. 비디오 맵 구성
  const videoMap = new Map<string, VideoItem>();
  for (const v of videos) {
    videoMap.set(v.id, v);
  }

  // 2. 렌더링 캔버스 생성
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스 2D 컨텍스트를 생성할 수 없습니다.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 3. 작업용 비디오 엘리먼트 (뷰포트 내부 우측 하단에 배치하여 Chromium/WebKit의 화면 밖 비디오 디코더 스로틀링 원천 차단!)
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
    'position:fixed;right:0;bottom:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-1;';
  document.body.appendChild(workerVideo);

  // 4. 세그먼트별 오버레이 캔버스 캐싱
  const createSegmentOverlayCanvas = (currentSegment?: HighlightSegment): HTMLCanvasElement | null => {
    if (!overlayOptions) return null;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = targetWidth;
    offCanvas.height = targetHeight;
    const oCtx = offCanvas.getContext('2d');
    if (!oCtx) return null;

    let hasAnyOverlay = false;
    let titleBottomY = 28;
    const hasTitle = Boolean(overlayOptions.showTitle && overlayOptions.titleText?.trim());

    if (hasTitle) {
      hasAnyOverlay = true;
      oCtx.save();
      oCtx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      const text = overlayOptions.titleText || '';
      const metrics = oCtx.measureText(text);
      const padX = 14;
      const boxW = metrics.width + padX * 2;
      const boxH = 38;
      const x = 32;
      const y = 28;

      oCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      oCtx.beginPath();
      if (typeof oCtx.roundRect === 'function') {
        oCtx.roundRect(x, y, boxW, boxH, 6);
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
      oCtx.font = '600 16px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      oCtx.fillStyle = '#ffffff';
      oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      oCtx.shadowBlur = 4;
      oCtx.shadowOffsetX = 0;
      oCtx.shadowOffsetY = 1.5;
      oCtx.textAlign = 'left';
      oCtx.textBaseline = 'top';

      const metaX = hasTitle ? 34 : 32;
      const metaY = hasTitle ? titleBottomY + 7 : 28;
      oCtx.fillText(metaText, metaX, metaY);
      oCtx.restore();
    }

    if (overlayOptions.showChannel && overlayOptions.channelText) {
      hasAnyOverlay = true;
      oCtx.save();
      oCtx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      oCtx.fillStyle = '#ffffff';
      oCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      oCtx.shadowBlur = 4;
      oCtx.shadowOffsetX = 0;
      oCtx.shadowOffsetY = 2;
      oCtx.textAlign = 'right';
      oCtx.textBaseline = 'middle';
      oCtx.fillText(overlayOptions.channelText, targetWidth - 32, 47);
      oCtx.restore();
    }

    if (overlayOptions.showSubtitle) {
      const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
      const subText = titlePart.trim();

      if (subText) {
        hasAnyOverlay = true;
        oCtx.save();
        oCtx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        const metrics = oCtx.measureText(subText);
        const padX = 20;
        const boxW = metrics.width + padX * 2;
        const boxH = 46;
        const x = (targetWidth - boxW) / 2;
        const y = targetHeight - 76;

        oCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        oCtx.beginPath();
        if (typeof oCtx.roundRect === 'function') {
          oCtx.roundRect(x, y, boxW, boxH, 8);
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

    return hasAnyOverlay ? offCanvas : null;
  };

  const overlayCanvases = allSegments.map((seg) => createSegmentOverlayCanvas(seg));

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

  // 7. Muxer 인스턴스 생성
  const muxerTarget = new ArrayBufferTarget();
  const muxer = new Muxer({
    target: muxerTarget,
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
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  // 8. VideoEncoder 초기화
  let videoEncoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error('[WebCodecs] VideoEncoder error:', e);
      videoEncoderError = new Error(e.message || 'VideoEncoder 인코딩 오류');
    },
  });

  // 고품질 H.264 하드웨어 가속 설정
  // avc1.640028 (High Profile Level 4.0, 1080p/720p 60fps 지원)
  const videoEncoderConfig: VideoEncoderConfig = {
    codec: 'avc1.640028',
    width: targetWidth,
    height: targetHeight,
    bitrate: targetBitrate,
    framerate: targetFps,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' },
  };

  // 지원 여부 검증 (필요시 Baseline으로 폴백)
  const support = await VideoEncoder.isConfigSupported(videoEncoderConfig);
  if (!support.supported) {
    videoEncoderConfig.codec = 'avc1.42001f'; // Baseline 3.1
    videoEncoderConfig.bitrate = Math.min(targetBitrate, 5_000_000);
  }
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

  // 진행률 보고 헬퍼
  let lastProgressReportAt = 0;
  const reportProgress = (pct: number, message: string, force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressReportAt < 120) return;
    lastProgressReportAt = now;
    onProgress?.(Math.min(98, Math.max(1, Math.round(pct))), message);
  };

  /**
   * 실시간 프리뷰와 동일한 하드웨어 연속 순차 재생(workerVideo.play()) 파이프라인으로
   * GOP 재탐색(seek thrashing) 없이 매 프레임을 부드럽게 캡처하여 CFR VideoEncoder에 공급하는 핵심 헬퍼
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
      let latestRvfcMediaTime = workerVideo.currentTime;
      let rvfcHandle: number | null = null;
      let loopActive = true;

      const registerRvfc = () => {
        if (!loopActive || typeof vRvfc.requestVideoFrameCallback !== 'function') return;
        try {
          rvfcHandle = vRvfc.requestVideoFrameCallback((_, meta) => {
            if (!loopActive) return;
            latestRvfcMediaTime = meta.mediaTime;
            registerRvfc();
          });
        } catch {}
      };
      registerRvfc();

      try {
        let smoothElapsedSec = Math.max(0, workerVideo.currentTime - rangeStart);
        let lastWallNow = performance.now();
        let lastMediaTimeSeen = workerVideo.currentTime;
        let lastMediaAdvanceWall = performance.now();

        for (let f = 0; f < segFrames; f++) {
          if (signal?.aborted) throw new Error('작업 취소');
          if (videoEncoderError) throw videoEncoderError;

          const targetElapsedSec = f * segTimeStep;
          const targetMediaTime = Math.min(rangeEnd, rangeStart + targetElapsedSec);

          if (f > 0) {
            // 하드웨어 디코더가 targetElapsedSec 시점의 프레임을 출력할 때까지 자연스럽게 대기
            while (!signal?.aborted) {
              const now = performance.now();
              const dtSec = Math.min(0.05, Math.max(0, (now - lastWallNow) / 1000));
              lastWallNow = now;

              if (workerVideo.paused && !workerVideo.ended && workerVideo.currentTime < rangeEnd - 0.03) {
                void workerVideo.play().catch(() => {});
              }

              const curMediaPos = Math.max(workerVideo.currentTime, latestRvfcMediaTime);
              if (Math.abs(curMediaPos - lastMediaTimeSeen) >= 0.001) {
                lastMediaTimeSeen = curMediaPos;
                lastMediaAdvanceWall = now;
              }

              const rawMediaElapsed = Math.max(0, curMediaPos - rangeStart);
              if (!workerVideo.paused && !workerVideo.seeking && workerVideo.readyState >= 2) {
                smoothElapsedSec += dtSec;
                // currentTime 업데이트 주기와 보간 클럭 간의 드리프트를 부드럽게 동기화
                if (Math.abs(smoothElapsedSec - rawMediaElapsed) > 0.045) {
                  smoothElapsedSec = rawMediaElapsed;
                }
              } else {
                smoothElapsedSec = rawMediaElapsed;
              }

              const effectiveElapsed = workerVideo.ended
                ? duration
                : Math.max(rawMediaElapsed, smoothElapsedSec);

              if (
                effectiveElapsed >= targetElapsedSec - 0.002 ||
                curMediaPos >= rangeEnd - 0.015 ||
                workerVideo.ended
              ) {
                break;
              }

              // 만약 백그라운드 탭 전환 등으로 비디오 재생이 800ms 이상 멈췄다면 즉시 해당 위치로 시크하여 복구
              if (now - lastMediaAdvanceWall > 800) {
                await seekVideoElement(workerVideo, targetMediaTime, 2500);
                lastMediaAdvanceWall = performance.now();
                lastWallNow = performance.now();
                smoothElapsedSec = targetElapsedSec;
                break;
              }

              // 인코더 백프레셔가 걸려있다면 비디오를 잠시 일시정지해 프레임 드롭 방지
              if (videoEncoder.encodeQueueSize > queueBackpressureThreshold) {
                try {
                  workerVideo.pause();
                } catch {}
                await waitForEncoderQueueBelow(videoEncoder, Math.max(4, queueBackpressureThreshold >> 1));
                void workerVideo.play().catch(() => {});
                lastWallNow = performance.now();
                lastMediaAdvanceWall = performance.now();
              }

              const remainMs = (targetElapsedSec - effectiveElapsed) * 1000;
              await sleep(Math.min(6, Math.max(1, Math.floor(remainMs * 0.75))));
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
        reportProgress(2, '시작 인트로 시퀀스 생성 중...', true);
        const introSec = 1.6;
        const introFrames = Math.round(introSec * targetFps);
        actualIntroDuration = introSec;

        for (let f = 0; f < introFrames; f++) {
          if (signal?.aborted) throw new Error('작업 취소');
          const progress = f / introFrames;
          const alpha = progress < 0.25 ? progress / 0.25 : progress > 0.8 ? (1 - progress) / 0.2 : 1.0;

          ctx.fillStyle = '#080c14';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          const grad = ctx.createRadialGradient(
            targetWidth / 2, targetHeight / 2, 30,
            targetWidth / 2, targetHeight / 2, 450
          );
          grad.addColorStop(0, `rgba(49, 130, 246, ${0.32 * alpha})`);
          grad.addColorStop(1, 'rgba(8, 12, 20, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

          const title = overlayOptions.titleText || 'Highlights';
          ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 14;
          ctx.fillText(title, targetWidth / 2, targetHeight / 2 - 20);

          const sub = [
            overlayOptions.showDate === false ? '' : overlayOptions.subtitleDateText,
            overlayOptions.subtitleLocationText,
            overlayOptions.channelText,
          ].filter(Boolean).join(' • ');
          if (sub) {
            ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
            ctx.fillStyle = '#93c5fd';
            ctx.fillText(sub, targetWidth / 2, targetHeight / 2 + 32);
          }
          ctx.restore();

          await pushCanvasFrame(f === 0);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP B. 하이라이트 세그먼트 프레임 렌더링 (실시간 프리뷰와 동일한 순차 하드웨어 디코딩)
    // -------------------------------------------------------------------------
    const prevFrameBufferCanvas = document.createElement('canvas');
    prevFrameBufferCanvas.width = targetWidth;
    prevFrameBufferCanvas.height = targetHeight;
    const prevFrameBufferCtx = prevFrameBufferCanvas.getContext('2d');

    const nextFrameBufferCanvas = document.createElement('canvas');
    nextFrameBufferCanvas.width = targetWidth;
    nextFrameBufferCanvas.height = targetHeight;
    const nextFrameBufferCtx = nextFrameBufferCanvas.getContext('2d');

    let totalSegmentTimeProcessed = 0;

    for (let segIdx = 0; segIdx < allSegments.length; segIdx++) {
      if (signal?.aborted) throw new Error('작업 취소');
      const segment = allSegments[segIdx];
      const videoItem = videoMap.get(segment.sourceVideoId);
      const overlayCanvas = overlayCanvases[segIdx];

      if (!videoItem || !videoItem.url) {
        throw new Error(`[${segment.sourceVideoId}] 비디오 URL을 찾을 수 없습니다.`);
      }

      // 비디오 소스 로드
      await loadVideoSource(workerVideo, videoItem.url, 12000);

      const prevSeg = segIdx > 0 ? allSegments[segIdx - 1] : null;
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
        reportProgress(96, '종료 아웃트로 엔드 카드 생성 중...', true);
        const outroSec = 1.8;
        const outroFrames = Math.round(outroSec * targetFps);
        actualOutroDuration = outroSec;

        for (let f = 0; f < outroFrames; f++) {
          if (signal?.aborted) throw new Error('작업 취소');
          const progress = f / outroFrames;
          const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.85 ? (1 - progress) / 0.15 : 1.0;

          ctx.fillStyle = '#080c14';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

          ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const outroMessage = overlayOptions.outroText || 'Thank you for watching';
          ctx.fillText(outroMessage, targetWidth / 2, targetHeight / 2 - 16);

          if (overlayOptions.channelText) {
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
            ctx.fillStyle = '#3182f6';
            ctx.fillText(overlayOptions.channelText, targetWidth / 2, targetHeight / 2 + 30);
          }
          ctx.restore();

          await pushCanvasFrame(f === 0);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP D. 오디오 렌더링 & AudioEncoder 주입 (원본 비디오 오디오 + BGM 믹싱)
    // -------------------------------------------------------------------------
    const totalVideoDurationSec = actualIntroDuration + totalSegmentsDuration + actualOutroDuration;

    if (audioEncoder && audioDataAvailable) {
      try {
        reportProgress(97, '오디오 트랙 고화질 믹싱 및 동기화 중...', true);
        const totalSampleCount = Math.max(1024, Math.ceil(totalVideoDurationSec * audioSampleRate));
        const offlineAudioCtx = new OfflineAudioContext(audioChannels, totalSampleCount, audioSampleRate);

        // 1) 각 비디오 클립의 원본 오디오 디코딩(비디오 ID별 1회 캐싱) 및 타임라인 배치
        const decodedVideoAudioCache = new Map<string, AudioBuffer | null>();
        let timelineAudioCursorSec = actualIntroDuration;

        for (let segIdx = 0; segIdx < allSegments.length; segIdx++) {
          const seg = allSegments[segIdx];
          if (segIdx > 0 && actualBridgeDurationMap[seg.id]) {
            timelineAudioCursorSec += actualBridgeDurationMap[seg.id];
          }

          const vItem = videoMap.get(seg.sourceVideoId);
          if (vItem?.file) {
            if (!decodedVideoAudioCache.has(vItem.id)) {
              try {
                const ab = await vItem.file.arrayBuffer();
                const decodedBuf = await offlineAudioCtx.decodeAudioData(ab.slice(0));
                decodedVideoAudioCache.set(vItem.id, decodedBuf);
              } catch {
                decodedVideoAudioCache.set(vItem.id, null);
              }
            }

            const clipAudioBuf = decodedVideoAudioCache.get(vItem.id);
            if (clipAudioBuf && seg.duration > 0.05) {
              try {
                const segSource = offlineAudioCtx.createBufferSource();
                segSource.buffer = clipAudioBuf;
                const segGain = offlineAudioCtx.createGain();
                const startT = timelineAudioCursorSec;
                const endT = timelineAudioCursorSec + seg.duration;
                const fadeSec = Math.min(0.04, seg.duration * 0.15);
                // 세그먼트 경계 팝 노이즈 방지를 위한 마이크로 페이드 인/아웃
                segGain.gain.setValueAtTime(0.001, startT);
                segGain.gain.linearRampToValueAtTime(0.85, startT + fadeSec);
                segGain.gain.setValueAtTime(0.85, Math.max(startT + fadeSec, endT - fadeSec));
                segGain.gain.linearRampToValueAtTime(0.001, endT);

                segSource.connect(segGain);
                segGain.connect(offlineAudioCtx.destination);
                const safeOffset = Math.max(0, Math.min(seg.start, Math.max(0, clipAudioBuf.duration - 0.05)));
                const safeDuration = Math.max(0.02, Math.min(seg.duration, clipAudioBuf.duration - safeOffset));
                segSource.start(startT, safeOffset, safeDuration);
              } catch {}
            }
          }

          timelineAudioCursorSec += seg.duration;
        }

        // 2) 사용자 지정 배경음악(customAudioFile) 믹싱
        if (customAudioFile) {
          const ab = await customAudioFile.arrayBuffer();
          const decoded = await offlineAudioCtx.decodeAudioData(ab);
          const srcNode = offlineAudioCtx.createBufferSource();
          srcNode.buffer = decoded;

          const fitToVideo = Boolean(overlayOptions?.bgmFitToVideo);
          const introOffset = actualIntroDuration > 0 ? actualIntroDuration : 0;
          const targetMusicDuration = Math.max(0.1, totalVideoDurationSec - introOffset);

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
          srcNode.start(introOffset);
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
    const finalBuffer = muxerTarget.buffer;
    const finalBlob = new Blob([finalBuffer], { type: 'video/mp4' });

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
      workerVideo.remove();
    } catch {}
  }
}
