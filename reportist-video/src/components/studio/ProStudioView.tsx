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
} from 'lucide-react';
import type {
  FinalVideoResult,
  HighlightSegment,
  VideoItem,
  ProcessingProgress,
} from '../../types/video.ts';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import { BGM_PRESETS, playBgmSynthLoop } from '../../services/audioSynth.ts';

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
  onStartAiAnalysis: () => void;
  isProcessing: boolean;
  progress: ProcessingProgress;
  onCancelProcessing: () => void;
  onReset: () => void;
  onReStitch: (
    updatedSegments: HighlightSegment[],
    bgmPresetId: string,
    bgmVolume: number
  ) => Promise<void>;
  isReStitching: boolean;
}

export const ProStudioView: React.FC<ProStudioViewProps> = ({
  result,
  videos,
  models,
  selectedModel,
  onSelectModel,
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

  // 2. BGM 상태
  const [selectedBgmId, setSelectedBgmId] = useState<string>('acoustic');
  const [bgmVolume, setBgmVolume] = useState<number>(0.3);
  const [previewingBgmId, setPreviewingBgmId] = useState<string | null>(null);
  const bgmPreviewRef = useRef<{ stop: () => void } | null>(null);

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

  // 비디오 재생 시간 추적
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  // 총 시간 계산
  const totalDuration = useMemo(() => {
    return segments.reduce((sum, s) => sum + s.duration, 0) || 1;
  }, [segments]);

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

  // 클립 선택 및 이동
  const handleSelectSegment = (segId: string) => {
    setSelectedSegmentId(segId);
    const offset = segmentTimelineOffsets[segId];
    if (offset && videoRef.current) {
      videoRef.current.currentTime = offset.startOffset + 0.05;
      setCurrentTime(offset.startOffset + 0.05);
    }
  };

  // 재생 / 일시정지 토글
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
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

  // BGM 미리듣기
  const handleToggleBgmPreview = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingBgmId === presetId) {
      bgmPreviewRef.current?.stop();
      bgmPreviewRef.current = null;
      setPreviewingBgmId(null);
      return;
    }

    bgmPreviewRef.current?.stop();
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const ctrl = playBgmSynthLoop(ctx, ctx.destination, presetId, bgmVolume);
      bgmPreviewRef.current = {
        stop: () => {
          ctrl.stop();
          ctx.close().catch(() => {});
        },
      };
      setPreviewingBgmId(presetId);
    } catch {
      // ignore
    }
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

  const currentSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];

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
          {/* AI 모델 콤보박스 */}
          <div className="toss-model-select-wrap">
            <span className="toss-model-label">AI 모델</span>
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              disabled={isProcessing}
              className="toss-select"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.id.includes(':free') ? '(무료)' : ''}
                </option>
              ))}
            </select>
          </div>

          {videos.length > 0 && (
            <button type="button" className="toss-btn-text" onClick={onReset}>
              새로 시작하기
            </button>
          )}
        </div>
      </header>

      {/* 2. 본문 2열 레이아웃 */}
      <main className="toss-main-content">
        {/* 2-A. 왼쪽 열: 16:9 모니터 & 타임라인 클립 목록 */}
        <section className="toss-column-left">
          {/* 16:9 비디오 플레이어 카드 */}
          <div className="toss-card toss-player-card">
            <div className="toss-player-wrapper">
              {result?.url ? (
                <video
                  ref={videoRef}
                  src={result.url}
                  playsInline
                  className="toss-video-element"
                />
              ) : videos.length > 0 && videos[0].url ? (
                <video
                  ref={videoRef}
                  src={videos[0].url}
                  playsInline
                  className="toss-video-element"
                />
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

              {/* 16:9 규격 배지 */}
              <div className="toss-ratio-badge">
                <span>16:9 HD (1280×720)</span>
              </div>
            </div>

            {/* 비디오 재생 컨트롤 바 */}
            {(result?.url || videos.length > 0) && (
              <div className="toss-transport-bar">
                <button
                  type="button"
                  className="toss-play-btn"
                  onClick={togglePlay}
                  title={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>

                <div className="toss-timecode-text">
                  <span className="font-bold text-slate-900">{formatSec(currentTime)}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-500">{formatSec(totalDuration)}</span>
                </div>

                <div className="toss-progress-track">
                  <div
                    className="toss-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100))}%`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="toss-btn-icon"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
              </div>
            )}
          </div>

          {/* 타임라인 극적 구간 리스트 카드 */}
          <div className="toss-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title flex items-center gap-1.5">
                  <Scissors size={16} className="text-blue-600" />
                  AI가 포착한 극적 순간
                </h4>
                <p className="toss-card-desc">
                  각 구간의 앞뒤를 늘리거나 줄여서 원하는 만큼 다듬을 수 있어요.
                </p>
              </div>

              {segments.length > 0 && (
                <span className="toss-tag-gray">
                  총 {segments.length}개 구간 ({totalDuration.toFixed(1)}초)
                </span>
              )}
            </div>

            {segments.length === 0 ? (
              <div className="toss-empty-state">
                <p className="text-slate-400 text-sm">
                  영상을 올리고 오른쪽의 '✨ AI 하이라이트 만들기'를 누르면 극적 구간이 채워져요.
                </p>
              </div>
            ) : (
              <div className="toss-segment-list">
                {segments.map((seg, idx) => {
                  const isSelected = seg.id === currentSegment?.id;
                  const vItem = videoMap.get(seg.sourceVideoId);
                  return (
                    <div
                      key={seg.id}
                      className={`toss-segment-item ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectSegment(seg.id)}
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
                          <div className="flex items-center gap-1.5">
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
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 2-B. 오른쪽 열: 사운드트랙 & 인스펙터 & 액션 카드 */}
        <section className="toss-column-right">
          {/* 소스 영상 관리 카드 */}
          <div className="toss-card">
            <div className="toss-card-header">
              <h4 className="toss-card-title flex items-center gap-1.5">
                <Upload size={16} className="text-slate-700" />
                올린 영상 ({videos.length}개)
              </h4>
              <button
                type="button"
                className="toss-btn-sm-text"
                onClick={() => fileInputRef.current?.click()}
              >
                + 추가하기
              </button>
            </div>

            {videos.length === 0 ? (
              <div
                className="toss-upload-box"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} className="text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">여기를 눌러 영상을 올려주세요</span>
                <span className="text-[11px] text-slate-400">MP4, MOV 등 영상 파일 지원</span>
              </div>
            ) : (
              <div className="toss-source-list">
                {videos.map((vid, idx) => (
                  <div key={vid.id} className="toss-source-item">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {vid.thumbnailUrl && (
                        <img src={vid.thumbnailUrl} alt="" className="toss-source-thumb" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate" title={vid.name}>
                          #{idx + 1} {vid.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {vid.duration.toFixed(1)}초 • {vid.width}×{vid.height}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="toss-btn-delete-sm"
                      onClick={() => onRemoveVideo(vid.id)}
                      title="삭제"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 배경음악(BGM) 설정 카드 */}
          <div className="toss-card">
            <div className="toss-card-header">
              <div>
                <h4 className="toss-card-title flex items-center gap-1.5">
                  <Music size={16} className="text-blue-600" />
                  배경음악 (BGM)
                </h4>
                <p className="toss-card-desc">
                  영상의 분위기에 어울리는 무손실 앰비언트 음악을 골라보세요.
                </p>
              </div>
            </div>

            {/* BGM 볼륨 슬라이더 */}
            <div className="toss-bgm-volume-row">
              <span className="text-xs font-semibold text-slate-600">음악 볼륨</span>
              <div className="flex items-center gap-2">
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
            </div>

            {/* BGM 프리셋 목록 */}
            <div className="toss-bgm-list">
              {BGM_PRESETS.map((preset) => {
                const isSelected = selectedBgmId === preset.id;
                const isPreviewing = previewingBgmId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`toss-bgm-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedBgmId(preset.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">{preset.name}</span>
                        {isSelected && <Check size={13} className="text-blue-600" />}
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                        {preset.description}
                      </span>
                    </div>

                    {preset.id !== 'none' && (
                      <button
                        type="button"
                        className={`toss-bgm-preview-btn ${isPreviewing ? 'playing' : ''}`}
                        onClick={(e) => handleToggleBgmPreview(preset.id, e)}
                        title="미리듣기"
                      >
                        {isPreviewing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 세로 영상 16:9 인물 크롭 기준점 */}
          {currentSegment && (
            <div className="toss-card">
              <div className="toss-card-header">
                <div>
                  <h4 className="toss-card-title flex items-center gap-1.5">
                    <SlidersHorizontal size={15} className="text-slate-700" />
                    인물 크롭 기준 위치
                  </h4>
                  <p className="toss-card-desc">
                    세로로 찍힌 영상에서 인물의 얼굴이 잘리지 않도록 정렬해요.
                  </p>
                </div>
              </div>

              <div className="toss-segment-control">
                <button
                  type="button"
                  className={`toss-segment-btn ${(currentSegment.cropOffsetYRatio ?? 0.25) <= 0.25 ? 'active' : ''}`}
                  onClick={() => handleCropAnchorChange(currentSegment.id, 0.15)}
                >
                  상단 (얼굴 보호)
                </button>
                <button
                  type="button"
                  className={`toss-segment-btn ${(currentSegment.cropOffsetYRatio ?? 0.25) > 0.25 && (currentSegment.cropOffsetYRatio ?? 0.25) < 0.75 ? 'active' : ''}`}
                  onClick={() => handleCropAnchorChange(currentSegment.id, 0.5)}
                >
                  중앙
                </button>
                <button
                  type="button"
                  className={`toss-segment-btn ${(currentSegment.cropOffsetYRatio ?? 0.25) >= 0.75 ? 'active' : ''}`}
                  onClick={() => handleCropAnchorChange(currentSegment.id, 0.85)}
                >
                  하단
                </button>
              </div>
            </div>
          )}

          {/* 시간 절약 효과 요약 카드 */}
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

      {/* 3. 하단 고정 CTA 버튼 바 (Toss Floating Action Bar) */}
      <footer className="toss-bottom-bar">
        <div className="toss-bottom-inner">
          {videos.length === 0 ? (
            <button
              type="button"
              className="toss-cta-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={18} />
              <span>동영상 올리기</span>
            </button>
          ) : !result?.url ? (
            <button
              type="button"
              className={`toss-cta-button ${isProcessing ? 'loading' : ''}`}
              onClick={onStartAiAnalysis}
              disabled={isProcessing}
            >
              <Sparkles size={18} className={isProcessing ? 'animate-spin' : ''} />
              <span>{isProcessing ? 'AI가 극적인 순간을 찾는 중...' : '✨ AI 하이라이트 만들기'}</span>
            </button>
          ) : (
            <div className="toss-bottom-dual-actions">
              <button
                type="button"
                className="toss-btn-re-render"
                onClick={() => onReStitch(segments, selectedBgmId, bgmVolume)}
                disabled={isReStitching || segments.length === 0}
              >
                <Scissors size={15} />
                <span>{isReStitching ? '다시 병합 중...' : '수정된 타임라인 다시 병합'}</span>
              </button>

              <button
                type="button"
                className="toss-cta-button"
                onClick={handleDownload}
              >
                <Download size={18} />
                <span>🎉 16:9 완성 영상 다운로드하기 ({formatSec(totalDuration)})</span>
              </button>
            </div>
          )}
        </div>
      </footer>

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
    </div>
  );
};
