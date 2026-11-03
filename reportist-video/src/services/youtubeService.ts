// src/services/youtubeService.ts - YouTube Metadata, Thumbnail & Statistics Utilities

/**
 * 유튜브 URL 또는 ID 문자열에서 순수 11자리 Video ID를 추출합니다.
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. 순수 11자리 Video ID (영문 대소문자, 숫자, -, _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. 다양한 유튜브 URL 패턴 파싱 (watch, shorts, embed, youtu.be 등)
  const regex =
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = trimmed.match(regex);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * 유튜브 고화질 썸네일 이미지 주소를 반환합니다. (구글 API 키 불필요)
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: 'hq' | 'maxres' = 'hq'
): string {
  if (quality === 'maxres') {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * YouTube 공식 oEmbed API를 통해 비디오 제목 및 채널/작성자명을 가져옵니다. (구글 API 키 불필요)
 */
export async function fetchYouTubeMeta(videoId: string): Promise<{
  title: string;
  authorName: string;
  thumbnailUrl: string;
} | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      console.warn('[YouTubeService] oEmbed response not ok:', res.status);
      return null;
    }
    const data = await res.json();
    return {
      title: data.title || '',
      authorName: data.author_name || 'Reportist Creator',
      thumbnailUrl: data.thumbnail_url || getYouTubeThumbnailUrl(videoId, 'hq'),
    };
  } catch (err) {
    console.warn('[YouTubeService] oEmbed fetch failed:', err);
    return null;
  }
}

/**
 * Google YouTube Data API v3를 통해 유튜브 서버의 실시간 조회수를 가져옵니다.
 * (VITE_YOUTUBE_API_KEY 환경변수가 설정되어 있을 때만 호출, 없을 경우 null 반환)
 */
export async function fetchYouTubeViewCount(videoId: string): Promise<number | null> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items?.[0];
    if (item?.statistics?.viewCount) {
      return parseInt(item.statistics.viewCount, 10);
    }
    return null;
  } catch (err) {
    console.warn('[YouTubeService] YouTube Data API view count fetch failed:', err);
    return null;
  }
}

/**
 * 유튜브 스타일 조회수 표기 포맷팅 (예: "조회수 1.2만회", "조회수 850회", "12K views")
 */
export function formatViewCount(views: number, locale = 'ko'): string {
  const count = Math.max(0, views || 0);

  if (locale === 'ko') {
    if (count >= 100000000) {
      const v = (count / 100000000).toFixed(1).replace(/\.0$/, '');
      return `조회수 ${v}억회`;
    }
    if (count >= 10000) {
      const v = (count / 10000).toFixed(1).replace(/\.0$/, '');
      return `조회수 ${v}만회`;
    }
    if (count >= 1000) {
      const v = (count / 1000).toFixed(1).replace(/\.0$/, '');
      return `조회수 ${v}천회`;
    }
    return `조회수 ${count.toLocaleString()}회`;
  }

  // English & other locales
  if (count >= 1000000) {
    const v = (count / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${v}M views`;
  }
  if (count >= 1000) {
    const v = (count / 1000).toFixed(1).replace(/\.0$/, '');
    return `${v}K views`;
  }
  return `${count} view${count === 1 ? '' : 's'}`;
}

/**
 * 유튜브 스타일 상대 시간 포맷팅 (예: "3시간 전", "2일 전", "1주 전")
 */
export function formatTimeAgo(dateInput: string | Date, locale = 'ko'): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) {
    return locale === 'ko' ? '방금 전' : 'just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return locale === 'ko' ? `${diffMin}분 전` : `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return locale === 'ko' ? `${diffHour}시간 전` : `${diffHour}h ago`;
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return locale === 'ko' ? `${diffDay}일 전` : `${diffDay}d ago`;
  }
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) {
    return locale === 'ko' ? `${diffWeek}주 전` : `${diffWeek}w ago`;
  }
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return locale === 'ko' ? `${diffMonth}개월 전` : `${diffMonth}mo ago`;
  }
  const diffYear = Math.floor(diffDay / 365);
  return locale === 'ko' ? `${diffYear}년 전` : `${diffYear}y ago`;
}
