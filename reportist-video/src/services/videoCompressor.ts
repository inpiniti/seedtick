import type { ExtractedFrame } from '../types/video.ts';
import {
  decodeKeyframesNearTimes,
  getMp4TrackInfo,
  isWebCodecsKeyframeDecodeAvailable,
} from './mp4KeyframeDecoder.ts';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}

const IS_MOBILE_DEVICE =
  typeof navigator !== 'undefined' &&
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/**
 * WebKit/Chromium의 네이티브 하드웨어 비디오 디코더 및 GPU 캔버스 백킹 메모리를 즉시 강제 반환하는 헬퍼.
 * 단순히 DOM 참조만 끊으면 iOS Safari의 CoreMedia 버퍼가 반환되지 않아 다중 영상 처리 시 OOM 크래시가 발생함.
 */
export function releaseMediaResources(
  video?: HTMLVideoElement | null,
  canvas?: HTMLCanvasElement | null
): void {
  if (video) {
    try {
      video.pause();
    } catch {}
    try {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.onended = null;
      video.removeAttribute('src');
      video.srcObject = null;
      video.load();
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    } catch {}
  }
  if (canvas) {
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    } catch {}
  }
}

// 다중 파일(예: 16~100개) 동시 업로드 시 하드웨어 디코더 고갈을 막는 동시성 제어 큐 (최대 2개 병렬)
const MAX_CONCURRENT_METADATA_EXTRACTIONS = IS_MOBILE_DEVICE ? 1 : 2;
let activeMetadataExtractions = 0;
const metadataQueue: Array<() => void> = [];

function acquireMetadataSlot(): Promise<void> {
  if (activeMetadataExtractions < MAX_CONCURRENT_METADATA_EXTRACTIONS) {
    activeMetadataExtractions++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    metadataQueue.push(() => {
      activeMetadataExtractions++;
      resolve();
    });
  });
}

function releaseMetadataSlot(): void {
  activeMetadataExtractions = Math.max(0, activeMetadataExtractions - 1);
  const next = metadataQueue.shift();
  if (next) {
    next();
  }
}

// 영상 길이에 따라 최적의 프레임 샘플링 타임스탬프 계산 (최대 10~14개 프레임, 모바일은 메모리 보호를 위해 최대 10개)
export function calculateSampleTimestamps(
  totalDuration: number,
  maxFrames = IS_MOBILE_DEVICE ? 10 : 14
): number[] {
  const safeDuration = Number.isFinite(totalDuration) && totalDuration > 0 ? totalDuration : 3.0;

  if (safeDuration <= 1.0) {
    return [Math.max(0.1, safeDuration * 0.5)];
  }

  // 5초 이하 짧은 영상
  if (safeDuration <= 5.0) {
    const count = Math.min(maxFrames, Math.max(4, Math.floor(safeDuration / 0.6)));
    const step = (safeDuration - 0.2) / Math.max(1, count - 1);
    return Array.from({ length: count }, (_, i) => Math.round((0.1 + i * step) * 10) / 10);
  }

  // 5초 ~ 15초 영상
  if (safeDuration <= 15.0) {
    const count = Math.min(maxFrames, Math.max(6, Math.floor(safeDuration / 1.0)));
    const step = (safeDuration - 0.4) / Math.max(1, count - 1);
    return Array.from({ length: count }, (_, i) => Math.round((0.2 + i * step) * 10) / 10);
  }

  // 15초 초과 영상: 10~14개 프레임 균등 배치
  const count = Math.min(maxFrames, IS_MOBILE_DEVICE ? 10 : 14);
  const startOffset = Math.max(0.3, safeDuration * 0.02);
  const endOffset = Math.min(safeDuration - 0.3, safeDuration * 0.98);
  const step = (endOffset - startOffset) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => Math.round((startOffset + i * step) * 10) / 10);
}

// 분석용 단일 캔버스 재사용 (매 영상마다 캔버스 인스턴스를 누적 생성하지 않도록 관리)
let sharedAnalysisCanvas: HTMLCanvasElement | null = null;

function getSharedAnalysisCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  if (!sharedAnalysisCanvas && typeof document !== 'undefined') {
    sharedAnalysisCanvas = document.createElement('canvas');
  }
  const canvas = sharedAnalysisCanvas || document.createElement('canvas');
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');
  }
  return { canvas, ctx };
}

export interface MediaFrameSource {
  url: string;
  file?: File | Blob | null;
}

// 분석용 주요 프레임 다중 이미지 추출
// 1순위: WebCodecs 키프레임 디코딩 (iOS MediaCache 디스크 기록 없음, <video> 미사용)
// 2순위(폴백): <video preload='metadata'> + seek (최소 한도 MediaCache만 사용)
export async function extractVideoFramesForAnalysis(
  source: MediaFrameSource | string,
  totalDuration: number,
  onProgress?: (progressPercent: number) => void
): Promise<ExtractedFrame[]> {
  const { url, file } =
    typeof source === 'string' ? { url: source, file: null } : source;

  const maxFrameCount = IS_MOBILE_DEVICE ? 10 : 14;
  const safeDuration =
    Number.isFinite(totalDuration) && totalDuration > 0 ? Math.max(0.5, totalDuration) : 3.0;
  const timestamps = calculateSampleTimestamps(safeDuration, maxFrameCount);

  // 1순위: WebCodecs 키프레임 디코딩
  if (file && isWebCodecsKeyframeDecodeAvailable()) {
    try {
      const decoded = await decodeKeyframesNearTimes(file, timestamps, {
        targetWidth: 420,
        jpegQuality: 0.65,
        timeoutMs: 15_000,
        onFrameDecoded: (done, total) => {
          if (onProgress) onProgress(Math.round((done / total) * 100));
        },
      });
      if (decoded && decoded.length > 0) {
        return decoded.map((f) => ({ timestamp: f.timeSec, dataUrl: f.dataUrl }));
      }
    } catch (err) {
      console.warn('[videoCompressor] WebCodecs 프레임 추출 실패, <video> 폴백으로 전환:', err);
    }
  }

  // 2순위(폴백): <video preload='metadata'> 기반
  return extractFramesWithVideoElement(url, safeDuration, onProgress);
}

async function extractFramesWithVideoElement(
  videoUrl: string,
  totalDuration: number,
  onProgress?: (progressPercent: number) => void
): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    if (!videoUrl.startsWith('blob:')) {
      video.crossOrigin = 'anonymous';
    }
    video.preload = 'metadata';

    let settled = false;
    const finishSuccess = (frames: ExtractedFrame[]) => {
      if (settled) return;
      settled = true;
      releaseMediaResources(video, null);
      resolve(frames);
    };
    const finishError = (err: unknown) => {
      if (settled) return;
      settled = true;
      releaseMediaResources(video, null);
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    video.onloadedmetadata = async () => {
      try {
        const rawDur =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : Number.isFinite(totalDuration) && totalDuration > 0
            ? totalDuration
            : 3.0;
        const duration = Math.max(0.5, rawDur);

        // 시각 분석에 최적화된 저해상도 설정 (너비 420px, 종횡비 유지)
        const targetWidth = 420;
        const aspectRatio = (video.videoHeight || 360) / (video.videoWidth || 640);
        const targetHeight = Math.max(2, Math.round((targetWidth * aspectRatio) / 2) * 2);

        const { canvas, ctx } = getSharedAnalysisCanvas(targetWidth, targetHeight);

        const maxFrameCount = IS_MOBILE_DEVICE ? 10 : 14;
        const timestamps = calculateSampleTimestamps(duration, maxFrameCount);
        const frames: ExtractedFrame[] = [];

        for (let i = 0; i < timestamps.length; i++) {
          const ts = timestamps[i];

          // 지정 타임스탬프로 초고속 Seek
          await new Promise<void>((seekResolve) => {
            let timeoutId: ReturnType<typeof setTimeout> | null = null;

            const onSeeked = () => {
              if (timeoutId) clearTimeout(timeoutId);
              video.removeEventListener('seeked', onSeeked);
              seekResolve();
            };

            // 타임아웃 안전장치 (1000ms)
            timeoutId = setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              seekResolve();
            }, 1000);

            video.addEventListener('seeked', onSeeked);

            const safeTs = Number.isFinite(ts) ? ts : 0;
            const targetTime = Math.min(Math.max(0, safeTs), Math.max(0, duration - 0.05));
            if (Number.isFinite(targetTime)) {
              try {
                video.currentTime = targetTime;
              } catch (e) {
                console.warn('[videoCompressor] currentTime 설정 오류 방어:', e);
                seekResolve();
              }
            } else {
              seekResolve();
            }
          });

          // 캔버스에 프레임 그리기
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          // 화질 0.65의 경량 JPEG dataUrl 생성 (프레임당 약 15~20KB)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          frames.push({
            timestamp: ts,
            dataUrl,
          });

          if (onProgress) {
            onProgress(Math.round(((i + 1) / timestamps.length) * 100));
          }
        }

        // 공유 캔버스의 버퍼도 일시 축소하여 유휴 GPU 메모리 즉시 반환
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 1;
        canvas.height = 1;

        finishSuccess(frames);
      } catch (err) {
        finishError(err);
      }
    };

    video.onerror = () => {
      finishError(
        new Error('비디오 로드에 실패했습니다. 올바른 비디오 형식인지 확인해 주세요.')
      );
    };

    video.src = videoUrl;
    try {
      video.load();
    } catch {}
  });
}

// 미디어(비디오 또는 사진) 파일로부터 재생 시간, 해상도, 대표 썸네일 추출 (동시성 제어 큐 적용)
export async function extractVideoMetadata(file: File, skipThumbnail = false): Promise<VideoMetadata> {
  await acquireMetadataSlot();
  try {
    return await extractVideoMetadataInternal(file, skipThumbnail);
  } finally {
    releaseMetadataSlot();
  }
}

async function extractVideoMetadataInternal(file: File, skipThumbnail = false): Promise<VideoMetadata> {
  // 사진 파일 처리 분기
  if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|webp|avif)$/i.test(file.name)) {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const width = img.naturalWidth || 1280;
        const height = img.naturalHeight || 720;
        const canvas = document.createElement('canvas');
        const maxThumbWidth = 320;
        const scale = Math.min(1, maxThumbWidth / width);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.75);
          releaseMediaResources(null, canvas);
          URL.revokeObjectURL(objectUrl);
          resolve({
            duration: 3.5, // 사진의 기본 클립 재생 시간 3.5초
            width,
            height,
            thumbnailUrl,
          });
          return;
        }
        releaseMediaResources(null, canvas);
        URL.revokeObjectURL(objectUrl);
        resolve({
          duration: 3.5,
          width,
          height,
          thumbnailUrl: '',
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          duration: 3.5,
          width: 1280,
          height: 720,
          thumbnailUrl: '',
        });
      };
      img.src = objectUrl;
    });
  }

  // 1순위: WebCodecs 키프레임 디코딩 (<video> 미사용, iOS MediaCache 0)
  if (isWebCodecsKeyframeDecodeAvailable()) {
    try {
      const info = await getMp4TrackInfo(file);
      if (info) {
        const rawDur = Number.isFinite(info.durationSec) && info.durationSec > 0 ? info.durationSec : 1;
        const width = info.width > 0 ? info.width : 640;
        const height = info.height > 0 ? info.height : 360;

        if (skipThumbnail) {
          return {
            duration: rawDur,
            width,
            height,
            thumbnailUrl: '',
          };
        }

        // 10% 지점(또는 최대 1.0초)의 키프레임 1개만 디코딩
        const seekTime = Math.min(1.0, Math.max(0.1, rawDur * 0.1));
        const decoded = await decodeKeyframesNearTimes(file, [seekTime], {
          targetWidth: 320,
          jpegQuality: 0.7,
          timeoutMs: 10_000,
        });

        if (decoded && decoded.length > 0) {
          return {
            duration: rawDur,
            width,
            height,
            thumbnailUrl: decoded[0].dataUrl,
          };
        }
        // 디코딩 불가 시 아래 <video> 폴백으로 계속 진행
      }
    } catch (err) {
      console.warn('[videoCompressor] WebCodecs 썸네일 추출 실패, <video> 폴백으로 전환:', err);
    }
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');

    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (canvas?: HTMLCanvasElement | null) => {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      releaseMediaResources(video, canvas);
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    // 현재 디코딩된 프레임을 캡처하여 썸네일로 확정 (onseeked / 타임아웃 양쪽에서 공유)
    const captureFrame = () => {
      if (settled) return;
      settled = true;
      let canvas: HTMLCanvasElement | null = null;
      try {
        const rawW = video.videoWidth || 640;
        const rawH = video.videoHeight || 360;
        canvas = document.createElement('canvas');
        const maxThumbWidth = 320;
        const scale = Math.min(1, maxThumbWidth / rawW);
        canvas.width = Math.round(rawW * scale);
        canvas.height = Math.round(rawH * scale);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          const dur = video.duration || 1;
          cleanup(canvas);
          resolve({
            duration: dur,
            width: rawW,
            height: rawH,
            thumbnailUrl,
          });
          return;
        }
      } catch (err) {
        console.warn('[VideoCompressor] 썸네일 생성 실패:', err);
      }

      const dur = video.duration || 1;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      cleanup(canvas);
      resolve({
        duration: dur,
        width: w,
        height: h,
        thumbnailUrl: '',
      });
    };

    // 메타데이터/시크가 지연될 경우 디코더 슬롯이 영구 잠기지 않도록 8초 타임아웃 방어.
    // 이때라도 이미 디코딩된 프레임이 있으면 캡처를 시도하고, 아니면 썸네일만 비워서 반환.
    safetyTimer = setTimeout(() => {
      if (settled) return;
      if (video.videoWidth > 0 && video.readyState >= 2) {
        captureFrame();
        return;
      }
      settled = true;
      const fallbackDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const fallbackW = video.videoWidth || 640;
      const fallbackH = video.videoHeight || 360;
      cleanup(null);
      resolve({
        duration: fallbackDur,
        width: fallbackW,
        height: fallbackH,
        thumbnailUrl: '',
      });
    }, 8000);

    video.onloadedmetadata = () => {
      const rawDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;

      if (skipThumbnail) {
        if (settled) return;
        settled = true;
        cleanup(null);
        resolve({
          duration: rawDur,
          width: w,
          height: h,
          thumbnailUrl: '',
        });
        return;
      }

      // 썸네일을 위해 0.1초(또는 10% 지점)으로 이동 — 0초로 시크하면 onseeked가 발화하지 않아 반드시 양수 시간 사용
      const seekTime = Math.min(1.0, Math.max(0.1, rawDur * 0.1));
      try {
        video.currentTime = seekTime;
      } catch {
        // 시크 실패 시 현재 프레임에서 바로 캡처
        captureFrame();
      }
    };

    video.onseeked = captureFrame;

    video.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup(null);
      reject(new Error('비디오 메타데이터를 읽어올 수 없습니다. 지원하는 영상 형식인지 확인해 주세요.'));
    };

    video.src = objectUrl;
    try {
      video.load();
    } catch {}
  });
}

// AI Gateway 전송(Vercel 4.5MB 제한)을 위한 고속 브라우저 캔버스 리샘플링 압축
export async function compressVideoForAnalysis(
  videoUrl: string,
  totalDuration: number,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      try {
        // AI 분석에 최적화된 저해상도 설정 (너비 420px, 종횡비 유지)
        const targetWidth = 420;
        const aspectRatio = (video.videoHeight || 360) / (video.videoWidth || 640);
        const targetHeight = Math.round((targetWidth * aspectRatio) / 2) * 2; // 2의 배수

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');
        }

        // 10fps 스트림 캡처
        const stream = canvas.captureStream(10);

        // 지원 코덱 확인 (webm vp8 / mp4)
        let mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }

        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: 350_000, // 약 350kbps (수 분 영상도 2~3MB 이내)
        };
        if (mimeType) {
          recorderOptions.mimeType = mimeType;
        }

        const recorder = new MediaRecorder(stream, recorderOptions);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('압축된 비디오 변환 실패'));
            }
          };
          reader.onerror = () => reject(new Error('파일 읽기 실패'));
          reader.readAsDataURL(compressedBlob);
        };

        // 빠른 압축을 위해 2배속 재생
        video.playbackRate = 2.0;

        let animationFrameId: number;
        const renderLoop = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          if (onProgress && totalDuration > 0) {
            const current = video.currentTime;
            const percent = Math.min(100, Math.round((current / totalDuration) * 100));
            onProgress(percent);
          }

          animationFrameId = requestAnimationFrame(renderLoop);
        };

        video.onended = () => {
          cancelAnimationFrame(animationFrameId);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        };

        video.onerror = () => {
          cancelAnimationFrame(animationFrameId);
          if (recorder.state === 'recording') recorder.stop();
          reject(new Error('비디오 압축 렌더링 중 오류가 발생했습니다.'));
        };

        recorder.start(200);
        video.play().then(() => {
          renderLoop();
        }).catch((err) => {
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('압축할 비디오를 로드할 수 없습니다.'));
    };
  });
}

export interface CodecInfo {
  name: string;
  label: string;
  mimeType: string;
  isSupported: boolean;
  priority: number;
  efficiency: 'high' | 'medium' | 'standard';
}

/**
 * 브라우저에서 지원하는 비디오 녹화/인코딩 코덱 목록 및 효율성 순위 반환
 */
export function getSupportedCodecsList(): CodecInfo[] {
  if (typeof window === 'undefined' || !('MediaRecorder' in window)) {
    return [];
  }
  const candidates: Array<{
    name: string;
    label: string;
    mimeType: string;
    priority: number;
    efficiency: 'high' | 'medium' | 'standard';
  }> = [
    { name: 'av1', label: 'AV1 (차세대 초고압축)', mimeType: 'video/webm;codecs=av01', priority: 1, efficiency: 'high' },
    { name: 'vp9', label: 'VP9 (웹 고효율 압축)', mimeType: 'video/webm;codecs=vp9', priority: 2, efficiency: 'high' },
    { name: 'h264_mp4', label: 'H.264 / MP4 (광범위 호환)', mimeType: 'video/mp4;codecs=avc1', priority: 3, efficiency: 'medium' },
    { name: 'h264_webm', label: 'H.264 / WebM', mimeType: 'video/webm;codecs=h264', priority: 4, efficiency: 'medium' },
    { name: 'vp8', label: 'VP8 / WebM (범용 표준)', mimeType: 'video/webm;codecs=vp8', priority: 5, efficiency: 'standard' },
    { name: 'webm', label: '기본 WebM', mimeType: 'video/webm', priority: 6, efficiency: 'standard' },
  ];

  return candidates.map((c) => ({
    ...c,
    isSupported: MediaRecorder.isTypeSupported(c.mimeType),
  }));
}

/**
 * 현재 브라우저에서 지원하는 최적(최고 압축률) 코덱 감지
 */
export function detectOptimalCodec(): CodecInfo | null {
  const list = getSupportedCodecsList();
  return list.find((c) => c.isSupported) || null;
}

/**
 * 스토리지 보관 및 모바일 캐시를 위한 경량 비디오 압축
 */
export async function compressVideoForStorage(
  blob: Blob,
  options: {
    targetWidth?: number;
    videoBitsPerSecond?: number;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<{ compressedBlob: Blob; sizeRatio: number; codec: string }> {
  const { targetWidth = 960, videoBitsPerSecond = 800_000, onProgress } = options;
  const optimalCodec = detectOptimalCodec();
  const mimeType = optimalCodec?.mimeType || 'video/webm';
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      try {
        const aspect = (video.videoHeight || 720) / (video.videoWidth || 1280);
        const outWidth = Math.min(targetWidth, video.videoWidth || targetWidth);
        const outHeight = Math.round((outWidth * aspect) / 2) * 2;

        const canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ compressedBlob: blob, sizeRatio: 0, codec: 'original' });
          return;
        }

        const stream = canvas.captureStream(24);
        const recorderOptions: MediaRecorderOptions = { videoBitsPerSecond };
        if (optimalCodec?.isSupported) {
          recorderOptions.mimeType = mimeType;
        }

        const recorder = new MediaRecorder(stream, recorderOptions);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(url);
          const compressed = new Blob(chunks, { type: mimeType });
          const sizeRatio = blob.size > 0 ? Math.max(0, Math.round((1 - compressed.size / blob.size) * 100)) : 0;
          resolve({
            compressedBlob: compressed.size < blob.size ? compressed : blob,
            sizeRatio,
            codec: optimalCodec?.name || 'default',
          });
        };

        let animId: number;
        const render = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, outWidth, outHeight);
          if (onProgress && video.duration > 0) {
            onProgress(Math.min(100, Math.round((video.currentTime / video.duration) * 100)));
          }
          animId = requestAnimationFrame(render);
        };

        video.onended = () => {
          cancelAnimationFrame(animId);
          if (recorder.state === 'recording') recorder.stop();
        };

        video.onerror = () => {
          cancelAnimationFrame(animId);
          if (recorder.state === 'recording') recorder.stop();
          URL.revokeObjectURL(url);
          resolve({ compressedBlob: blob, sizeRatio: 0, codec: 'original' });
        };

        recorder.start(250);
        video.play().then(() => render()).catch(() => {
          URL.revokeObjectURL(url);
          resolve({ compressedBlob: blob, sizeRatio: 0, codec: 'original' });
        });
      } catch {
        URL.revokeObjectURL(url);
        resolve({ compressedBlob: blob, sizeRatio: 0, codec: 'original' });
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ compressedBlob: blob, sizeRatio: 0, codec: 'original' });
    };
  });
}

