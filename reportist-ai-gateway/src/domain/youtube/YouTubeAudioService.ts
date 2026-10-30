// YouTubeAudioService.ts - YouTube InnerTube(VISIONOS) 기반 오디오 스트림 추출 서비스
//
// 브라우저에서 googlevideo.com 오디오 URL을 직접 호출하면 CORS 헤더가 없고
// URL이 요청 IP에 묶여 있어 재생할 수 없다. 따라서 게이트웨이가 대신 오디오를
// 내려받아 바이너리로 중계한다.

import { createHash } from 'node:crypto';
import { env } from '../../config/env.ts';

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const VISITOR_ID_URL = 'https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false';
const VISITOR_ID_CLIENT_VERSION = '2.20240101.00.00';
const VISITOR_DATA_TTL_MS = 30 * 60 * 1000;

// yt-dlp의 visionOS 클라이언트 설정과 동일하다. PO token 없이도
// adaptiveFormats의 direct audio URL을 돌려주는 것을 확인했다.
const YOUTUBE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
interface YouTubePlayerClient {
  name: string;
  version: string;
  id: string;
  userAgent: string;
  clientContext?: Record<string, string>;
  embedUrl?: string;
}

const VISIONOS_PLAYER_CLIENT: YouTubePlayerClient = {
  name: 'VISIONOS',
  version: '1.02',
  id: '101',
  userAgent: YOUTUBE_UA,
  clientContext: {
    deviceMake: 'Apple',
    deviceModel: 'RealityDevice17,1',
    osName: 'visionOS',
    osVersion: '26.5.23O471',
  },
};

// visionOS는 cookies.txt 인증을 지원하지 않는다. 로그인 쿠키 fallback은
// 쿠키를 지원하는 임베드 및 TV 클라이언트를 순서대로 사용한다.
const YOUTUBE_COOKIE_CLIENTS: YouTubePlayerClient[] = [
  {
    name: 'WEB_EMBEDDED_PLAYER',
    version: '2.20260708.00.00',
    id: '56',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15,gzip(gfe)',
    embedUrl: 'https://www.reddit.com/',
  },
  {
    name: 'TVHTML5',
    version: '5.20260707',
    id: '7',
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1',
    clientContext: {
      deviceMake: 'Samsung',
      deviceModel: 'UKS9800',
      osName: 'Tizen',
      osVersion: '2.4.0',
    },
  },
];

const YOUTUBE_HOST = 'www.youtube.com';
const YOUTUBE_ORIGIN = `https://${YOUTUBE_HOST}`;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function isYouTubeCookieDomain(domain: string, includeSubdomains: boolean): boolean {
  const normalized = domain.toLowerCase().replace(/^\./, '');
  return (
    normalized === YOUTUBE_HOST ||
    (includeSubdomains &&
      (normalized === 'youtube.com' || YOUTUBE_HOST.endsWith(`.${normalized}`)))
  );
}

function cookiePathMatches(requestPath: string, cookiePath: string): boolean {
  if (!cookiePath.startsWith('/')) return false;
  if (requestPath === cookiePath) return true;
  return requestPath.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`);
}

/** Accepts a Netscape cookies.txt export or a standard Cookie header value. */
function parseYouTubeCookies(rawValue: string): Map<string, string> {
  const cookies = new Map<string, string>();
  const trimmed = rawValue.trim();
  if (!trimmed) return cookies;
  if (/^\s*Set-Cookie\s*:/im.test(trimmed)) return cookies;

  const lines = trimmed.split(/\r?\n/);
  const isNetscapeFile =
    lines.some((line) => line.includes('\t')) ||
    lines.some((line) => /^#\s*(?:HTTP )?Cookie File/i.test(line));

  if (!isNetscapeFile) {
    for (const item of trimmed.split(';')) {
      const separator = item.indexOf('=');
      if (separator <= 0) continue;
      const name = item.slice(0, separator).trim();
      const value = item.slice(separator + 1).trim();
      if (
        COOKIE_NAME_PATTERN.test(name) &&
        value.length > 0 &&
        !/[;\r\n]/.test(value)
      ) {
        cookies.set(name, value);
      }
    }
    return cookies;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const originalLine of lines) {
    const line = originalLine.startsWith('#HttpOnly_')
      ? originalLine.slice('#HttpOnly_'.length)
      : originalLine;
    if (!line || line.startsWith('#')) continue;

    const fields = line.split('\t');
    if (fields.length < 7) continue;

    const [domain, includeSubdomains, cookiePath, , expiresAt, name, ...valueParts] = fields;
    if (!isYouTubeCookieDomain(domain, includeSubdomains.toUpperCase() === 'TRUE')) continue;
    if (!cookiePathMatches('/youtubei/v1/player', cookiePath)) continue;

    const expiry = Number(expiresAt);
    if (expiresAt !== '0' && Number.isFinite(expiry) && expiry <= nowSeconds) continue;

    const value = valueParts.join('\t');
    if (
      !COOKIE_NAME_PATTERN.test(name) ||
      value.length === 0 ||
      /[;\r\n]/.test(value)
    ) {
      continue;
    }
    cookies.set(name, value);
  }

  return cookies;
}

const youtubeCookies = parseYouTubeCookies(env.youtubeCookie);

function createYouTubeCookieAuthHeaders(): Record<string, string> | null {
  if (youtubeCookies.size === 0) return null;

  const authorization: string[] = [];
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const addAuthorization = (scheme: string, sapisid: string | undefined) => {
    if (!sapisid) return;
    const hash = createHash('sha1')
      .update(`${timestamp} ${sapisid} ${YOUTUBE_ORIGIN}`)
      .digest('hex');
    authorization.push(`${scheme} ${timestamp}_${hash}`);
  };

  addAuthorization(
    'SAPISIDHASH',
    youtubeCookies.get('SAPISID') ?? youtubeCookies.get('__Secure-3PAPISID')
  );
  addAuthorization('SAPISID1PHASH', youtubeCookies.get('__Secure-1PAPISID'));
  addAuthorization('SAPISID3PHASH', youtubeCookies.get('__Secure-3PAPISID'));
  if (authorization.length === 0) return null;

  const cookieHeader = [...youtubeCookies]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  return {
    Cookie: cookieHeader,
    Authorization: authorization.join(' '),
    'X-Origin': YOUTUBE_ORIGIN,
  };
}

// Vercel 서버리스 응답 본문 제한(4.5MB)을 넘지 않도록 여유를 둔 상한.
export const MAX_YOUTUBE_AUDIO_BYTES = 3_800_000;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// 화질(음질) 선호 순서: m4a(AAC)를 우선해 브라우저 decodeAudioData 호환성을 높인다.
const AUDIO_FORMAT_PREFERENCE = [140, 139, 251, 250, 249];

export interface YouTubeAudioFormat {
  itag: number;
  mimeType: string;
  bitrate: number;
  contentLength: number | null;
  approxDurationMs: number | null;
  url: string;
}

export interface SelectedYouTubeAudioFormat {
  format: YouTubeAudioFormat;
  totalBytes: number;
  truncated: boolean;
}

export interface YouTubeAudioResult {
  videoId: string;
  title: string;
  durationSeconds: number;
  itag: number;
  mimeType: string;
  extension: 'm4a' | 'webm';
  data: Uint8Array;
  totalBytes: number;
  truncated: boolean;
  audioSeconds: number;
  filename: string;
}

export class YouTubeAudioError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status = 502, retryable = false) {
    super(message);
    this.name = 'YouTubeAudioError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

interface InnerTubeFormat {
  itag?: number;
  mimeType?: string;
  bitrate?: number;
  averageBitrate?: number;
  contentLength?: string;
  approxDurationMs?: string;
  url?: string;
  signatureCipher?: string;
}

interface InnerTubePlayerResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  videoDetails?: {
    videoId?: string;
    title?: string;
    lengthSeconds?: string;
    isLive?: boolean;
  };
  streamingData?: {
    adaptiveFormats?: InnerTubeFormat[];
  };
}

interface VisitorIdResponse {
  responseContext?: {
    visitorData?: string;
  };
}

interface VisitorDataCacheEntry {
  value: string;
  expiresAt: number;
}

interface VisitorDataRequest {
  generation: number;
  refreshed: boolean;
  promise: Promise<string | null>;
}

let visitorDataCache: VisitorDataCacheEntry | null = null;
// 오래 걸린 이전 요청이 갱신 토큰을 덮어쓰지 않도록 세대를 구분한다.
let visitorDataGeneration = 0;
let visitorDataRequest: VisitorDataRequest | null = null;

/** 테스트에서 캐시를 초기화할 때 사용한다. */
export function resetYouTubeVisitorDataCache(): void {
  visitorDataGeneration += 1;
  visitorDataCache = null;
  visitorDataRequest = null;
}

/** 유튜브 URL, 공유 링크, 11자리 영상 키에서 videoId를 추출한다. */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 11자리 영상 키 그대로 입력한 경우
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

  // /shorts/{id}, /embed/{id}, /live/{id}, /v/{id}
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const [kind, id] = parts;
    if (['shorts', 'embed', 'live', 'v'].includes(kind) && VIDEO_ID_PATTERN.test(id)) {
      return id;
    }
  }

  return null;
}

function normalizeAudioFormats(formats: InnerTubeFormat[]): YouTubeAudioFormat[] {
  const normalized: YouTubeAudioFormat[] = [];

  for (const format of formats) {
    if (typeof format.itag !== 'number') continue;
    if (typeof format.url !== 'string' || !format.url) continue;
    if (typeof format.mimeType !== 'string' || !format.mimeType.startsWith('audio/')) continue;

    const contentLength = Number(format.contentLength);
    const approxDurationMs = Number(format.approxDurationMs);
    const bitrate = Number(format.averageBitrate ?? format.bitrate);

    normalized.push({
      itag: format.itag,
      mimeType: format.mimeType,
      bitrate: Number.isFinite(bitrate) && bitrate > 0 ? bitrate : 0,
      contentLength: Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null,
      approxDurationMs:
        Number.isFinite(approxDurationMs) && approxDurationMs > 0 ? approxDurationMs : null,
      url: format.url,
    });
  }

  return normalized;
}

function formatRank(format: YouTubeAudioFormat): number {
  const index = AUDIO_FORMAT_PREFERENCE.indexOf(format.itag);
  if (index >= 0) return index;
  if (format.mimeType.startsWith('audio/mp4')) return AUDIO_FORMAT_PREFERENCE.length;
  if (format.mimeType.startsWith('audio/webm')) return AUDIO_FORMAT_PREFERENCE.length + 1;
  return AUDIO_FORMAT_PREFERENCE.length + 2;
}

function estimateFormatBytes(format: YouTubeAudioFormat): number | null {
  if (format.contentLength) return format.contentLength;
  if (format.bitrate > 0 && format.approxDurationMs) {
    return Math.round((format.bitrate * format.approxDurationMs) / 8 / 1000);
  }
  return null;
}

/**
 * 용량 상한 안에서 가장 좋은 음질의 포맷을 고른다.
 * 어떤 포맷도 상한을 넘지 않으면 가장 작은 포맷을 선택하고 앞부분만 잘라 쓴다.
 */
export function selectYouTubeAudioFormat(
  formats: YouTubeAudioFormat[],
  maxBytes = MAX_YOUTUBE_AUDIO_BYTES
): SelectedYouTubeAudioFormat | null {
  const candidates = formats
    .map((format) => ({ format, size: estimateFormatBytes(format) }))
    .filter(
      (candidate): candidate is { format: YouTubeAudioFormat; size: number } =>
        candidate.size !== null && candidate.size > 0
    );

  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((a, b) => {
    const rankDiff = formatRank(a.format) - formatRank(b.format);
    if (rankDiff !== 0) return rankDiff;
    return (b.format.bitrate || 0) - (a.format.bitrate || 0);
  });

  const fitting = ranked.find((candidate) => candidate.size <= maxBytes);
  if (fitting) {
    return {
      format: fitting.format,
      totalBytes: fitting.size,
      truncated: false,
    };
  }

  const smallest = [...candidates].sort((a, b) => a.size - b.size)[0];
  return {
    format: smallest.format,
    totalBytes: smallest.size,
    truncated: true,
  };
}

const BOT_CHECK_REASON_PATTERN = /not a bot|bot check|봇이 아님|봇인지|로봇/i;

/** YouTube의 봇 확인 응답인지 판별한다. */
export function isYouTubeBotCheck(reason?: string | null): boolean {
  return BOT_CHECK_REASON_PATTERN.test(reason ?? '');
}

/**
 * YouTube가 발급하는 visitorData를 가져온다.
 * 봇 체크가 발생하면 forceRefresh=true로 새 세션 토큰을 발급받는다.
 */
async function fetchVisitorData(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    if (visitorDataRequest?.refreshed) return visitorDataRequest.promise;
    visitorDataCache = null;
    visitorDataGeneration += 1;
  } else {
    if (visitorDataCache && visitorDataCache.expiresAt > Date.now()) {
      return visitorDataCache.value;
    }
    if (visitorDataRequest) return visitorDataRequest.promise;
  }

  const generation = visitorDataGeneration;
  const request = (async () => {
    try {
      const response = await fetch(VISITOR_ID_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': YOUTUBE_UA,
          Origin: 'https://www.youtube.com',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: VISITOR_ID_CLIENT_VERSION,
              hl: 'en',
            },
          },
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) return null;

      const json = (await response.json()) as VisitorIdResponse;
      const visitorData = json.responseContext?.visitorData;
      if (typeof visitorData !== 'string' || !visitorData) return null;

      if (generation === visitorDataGeneration) {
        visitorDataCache = {
          value: visitorData,
          expiresAt: Date.now() + VISITOR_DATA_TTL_MS,
        };
      }
      return visitorData;
    } catch {
      // visitorData 없이도 시도할 수 있으므로 실패는 치명적이지 않다.
      return null;
    } finally {
      if (visitorDataRequest?.generation === generation) visitorDataRequest = null;
    }
  })();

  visitorDataRequest = { generation, refreshed: forceRefresh, promise: request };
  return request;
}

async function requestPlayer(
  videoId: string,
  visitorData: string | null,
  useCookieAuth = false,
  cookieClientIndex = 0
): Promise<InnerTubePlayerResponse> {
  const cookieAuthHeaders = useCookieAuth ? createYouTubeCookieAuthHeaders() : null;
  if (useCookieAuth && !cookieAuthHeaders) {
    throw new YouTubeAudioError(
      'YOUTUBE_COOKIE_INVALID',
      'YOUTUBE_COOKIE에 로그인된 YouTube의 cookies.txt 전체 내용이나 Cookie 요청 헤더를 설정해 주세요. Set-Cookie 응답 헤더는 사용할 수 없어요.',
      500
    );
  }

  const cookieClient = YOUTUBE_COOKIE_CLIENTS[cookieClientIndex] ?? YOUTUBE_COOKIE_CLIENTS[0];
  const client = useCookieAuth ? cookieClient : VISIONOS_PLAYER_CLIENT;

  let response: Response;
  try {
    response = await fetch(PLAYER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': client.userAgent,
        'X-Youtube-Client-Name': client.id,
        'X-Youtube-Client-Version': client.version,
        Origin: 'https://www.youtube.com',
        ...(cookieAuthHeaders ?? {}),
        ...(!useCookieAuth && visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: client.name,
            clientVersion: client.version,
            userAgent: client.userAgent,
            ...client.clientContext,
            // 국가 코드(gl)는 게이트웨이 egress IP에 맞기고, 제목 언어만 한국어로 고정한다.
            hl: 'ko',
            ...(!useCookieAuth && visitorData ? { visitorData } : {}),
          },
          ...(useCookieAuth && cookieClient.embedUrl
            ? { thirdParty: { embedUrl: cookieClient.embedUrl } }
            : {}),
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.warn('[YouTube] Player request failed', {
      videoId,
      client: client.name,
      cookieAuth: useCookieAuth,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new YouTubeAudioError(
      'YOUTUBE_PLAYER_UNREACHABLE',
      `YouTube 플레이어 요청에 실패했어요: ${error instanceof Error ? error.message : String(error)}`,
      502,
      true
    );
  }

  if (!response.ok) {
    console.warn('[YouTube] Player returned non-OK HTTP status', {
      videoId,
      client: client.name,
      cookieAuth: useCookieAuth,
      httpStatus: response.status,
    });
    if (useCookieAuth && response.status === 400) {
      throw new YouTubeAudioError(
        'YOUTUBE_COOKIE_AUTH_REJECTED',
        'YouTube가 쿠키 인증 요청을 거절했어요. 로그인된 계정에서 새 cookies.txt 전체 내용을 내보내 YOUTUBE_COOKIE에 설정했는지 확인해 주세요. Set-Cookie 응답 헤더는 사용할 수 없어요.',
        502
      );
    }
    throw new YouTubeAudioError(
      'YOUTUBE_PLAYER_FAILED',
      `YouTube 플레이어가 HTTP ${response.status}로 응답했어요.`,
      502,
      response.status >= 500
    );
  }

  try {
    return (await response.json()) as InnerTubePlayerResponse;
  } catch {
    throw new YouTubeAudioError(
      'YOUTUBE_PLAYER_INVALID_RESPONSE',
      'YouTube 플레이어 응답을 해석하지 못했어요.',
      502,
      true
    );
  }
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
      // 이미 완료된 스트림 취소 실패는 무시
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

async function downloadAudioFormat(
  format: YouTubeAudioFormat,
  maxBytes: number
): Promise<{ data: Uint8Array; hitCap: boolean }> {
  let response: Response;
  try {
    response = await fetch(format.url, {
      headers: {
        Range: `bytes=0-${maxBytes - 1}`,
        'User-Agent': YOUTUBE_UA,
        Origin: 'https://www.youtube.com',
        Referer: 'https://www.youtube.com/',
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new YouTubeAudioError(
      'YOUTUBE_AUDIO_UNREACHABLE',
      `오디오 스트림 다운로드에 실패했어요: ${error instanceof Error ? error.message : String(error)}`,
      502,
      true
    );
  }

  if (!response.ok) {
    const retryable = [403, 404, 410].includes(response.status) || response.status >= 500;
    throw new YouTubeAudioError(
      'YOUTUBE_AUDIO_FETCH_FAILED',
      `오디오 스트림이 HTTP ${response.status}로 응답했어요.`,
      502,
      retryable
    );
  }

  const data = await readResponseCapped(response, maxBytes);
  if (data.byteLength === 0) {
    throw new YouTubeAudioError('YOUTUBE_AUDIO_EMPTY', '오디오 스트림이 비어 있어요.', 502, true);
  }

  return { data, hitCap: data.byteLength >= maxBytes };
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

/**
 * YouTube 영상의 오디오를 추출해 최대 maxBytes 크기의 바이너리로 반환한다.
 * 일부만 내려받은 경우 truncated=true 이며 audioSeconds는 실제 사용 가능한 길이 추정치다.
 */
export async function fetchYouTubeAudio(
  input: string,
  options: { maxBytes?: number } = {}
): Promise<YouTubeAudioResult> {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) {
    throw new YouTubeAudioError(
      'INVALID_YOUTUBE_URL',
      '유튜브 주소나 11자리 영상 키를 정확히 입력해 주세요.',
      400
    );
  }

  const maxBytes = options.maxBytes ?? MAX_YOUTUBE_AUDIO_BYTES;
  let lastError: YouTubeAudioError | null = null;

  // 봇 체크 시 visitorData를 새로 발급받아 1회 재시도한다.
  // googlevideo URL은 IP/시간에 묶여 만료될 수 있으므로 다운로드 실패도 1회 재시도한다.
  let visitorData = await fetchVisitorData();
  let botCheckRetried = false;
  let cookieAuthRetried = false;
  let useCookieAuth = false;
  let cookieClientIndex = 0;
  let downloadAttempt = 0;

  while (downloadAttempt < 2) {
    const currentPlayerClient = useCookieAuth
      ? YOUTUBE_COOKIE_CLIENTS[cookieClientIndex] ?? YOUTUBE_COOKIE_CLIENTS[0]
      : VISIONOS_PLAYER_CLIENT;
    let player: InnerTubePlayerResponse;
    try {
      player = await requestPlayer(videoId, visitorData, useCookieAuth, cookieClientIndex);
    } catch (error) {
      if (
        useCookieAuth &&
        error instanceof YouTubeAudioError &&
        error.code === 'YOUTUBE_COOKIE_AUTH_REJECTED' &&
        cookieClientIndex < YOUTUBE_COOKIE_CLIENTS.length - 1
      ) {
        cookieClientIndex += 1;
        continue;
      }
      throw error;
    }

    const playability = player.playabilityStatus;
    if (playability?.status && playability.status !== 'OK') {
      console.warn('[YouTube] Player rejected video', {
        videoId,
        client: currentPlayerClient.name,
        cookieAuth: useCookieAuth,
        cookieConfigured: Boolean(env.youtubeCookie.trim()),
        playabilityStatus: playability.status,
        reason: playability.reason ?? null,
      });
      if (isYouTubeBotCheck(playability.reason)) {
        if (!useCookieAuth && !botCheckRetried) {
          botCheckRetried = true;
          visitorData = await fetchVisitorData(true);
          continue;
        }
        if (!cookieAuthRetried && env.youtubeCookie.trim()) {
          cookieAuthRetried = true;
          useCookieAuth = true;
          continue;
        }
        if (useCookieAuth && cookieClientIndex < YOUTUBE_COOKIE_CLIENTS.length - 1) {
          cookieClientIndex += 1;
          continue;
        }
        if (useCookieAuth) {
          throw new YouTubeAudioError(
            'YOUTUBE_COOKIE_BOT_CHECK',
            'YouTube가 쿠키 인증 후에도 로그인하여 봇 확인을 요구했어요. YOUTUBE_COOKIE가 만료되지 않은 로그인 쿠키인지 확인해 주세요. 유효한 최신 쿠키도 같은 응답이면 서버 IP 제한일 수 있어요. 음악 파일을 직접 업로드할 수도 있어요.',
            422
          );
        }
        throw new YouTubeAudioError(
          'YOUTUBE_BOT_CHECK',
          'visitorData 재시도 후에도 YouTube가 서버 IP를 봇으로 차단했어요. 게이트웨이 Vercel 환경에 YOUTUBE_COOKIE가 설정되어 있는지 확인하거나 음악 파일을 직접 업로드해 주세요.',
          422
        );
      }
      if (!cookieAuthRetried && env.youtubeCookie.trim()) {
        cookieAuthRetried = true;
        useCookieAuth = true;
        continue;
      }
      if (useCookieAuth && cookieClientIndex < YOUTUBE_COOKIE_CLIENTS.length - 1) {
        cookieClientIndex += 1;
        continue;
      }
      throw new YouTubeAudioError(
        'YOUTUBE_VIDEO_UNAVAILABLE',
        `YouTube가 ${currentPlayerClient.name} 플레이어에서 이 영상을 재생할 수 없다고 응답했어요 (${playability.reason || playability.status}).`,
        422
      );
    }

    const video = player.videoDetails;
    if (video?.isLive) {
      throw new YouTubeAudioError(
        'YOUTUBE_LIVE_STREAM',
        '실시간 라이브 영상에서는 배경음악을 추출할 수 없어요.',
        422
      );
    }

    const rawFormats = player.streamingData?.adaptiveFormats ?? [];
    const audioFormats = normalizeAudioFormats(rawFormats);
    const selected = selectYouTubeAudioFormat(audioFormats, maxBytes);

    if (!selected) {
      if (useCookieAuth && cookieClientIndex < YOUTUBE_COOKIE_CLIENTS.length - 1) {
        cookieClientIndex += 1;
        continue;
      }
      const hasCipheredAudio = rawFormats.some(
        (format) =>
          typeof format.mimeType === 'string' &&
          format.mimeType.startsWith('audio/') &&
          typeof format.signatureCipher === 'string'
      );
      throw new YouTubeAudioError(
        'YOUTUBE_AUDIO_NOT_FOUND',
        hasCipheredAudio
          ? 'YouTube가 이 영상의 직접 오디오 주소를 제공하지 않았어요. 음악 파일을 직접 업로드해 주세요.'
          : '이 영상에서 오디오 스트림을 찾지 못했어요. 음악 파일을 직접 업로드해 주세요.',
        422
      );
    }

    try {
      const { data, hitCap } = await downloadAudioFormat(selected.format, maxBytes);

      const declaredTotal = estimateFormatBytes(selected.format) ?? selected.totalBytes;
      const totalBytes = declaredTotal > 0 ? declaredTotal : data.byteLength;
      const truncated = totalBytes > data.byteLength || (hitCap && !selected.format.contentLength);

      const formatSeconds = selected.format.approxDurationMs
        ? selected.format.approxDurationMs / 1000
        : Number(video?.lengthSeconds) || 0;
      const videoSeconds = Number(video?.lengthSeconds) || 0;
      const durationSeconds = videoSeconds > 0 ? videoSeconds : Math.round(formatSeconds);

      let audioSeconds = formatSeconds > 0 ? formatSeconds : durationSeconds;
      if (truncated) {
        if (totalBytes > 0 && formatSeconds > 0) {
          audioSeconds = (data.byteLength / totalBytes) * formatSeconds;
        } else if (selected.format.bitrate > 0) {
          audioSeconds = (data.byteLength * 8) / selected.format.bitrate;
        }
      }
      if (durationSeconds > 0) {
        audioSeconds = Math.min(audioSeconds, durationSeconds);
      }
      audioSeconds = Math.max(0, Math.round(audioSeconds * 10) / 10);

      const mimeType = selected.format.mimeType.split(';')[0]?.trim() || 'audio/mp4';
      const extension: 'm4a' | 'webm' = mimeType.includes('webm') ? 'webm' : 'm4a';
      const title = video?.title?.trim() || `YouTube 오디오 (${videoId})`;

      return {
        videoId,
        title,
        durationSeconds,
        itag: selected.format.itag,
        mimeType,
        extension,
        data,
        totalBytes,
        truncated,
        audioSeconds,
        filename: sanitizeFilename(title, videoId, extension),
      };
    } catch (error) {
      if (!(error instanceof YouTubeAudioError)) throw error;
      lastError = error;
      downloadAttempt += 1;
      if (!error.retryable || downloadAttempt >= 2) throw error;
    }
  }

  throw (
    lastError ??
    new YouTubeAudioError('YOUTUBE_AUDIO_FETCH_FAILED', '오디오를 추출하지 못했어요.', 502)
  );
}
