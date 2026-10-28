// components/studio/ProStudioView.tsx - 프로 비디오 스튜디오 에디터 (Remotion / NLE 멀티트랙 타임라인, 오디오 파형, BGM, 세부 인스펙터)

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Volume1,
  Scissors,
  Download,
  Trash2,
  Copy,
  Music,
  Film,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Check,
  Radio,
  Clock,
  ArrowLeft,
  Settings2,
} from 'lucide-react';
import type { FinalVideoResult, HighlightSegment, VideoItem, BgmPreset } from '../../types/video.ts';
import { BGM_PRESETS, playBgmSynthLoop } from '../../services/audioSynth.ts';

interface ProStudioViewProps {
  result: FinalVideoResult;
  videos: VideoItem[];
  onReset: () => void;
  onReStitch: (
    updatedSegments: HighlightSegment[],
    bgmPresetId: string,
    bgmVolume: number
  ) => Promise<void>;
  isReStitching: boolean;
}

// 14px 유튜브 아이콘 컴포넌트
const YoutubeBadgeIcon: React.FC = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="#ef4444"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const ProStudioView: React.FC<ProStudioViewProps> = ({
  result,
  videos,
  onReset,
  onReStitch,
  isReStitching,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);

  // 1. 에디터 타임라인 상태
  const [segments, setSegments] = useState<HighlightSegment[]>(result.segments);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    result.segments[0]?.id || ''
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [timelineZoom, setTimelineZoom] = useState<number>(1.0); // 1.0 ~ 3.0
  const [activeLeftTab, setActiveLeftTab] = useState<'clips' | 'bgm'>('clips');

  // 2. BGM 오디오 상태
  const [selectedBgmId, setSelectedBgmId] = useState<string>('acoustic');
  const [bgmVolume, setBgmVolume] = useState<number>(0.3);
  const [previewingBgmId, setPreviewingBgmId] = useState<string | null>(null);
  const bgmPreviewControllerRef = useRef<{ stop: () => void } | null>(null);

  // 상위 결과 갱신 동기화
  useEffect(() => {
    setSegments(result.segments);
    if (result.segments[0]) {
      setSelectedSegmentId(result.segments[0].id);
    }
  }, [result]);

  // 비디오 재생 시간 추적
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
    };
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

  // 총 하이라이트 길이 계산
  const totalDuration = useMemo(() => {
    return segments.reduce((sum, s) => sum + s.duration, 0) || 1;
  }, [segments]);

  // 현재 선택된 세그먼트 객체
  const selectedSegment = useMemo(() => {
    return segments.find((s) => s.id === selectedSegmentId) || segments[0];
  }, [segments, selectedSegmentId]);

  // 비디오 ID 매핑 테이블
  const videoMap = useMemo(() => {
    const map = new Map<string, VideoItem>();
    videos.forEach((v) => map.set(v.id, v));
    return map;
  }, [videos]);

  // 구간별 누적 시작 시간 맵 (타임라인 상의 위치 계산)
  const segmentTimelineOffsets = useMemo(() => {
    let acc = 0;
    const offsets: Record<string, { startOffset: number; endOffset: number }> = {};
    segments.forEach((s) => {
      offsets[s.id] = {
        startOffset: acc,
        endOffset: acc + s.duration,
      };
      acc += s.duration;
    });
    return offsets;
  }, [segments]);

  // 타임라인 내 특정 세그먼트로 이동
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

  // 1초 뒤로 / 앞으로
  const handleStep = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(videoRef.current.duration || totalDuration, videoRef.current.currentTime + seconds)
      );
    }
  };

  // 타임라인 클릭/스크러빙 탐색
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = timelineTrackRef.current;
    if (!track || !videoRef.current) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = pct * totalDuration;
    videoRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
  };

  // 클립 시작/끝 트리밍 미세 조정
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

  // 클립 개별 볼륨 조정
  const handleClipVolumeChange = (segId: string, vol: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, volume: vol } : s))
    );
  };

  // 클립 세로 크롭 위치 조정 (0.0: 상단 ~ 0.5: 중앙 ~ 1.0: 하단)
  const handleClipCropOffsetChange = (segId: string, ratio: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, cropOffsetYRatio: ratio } : s))
    );
  };

  // 클립 삭제
  const handleDeleteSegment = (segId: string) => {
    const updated = segments.filter((s) => s.id !== segId);
    setSegments(updated);
    if (selectedSegmentId === segId && updated.length > 0) {
      setSelectedSegmentId(updated[0].id);
    }
  };

  // 클립 복제
  const handleDuplicateSegment = (segId: string) => {
    const target = segments.find((s) => s.id === segId);
    if (!target) return;
    const cloned: HighlightSegment = {
      ...target,
      id: `clone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: `${target.label || target.reason} (복제)`,
    };
    const idx = segments.findIndex((s) => s.id === segId);
    const updated = [...segments];
    updated.splice(idx + 1, 0, cloned);
    setSegments(updated);
    setSelectedSegmentId(cloned.id);
  };

  // BGM 미리듣기 토글
  const handleToggleBgmPreview = (presetId: string) => {
    if (previewingBgmId === presetId) {
      bgmPreviewControllerRef.current?.stop();
      bgmPreviewControllerRef.current = null;
      setPreviewingBgmId(null);
      return;
    }

    bgmPreviewControllerRef.current?.stop();
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const ctrl = playBgmSynthLoop(ctx, ctx.destination, presetId, bgmVolume);
      bgmPreviewControllerRef.current = {
        stop: () => {
          ctrl.stop();
          ctx.close().catch(() => {});
        },
      };
      setPreviewingBgmId(presetId);
    } catch (e) {
      console.warn('BGM 미리듣기 실패:', e);
    }
  };

  // 렌더링 & 내보내기 실행
  const handleTriggerReStitch = () => {
    bgmPreviewControllerRef.current?.stop();
    setPreviewingBgmId(null);
    onReStitch(segments, selectedBgmId, bgmVolume);
  };

  // 다운로드
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `reportist_highlight_16x9_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 타임코드 포맷팅 (00:04.2)
  const formatTimecode = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // 타임라인 플레이헤드 위치 (%)
  const playheadPercent = Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100));

  return (
    <div className="pro-studio-container">
      {/* 1. 상단 프로 스튜디오 네비게이션 헤더 (Remotion Studio 스타일) */}
      <header className="pro-studio-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="pro-studio-back-btn"
            onClick={onReset}
            title="새 프로젝트 만들기"
          >
            <ArrowLeft size={16} />
            <span>새 프로젝트</span>
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">PROJECT /</span>
            <span className="text-white font-bold">16:9 유튜브 하이라이트</span>
            <span className="studio-spec-badge">
              <YoutubeBadgeIcon />
              1280x720 HD • 30fps
            </span>
          </div>
        </div>

        {/* 우측 렌더링 및 다운로드 액션 */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="pro-studio-btn-sub"
            onClick={handleDownload}
            title="현재 완성된 영상 다운로드"
          >
            <Download size={14} />
            <span>다운로드 ({(result.fileSize / (1024 * 1024)).toFixed(1)}MB)</span>
          </button>

          <button
            type="button"
            className={`pro-studio-btn-render ${isReStitching ? 'loading' : ''}`}
            onClick={handleTriggerReStitch}
            disabled={isReStitching || segments.length === 0}
          >
            <Sparkles size={14} className={isReStitching ? 'animate-spin' : ''} />
            <span>
              {isReStitching ? '고화질 렌더링 중...' : '🚀 타임라인 반영 렌더링 (Render)'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. 메인 워크스페이스 (좌측 에셋 + 중앙 16:9 캔버스 + 우측 인스펙터) */}
      <div className="pro-studio-workspace">
        {/* 2-A. 좌측 패널 (AI 클립 목록 & BGM 사운드트랙) */}
        <aside className="pro-studio-left-panel">
          <div className="pro-studio-tab-bar">
            <button
              type="button"
              className={`pro-studio-tab-btn ${activeLeftTab === 'clips' ? 'active' : ''}`}
              onClick={() => setActiveLeftTab('clips')}
            >
              <Film size={14} />
              <span>AI 클립 ({segments.length})</span>
            </button>
            <button
              type="button"
              className={`pro-studio-tab-btn ${activeLeftTab === 'bgm' ? 'active' : ''}`}
              onClick={() => setActiveLeftTab('bgm')}
            >
              <Music size={14} />
              <span>배경음악 (BGM)</span>
            </button>
          </div>

          <div className="pro-studio-panel-content">
            {activeLeftTab === 'clips' && (
              <div className="clip-asset-list">
                {segments.map((seg, idx) => {
                  const vItem = videoMap.get(seg.sourceVideoId);
                  const isSelected = seg.id === selectedSegmentId;
                  return (
                    <div
                      key={seg.id}
                      className={`clip-asset-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectSegment(seg.id)}
                    >
                      <div className="clip-asset-thumb-box">
                        {vItem?.thumbnailUrl ? (
                          <img src={vItem.thumbnailUrl} alt={seg.sourceVideoName} className="clip-asset-thumb" />
                        ) : (
                          <Film size={18} className="text-slate-500" />
                        )}
                        <span className="clip-asset-dur-tag">{seg.duration.toFixed(1)}s</span>
                      </div>

                      <div className="clip-asset-info">
                        <div className="flex items-center justify-between gap-1">
                          <span className="clip-asset-badge">#{idx + 1}</span>
                          <span className="clip-asset-time">
                            {seg.start.toFixed(1)}s ~ {seg.end.toFixed(1)}s
                          </span>
                        </div>
                        <div className="clip-asset-title truncate">{seg.sourceVideoName}</div>
                        <div className="clip-asset-reason truncate" title={seg.reason}>
                          {seg.reason}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeLeftTab === 'bgm' && (
              <div className="bgm-asset-list">
                <div className="bgm-volume-card">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Music size={13} className="text-pink-400" />
                      배경음악 마스터 볼륨
                    </span>
                    <span className="text-pink-400 font-bold">{Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="pro-studio-slider"
                  />
                </div>

                {BGM_PRESETS.map((preset) => {
                  const isCurrent = selectedBgmId === preset.id;
                  const isPreviewing = previewingBgmId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={`bgm-asset-card ${isCurrent ? 'selected' : ''}`}
                      onClick={() => setSelectedBgmId(preset.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-white">{preset.name}</h5>
                            {isCurrent && (
                              <span className="bgm-active-tag">선택됨</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{preset.description}</p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-1.5">
                            <span className="text-indigo-400 font-semibold">{preset.mood}</span>
                            <span>•</span>
                            <span>{preset.tempo}</span>
                          </div>
                        </div>

                        {preset.id !== 'none' && (
                          <button
                            type="button"
                            className={`bgm-preview-btn ${isPreviewing ? 'playing' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBgmPreview(preset.id);
                            }}
                            title="BGM 미리듣기"
                          >
                            {isPreviewing ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* 2-B. 중앙 프리뷰 캔버스 및 트랜스포트 바 */}
        <section className="pro-studio-center-stage">
          <div className="pro-canvas-wrapper">
            <video
              ref={videoRef}
              src={result.url}
              playsInline
              className="pro-canvas-video"
            />
            {/* 16:9 시네마틱 뱃지 */}
            <div className="pro-canvas-overlay-badge">
              <YoutubeBadgeIcon />
              <span>16:9 PREVIEW</span>
            </div>
          </div>

          {/* 비디오 재생 트랜스포트 컨트롤 바 */}
          <div className="pro-transport-bar">
            {/* 좌측: 타임코드 */}
            <div className="pro-timecode-display">
              <span className="time-current">{formatTimecode(currentTime)}</span>
              <span className="time-sep">/</span>
              <span className="time-total">{formatTimecode(totalDuration)}</span>
            </div>

            {/* 중앙: 재생 컨트롤 */}
            <div className="pro-transport-controls">
              <button
                type="button"
                className="transport-btn"
                onClick={() => handleStep(-1)}
                title="1초 뒤로"
              >
                <SkipBack size={15} />
              </button>

              <button
                type="button"
                className="transport-play-btn"
                onClick={togglePlay}
                title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>

              <button
                type="button"
                className="transport-btn"
                onClick={() => handleStep(1)}
                title="1초 앞으로"
              >
                <SkipForward size={15} />
              </button>
            </div>

            {/* 우측: 볼륨 & 줌 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="transport-btn"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX size={15} /> : volume > 0.5 ? <Volume2 size={15} /> : <Volume1 size={15} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    setIsMuted(v === 0);
                    if (videoRef.current) videoRef.current.volume = Math.min(1, v);
                  }}
                  className="pro-studio-mini-slider"
                />
              </div>

              <div className="h-4 w-px bg-slate-700" />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="transport-btn"
                  onClick={() => setTimelineZoom((z) => Math.max(0.7, z - 0.2))}
                  title="타임라인 축소"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-[10px] font-mono text-slate-400 w-8 text-center">
                  {Math.round(timelineZoom * 100)}%
                </span>
                <button
                  type="button"
                  className="transport-btn"
                  onClick={() => setTimelineZoom((z) => Math.min(2.5, z + 0.2))}
                  title="타임라인 확대"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2-C. 우측 클립 인스펙터 (선택 클립 정밀 속성 수정) */}
        <aside className="pro-studio-right-panel">
          <div className="pro-inspector-header">
            <div className="flex items-center gap-2">
              <Sliders size={14} className="text-blue-400" />
              <h4 className="text-xs font-bold text-white">클립 인스펙터 (CLIP PROPERTIES)</h4>
            </div>
            <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
              #{segments.findIndex((s) => s.id === selectedSegment?.id) + 1}
            </span>
          </div>

          {selectedSegment ? (
            <div className="pro-inspector-body">
              {/* 클립 명칭 및 정보 */}
              <div className="inspector-group">
                <label className="inspector-label">클립 원본 소스</label>
                <div className="text-xs font-bold text-white truncate bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  {selectedSegment.sourceVideoName}
                </div>
              </div>

              {/* AI 포착 사유 */}
              <div className="inspector-group">
                <label className="inspector-label flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-400" />
                  AI 극적 감지 이유
                </label>
                <div className="text-xs text-slate-300 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 leading-relaxed">
                  {selectedSegment.reason}
                </div>
              </div>

              {/* 시작/종료 트리밍 정밀 제어 */}
              <div className="inspector-group">
                <label className="inspector-label">구간 트리밍 정밀 제어 (0.1초 단위)</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {/* 시작 시간 */}
                  <div className="trim-control-box">
                    <span className="trim-control-title">시작 (Start)</span>
                    <div className="trim-control-val">{selectedSegment.start.toFixed(1)}s</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <button
                        type="button"
                        className="trim-step-btn"
                        onClick={() => handleTrimChange(selectedSegment.id, 'start', -0.5)}
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        className="trim-step-btn"
                        onClick={() => handleTrimChange(selectedSegment.id, 'start', 0.5)}
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>

                  {/* 종료 시간 */}
                  <div className="trim-control-box">
                    <span className="trim-control-title">종료 (End)</span>
                    <div className="trim-control-val">{selectedSegment.end.toFixed(1)}s</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <button
                        type="button"
                        className="trim-step-btn"
                        onClick={() => handleTrimChange(selectedSegment.id, 'end', -0.5)}
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        className="trim-step-btn"
                        onClick={() => handleTrimChange(selectedSegment.id, 'end', 0.5)}
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-center text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 py-1.5 rounded">
                  클립 재생 길이: {selectedSegment.duration.toFixed(1)}초
                </div>
              </div>

              {/* 클립 개별 오디오 볼륨 */}
              <div className="inspector-group">
                <div className="flex items-center justify-between">
                  <label className="inspector-label flex items-center gap-1">
                    <Volume2 size={12} className="text-emerald-400" />
                    클립 개별 볼륨
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {Math.round((selectedSegment.volume ?? 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={selectedSegment.volume ?? 1.0}
                  onChange={(e) =>
                    handleClipVolumeChange(selectedSegment.id, parseFloat(e.target.value))
                  }
                  className="pro-studio-slider mt-1.5"
                />
              </div>

              {/* 16:9 세로 영상 인물 상체/얼굴 크롭 앵커 */}
              <div className="inspector-group">
                <label className="inspector-label">16:9 인물 스마트 크롭 위치</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <button
                    type="button"
                    className={`crop-preset-btn ${(selectedSegment.cropOffsetYRatio ?? 0.25) <= 0.25 ? 'active' : ''}`}
                    onClick={() => handleClipCropOffsetChange(selectedSegment.id, 0.15)}
                  >
                    상단 (얼굴)
                  </button>
                  <button
                    type="button"
                    className={`crop-preset-btn ${(selectedSegment.cropOffsetYRatio ?? 0.25) > 0.25 && (selectedSegment.cropOffsetYRatio ?? 0.25) < 0.75 ? 'active' : ''}`}
                    onClick={() => handleClipCropOffsetChange(selectedSegment.id, 0.5)}
                  >
                    중앙 (표준)
                  </button>
                  <button
                    type="button"
                    className={`crop-preset-btn ${(selectedSegment.cropOffsetYRatio ?? 0.25) >= 0.75 ? 'active' : ''}`}
                    onClick={() => handleClipCropOffsetChange(selectedSegment.id, 0.85)}
                  >
                    하단 (발밑)
                  </button>
                </div>
              </div>

              {/* 클립 액션 (복제 / 삭제) */}
              <div className="inspector-group pt-2 border-t border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  className="inspector-action-btn"
                  onClick={() => handleDuplicateSegment(selectedSegment.id)}
                  title="이 클립 복제하기"
                >
                  <Copy size={13} />
                  <span>복제</span>
                </button>

                <button
                  type="button"
                  className="inspector-action-btn delete"
                  onClick={() => handleDeleteSegment(selectedSegment.id)}
                  title="이 클립 제외하기"
                >
                  <Trash2 size={13} />
                  <span>삭제</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              선택된 클립이 없습니다.
            </div>
          )}
        </aside>
      </div>

      {/* 3. 하단 멀티트랙 NLE 타임라인 (Remotion Studio 스타일) */}
      <footer className="pro-studio-timeline-panel">
        {/* 타임라인 상단 룰러 및 스케일 눈금 */}
        <div className="timeline-header-bar">
          <div className="timeline-track-label-col">
            <span className="text-[11px] font-mono font-bold text-slate-400">TRACKS</span>
          </div>

          <div
            ref={timelineTrackRef}
            className="timeline-ruler-track"
            onClick={handleTimelineClick}
          >
            {/* 눈금선 (5초 간격) */}
            {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => {
              const sec = i * 5;
              const leftPct = (sec / (totalDuration || 1)) * 100;
              if (leftPct > 100) return null;
              return (
                <div key={i} className="timeline-ruler-tick" style={{ left: `${leftPct}%` }}>
                  <span className="timeline-ruler-text">{formatTimecode(sec).slice(0, 5)}</span>
                </div>
              );
            })}

            {/* 빨간색 플레이헤드 스크러버 바 */}
            <div
              className="timeline-playhead-line"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="timeline-playhead-cap" />
            </div>
          </div>
        </div>

        {/* 트랙 1: 🏷️ 챕터 트랙 (AI 극적 구간 명칭) */}
        <div className="timeline-track-row">
          <div className="timeline-track-title">
            <Sparkles size={12} className="text-amber-400" />
            <span>CHAPTERS</span>
          </div>
          <div className="timeline-track-content">
            {segments.map((seg) => {
              const widthPct = (seg.duration / (totalDuration || 1)) * 100;
              const isSelected = seg.id === selectedSegmentId;
              return (
                <div
                  key={seg.id}
                  className={`timeline-chapter-block ${isSelected ? 'selected' : ''}`}
                  style={{ width: `${widthPct}%` }}
                  onClick={() => handleSelectSegment(seg.id)}
                  title={`${seg.sourceVideoName} - ${seg.reason}`}
                >
                  <span className="truncate text-[10px] font-bold text-amber-300">
                    {seg.label || seg.reason}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 트랙 2: 🎬 비디오 클립 트랙 (필름스트립 & 트리밍 핸들) */}
        <div className="timeline-track-row video-track">
          <div className="timeline-track-title">
            <Film size={12} className="text-blue-400" />
            <span>VIDEO 1</span>
          </div>

          <div className="timeline-track-content">
            {segments.map((seg, idx) => {
              const vItem = videoMap.get(seg.sourceVideoId);
              const widthPct = (seg.duration / (totalDuration || 1)) * 100;
              const isSelected = seg.id === selectedSegmentId;

              return (
                <div
                  key={seg.id}
                  className={`timeline-clip-block ${isSelected ? 'selected' : ''}`}
                  style={{ width: `${widthPct}%` }}
                  onClick={() => handleSelectSegment(seg.id)}
                >
                  {/* 좌측 트리밍 핸들 */}
                  <div
                    className="timeline-trim-handle left"
                    title="시작 지점 -0.5s"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrimChange(seg.id, 'start', -0.5);
                    }}
                  />

                  {/* 썸네일 필름스트립 배경 */}
                  <div className="timeline-clip-filmstrip">
                    {vItem?.thumbnailUrl && (
                      <img src={vItem.thumbnailUrl} alt="" className="timeline-clip-thumb" />
                    )}
                    <div className="timeline-clip-meta">
                      <span className="font-bold">#{idx + 1} {seg.sourceVideoName}</span>
                      <span className="font-mono">{seg.duration.toFixed(1)}s</span>
                    </div>
                  </div>

                  {/* 우측 트리밍 핸들 */}
                  <div
                    className="timeline-trim-handle right"
                    title="종료 지점 +0.5s"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrimChange(seg.id, 'end', 0.5);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 트랙 3: 🎵 사운드트랙 / BGM 파형 트랙 (Waveform & Soundtrack) */}
        <div className="timeline-track-row audio-track">
          <div className="timeline-track-title">
            <Music size={12} className="text-emerald-400" />
            <span>SOUNDTRACK</span>
          </div>

          <div className="timeline-track-content">
            <div className="timeline-audio-block">
              {/* SVG 오디오 파형 시각화 */}
              <div className="timeline-audio-waveform">
                {Array.from({ length: 64 }).map((_, i) => {
                  const h = 20 + Math.sin(i * 0.45) * 15 + Math.cos(i * 0.8) * 10;
                  return (
                    <div
                      key={i}
                      className="timeline-waveform-bar"
                      style={{ height: `${Math.max(6, Math.min(36, h))}px` }}
                    />
                  );
                })}
              </div>

              <div className="timeline-audio-meta">
                <span className="font-bold text-emerald-300">
                  {BGM_PRESETS.find((b) => b.id === selectedBgmId)?.name || '배경음악'}
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono">
                  볼륨 {Math.round(bgmVolume * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
