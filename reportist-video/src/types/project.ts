import type { ExportResolution, HighlightSegment, VideoOverlayOptions, VideoProcessingStatus } from './video.ts';
import type { ReasoningEffortOption } from './gateway.ts';

export interface StoredVideoItem {
  id: string;
  name: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  status: VideoProcessingStatus;
  segments: HighlightSegment[];
  metadataDate?: string;
  recordedTimestamp?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  thumbnailUrl?: string;
  fileBlob?: Blob;
  hasOpfsFile?: boolean;
}

export interface StoredFinalResult {
  videoBlob?: Blob;
  duration: number;
  fileSize: number;
  width: number;
  height: number;
  resolution?: ExportResolution;
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
  selectedLibraryTrackId?: string | null;
  customAudioBlob?: Blob | null;
  customAudioName?: string;
  introVideoBlob?: Blob | null;
  introVideoName?: string;
  outroVideoBlob?: Blob | null;
  outroVideoName?: string;
  currentDateFormat?: string;
  showDate?: boolean;
  showAge?: boolean;
  birthDate?: string;
  selectedModel?: string;
  selectedEffort?: ReasoningEffortOption;
  exportResolution?: ExportResolution;
  storageMode?: 'auto' | 'full' | 'lightweight';
  hasOpfsFiles?: boolean;
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
  storageMode?: 'auto' | 'full' | 'lightweight';
  hasOpfsFiles?: boolean;
}