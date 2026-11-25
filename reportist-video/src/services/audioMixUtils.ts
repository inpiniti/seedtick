// services/audioMixUtils.ts
// 내보내기 오디오 믹싱 유틸.
// ① 스테레오 위상을 고정한 WSOLA 타임스트레치 (음높이 유지 + 어택/타격감 보존)
// ② 임계값 이하 비트 단위 무손실 Lookahead True-Peak 리미터
// ③ 원곡 템포 보존 BGM 길이 맞춤 (미세 신축 또는 크로스페이드 루프)

/** BGM 길이 맞춤 전략. */
export interface BgmFitPlan {
  /** stretch: ±15% 이내 미세 타임스트레치. loop: 원속도 재생 + 크로스페이드 루프. */
  mode: 'stretch' | 'loop';
  /** 원본 길이 / 목표 길이. loop 모드에서는 항상 1. */
  rate: number;
}

/** 원곡 그루브가 유지되는 미세 배속 허용 범위. */
export const BGM_FIT_TOLERANCE = 0.15;
/** 루프 이음새 equal-power 크로스페이드 길이(초). */
export const LOOP_CROSSFADE_SEC = 1.5;
/** 영상 마지막 자연스러운 페이드아웃 길이(초). */
export const END_FADE_SEC = 1.8;

/**
 * 길이 차이가 작을 때만 미세 배속으로 끝점을 맞추고, 차이가 크면 원속도를 유지한다.
 * 3분짜리 곡을 30초 하이라이트에 4배속으로 우겨 넣으면 BPM·그루브·타격감이 무너지므로
 * 이 경우에는 원곡을 그대로 재생하고 루프/페이드아웃으로 마감한다.
 */
export function resolveBgmFitPlan(sourceDuration: number, targetDuration: number): BgmFitPlan {
  if (
    !Number.isFinite(sourceDuration) || sourceDuration <= 0 ||
    !Number.isFinite(targetDuration) || targetDuration <= 0
  ) {
    return { mode: 'loop', rate: 1 };
  }
  const rawRate = sourceDuration / targetDuration;
  if (Math.abs(rawRate - 1) <= BGM_FIT_TOLERANCE) {
    return { mode: 'stretch', rate: Math.round(rawRate * 1000) / 1000 };
  }
  return { mode: 'loop', rate: 1 };
}

/**
 * 파형 유사도(WSOLA) 기반 음높이 유지 타임스트레치.
 *
 * 순수 OLA는 고정 간격으로 잘라 겹치기만 해서 겹치는 구간의 위상이 어긋나면
 * 역위상 대역이 상쇄되어 "소리가 빈 듯한" 콤 필터가 생기고, 드럼 어택이
 * 여러 번 겹치거나(flamming) 건너뛰어 타격감이 사라진다.
 * 여기서는 ±12ms 범위에서 정규화 상호상관이 가장 높은 지점을 찾아 겹치고,
 * 그 오프셋을 좌우 채널에 동일하게 적용해 스테레오 위상도 보존한다.
 *
 * @param rate 원본 길이 / 목표 길이. 0.5면 2배 느리게, 2면 2배 빠르게.
 */
export function timeStretchAudioBuffer(
  ctx: BaseAudioContext,
  input: AudioBuffer,
  rate: number
): AudioBuffer {
  if (!Number.isFinite(rate) || rate <= 0 || Math.abs(rate - 1) < 0.001) return input;

  const sourceFrames = input.length;
  // 너무 짧은 버퍼는 상관 탐색 자체가 의미가 없다.
  if (sourceFrames < 256) return input;

  const targetFrames = Math.max(1, Math.round(sourceFrames / rate));
  const channels = input.numberOfChannels;
  const sampleRate = input.sampleRate;

  // 25ms 창(48kHz 기준 1200 프레임): 어택 더블링을 줄이면서 위상 탐색 해상도 확보.
  let windowSize = Math.round(sampleRate * 0.025);
  if (windowSize % 2 === 1) windowSize += 1;
  windowSize = Math.max(128, Math.min(windowSize, sourceFrames - 32));
  if (windowSize % 2 === 1) windowSize -= 1;

  const hopOut = windowSize >> 1;
  // ±12ms 를 0.5ms 간격으로 탐색. 전 구간 전수 조사는 렌더링을 몇 분씩 지연시킨다.
  const searchRange = Math.min(Math.round(sampleRate * 0.012), Math.floor(sourceFrames / 8));
  const searchStep = Math.max(8, Math.round(sampleRate * 0.0005));

  const window = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
  }

  // 모노 합(L+R)/2에서만 최적 오프셋을 구해 스테레오 양 채널에 같이 적용한다.
  const mono = new Float32Array(sourceFrames);
  const left = input.getChannelData(0);
  const right = channels > 1 ? input.getChannelData(1) : left;
  for (let i = 0; i < sourceFrames; i++) mono[i] = 0.5 * (left[i] + right[i]);

  const output = ctx.createBuffer(channels, targetFrames, sampleRate);
  const dstChannels: Float32Array[] = [];
  for (let c = 0; c < channels; c++) dstChannels.push(output.getChannelData(c));

  const norm = new Float32Array(targetFrames);
  const outMono = new Float32Array(targetFrames);
  const overlap = new Float32Array(hopOut);

  let analysisPos = 0;
  let outPos = 0;
  while (outPos < targetFrames && analysisPos < sourceFrames + hopOut * rate) {
    const nominal = Math.round(analysisPos);
    let bestDelta = 0;
    let bestScore = -Infinity;

    if (outPos > 0) {
      // 이전 프레임이 이미 쓴 겹침 구간을 정규화해 현재 출력 파형으로 만든다.
      let overlapEnergy = 0;
      for (let i = 0; i < hopOut; i++) {
        const oi = outPos + i;
        const value = norm[oi] > 1e-5 ? outMono[oi] / norm[oi] : 0;
        overlap[i] = value;
        overlapEnergy += value * value;
      }

      const maxCand = sourceFrames - windowSize;
      for (let delta = -searchRange; delta <= searchRange; delta += searchStep) {
        const cand = nominal + delta;
        if (cand < 0 || cand > maxCand) continue;
        let dot = 0;
        let candidateEnergy = 0;
        for (let i = 0; i < hopOut; i++) {
          const value = mono[cand + i];
          dot += overlap[i] * value;
          candidateEnergy += value * value;
        }
        const score = dot / (Math.sqrt(overlapEnergy * candidateEnergy) + 1e-12);
        if (score > bestScore) {
          bestScore = score;
          bestDelta = delta;
        }
      }
    }

    const startIn = Math.max(0, Math.min(sourceFrames - windowSize, nominal + bestDelta));
    const writeFrames = Math.min(windowSize, targetFrames - outPos);
    for (let c = 0; c < channels; c++) {
      const src = input.getChannelData(c);
      const dst = dstChannels[c];
      for (let i = 0; i < writeFrames; i++) {
        dst[outPos + i] += src[startIn + i] * window[i];
      }
    }
    for (let i = 0; i < writeFrames; i++) {
      norm[outPos + i] += window[i];
      outMono[outPos + i] += mono[startIn + i] * window[i];
    }

    // 탐색 보정(bestDelta)은 누적하지 않는다. 누적하면 전체 배속이 목표 길이에서 어긋난다.
    analysisPos += hopOut * rate;
    outPos += hopOut;
  }

  for (let c = 0; c < channels; c++) {
    const dst = dstChannels[c];
    for (let i = 0; i < targetFrames; i++) {
      dst[i] = norm[i] > 1e-5 ? dst[i] / norm[i] : 0;
    }
  }

  return output;
}

/** 스테레오 채널 전체를 함께 보는 True-Peak 리미터 임계값(dBFS). */
export const PEAK_LIMIT_THRESHOLD_DB = -1.0;

/**
 * 오프라인 렌더링 결과에 투명한 피크 리미터를 적용한다.
 *
 * -1dBFS 이하 구간은 게인을 정확히 1로 유지해 원본 파형을 비트 단위로 보존하고,
 * 피크가 넘치는 구간만 5ms 룩어헤드로 먼저 낮춘 뒤 120ms 시정수로 천천히 복구한다.
 * 기존의 -6dB/20:1 DynamicsCompressor는 모든 타격음 어택을 상시 찍어 눌러
 * 음악의 맥아리(펀치)를 없애고 볼륨을 울렁거리게 만들었다.
 */
export function limitAudioBufferPeak(
  buffer: AudioBuffer,
  thresholdDb = PEAK_LIMIT_THRESHOLD_DB
): void {
  const frames = buffer.length;
  if (frames === 0) return;

  const threshold = Math.pow(10, thresholdDb / 20);
  const channels = buffer.numberOfChannels;
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  // 채널별 피크 중 가장 큰 값으로 단일 게인을 정해 스테레오 밸런스를 유지한다.
  const needed = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let peak = 0;
    for (let c = 0; c < channels; c++) {
      const value = Math.abs(data[c][i]);
      if (value > peak) peak = value;
    }
    needed[i] = peak > threshold ? threshold / peak : 1;
  }

  // 이동 최소값(단조 큐)으로 [i, i + lookahead] 구간의 최소 게인을 얻는다.
  const lookahead = Math.max(1, Math.round(buffer.sampleRate * 0.005));
  const cap = lookahead + 2;
  const deque = new Int32Array(cap);
  let head = 0;
  let count = 0;
  for (let i = frames - 1; i >= 0; i--) {
    while (count > 0 && needed[deque[(head + count - 1) % cap]] >= needed[i]) count--;
    deque[(head + count) % cap] = i;
    count++;
    while (count > 0 && deque[head] > i + lookahead) {
      head = (head + 1) % cap;
      count--;
    }
    needed[i] = needed[deque[head]];
  }

  const releaseCoeff = 1 - Math.exp(-1 / Math.max(1, Math.round(buffer.sampleRate * 0.12)));
  let env = 1;
  for (let i = 0; i < frames; i++) {
    env = env > needed[i]
      ? needed[i]
      : env + (1 - env) * releaseCoeff;
    // 완전히 복구된 구간에서는 곱셈 자체를 생략해 원본 비트를 그대로 보존한다.
    if (env >= 0.99999) env = 1;
    if (env === 1) continue;
    // 릴리즈 중에도 현재 샘플이 임계값을 넘지 않도록 상한을 다시 건다.
    let peak = 0;
    for (let c = 0; c < channels; c++) {
      const value = Math.abs(data[c][i]);
      if (value > peak) peak = value;
    }
    if (peak > threshold) env = Math.min(env, threshold / peak);
    for (let c = 0; c < channels; c++) data[c][i] *= env;
  }
}

export interface SeamlessLoopBuffer {
  buffer: AudioBuffer;
  /** 첫 재생은 원곡 0초부터, 이후 루프는 이 시점부터 시작한다. */
  loopStartSec: number;
}

/**
 * 곡의 끝 1.5초를 곡의 앞부분과 equal-power 크로스페이드해 이음새가 없는 루프 버퍼를 만든다.
 * loopStart를 크로스페이드 길이로 잡으면 마지막 샘플이 곡 앞부분의 직전 샘플로 자연스럽게 이어진다.
 */
export function createSeamlessLoopBuffer(
  ctx: BaseAudioContext,
  input: AudioBuffer,
  crossfadeSec = LOOP_CROSSFADE_SEC
): SeamlessLoopBuffer {
  const frames = input.length;
  if (frames < 128) return { buffer: input, loopStartSec: 0 };

  let crossfadeFrames = Math.round(input.sampleRate * crossfadeSec);
  crossfadeFrames = Math.max(2, Math.min(crossfadeFrames, Math.floor(frames / 3)));
  const tailStart = frames - crossfadeFrames;

  const output = ctx.createBuffer(input.numberOfChannels, frames, input.sampleRate);
  for (let c = 0; c < input.numberOfChannels; c++) {
    const src = input.getChannelData(c);
    const dst = output.getChannelData(c);
    dst.set(src);
    for (let j = 0; j < crossfadeFrames; j++) {
      const t = (j + 0.5) / crossfadeFrames;
      const outGain = Math.cos((t * Math.PI) / 2);
      const inGain = Math.sin((t * Math.PI) / 2);
      dst[tailStart + j] = src[tailStart + j] * outGain + src[j] * inGain;
    }
  }

  return { buffer: output, loopStartSec: crossfadeFrames / input.sampleRate };
}

/** 영상 끝부분에 equal-power 페이드아웃을 적용해 음악이 칼같이 끊기지 않게 한다. */
export function applyEndFade(buffer: AudioBuffer, fadeSec = END_FADE_SEC): void {
  const frames = buffer.length;
  const fadeFrames = Math.min(Math.round(buffer.sampleRate * fadeSec), frames);
  if (fadeFrames < 2) return;
  const start = frames - fadeFrames;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < fadeFrames; i++) {
      const t = i / (fadeFrames - 1);
      data[start + i] *= Math.cos((t * Math.PI) / 2);
    }
  }
}

/** 실시간(MediaRecorder) 경로에서 마스터 버스에 종료 페이드를 예약한다. */
export function scheduleMasterFadeOut(
  bus: GainNode,
  ctx: BaseAudioContext,
  fadeSec = END_FADE_SEC
): void {
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.2, fadeSec));
}

/**
 * 실시간 폴백용 완화된 마스터 리미터.
 * 기본 BGM 레벨(-6dB 근처)을 건드리지 않도록 문턱을 올리고 무릎·릴리즈를 완화했다.
 */
export function createMasterLimiter(
  ctx: BaseAudioContext,
  destination: AudioNode
): GainNode {
  const bus = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.knee.value = 3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.2;
  bus.connect(limiter);
  limiter.connect(destination);
  return bus;
}
