// src/hooks/usePreviewAudio.ts
// 스튜디오 V2 미리보기의 BGM 재생을 타임라인 플레이헤드에 동기화한다.
// 원본 영상의 현장음은 <video>要素를 unmute해서 재생하고, 여기서는 내보내기와
// 같은 볼륨 공식(getBgmGain)으로 음원 파일/신스 프리셋을 겹쳐 들려준다.

import { useEffect, useRef, useState } from 'react';
import { getSharedAudioContext } from '../services/audioPrimer.ts';
import { getBgmGain, playBgmSynthLoop } from '../services/audioSynth.ts';

interface UsePreviewAudioParams {
  /** 타임라인 재생 위치(초). */
  playhead: number;
  isPlaying: boolean;
  totalDuration: number;
  bgmPresetId: string;
  bgmVolume: number;
  customAudioFile: File | null;
  bgmFitToVideo: boolean;
  isMuted: boolean;
}

type SynthController = ReturnType<typeof playBgmSynthLoop>;

const clampRate = (rate: number) => Math.max(0.25, Math.min(4, rate));

/** 배경음이 반복될 때 사용할 재생 위치. 영상 길이에 맞춘 경우 전체 길이에 비례한다. */
function resolveBgmTime(playhead: number, duration: number, fit: boolean, total: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (fit && total > 0) {
    return Math.max(0, Math.min(duration - 0.01, (playhead / total) * duration));
  }
  return Math.max(0, playhead % duration);
}

export function usePreviewAudio({
  playhead,
  isPlaying,
  totalDuration,
  bgmPresetId,
  bgmVolume,
  customAudioFile,
  bgmFitToVideo,
  isMuted,
}: UsePreviewAudioParams): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const synthGainRef = useRef<GainNode | null>(null);
  const synthRef = useRef<SynthController | null>(null);
  const [metadataTick, setMetadataTick] = useState(0);

  // 오디오 파일이 바뀌면 새 <audio>와 Web Audio 게인을 만든다.
  // 같은 element에 createMediaElementSource를 두 번 호출하면 예외가 나므로
  // 파일 교체 시마다 새 element를 사용하고 이전 것을 확실히 정리한다.
  useEffect(() => {
    const old = audioRef.current;
    if (old) {
      old.pause();
      old.removeAttribute('src');
      old.load();
    }
    if (gainRef.current) {
      try {
        gainRef.current.disconnect();
      } catch {
        /* 무시 */
      }
      gainRef.current = null;
    }
    audioRef.current = null;

    if (!customAudioFile) return;

    const url = URL.createObjectURL(customAudioFile);
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.preservesPitch = true;
    audio.loop = !bgmFitToVideo;
    audio.onloadedmetadata = () => setMetadataTick((tick) => tick + 1);

    const ctx = getSharedAudioContext();
    if (ctx) {
      try {
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = isMuted ? 0 : getBgmGain(bgmVolume);
        source.connect(gain);
        gain.connect(ctx.destination);
        gainRef.current = gain;
      } catch {
        // Web Audio 연결 실패 시 <audio>.volume으로 폴백한다.
        audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, bgmVolume));
      }
    } else {
      audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, bgmVolume));
    }

    audioRef.current = audio;
    const createdGain = gainRef.current;
    return () => {
      audio.onloadedmetadata = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      if (createdGain) {
        try {
          createdGain.disconnect();
        } catch {
          /* 무시 */
        }
        if (gainRef.current === createdGain) gainRef.current = null;
      }
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [customAudioFile]);

  // 음원 파일 교체/길이 맞춤 옵션 변경 시 루프·배속을 맞춘다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = !bgmFitToVideo;
    audio.preservesPitch = true;
  }, [bgmFitToVideo, customAudioFile, metadataTick]);

  // 볼륨·음소거는 재생을 다시 시작하지 않고 게인만 갱신한다.
  useEffect(() => {
    const value = isMuted ? 0 : getBgmGain(bgmVolume);
    const ctx = getSharedAudioContext();
    if (gainRef.current) {
      if (ctx) gainRef.current.gain.setTargetAtTime(value, ctx.currentTime, 0.03);
      else gainRef.current.gain.value = value;
    }
    if (audioRef.current && !gainRef.current) {
      audioRef.current.volume = isMuted ? 0 : Math.min(1, Math.max(0, bgmVolume));
    }
    if (synthGainRef.current && ctx) {
      synthGainRef.current.gain.setTargetAtTime(value, ctx.currentTime, 0.03);
    }
  }, [bgmVolume, isMuted, customAudioFile, bgmPresetId, metadataTick]);

  // 파일 음원이 없을 때 신스 프리셋을 재생한다(내보내기와 같은 프리셋 테이블).
  useEffect(() => {
    synthRef.current?.stop();
    synthRef.current = null;
    if (synthGainRef.current) {
      try {
        synthGainRef.current.disconnect();
      } catch {
        /* 무시 */
      }
      synthGainRef.current = null;
    }
    if (customAudioFile || bgmPresetId === 'none' || !isPlaying || isMuted || bgmVolume <= 0) {
      return;
    }
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = getBgmGain(bgmVolume);
    gain.connect(ctx.destination);
    synthGainRef.current = gain;
    synthRef.current = playBgmSynthLoop(ctx, gain, bgmPresetId, 1);
    return () => {
      synthRef.current?.stop();
      synthRef.current = null;
      try {
        gain.disconnect();
      } catch {
        /* 무시 */
      }
      if (synthGainRef.current === gain) synthGainRef.current = null;
    };
  }, [customAudioFile, bgmPresetId, isPlaying, isMuted]);

  // 플레이헤드 추적: 60fps로 호출되므로 실제로 어긋날 때만 seek한다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const shouldPlay = isPlaying && !isMuted && bgmVolume > 0;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const rate = bgmFitToVideo && duration > 0 && totalDuration > 0
      ? clampRate(duration / totalDuration)
      : 1;
    if (Math.abs(audio.playbackRate - rate) > 0.01) audio.playbackRate = rate;

    if (duration > 0) {
      const target = resolveBgmTime(playhead, duration, bgmFitToVideo, totalDuration);
      const drift = Math.abs(audio.currentTime - target);
      // 재생 중에는 큰 드리프트만 보정하고, 일시정지/시크 시에는 정확히 맞춘다.
      if (drift > (isPlaying ? 0.3 : 0.08)) {
        try {
          audio.currentTime = target;
        } catch {
          /* 아직 seek 불가 */
        }
      }
    }

    if (shouldPlay) {
      if (audio.paused) {
        const promise = audio.play();
        if (promise) promise.catch(() => {});
      }
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [playhead, isPlaying, isMuted, bgmVolume, bgmFitToVideo, totalDuration, customAudioFile, metadataTick]);
}
