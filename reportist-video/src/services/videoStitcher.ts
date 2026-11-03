// services/videoStitcher.ts - 16:9 유튜브 시네마틱 비디오 병합기, 자막/브랜딩 오버레이, 인트로/아웃트로 & 커스텀 BGM 지원

import type { FinalVideoResult, HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';
import { playBgmSynthLoop } from './audioSynth.ts';

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

const WEBM_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8',
  'video/webm',
];

const MP4_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
];

function supportedRecorderMimes(): string[] {
  if (typeof MediaRecorder === 'undefined') return [];
  const order = IS_IOS || IS_SAFARI ? [...MP4_CANDIDATES, ...WEBM_CANDIDATES] : [...WEBM_CANDIDATES, ...MP4_CANDIDATES];
  return order.filter((mime) => {
    try {
      return MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  });
}

function createMediaRecorder(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      '이 브라우저는 영상 녹화(MediaRecorder)를 지원하지 않습니다. 최신 Safari 또는 Chrome에서 다시 시도해 주세요.'
    );
  }

  const videoBitsPerSecond = IS_IOS ? 2_000_000 : 2_800_000;
  const candidates = [...supportedRecorderMimes(), ''];
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
// 재생을 스로틀하는 경우가 있어, 뷰포트 안쪽 1px 영역에 실제로 마운트한다.
function mountHiddenStage(canvas: HTMLCanvasElement, video: HTMLVideoElement): HTMLDivElement {
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = [
    'position:fixed',
    'left:0',
    'bottom:0',
    'width:1px',
    'height:1px',
    'opacity:0.01',
    'pointer-events:none',
    'overflow:hidden',
    'z-index:2147483646',
  ].join(';');
  for (const el of [canvas, video]) {
    el.style.width = '1px';
    el.style.height = '1px';
  }
  stage.appendChild(canvas);
  stage.appendChild(video);
  document.body.appendChild(stage);
  return stage;
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
}: StitchVideosParams): Promise<FinalVideoResult> {
  if (allSegments.length === 0) {
    throw new Error('이어붙일 하이라이트 구간이 없습니다.');
  }

  // 비디오 ID 매핑 테이블 구성
  const videoMap = new Map<string, VideoItem>();
  for (const v of videos) {
    videoMap.set(v.id, v);
  }

  // 1. 유튜브 최적화 16:9 표준 규격 (1280x720 HD) 고정
  const targetWidth = 1280;
  const targetHeight = 720;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 렌더링 컨텍스트를 생성할 수 없습니다.');
  }

  if (typeof canvas.captureStream !== 'function') {
    throw new Error(
      '이 브라우저는 화면 캡처(canvas.captureStream)를 지원하지 않습니다. 최신 Safari로 업데이트하거나 PC에서 이용해 주세요.'
    );
  }

  // 초기 캔버스 배경 설정
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 워커 비디오 엘리먼트 준비 (모바일 자동재생 정책 방어)
  const videoElem = document.createElement('video');
  videoElem.muted = true;
  videoElem.defaultMuted = true;
  videoElem.volume = 0;
  videoElem.playsInline = true;
  videoElem.preload = 'auto';
  videoElem.setAttribute('playsinline', '');
  videoElem.setAttribute('webkit-playsinline', '');
  videoElem.setAttribute('muted', '');

  const stage = mountHiddenStage(canvas, videoElem);

  // 오디오 컨텍스트 및 목적지 스트림 생성 (가능한 경우)
  const audioCtx = getSharedAudioContext();
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  if (audioCtx) {
    try {
      audioDest = audioCtx.createMediaStreamDestination();
    } catch (err) {
      console.warn('[VideoStitcher] 오디오 목적지 생성 실패 (무음 처리):', err);
    }
  }

  // 30fps 비디오 스트림 캡처
  const canvasStream = canvas.captureStream(30);
  let audioTrackAdded = false;
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
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
    ({ recorder, mimeType } = createMediaRecorder(canvasStream));
  } catch (err) {
    // 일부 모바일 브라우저는 오디오 트랙이 섞인 스트림을 녹화하지 못한다 → 무음 영상으로 재시도
    if (audioTrackAdded) {
      try {
        for (const track of canvasStream.getAudioTracks()) {
          canvasStream.removeTrack(track);
        }
        audioTrackAdded = false;
        ({ recorder, mimeType } = createMediaRecorder(canvasStream));
        onLog?.('오디오 트랙을 사용할 수 없어 무음 영상으로 병합합니다.');
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  onLog?.(`렌더러 준비 완료: ${mimeType || '브라우저 기본 코덱'}${IS_IOS ? ' · iOS 호환 모드' : ''}`);

  const chunks: Blob[] = [];
  let recorderError: Error | null = null;

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  recorder.onerror = (event) => {
    const err = (event as unknown as { error?: DOMException }).error;
    recorderError = new Error(err?.message || '영상 녹화 중 오류가 발생했습니다.');
    console.error('[VideoStitcher] MediaRecorder 오류:', err);
  };

  const totalSegmentsDuration = allSegments.reduce((sum, s) => sum + s.duration, 0);
  let recordedDurationSoFar = 0;

  let recorderStarted = false;
  let bgmController: { stop: () => void } | null = null;
  const wakeLockRef: { current: WakeLockSentinel | null } = { current: null };

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
          customSourceNode.loop = true;

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
        // iOS/Safari는 timeslice 분할 녹화에서 조각이 깨지는 사례가 있어
        // 한 번에 모았다가 stop 시점에 하나의 파일로 받는다.
        if (IS_IOS || IS_SAFARI) {
          recorder.start();
        } else {
          recorder.start(500);
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

  // 16:9 캔버스(1280x720)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림
  const drawCoverFrame = (vItem?: VideoItem, segment?: HighlightSegment) => {
    const vW = videoElem.videoWidth || vItem?.width || targetWidth;
    const vH = videoElem.videoHeight || vItem?.height || targetHeight;

    const targetAspect = targetWidth / targetHeight; // 1280 / 720 = 16:9 (~1.777778)
    const srcAspect = vW / vH;

    let sx = 0;
    let sy = 0;
    let sWidth = vW;
    let sHeight = vH;

    if (srcAspect > targetAspect) {
      // 1) 16:9보다 좌우로 더 넓은 영상 (예: 21:9 시네마틱 뷰, 1920x800)
      sHeight = vH;
      sWidth = Math.round(vH * targetAspect);
      sx = Math.round((vW - sWidth) / 2);
      sy = 0;
    } else if (srcAspect < targetAspect) {
      // 2) 16:9보다 세로로 길쭉한 영상 (예: 9:16 쇼츠/릴스, 4:3)
      sWidth = vW;
      sHeight = Math.round(vW / targetAspect);
      sx = 0;

      if (vH > vW) {
        // 세로 영상(9:16)은 인물의 얼굴과 상체가 주로 위쪽에 위치하므로
        // 사용자가 지정한 크롭 상단 편향 반영 (기본값: 0.25)
        const excessHeight = vH - sHeight;
        const ratio = segment?.cropOffsetYRatio ?? 0.25;
        sy = Math.round(excessHeight * ratio);
      } else {
        // 4:3 등 일반 가로 영상은 상하 중앙 정렬
        sy = Math.round((vH - sHeight) / 2);
      }
    }

    // 소스 좌표 범위 안전 클램핑
    sx = Math.max(0, Math.min(sx, Math.max(0, vW - sWidth)));
    sy = Math.max(0, Math.min(sy, Math.max(0, vH - sHeight)));

    // 대상 캔버스는 항상 (0, 0, 1280, 720) 전체를 정확하게 채움
    ctx.drawImage(videoElem, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  };

  // 자막 및 브랜딩 오버레이 (제목, 채널, 씬별 하단 날짜+제목 자막) 그리기
  const drawOverlays = (currentSegment?: HighlightSegment) => {
    if (!overlayOptions) return;

    // 1. 좌측 상단 영상 제목
    if (overlayOptions.showTitle && overlayOptions.titleText) {
      ctx.save();
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      const text = overlayOptions.titleText;
      const metrics = ctx.measureText(text);
      const padX = 14;
      const boxW = metrics.width + padX * 2;
      const boxH = 38;
      const x = 32;
      const y = 28;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, boxW, boxH, 6);
      } else {
        ctx.rect(x, y, boxW, boxH);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padX, y + boxH / 2);
      ctx.restore();
    }

    // 2. 우측 상단 채널 이름
    if (overlayOptions.showChannel && overlayOptions.channelText) {
      ctx.save();
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(overlayOptions.channelText, targetWidth - 32, 47);
      ctx.restore();
    }

    // 3. 하단 중앙 씬별 날짜 + 씬 제목 자막
    if (overlayOptions.showSubtitle) {
      const datePart = currentSegment?.subtitleDate || overlayOptions.subtitleDateText || '';
      const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
      const locPart = currentSegment?.locationName || overlayOptions.subtitleLocationText || '';

      const subParts = [datePart, titlePart, locPart ? `• ${locPart}` : ''].filter(Boolean);
      const subText = subParts.join(' ').trim();

      if (subText) {
        ctx.save();
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        const metrics = ctx.measureText(subText);
        const padX = 20;
        const boxW = metrics.width + padX * 2;
        const boxH = 46;
        const x = (targetWidth - boxW) / 2;
        const y = targetHeight - 76;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, boxW, boxH, 8);
        } else {
          ctx.rect(x, y, boxW, boxH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subText, targetWidth / 2, y + boxH / 2);
        ctx.restore();
      }
    }
  };

  // 진행률 콜백 스로틀 (모바일에서 초당 60회 React 리렌더로 렌더 루프가 굶는 현상 방지)
  let lastProgressAt = 0;
  const reportProgress = (pct: number, message: string, force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressAt < 150) return;
    lastProgressAt = now;
    onProgress?.(Math.min(97, Math.max(0, Math.round(pct))), message);
  };

  const seekVideo = (time: number, timeoutMs = 2000) =>
    new Promise<void>((resolve) => {
      if (Math.abs(videoElem.currentTime - time) < 0.02) {
        resolve();
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        videoElem.removeEventListener('seeked', finish);
        if (timer) clearTimeout(timer);
        resolve();
      };
      timer = setTimeout(finish, timeoutMs);
      videoElem.addEventListener('seeked', finish);
      try {
        videoElem.currentTime = time;
      } catch {
        finish();
      }
    });

  const loadVideoSource = async (url: string, name: string, timeoutMs = 8000) => {
    if (videoElem.src === url && videoElem.readyState >= 1) return;

    videoElem.src = url;
    try {
      videoElem.load();
    } catch {
      // ignore
    }

    const result = await raceWithTimeout(
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          videoElem.removeEventListener('loadedmetadata', onLoaded);
          videoElem.removeEventListener('error', onError);
        };
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error(`비디오 로드 실패: ${name}`));
        };
        videoElem.addEventListener('loadedmetadata', onLoaded);
        videoElem.addEventListener('error', onError);
      }),
      timeoutMs
    );

    if (result.status === 'error') throw result.error;
    if (result.status === 'timeout') throw new Error(`비디오 로드 시간 초과: ${name}`);
  };

  const startPlayback = async (timeoutMs: number): Promise<boolean> => {
    let playPromise: Promise<void>;
    try {
      playPromise = videoElem.play();
    } catch (err) {
      console.warn('[VideoStitcher] play() 즉시 실패:', err);
      return false;
    }
    const result = await raceWithTimeout(playPromise, timeoutMs);
    if (result.status === 'ok') return true;
    if (result.status === 'error') {
      console.warn('[VideoStitcher] play() 실패:', result.error);
    }
    return false;
  };

  const waitForPlaybackAdvance = (fromTime: number, timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (advanced: boolean) => {
        if (settled) return;
        settled = true;
        videoElem.removeEventListener('timeupdate', check);
        if (timer) clearTimeout(timer);
        resolve(advanced);
      };
      const check = () => {
        if (videoElem.currentTime > fromTime + 0.02) finish(true);
      };
      const timer = setTimeout(
        () => finish(videoElem.currentTime > fromTime + 0.02),
        timeoutMs
      );
      videoElem.addEventListener('timeupdate', check);
    });

  // 인트로/아웃트로 사용자 동영상 클립 합성 렌더링
  const renderCustomVideoClip = async (clipFile: File, label: string): Promise<number> => {
    onProgress?.(label === '시작 인트로' ? 1 : 98, `${label} 영상 로드 및 합성 중...`);
    const blobUrl = URL.createObjectURL(clipFile);
    try {
      await loadVideoSource(blobUrl, label, 12000);
      const clipDuration = videoElem.duration && Number.isFinite(videoElem.duration) ? videoElem.duration : 0;

      await seekVideo(0, 2000);
      drawCoverFrame();

      const playing = await startPlayback(IS_IOS ? 2500 : 5000);
      if (!playing) {
        onLog?.(`${label} 영상을 재생할 수 없어 건너뜁니다.`);
        return 0;
      }

      await startOrResumeRecorder();

      await new Promise<void>((resolve) => {
        const startedAt = performance.now();
        const maxRealDurationMs = Math.max(3000, (clipDuration + 1.5) * 1000);
        let intervalId: number | null = null;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (intervalId !== null) window.clearInterval(intervalId);
          try {
            videoElem.pause();
          } catch {
            // ignore
          }
          resolve();
        };
        const tick = () => {
          if (videoElem.ended || videoElem.paused || performance.now() - startedAt >= maxRealDurationMs) {
            finish();
            return;
          }
          drawCoverFrame();
        };
        videoElem.addEventListener('ended', finish, { once: true });
        intervalId = window.setInterval(tick, 1000 / 30);
        tick();
      });

      await pauseRecorder();
      return clipDuration;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  // 인트로 시퀀스 렌더링 (약 1.6초)
  const renderIntroSequence = async (): Promise<number> => {
    if (!overlayOptions?.showIntro) return 0;
    onProgress?.(1, '시작 인트로 타이틀 시퀀스 생성 중...');

    const introFrames = 48; // 30fps 기준 약 1.6초
    await startOrResumeRecorder();

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
      grad.addColorStop(0, `rgba(49, 130, 246, ${0.28 * alpha})`);
      grad.addColorStop(1, 'rgba(8, 12, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      const title = overlayOptions.titleText || 'Highlights';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 12;
      ctx.fillText(title, targetWidth / 2, targetHeight / 2 - 20);

      const sub = [overlayOptions.subtitleDateText, overlayOptions.subtitleLocationText, overlayOptions.channelText].filter(Boolean).join(' • ');
      if (sub) {
        ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText(sub, targetWidth / 2, targetHeight / 2 + 30);
      }

      ctx.restore();
      await sleep(33);
    }

    await pauseRecorder();
    return introFrames / 30;
  };

  // 아웃트로 시퀀스 렌더링 (약 1.8초)
  const renderOutroSequence = async (): Promise<number> => {
    if (!overlayOptions?.showOutro) return 0;
    onProgress?.(98, 'Generating outro end card...');

    const outroFrames = 54; // 약 1.8초
    await startOrResumeRecorder();

    for (let f = 0; f < outroFrames; f++) {
      if (signal?.aborted) throw new Error('Cancelled');

      const progress = f / outroFrames;
      const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.85 ? (1 - progress) / 0.15 : 1.0;

      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const outroMessage = overlayOptions.outroText || 'Thank you for watching';
      ctx.fillText(outroMessage, targetWidth / 2, targetHeight / 2 - 16);

      if (overlayOptions.channelText) {
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#3182f6';
        ctx.fillText(overlayOptions.channelText, targetWidth / 2, targetHeight / 2 + 28);
      }

      ctx.restore();
      await sleep(33);
    }

    await pauseRecorder();
    return outroFrames / 30;
  };

  // 실시간 재생 기반 렌더링. 재생이 시작되지 않거나 시간이 흐르지 않으면 false를 반환해
  // 시크(seek) 기반 프레임 스텝 렌더링으로 자동 폴백한다.
  const renderSegmentWithPlayback = async (
    videoItem: VideoItem,
    segment: HighlightSegment,
    clipMessage: string
  ): Promise<boolean> => {
    await seekVideo(segment.start, 2000);
    drawCoverFrame(videoItem, segment);
    drawOverlays(segment);

    const playing = await startPlayback(IS_IOS ? 3000 : 6000);
    if (!playing) {
      try {
        videoElem.pause();
      } catch {
        // ignore
      }
      return false;
    }

    const advanced = await waitForPlaybackAdvance(segment.start, IS_IOS ? 1500 : 2000);
    if (!advanced) {
      try {
        videoElem.pause();
      } catch {
        // ignore
      }
      return false;
    }

    // waitForPlaybackAdvance 검증으로 인해 영상이 앞서 나간 경우
    // 정확히 segment.start 위치로 재정렬하여 앞부분 손실 및 겹침 방지
    if (videoElem.currentTime > segment.start + 0.04) {
      try {
        videoElem.pause();
      } catch {
        // ignore
      }
      await seekVideo(segment.start, 1200);
      drawCoverFrame(videoItem, segment);
      drawOverlays(segment);
      await startPlayback(2000);
    }

    await startOrResumeRecorder();

    await new Promise<void>((resolve, reject) => {
      const startedAt = performance.now();
      const maxRealDurationMs = (segment.duration + 1.5) * 1000;
      let intervalId: number | null = null;
      let settled = false;

      const finish = async (error?: Error) => {
        if (settled) return;
        settled = true;
        if (intervalId !== null) window.clearInterval(intervalId);
        try {
          videoElem.pause();
        } catch {
          // ignore
        }
        await pauseRecorder();
        if (error) reject(error);
        else resolve();
      };

      const tick = () => {
        if (settled) return;

        if (signal?.aborted) {
          void finish(new Error('작업 취소'));
          return;
        }
        if (recorderError) {
          void finish(recorderError);
          return;
        }

        drawCoverFrame(videoItem, segment);
        drawOverlays(segment);

        const clipElapsed = Math.max(0, Math.min(segment.duration, videoElem.currentTime - segment.start));
        reportProgress(
          ((recordedDurationSoFar + clipElapsed) / (totalSegmentsDuration || 1)) * 100,
          clipMessage
        );

        if (
          videoElem.currentTime >= segment.end - 0.04 ||
          videoElem.ended ||
          performance.now() - startedAt >= maxRealDurationMs
        ) {
          void finish();
        }
      };

      intervalId = window.setInterval(tick, 1000 / 30);
      tick();
    });

    return true;
  };

  // 시크 기반 프레임 스텝 렌더링 (모바일에서 동영상 실시간 재생이 막힐 때의 폴백).
  // 분석 단계의 프레임 추출과 동일한 방식이라 iOS Safari에서도 확실하게 동작한다.
  const renderSegmentByStepping = async (
    videoItem: VideoItem,
    segment: HighlightSegment,
    clipMessage: string
  ) => {
    try {
      videoElem.pause();
    } catch {
      // ignore
    }

    await startOrResumeRecorder();

    const fps = 30;
    const frameCount = Math.max(2, Math.ceil(segment.duration * fps));
    const frameInterval = 1000 / fps;

    for (let frame = 0; frame < frameCount; frame++) {
      if (signal?.aborted) throw new Error('작업 취소');
      if (recorderError) throw recorderError;
      if (!videoElem.paused) {
        try {
          videoElem.pause();
        } catch {
          // ignore
        }
      }

      const time = Math.min(
        segment.start + frame / fps,
        Math.max(segment.start, segment.end - 0.05)
      );
      await seekVideo(time, 1200);

      const frameStartedAt = performance.now();
      drawCoverFrame(videoItem, segment);
      drawOverlays(segment);
      reportProgress(
        ((recordedDurationSoFar + Math.min(segment.duration, frame / fps)) /
          (totalSegmentsDuration || 1)) *
          100,
        clipMessage
      );

      const elapsed = performance.now() - frameStartedAt;
      if (elapsed < frameInterval) {
        await sleep(frameInterval - elapsed);
      }
    }

    await pauseRecorder();
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

    // 구간별 비디오 순차 병합
    for (let i = 0; i < allSegments.length; i++) {
      if (signal?.aborted) {
        throw new Error('사용자에 의해 작업이 취소되었습니다.');
      }
      if (recorderError) throw recorderError;

      const segment = allSegments[i];
      const videoItem = videoMap.get(segment.sourceVideoId);
      if (!videoItem) continue;

      const clipMessage = `구간 ${i + 1}/${allSegments.length} 병합 중: [${videoItem.name}] (${segment.start.toFixed(1)}s ~ ${segment.end.toFixed(1)}s)`;
      reportProgress(
        (recordedDurationSoFar / (totalSegmentsDuration || 1)) * 100,
        clipMessage,
        true
      );

      await loadVideoSource(videoItem.url, videoItem.name);

      const played = await renderSegmentWithPlayback(videoItem, segment, clipMessage);
      if (!played) {
        onLog?.(
          `[${videoItem.name}] 실시간 재생이 지연되어 프레임 스텝 모드로 구간 ${i + 1}을 병합합니다.`
        );
        await renderSegmentByStepping(videoItem, segment, clipMessage);
      }

      recordedDurationSoFar += segment.duration;
    }

    // 마무리 아웃트로 렌더링 (옵션 활성화 시: 영상 파일 우선, 없으면 엔딩 시퀀스)
    if (overlayOptions?.showOutro) {
      if (overlayOptions.outroVideoFile) {
        actualOutroDuration = await renderCustomVideoClip(overlayOptions.outroVideoFile, '종료 아웃트로');
      } else {
        actualOutroDuration = await renderOutroSequence();
      }
    }

    onProgress?.(99, '16:9 고화질 하이라이트 영상 파일 생성 중...');

    if (!recorderStarted) {
      throw new Error('녹화된 영상 구간이 없습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.');
    }

    // 레코더 중지 및 Blob 완성 대기 (onstop이 오지 않는 모바일 브라우저 방어)
    const finalMimeType = recorder.mimeType || mimeType || 'video/webm';
    const finalBlob = await new Promise<Blob>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(new Blob(chunks, { type: finalMimeType }));
      };
      recorder.onstop = finish;
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          finish();
        }
      } catch {
        finish();
      }
      setTimeout(finish, 6000);
    });

    if (finalBlob.size === 0) {
      throw new Error(
        `브라우저가 영상 프레임을 캡처하지 못했습니다. (${finalMimeType}) 최신 Safari/Chrome에서 다시 시도해 주세요.`
      );
    }

    const finalUrl = URL.createObjectURL(finalBlob);
    const originalTotalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
    const totalCalculatedDuration = actualIntroDuration + totalSegmentsDuration + actualOutroDuration;

    onLog?.(`병합 완료: ${(finalBlob.size / (1024 * 1024)).toFixed(1)}MB · ${finalMimeType || 'video/webm'}`);
    onProgress?.(100, '극적 하이라이트 영상이 완성되었습니다!');

    return {
      blob: finalBlob,
      url: finalUrl,
      duration: Math.round(totalCalculatedDuration * 10) / 10,
      introDuration: Math.round(actualIntroDuration * 10) / 10,
      outroDuration: Math.round(actualOutroDuration * 10) / 10,
      segments: allSegments,
      originalTotalDuration: Math.round(originalTotalDuration * 10) / 10,
      fileSize: finalBlob.size,
    };
  } finally {
    try {
      if (bgmController) {
        bgmController.stop();
      }
      try {
        videoElem.pause();
      } catch {
        // ignore
      }
      videoElem.removeAttribute('src');
      try {
        videoElem.load();
      } catch {
        // ignore
      }
      // 공용 AudioContext는 재병합에서 재사용하므로 닫지 않고 잠시 중지만 한다.
      if (audioCtx && audioCtx.state === 'running') {
        void audioCtx.suspend().catch(() => {});
      }
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      stage.remove();
    } catch {
      // ignore cleanup errors
    }
  }
}
