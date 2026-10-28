// types/video.ts - 비디오 항목, 극적 구간, 처리 상태 타입 정의

export interface HighlightSegment {
  id: string;
  sourceVideoId: string;
  sourceVideoName: string;
  start: number; // 시작 초 (초 단위 실수)
  end: number;   // 종료 초 (초 단위 실수)
  duration: number; // 길이 (end - start)
  reason: string; // 하이라이트/극적 장면 선정 이유
  label?: string; // 챕터/자막 라벨 (커스텀 명칭)
  volume?: number; // 볼륨 배율 (0.0 ~ 1.5, 기본값 1.0)
  cropOffsetYRatio?: number; // 세로 영상 크롭 상단 편향 (0.0 ~ 1.0, 기본값 0.25)
}

export interface BgmPreset {
  id: string;
  name: string;
  mood: string;
  tempo: string;
  description: string;
}

export type VideoProcessingStatus = 
  | 'idle' 
  | 'compressing' 
  | 'analyzing' 
  | 'analyzed' 
  | 'cutting' 
  | 'done' 
  | 'error';

export interface VideoItem {
  id: string;
  file: File;
  url: string; // Blob URL
  name: string;
  sizeBytes: number;
  duration: number; // 초 단위
  width: number;
  height: number;
  thumbnailUrl?: string;
  status: VideoProcessingStatus;
  statusMessage?: string;
  segments: HighlightSegment[];
  error?: string;
}

export interface ExtractedFrame {
  timestamp: number; // 초 단위 (예: 1.5)
  dataUrl: string;   // data:image/jpeg;base64,...
}

export type OverallStep = 'upload' | 'processing' | 'result';

export interface ProcessingProgress {
  step: OverallStep;
  currentPhase: 'extract' | 'compress' | 'analyze' | 'stitch' | 'done' | 'error';
  currentVideoIndex: number;
  totalVideos: number;
  progressPercent: number;
  statusMessage: string;
  error?: string;
  reasoningLogs?: string[];
}

export interface FinalVideoResult {
  blob: Blob;
  url: string;
  duration: number;
  segments: HighlightSegment[];
  originalTotalDuration: number;
  fileSize: number;
}

export interface VideoOverlayOptions {
  showTitle: boolean;
  titleText: string;
  showChannel: boolean;
  channelText: string;
  showSubtitle: boolean;
  subtitleDateText: string;
  subtitleLocationText: string;
  showIntro: boolean;
  showOutro: boolean;
}

export interface CustomAudioTrack {
  file: File;
  url: string;
  name: string;
  duration: number;
}
