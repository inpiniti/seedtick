import type { ExportResolution, HighlightSegment, PortraitPlatform, VideoOrientation, VideoOverlayOptions, VideoProcessingStatus } from './video.ts';
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
  rotation?: number; // 사용자가 지정한 원본 회전 각도 (0, 90, 180, 270도)
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
  orientation?: VideoOrientation;
  portraitPlatform?: PortraitPlatform;
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
  /** 출력 방향 (없으면 'landscape' - 기존 프로젝트 호환) */
  orientation?: VideoOrientation;
  /** 세로 프로젝트 플랫폼 프리셋 (없으면 'instagram') */
  portraitPlatform?: PortraitPlatform;
  storageMode?: 'auto' | 'full' | 'lightweight';
  hasOpfsFiles?: boolean;
  /** 프로젝트가 기기에 저장된 미디어 총 바이트 (표시용) */
  mediaBytes?: number;
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
  /** 프로젝트가 기기에 저장된 미디어 총 바이트 (표시용) */
  mediaBytes?: number;
}