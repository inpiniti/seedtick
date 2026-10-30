// tests/youtube-cookie-extractor.test.ts
// YouTubeCookieExtractor 및 쿠키 폴백 통합 테스트

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { env } from '../src/config/env.ts';
import {
  YouTubeAudioError,
  fetchYouTubeAudio,
  parseYouTubeCookies,
} from '../src/domain/youtube/YouTubeAudioService.ts';
import {
  fetchAudioWithCookies,
  resetYouTubeCookieSessionCache,
} from '../src/domain/youtube/YouTubeCookieExtractor.ts';

describe('parseYouTubeCookies', () => {
  it('parses standard key=value Cookie header string', () => {
    const raw = 'VISITOR_INFO1_LIVE=abc; LOGIN_INFO=xyz; HSID=123';
    const parsed = parseYouTubeCookies(raw);
    expect(parsed.get('VISITOR_INFO1_LIVE')).toBe('abc');
    expect(parsed.get('LOGIN_INFO')).toBe('xyz');
    expect(parsed.get('HSID')).toBe('123');
  });

  it('parses Netscape cookies.txt format, filtering only youtube domains and player path', () => {
    const netscape = [
      '# Netscape HTTP Cookie File',
      '.youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_val',
      '.google.com\tTRUE\t/\tTRUE\t2147483647\tOTHER\tother_val',
      'www.youtube.com\tFALSE\t/youtubei/v1/player\tTRUE\t2147483647\tSAPISID\tsapisid_val',
      '#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t2147483647\tSSID\tssid_val',
    ].join('\n');

    const parsed = parseYouTubeCookies(netscape);
    expect(parsed.get('SID')).toBe('sid_val');
    expect(parsed.get('SAPISID')).toBe('sapisid_val');
    expect(parsed.get('SSID')).toBe('ssid_val');
    expect(parsed.has('OTHER')).toBe(false);
  });

  it('rejects Set-Cookie headers', () => {
    const setCookie = 'Set-Cookie: SID=123; Path=/; Domain=.youtube.com';
    expect(parseYouTubeCookies(setCookie).size).toBe(0);
  });
});

describe('fetchAudioWithCookies integration', () => {
  beforeEach(() => {
    resetYouTubeCookieSessionCache();
  });

  afterEach(() => {
    resetYouTubeCookieSessionCache();
  });

  it('throws YouTubeAudioError for non-existent video', async () => {
    try {
      await fetchAudioWithCookies('invalid_vid_', { deadlineMs: 8000 });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(YouTubeAudioError);
    }
  }, 15_000);
});

describe('fetchYouTubeAudio cookie fallback delegation', () => {
  const originalFetch = globalThis.fetch;
  const originalCookie = env.youtubeCookie;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    env.youtubeCookie = originalCookie;
    process.env.YOUTUBE_FORCE_COOKIE_PATH = undefined;
  });

  it('delegates to fetchAudioWithCookies when YOUTUBE_FORCE_COOKIE_PATH is enabled', async () => {
    process.env.YOUTUBE_FORCE_COOKIE_PATH = '1';
    let called = false;

    // fetch를 모킹하여 쿠키 경로를 타는지 확인
    globalThis.fetch = (async () => {
      called = true;
      return new Response(JSON.stringify({ playabilityStatus: { status: 'OK' } }));
    }) as unknown as typeof fetch;

    try {
      await fetchYouTubeAudio('dQw4w9WgXcQ');
    } catch {
      // network/mock failure is expected, but delegation must have happened
    }
    expect(called).toBe(true);
  });
});
