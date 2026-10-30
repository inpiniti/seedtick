// src/domain/youtube/YouTubeCookieExtractor.ts
// youtubei.js 기반 쿠키 인증 및 서명 해독(decipher) 오디오 추출기

import { ClientType, Innertube, Platform } from 'youtubei.js';
import { env } from '../../config/env.ts';
import {
  MAX_YOUTUBE_AUDIO_BYTES,
  YouTubeAudioError,
  type YouTubeAudioResult,
  isYouTubeBotCheck,
  parseYouTubeCookies,
} from './YouTubeAudioService.ts';

// youtubei.js에 안전한 JavaScript 인터프리터 주입 (플레이어 서명 해독용)
Platform.shim.eval = async (data: { output: string }) => {
  return new Function(data.output)();
};

const CLIENT_CANDIDATES: (keyof typeof ClientType)[] = ['VISIONOS', 'IOS', 'TV', 'MWEB'];

const CLIENT_USER_AGENTS: Record<string, string> = {
  VISIONOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  IOS: 'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)',
  TV: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1',
  MWEB: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

const AUDIO_FORMAT_PREFERENCE = [140, 139, 251, 250, 249];

interface SessionCacheEntry {
  promise: Promise<Innertube>;
  cookieRaw: string;
}

const sessionCache = new Map<string, SessionCacheEntry>();

export function resetYouTubeCookieSessionCache(): void {
  sessionCache.clear();
}

function getCookieHeaderString(): string {
  const cookies = parseYouTubeCookies(env.youtubeCookie);
  if (cookies.size === 0) return '';
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function getOrCreateInnertube(clientName: keyof typeof ClientType): Promise<Innertube> {
  const cookieHeader = getCookieHeaderString();
  const cacheKey = `${clientName}:${cookieHeader}`;
  const existing = sessionCache.get(cacheKey);
  if (existing && existing.cookieRaw === env.youtubeCookie) {
    return existing.promise;
  }

  const clientType = ClientType[clientName];
  const promise = Innertube.create({
    client_type: clientType,
    cookie: cookieHeader || undefined,
    retrieve_player: true,
    enable_session_cache: false,
    generate_session_locally: false,
  }).catch((err) => {
    sessionCache.delete(cacheKey);
    throw err;
  });

  sessionCache.set(cacheKey, { promise, cookieRaw: env.youtubeCookie });
  return promise;
}

function formatRank(itag: number, mimeType: string): number {
  const index = AUDIO_FORMAT_PREFERENCE.indexOf(itag);
  if (index >= 0) return index;
  if (mimeType.startsWith('audio/mp4')) return AUDIO_FORMAT_PREFERENCE.length;
  if (mimeType.startsWith('audio/webm')) return AUDIO_FORMAT_PREFERENCE.length + 1;
  return AUDIO_FORMAT_PREFERENCE.length + 2;
}

function sanitizeFilename(title: string, videoId: string, extension: 'm4a' | 'webm'): string {
  const withoutControls = Array.from(title)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('');
  const cleaned = withoutControls
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${cleaned || `youtube-${videoId}`}.${extension}`;
}

async function readResponseCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        break;
      }

      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

export async function fetchAudioWithCookies(
  videoId: string,
  options: { maxBytes?: number; deadlineMs?: number } = {}
): Promise<YouTubeAudioResult> {
  const maxBytes = options.maxBytes ?? MAX_YOUTUBE_AUDIO_BYTES;
  const deadline = Date.now() + (options.deadlineMs ?? 45_000);

  let lastError: YouTubeAudioError | null = null;

  for (const clientName of CLIENT_CANDIDATES) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 3000) {
      break;
    }

    try {
      const yt = await Promise.race([
        getOrCreateInnertube(clientName),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Innertube creation timed out')),
            Math.min(10_000, remainingMs)
          )
        ),
      ]);

      const remainingForInfo = deadline - Date.now();
      if (remainingForInfo <= 3000) break;

      const info = await Promise.race([
        yt.getBasicInfo(videoId),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('getBasicInfo timed out')),
            Math.min(10_000, remainingForInfo)
          )
        ),
      ]);

      const playability = info.playability_status;
      if (playability?.status && playability.status !== 'OK') {
        const reason = playability.reason ?? '';
        console.warn(`[YouTubeCookieExtractor] ${clientName} rejected:`, {
          status: playability.status,
          reason,
        });

        if (isYouTubeBotCheck(reason)) {
          lastError = new YouTubeAudioError(
            'YOUTUBE_COOKIE_BOT_CHECK',
            'YouTube가 쿠키 인증 후에도 로그인하여 봇 확인을 요구했어요. 최신 로그인 쿠키인지 확인해 주세요.',
            422
          );
          // 봇 확인은 모든 클라이언트에 걸릴 가능성이 높지만 다른 클라이언트도 한 번 더 시도해볼 수 있다.
          continue;
        }

        if (playability.status === 'UNPLAYABLE') {
          lastError = new YouTubeAudioError(
            'YOUTUBE_VIDEO_UNAVAILABLE',
            `YouTube에서 이 영상을 재생할 수 없다고 응답했어요 (${reason || playability.status}).`,
            422
          );
          continue;
        }
      }

      const streamingData = info.streaming_data;
      const rawFormats = [
        ...(streamingData?.formats || []),
        ...(streamingData?.adaptive_formats || []),
      ];

      const audioFormats = rawFormats.filter(
        (f) => f.has_audio && typeof f.mime_type === 'string' && f.mime_type.startsWith('audio/')
      );

      if (audioFormats.length === 0) {
        lastError = new YouTubeAudioError(
          'YOUTUBE_AUDIO_NOT_FOUND',
          'YouTube가 이 영상에서 사용할 수 있는 오디오 스트림을 제공하지 않았어요.',
          422
        );
        continue;
      }

      // 랭킹 정렬
      const ranked = [...audioFormats].sort((a, b) => {
        const rankDiff = formatRank(a.itag, a.mime_type) - formatRank(b.itag, b.mime_type);
        if (rankDiff !== 0) return rankDiff;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      // 허용 용량 내 포맷 선택 또는 가장 작은 포맷
      const candidateSizes = ranked.map((f) => {
        const len = f.content_length;
        if (typeof len === 'number' && len > 0) return len;
        if (f.bitrate && f.approx_duration_ms) {
          return Math.round((f.bitrate * f.approx_duration_ms) / 8 / 1000);
        }
        return 0;
      });

      let chosenIndex = candidateSizes.findIndex((sz) => sz > 0 && sz <= maxBytes);
      let truncated = false;
      if (chosenIndex === -1) {
        // 모든 후보가 maxBytes 초과 시 가장 작은 것 선택
        let minSize = Number.POSITIVE_INFINITY;
        let minIdx = 0;
        for (let i = 0; i < candidateSizes.length; i++) {
          const sz = candidateSizes[i];
          if (sz > 0 && sz < minSize) {
            minSize = sz;
            minIdx = i;
          }
        }
        chosenIndex = minIdx;
        truncated = true;
      }

      const selectedFormat = ranked[chosenIndex] ?? ranked[0];

      // decipher URL
      let streamUrl: string;
      try {
        streamUrl = await selectedFormat.decipher(yt.session.player);
      } catch (decipherErr) {
        console.warn(`[YouTubeCookieExtractor] Decipher failed for ${clientName}:`, decipherErr);
        continue;
      }

      if (!streamUrl || !streamUrl.startsWith('http')) {
        continue;
      }

      // 오디오 스트림 다운로드
      const remainingForDownload = deadline - Date.now();
      if (remainingForDownload <= 3000) break;

      const userAgent = CLIENT_USER_AGENTS[clientName] || CLIENT_USER_AGENTS.VISIONOS;
      let downloadResponse: Response;
      try {
        downloadResponse = await fetch(streamUrl, {
          headers: {
            Range: `bytes=0-${maxBytes - 1}`,
            'User-Agent': userAgent,
            Origin: 'https://www.youtube.com',
            Referer: 'https://www.youtube.com/',
          },
          signal: AbortSignal.timeout(Math.min(25_000, remainingForDownload)),
        });
      } catch (err) {
        console.warn(`[YouTubeCookieExtractor] Download fetch failed for ${clientName}:`, err);
        lastError = new YouTubeAudioError(
          'YOUTUBE_AUDIO_UNREACHABLE',
          '오디오 스트림 다운로드에 실패했어요.',
          502,
          true
        );
        continue;
      }

      if (!downloadResponse.ok && downloadResponse.status !== 206) {
        console.warn(
          `[YouTubeCookieExtractor] Download responded with HTTP ${downloadResponse.status} for ${clientName}`
        );
        lastError = new YouTubeAudioError(
          'YOUTUBE_AUDIO_FETCH_FAILED',
          `오디오 스트림이 HTTP ${downloadResponse.status}로 응답했어요.`,
          502,
          true
        );
        continue;
      }

      const data = await readResponseCapped(downloadResponse, maxBytes);
      if (data.byteLength === 0) {
        lastError = new YouTubeAudioError(
          'YOUTUBE_AUDIO_EMPTY',
          '오디오 스트림이 비어 있어요.',
          502,
          true
        );
        continue;
      }

      const declaredTotal =
        selectedFormat.content_length ?? candidateSizes[chosenIndex] ?? data.byteLength;
      const totalBytes = declaredTotal > 0 ? declaredTotal : data.byteLength;
      const isTruncated = truncated || totalBytes > data.byteLength;

      const durationMs =
        selectedFormat.approx_duration_ms || (info.basic_info.duration ?? 0) * 1000;
      const durationSeconds = Math.max(0, Math.round(durationMs / 1000));

      let audioSeconds = durationSeconds;
      if (isTruncated && totalBytes > 0 && durationSeconds > 0) {
        audioSeconds = (data.byteLength / totalBytes) * durationSeconds;
      }
      audioSeconds = Math.max(0, Math.round(audioSeconds * 10) / 10);

      const mimeType = selectedFormat.mime_type?.split(';')[0]?.trim() || 'audio/mp4';
      const extension: 'm4a' | 'webm' = mimeType.includes('webm') ? 'webm' : 'm4a';
      const title = info.basic_info.title?.trim() || `YouTube 오디오 (${videoId})`;

      return {
        videoId,
        title,
        durationSeconds,
        itag: selectedFormat.itag,
        mimeType,
        extension,
        data,
        totalBytes,
        truncated: isTruncated,
        audioSeconds,
        filename: sanitizeFilename(title, videoId, extension),
      };
    } catch (err) {
      if (err instanceof YouTubeAudioError) {
        lastError = err;
      } else {
        console.warn(`[YouTubeCookieExtractor] Unexpected error for ${clientName}:`, err);
        lastError = new YouTubeAudioError(
          'YOUTUBE_PLAYER_FAILED',
          `쿠키 인증 오디오 추출 중 오류가 발생했어요: ${err instanceof Error ? err.message : String(err)}`,
          502,
          true
        );
      }
    }
  }

  throw (
    lastError ??
    new YouTubeAudioError(
      'YOUTUBE_COOKIE_AUTH_FAILED',
      'YouTube 쿠키 인증을 통한 오디오 추출에 실패했어요. 음악 파일을 직접 업로드해 주세요.',
      502
    )
  );
}
