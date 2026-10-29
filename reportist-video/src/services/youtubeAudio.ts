// services/youtubeAudio.ts - YouTube 링크/영상 키로 배경음악 오디오를 가져오는 클라이언트
//
// 브라우저에서 YouTube/googlevideo를 직접 호출하면 CORS와 IP 바인딩 문제로 실패한다.
// AI Gateway의 /v1/youtube/audio 프록시가 오디오 바이너리를 대신 내려준다.

import { DEFAULT_CONFIG } from './gatewayClient.ts';
import type { GatewayConfig } from '../types/gateway.ts';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface YouTubeAudioImportResult {
  file: File;
  videoId: string;
  title: string;
  durationSeconds: number;
  audioSeconds: number;
  truncated: boolean;
  totalBytes: number;
}

/** 유튜브 URL, 공유 링크, 11자리 영상 키에서 videoId를 추출한다. */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const hostAllowed =
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com';

  if (!hostAllowed) return null;

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  const queryId = url.searchParams.get('v') ?? '';
  if (VIDEO_ID_PATTERN.test(queryId)) return queryId;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const [kind, id] = parts;
    if (['shorts', 'embed', 'live', 'v'].includes(kind) && VIDEO_ID_PATTERN.test(id)) {
      return id;
    }
  }

  return null;
}

function decodeHeaderValue(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toNumber(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sanitizeFileName(name: string, fallback: string): string {
  const withoutControls = Array.from(name)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('');
  const cleaned = withoutControls
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.clone().json()) as {
      error?: { message?: string };
    };
    if (json?.error?.message) return json.error.message;
  } catch {
    // JSON 에러 본문이 아니면 상태 코드 기반 메시지 사용
  }
  return '';
}

/**
 * YouTube 오디오를 게이트웨이에서 내려받아 BGM으로 쓸 수 있는 File로 변환한다.
 * 실패 시 사용자에게 그대로 보여줄 수 있는 한국어 메시지를 담은 Error를 던진다.
 */
export async function fetchYouTubeAudioFile(
  input: string,
  config: GatewayConfig = DEFAULT_CONFIG,
  signal?: AbortSignal
): Promise<YouTubeAudioImportResult> {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) {
    throw new Error('유튜브 주소나 11자리 영상 키를 정확히 입력해 주세요.');
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/youtube/audio?url=${encodeURIComponent(videoId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.gatewaySecret}`,
      },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error(
      'AI 게이트웨이에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도하거나 음악 파일을 직접 올려주세요.'
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('게이트웨이 인증에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
    if (response.status === 404) {
      throw new Error(
        '아직 배포된 게이트웨이에서 유튜브 가져오기를 지원하지 않아요. 음악 파일을 직접 올려주세요.'
      );
    }

    const serverMessage = await readErrorMessage(response);
    if (serverMessage) {
      throw new Error(serverMessage);
    }
    if (response.status === 413 || response.status === 502 || response.status === 504) {
      throw new Error(
        '유튜브 오디오를 가져오지 못했어요. 잠시 후 다시 시도하거나 음악 파일을 직접 올려주세요.'
      );
    }
    throw new Error(`유튜브 오디오를 가져오지 못했어요 (HTTP ${response.status}).`);
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }
    throw new Error(
      '오디오 데이터를 내려받는 중 연결이 끊겼어요. 다시 시도하거나 음악 파일을 직접 올려주세요.'
    );
  }

  if (blob.size === 0) {
    throw new Error('가져온 오디오가 비어 있어요. 다른 영상으로 시도해 주세요.');
  }

  const title = decodeHeaderValue(response.headers.get('x-youtube-title')) || `YouTube 오디오 (${videoId})`;
  const extension = blob.type.includes('webm') ? 'webm' : 'm4a';
  const headerFileName = decodeHeaderValue(response.headers.get('x-youtube-filename'));
  const fileName = sanitizeFileName(
    headerFileName || `${title}.${extension}`,
    `youtube-${videoId}.${extension}`
  );

  const file = new File([blob], fileName, {
    type: blob.type || (extension === 'webm' ? 'audio/webm' : 'audio/mp4'),
    lastModified: Date.now(),
  });

  const durationSeconds = toNumber(response.headers.get('x-youtube-duration'));
  const audioSeconds = toNumber(response.headers.get('x-youtube-audio-seconds')) || durationSeconds;

  return {
    file,
    videoId,
    title,
    durationSeconds,
    audioSeconds,
    truncated: response.headers.get('x-youtube-truncated') === '1',
    totalBytes: toNumber(response.headers.get('x-youtube-total-bytes')) || blob.size,
  };
}
