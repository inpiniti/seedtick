// services/audioSynth.ts - 브라우저 Web Audio API 기반 무손실 BGM 신디사이저 및 사운드트랙 생성기

import type { BgmPreset } from '../types/video.ts';

export const BGM_PRESETS: BgmPreset[] = [
  {
    id: 'none',
    name: '배경음악 없음',
    mood: '클린',
    tempo: '-',
    description: '원본 비디오 현장음만 선명하게 유지합니다.',
  },
  {
    id: 'acoustic',
    name: '포근한 어쿠스틱 아르페지오',
    mood: '따뜻함 / 일상',
    tempo: '88 BPM',
    description: '아이, 나들이, 일상 브이로그에 어울리는 따뜻한 어쿠스틱 화음 선율',
  },
  {
    id: 'chill',
    name: '로파이 칠 앰비언트',
    mood: '차분함 / 감성',
    tempo: '76 BPM',
    description: '세련되고 부드러운 로파이 코드 톤과 잔잔한 배경음',
  },
  {
    id: 'energetic',
    name: '경쾌한 비트 & 멜로디',
    mood: '활기참 / 역동적',
    tempo: '112 BPM',
    description: '놀이터, 야외 스포츠, 신나는 순간에 어울리는 경쾌한 신스 리듬',
  },
  {
    id: 'cinematic',
    name: '시네마틱 감성 피아노',
    mood: '웅장함 / 영화풍',
    tempo: '72 BPM',
    description: '유튜브 하이라이트의 감정선을 높여주는 영화풍 서정적 하모니',
  },
];

// 프리셋별 코드 진행 주파수 테이블 (Hz)
const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  acoustic: [
    // C - G - Am - F (따뜻한 캐논/팝 코드)
    [261.63, 329.63, 392.0, 523.25], // C
    [196.0, 246.94, 293.66, 392.0],  // G
    [220.0, 261.63, 329.63, 440.0],  // Am
    [174.61, 220.0, 261.63, 349.23], // F
  ],
  chill: [
    // Fmaj7 - Em7 - Dm7 - Cmaj7
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [164.81, 196.0, 246.94, 293.66], // Em7
    [146.83, 174.61, 220.0, 261.63], // Dm7
    [130.81, 164.81, 196.0, 246.94], // Cmaj7
  ],
  energetic: [
    // C - D - Em - G (상승 에너지)
    [261.63, 329.63, 392.0], // C
    [293.66, 369.99, 440.0], // D
    [329.63, 392.0, 493.88], // Em
    [392.0, 493.88, 587.33], // G
  ],
  cinematic: [
    // Am - F - C - G
    [220.0, 261.63, 329.63, 523.25],
    [174.61, 220.0, 261.63, 440.0],
    [261.63, 329.63, 392.0, 523.25],
    [196.0, 246.94, 293.66, 392.0],
  ],
};

// Web Audio API를 활용한 무중단 BGM 합성 루프 재생
export function playBgmSynthLoop(
  ctx: AudioContext,
  destination: AudioNode,
  presetId: string,
  volume = 0.35
): { stop: () => void; setVolume: (v: number) => void } {
  if (presetId === 'none' || !CHORD_PROGRESSIONS[presetId]) {
    return { stop: () => {}, setVolume: () => {} };
  }

  const chords = CHORD_PROGRESSIONS[presetId];
  let isRunning = true;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const activeOscs: OscillatorNode[] = [];

  // 마스터 게인 노드
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);

  // 로우패스 필터로 부드럽고 세련된 음색 형성
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(presetId === 'chill' ? 1200 : 2800, ctx.currentTime);
  filter.Q.setValueAtTime(1.5, ctx.currentTime);

  masterGain.connect(filter);
  filter.connect(destination);

  let chordIndex = 0;
  const chordDurationSec = presetId === 'energetic' ? 1.6 : 2.4;

  const playChordStep = () => {
    if (!isRunning || ctx.state === 'closed') return;

    const chord = chords[chordIndex % chords.length];
    chordIndex++;
    const now = ctx.currentTime;

    chord.forEach((freq, i) => {
      try {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        // 어쿠스틱/피아노는 부드러운 사인/삼각파, 에너제틱은 톱니파 결합
        osc.type = presetId === 'energetic' && i === 0 ? 'sawtooth' : i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // 아르페지오 미세 시차 (스트럼 느낌 연출)
        const noteStart = now + i * 0.08;
        const noteEnd = noteStart + chordDurationSec;

        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.exponentialRampToValueAtTime(0.18 / chord.length, noteStart + 0.06);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd - 0.05);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(noteStart);
        osc.stop(noteEnd);

        activeOscs.push(osc);
        osc.onended = () => {
          const idx = activeOscs.indexOf(osc);
          if (idx !== -1) activeOscs.splice(idx, 1);
        };
      } catch {
        // ignore audio errors
      }
    });

    timerId = setTimeout(playChordStep, chordDurationSec * 1000);
  };

  playChordStep();

  return {
    stop: () => {
      isRunning = false;
      if (timerId) clearTimeout(timerId);
      activeOscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      });
      try {
        masterGain.disconnect();
        filter.disconnect();
      } catch {
        // ignore
      }
    },
    setVolume: (v: number) => {
      try {
        masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05);
      } catch {
        // ignore
      }
    },
  };
}
