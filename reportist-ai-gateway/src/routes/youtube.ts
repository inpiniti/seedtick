// youtube.ts - GET /v1/youtube/audio?url=...
// YouTube 영상의 오디오를 추출해 브라우저로 중계한다.

import { Elysia, t } from 'elysia';
import { env } from '../config/env.ts';
import { fetchYouTubeAudioFromAnalyzer } from '../domain/youtube/YouTubeAnalyzerClient.ts';
import { YouTubeAudioError, fetchYouTubeAudio } from '../domain/youtube/YouTubeAudioService.ts';
import { verifyGatewayAuth } from '../middleware/auth.ts';

function toHeaderRecord(headers: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }
  return result;
}

export const youtubeRoute = new Elysia().onBeforeHandle(verifyGatewayAuth).get(
  '/v1/youtube/audio',
  async ({ query, set }) => {
    const input = (query.url ?? query.id ?? '').trim();

    if (!input) {
      set.status = 400;
      return {
        error: {
          code: 'YOUTUBE_URL_REQUIRED',
          message: 'url 또는 id 쿼리 파라미터가 필요해요.',
          type: 'youtube_error',
        },
      };
    }

    try {
      const audio = env.youtubeAnalyzerUrl
        ? await fetchYouTubeAudioFromAnalyzer(input)
        : await fetchYouTubeAudio(input);

      const headers = toHeaderRecord(set.headers);
      headers['content-type'] = audio.mimeType;
      headers['content-length'] = String(audio.data.byteLength);
      headers['cache-control'] = 'no-store';
      headers['content-disposition'] =
        `inline; filename*=UTF-8''${encodeURIComponent(audio.filename)}`;
      headers['x-youtube-video-id'] = audio.videoId;
      headers['x-youtube-title'] = encodeURIComponent(audio.title);
      headers['x-youtube-filename'] = encodeURIComponent(audio.filename);
      headers['x-youtube-duration'] = String(audio.durationSeconds);
      headers['x-youtube-itag'] = String(audio.itag);
      headers['x-youtube-total-bytes'] = String(audio.totalBytes);
      headers['x-youtube-audio-bytes'] = String(audio.data.byteLength);
      headers['x-youtube-audio-seconds'] = audio.audioSeconds.toFixed(1);
      headers['x-youtube-truncated'] = audio.truncated ? '1' : '0';
      headers['access-control-expose-headers'] = [
        'Content-Length',
        'Content-Type',
        'Content-Disposition',
        'X-Youtube-Video-Id',
        'X-Youtube-Title',
        'X-Youtube-Filename',
        'X-Youtube-Duration',
        'X-Youtube-Itag',
        'X-Youtube-Total-Bytes',
        'X-Youtube-Audio-Bytes',
        'X-Youtube-Audio-Seconds',
        'X-Youtube-Truncated',
      ].join(', ');

      return new Response(audio.data, { status: 200, headers });
    } catch (error) {
      if (error instanceof YouTubeAudioError) {
        set.status = error.status;
        return {
          error: {
            code: error.code,
            message: error.message,
            type: 'youtube_error',
          },
        };
      }

      console.error('[Gateway] YouTube audio extraction failed:', error);
      set.status = 502;
      return {
        error: {
          code: 'YOUTUBE_AUDIO_FAILED',
          message: '유튜브 오디오를 가져오지 못했어요. 음악 파일을 직접 업로드해 주세요.',
          type: 'youtube_error',
        },
      };
    }
  },
  {
    query: t.Object({
      url: t.Optional(t.String()),
      id: t.Optional(t.String()),
    }),
    detail: {
      summary: 'YouTube Audio Extraction',
      description:
        'YouTube URL 또는 11자리 videoId의 오디오를 추출해 오디오 바이너리와 메타데이터 헤더를 반환합니다.',
      tags: ['YouTube'],
    },
  }
);
