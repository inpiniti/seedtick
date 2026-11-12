// types/video.ts - 비디오 항목, 극적 구간, 처리 상태 타입 정의

export type SubtitleTone = 'vlog' | 'shorts' | 'natural' | 'minimal';

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
  // 씬별 자막 및 위치 속성
  subtitleDate?: string;    // 씬 촬영 날짜 (예: '9월 10일')
  subtitleTitle?: string;   // 씬 제목/자막 문구 (AI 추천 또는 사용자 입력)
  locationName?: string;    // 씬 위치 명칭 (예: '해운대 해수욕장')
  latitude?: number;        // GPS 위도
  longitude?: number;       // GPS 경도
  recordedTimestamp?: number; // 씬 실제 촬영 시각 타임스탬프 (ms, 시분초 포함)
  rotation?: number;        // 씬 영상 회전 각도 (0, 90, 180, 270도)
  skipChapterBridge?: boolean; // 이 세그먼트 앞의 챕터 브릿지 건너뛰기
  bridgeDateTemplateOverride?: BridgeDateTemplateId; // 개별 날짜 브릿지 템플릿 오버라이드
  bridgeLocationTemplateOverride?: BridgeLocationTemplateId; // 개별 장소 브릿지 템플릿 오버라이드
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
  metadataDate?: string; // e.g. "2026.11.03"
  recordedTimestamp?: number; // e.g. 1793710800000 (ms)
  latitude?: number;
  longitude?: number;
  locationName?: string; // e.g. "어린이대공원"
  isMissingFile?: boolean; // 로컬 원본 비디오 파일 재연결 필요 여부
  compressionInfo?: {
    codec: string;
    sizeRatio: number;
  };
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
  // 영상 병합 단계 자체의 세부 진행률 (0~100)
  stitchProgressPercent?: number;
  statusMessage: string;
  error?: string;
  reasoningLogs?: string[];
  // 자체 인메모리 큐(Worker) 대기열 관련 상태
  isQueued?: boolean;
  queuePosition?: number;
  estimatedWaitSec?: number;
  jobId?: string;
  // AI 모델의 실시간 스트리밍 추론/응답 (콘솔에 생생하게 표시)
  liveReasoning?: string;
  liveContent?: string;
}

export type ExportResolution = '720p' | '1080p';

export interface FinalVideoResult {
  blob: Blob;
  url: string;
  duration: number;
  width?: number; // 1280 or 1920
  height?: number; // 720 or 1080
  resolution?: ExportResolution; // '720p' | '1080p'
  introDuration?: number; // 시작 인트로 실제 재생 시간 (초)
  outroDuration?: number; // 마무리 아웃트로 실제 재생 시간 (초)
  bridgeDurationMap?: Record<string, number>; // 각 세그먼트(id) 직전에 삽입된 챕터 브릿지 길이 (초)
  segments: HighlightSegment[];
  originalTotalDuration: number;
  fileSize: number;
  thumbnailUrl?: string; // 16:9 규격 완성 썸네일 이미지 URL
  cleanThumbnailUrl?: string; // 오버레이 및 문구 일체 없는 순수 고화질 배경 이미지 URL
  suggestedTitle?: string; // AI가 영상 내용을 기반으로 추천한 타이틀
  bestThumbnailTime?: number; // 썸네일에 사용된 최적의 시각(초)
  bestSourceVideoId?: string; // 썸네일에 사용된 원본 비디오 ID
  bestThumbnailReason?: string; // AI가 이 프레임을 썸네일로 추천한 이유
  bestThumbnailCropOffsetYRatio?: number;
  bestThumbnailRotation?: number;
  bestThumbnailCleanDataUrl?: string; // AI 키프레임 기반 클린 이미지 Data URL
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

export interface VideoOverlayOptions {
  showTitle: boolean;
  titleText: string;
  showChannel: boolean;
  channelText: string;
  showSubtitle: boolean;
  showDate?: boolean; // 촬영 날짜 표시 여부 (기본 true)
  subtitleDateText?: string;
  subtitleLocationText?: string;
  showIntro: boolean;
  showOutro: boolean;
  outroText?: string;
  introVideoFile?: File | null; // 사용자 직접 삽입 인트로 영상 파일
  outroVideoFile?: File | null; // 사용자 직접 삽입 아웃트로 영상 파일
  introTemplate?: IntroTemplateId; // HyperFrames 인트로 모션 템플릿 (기본: 'kinetic-slide')
  outroTemplate?: OutroTemplateId; // HyperFrames 아웃트로 모션 템플릿 (기본: 'modern-endcard')
  introDurationSec?: number; // 인트로 모션 재생 길이(초) (기본: 2.0초)
  outroDurationSec?: number; // 아웃트로 모션 재생 길이(초) (기본: 2.2초)
  showChapterBridge?: boolean; // 날짜·장소·원본 영상 전환 시 HyperFrames 챕터 브릿지 효과 표시 (기본 true)
  chapterBridgeDateTemplate?: BridgeDateTemplateId; // 챕터 브릿지 날짜 전환 템플릿 (1~5번, 기본: 'flip-clock')
  chapterBridgeLocationTemplate?: BridgeLocationTemplateId; // 챕터 브릿지 장소 전환 템플릿 (1~5번, 기본: 'winding-route')
  bgmFitToVideo?: boolean;     // 영상 길이에 맞춰 BGM 배속 자동 조절 여부 (기본 false)
}

export type BridgeDateTemplateId =
  | 'flip-clock'        // 1번: 레트로 플립 시계 (Split-Flap Clock)
  | 'watch-spin'        // 2번: 럭셔리 워치 회전 (Luxury Watch Hand Spin)
  | 'calendar-page'     // 3번: 일력 달력 넘기기 (Tear-off Calendar)
  | 'minimal-editorial' // 4번: 미니멀 매거진 에디토리얼 (Editorial Date)
  | 'neon-digital';     // 5번: 네온 카운트다운 HUD (Neon Digital)

export type BridgeLocationTemplateId =
  | 'winding-route'     // 1번: 로드트립 패스파인더 (Winding Route)
  | 'globe-spin'        // 2번: 3D 와이어프레임 지구본 (Globe Arc)
  | 'boarding-pass'     // 3번: 보딩패스 티켓 & 스탬프 (Boarding Pass)
  | 'minimal-editorial' // 4번: 미니멀 에디토리얼 (Editorial Location)
  | 'gps-cyber';        // 5번: GPS 내비게이션 & 네온 HUD (GPS Cyber)

export type IntroTemplateId =
  | 'kinetic-slide'
  | 'split-flap'
  | 'cinematic-letterbox'
  | 'film-countdown';

export type OutroTemplateId =
  | 'modern-endcard'
  | 'minimal-fade'
  | 'curtain-split';

export interface CustomAudioTrack {
  file: File;
  url: string;
  name: string;
  duration: number;
}

