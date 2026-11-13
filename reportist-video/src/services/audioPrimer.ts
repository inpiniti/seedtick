// src/services/audioPrimer.ts - 사용자 제스처 안에서 AudioContext를 미리 잠금 해제하는 공용 모듈
// (videoStitcher가 지연 로딩돼도 iOS Safari 오디오 언락이 유지되도록 분리)

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

export function getSharedAudioContext(): AudioContext | null {
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
