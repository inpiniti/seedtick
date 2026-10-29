// tests/youtube-audio.test.ts - YouTube URL 파싱 및 오디오 포맷 선택 테스트

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../src/app.ts';
import { env } from '../src/config/env.ts';
import {
  MAX_YOUTUBE_AUDIO_BYTES,
  type YouTubeAudioFormat,
  extractYouTubeVideoId,
  selectYouTubeAudioFormat,
} from '../src/domain/youtube/YouTubeAudioService.ts';

function makeFormat(
  itag: number,
  mimeType: string,
  contentLength: number | null,
  overrides: Partial<YouTubeAudioFormat> = {}
): YouTubeAudioFormat {
  return {
    itag,
    mimeType,
    bitrate: 128_000,
    contentLength,
    approxDurationMs: 240_000,
    url: `https://example.com/${itag}`,
    ...overrides,
  };
}

describe('extractYouTubeVideoId', () => {
  it('accepts a raw 11-character video id', () => {
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  });

  it('parses common YouTube URL shapes', () => {
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2',
      'https://youtu.be/dQw4w9WgXcQ?t=42',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/embed/dQw4w9WgXcQ',
      'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ',
    ];

    for (const url of urls) {
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
    }
  });

  it('rejects invalid ids, empty input, and non-YouTube hosts', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
    expect(extractYouTubeVideoId('dQw4w9WgXc')).toBeNull();
    expect(extractYouTubeVideoId('dQw4w9WgXcQQ')).toBeNull();
    expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(extractYouTubeVideoId('not a youtube url')).toBeNull();
  });
});

describe('selectYouTubeAudioFormat', () => {
  it('prefers m4a itag 140 when it fits under the cap', () => {
    const selected = selectYouTubeAudioFormat([
      makeFormat(139, 'audio/mp4; codecs="mp4a.40.5"', 1_300_000),
      makeFormat(140, 'audio/mp4; codecs="mp4a.40.2"', 3_400_000),
      makeFormat(251, 'audio/webm; codecs="opus"', 3_300_000, { bitrate: 160_000 }),
    ]);

    expect(selected?.format.itag).toBe(140);
    expect(selected?.truncated).toBe(false);
  });

  it('falls back to a smaller format instead of truncating when possible', () => {
    const selected = selectYouTubeAudioFormat(
      [
        makeFormat(140, 'audio/mp4; codecs="mp4a.40.2"', 3_400_000),
        makeFormat(139, 'audio/mp4; codecs="mp4a.40.5"', 1_300_000),
      ],
      2_000_000
    );

    expect(selected?.format.itag).toBe(139);
    expect(selected?.truncated).toBe(false);
    expect(selected?.totalBytes).toBe(1_300_000);
  });

  it('chooses the smallest format and marks truncation when none fit', () => {
    const selected = selectYouTubeAudioFormat(
      [
        makeFormat(251, 'audio/webm; codecs="opus"', 5_000_000),
        makeFormat(249, 'audio/webm; codecs="opus"', 4_500_000),
        makeFormat(139, 'audio/mp4; codecs="mp4a.40.5"', 4_000_000),
      ],
      MAX_YOUTUBE_AUDIO_BYTES
    );

    expect(selected?.format.itag).toBe(139);
    expect(selected?.truncated).toBe(true);
    expect(selected?.totalBytes).toBe(4_000_000);
  });

  it('estimates size from bitrate when contentLength is missing', () => {
    const selected = selectYouTubeAudioFormat(
      [
        makeFormat(140, 'audio/mp4; codecs="mp4a.40.2"', null, {
          bitrate: 128_000,
          approxDurationMs: 60_000,
        }),
      ],
      1_000_000
    );

    // 128kbps * 60s / 8 = 960,000 bytes
    expect(selected?.totalBytes).toBe(960_000);
    expect(selected?.truncated).toBe(false);
  });

  it('returns null when there are no usable formats', () => {
    expect(selectYouTubeAudioFormat([])).toBeNull();
    expect(
      selectYouTubeAudioFormat([
        makeFormat(140, 'audio/mp4', null, {
          bitrate: 0,
          approxDurationMs: null,
        }),
      ])
    ).toBeNull();
  });
});

describe('GET /v1/youtube/audio', () => {
  const originalSecret = env.gatewaySecret;

  beforeAll(() => {
    // bun test는 .env.local을 자동 로드하지 않으므로 인증 테스트용 시크릿을 주입한다.
    env.gatewaySecret = 'test-gateway-secret';
  });

  afterAll(() => {
    env.gatewaySecret = originalSecret;
  });

  const authHeaders = () => ({ Authorization: `Bearer ${env.gatewaySecret}` });

  it('requires a gateway secret', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/youtube/audio?url=dQw4w9WgXcQ')
    );

    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when the url parameter is missing', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/youtube/audio', { headers: authHeaders() })
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('YOUTUBE_URL_REQUIRED');
  });

  it('returns 400 for an invalid YouTube input without calling the network', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/youtube/audio?url=https%3A%2F%2Fvimeo.com%2F123', {
        headers: authHeaders(),
      })
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_YOUTUBE_URL');
  });
});
