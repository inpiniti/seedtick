// services/videoStitcher.ts - 16:9 유튜브 시네마틱 비디오 병합기, 자막/브랜딩 오버레이, 인트로/아웃트로 & 커스텀 BGM 지원

import type { ExportResolution, FinalVideoResult, HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';
import { playBgmSynthLoop } from './audioSynth.ts';
import {
  CHAPTER_BRIDGE_DURATION,
  CHAPTER_BRIDGE_FPS,
  CHAPTER_BRIDGE_FRAMES,
  computeBridgeDurationMap,
  createHyperframesBridgeController,
  evaluateChapterBridge,
  type ChapterBridgeTransitionInfo,
} from './hyperframesBridgeRenderer.ts';
import { isWebCodecsSupported, stitchVideosWebCodecs } from './videoStitcherWebCodecs.ts';

export interface StitchVideosParams {
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

// ---------------------------------------------------------------------------
// 실행 환경 감지 & 공용 헬퍼
// ---------------------------------------------------------------------------

const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const IS_SAFARI =
  typeof navigator !== 'undefined' &&
  /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Timed<T> =
  | { status: 'ok'; value: T }
  | { status: 'error'; error: unknown }
  | { status: 'timeout' };

// iOS Safari에서 play()/resume()/decodeAudioData() Promise가 영원히 pending으로 남는
// 케이스가 있어, 모든 대기 지점에 타임아웃을 걸어 "85%에서 멈춘 것처럼 보이는" 현상을 방지한다.
async function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<Timed<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const result = await Promise.race<Timed<T>>([
    promise.then(
      (value): Timed<T> => ({ status: 'ok', value }),
      (error): Timed<T> => ({ status: 'error', error })
    ),
    new Promise<Timed<T>>((resolve) => {
      timer = setTimeout(() => resolve({ status: 'timeout' }), ms);
    }),
  ]);
  if (timer) clearTimeout(timer);
  return result;
}

// ---------------------------------------------------------------------------
// 오디오 컨텍스트 (iOS는 사용자 제스처 안에서 resume 해야 소리가 녹음된다)
// ---------------------------------------------------------------------------

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

let sharedAudioCtx: AudioContext | null = null;

// 사용자가 "분석 시작" 버튼을 누르는 시점(제스처)에 호출해 오디오를 미리 잠금 해제한다.
export function primeAudioContext(): void {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctor();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('[VideoStitcher] AudioContext 사전 준비 실패 (무음 처리):', err);
  }
}

function getSharedAudioContext(): AudioContext | null {
  try {
    if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') return sharedAudioCtx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    sharedAudioCtx = new Ctor();
    return sharedAudioCtx;
  } catch (err) {
    console.warn('[VideoStitcher] AudioContext 초기화 실패 (무음 처리):', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// MediaRecorder 코덱 선택 (iOS Safari는 WebM을 지원하지 않으므로 MP4 우선)
// ---------------------------------------------------------------------------

const MP4_AUDIO_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.42001E,mp4a.40.2',
  'video/mp4',
];

const MP4_VIDEO_ONLY_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1.42001E',
  'video/mp4',
];

const WEBM_AUDIO_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8',
  'video/webm',
];

const WEBM_VIDEO_ONLY_CANDIDATES = [
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp9',
  'video/webm',
];

// CanvasCaptureMediaStreamTrack의 명시적 프레임 방출 API 타입
type CanvasCaptureTrackWithRequestFrame = MediaStreamTrack & {
  requestFrame?: () => void;
};

// HTMLVideoElement.requestVideoFrameCallback 타입
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function supportedRecorderMimes(hasAudio: boolean): string[] {
  if (typeof MediaRecorder === 'undefined') return [];
  const mp4List = hasAudio ? MP4_AUDIO_CANDIDATES : MP4_VIDEO_ONLY_CANDIDATES;
  const webmList = hasAudio ? WEBM_AUDIO_CANDIDATES : WEBM_VIDEO_ONLY_CANDIDATES;
  const order = IS_IOS || IS_SAFARI ? [...mp4List, ...webmList] : [...webmList, ...mp4List];
  return order.filter((mime) => {
    try {
      return MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  });
}

function createMediaRecorder(stream: MediaStream, customBitrate?: number): { recorder: MediaRecorder; mimeType: string } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      '이 브라우저는 영상 녹화(MediaRecorder)를 지원하지 않습니다. 최신 Safari 또는 Chrome에서 다시 시도해 주세요.'
    );
  }

  const hasAudio = stream.getAudioTracks().length > 0;
  // 실시간 인코딩 시 비트레이트 부족으로 인한 프레임 스탁 및 모션 뭉개짐을 방지하기 위해
  // iOS는 메모리/발열에 안전한 3.2Mbps(720p)/6.5Mbps(1080p), 데스크탑은 6.5Mbps(720p)/14Mbps(1080p)로 상향
  const videoBitsPerSecond = customBitrate ?? (IS_IOS ? 3_200_000 : 6_500_000);
  // 빈 문자열('')은 브라우저 자체 기본 코덱(가장 안전한 기본값) 선택을 위한 최후 후보
  const candidates = [...supportedRecorderMimes(hasAudio), ''];
  let lastError: unknown = null;

  for (const mime of candidates) {
    try {
      const options: MediaRecorderOptions = { videoBitsPerSecond };
      if (mime) options.mimeType = mime;
      const recorder = new MediaRecorder(stream, options);
      return { recorder, mimeType: recorder.mimeType || mime || '' };
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? ` (${lastError.message})` : '';
  throw new Error(`영상 녹화기를 초기화하지 못했습니다.${detail}`);
}

// 모바일 Safari는 화면 밖으로 밀어낸 canvas/video의 프레임을 캡처하지 못하거나
// 레이어 컬링으로 captureStream 프레임이 멈추는 경우가 있어, 뷰포트 하단 모서리에 안전하게 마운트한다.
function mountHiddenStage(canvas: HTMLCanvasElement, ...videos: HTMLVideoElement[]): HTMLDivElement {
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = [
    'position:fixed',
    'left:0',
    'bottom:0',
    'width:120px',
    'height:68px',
    'opacity:0.12',
    'pointer-events:none',
    'overflow:hidden',
    'z-index:99999',
  ].join(';');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
  stage.appendChild(canvas);
  for (const el of videos) {
    el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;';
    stage.appendChild(el);
  }
  document.body.appendChild(stage);
  return stage;
}

function createWorkerVideo(): HTMLVideoElement {
  const videoElem = document.createElement('video');
  videoElem.muted = true;
  videoElem.defaultMuted = true;
  videoElem.volume = 0;
  videoElem.playsInline = true;
  videoElem.preload = 'auto';
  // blob: URL에 crossorigin="anonymous"가 지정되면 iOS Safari/WebKit에서
  // 리소스 보안 검증 오류(CORS 실패 / MEDIA_ERR_SRC_NOT_SUPPORTED)가 발생하므로
  // 기본 속성에서는 제거하고 원격 URL 로드 시에만 동적으로 부여합니다.
  videoElem.setAttribute('playsinline', '');
  videoElem.setAttribute('webkit-playsinline', '');
  videoElem.setAttribute('muted', '');
  return videoElem;
}

// 여러 영상에서 추출된 극적 구간들을 순차적으로 잘라 16:9 유튜브 규격의 단일 영상으로 병합
export async function stitchHighlightedSegments({
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
}: StitchVideosParams): Promise<FinalVideoResult> {
  if (allSegments.length === 0) {
    throw new Error('이어붙일 하이라이트 구간이 없습니다.');
  }

  // 0. 최신 브라우저: GPU 하드웨어 가속(WebCodecs 60fps 무결점) 렌더러 우선 시도
  if (isWebCodecsSupported()) {
    try {
      return await stitchVideosWebCodecs({
        videos,
        allSegments,
        onProgress,
        onLog,
        signal,
        bgmPresetId,
        bgmVolume,
        customAudioFile,
        overlayOptions,
        resolution,
      });
    } catch (webCodecsErr) {
      if (signal?.aborted) throw webCodecsErr;
      console.warn('[VideoStitcher] WebCodecs GPU 렌더러 오류, MediaRecorder 모드로 폴백합니다:', webCodecsErr);
      onLog?.('GPU 렌더링 중 호환성 문제가 감지되어 표준 렌더러로 자동 전환합니다.');
    }
  }

  // 모바일 Safari/WebKit의 하드웨어 비디오 디코더 단일 인스턴스 잠금 방지:
  // 페이지 내에서 재생 중이거나 백그라운드 버퍼를 잡고 있는 다른 모든 비디오의 소스를 임시 해제합니다.
  const suspendedDomVideos: Array<{
    el: HTMLVideoElement;
    srcAttr: string | null;
    currentTime: number;
  }> = [];

  if (typeof document !== 'undefined') {
    try {
      const activeVideos = document.querySelectorAll('video');
      activeVideos.forEach((v) => {
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

  // 비디오 ID 매핑 테이블 구성
  const videoMap = new Map<string, VideoItem>();
  for (const v of videos) {
    videoMap.set(v.id, v);
  }

  // 1. 해상도 결정 (1080p FHD vs 720p HD)
  const is1080p = resolution === '1080p' || (!resolution && !IS_IOS);
  const targetResolution: ExportResolution = is1080p ? '1080p' : '720p';
  const targetWidth = is1080p ? 1920 : 1280;
  const targetHeight = is1080p ? 1080 : 720;
  const scale = targetWidth / 1280;
  const recorderBitrate = is1080p ? (IS_IOS ? 6_500_000 : 14_000_000) : (IS_IOS ? 3_200_000 : 6_500_000);

  // iOS는 하드웨어 인코더/메모리 안정성을 위해 30fps 유지, 데스크탑은 60fps 고주사율로 부드러움 극대화
  const targetFps = IS_IOS ? 30 : 60;
  const targetFrameIntervalMs = 1000 / targetFps;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 렌더링 컨텍스트를 생성할 수 없습니다.');
  }
  ctx.imageSmoothingEnabled = true;
  try {
    ctx.imageSmoothingQuality = IS_IOS ? 'medium' : 'high';
  } catch {
    // ignore
  }

  if (typeof canvas.captureStream !== 'function') {
    throw new Error(
      '이 브라우저는 화면 캡처(canvas.captureStream)를 지원하지 않습니다. 최신 Safari로 업데이트하거나 PC에서 이용해 주세요.'
    );
  }

  // 초기 캔버스 배경 설정
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 워커 비디오 엘리먼트 준비 (iOS Safari 단일 하드웨어 디코더 충돌 방지를 위해 단일 워커 사용)
  const workerA = createWorkerVideo();
  const stage = mountHiddenStage(canvas, workerA);

  // BGM 또는 원본 비디오 오디오 등 항상 오디오 소스 활성화
  const hasAudioSource = true;

  // 오디오 컨텍스트 및 목적지 스트림 생성
  const audioCtx = getSharedAudioContext() || (typeof AudioContext !== 'undefined' ? new AudioContext() : null);
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  let workerAudioGain: GainNode | null = null;

  if (audioCtx) {
    try {
      audioDest = audioCtx.createMediaStreamDestination();

      // workerA(원본 비디오)의 소리를 Web Audio 그래프로 라우팅 (스피커로 나가지 않고 녹음 목적지 audioDest로만 라우팅됨)
      try {
        workerAudioGain = audioCtx.createGain();
        workerAudioGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        workerAudioGain.connect(audioDest);

        const workerSource = audioCtx.createMediaElementSource(workerA);
        workerSource.connect(workerAudioGain);
        workerA.muted = false;
        workerA.defaultMuted = false;
        workerA.volume = 1.0;
      } catch (workerErr) {
        console.warn('[VideoStitcher] workerA MediaElementAudioSource 연결 경고:', workerErr);
      }

      // iOS Safari AVAssetWriter가 오디오 패킷 부족으로 비디오 기록을 멈추는 현상을 막기 위해
      // 지속적인 미세 무음 노드를 audioDest에 상시 공급
      const silenceGain = audioCtx.createGain();
      silenceGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      const osc = audioCtx.createOscillator();
      osc.frequency.setValueAtTime(10, audioCtx.currentTime);
      osc.connect(silenceGain);
      silenceGain.connect(audioDest);
      osc.start();
    } catch (err) {
      console.warn('[VideoStitcher] 오디오 목적지 생성 실패 (무음 처리):', err);
    }
  }

  // 비디오 스트림 캡처 (iOS 30fps, 데스크탑 60fps)
  const canvasStream = canvas.captureStream(targetFps);
  const canvasVideoTrack = (canvasStream.getVideoTracks()[0] || null) as CanvasCaptureTrackWithRequestFrame | null;
  let lastCanvasDrawAt = performance.now();

  // 캔버스 드로우 완료 직후 스트림 트랙에 즉시 프레임 캡처를 요청하여
  // 브라우저 내부 캡처 타이머와의 위상차(Phase Mismatch)로 인한 마이크로 스터터링을 제거한다.
  const commitCanvasFrame = () => {
    lastCanvasDrawAt = performance.now();
    try {
      if (canvasVideoTrack && typeof canvasVideoTrack.requestFrame === 'function') {
        canvasVideoTrack.requestFrame();
      }
    } catch {
      // 일부 브라우저에서 requestFrame 미지원 시 captureStream(targetFps) 자동 캡처가 동작
    }
  };

  let audioTrackAdded = false;
  if (hasAudioSource && audioDest && audioDest.stream.getAudioTracks().length > 0) {
    try {
      canvasStream.addTrack(audioDest.stream.getAudioTracks()[0]);
      audioTrackAdded = true;
    } catch (err) {
      console.warn('[VideoStitcher] 오디오 트랙 연결 실패 (무음 처리):', err);
    }
  }

  let recorder: MediaRecorder;
  let mimeType: string;
  try {
    ({ recorder, mimeType } = createMediaRecorder(canvasStream, recorderBitrate));
  } catch (err) {
    // 일부 모바일 브라우저는 오디오 트랙이 섞인 스트림을 녹화하지 못한다 → 무음 영상으로 재시도
    if (audioTrackAdded) {
      try {
        for (const track of canvasStream.getAudioTracks()) {
          canvasStream.removeTrack(track);
        }
        audioTrackAdded = false;
        ({ recorder, mimeType } = createMediaRecorder(canvasStream, recorderBitrate));
        onLog?.('오디오 트랙을 사용할 수 없어 무음 영상으로 병합합니다.');
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  onLog?.(`렌더러 준비 완료: ${mimeType || '브라우저 기본 코덱'} (${targetFps}fps)${IS_IOS ? ' · iOS 호환 모드' : ''}`);

  const chunks: Blob[] = [];
  let recorderError: Error | null = null;
  let dataAvailableCalls = 0;
  let startEventFired = false;
  let onstopFired = false;
  let onstopWaitTimeout = false;
  let totalDrawCalls = 0;
  const renderModeHistory: string[] = [];

  recorder.onstart = () => {
    startEventFired = true;
  };
  recorder.ondataavailable = (e) => {
    dataAvailableCalls++;
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  recorder.onerror = (event) => {
    const err = (event as unknown as { error?: DOMException }).error;
    recorderError = new Error(err?.message || '영상 녹화 중 오류가 발생했습니다.');
    console.error('[VideoStitcher] MediaRecorder 오류:', err);
  };

  const plannedBridgeDurationMap = computeBridgeDurationMap(allSegments, overlayOptions);
  const totalPlannedBridgeDuration = Object.values(plannedBridgeDurationMap).reduce((sum, d) => sum + d, 0);
  const totalSegmentsDuration = allSegments.reduce((sum, s) => sum + s.duration, 0) + totalPlannedBridgeDuration;
  const actualBridgeDurationMap: Record<string, number> = {};
  const bridgeController = createHyperframesBridgeController(CHAPTER_BRIDGE_DURATION);
  let recordedDurationSoFar = 0;

  let recorderStarted = false;
  let bgmController: { stop: () => void } | null = null;
  const wakeLockRef: { current: WakeLockSentinel | null } = { current: null };

  // 캔버스 유휴(Idle) 하트비트 루프 (WebKit Frame Starvation 및 트랙 침묵 방어)
  // 중요: 정상 재생 중 본 렌더 루프가 프레임을 활발히 그리고 있을 때(최근 48ms 이내 드로우됨)는
  // 하트비트 픽셀 갱신을 건너뛰어 captureStream의 프레임 슬롯을 빼앗거나 간섭하지 않도록 한다!
  // 오직 시크(seek) 대기 등으로 실제 프레임 드로우가 48ms 이상 멈췄을 때만 작동하여 iOS 멈춤을 100% 방어한다.
  let isStitchingActive = true;
  const heartbeatTimer = window.setInterval(() => {
    if (!isStitchingActive) return;
    if (recorder.state !== 'recording') return;
    if (performance.now() - lastCanvasDrawAt < 48) return;
    if (ctx) {
      // 캔버스 모서리에 육안으로 구분 불가능한 극미세 픽셀 갱신(alpha 0.005)을 주어 WebKit 렌더러가 새 프레임 방출을 트리거
      ctx.fillStyle = 'rgba(8, 12, 20, 0.005)';
      ctx.fillRect(0, 0, 1, 1);
      commitCanvasFrame();
    }
  }, 1000 / 30);

  // 모바일에서 화면이 꺼지면 JS 타이머와 녹화가 멈춰 병합이 깨진다.
  // 병합이 끝날 때까지 화면 꺼짐을 막는다. (지원 브라우저에서만 동작)
  const requestWakeLock = async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
      };
      if (!nav.wakeLock?.request) return;
      wakeLockRef.current = await nav.wakeLock.request('screen');
      onLog?.('병합 중 화면이 꺼지지 않도록 유지합니다.');
    } catch (err) {
      console.warn('[VideoStitcher] Wake Lock 사용 불가:', err);
    }
  };

  const resumeAudioContext = async () => {
    if (!audioCtx || audioCtx.state !== 'suspended') return;
    // iOS에서 제스처 없이 resume()을 호출하면 Promise가 끝나지 않을 수 있다.
    const result = await raceWithTimeout(audioCtx.resume(), 1200);
    if (result.status !== 'ok') {
      console.warn('[VideoStitcher] AudioContext resume 지연/실패 (무음 처리):', result.status);
    }
  };

  // BGM 준비: 파일 디코딩 및 오디오 버퍼 노드 준비 (실제 재생 시작은 녹화 시작 시점으로 지연)
  let customSourceNode: AudioBufferSourceNode | null = null;
  if (customAudioFile && audioCtx && audioDest) {
    try {
      const arrayBufferResult = await raceWithTimeout(customAudioFile.arrayBuffer(), 8000);
      if (arrayBufferResult.status === 'ok') {
        const decodedResult = await raceWithTimeout(audioCtx.decodeAudioData(arrayBufferResult.value), 15000);
        if (decodedResult.status === 'ok') {
          customSourceNode = audioCtx.createBufferSource();
          customSourceNode.buffer = decodedResult.value;
          const expectedIntroSec = overlayOptions?.showIntro ? 1.6 : 0;
          const expectedOutroSec = overlayOptions?.showOutro ? 1.8 : 0;
          const plannedTotalVideoSec = totalSegmentsDuration + expectedIntroSec + expectedOutroSec;

          const fitToVideo = Boolean(overlayOptions?.bgmFitToVideo);
          // 배경음악(BGM)은 인트로를 포함한 전체 영상 길이에 맞춰 배속 동기화
          const targetMusicDuration = Math.max(0.1, plannedTotalVideoSec);

          if (fitToVideo && decodedResult.value.duration > 0 && targetMusicDuration > 0) {
            const calculatedRate = decodedResult.value.duration / targetMusicDuration;
            customSourceNode.playbackRate.value = Math.max(0.1, Math.min(10.0, calculatedRate));
            customSourceNode.loop = false;
          } else {
            customSourceNode.loop = plannedTotalVideoSec > decodedResult.value.duration + 0.5;
          }

          const gainNode = audioCtx.createGain();
          gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, bgmVolume)), audioCtx.currentTime);

          customSourceNode.connect(gainNode);
          gainNode.connect(audioDest);

          bgmController = {
            stop: () => {
              try {
                customSourceNode?.stop();
                customSourceNode?.disconnect();
              } catch {
                // ignore
              }
            },
          };
        } else {
          console.warn('[VideoStitcher] 커스텀 BGM 디코딩 실패:', decodedResult.status);
        }
      } else {
        console.warn('[VideoStitcher] 커스텀 BGM 읽기 실패:', arrayBufferResult.status);
      }
    } catch (err) {
      console.warn('[VideoStitcher] 커스텀 BGM 디코딩 실패, 기본 신스 폴백:', err);
    }
  }

  let bgmStarted = false;
  const startBgmPlayback = () => {
    if (bgmStarted) return;
    bgmStarted = true;
    if (customSourceNode) {
      try {
        customSourceNode.start(0);
      } catch (err) {
        console.warn('[VideoStitcher] 커스텀 BGM 시작 실패:', err);
      }
    } else if (bgmPresetId && bgmPresetId !== 'none' && audioCtx && audioDest) {
      try {
        bgmController = playBgmSynthLoop(audioCtx, audioDest, bgmPresetId, bgmVolume);
      } catch (e) {
        console.warn('[VideoStitcher] BGM 신스 연결 건너뜀:', e);
      }
    }
  };

  const startOrResumeRecorder = async () => {
    try {
      startBgmPlayback();
      await resumeAudioContext();

      if (recorder.state === 'inactive') {
        // 첫 프레임 보장 대기 (Frame Starvation 방지: 첫 draw 후 최소 50ms 대기)
        await sleep(50);
        try {
          if (IS_IOS || IS_SAFARI) {
            recorder.start();
          } else {
            recorder.start(1000);
          }
        } catch {
          recorder.start();
        }
        recorderStarted = true;
      } else if (recorder.state === 'paused') {
        recorder.resume();
      }
    } catch (err) {
      console.warn('[VideoStitcher] 레코더 시작/재개 실패:', err);
    }
  };

  const pauseRecorder = async () => {
    try {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
      if (audioCtx && audioCtx.state === 'running') {
        await audioCtx.suspend().catch(() => {});
      }
    } catch (err) {
      console.warn('[VideoStitcher] 레코더 일시정지 실패:', err);
    }
  };

  // 16:9 캔버스(1280x720)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림 (개별 90도 회전 지원)
  const drawCoverFrame = (video: HTMLVideoElement, vItem?: VideoItem, segment?: HighlightSegment) => {
    const rawVW = video.videoWidth || vItem?.width || targetWidth;
    const rawVH = video.videoHeight || vItem?.height || targetHeight;
    const rotation = ((segment?.rotation ?? 0) % 360 + 360) % 360;

    const isSideways = rotation === 90 || rotation === 270;
    const vW = isSideways ? rawVH : rawVW;
    const vH = isSideways ? rawVW : rawVH;

    const targetAspect = targetWidth / targetHeight; // 1280 / 720 = 16:9 (~1.777778)
    const srcAspect = vW / vH;

    const scale = Math.max(targetWidth / vW, targetHeight / vH);
    const renderW = vW * scale;
    const renderH = vH * scale;

    const offsetX = (targetWidth - renderW) / 2;
    let offsetY: number;

    if (vH > vW) {
      // 세로 영상(9:16)은 인물의 얼굴과 상체가 주로 위쪽에 위치하므로
      // 사용자가 지정한 크롭 상단 편향 반영 (기본값: 0.25)
      const excessHeight = renderH - targetHeight;
      const ratio = segment?.cropOffsetYRatio ?? 0.25;
      offsetY = -excessHeight * ratio;
    } else {
      // 4:3 등 일반 가로 영상은 상하 중앙 정렬
      offsetY = (targetHeight - renderH) / 2;
    }

    if (rotation === 0) {
      let sx = 0;
      let sy = 0;
      let sWidth = rawVW;
      let sHeight = rawVH;

      if (srcAspect > targetAspect) {
        // 1) 16:9보다 좌우로 더 넓은 영상 (예: 21:9 시네마틱 뷰, 1920x800)
        sHeight = rawVH;
        sWidth = Math.round(rawVH * targetAspect);
        sx = Math.round((rawVW - sWidth) / 2);
        sy = 0;
      } else if (srcAspect < targetAspect) {
        // 2) 16:9보다 세로로 길쭉한 영상 (예: 9:16 쇼츠/릴스, 4:3)
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

      // 소스 좌표 범위 안전 클램핑
      sx = Math.max(0, Math.min(sx, Math.max(0, rawVW - sWidth)));
      sy = Math.max(0, Math.min(sy, Math.max(0, rawVH - sHeight)));

      // 대상 캔버스는 항상 (0, 0, 1280, 720) 전체를 정확하게 채움
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    } else {
      // 90°, 180°, 270° 회전 변환 렌더링
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

  // 세그먼트별 오버레이 오프스크린 캔버스 단일 재사용 (세그먼트 전환 시마다 덮어쓰기하여 N개 캔버스 메모리 누적 원천 차단)
  const sharedOverlayCanvas = document.createElement('canvas');
  sharedOverlayCanvas.width = targetWidth;
  sharedOverlayCanvas.height = targetHeight;
  const sharedOverlayCtx = sharedOverlayCanvas.getContext('2d');
  let cachedOverlaySegmentId: string | null = null;
  let cachedOverlayResult: HTMLCanvasElement | null = null;

  const getSegmentOverlayCanvas = (currentSegment?: HighlightSegment): HTMLCanvasElement | null => {
    if (!overlayOptions || !sharedOverlayCtx) return null;
    if (currentSegment?.id && cachedOverlaySegmentId === currentSegment.id) {
      return cachedOverlayResult;
    }

    const oCtx = sharedOverlayCtx;
    oCtx.clearRect(0, 0, targetWidth, targetHeight);

    let hasAnyOverlay = false;
    let titleBottomY = Math.round(28 * scale);
    const hasTitle = Boolean(overlayOptions.showTitle && overlayOptions.titleText?.trim());

    // 1. 좌측 상단 영상 제목
    if (hasTitle) {
      hasAnyOverlay = true;
      oCtx.save();
      const titleFont = Math.round(22 * scale);
      oCtx.font = `bold ${titleFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      const text = overlayOptions.titleText;
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

    // 1-1. 좌측 상단 문구 아래: 흰색 글씨로 날짜 및 위치 표시
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

    // 2. 우측 상단 채널 이름
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

    // 3. 하단 중앙 씬 제목 자막
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

    cachedOverlaySegmentId = currentSegment?.id ?? null;
    cachedOverlayResult = hasAnyOverlay ? sharedOverlayCanvas : null;
    return cachedOverlayResult;
  };

  // 비디오 프레임과 캐시된 오버레이를 캔버스에 합성하고 즉시 캡처 트랙에 프레임 방출 요청
  const renderFrameWithOverlay = (
    video: HTMLVideoElement,
    videoItem: VideoItem,
    segment: HighlightSegment,
    overlayCanvas: HTMLCanvasElement | null
  ) => {
    totalDrawCalls++;
    drawCoverFrame(video, videoItem, segment);
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0);
    }
    commitCanvasFrame();
  };

  // 진행률 콜백 스로틀 (모바일에서 초당 60회 React 리렌더로 렌더 루프가 굳는 현상 방지)
  let lastProgressAt = 0;
  const reportProgress = (pct: number, message: string, force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressAt < 180) return;
    lastProgressAt = now;
    onProgress?.(Math.min(97, Math.max(0, Math.round(pct))), message);
  };

  const seekVideo = (video: HTMLVideoElement, time: number, timeoutMs = 8000) =>
    new Promise<boolean>((resolve) => {
      const targetTime = Math.max(0, time);
      if (Math.abs(video.currentTime - targetTime) < 0.0005 && video.readyState >= 2 && !video.seeking) {
        resolve(true);
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        if (timer) clearTimeout(timer);
        resolve(ok);
      };
      const onSeeked = () => {
        requestAnimationFrame(() => finish(true));
      };
      const onError = () => finish(false);
      timer = setTimeout(() => finish(Math.abs(video.currentTime - targetTime) < 0.3), timeoutMs);
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      try {
        video.currentTime = targetTime;
      } catch {
        finish(false);
      }
    });

  // 비디오가 지정 시점으로 seek된 후 실제 재생 가능한 버퍼(readyState >= 3)를 확보할 때까지 대기
  const waitForVideoReady = (video: HTMLVideoElement, timeoutMs = 6000): Promise<boolean> => {
    if (video.readyState >= 3) return Promise.resolve(true);
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
  };

  const loadVideoSource = async (video: HTMLVideoElement, url: string, name: string, timeoutMs = 12000) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      throw new Error(`[${name || '영상'}] 비디오 재생 URL이 비어 있습니다. (모바일 메모리 정리로 인해 파일이 언로드되었을 수 있으니 영상을 다시 선택해 주세요)`);
    }

    if (video.src === url && video.readyState >= 1) return;

    // blob: URL에는 crossOrigin 속성을 부여하지 않아야 WebKit CORS 차단을 방지함
    if (url.startsWith('blob:')) {
      video.removeAttribute('crossorigin');
      video.crossOrigin = null;
    } else {
      video.crossOrigin = 'anonymous';
      video.setAttribute('crossorigin', 'anonymous');
    }

    video.src = url;
    if (workerAudioGain) {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1.0;
    } else {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
    }
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (!workerAudioGain) {
      video.setAttribute('muted', '');
    }
    try {
      video.load();
    } catch {
      // ignore
    }

    const result = await raceWithTimeout(
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
        };
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          const errCode = video.error?.code;
          const errMsg = video.error?.message;
          const detail = errCode ? ` (코드 ${errCode}${errMsg ? `: ${errMsg}` : ''})` : '';
          reject(new Error(`비디오 로드 실패: ${name}${detail}`));
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
      }),
      timeoutMs
    );

    if (result.status === 'error') throw result.error;
    if (result.status === 'timeout') {
      throw new Error(`비디오 로드 시간 초과 (${Math.round(timeoutMs / 1000)}초): ${name} (readyState=${video.readyState})`);
    }
  };

  const startPlayback = async (video: HTMLVideoElement, timeoutMs: number): Promise<boolean> => {
    if (workerAudioGain) {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1.0;
    } else {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.setAttribute('muted', '');
    }
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    let playPromise: Promise<void>;
    try {
      playPromise = video.play();
    } catch (err) {
      console.warn('[VideoStitcher] play() 즉시 실패, muted 폴백:', err);
      video.muted = true;
      try {
        playPromise = video.play();
      } catch {
        return false;
      }
    }
    const result = await raceWithTimeout(playPromise, timeoutMs);
    if (result.status === 'ok') return true;
    if (result.status === 'error') {
      console.warn('[VideoStitcher] play() 실패:', result.error);
    }
    return false;
  };

  const waitForPlaybackAdvance = (video: HTMLVideoElement, fromTime: number, timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      let checkTimer: number | null = null;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (advanced: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener('timeupdate', check);
        if (checkTimer !== null) window.clearInterval(checkTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        resolve(advanced);
      };

      const check = () => {
        if (video.currentTime > fromTime + 0.02) finish(true);
      };

      timeoutTimer = setTimeout(
        () => finish(video.currentTime > fromTime + 0.02),
        timeoutMs
      );
      video.addEventListener('timeupdate', check);
      checkTimer = window.setInterval(check, 50);
    });

  const prepareWorkerForSegment = async (
    worker: HTMLVideoElement,
    segment: HighlightSegment
  ): Promise<{ ok: boolean; reason?: string }> => {
    const videoItem = videoMap.get(segment.sourceVideoId);
    if (!videoItem) {
      return { ok: false, reason: `비디오 정보를 찾을 수 없습니다 (ID: ${segment.sourceVideoId})` };
    }
    if (!videoItem.url || videoItem.url.trim() === '') {
      return {
        ok: false,
        reason: `[${videoItem.name}] 영상의 재생 데이터(Blob URL)가 비어 있습니다. 모바일 브라우저 재접속 또는 메모리 절약으로 인해 비디오가 언로드되었을 수 있으니 영상을 다시 선택해 주세요.`,
      };
    }
    try {
      try {
        worker.pause();
      } catch {
        // ignore
      }
      await loadVideoSource(worker, videoItem.url, videoItem.name, 12000);
      try {
        worker.pause();
      } catch {
        // ignore
      }
      await seekVideo(worker, segment.start, 10000);
      await waitForVideoReady(worker, 8000);
      try {
        worker.pause();
      } catch {
        // ignore
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[VideoStitcher] prepareWorkerForSegment 실패:', err);
      return { ok: false, reason: msg };
    }
  };

  // 인트로/아웃트로 사용자 동영상 클립 합성 렌더링
  const renderCustomVideoClip = async (clipFile: File, label: string): Promise<number> => {
    onProgress?.(label === '시작 인트로' ? 1 : 98, `${label} 영상 로드 및 합성 중...`);
    const blobUrl = URL.createObjectURL(clipFile);
    try {
      await loadVideoSource(workerA, blobUrl, label, 12000);
      const clipDuration = workerA.duration && Number.isFinite(workerA.duration) ? workerA.duration : 0;

      await seekVideo(workerA, 0, 6000);
      await waitForVideoReady(workerA, 6000);
      drawCoverFrame(workerA);
      commitCanvasFrame();

      const playing = await startPlayback(workerA, IS_IOS ? 2500 : 5000);
      if (!playing) {
        onLog?.(`${label} 영상을 재생할 수 없어 건너뜁니다.`);
        return 0;
      }

      await startOrResumeRecorder();

      await new Promise<void>((resolve) => {
        const startedAt = performance.now();
        const maxRealDurationMs = Math.max(3000, (clipDuration + 1.5) * 1000);
        let intervalId: number | null = null;
        let rafId: number | null = null;
        let finished = false;
        let lastDrawnClipTime = -1;

        const finish = () => {
          if (finished) return;
          finished = true;
          if (intervalId !== null) window.clearInterval(intervalId);
          if (rafId !== null) window.cancelAnimationFrame(rafId);
          try {
            workerA.pause();
          } catch {
            // ignore
          }
          resolve();
        };

        const tick = () => {
          if (finished) return;
          if (workerA.ended || workerA.paused || performance.now() - startedAt >= maxRealDurationMs) {
            finish();
            return;
          }
          const curT = workerA.currentTime;
          if (Math.abs(curT - lastDrawnClipTime) >= 0.004 || performance.now() - lastCanvasDrawAt >= targetFrameIntervalMs) {
            lastDrawnClipTime = curT;
            drawCoverFrame(workerA);
            commitCanvasFrame();
          }
        };

        const rafLoop = () => {
          if (finished) return;
          tick();
          if (!finished) {
            rafId = window.requestAnimationFrame(rafLoop);
          }
        };

        workerA.addEventListener('ended', finish, { once: true });
        intervalId = window.setInterval(tick, targetFrameIntervalMs);
        rafId = window.requestAnimationFrame(rafLoop);
        tick();
      });

      if (label !== '종료 아웃트로') {
        await pauseRecorder();
      }
      return clipDuration;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  // 인트로 시퀀스 렌더링 (약 1.6초 - 드리프트 보정 Wall-Clock 페이싱 적용)
  const renderIntroSequence = async (): Promise<number> => {
    if (!overlayOptions?.showIntro) return 0;
    if (workerAudioGain && audioCtx) {
      workerAudioGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    onProgress?.(1, '시작 인트로 타이틀 시퀀스 생성 중...');

    const introDurationSec = 1.6;
    const introFrames = Math.round(introDurationSec * targetFps);
    const frameInterval = 1000 / targetFps;
    await startOrResumeRecorder();
    const seqStartWall = performance.now();

    for (let f = 0; f < introFrames; f++) {
      if (signal?.aborted) throw new Error('작업 취소');

      const progress = f / introFrames;
      const alpha = progress < 0.25 ? progress / 0.25 : progress > 0.8 ? (1 - progress) / 0.2 : 1.0;

      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const grad = ctx.createRadialGradient(
        targetWidth / 2, targetHeight / 2, Math.round(30 * scale),
        targetWidth / 2, targetHeight / 2, Math.round(450 * scale)
      );
      grad.addColorStop(0, `rgba(49, 130, 246, ${0.28 * alpha})`);
      grad.addColorStop(1, 'rgba(8, 12, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      const title = overlayOptions.titleText || 'Highlights';
      const introTitleFont = Math.round(36 * scale);
      ctx.font = `bold ${introTitleFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = Math.round(12 * scale);
      ctx.fillText(title, targetWidth / 2, targetHeight / 2 - Math.round(20 * scale));

      const sub = [
        overlayOptions.showDate === false ? '' : overlayOptions.subtitleDateText,
        overlayOptions.subtitleLocationText,
        overlayOptions.channelText,
      ].filter(Boolean).join(' • ');
      if (sub) {
        const introSubFont = Math.round(19 * scale);
        ctx.font = `600 ${introSubFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
        ctx.fillStyle = '#93c5fd';
        ctx.fillText(sub, targetWidth / 2, targetHeight / 2 + Math.round(30 * scale));
      }

      ctx.restore();
      commitCanvasFrame();

      // 드로우 소요 시간을 차감하여 정확한 프레임 간격 유지 (드리프트 0%)
      const targetNextWall = seqStartWall + (f + 1) * frameInterval;
      const waitMs = Math.max(2, targetNextWall - performance.now());
      await sleep(waitMs);
    }

    // 인트로 직후 첫 세그먼트로 바로 이어지므로 recorder pause 없이 continuous recording
    return introDurationSec;
  };

  // 아웃트로 시퀀스 렌더링 (약 1.8초 - 드리프트 보정 Wall-Clock 페이싱 적용)
  const renderOutroSequence = async (): Promise<number> => {
    if (!overlayOptions?.showOutro) return 0;
    if (workerAudioGain && audioCtx) {
      workerAudioGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    onProgress?.(98, '종료 아웃트로 엔드 카드 생성 중...');

    const outroDurationSec = 1.8;
    const outroFrames = Math.round(outroDurationSec * targetFps);
    const frameInterval = 1000 / targetFps;
    await startOrResumeRecorder();
    const seqStartWall = performance.now();

    for (let f = 0; f < outroFrames; f++) {
      if (signal?.aborted) throw new Error('Cancelled');

      const progress = f / outroFrames;
      const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.85 ? (1 - progress) / 0.15 : 1.0;

      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      const outroTitleFont = Math.round(32 * scale);
      ctx.font = `bold ${outroTitleFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const outroMessage = overlayOptions.outroText || 'Thank you for watching';
      ctx.fillText(outroMessage, targetWidth / 2, targetHeight / 2 - Math.round(16 * scale));

      if (overlayOptions.channelText) {
        const outroChFont = Math.round(20 * scale);
        ctx.font = `bold ${outroChFont}px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif`;
        ctx.fillStyle = '#3182f6';
        ctx.fillText(overlayOptions.channelText, targetWidth / 2, targetHeight / 2 + Math.round(28 * scale));
      }

      ctx.restore();
      commitCanvasFrame();

      const targetNextWall = seqStartWall + (f + 1) * frameInterval;
      const waitMs = Math.max(2, targetNextWall - performance.now());
      await sleep(waitMs);
    }

    // 아웃트로 직후 finalBlob 생성으로 이어지므로 pause하지 않고 recording 상태 유지
    return outroDurationSec;
  };

  // 브릿지 시작 시 이전 장면의 마지막 프레임을 보존하기 위한 오프스크린 캔버스
  const prevFrameBufferCanvas = document.createElement('canvas');
  prevFrameBufferCanvas.width = targetWidth;
  prevFrameBufferCanvas.height = targetHeight;
  const prevFrameBufferCtx = prevFrameBufferCanvas.getContext('2d');
  const capturePrevFrameSnapshot = () => {
    try {
      prevFrameBufferCtx?.drawImage(canvas, 0, 0);
    } catch {
      // ignore
    }
  };

  // 브릿지 종료 시 열릴 다음 장면의 첫 프레임을 사전 캐싱하기 위한 오프스크린 캔버스
  // (매 브릿지 프레임마다 video 엘리먼트에서 크롭/스케일링을 반복 계산하지 않고 오프스크린 복사로 부하 제거)
  const nextFrameBufferCanvas = document.createElement('canvas');
  nextFrameBufferCanvas.width = targetWidth;
  nextFrameBufferCanvas.height = targetHeight;
  const nextFrameBufferCtx = nextFrameBufferCanvas.getContext('2d');

  // HyperFrames (GSAP 결정론적 타임라인 seek + Canvas 2D) 챕터 브릿지 렌더링 (약 2.2초 - 드리프트 보정 페이싱)
  const renderChapterBridgeSequence = async (
    prevSeg: HighlightSegment,
    nextSeg: HighlightSegment,
    nextIdx: number,
    nextVideoItem?: VideoItem
  ): Promise<number> => {
    const bridgeInfo = evaluateChapterBridge(prevSeg, nextSeg, nextIdx, allSegments.length, overlayOptions);
    if (!bridgeInfo.shouldBridge) return 0;
    if (workerAudioGain && audioCtx) {
      workerAudioGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }

    const bridgeTotalFrames = Math.round(CHAPTER_BRIDGE_DURATION * targetFps);
    const frameInterval = 1000 / targetFps;
    renderModeHistory.push(`[bridge->seg#${nextSeg.id.slice(-4)}: ${bridgeTotalFrames}f]`);

    // 다음 장면 첫 프레임을 브릿지 시작 전 1회만 그려서 오프스크린 버퍼에 캐싱
    if (nextFrameBufferCtx) {
      if (nextVideoItem) {
        drawCoverFrame(workerA, nextVideoItem, nextSeg);
        nextFrameBufferCtx.drawImage(canvas, 0, 0);
      } else {
        nextFrameBufferCtx.fillStyle = '#07090e';
        nextFrameBufferCtx.fillRect(0, 0, targetWidth, targetHeight);
      }
      // 캔버스를 이전 장면 스냅샷으로 복원한 상태에서 브릿지 시작
      ctx.drawImage(prevFrameBufferCanvas, 0, 0);
      commitCanvasFrame();
    }

    await startOrResumeRecorder();
    const bridgeStartWall = performance.now();

    for (let f = 0; f < bridgeTotalFrames; f++) {
      if (signal?.aborted) throw new Error('사용자에 의해 작업이 취소되었습니다.');
      if (recorderError) throw recorderError;

      const timeSec = (f / bridgeTotalFrames) * CHAPTER_BRIDGE_DURATION;
      totalDrawCalls++;
      bridgeController.seekAndRender(
        ctx,
        timeSec,
        targetWidth,
        targetHeight,
        bridgeInfo,
        () => {
          ctx.drawImage(nextFrameBufferCanvas, 0, 0);
        },
        () => {
          ctx.drawImage(prevFrameBufferCanvas, 0, 0);
        }
      );
      commitCanvasFrame();

      const targetNextWall = bridgeStartWall + (f + 1) * frameInterval;
      const waitMs = Math.max(2, targetNextWall - performance.now());
      await sleep(waitMs);

      reportProgress(
        ((recordedDurationSoFar + timeSec) / (totalSegmentsDuration || 1)) * 100,
        `챕터 전환 브릿지 합성 중 (${bridgeInfo.chapterIndex}장)...`
      );
    }

    actualBridgeDurationMap[nextSeg.id] = CHAPTER_BRIDGE_DURATION;
    recordedDurationSoFar += CHAPTER_BRIDGE_DURATION;
    return CHAPTER_BRIDGE_DURATION;
  };

  try {
    await requestWakeLock();

    // 시작 시점에 공용 AudioContext가 켜져 있으면 잠시 멈춰두고 첫 녹화 시점에 resume
    if (audioCtx && audioCtx.state === 'running') {
      await audioCtx.suspend().catch(() => {});
    }

    let actualIntroDuration = 0;
    let actualOutroDuration = 0;

    // 0. 인트로 렌더링 (옵션 활성화 시: 영상 파일 우선, 없으면 타이틀 시퀀스)
    if (overlayOptions?.showIntro) {
      if (overlayOptions.introVideoFile) {
        actualIntroDuration = await renderCustomVideoClip(overlayOptions.introVideoFile, '시작 인트로');
      } else {
        actualIntroDuration = await renderIntroSequence();
      }
    }

    // 1. 첫 번째 구간을 workerA에 준비
    reportProgress(0, `구간 1/${allSegments.length} 비디오 버퍼 준비 중...`, true);
    const seg0Prep = await prepareWorkerForSegment(workerA, allSegments[0]);
    if (!seg0Prep.ok) {
      throw new Error(`첫 번째 구간 비디오를 준비하지 못했습니다: ${seg0Prep.reason || allSegments[0].sourceVideoId}`);
    }

    const firstVideoItem = videoMap.get(allSegments[0].sourceVideoId);
    if (firstVideoItem) {
      renderFrameWithOverlay(workerA, firstVideoItem, allSegments[0], getSegmentOverlayCanvas(allSegments[0]));
    }

    // 시크 기반 프레임 스텝 렌더링 (저전력 모드 또는 실시간 재생 차단 환경을 위한 무결점 폴백)
    const renderSegmentByStepping = async (
      worker: HTMLVideoElement,
      videoItem: VideoItem,
      segment: HighlightSegment,
      overlayCanvas: HTMLCanvasElement | null,
      clipMessage: string,
      isLastSegment = false
    ) => {
      try {
        worker.pause();
      } catch {
        // ignore
      }
      if (workerAudioGain && audioCtx) {
        workerAudioGain.gain.setValueAtTime(Math.max(0, Math.min(2.0, segment.volume ?? 1.0)), audioCtx.currentTime);
      }

      const fps = 30;
      const frameCount = Math.max(2, Math.ceil(segment.duration * fps));
      const frameInterval = 1000 / fps;
      renderModeHistory.push(`[seg#${segment.id.slice(-4)}: stepping (${frameCount}f)]`);

      for (let frame = 0; frame < frameCount; frame++) {
        if (signal?.aborted) throw new Error('사용자에 의해 작업이 취소되었습니다.');
        if (recorderError) throw recorderError;

        const time = Math.min(
          segment.start + frame / fps,
          Math.max(segment.start, segment.end - 0.05)
        );

        // 탐색(seek) 중에는 레코더를 일시정지하여 seek 대기 시간이 녹화본에 들어가지 않도록 방어
        await pauseRecorder();
        await seekVideo(worker, time, 2500);

        renderFrameWithOverlay(worker, videoItem, segment, overlayCanvas);

        // 프레임이 준비된 후 레코더를 켜고 1프레임 시간 동안 녹화
        await startOrResumeRecorder();
        await sleep(frameInterval);

        const clipElapsed = Math.min(segment.duration, frame / fps);
        reportProgress(
          ((recordedDurationSoFar + clipElapsed) / (totalSegmentsDuration || 1)) * 100,
          clipMessage
        );
      }

      if (!isLastSegment) {
        await pauseRecorder();
      }
    };

    // 2. 첫 번째 구간 재생 시작 및 레코더 개시 (단일 하드웨어 디코더 연속 재생 파이프라인)
    let currentSegmentIdx = 0;
    let recordingWallStartAt = 0;

    let initialPlaying = await startPlayback(workerA, IS_IOS ? 3000 : 6000);
    if (!initialPlaying) {
      onLog?.(`구간 1 비디오 버퍼 대기 후 재생 재시도 중...`);
      await sleep(500);
      initialPlaying = await startPlayback(workerA, IS_IOS ? 3000 : 6000);
    }

    if (!initialPlaying) {
      onLog?.('실시간 재생이 지연/차단되어(아이폰 저전력 모드 또는 브라우저 정책) 정밀 프레임 스텝 모드로 자동 전환하여 병합합니다.');
      renderModeHistory.push('[pipeline: fallback to frame stepping]');
      recordingWallStartAt = performance.now();

      for (let i = 0; i < allSegments.length; i++) {
        if (signal?.aborted) throw new Error('사용자에 의해 작업이 취소되었습니다.');
        if (recorderError) throw recorderError;

        const segment = allSegments[i];
        const videoItem = videoMap.get(segment.sourceVideoId);
        if (!videoItem) continue;

        const isLastSegment = i === allSegments.length - 1 && !overlayOptions?.showOutro;
        const clipMessage = `구간 ${i + 1}/${allSegments.length} 정밀 병합 중: [${videoItem.name}] (${segment.start.toFixed(1)}s ~ ${segment.end.toFixed(1)}s)`;
        reportProgress(
          (recordedDurationSoFar / (totalSegmentsDuration || 1)) * 100,
          clipMessage,
          true
        );

        if (i > 0) {
          await pauseRecorder();
          capturePrevFrameSnapshot();
          const segPrep = await prepareWorkerForSegment(workerA, segment);
          if (!segPrep.ok) {
            throw new Error(`구간 ${i + 1} 비디오를 준비하지 못했습니다: ${segPrep.reason || segment.sourceVideoId}`);
          }
          await renderChapterBridgeSequence(allSegments[i - 1], segment, i, videoItem);
        }

        await renderSegmentByStepping(
          workerA,
          videoItem,
          segment,
          getSegmentOverlayCanvas(segment),
          clipMessage,
          isLastSegment
        );

        recordedDurationSoFar += segment.duration;
      }
    } else {
      renderModeHistory.push('[pipeline: single-worker continuous hardware playback]');
      if (workerAudioGain && audioCtx) {
        workerAudioGain.gain.setValueAtTime(Math.max(0, Math.min(2.0, allSegments[0]?.volume ?? 1.0)), audioCtx.currentTime);
      }
      await waitForPlaybackAdvance(workerA, workerA.currentTime, 5000);
      await startOrResumeRecorder();
      recordingWallStartAt = performance.now();

      // 3. 단일 워커 무중단 실시간 합성 루프 (VSync + VideoFrameCallback + 백업 인터벌 3중 하이브리드)
      // iOS Safari의 단일 하드웨어 디코더 제한을 회피하기 위해 pause()나 2번째 video 엘리먼트 없이
      // 하나의 video 엘리먼트에서 재생 상태를 유지한 채 currentTime 점프만으로 세그먼트를 전환한다.
      await new Promise<void>((resolve, reject) => {
        let isTransitioning = false;
        let settled = false;
        let intervalId: number | null = null;
        let rafId: number | null = null;
        let rvfcId: number | null = null;
        let segmentStartedAt = performance.now();
        let activePlaybackAccumSec = 0;
        let lastTickAt = performance.now();
        let lastDrawnMediaTime = -1;
        let lastDrawnSegmentIdx = -1;

        const videoWithRvfc = workerA as VideoWithFrameCallback;

        const finishAll = (err?: Error) => {
          if (settled) return;
          settled = true;
          if (intervalId !== null) window.clearInterval(intervalId);
          if (rafId !== null) window.cancelAnimationFrame(rafId);
          if (rvfcId !== null && typeof videoWithRvfc.cancelVideoFrameCallback === 'function') {
            try {
              videoWithRvfc.cancelVideoFrameCallback(rvfcId);
            } catch {
              // ignore
            }
          }
          try {
            workerA.pause();
          } catch {}
          if (err) reject(err);
          else resolve();
        };

        const tick = async (forceDraw = false) => {
          const now = performance.now();
          const dtSec = Math.min(0.1, Math.max(0, (now - lastTickAt) / 1000));
          lastTickAt = now;

          if (settled || isTransitioning) return;
          if (signal?.aborted) {
            finishAll(new Error('사용자에 의해 작업이 취소되었습니다.'));
            return;
          }
          if (recorderError) {
            finishAll(recorderError);
            return;
          }

          const currentSegment = allSegments[currentSegmentIdx];
          const currentVideoItem = videoMap.get(currentSegment.sourceVideoId);
          const currentOverlay = getSegmentOverlayCanvas(currentSegment);

          // 실제 비디오가 시크 중이 아니고 정상 재생 중일 때만 프레임을 그리고 실제 재생 시간을 누적
          if (currentVideoItem && !workerA.seeking) {
            if (workerA.paused && !workerA.ended) {
              // 만약 시크 직후 일시적으로 paused 상태가 되었다면 즉시 재개
              void workerA.play().catch(() => {});
            } else {
              activePlaybackAccumSec += dtSec;
            }

            const curMediaTime = workerA.currentTime;
            const mediaTimeAdvanced = Math.abs(curMediaTime - lastDrawnMediaTime) >= 0.002;
            const segmentChanged = currentSegmentIdx !== lastDrawnSegmentIdx;
            const keepAliveDue = now - lastCanvasDrawAt >= 32;

            // 새 디코딩 프레임이 도착했거나(mediaTimeAdvanced / forceDraw)
            // 인코더 CFR 유지를 위해 최소 32ms가 경과했을 때만 드로우하여 불필요한 중복 GPU 합성 방지
            if (forceDraw || mediaTimeAdvanced || segmentChanged || keepAliveDue) {
              lastDrawnMediaTime = curMediaTime;
              lastDrawnSegmentIdx = currentSegmentIdx;
              renderFrameWithOverlay(workerA, currentVideoItem, currentSegment, currentOverlay);
            }
          }

          const clipElapsed = Math.max(
            0,
            Math.min(
              currentSegment.duration,
              Math.max(activePlaybackAccumSec, workerA.currentTime - currentSegment.start)
            )
          );
          reportProgress(
            ((recordedDurationSoFar + clipElapsed) / (totalSegmentsDuration || 1)) * 100,
            `구간 ${currentSegmentIdx + 1}/${allSegments.length} 병합 중: [${currentVideoItem?.name ?? ''}]`
          );

          const realWallElapsedSec = (now - segmentStartedAt) / 1000;
          const maxDurationMs = Math.max(5000, (currentSegment.duration * 2.5 + 4) * 1000);

          // 중요: 시크 지연 시간(seeking)을 제외한 실제 재생 누적 시간이 구간 길이의 88% 이상이고
          // 비디오의 currentTime이 실제로 segment.end에 도달했을 때만 세그먼트 완료로 판정!
          const isTimeReached =
            !workerA.seeking &&
            activePlaybackAccumSec >= currentSegment.duration * 0.88 &&
            (workerA.currentTime >= currentSegment.end - 0.04 || workerA.ended);

          const isSegmentDone =
            isTimeReached ||
            realWallElapsedSec * 1000 >= maxDurationMs;

          if (isSegmentDone && !isTransitioning) {
            isTransitioning = true;
            recordedDurationSoFar += currentSegment.duration;
            const prevSegment = currentSegment;
            currentSegmentIdx++;

            if (currentSegmentIdx < allSegments.length) {
              const nextSegment = allSegments[currentSegmentIdx];
              const nextVideoItem = videoMap.get(nextSegment.sourceVideoId);
              const nextOverlay = getSegmentOverlayCanvas(nextSegment);
              const bridgeEval = evaluateChapterBridge(prevSegment, nextSegment, currentSegmentIdx, allSegments.length, overlayOptions);

              if (bridgeEval.shouldBridge) {
                // 챕터 브릿지가 필요한 경우:
                // 1) 레코더를 일시정지하고 이전 장면의 마지막 프레임을 스냅샷으로 보존
                // 2) workerA를 다음 장면의 시작 프레임으로 시크한 뒤
                // 3) 이전 장면 위로 5단 루버가 샤샤샥 닫히고 -> 마스크 타이포 -> 다음 장면으로 샤샤샥 열리는 브릿지 녹화!
                await pauseRecorder();
                capturePrevFrameSnapshot();
                try {
                  workerA.pause();
                } catch {}

                if (nextSegment.sourceVideoId !== prevSegment.sourceVideoId && nextVideoItem) {
                  await loadVideoSource(workerA, nextVideoItem.url, nextVideoItem.name, 10000);
                }
                await seekVideo(workerA, nextSegment.start, 6000);
                await waitForVideoReady(workerA, 5000);

                await renderChapterBridgeSequence(prevSegment, nextSegment, currentSegmentIdx, nextVideoItem);

                await startPlayback(workerA, 3000);
              } else if (nextSegment.sourceVideoId === prevSegment.sourceVideoId) {
                // 동일 영상 내 다른 구간으로 이동: pause() 없이 재생 상태를 그대로 유지한 채 즉시 점프!
                // (iOS Safari에서 재생 권한 및 하드웨어 디코더 파이프라인이 절대 끊기지 않음)
                try {
                  workerA.currentTime = nextSegment.start;
                } catch {}

                // 시크가 완료되어 실제 프레임이 준비될 때까지 짧게 대기 (최대 1.5초)
                await new Promise<void>((res) => {
                  if (!workerA.seeking && Math.abs(workerA.currentTime - nextSegment.start) < 0.25) {
                    res();
                    return;
                  }
                  let done = false;
                  const onSeeked = () => {
                    if (done) return;
                    done = true;
                    workerA.removeEventListener('seeked', onSeeked);
                    res();
                  };
                  workerA.addEventListener('seeked', onSeeked);
                  setTimeout(onSeeked, 1500);
                });

                if (workerA.paused) {
                  await startPlayback(workerA, 2000);
                }
              } else if (nextVideoItem) {
                // 다른 영상 파일로 전환하는 경우(예: 18개 영상 연속 병합):
                // 로딩/시크(최대 수백 ms ~ 2초) 동안 이전 프레임이 멈춘 채로 녹화(프리즈 프레임 드랍)되는 현상을 방지하기 위해
                // 레코더를 일시정지하고 이전 디코더 버퍼를 비운 뒤 새 영상을 준비한다.
                await pauseRecorder();
                try {
                  workerA.pause();
                  workerA.removeAttribute('src');
                  workerA.load();
                } catch {}
                await loadVideoSource(workerA, nextVideoItem.url, nextVideoItem.name, 10000);
                await seekVideo(workerA, nextSegment.start, 6000);
                await waitForVideoReady(workerA, 5000);
                await startPlayback(workerA, 3000);
                await startOrResumeRecorder();
              }

              if (nextVideoItem && !workerA.seeking) {
                lastDrawnMediaTime = workerA.currentTime;
                lastDrawnSegmentIdx = currentSegmentIdx;
                renderFrameWithOverlay(workerA, nextVideoItem, nextSegment, nextOverlay);
              }

              if (workerAudioGain && audioCtx) {
                workerAudioGain.gain.setValueAtTime(Math.max(0, Math.min(2.0, nextSegment.volume ?? 1.0)), audioCtx.currentTime);
              }

              activePlaybackAccumSec = 0;
              segmentStartedAt = performance.now();
              lastTickAt = performance.now();
              isTransitioning = false;
            } else {
              // 모든 구간 완료
              finishAll();
            }
          }
        };

        // 1) 비디오 디코더가 새 프레임을 내놓는 즉시 실행되는 콜백 (Safari 15.4+ & Chrome 지원)
        if (typeof videoWithRvfc.requestVideoFrameCallback === 'function') {
          const onVideoFrame = () => {
            if (settled) return;
            void tick(true);
            if (!settled && typeof videoWithRvfc.requestVideoFrameCallback === 'function') {
              rvfcId = videoWithRvfc.requestVideoFrameCallback(onVideoFrame);
            }
          };
          rvfcId = videoWithRvfc.requestVideoFrameCallback(onVideoFrame);
        }

        // 2) 디스플레이 주사율(VSync) 동기화 루프
        const onAnimationFrame = () => {
          if (settled) return;
          void tick(false);
          if (!settled) {
            rafId = window.requestAnimationFrame(onAnimationFrame);
          }
        };
        rafId = window.requestAnimationFrame(onAnimationFrame);

        // 3) 백그라운드 탭/모바일 스크롤 등으로 rAF가 지연될 때도 절대 멈추지 않게 보장하는 백업 인터벌
        intervalId = window.setInterval(() => {
          void tick(false);
        }, 1000 / 30);

        void tick(true);
      });
    }

    // 마무리 아웃트로 렌더링 (옵션 활성화 시: 영상 파일 우선, 없으면 엔딩 시퀀스)
    if (overlayOptions?.showOutro) {
      if (overlayOptions.outroVideoFile) {
        actualOutroDuration = await renderCustomVideoClip(overlayOptions.outroVideoFile, '종료 아웃트로');
      } else {
        actualOutroDuration = await renderOutroSequence();
      }
    }

    // 실제 레코더가 녹화한 총 경과 시간 측정 (시크에 걸린 미세 시간까지 반영하여 플레이어 조기 끊김 방지)
    const actualRecordedSegmentsSec =
      recordingWallStartAt > 0
        ? Math.max(totalSegmentsDuration, (performance.now() - recordingWallStartAt) / 1000)
        : totalSegmentsDuration;

    onProgress?.(99, '16:9 고화질 하이라이트 영상 파일 생성 중...');

    if (!recorderStarted) {
      throw new Error('녹화된 영상 구간이 없습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.');
    }

    // WebKit VideoToolbox 하드웨어 인코더 플러시 대기 (마지막 프레임 렌더 후 최소 350ms 대기 필수)
    await sleep(350);

    // 레코더 중지 및 Blob 완성 대기 (onstop이 오지 않는 모바일 브라우저 방어)
    const finalMimeType = recorder.mimeType || mimeType || 'video/mp4';
    const finalBlob = await new Promise<Blob>((resolve) => {
      let settled = false;
      const finish = (timedOut = false) => {
        if (settled) return;
        settled = true;
        if (timedOut) onstopWaitTimeout = true;
        else onstopFired = true;
        resolve(new Blob(chunks, { type: finalMimeType }));
      };
      recorder.onstop = () => finish(false);
      try {
        // iOS Safari는 paused 상태에서 stop()을 호출하면 버퍼 데이터를 버리고 ondataavailable을 주지 않는다.
        if (recorder.state === 'paused') {
          try {
            recorder.resume();
          } catch {
            // ignore
          }
        }
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          finish(false);
        }
      } catch {
        finish(false);
      }
      setTimeout(() => finish(true), 8000);
    });

    if (finalBlob.size === 0) {
      const vTrack = canvasStream.getVideoTracks()[0];
      const audioTracks = canvasStream.getAudioTracks();
      const chunksSummary = chunks.map((c) => `${c.size}B`).slice(0, 8).join(', ');

      const diagLines = [
        `[1] 인코더: ${finalMimeType} | 상태: ${recorder.state} | 시작이벤트: ${startEventFired}`,
        `[2] 청크: ${chunks.length}개 (ondataavailable: ${dataAvailableCalls}회, 크기들: [${chunksSummary || '없음'}])`,
        `[3] onstop: ${onstopFired ? '수신완료' : onstopWaitTimeout ? '타임아웃' : '미수신'}`,
        `[4] 캔버스트랙: ${vTrack ? `상태=${vTrack.readyState}, muted=${vTrack.muted}, enabled=${vTrack.enabled}` : '없음'} (오디오트랙: ${audioTracks.length}개)`,
        `[5] 워커 상태: ${workerA.videoWidth}x${workerA.videoHeight}, ready=${workerA.readyState}, cur=${workerA.currentTime.toFixed(2)}s, paused=${workerA.paused}`,
        `[6] 총드로우: ${totalDrawCalls}회 실행`,
        `[7] 모드이력: ${renderModeHistory.join(' → ')}`,
        `[8] 환경: iOS=${IS_IOS}, Safari=${IS_SAFARI}`,
      ];

      throw new Error(
        `브라우저가 영상 프레임을 캡처하지 못했습니다. (0 bytes)\n\n=== [아이폰 상세 진단 리포트] ===\n${diagLines.join('\n')}`
      );
    }

    const finalUrl = URL.createObjectURL(finalBlob);
    const originalTotalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
    // 시크 딜레이가 약간 포함된 경우에도 마지막 씬이 끝까지 재생되도록 최대 1.2초 범위 내에서 실제 녹화 시간 반영
    const effectiveSegmentsDuration = Math.min(
      totalSegmentsDuration + allSegments.length * 0.6,
      actualRecordedSegmentsSec
    );
    const totalCalculatedDuration = actualIntroDuration + effectiveSegmentsDuration + actualOutroDuration;

    onLog?.(`병합 완료: ${(finalBlob.size / (1024 * 1024)).toFixed(1)}MB · ${finalMimeType || 'video/webm'}`);
    onProgress?.(100, '극적 하이라이트 영상이 완성되었습니다!');

    return {
      blob: finalBlob,
      url: finalUrl,
      duration: Math.round(totalCalculatedDuration * 10) / 10,
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
      bridgeController.dispose();
      if (bgmController) {
        bgmController.stop();
      }
      try {
        workerA.pause();
      } catch {
        // ignore
      }
      workerA.removeAttribute('src');
      workerA.srcObject = null;
      try {
        workerA.load();
      } catch {
        // ignore
      }
      for (const c of [canvas, sharedOverlayCanvas, prevFrameBufferCanvas, nextFrameBufferCanvas]) {
        try {
          c.width = 0;
          c.height = 0;
        } catch {}
      }
      // 공용 AudioContext는 재병합에서 재사용하므로 닫지 않고 잠시 중지만 한다.
      if (audioCtx && audioCtx.state === 'running') {
        void audioCtx.suspend().catch(() => {});
      }
      isStitchingActive = false;
      window.clearInterval(heartbeatTimer);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      stage.remove();
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
    } catch {
      // ignore cleanup errors
    }
  }
}
