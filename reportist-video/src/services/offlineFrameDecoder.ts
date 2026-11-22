// services/offlineFrameDecoder.ts - 데스크톱 전용 오프라인 프레임 디코더
//
// <video>.play() 실시간 1배속 캡처 대신 WebCodecs VideoDecoder로 MP4/MOV samples를
// 직접 디코딩해 프레임을 확정적으로 공급한다. 1프레임 합성이 5ms든 100ms든
// 타임스탬프 기준으로 모든 프레임을 빠짐없이 처리하므로 실시간 재생에서 발생하던
// 프레임 드랍 / 동일 프레임 중복 인코딩(슬라이드쇼 현상)이 원천적으로 사라진다.
//
// 모바일에서는 사용하지 않는다 (AGENTS.md 옵션 1). 파싱/코덱/디코딩이 실패하면
// null을 반환하거나 예외를 던져 호출부가 기존 <video> 경로로 자동 폴백하도록 한다.

import { parseMp4VideoTrack, type ParsedVideoTrack } from './mp4KeyframeDecoder.ts';

export interface OfflineFrameSourceOptions {
  signal?: AbortSignal;
  maxDecodeQueue?: number;
  maxOutputQueue?: number;
}

/** tkhd 회전이 적용된(즉 <video>가 내놓는 것과 동일한 방향) 재사용 캔버스 */
export interface OfflineDecodedFrame {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** movie 타임라인 기준 이 프레임이 커버하는 요청 시각(초) */
  timeSec: number;
}

export interface OfflineFrameSource {
  /** targetTimeSec 시점에 화면에 보여야 할 프레임을 반환. 소스 고갈 시 null. */
  next(targetTimeSec: number): Promise<OfflineDecodedFrame | null>;
  close(): void;
}

const isVideoDecoderUsable = (): boolean =>
  typeof VideoDecoder === 'function' &&
  typeof VideoFrame === 'function' &&
  typeof EncodedVideoChunk === 'function';

export function isOfflineFrameDecoderAvailable(): boolean {
  return isVideoDecoderUsable();
}

/**
 * hvcC(avcC가 아닌 HEVC) 박스에서 전체 코덱 문자열을 만들어 isConfigSupported 성공률을 높인다.
 * 실패 시 짧은 코덱 문자열도 후보에 남겨 폴백 경로를 확보한다.
 */
function buildCodecCandidates(codec: string, description?: Uint8Array): string[] {
  if ((codec === 'hvc1' || codec === 'hev1') && description && description.length >= 13) {
    const profileByte = description[1];
    const profileSpace = (profileByte >> 6) & 0x3;
    const tierFlag = (profileByte >> 5) & 0x1;
    const profileIdc = profileByte & 0x1f;
    const levelIdc = description[12];

    let compat = 0;
    for (let i = 2; i < 6; i++) compat = (compat * 256 + description[i]) >>> 0;
    const compatHex = compat.toString(16).toUpperCase().replace(/0+$/, '') || '0';
    const spacePrefix = profileSpace === 0 ? '' : String.fromCharCode(64 + profileSpace);
    const full = `${codec}.${spacePrefix}${profileIdc}.${compatHex}.${tierFlag ? 'H' : 'L'}${levelIdc}`;
    return [full, codec];
  }
  return [codec];
}

class OfflineFrameSourceImpl implements OfflineFrameSource {
  private readonly decoder: VideoDecoder;
  private readonly displayCanvas: HTMLCanvasElement;
  private readonly displayCtx: CanvasRenderingContext2D;
  private readonly displayWidth: number;
  private readonly displayHeight: number;

  private outputFrames: Array<{ frame: VideoFrame; timeSec: number }> = [];
  private currentFrame: VideoFrame | null = null;
  private waiters: Array<() => void> = [];
  private pumpPromise: Promise<void> | null = null;
  private feedDone = false;
  private error: unknown = null;
  private closed = false;

  constructor(
    private readonly blob: Blob,
    private readonly track: ParsedVideoTrack,
    private readonly startIdx: number,
    private readonly endIdx: number,
    config: VideoDecoderConfig,
    private readonly options: OfflineFrameSourceOptions
  ) {
    const sideways = track.rotation === 90 || track.rotation === 270;
    this.displayWidth = sideways ? track.codedHeight : track.codedWidth;
    this.displayHeight = sideways ? track.codedWidth : track.codedHeight;

    this.displayCanvas = document.createElement('canvas');
    this.displayCanvas.width = this.displayWidth;
    this.displayCanvas.height = this.displayHeight;
    const ctx = this.displayCanvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('오프라인 디코더용 캔버스 컨텍스트를 만들 수 없습니다.');
    this.displayCtx = ctx;
    this.displayCtx.imageSmoothingEnabled = true;
    this.displayCtx.imageSmoothingQuality = 'high';

    this.decoder = new VideoDecoder({
      output: (frame) => {
        if (this.closed) {
          try { frame.close(); } catch {}
          return;
        }
        // 디코더 타임스탬프는 미디어 시간 → edit list 오프셋을 빼 movie 시간으로 변환
        const timeSec = frame.timestamp / 1_000_000 - this.track.presentationOffsetSec;
        this.outputFrames.push({ frame, timeSec });
        this.notify();
      },
      error: (e) => {
        this.error = e;
        this.notify();
      },
    });
    this.decoder.configure(config);
  }

  private notify(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
  }

  /** 출력·디큐 이벤트 또는 짧은 안전 타임아웃까지 대기 (데드락 방지) */
  private waitForChange(): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.waiters = this.waiters.filter((w) => w !== finish);
        resolve();
      };
      this.waiters.push(finish);
      const timer = setTimeout(finish, 200);
    });
  }

  /** 청크를 decode order로 밀어 넣는 백그라운드 펌프 */
  private async pump(): Promise<void> {
    const maxDecodeQueue = this.options.maxDecodeQueue ?? 6;
    const maxOutputQueue = this.options.maxOutputQueue ?? 4;
    const samples = this.track.samples;

    try {
      for (let i = this.startIdx; i <= this.endIdx; i++) {
        if (this.closed) return;
        if (this.options.signal?.aborted) throw new Error('작업 취소');

        const sample = samples[i];
        const data = await this.blob.slice(sample.offset, sample.offset + sample.size).arrayBuffer();
        if (this.closed) return;

        while (!this.closed && this.decoder.decodeQueueSize >= maxDecodeQueue) {
          await this.waitForChange();
        }
        if (this.closed) return;

        const nextSample = samples[i + 1];
        const duration = nextSample
          ? Math.max(1, Math.round((nextSample.ctsSec - sample.ctsSec) * 1_000_000))
          : undefined;

        this.decoder.decode(
          new EncodedVideoChunk({
            type: sample.isKey ? 'key' : 'delta',
            timestamp: Math.max(0, Math.round(sample.ctsSec * 1_000_000)),
            duration,
            data,
          })
        );

        // 출력 큐가 차면 소비자(next())가 프레임을 그릴 때까지 대기 → 메모리 상한 유지
        while (!this.closed && this.outputFrames.length >= maxOutputQueue) {
          await this.waitForChange();
        }
      }
      if (!this.closed) await this.decoder.flush();
      this.feedDone = true;
    } catch (err) {
      if (!this.closed) this.error = err;
      this.feedDone = true;
    } finally {
      this.notify();
    }
  }

  async next(targetTimeSec: number): Promise<OfflineDecodedFrame | null> {
    if (this.closed) return null;
    if (this.options.signal?.aborted) throw new Error('작업 취소');
    if (!this.pumpPromise) this.pumpPromise = this.pump();

    const target = Math.max(0, targetTimeSec);
    const tolerance = 0.0002;

    // 디코더 출력은 presentation order(타임스탬프 단조 증가)로 들어온다.
    // target 시각을 커버하는 프레임 = target 이하의 마지막 프레임.
    // 단, 구간 시작이 B-frame 리오더로 첫 프레임보다 앞서면 현재 프레임이 없으므로
    // 이때는 가장 이른 프레임을 무조건 커버 프레임으로 삼는다.
    for (let guard = 0; guard < 200_000; guard++) {
      while (this.outputFrames.length > 0) {
        const head = this.outputFrames[0];
        if (this.currentFrame && head.timeSec > target + tolerance) break;
        const item = this.outputFrames.shift()!;
        if (this.currentFrame) {
          try { this.currentFrame.close(); } catch {}
        }
        this.currentFrame = item.frame;
        this.notify(); // 펌프의 출력 큐 대기 해제
      }

      if (this.feedDone || this.error) break;

      const head = this.outputFrames[0];
      if (this.currentFrame && (!head || head.timeSec > target + tolerance)) break;

      await this.waitForChange();
    }

    if (this.error) throw this.error;
    if (!this.currentFrame) {
      throw new Error('오프라인 디코더가 요청 구간의 프레임을 생성하지 못했습니다.');
    }

    this.drawCurrentFrame();
    return {
      canvas: this.displayCanvas,
      width: this.displayWidth,
      height: this.displayHeight,
      timeSec: target,
    };
  }

  private drawCurrentFrame(): void {
    const frame = this.currentFrame!;
    const ctx = this.displayCtx;
    ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);

    const vw = frame.displayWidth || frame.codedWidth;
    const vh = frame.displayHeight || frame.codedHeight;
    if (!vw || !vh) return;

    if (this.track.rotation === 0) {
      ctx.drawImage(frame, 0, 0, this.displayWidth, this.displayHeight);
    } else {
      ctx.save();
      ctx.translate(this.displayWidth / 2, this.displayHeight / 2);
      ctx.rotate((this.track.rotation * Math.PI) / 180);
      ctx.drawImage(frame, -vw / 2, -vh / 2, vw, vh);
      ctx.restore();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.decoder.close(); } catch {}
    if (this.currentFrame) {
      try { this.currentFrame.close(); } catch {}
      this.currentFrame = null;
    }
    for (const item of this.outputFrames) {
      try { item.frame.close(); } catch {}
    }
    this.outputFrames = [];
    this.displayCanvas.width = 1;
    this.displayCanvas.height = 1;
    this.notify();
  }
}

/**
 * [rangeStart, rangeEnd] 구간을 오프라인 디코딩할 수 있는 프레임 소스를 만든다.
 * MP4/MOV가 아니거나 코덱/파싱/설정이 지원되지 않으면 null → 호출부는 <video> 경로로 폴백.
 */
export async function createOfflineFrameSource(
  blob: Blob,
  rangeStart: number,
  rangeEnd: number,
  options: OfflineFrameSourceOptions = {}
): Promise<OfflineFrameSource | null> {
  if (!isVideoDecoderUsable()) return null;
  if (typeof document === 'undefined') return null;
  if (!blob || blob.size === 0) return null;
  if (options.signal?.aborted) throw new Error('작업 취소');

  let track: ParsedVideoTrack | null = null;
  try {
    track = await parseMp4VideoTrack(blob);
  } catch {
    return null;
  }
  if (
    !track ||
    track.samples.length === 0 ||
    track.codedWidth <= 0 ||
    track.codedHeight <= 0 ||
    track.durationSec <= 0
  ) {
    return null;
  }

  const samples = track.samples;
  const startLimit = Math.max(0, rangeStart);

  // decode order(dts) 기준으로 rangeStart 직전/직후 키프레임부터 공급 시작
  let startIdx = -1;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].isKey && samples[i].dtsSec <= startLimit + 0.0001) startIdx = i;
    if (samples[i].dtsSec > startLimit + 0.0001) break;
  }
  if (startIdx < 0) startIdx = 0;

  // B-frame 리오더와 꼬리 프레임을 커버하도록 rangeEnd 이후도 조금 더 디코딩
  const tailSec = 0.25;
  let endIdx = -1;
  for (let i = startIdx; i < samples.length; i++) {
    if (samples[i].dtsSec > Math.max(startLimit, rangeEnd) + tailSec) break;
    endIdx = i;
  }
  if (endIdx < startIdx) return null;

  let config: VideoDecoderConfig | null = null;
  for (const codec of buildCodecCandidates(track.codec, track.description)) {
    for (const hardwareAcceleration of ['prefer-hardware', 'prefer-software'] as const) {
      const candidate = {
        codec,
        codedWidth: track.codedWidth,
        codedHeight: track.codedHeight,
        description: track.description,
        hardwareAcceleration,
        optimizeForLatency: true,
      } as VideoDecoderConfig;
      try {
        const support = await VideoDecoder.isConfigSupported(candidate);
        if (support.supported) {
          config = candidate;
          break;
        }
      } catch {}
    }
    if (config) break;
  }
  if (!config) return null;

  return new OfflineFrameSourceImpl(blob, track, startIdx, endIdx, config, options);
}
