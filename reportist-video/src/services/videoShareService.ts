// src/services/videoShareService.ts - Video Community Data Service (Supabase with LocalStorage Fallback)

import { supabase } from './supabaseClient.ts';
import type { VideoShareItem, VideoSortOrder } from '../types/share.ts';
import { getYouTubeThumbnailUrl, fetchYouTubeViewCount } from './youtubeService.ts';

const LOCAL_STORAGE_KEY = 'reportist_shared_videos_v1';

// 초기 샘플 공유 영상 데이터 (테이블 생성 전에도 화면을 즉시 확인할 수 있도록 구성)
const SEED_VIDEOS: VideoShareItem[] = [
  {
    id: 'seed-1',
    youtubeVideoId: 'LXb3EKWsInQ',
    title: '4K 시네마틱 해변 드라이브 하이라이트 (Reportist AI)',
    authorName: '리포티스트 크리에이터',
    description: 'Reportist Video로 16:9 규격으로 자동 병합한 바다 드라이브 영상입니다.',
    thumbnailUrl: getYouTubeThumbnailUrl('LXb3EKWsInQ'),
    viewCount: 1420,
    likeCount: 48,
    durationSec: 42,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4시간 전
  },
  {
    id: 'seed-2',
    youtubeVideoId: 'kJQP7kiw5Fk',
    title: '도심 속 야경과 네온사인 AI 드라마틱 순간 모음',
    authorName: '도시탐험가 Studio',
    description: '여러 영상 클립에서 AI가 가장 역동적인 순간들만 골라 하나의 영상으로 제작했습니다.',
    thumbnailUrl: getYouTubeThumbnailUrl('kJQP7kiw5Fk'),
    viewCount: 8900,
    likeCount: 231,
    durationSec: 58,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2일 전
  },
  {
    id: 'seed-3',
    youtubeVideoId: 'fJ9rUzIMcZQ',
    title: '보헤미안 감성 여행 브이로그 하이라이트 16:9',
    authorName: 'Traveler Jane',
    description: '여행 영상 5개에서 AI가 얼굴과 감정이 살아있는 컷만 16:9로 완성해 주었습니다.',
    thumbnailUrl: getYouTubeThumbnailUrl('fJ9rUzIMcZQ'),
    viewCount: 15300,
    likeCount: 612,
    durationSec: 64,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5일 전
  },
];

function getLocalVideos(): VideoShareItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('[VideoShareService] LocalStorage read failed:', err);
  }
  return SEED_VIDEOS;
}

function saveLocalVideos(items: VideoShareItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('[VideoShareService] LocalStorage write failed:', err);
  }
}

/**
 * 공유된 영상 목록을 조회합니다.
 */
export async function fetchSharedVideos(
  sortOrder: VideoSortOrder = 'latest',
  searchQuery = ''
): Promise<{ items: VideoShareItem[]; isUsingFallback: boolean }> {
  // 1. Supabase 조회 시도
  if (supabase) {
    try {
      let query = supabase
        .from('video_shares')
        .select('*');

      if (sortOrder === 'views') {
        query = query.order('view_count', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(`title.ilike.%${q}%,author_name.ilike.%${q}%`);
      }

      const { data, error } = await query;

      if (!error && data) {
        let items: VideoShareItem[] = data.map((row) => ({
          id: row.id,
          youtubeVideoId: row.youtube_video_id,
          title: row.title,
          authorName: row.author_name,
          description: row.description || '',
          thumbnailUrl: row.thumbnail_url || getYouTubeThumbnailUrl(row.youtube_video_id),
          viewCount: Number(row.view_count || 0),
          likeCount: Number(row.like_count || 0),
          durationSec: row.duration_sec,
          createdAt: row.created_at,
        }));

        // DB에 아직 공유된 영상이 하나도 없으면 샘플 시드 영상들을 노출하여 빈 화면 방지
        if (items.length === 0 && !searchQuery.trim()) {
          items = SEED_VIDEOS;
        }

        // Google API Key가 제공된 경우 실시간 유튜브 공식 조회수 비동기 갱신 시도
        syncYouTubeOfficialViews(items).catch(() => {});

        return { items, isUsingFallback: false };
      }

      console.warn('[VideoShareService] Supabase query failed (likely table not created yet):', error?.message);
    } catch (err) {
      console.warn('[VideoShareService] Supabase fetch exception:', err);
    }
  }

  // 2. 로컬 스토리지 Fallback
  let localItems = getLocalVideos();

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    localItems = localItems.filter(
      (item) => item.title.toLowerCase().includes(q) || item.authorName.toLowerCase().includes(q)
    );
  }

  if (sortOrder === 'views') {
    localItems.sort((a, b) => b.viewCount - a.viewCount);
  } else {
    localItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return { items: localItems, isUsingFallback: true };
}

/**
 * 새로운 유튜브 영상을 공유 등록합니다.
 */
export async function createVideoShare(params: {
  youtubeVideoId: string;
  title: string;
  authorName: string;
  description?: string;
  thumbnailUrl?: string;
  durationSec?: number;
}): Promise<{ success: boolean; data?: VideoShareItem; error?: string; isFallback: boolean }> {
  const thumb = params.thumbnailUrl || getYouTubeThumbnailUrl(params.youtubeVideoId);

  // 1. Supabase 등록 시도
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('video_shares')
        .insert([
          {
            youtube_video_id: params.youtubeVideoId,
            title: params.title,
            author_name: params.authorName,
            description: params.description || '',
            thumbnail_url: thumb,
            view_count: 1,
            like_count: 0,
            duration_sec: params.durationSec || null,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        const item: VideoShareItem = {
          id: data.id,
          youtubeVideoId: data.youtube_video_id,
          title: data.title,
          authorName: data.author_name,
          description: data.description,
          thumbnailUrl: data.thumbnail_url,
          viewCount: Number(data.view_count || 1),
          likeCount: Number(data.like_count || 0),
          durationSec: data.duration_sec,
          createdAt: data.created_at,
        };
        return { success: true, data: item, isFallback: false };
      }
      console.warn('[VideoShareService] Supabase insert failed:', error?.message);
    } catch (err) {
      console.warn('[VideoShareService] Supabase insert error:', err);
    }
  }

  // 2. Fallback 로컬 저장소 등록
  const localItems = getLocalVideos();
  const newItem: VideoShareItem = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    youtubeVideoId: params.youtubeVideoId,
    title: params.title,
    authorName: params.authorName,
    description: params.description || '',
    thumbnailUrl: thumb,
    viewCount: 1,
    likeCount: 0,
    durationSec: params.durationSec,
    createdAt: new Date().toISOString(),
  };

  localItems.unshift(newItem);
  saveLocalVideos(localItems);

  return { success: true, data: newItem, isFallback: true };
}

/**
 * 영상 조회수 1 증가 (동영상 재생 시작 시 호출)
 */
export async function incrementVideoShareView(videoId: string): Promise<void> {
  // 1. Supabase RPC 또는 update 호출
  if (supabase) {
    try {
      // RPC 함수가 있으면 호출
      const { error: rpcError } = await supabase.rpc('increment_video_share_view', {
        target_video_id: videoId,
      });

      if (!rpcError) return;

      // RPC 미존재 시 직접 단일 UPDATE 시도
      const { data } = await supabase
        .from('video_shares')
        .select('view_count')
        .eq('id', videoId)
        .single();

      if (data) {
        await supabase
          .from('video_shares')
          .update({ view_count: Number(data.view_count || 0) + 1 })
          .eq('id', videoId);
      }
      return;
    } catch (err) {
      console.warn('[VideoShareService] Increment view failed on Supabase:', err);
    }
  }

  // 2. 로컬 저장소 업데이트
  const items = getLocalVideos();
  const target = items.find((i) => i.id === videoId);
  if (target) {
    target.viewCount = (target.viewCount || 0) + 1;
    saveLocalVideos(items);
  }
}

/**
 * Google YouTube Data API를 통해 공식 조회수가 있으면 화면에 동기화
 */
async function syncYouTubeOfficialViews(items: VideoShareItem[]) {
  for (const item of items) {
    const officialCount = await fetchYouTubeViewCount(item.youtubeVideoId);
    if (officialCount !== null && officialCount > item.viewCount) {
      item.viewCount = officialCount;
    }
  }
}
