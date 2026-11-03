// data/audioLibrary.ts - 오디오 보관함 내장 배경음악 목록

export interface AudioLibraryTrack {
  id: string;
  name: string;
  fileName: string;
  src: string;
  mimeType: string;
}

const baseUrl = import.meta.env.BASE_URL;

export const AUDIO_LIBRARY: AudioLibraryTrack[] = [
  {
    id: 'lively-day',
    name: 'Lively Day',
    fileName: 'Lively Day.mp3',
    src: `${baseUrl}Lively%20Day.mp3`,
    mimeType: 'audio/mpeg',
  },
  {
    id: 'dreaming',
    name: 'Dreaming',
    fileName: 'Dreaming.mp3',
    src: `${baseUrl}Dreaming.mp3`,
    mimeType: 'audio/mpeg',
  },
  {
    id: 'cloud-walking',
    name: '구름걷기',
    fileName: '구름걷기.mp3',
    src: `${baseUrl}%EA%B5%AC%EB%A6%84%EA%B1%B7%EA%B8%B0.mp3`,
    mimeType: 'audio/mpeg',
  },
];

const fileCache = new Map<string, Promise<File>>();

// 보관함 음원을 병합 파이프라인에서 사용할 수 있도록 File 객체로 변환 (동일 음원은 캐시 재사용)
export function loadLibraryAudioFile(track: AudioLibraryTrack): Promise<File> {
  const cached = fileCache.get(track.id);
  if (cached) return cached;

  const pending = fetch(track.src)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load audio track: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => new File([blob], track.fileName, { type: track.mimeType }));

  fileCache.set(track.id, pending);
  pending.catch(() => fileCache.delete(track.id));
  return pending;
}
