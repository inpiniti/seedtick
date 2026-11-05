import type { HighlightSegment, VideoOverlayOptions } from './video.ts';
import type { ReasoningEffortOption } from './gateway.ts';

export interface StoredVideoItem {
  id: string;
  name: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  status: 'idle' | 'analyzing' | 'analyzed' | 'stitching' | 'done' | 'error';
  segments: HighlightSegment[];
  metadataDate?: string;
  recordedTimestamp?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  thumbnailUrl?: string;
  fileBlob?: Blob;
}

export interface StoredFinalResult {
  videoBlob?: Blob;
  duration: number;
  fileSize: number;
  width: number;
  height: number;
  segments: HighlightSegment[];
  suggestedTitle?: string;
  thumbnailUrl?: string;
  cleanThumbnailUrl?: string;
  bestThumbnailTime?: number;
  bestSourceVideoId?: string;
  bestThumbnailReason?: string;
  bestThumbnailCropOffsetYRatio?: number;
  bestThumbnailRotation?: number;
  bestThumbnailCleanDataUrl?: string;
  aiThumbnailRecommendations?: Array<{
    videoId: string;
    videoName: string;
    timestamp: number;
    reason?: string;
    cleanDataUrl?: string;
    cropOffsetYRatio?: number;
    rotation?: number;
  }>;
}

export interface StudioProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
  duration: number;
  videoCount: number;
  step: 'upload' | 'processing' | 'result';
  videos: StoredVideoItem[];
  finalResult?: StoredFinalResult | null;
  overlayOptions?: VideoOverlayOptions;
  bgmPresetId?: string;
  bgmVolume?: number;
  customAudioBlob?: Blob | null;
  customAudioName?: string;
  currentDateFormat?: string;
  showDate?: boolean;
  showAge?: boolean;
  birthDate?: string;
  selectedModel?: string;
  selectedEffort?: ReasoningEffortOption;
}

export interface StudioProjectSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
  duration: number;
  videoCount: number;
  hasResult: boolean;
  step: 'upload' | 'processing' | 'result';
}