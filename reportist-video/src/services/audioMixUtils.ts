// services/audioMixUtils.ts
// 내보내기 오디오 믹싱 유틸.
// ① 미리보기(<audio>.preservesPitch = true)와 같은 음높이 유지 타임스트레치
// ② 믹스 합산 시 클리핑으로 여린 악기·멜로디가 AAC에서 뭉개지는 것을 막는 소프트 리미터

/**
 * OLA(Overlap-Add) 기반 타임스트레치. 샘플레이트를 바꾸지 않고 구간을 겹쳐 늘이/줄이므로
 * 음높이(피치)가 그대로 유지된다. Web Audio의 AudioBufferSourceNode.playbackRate는
 * preservesPitch를 지원하지 않아 배속 시 음높이가 바뀌는데, 이를 미리보기와 맞추기 위한 함수다.
 *
 * @param rate 원본 길이 / 목표 길이. 0.5면 2배 느리게(2배 길게), 2면 2배 빠르게.
 */
export function timeStretchAudioBuffer(
  ctx: BaseAudioContext,
  input: AudioBuffer,
  rate: number
): AudioBuffer {
  if (!Number.isFinite(rate) || rate <= 0 || Math.abs(rate - 1) < 0.001) return input;

  const sourceFrames = input.length;
  const targetFrames = Math.max(1, Math.round(sourceFrames / rate));
  const channels = input.numberOfChannels;
  const output = ctx.createBuffer(channels, targetFrames, input.sampleRate);

  // 출력 프레임 간격은 절반 겹침으로 고정하고, 입력 프레임 간격만 rate에 맞춰 조절한다.
  // rate < 1 → 입력 간격이 더 작아져 같은 구간을 여러 번 겹쳐 느려지고,
  // rate > 1 → 입력 간격이 더 커져 건너뛰며 빨라진다. 출력 겹침은 항상 50%라 피치가 유지된다.
  const windowSize = 2048;
  const hopOut = windowSize / 2;
  const hopIn = Math.max(1, Math.round(hopOut * rate));

  const window = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
  }

  for (let c = 0; c < channels; c++) {
    const src = input.getChannelData(c);
    const dst = output.getChannelData(c);
    // 해닝 창을 50% 겹침으로 더하면 정상 구간의 합이 1이지만,
    // 양 끝에서는 합이 1보다 작아지므로 정규화가 필요하다.
    const norm = new Float32Array(targetFrames);

    let inPos = 0;
    let outPos = 0;
    while (inPos < sourceFrames && outPos < targetFrames) {
      for (let i = 0; i < windowSize; i++) {
        const di = outPos + i;
        if (di < targetFrames) {
          const si = inPos + i;
          const w = window[i];
          dst[di] += (si < sourceFrames ? src[si] : 0) * w;
          norm[di] += w;
        }
      }
      inPos += hopIn;
      outPos += hopOut;
    }

    for (let i = 0; i < targetFrames; i++) {
      dst[i] = norm[i] > 1e-5 ? dst[i] / norm[i] : 0;
    }
  }

  return output;
}

/**
 * 믹스 결과를 [-1, 1] 안으로 부드럽게 제한한다.
 * 0.9 이하는 건드리지 않고, 그 초과분만 tanh로 꺾어 하드 클리핑과
 * AAC 심리음향 마스킹(잔향·하이햇·여린 멜로디가 사라지는 현상)을 막는다.
 */
export function softLimitAudioBuffer(buffer: AudioBuffer): void {
  const knee = 0.9;
  const range = 1 - knee;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const x = data[i];
      if (x > knee) {
        data[i] = knee + range * Math.tanh((x - knee) / range);
      } else if (x < -knee) {
        data[i] = -knee + range * Math.tanh((x + knee) / range);
      }
    }
  }
}

/** DynamicsCompressor를 리미터로 설정해 마스터 버스에 연결한다. */
export function createMasterLimiter(
  ctx: BaseAudioContext,
  destination: AudioNode
): GainNode {
  const bus = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  bus.connect(limiter);
  limiter.connect(destination);
  return bus;
}
