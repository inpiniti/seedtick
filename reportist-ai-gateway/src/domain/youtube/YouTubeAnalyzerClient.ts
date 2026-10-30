import { env } from '../../config/env.ts';
import { YouTubeAudioError, type YouTubeAudioResult } from './YouTubeAudioService.ts';

const MAX_YOUTUBE_AUDIO_BYTES = 3_800_000;

function decodeHeaderValue(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function positiveNumber(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function readAudioBody(response: Response): Promise<Uint8Array> {
  if (positiveNumber(response.headers.get('content-length')) > MAX_YOUTUBE_AUDIO_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new YouTubeAudioError(
      'YOUTUBE_ANALYZER_RESPONSE_TOO_LARGE',
      'Analyzer가 반환한 오디오가 허용 크기를 넘었어요.',
      502
    );
  }
  if (!response.body) {
    throw new YouTubeAudioError('YOUTUBE_AUDIO_EMPTY', 'Analyzer가 빈 오디오를 반환했어요.', 502, true);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (totalBytes + value.byteLength > MAX_YOUTUBE_AUDIO_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new YouTubeAudioError(
          'YOUTUBE_ANALYZER_RESPONSE_TOO_LARGE',
          'Analyzer가 반환한 오디오가 허용 크기를 넘었어요.',
          502
        );
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const data = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

async function readWorkerError(response: Response): Promise<YouTubeAudioError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    if (body.error?.code && body.error.message) {
      return new YouTubeAudioError(
        body.error.code,
        body.error.message,
        response.status,
        response.status >= 500
      );
    }
  } catch {
    // Use a generic message when the worker does not return the expected JSON shape.
  }

  return new YouTubeAudioError(
    'YOUTUBE_ANALYZER_FAILED',
    'Analyzer 오디오 작업자가 요청을 처리하지 못했어요.',
    response.status >= 400 ? response.status : 502,
    response.status >= 500
  );
}

/** Fetches audio from the Analyzer service so YouTube sees its outbound IP. */
export async function fetchYouTubeAudioFromAnalyzer(input: string): Promise<YouTubeAudioResult> {
  if (!env.youtubeAnalyzerUrl || !env.youtubeAnalyzerSecret) {
    throw new YouTubeAudioError(
      'YOUTUBE_ANALYZER_NOT_CONFIGURED',
      'YouTube Analyzer 작업자 주소와 인증 키가 설정되지 않았어요.',
      503
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL('/internal/youtube/audio', env.youtubeAnalyzerUrl);
  } catch {
    throw new YouTubeAudioError(
      'YOUTUBE_ANALYZER_URL_INVALID',
      'YouTube Analyzer 작업자 주소가 올바르지 않아요.',
      503
    );
  }
  endpoint.searchParams.set('url', input);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${env.youtubeAnalyzerSecret}` },
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new YouTubeAudioError(
      timedOut ? 'YOUTUBE_ANALYZER_TIMEOUT' : 'YOUTUBE_ANALYZER_UNREACHABLE',
      timedOut
        ? 'Analyzer 작업자가 응답하는 데 시간이 너무 오래 걸렸어요.'
        : 'Analyzer 작업자에 연결하지 못했어요.',
      timedOut ? 504 : 502,
      true
    );
  }

  if (!response.ok) throw await readWorkerError(response);

  const data = await readAudioBody(response);
  if (data.byteLength === 0) {
    throw new YouTubeAudioError('YOUTUBE_AUDIO_EMPTY', 'Analyzer가 빈 오디오를 반환했어요.', 502, true);
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mp4';
  const extension: 'm4a' | 'webm' = mimeType.includes('webm') ? 'webm' : 'm4a';
  const videoId = response.headers.get('x-youtube-video-id') ?? '';
  const title = decodeHeaderValue(response.headers.get('x-youtube-title')) || `YouTube 오디오 (${videoId})`;
  const filename =
    decodeHeaderValue(response.headers.get('x-youtube-filename')) || `youtube-${videoId}.${extension}`;
  const parsedItag = Number.parseInt(response.headers.get('x-youtube-itag') ?? '', 10);

  return {
    videoId,
    title,
    durationSeconds: positiveNumber(response.headers.get('x-youtube-duration')),
    itag: Number.isFinite(parsedItag) ? parsedItag : 0,
    mimeType,
    extension,
    data,
    totalBytes: positiveNumber(response.headers.get('x-youtube-total-bytes')) || data.byteLength,
    truncated: response.headers.get('x-youtube-truncated') === '1',
    audioSeconds:
      positiveNumber(response.headers.get('x-youtube-audio-seconds')) ||
      positiveNumber(response.headers.get('x-youtube-duration')),
    filename,
  };
}
