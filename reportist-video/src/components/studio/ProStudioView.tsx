// components/studio/ProStudioView.tsx - 토스(Toss) 스타일 깔끔하고 정갈한 16:9 AI 영상 스튜디오

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  Trash2,
  Upload,
  Plus,
  X,
  Clock,
  Music,
  Check,
  Scissors,
  SlidersHorizontal,
  ChevronRight,
  AlertCircle,
  Film,
  FastForward,
  Type,
  FileAudio,
  MapPin,
  ExternalLink,
  ChevronDown,
  Zap,
} from 'lucide-react';
import type {
  FinalVideoResult,
  HighlightSegment,
  VideoItem,
  ProcessingProgress,
  VideoOverlayOptions,
} from '../../types/video.ts';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import { getSpeedTier } from '../../services/modelMetrics.ts';
import { ModelSelectorModal } from './ModelSelectorModal.tsx';
import { VideoListModal } from './VideoListModal.tsx';

interface ProStudioViewProps {
  result: FinalVideoResult | null;
  videos: VideoItem[];
  models: FreeModelMeta[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  selectedEffort: ReasoningEffortOption;
  onSelectEffort: (effort: ReasoningEffortOption) => void;
  isLoadingModels: boolean;
  onFilesSelected: (files: File[]) => void;
  onRemoveVideo: (id: string) => void;
  onStartAiAnalysis: (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId?: string,
    bgmVolume?: number
  ) => void;
  isProcessing: boolean;
  progress: ProcessingProgress;
  onCancelProcessing: () => void;
  onReset: () => void;
  onReStitch: (
    updatedSegments: HighlightSegment[],
    bgmPresetId: string,
    bgmVolume: number,
    customAudioFile?: File | null,
    overlayOptions?: VideoOverlayOptions
  ) => Promise<void>;
  isReStitching: boolean;
}

export const ProStudioView: React.FC<ProStudioViewProps> = ({
  result,
  videos,
  models,
  selectedModel,
  onSelectModel,
  isLoadingModels,
  onFilesSelected,
  onRemoveVideo,
  onStartAiAnalysis,
  isProcessing,
  progress,
  onCancelProcessing,
  onReset,
  onReStitch,
  isReStitching,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 타임라인 및 클립 상태
  const initialSegments = useMemo(() => {
    if (result?.segments && result.segments.length > 0) {
      return result.segments;
    }
    const extracted = videos.flatMap((v) => v.segments);
    if (extracted.length > 0) return extracted;
    return videos.map((v, idx) => ({
      id: `temp_seg_${v.id}`,
      sourceVideoId: v.id,
      sourceVideoName: v.name,
      start: 0,
      end: Math.min(v.duration || 5, 5),
      duration: Math.min(v.duration || 5, 5),
      reason: `클립 #${idx + 1}`,
    }));
  }, [result, videos]);

  const [segments, setSegments] = useState<HighlightSegment[]>(initialSegments);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    initialSegments[0]?.id || ''
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 2. 배경음악(BGM) 상태 (업로드 전용)
  const [selectedBgmId, setSelectedBgmId] = useState<string>('none');
  const [bgmVolume, setBgmVolume] = useState<number>(0.3);

  // 3. 사용자 직접 업로드 음악 상태
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioName, setCustomAudioName] = useState<string>('');
  const customAudioInputRef = useRef<HTMLInputElement>(null);

  // 4. 인트로 / 아웃트로 비디오 파일 업로드 참조 및 지도 모달 상태
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const outroVideoInputRef = useRef<HTMLInputElement>(null);
  const [mapModalTarget, setMapModalTarget] = useState<HighlightSegment | null>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);

  // 4-1. AI 모델 및 원본 영상 목록 모달 상태
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [isVideoListModalOpen, setIsVideoListModalOpen] = useState<boolean>(false);
  const currentModel = useMemo(
    () => models.find((model) => model.id === selectedModel) || models[0] || null,
    [models, selectedModel]
  );
  const currentSpeedTier = getSpeedTier(currentModel?.speedTokensPerSecond);

  useEffect(() => {
    if (isProcessing) {
      setIsModelModalOpen(false);
      setIsVideoListModalOpen(false);
    }
  }, [isProcessing]);

  // 처리 경과 시간 (멈춰있는 느낌 방지용 실시간 타이머)
  const [processingElapsed, setProcessingElapsed] = useState(0);
  useEffect(() => {
    if (!isProcessing) {
      setProcessingElapsed(0);
      return;
    }
    const startedAt = Date.now();
    setProcessingElapsed(0);
    const timer = window.setInterval(() => {
      setProcessingElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  // 5. 자막 & 브랜딩 오버레이 상태 (영상 실제 촬영일자 기반)
  const initialDateStr = useMemo(() => {
    if (videos.length > 0 && videos[0].metadataDate) {
      return videos[0].metadataDate;
    }
    if (videos.length > 0 && videos[0].file?.lastModified) {
      const d = new Date(videos[0].file.lastModified);
      return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }
    return '';
  }, [videos]);

  const [overlayOptions, setOverlayOptions] = useState<VideoOverlayOptions>({
    showTitle: true,
    titleText: '2021년도 엄마아빠 결혼전',
    showChannel: true,
    channelText: '은따니',
    showSubtitle: true,
    subtitleDateText: initialDateStr,
    subtitleLocationText: '',
    showIntro: false,
    showOutro: false,
    introVideoFile: null,
    outroVideoFile: null,
  });

  // 영상이 추가되었을 때 실제 촬영 날짜 자동 반영
  useEffect(() => {
    if (videos.length > 0) {
      const detectedDate =
        videos[0].metadataDate ||
        (videos[0].file?.lastModified
          ? `${new Date(videos[0].file.lastModified).getMonth() + 1}월 ${new Date(videos[0].file.lastModified).getDate()}일`
          : '');
      if (detectedDate) {
        setOverlayOptions((prev) => ({
          ...prev,
          subtitleDateText: prev.subtitleDateText || detectedDate,
        }));
      }
    }
  }, [videos]);

  // AI 추론 콘솔 자동 스크롤 (파이프라인 로그 + 실시간 스트리밍 텍스트)
  useEffect(() => {
    if (consoleScrollRef.current) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
    }
  }, [progress.reasoningLogs, progress.liveReasoning, progress.liveContent]);

  const handleCustomAudioSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCustomAudioFile(file);
      setCustomAudioName(file.name);
      setSelectedBgmId('custom');
    }
  };

  const handleIntroVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOverlayOptions((prev) => ({ ...prev, introVideoFile: file, showIntro: true }));
    }
  };

  const handleOutroVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOverlayOptions((prev) => ({ ...prev, outroVideoFile: file, showOutro: true }));
    }
  };

  // 상위 결과 갱신 동기화
  useEffect(() => {
    if (result?.segments && result.segments.length > 0) {
      setSegments(result.segments);
      if (!selectedSegmentId || !result.segments.some((s) => s.id === selectedSegmentId)) {
        setSelectedSegmentId(result.segments[0].id);
      }
    } else if (videos.length > 0 && segments.length === 0) {
      const fallback = videos.map((v, idx) => ({
        id: `temp_seg_${v.id}`,
        sourceVideoId: v.id,
        sourceVideoName: v.name,
        start: 0,
        end: Math.min(v.duration || 5, 5),
        duration: Math.min(v.duration || 5, 5),
        reason: `클립 #${idx + 1}`,
      }));
      setSegments(fallback);
      setSelectedSegmentId(fallback[0]?.id || '');
    }
  }, [result, videos]);

  // 활성 비디오 소스 URL (완성 영상 우선, 없으면 첫 번째 업로드 영상)
  const activeVideoUrl = useMemo(() => {
    if (result?.url) return result.url;
    if (videos.length > 0 && videos[0].url) return videos[0].url;
    return null;
  }, [result?.url, videos]);

  // 비디오 소스 전환 시 시간 리셋
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [activeVideoUrl]);

  // 총 시간 계산 (완성 결과가 있으면 실제 duration 반영)
  const totalDuration = useMemo(() => {
    if (result?.duration && result.duration > 0) return result.duration;
    return segments.reduce((sum, s) => sum + s.duration, 0) || 1;
  }, [result?.duration, segments]);

  // 원본 영상 총 시간
  const originalTotalDuration = useMemo(() => {
    return videos.reduce((sum, v) => sum + v.duration, 0);
  }, [videos]);

  // 시간 절약 퍼센트
  const savedPercent = useMemo(() => {
    if (!originalTotalDuration || originalTotalDuration <= 0) return 0;
    return Math.max(0, Math.round((1 - totalDuration / originalTotalDuration) * 100));
  }, [totalDuration, originalTotalDuration]);

  // 비디오 ID 매핑
  const videoMap = useMemo(() => {
    const map = new Map<string, VideoItem>();
    videos.forEach((v) => map.set(v.id, v));
    return map;
  }, [videos]);

  // 구간별 누적 시작 오프셋
  const segmentTimelineOffsets = useMemo(() => {
    let acc = 0;
    const offsets: Record<string, { startOffset: number; endOffset: number }> = {};
    segments.forEach((s) => {
      offsets[s.id] = { startOffset: acc, endOffset: acc + s.duration };
      acc += s.duration;
    });
    return offsets;
  }, [segments]);

  // 현재 재생 중인 시간대에 위치한 세그먼트 자동 감지
  const activePlayingSegmentId = useMemo(() => {
    if (!result?.url) return selectedSegmentId;
    let acc = 0;
    for (const seg of segments) {
      if (currentTime >= acc && currentTime < acc + seg.duration) {
        return seg.id;
      }
      acc += seg.duration;
    }
    return selectedSegmentId;
  }, [currentTime, segments, result?.url, selectedSegmentId]);

  // 현재 활성 재생 중인 세그먼트 객체
  const activePlayingSegment = useMemo(() => {
    return (
      segments.find((s) => s.id === activePlayingSegmentId) ||
      segments.find((s) => s.id === selectedSegmentId) ||
      segments[0]
    );
  }, [segments, activePlayingSegmentId, selectedSegmentId]);

  // 실시간 미리보기에 띄울 자막 (씬별 날짜 + 씬 제목 + 위치)
  const activePlayingSubtitleText = useMemo(() => {
    if (!activePlayingSegment) return '';
    const datePart = activePlayingSegment.subtitleDate || '';
    const titlePart = activePlayingSegment.subtitleTitle || activePlayingSegment.reason || '';
    const locPart = activePlayingSegment.locationName || '';
    const parts = [datePart, titlePart, locPart ? `• ${locPart}` : ''].filter(Boolean);
    return parts.join(' ').trim();
  }, [activePlayingSegment]);

  // 씬별 자막/날짜/위치 수정 핸들러
  const handleUpdateSegmentSubtitle = (
    segId: string,
    field: 'subtitleTitle' | 'subtitleDate' | 'locationName',
    value: string
  ) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, [field]: value } : s))
    );
  };

  // 클립 선택 및 이동
  const handleSelectSegment = (segId: string) => {
    setSelectedSegmentId(segId);
    const offset = segmentTimelineOffsets[segId];
    if (offset && videoRef.current) {
      videoRef.current.currentTime = offset.startOffset + 0.05;
      setCurrentTime(offset.startOffset + 0.05);
    }
  };

  // 상대 시간 이동 (-5s, +5s)
  const seekRelative = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const newT = Math.max(0, Math.min(totalDuration, (v.currentTime || currentTime) + delta));
    v.currentTime = newT;
    setCurrentTime(newT);
  };

  // 프로그레스 바 / 타임라인 위치 클릭 시 직접 이동
  const handleSeekByPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * totalDuration;
    v.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // 재생 / 일시정지 토글 (브라우저 자동재생 제약 완벽 대응)
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      const p = v.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('[VideoPlayer] Play interrupted or blocked, fallback to muted:', err);
          v.muted = true;
          setIsMuted(true);
          v.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // 음소거 토글
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // 클립 시작/끝 미세 조절 (-0.5s / +0.5s)
  const handleTrimChange = (
    segId: string,
    field: 'start' | 'end',
    delta: number
  ) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        const vItem = videoMap.get(s.sourceVideoId);
        const maxDur = vItem?.duration || 100;

        let newStart = s.start;
        let newEnd = s.end;

        if (field === 'start') {
          newStart = Math.max(0, Math.min(s.end - 0.8, Math.round((s.start + delta) * 10) / 10));
        } else {
          newEnd = Math.max(s.start + 0.8, Math.min(maxDur, Math.round((s.end + delta) * 10) / 10));
        }

        const newDuration = Math.round((newEnd - newStart) * 10) / 10;
        return {
          ...s,
          start: newStart,
          end: newEnd,
          duration: newDuration,
        };
      })
    );
  };

  // 클립 삭제
  const handleDeleteSegment = (segId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = segments.filter((s) => s.id !== segId);
    setSegments(updated);
    if (selectedSegmentId === segId && updated.length > 0) {
      setSelectedSegmentId(updated[0].id);
    }
  };

  // 크롭 위치 조정
  const handleCropAnchorChange = (segId: string, ratio: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, cropOffsetYRatio: ratio } : s))
    );
  };



  // 파일 업로드
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  // 완성 영상 다운로드
  const handleDownload = () => {
    if (!result?.url) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `reportist_highlight_16x9_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 시간 포맷 (00:04)
  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="toss-page-container" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* 1. 상단 글로벌 내비게이션 바 (토스 스타일) */}
      <header className="toss-nav-header">
        <div className="toss-nav-left">
          <div className="toss-logo-badge">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="toss-nav-title">Reportist Video</span>
          <span className="toss-tag-blue">16:9 유튜브 하이라이트</span>
        </div>

        <div className="toss-nav-right">
          {/* AI 모델 선택 트리거 */}
          <button
            type="button"
            className="toss-model-trigger"
            onClick={() => setIsModelModalOpen(true)}
            disabled={isProcessing || isLoadingModels}
            title="AI 모델을 선택하세요"
          >
            <span className="toss-model-trigger-icon">
              <Sparkles size={13} />
            </span>
            <span className="toss-model-trigger-text">
              <span className="toss-model-trigger-label">AI 모델</span>
              <span className="toss-model-trigger-name">
                {isLoadingModels
                  ? '모델 불러오는 중...'
                  : currentModel?.name.replace(':free', '') || '모델 선택'}
              </span>
            </span>
            {currentModel?.speedTokensPerSecond != null && (
              <span className={`toss-model-trigger-speed ${currentSpeedTier.key}`}>
                <Zap size={10} />
                {Math.round(currentModel.speedTokensPerSecond)} tok/s
              </span>
            )}
            <ChevronDown size={14} className="toss-model-trigger-chevron" />
          </button>

          {/* ★ 올린 원본 영상 리스트 트리거 (AI 모델과 동일한 룩앤필) */}
          <button
            type="button"
            className="toss-model-trigger"
            onClick={() => setIsVideoListModalOpen(true)}
            title="올린 원본 영상 목록을 확인하고 추가/삭제합니다"
          >
            <span className="toss-model-trigger-icon">
              <Film size={13} />
            </span>
            <span className="toss-model-trigger-text">
              <span className="toss-model-trigger-label">올린 영상</span>
              <span className="toss-model-trigger-name">
                {videos.length === 0 ? '영상 없음' : `${videos.length}개 영상`}
              </span>
            </span>
            <ChevronDown size={14} className="toss-model-trigger-chevron" />
          </button>

          {/* ★ 메인 액션 버튼: 하단에서 상단 헤더로 이동 */}
          {videos.length > 0 && (
            !result?.url ? (
              <button
                type="button"
                className={`toss-nav-cta-btn ${isProcessing ? 'loading' : ''}`}
                onClick={() =>
                  onStartAiAnalysis(overlayOptions, customAudioFile, selectedBgmId, bgmVolume)
                }
                disabled={isProcessing}
              >
                <Sparkles size={14} className={isProcessing ? 'animate-spin' : ''} />
                <span>{isProcessing ? 'AI 분석 중...' : '✨ AI 하이라이트 만들기'}</span>
              </button>
            ) : (
              <div className="toss-nav-dual-actions">
                <button
                  type="button"
                  className="toss-nav-btn-secondary"
                  onClick={() =>
                    onReStitch(
                      segments,
                      selectedBgmId,
                      bgmVolume,
                      customAudioFile,
                      overlayOptions
                    )
                  }
                  disabled={isReStitching || segments.length === 0}
                  title="수정된 타임라인 다시 병합"
                >
                  <Scissors size={13} />
                  <span>{isReStitching ? '병합 중...' : '다시 병합'}</span>
                </button>

                <button
                  type="button"
                  className="toss-nav-cta-btn"
                  onClick={handleDownload}
                  title="16:9 완성 영상 다운로드"
                >
                  <Download size={14} />
                  <span>다운로드 ({formatSec(totalDuration)})</span>
                </button>
              </div>
            )
          )}

          {videos.length > 0 && (
            <button type="button" className="toss-btn-text" onClick={onReset}>
              새로 시작
            </button>
          )}
        </div>
      </header>

      {/* 2. 본문 2열 레이아웃 */}
      <main className="toss-main-content">
        {/* 2-A. 왼쪽 열: 상단 문구 & 16:9 모니터 & 배경음악 업로드 */}
        <section className="toss-column-left">
          {/* 16:9 비디오 플레이어 카드 (상단에 직관적인 좌/우 문구 입력창 일체형 배치) */}
          <div className="toss-card toss-player-card">
            {/* ★ 영상 상단 왼쪽, 오른쪽 문구 직관 입력창 */}
            <div className="toss-video-header-bar">
              <div className="toss-header-input-wrap">
                <label className="toss-header-input-label">
                  <Type size={12} className="text-blue-500" />
                  <span>왼쪽 문구</span>
                </label>
                <input
                  type="text"
                  value={overlayOptions.titleText}
                  onChange={(e) =>
                    setOverlayOptions((prev) => ({
                      ...prev,
                      titleText: e.target.value,
                      showTitle: e.target.value.trim().length > 0,
                    }))
                  }
                  placeholder="영상 왼쪽 상단 문구 (비워두면 표시 안 됨)"
                  className="toss-header-input"
                />
              </div>

              <div className="toss-header-input-wrap toss-header-input-wrap-right">
                <label className="toss-header-input-label toss-label-right">
                  <span>오른쪽 문구</span>
                  <Type size={12} className="text-blue-500" />
                </label>
                <input
                  type="text"
                  value={overlayOptions.channelText}
                  onChange={(e) =>
                    setOverlayOptions((prev) => ({
                      ...prev,
                      channelText: e.target.value,
                      showChannel: e.target.value.trim().length > 0,
                    }))
                  }
                  placeholder="영상 오른쪽 상단 문구 (비워두면 표시 안 됨)"
                  className="toss-header-input toss-input-right"
                />
              </div>
            </div>

            <div className="toss-player-wrapper">
              {activeVideoUrl ? (
                <>
                  <video
                    key={activeVideoUrl}
                    ref={videoRef}
                    src={activeVideoUrl}
                    playsInline
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => {
                      setIsPlaying(false);
                      setCurrentTime(0);
                    }}
                    onClick={togglePlay}
                    className="toss-video-element"
                  />
                  {/* 정지 중일 때 비디오 중앙에 표시되는 재생 오버레이 버튼 */}
                  {!isPlaying && (
                    <button
                      type="button"
                      className="toss-canvas-play-overlay"
                      onClick={togglePlay}
                      title="재생하기"
                    >
                      <Play size={28} className="ml-1 text-white" />
                    </button>
                  )}

                  {/* ★ 실시간 자막 & 문구 오버레이 라이브 프리뷰 */}
                  {!result?.url && overlayOptions.showTitle && overlayOptions.titleText && (
                    <div className="toss-live-overlay-title">
                      {overlayOptions.titleText}
                    </div>
                  )}

                  {!result?.url && overlayOptions.showChannel && overlayOptions.channelText && (
                    <div className="toss-live-overlay-channel">
                      {overlayOptions.channelText}
                    </div>
                  )}

                  {!result?.url && overlayOptions.showSubtitle && activePlayingSubtitleText && (
                    <div className="toss-live-overlay-subtitle">
                      {activePlayingSubtitleText}
                    </div>
                  )}
                </>
              ) : (
                /* 영상이 없을 때의 빈 상태 안내 */
                <div
                  className="toss-player-empty"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="toss-empty-circle-icon">
                    <Upload size={28} className="text-blue-500" />
                  </div>
                  <h3 className="toss-empty-title">영상을 올려주세요</h3>
                  <p className="toss-empty-desc">
                    여기에 동영상을 끌어다 놓거나 눌러서 선택하면<br />
                    AI가 16:9 유튜브 규격으로 가장 극적인 순간만 모아드려요.
                  </p>
                  <button type="button" className="toss-btn-secondary mt-3">
                    <Plus size={15} />
                    <span>영상 파일 선택하기</span>
                  </button>
                </div>
              )}
            </div>

            {/* 비디오 재생 트랜스포트 바 */}
            {activeVideoUrl && (
              <div className="toss-transport-bar">
                <div className="toss-transport-left">
                  <button
                    type="button"
                    className="toss-btn-step"
                    onClick={() => seekRelative(-5)}
                    title="5초 뒤로"
                  >
                    <RotateCcw size={13} />
                    <span>-5s</span>
                  </button>

                  <button
                    type="button"
                    className="toss-play-btn"
                    onClick={togglePlay}
                    title={isPlaying ? '일시정지' : '재생'}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    className="toss-btn-step"
                    onClick={() => seekRelative(5)}
                    title="5초 앞으로"
                  >
                    <span>+5s</span>
                    <FastForward size={13} />
                  </button>

                  <div className="toss-timecode-text">
                    <span className="font-bold text-slate-900">{formatSec(currentTime)}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-500">{formatSec(totalDuration)}</span>
                  </div>
                </div>

                {/* 프로그레스 스크럽 바 */}
                <div
                  className="toss-progress-track"
                  onClick={handleSeekByPosition}
                  title="원하는 위치로 이동"
                >
                  <div
                    className="toss-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                    }}
                  />
                  <div
                    className="toss-progress-thumb"
                    style={{
                      left: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                    }}
                  />
                </div>

                <div className="toss-transport-right">
                  <button
                    type="button"
                    className={`toss-btn-icon ${isMuted ? 'muted' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? '음소거 해제' : '음소거'}
                  >
                    {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                  </button>
                </div>
              </div>
            )}

            {/* ★ NLE 감성: 16:9 인터랙티브 시퀀스 타임라인 스트립 */}
            {segments.length > 0 && (
              <div className="toss-timeline-sequencer-box">
                <div className="toss-sequencer-header">
                  <div className="flex items-center gap-1.5">
                    <Film size={14} className="text-blue-600" />
                    <span className="toss-sequencer-title">시퀀스 타임라인</span>
                    <span className="toss-sequencer-badge">{segments.length}개 클립</span>
                  </div>
                  <span className="toss-sequencer-hint">클립을 누르면 해당 구간으로 바로 이동해요</span>
                </div>

                <div
                  className="toss-sequencer-track"
                  onClick={handleSeekByPosition}
                  title="클릭하여 원하는 시간으로 시크"
                >
                  {/* 빨간색 실시간 플레이헤드 침 */}
                  <div
                    className="toss-sequencer-playhead"
                    style={{
                      left: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                    }}
                  >
                    <div className="toss-playhead-cap" />
                    <div className="toss-playhead-line" />
                  </div>

                  {/* 연결된 클립 스트립 블록 */}
                  <div className="toss-sequencer-strip">
                    {segments.map((seg, idx) => {
                      const isCurrent = seg.id === activePlayingSegmentId;
                      const isSelected = seg.id === selectedSegmentId;
                      const widthPct = (seg.duration / (totalDuration || 1)) * 100;
                      const vItem = videoMap.get(seg.sourceVideoId);
                      return (
                        <div
                          key={seg.id}
                          className={`toss-sequencer-block ${isSelected ? 'selected' : ''} ${isCurrent ? 'playing' : ''}`}
                          style={{ width: `${Math.max(5, widthPct)}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSegment(seg.id);
                          }}
                          title={`#${idx + 1} (${seg.duration.toFixed(1)}초): ${seg.reason}`}
                        >
                          {vItem?.thumbnailUrl && (
                            <img
                              src={vItem.thumbnailUrl}
                              alt=""
                              className="toss-sequencer-block-thumb"
                            />
                          )}
                          <div className="toss-sequencer-block-overlay">
                            <span className="toss-block-idx">#{idx + 1}</span>
                            <span className="toss-block-dur">{seg.duration.toFixed(1)}s</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ★ 영상 바로 아래쪽: 배경음악 (BGM 업로드 전용) */}
          <div className="toss-card toss-bgm-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Music size={15} className="text-blue-600 shrink-0" />
                  <span>배경음악</span>
                </h4>
                <p className="toss-card-desc">
                  직접 준비한 음악 파일(MP3, WAV)을 올려 영상에 BGM을 입혀보세요.
                </p>
              </div>

              {customAudioFile && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">볼륨</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="toss-slider"
                  />
                  <span className="text-xs font-mono font-bold text-blue-600 w-8 text-right">
                    {Math.round(bgmVolume * 100)}%
                  </span>
                </div>
              )}
            </div>

            <input
              ref={customAudioInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleCustomAudioSelected}
            />

            {customAudioFile ? (
              <div className="toss-bgm-uploaded-box">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="toss-audio-icon-box">
                    <FileAudio size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {customAudioName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      내 음악 파일 ({((customAudioFile.size || 0) / (1024 * 1024)).toFixed(1)}MB) • 적용 완료
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="toss-btn-secondary toss-btn-xs"
                    onClick={() => customAudioInputRef.current?.click()}
                  >
                    파일 변경
                  </button>
                  <button
                    type="button"
                    className="toss-btn-delete-sm"
                    onClick={() => {
                      setCustomAudioFile(null);
                      setCustomAudioName('');
                      setSelectedBgmId('none');
                    }}
                    title="배경음악 삭제"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="toss-upload-box toss-audio-upload-box"
                onClick={() => customAudioInputRef.current?.click()}
              >
                <FileAudio size={22} className="text-blue-500 mb-1" />
                <span className="text-xs font-bold text-slate-800">
                  + 배경음악 파일 올리기 (MP3, WAV)
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  영상을 더욱 풍성하게 만들어줄 BGM 음원을 업로드하세요
                </span>
              </button>
            )}
          </div>
        </section>

        {/* 2-B. 오른쪽 열: [상단 인트로] -> [중간 AI가 포착한 극적 순간] -> [하단 아웃트로] -> [요약] */}
        <section className="toss-column-right">
          {/* ★ [1] 극적순간 상단: 시작 인트로 카드 */}
          <div className="toss-card toss-intro-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Film size={15} className="text-blue-600 shrink-0" />
                  <span>시작 인트로</span>
                </h4>
                <p className="toss-card-desc">영상 시작 시 재생할 인트로를 설정해요.</p>
              </div>
              <label className="toss-toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayOptions.showIntro}
                  onChange={(e) =>
                    setOverlayOptions((prev) => ({ ...prev, showIntro: e.target.checked }))
                  }
                />
                <span className="toss-toggle-slider" />
              </label>
            </div>

            {overlayOptions.showIntro && (
              <div className="toss-intro-content mt-2">
                <input
                  ref={introVideoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={handleIntroVideoSelected}
                />
                {overlayOptions.introVideoFile ? (
                  <div className="toss-clip-file-chip">
                    <Film size={14} className="text-blue-600 flex-shrink-0" />
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {overlayOptions.introVideoFile.name}
                    </span>
                    <button
                      type="button"
                      className="toss-btn-delete-sm ml-auto"
                      onClick={() =>
                        setOverlayOptions((prev) => ({ ...prev, introVideoFile: null }))
                      }
                      title="영상 제거"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="toss-btn-custom-audio w-full"
                    onClick={() => introVideoInputRef.current?.click()}
                  >
                    <Plus size={14} />
                    <span>+ 인트로 동영상 올리기 (MP4, MOV)</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 block mt-1.5">
                  {overlayOptions.introVideoFile
                    ? '업로드된 인트로 영상이 하이라이트 시작부에 합성됩니다.'
                    : '동영상을 올리지 않으면 시네마틱 타이틀 카드(1.6초)가 자동으로 적용됩니다.'}
                </span>
              </div>
            )}
          </div>

          {/* ★ [2] AI가 포착한 극적 순간 카드 */}
          <div className="toss-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Scissors size={15} className="text-blue-600 shrink-0" />
                  <span>AI가 포착한 극적 순간</span>
                </h4>
                <p className="toss-card-desc">
                  구간을 누르면 자막·촬영 날짜·위치·구도를 바로 수정할 수 있어요.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {segments.length > 0 && (
                  <span className="toss-tag-gray">
                    총 {segments.length}개 구간 ({totalDuration.toFixed(1)}초)
                  </span>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600" title="영상 하단에 씬별 날짜와 자막을 표시합니다">
                  <span>하단 자막</span>
                  <span className="toss-toggle-switch">
                    <input
                      type="checkbox"
                      checked={overlayOptions.showSubtitle}
                      onChange={(e) =>
                        setOverlayOptions((prev) => ({ ...prev, showSubtitle: e.target.checked }))
                      }
                    />
                    <span className="toss-toggle-slider" />
                  </span>
                </label>
              </div>
            </div>

            {segments.length === 0 ? (
              <div className="toss-empty-state">
                <p className="text-slate-400 text-sm">
                  영상을 올리고 상단의 '✨ AI 하이라이트 만들기'를 누르면 극적 구간이 채워져요.
                </p>
              </div>
            ) : (
              <div className="toss-segment-list">
                {segments.map((seg, idx) => {
                  const isSelected = seg.id === selectedSegmentId;
                  const isCurrentPlaying = seg.id === activePlayingSegmentId;
                  const vItem = videoMap.get(seg.sourceVideoId);
                  return (
                    <div
                      key={seg.id}
                      className={`toss-segment-item ${isSelected ? 'active' : ''} ${isCurrentPlaying ? 'playing' : ''}`}
                    >
                      {/* ★ 재생 중 표시는 absolute 오버레이로만 그려서
                          씬이 바뀔 때 목록 행의 너비/높이가 흔들리지 않게 한다 */}
                      {isCurrentPlaying && isPlaying && vItem?.thumbnailUrl && (
                        <span className="toss-segment-now-playing" aria-hidden="true">
                          <span className="toss-segment-now-dot" />
                          재생 중
                        </span>
                      )}
                      <div
                        className="toss-segment-row"
                        onClick={() => handleSelectSegment(seg.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isSelected}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectSegment(seg.id);
                          }
                        }}
                      >
                        <div className="toss-segment-left">
                          {vItem?.thumbnailUrl && (
                            <img
                              src={vItem.thumbnailUrl}
                              alt=""
                              className="toss-segment-thumb"
                            />
                          )}
                          <div className="toss-segment-info">
                            <div className="toss-segment-title-row">
                              <span className="toss-segment-number">#{idx + 1}</span>
                              <span className="toss-segment-reason truncate">
                                {seg.reason}
                              </span>
                            </div>
                            <span className="toss-segment-source truncate">
                              {seg.sourceVideoName}
                            </span>
                          </div>
                        </div>

                        {/* 트리밍 버튼 및 길이 */}
                        <div className="toss-segment-right">
                          <div className="toss-trim-controls">
                            <button
                              type="button"
                              className="toss-btn-micro"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrimChange(seg.id, 'start', -0.5);
                              }}
                              title="시작 0.5초 늘리기"
                            >
                              -0.5s
                            </button>
                            <span className="toss-segment-duration">
                              {seg.duration.toFixed(1)}초
                            </span>
                            <button
                              type="button"
                              className="toss-btn-micro"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrimChange(seg.id, 'end', 0.5);
                              }}
                              title="끝 0.5초 늘리기"
                            >
                              +0.5s
                            </button>
                          </div>

                          <button
                            type="button"
                            className="toss-btn-delete"
                            onClick={(e) => handleDeleteSegment(seg.id, e)}
                            title="이 구간 제외하기"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* ★ 선택한 씬의 자막·날짜·위치·구도를 목록 안에서 바로 수정 */}
                      {isSelected && (
                        <div className="toss-segment-editor" onClick={(e) => e.stopPropagation()}>
                          <div className="toss-segment-editor-head">
                            <span className="toss-segment-editor-title">이 씬의 자막 · 날짜 · 위치</span>
                            <span className="toss-segment-editor-hint">수정 내용은 다시 병합할 때 반영돼요</span>
                          </div>

                          {/* 1. 씬 자막 제목 */}
                          <div className="toss-branding-row">
                            <span className="toss-branding-label">씬 자막 제목 (AI 요약 / 직접 수정)</span>
                            <input
                              type="text"
                              value={seg.subtitleTitle ?? seg.reason}
                              onChange={(e) =>
                                handleUpdateSegmentSubtitle(seg.id, 'subtitleTitle', e.target.value)
                              }
                              placeholder="예: 벚꽃 구경하기, 환하게 웃는 순간"
                              className="toss-input-sm"
                            />
                          </div>

                          {/* 2. 씬 촬영 날짜 & 위치 */}
                          <div className="toss-branding-row">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[11px] font-bold text-slate-600 mb-1 block">촬영 날짜</span>
                                <input
                                  type="text"
                                  value={seg.subtitleDate ?? ''}
                                  onChange={(e) =>
                                    handleUpdateSegmentSubtitle(seg.id, 'subtitleDate', e.target.value)
                                  }
                                  placeholder="예: 9월 10일"
                                  className="toss-input-sm"
                                />
                              </div>
                              <div>
                                <span className="text-[11px] font-bold text-slate-600 mb-1 block">위치 명칭</span>
                                <input
                                  type="text"
                                  value={seg.locationName ?? ''}
                                  onChange={(e) =>
                                    handleUpdateSegmentSubtitle(seg.id, 'locationName', e.target.value)
                                  }
                                  placeholder="예: 해운대 해수욕장"
                                  className="toss-input-sm"
                                />
                              </div>
                            </div>

                            {/* 지도 확인 버튼들 */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <button
                                type="button"
                                className="toss-btn-micro-action"
                                onClick={() => setMapModalTarget(seg)}
                              >
                                <MapPin size={12} className="text-red-500" />
                                <span>위치 지도 마커 확인</span>
                              </button>

                              <a
                                href={
                                  seg.locationName
                                    ? `https://map.naver.com/v5/search/${encodeURIComponent(seg.locationName)}`
                                    : seg.latitude && seg.longitude
                                    ? `https://map.naver.com/v5/search/${seg.latitude},${seg.longitude}`
                                    : `https://map.naver.com/v5/search/${encodeURIComponent(seg.subtitleTitle || seg.reason)}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="toss-btn-micro-action"
                              >
                                <ExternalLink size={11} />
                                <span>네이버 지도</span>
                              </a>

                              <a
                                href={
                                  seg.latitude && seg.longitude
                                    ? `https://www.google.com/maps/search/?api=1&query=${seg.latitude},${seg.longitude}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(seg.locationName || seg.subtitleTitle || seg.reason)}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="toss-btn-micro-action"
                              >
                                <ExternalLink size={11} />
                                <span>구글 지도</span>
                              </a>
                            </div>
                          </div>

                          {/* 3. 16:9 세로 영상 인물 크롭 기준 */}
                          <div className="toss-branding-row">
                            <div className="flex items-center justify-between mb-1">
                              <span className="toss-branding-label">16:9 인물 크롭 위치</span>
                              <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                                AI 추천 반영됨
                              </span>
                            </div>
                            <div className="toss-segment-control">
                              <button
                                type="button"
                                className={`toss-segment-btn ${(seg.cropOffsetYRatio ?? 0.2) <= 0.25 ? 'active' : ''}`}
                                onClick={() => handleCropAnchorChange(seg.id, 0.15)}
                              >
                                상단 (얼굴 보호)
                              </button>
                              <button
                                type="button"
                                className={`toss-segment-btn ${(seg.cropOffsetYRatio ?? 0.2) > 0.25 && (seg.cropOffsetYRatio ?? 0.2) < 0.75 ? 'active' : ''}`}
                                onClick={() => handleCropAnchorChange(seg.id, 0.5)}
                              >
                                중앙
                              </button>
                              <button
                                type="button"
                                className={`toss-segment-btn ${(seg.cropOffsetYRatio ?? 0.2) >= 0.75 ? 'active' : ''}`}
                                onClick={() => handleCropAnchorChange(seg.id, 0.85)}
                              >
                                하단
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ★ [3] 극적순간 하단: 종료 아웃트로 카드 */}
          <div className="toss-card toss-outro-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title">
                  <Film size={15} className="text-blue-600 shrink-0" />
                  <span>종료 아웃트로</span>
                </h4>
                <p className="toss-card-desc">영상 종료 시 재생할 아웃트로를 설정해요.</p>
              </div>
              <label className="toss-toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayOptions.showOutro}
                  onChange={(e) =>
                    setOverlayOptions((prev) => ({ ...prev, showOutro: e.target.checked }))
                  }
                />
                <span className="toss-toggle-slider" />
              </label>
            </div>

            {overlayOptions.showOutro && (
              <div className="toss-outro-content mt-2">
                <input
                  ref={outroVideoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={handleOutroVideoSelected}
                />
                {overlayOptions.outroVideoFile ? (
                  <div className="toss-clip-file-chip">
                    <Film size={14} className="text-blue-600 flex-shrink-0" />
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {overlayOptions.outroVideoFile.name}
                    </span>
                    <button
                      type="button"
                      className="toss-btn-delete-sm ml-auto"
                      onClick={() =>
                        setOverlayOptions((prev) => ({ ...prev, outroVideoFile: null }))
                      }
                      title="영상 제거"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="toss-btn-custom-audio w-full"
                    onClick={() => outroVideoInputRef.current?.click()}
                  >
                    <Plus size={14} />
                    <span>+ 아웃트로 동영상 올리기 (MP4, MOV)</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 block mt-1.5">
                  {overlayOptions.outroVideoFile
                    ? '업로드된 아웃트로 영상이 하이라이트 끝에 합성됩니다.'
                    : '동영상을 올리지 않으면 시네마틱 엔딩 카드(1.8초)가 자동으로 적용됩니다.'}
                </span>
              </div>
            )}
          </div>

          {/* ★ [4] 시간 절약 효과 요약 카드 */}
          {originalTotalDuration > 0 && segments.length > 0 && (
            <div className="toss-summary-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">시간 절약률</span>
                <span className="text-sm font-bold text-emerald-600">
                  {savedPercent}% 단축
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-400">
                  {originalTotalDuration.toFixed(1)}초 원본 영상
                </span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  ➔ {totalDuration.toFixed(1)}초 하이라이트
                </span>
              </div>
            </div>
          )}
        </section>
      </main>



      {/* 4. AI 분석 진행 중 친절한 토스식 모달 (스피너 단독 금지, 진행률 & 안내) */}
      {isProcessing && (
        <div className="toss-modal-overlay">
          <div className="toss-modal-card">
            <div className="toss-modal-icon-circle">
              <Sparkles size={24} className="text-blue-500 animate-pulse" />
            </div>

            <h3 className="toss-modal-title">AI가 극적인 순간을 찾고 있어요</h3>
            <p className="toss-modal-desc">
              {progress.statusMessage || '영상의 주요 장면을 분석하고 있어요. 잠시만 기다려 주세요.'}
            </p>

            {/* 진행률 바 */}
            <div className="toss-modal-progress-bar">
              <div
                className="toss-modal-progress-fill"
                style={{ width: `${Math.max(5, progress.progressPercent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 mt-1.5 px-0.5">
              <span>16:9 유튜브 시네마틱 규격</span>
              <span className="font-bold text-blue-600">{progress.progressPercent}%</span>
            </div>

            {/* ★ 실시간 AI 비전 추론 로그 콘솔 (Point 9) */}
            <div className="toss-modal-reasoning-wrap mt-4 text-left">
              <div className="toss-modal-reasoning-header flex items-center gap-1.5 mb-1.5 px-1">
                <span className="toss-reasoning-live-dot" />
                <span className="text-xs font-bold text-slate-700">실시간 AI 비전 추론 과정</span>
                <span className="text-[11px] font-mono text-blue-600 ml-auto">
                  {progress.currentPhase === 'extract'
                    ? '프레임 추출 중'
                    : progress.currentPhase === 'analyze'
                    ? '멀티모달 시각 분석 중'
                    : progress.currentPhase === 'stitch'
                    ? '16:9 무손실 병합 중'
                    : '진행 중'}
                  {` · ${processingElapsed}s`}
                </span>
              </div>
              <div className="toss-modal-reasoning-console" ref={consoleScrollRef}>
                {progress.reasoningLogs && progress.reasoningLogs.length > 0 ? (
                  progress.reasoningLogs.map((log, idx) => (
                    <div key={idx} className="toss-reasoning-log-line">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="toss-reasoning-log-line text-slate-400">
                    AI 모델 및 영상 프레임 시퀀스 준비 중...
                  </div>
                )}

                {/* 실제 모델의 사고 과정/응답 스트림 (토큰 단위 실시간 렌더링) */}
                {(() => {
                  const reasoningText = (progress.liveReasoning || '').trim();
                  const contentText = (progress.liveContent || '').trim();
                  const liveText = reasoningText ? progress.liveReasoning || '' : contentText ? progress.liveContent || '' : '';
                  if (!liveText) {
                    return progress.currentPhase === 'analyze' ? (
                      <div className="toss-reasoning-waiting">
                        <span className="toss-live-caret" />
                        <span>모델이 첫 토큰을 생성할 때까지 대기 중... (프레임 전송 완료)</span>
                      </div>
                    ) : null;
                  }

                  return (
                    <div className={`toss-live-reasoning-block ${reasoningText ? 'is-reasoning' : 'is-content'}`}>
                      <div className="toss-live-reasoning-label">
                        <span>{reasoningText ? '💭 모델 사고 과정 (실시간)' : '⌨️ 모델 응답 생성 중 (실시간)'}</span>
                        <span className="toss-live-reasoning-count">{liveText.length.toLocaleString()}자</span>
                      </div>
                      <div className="toss-live-reasoning-text">
                        {liveText}
                        <span className="toss-live-caret" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 취소 버튼 */}
            <button
              type="button"
              className="toss-btn-text text-slate-400 mt-4 mx-auto block hover:text-slate-600"
              onClick={onCancelProcessing}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ★ 5. 씬 촬영 위치 지도 확인 모달 (Point 5) */}
      {mapModalTarget && (
        <div className="toss-modal-overlay" onClick={() => setMapModalTarget(null)}>
          <div className="toss-modal-card toss-map-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 text-left">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    촬영 위치 지도 확인
                  </h3>
                  <span className="text-xs text-slate-400">
                    {mapModalTarget.locationName || mapModalTarget.subtitleTitle || mapModalTarget.reason}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="toss-btn-icon"
                onClick={() => setMapModalTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* 임베디드 오픈스트리트맵 지도 */}
            <div className="toss-map-frame-box">
              {mapModalTarget.latitude && mapModalTarget.longitude ? (
                <iframe
                  title="촬영 위치 지도"
                  className="w-full h-64 rounded-xl border border-slate-200"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapModalTarget.longitude - 0.008}%2C${mapModalTarget.latitude - 0.008}%2C${mapModalTarget.longitude + 0.008}%2C${mapModalTarget.latitude + 0.008}&layer=mapnik&marker=${mapModalTarget.latitude}%2C${mapModalTarget.longitude}`}
                />
              ) : (
                <div className="w-full h-48 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                  <MapPin size={28} className="text-slate-300 mb-2" />
                  <p className="text-xs text-slate-700 font-bold mb-1">
                    {mapModalTarget.locationName || 'GPS 메타데이터 미포함 영상'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    동영상 파일에 직접적인 GPS 좌표가 없더라도<br />
                    아래 네이버 지도 또는 구글 지도를 눌러 장소를 바로 검색하실 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <a
                href={
                  mapModalTarget.locationName
                    ? `https://map.naver.com/v5/search/${encodeURIComponent(mapModalTarget.locationName)}`
                    : mapModalTarget.latitude && mapModalTarget.longitude
                    ? `https://map.naver.com/v5/search/${mapModalTarget.latitude},${mapModalTarget.longitude}`
                    : `https://map.naver.com/v5/search/${encodeURIComponent(mapModalTarget.subtitleTitle || mapModalTarget.reason)}`
                }
                target="_blank"
                rel="noreferrer"
                className="toss-btn-secondary"
              >
                <ExternalLink size={13} />
                <span>네이버 지도에서 보기</span>
              </a>
              <a
                href={
                  mapModalTarget.latitude && mapModalTarget.longitude
                    ? `https://www.google.com/maps/search/?api=1&query=${mapModalTarget.latitude},${mapModalTarget.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapModalTarget.locationName || mapModalTarget.subtitleTitle || mapModalTarget.reason)}`
                }
                target="_blank"
                rel="noreferrer"
                className="toss-btn-secondary"
              >
                <ExternalLink size={13} />
                <span>구글 지도에서 보기</span>
              </a>
              <button
                type="button"
                className="toss-btn-primary"
                onClick={() => setMapModalTarget(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. AI 모델 선택 모달 */}
      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        models={models}
        selectedModelId={selectedModel}
        onSelectModel={onSelectModel}
      />

      {/* 7. 올린 원본 영상 목록 모달 */}
      <VideoListModal
        isOpen={isVideoListModalOpen}
        onClose={() => setIsVideoListModalOpen(false)}
        videos={videos}
        onRemoveVideo={onRemoveVideo}
        onAddFilesClick={() => {
          setIsVideoListModalOpen(false);
          fileInputRef.current?.click();
        }}
      />
    </div>
  );
};
