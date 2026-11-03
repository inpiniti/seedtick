// src/types/share.ts - Types for YouTube Video Community Sharing

export interface VideoShareItem {
  id: string;
  youtubeVideoId: string;
  title: string;
  authorName: string;
  description?: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  durationSec?: number;
  createdAt: string;
}

export type VideoSortOrder = 'latest' | 'views';
