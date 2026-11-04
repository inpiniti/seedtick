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

function createMediaRecorder(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      '이 브라우저는 영상 녹화(MediaRecorder)를 지원하지 않습니다. 최신 Safari 또는 Chrome에서 다시 시도해 주세요.'
    );
  }

  const hasAudio = stream.getAudioTracks().length > 0;
  const videoBitsPerSecond = IS_IOS ? 1_500_000 : 2_800_000;
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
function mountHiddenStage(canvas: HTMLCanvasElement, video: HTMLVideoElement): HTMLDivElement {
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = [
    'position:fixed',
    'left:0',
    'bottom:0',
    'width:80px',
    'height:45px',
    'opacity:0.08',
    'pointer-events:none',
    'overflow:hidden',
    'z-index:1',
  ].join(';');
  for (const el of [canvas, video]) {
    el.style.width = '80px';
    el.style.height = '45px';
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

  // 워커 비디오 엘리먼트 준비 (모바일 자동재생 정책 방어 & Canvas Tainting 방지)
  const videoElem = document.createElement('video');
  videoElem.muted = true;
  videoElem.defaultMuted = true;
  videoElem.volume = 0;
  videoElem.playsInline = true;
  videoElem.preload = 'auto';
  videoElem.crossOrigin = 'anonymous';
  videoElem.setAttribute('crossorigin', 'anonymous');
  videoElem.setAttribute('playsinline', '');
  videoElem.setAttribute('webkit-playsinline', '');
  videoElem.setAttribute('muted', '');

  const stage = mountHiddenStage(canvas, videoElem);

  // BGM 또는 커스텀 오디오 파일이 실제로 존재하는지 여부 확인
  const hasAudioSource = Boolean(
    customAudioFile || (bgmPresetId && bgmPresetId !== 'none')
  );

  // 오디오 컨텍스트 및 목적지 스트림 생성 (오디오가 있을 때만 활성화하여 iOS 0바이트 먹싱 블로킹 방어)
  const audioCtx = hasAudioSource ? getSharedAudioContext() : null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  if (audioCtx) {
    try {
      audioDest = audioCtx.createMediaStreamDestination();
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

  // 30fps 비디오 스트림 캡처
  const canvasStream = canvas.captureStream(30);
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

  const totalSegmentsDuration = allSegments.reduce((sum, s) => sum + s.duration, 0);
  let recordedDurationSoFar = 0;

  let recorderStarted = false;
  let bgmController: { stop: () => void } | null = null;
  const wakeLockRef: { current: WakeLockSentinel | null } = { current: null };

  // 캔버스 상시 30fps 하트비트 루프 (WebKit Frame Starvation 및 트랙 침묵 방어)
  // 녹화가 활성 상태(recording)일 때만 캔버스 하트비트를 발생시켜, 세그먼트 전환 및 대기 중 불필요한 프레임 캡처 방지
  let isStitchingActive = true;
  const heartbeatTimer = window.setInterval(() => {
    if (!isStitchingActive) return;
    if (recorder.state !== 'recording') return;
    if (ctx) {
      // 캔버스 모서리에 육안으로 구분 불가능한 극미세 픽셀 갱신(alpha 0.005)을 주어 WebKit 렌더러가 새 프레임 방출을 트리거
      ctx.fillStyle = 'rgba(8, 12, 20, 0.005)';
      ctx.fillRect(0, 0, 1, 1);
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

  // 세그먼트별 오버레이 오프스크린 캔버스 생성 (세그먼트당 1회만 그려서 캐싱)
  // 매 프레임마다 font/measureText/shadowBlur를 반복 계산하지 않고 ctx.drawImage로 0.05ms 안에 합성
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

    // 1. 좌측 상단 영상 제목
    if (hasTitle) {
      hasAnyOverlay = true;
      oCtx.save();
      oCtx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      const text = overlayOptions.titleText;
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

    // 1-1. 좌측 상단 문구 아래: 흰색 글씨로 날짜 및 위치 표시
    const datePart = currentSegment?.subtitleDate || overlayOptions.subtitleDateText || '';
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

    // 2. 우측 상단 채널 이름
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

    // 3. 하단 중앙 씬 제목 자막
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

  // 비디오 프레임과 캐시된 오버레이를 캔버스에 합성
  const renderFrameWithOverlay = (
    videoItem: VideoItem,
    segment: HighlightSegment,
    overlayCanvas: HTMLCanvasElement | null
  ) => {
    totalDrawCalls++;
    drawCoverFrame(videoItem, segment);
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0);
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

  const seekVideo = (time: number, timeoutMs = 8000) =>
    new Promise<boolean>((resolve) => {
      if (Math.abs(videoElem.currentTime - time) < 0.02 && videoElem.readyState >= 2) {
        resolve(true);
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        videoElem.removeEventListener('seeked', onSeeked);
        videoElem.removeEventListener('error', onError);
        if (timer) clearTimeout(timer);
        resolve(ok);
      };
      const onSeeked = () => finish(true);
      const onError = () => finish(false);
      timer = setTimeout(() => finish(Math.abs(videoElem.currentTime - time) < 0.3), timeoutMs);
      videoElem.addEventListener('seeked', onSeeked);
      videoElem.addEventListener('error', onError);
      try {
        videoElem.currentTime = time;
      } catch {
        finish(false);
      }
    });

  // 비디오가 지정 시점으로 seek된 후 실제 재생 가능한 버퍼(readyState >= 3)를 확보할 때까지 대기
  const waitForVideoReady = (timeoutMs = 6000): Promise<boolean> => {
    if (videoElem.readyState >= 3) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        videoElem.removeEventListener('canplay', onReady);
        videoElem.removeEventListener('canplaythrough', onReady);
        videoElem.removeEventListener('playing', onReady);
        if (timer) clearTimeout(timer);
        resolve(ok);
      };
      const onReady = () => finish(true);
      timer = setTimeout(() => finish(videoElem.readyState >= 2), timeoutMs);
      videoElem.addEventListener('canplay', onReady);
      videoElem.addEventListener('canplaythrough', onReady);
      videoElem.addEventListener('playing', onReady);
    });
  };

  const loadVideoSource = async (url: string, name: string, timeoutMs = 10000) => {
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
      let checkTimer: number | null = null;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (advanced: boolean) => {
        if (settled) return;
        settled = true;
        videoElem.removeEventListener('timeupdate', check);
        if (checkTimer !== null) window.clearInterval(checkTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        resolve(advanced);
      };

      const check = () => {
        if (videoElem.currentTime > fromTime + 0.02) finish(true);
      };

      timeoutTimer = setTimeout(
        () => finish(videoElem.currentTime > fromTime + 0.02),
        timeoutMs
      );
      videoElem.addEventListener('timeupdate', check);
      checkTimer = window.setInterval(check, 50);
    });

  // 인트로/아웃트로 사용자 동영상 클립 합성 렌더링
  const renderCustomVideoClip = async (clipFile: File, label: string): Promise<number> => {
    onProgress?.(label === '시작 인트로' ? 1 : 98, `${label} 영상 로드 및 합성 중...`);
    const blobUrl = URL.createObjectURL(clipFile);
    try {
      await loadVideoSource(blobUrl, label, 12000);
      const clipDuration = videoElem.duration && Number.isFinite(videoElem.duration) ? videoElem.duration : 0;

      await seekVideo(0, 6000);
      await waitForVideoReady(6000);
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

      if (label !== '종료 아웃트로') {
        await pauseRecorder();
      }
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
    onProgress?.(98, '종료 아웃트로 엔드 카드 생성 중...');

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

    // 아웃트로 직후 finalBlob 생성으로 이어지므로 pause하지 않고 recording 상태 유지
    return outroFrames / 30;
  };

  // 실시간 재생 기반 렌더링. 비디오 버퍼링을 충분히 대기하고 실제 재생 시작 순간에 녹화를 개시하여 끊김 방지.
  const renderSegmentWithPlayback = async (
    videoItem: VideoItem,
    segment: HighlightSegment,
    clipMessage: string,
    isLastSegment = false
  ): Promise<boolean> => {
    try {
      videoElem.pause();
    } catch {
      // ignore
    }

    // 1. 세그먼트별 오버레이 캔버스 사전 생성 (세그먼트당 1회만 계산하여 30fps 루프 비용을 0.05ms로 극소화)
    const overlayCanvas = createSegmentOverlayCanvas(segment);

    // 2. 목표 시작 시점으로 seek 및 비디오 디코더 버퍼 확보 대기
    const seekOk = await seekVideo(segment.start, 10000);
    if (!seekOk) {
      console.warn(`[VideoStitcher] 구간 시작 시점(${segment.start}s) seek 지연`);
    }
    await waitForVideoReady(8000);

    renderFrameWithOverlay(videoItem, segment, overlayCanvas);

    // seek 완료 후 실제 비디오 현재 시점 기록 (playback 전진 감지 기준점)
    const initialTime = videoElem.currentTime;

    // 3. 비디오 재생 시작
    const playing = await startPlayback(8000);
    if (!playing) {
      renderModeHistory.push(`[seg#${segment.id.slice(-4)}: play실패 (readyState=${videoElem.readyState})]`);
      try {
        videoElem.pause();
      } catch {
        // ignore
      }
      return false;
    }

    // 4. 비디오가 실제로 재생되어 시간을 전진시키는지 확인 (최대 8초 대기)
    const advanced = await waitForPlaybackAdvance(initialTime, 8000);
    if (!advanced) {
      renderModeHistory.push(`[seg#${segment.id.slice(-4)}: 시간전진실패 (cur=${videoElem.currentTime.toFixed(2)})]`);
      try {
        videoElem.pause();
      } catch {
        // ignore
      }
      return false;
    }

    renderModeHistory.push(`[seg#${segment.id.slice(-4)}: playback정상]`);

    // 비디오가 실제로 정상 전진 중이므로 이 시점에 정확히 레코더를 시작/재개!
    await startOrResumeRecorder();

    // 5. 비디오 재생과 캔버스 녹화 실시간 동기화 루프
    await new Promise<void>((resolve, reject) => {
      const startedAt = performance.now();
      // 네트워크 지연/버퍼링을 감안하여 최대 허용 시간 넉넉하게 설정
      const maxRealDurationMs = Math.max(5000, (segment.duration * 2.5 + 5) * 1000);
      let settled = false;
      let cleanupLoop: (() => void) | null = null;

      const finish = async (error?: Error) => {
        if (settled) return;
        settled = true;
        if (cleanupLoop) {
          cleanupLoop();
        }
        try {
          videoElem.pause();
        } catch {
          // ignore
        }
        // 마지막 세그먼트가 아니라면 다음 구간 전환(seek/load) 동안 녹화를 일시정지하여 멈춤 구간 녹화 방지
        // 마지막 세그먼트라면 paused 상태에서 stop() 호출 시 발생하는 WebKit 버그(0바이트)를 방지하기 위해 recording 상태 유지
        if (!isLastSegment) {
          await pauseRecorder();
        }
        if (error) reject(error);
        else resolve();
      };

      const onFrame = () => {
        if (settled) return;

        if (signal?.aborted) {
          void finish(new Error('작업 취소'));
          return;
        }
        if (recorderError) {
          void finish(recorderError);
          return;
        }

        // 비디오가 실제로 재생 중일 때만 캔버스 프레임 갱신 (캐시된 오버레이를 0.05ms로 초고속 블릿)
        if (!videoElem.paused && !videoElem.seeking) {
          renderFrameWithOverlay(videoItem, segment, overlayCanvas);
        }

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

      // 데스크톱 Chrome 등에서는 requestVideoFrameCallback으로 디코더 프레임과 100% 동기화
      // iOS Safari는 16px 히든 비디오의 rVFC 콜백이 스로틀되므로 안정적인 30fps 고정 타이머 사용
      const vProto = HTMLVideoElement.prototype as unknown as {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      const vElemAny = videoElem as unknown as {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };

      if (!IS_IOS && !IS_SAFARI && typeof vProto.requestVideoFrameCallback === 'function' && typeof vElemAny.requestVideoFrameCallback === 'function') {
        let rvfcHandle: number | null = null;
        let isRunning = true;

        const rvfcLoop = () => {
          if (!isRunning || settled) return;
          onFrame();
          if (isRunning && !settled && vElemAny.requestVideoFrameCallback) {
            rvfcHandle = vElemAny.requestVideoFrameCallback(rvfcLoop);
          }
        };

        rvfcHandle = vElemAny.requestVideoFrameCallback(rvfcLoop);

        // 보조 30fps 백업 타이머 (디코더 콜백 일시 지연 방어)
        const fallbackInterval = window.setInterval(() => {
          if (!settled) onFrame();
        }, 1000 / 30);

        cleanupLoop = () => {
          isRunning = false;
          if (rvfcHandle !== null && vElemAny.cancelVideoFrameCallback) {
            vElemAny.cancelVideoFrameCallback(rvfcHandle);
          }
          window.clearInterval(fallbackInterval);
        };
      } else {
        const intervalId = window.setInterval(onFrame, 1000 / 30);
        cleanupLoop = () => window.clearInterval(intervalId);
      }

      onFrame();
    });

    return true;
  };

  // 시크 기반 프레임 스텝 렌더링 (모바일 등에서 실시간 재생이 완전히 막힐 때의 최후 폴백)
  // seek 대기 시간 중에는 recorder를 pause 처리하여 결과물 영상이 늘어지거나 멈추지 않도록 방어
  const renderSegmentByStepping = async (
    videoItem: VideoItem,
    segment: HighlightSegment,
    clipMessage: string,
    isLastSegment = false
  ) => {
    try {
      videoElem.pause();
    } catch {
      // ignore
    }

    const overlayCanvas = createSegmentOverlayCanvas(segment);
    const fps = 30;
    const frameCount = Math.max(2, Math.ceil(segment.duration * fps));
    const frameInterval = 1000 / fps;
    renderModeHistory.push(`[seg#${segment.id.slice(-4)}: stepping (${frameCount}f)]`);

    for (let frame = 0; frame < frameCount; frame++) {
      if (signal?.aborted) throw new Error('작업 취소');
      if (recorderError) throw recorderError;

      const time = Math.min(
        segment.start + frame / fps,
        Math.max(segment.start, segment.end - 0.05)
      );

      // 탐색(seek) 중에는 레코더를 정지하여 seek 대기 시간이 영상 길이에 포함되지 않도록 방어
      await pauseRecorder();
      await seekVideo(time, 2500);

      renderFrameWithOverlay(videoItem, segment, overlayCanvas);

      // 프레임이 준비된 후 레코더를 켜고 frameInterval 동안 녹화
      await startOrResumeRecorder();
      await sleep(frameInterval);

      reportProgress(
        ((recordedDurationSoFar + Math.min(segment.duration, frame / fps)) /
          (totalSegmentsDuration || 1)) *
          100,
        clipMessage
      );
    }

    if (!isLastSegment) {
      await pauseRecorder();
    }
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

      const isLastSegment = i === allSegments.length - 1 && !overlayOptions?.showOutro;
      const clipMessage = `구간 ${i + 1}/${allSegments.length} 병합 중: [${videoItem.name}] (${segment.start.toFixed(1)}s ~ ${segment.end.toFixed(1)}s)`;
      reportProgress(
        (recordedDurationSoFar / (totalSegmentsDuration || 1)) * 100,
        clipMessage,
        true
      );

      await loadVideoSource(videoItem.url, videoItem.name);

      let played = await renderSegmentWithPlayback(videoItem, segment, clipMessage, isLastSegment);
      if (!played) {
        // 1회차 실패 시 버퍼링을 확보하고 1회 재시도 (videoElem.load() 호출 시 iOS 재생 권한이 초기화되므로 load() 없이 재시도)
        onLog?.(`[${videoItem.name}] 구간 ${i + 1} 비디오 버퍼링 대기 후 재생 재시도 중...`);
        await sleep(600);
        played = await renderSegmentWithPlayback(videoItem, segment, clipMessage, isLastSegment);
      }

      if (!played) {
        onLog?.(
          `[${videoItem.name}] 실시간 재생이 지연되어 프레임 스텝 모드로 구간 ${i + 1}을 병합합니다.`
        );
        await renderSegmentByStepping(videoItem, segment, clipMessage, isLastSegment);
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
        `[5] 소스비디오: ${videoElem.videoWidth}x${videoElem.videoHeight}, ready=${videoElem.readyState}, cur=${videoElem.currentTime.toFixed(2)}s, paused=${videoElem.paused}${videoElem.error ? `, err=${videoElem.error.message}` : ''}`,
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
      isStitchingActive = false;
      window.clearInterval(heartbeatTimer);
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
