import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scissors,
  X,
  Play,
  Pause,
  RotateCcw,
  Check,
  Clock,
  Film,
  Sparkles,
  Info,
} from 'lucide-react';
import type { HighlightSegment, VideoItem } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

export interface SegmentTrimModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment: HighlightSegment | null;
  sourceVideo: VideoItem | undefined;
  onSave: (segId: string, newStart: number, newEnd: number) => void;
}

function formatTime(sec: number): string {
  const safeSec = Math.max(0, isNaN(sec) ? 0 : sec);
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export const SegmentTrimModal: React.FC<SegmentTrimModalProps> = ({
  isOpen,
  onClose,
  segment,
  sourceVideo,
  onSave,
}) => {
  const { dict } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ambientVideoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [start, setStart] = useState<number>(0);
  const [end, setEnd] = useState<number>(5);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(100);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Dragging refs
  const isDraggingRef = useRef<boolean>(false);
  const wasPlayingBeforeDragRef = useRef<boolean>(false);

  // Modal scroll lock
  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.segment-trim-modal-body, [data-modal-scrollable="true"]',
  });

  // Init when segment or open state changes
  useEffect(() => {
    if (!isOpen || !segment) return;
    const initialStart = Math.max(0, Math.round((segment.start || 0) * 10) / 10);
    const initialEnd = Math.max(initialStart + 0.5, Math.round((segment.end || initialStart + 3) * 10) / 10);
    setStart(initialStart);
    setEnd(initialEnd);
    setCurrentTime(initialStart);
    setIsPlaying(false);
    setIsPreviewing(false);
    setIsDragging(false);
    isDraggingRef.current = false;

    const videoDur = sourceVideo?.duration || segment.duration || 100;
    setDuration(videoDur);

    if (videoRef.current) {
      videoRef.current.currentTime = initialStart;
    }
    if (ambientVideoRef.current) {
      ambientVideoRef.current.currentTime = initialStart;
    }
  }, [isOpen, segment, sourceVideo]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const maxDuration = Math.max(duration, end, 1);
  const clipDuration = Math.max(0, Math.round((end - start) * 10) / 10);

  // Video Loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const realDur = videoRef.current.duration;
      if (realDur && !isNaN(realDur) && isFinite(realDur)) {
        setDuration(realDur);
      }
      videoRef.current.currentTime = start;
    }
    if (ambientVideoRef.current && videoRef.current) {
      ambientVideoRef.current.currentTime = videoRef.current.currentTime;
    }
  };

  // Video time update
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    if (!isDraggingRef.current) {
      setCurrentTime(cur);
    }

    // Sync ambient video when playing
    if (ambientVideoRef.current) {
      const diff = Math.abs(ambientVideoRef.current.currentTime - cur);
      if (diff > 0.35) {
        ambientVideoRef.current.currentTime = cur;
      }
    }

    // Range preview auto-stop
    if (isPreviewing && cur >= end) {
      videoRef.current.pause();
      videoRef.current.currentTime = start;
      if (ambientVideoRef.current) {
        ambientVideoRef.current.pause();
        ambientVideoRef.current.currentTime = start;
      }
      setIsPlaying(false);
      setIsPreviewing(false);
    }
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    const v = videoRef.current;
    const amb = ambientVideoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      amb?.pause();
      setIsPlaying(false);
      setIsPreviewing(false);
    } else {
      v.play().catch(() => {});
      amb?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Range preview
  const handleTogglePreviewRange = () => {
    const v = videoRef.current;
    const amb = ambientVideoRef.current;
    if (!v) return;

    if (isPreviewing) {
      v.pause();
      amb?.pause();
      setIsPlaying(false);
      setIsPreviewing(false);
    } else {
      v.currentTime = start;
      if (amb) amb.currentTime = start;
      v.play().catch(() => {});
      amb?.play().catch(() => {});
      setIsPlaying(true);
      setIsPreviewing(true);
    }
  };

  // Seek helper by clientX
  const seekByClientX = useCallback((clientX: number) => {
    const bar = timelineRef.current;
    const v = videoRef.current;
    if (!bar || !v) return;

    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = clickX / rect.width;
    const targetTime = Math.max(0, Math.min(maxDuration, Math.round(ratio * maxDuration * 10) / 10));

    v.currentTime = targetTime;
    if (ambientVideoRef.current) {
      ambientVideoRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
  }, [maxDuration]);

  // Pointer Down (Mouse & Touch scrub start)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDraggingRef.current = true;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const v = videoRef.current;
    if (v && !v.paused) {
      wasPlayingBeforeDragRef.current = true;
      v.pause();
      ambientVideoRef.current?.pause();
      setIsPlaying(false);
    } else {
      wasPlayingBeforeDragRef.current = false;
    }

    seekByClientX(e.clientX);
  };

  // Pointer Move (Scrubbing)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    seekByClientX(e.clientX);
  };

  // Pointer Up (Scrub end)
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    seekByClientX(e.clientX);

    if (wasPlayingBeforeDragRef.current && videoRef.current) {
      videoRef.current.play().catch(() => {});
      ambientVideoRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Pointer Cancel
  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Start delta change
  const handleStartDelta = (delta: number) => {
    const newStart = Math.max(0, Math.min(end - 0.5, Math.round((start + delta) * 10) / 10));
    setStart(newStart);
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
      if (ambientVideoRef.current) ambientVideoRef.current.currentTime = newStart;
      setCurrentTime(newStart);
    }
  };

  // End delta change
  const handleEndDelta = (delta: number) => {
    const newEnd = Math.max(start + 0.5, Math.min(maxDuration, Math.round((end + delta) * 10) / 10));
    setEnd(newEnd);
    if (videoRef.current) {
      videoRef.current.currentTime = newEnd;
      if (ambientVideoRef.current) ambientVideoRef.current.currentTime = newEnd;
      setCurrentTime(newEnd);
    }
  };

  // Set current playhead as start
  const handleSetCurrentAsStart = () => {
    const newStart = Math.max(0, Math.min(end - 0.5, Math.round(currentTime * 10) / 10));
    setStart(newStart);
  };

  // Set current playhead as end
  const handleSetCurrentAsEnd = () => {
    const newEnd = Math.max(start + 0.5, Math.min(maxDuration, Math.round(currentTime * 10) / 10));
    setEnd(newEnd);
  };

  // Reset to original AI suggested range
  const handleResetToAi = () => {
    if (!segment) return;
    const s = Math.max(0, Math.round((segment.start || 0) * 10) / 10);
    const e = Math.max(s + 0.5, Math.round((segment.end || s + 3) * 10) / 10);
    setStart(s);
    setEnd(e);
    if (videoRef.current) {
      videoRef.current.currentTime = s;
      if (ambientVideoRef.current) ambientVideoRef.current.currentTime = s;
      setCurrentTime(s);
    }
  };

  // Save changes
  const handleSave = () => {
    if (!segment || clipDuration < 0.5) return;
    onSave(segment.id, start, end);
    onClose();
  };

  if (!isOpen || !segment || !sourceVideo) return null;

  // Start & End positions in percent
  const startPercent = Math.max(0, Math.min(100, (start / maxDuration) * 100));
  const endPercent = Math.max(0, Math.min(100, (end / maxDuration) * 100));
  const widthPercent = Math.max(0, endPercent - startPercent);
  const playheadPercent = Math.max(0, Math.min(100, (currentTime / maxDuration) * 100));

  const t = dict.trimModal || {
    title: '클립 구간 세밀 편집',
    subtitle: '원본 영상의 원하는 시작과 끝 지점을 직접 보면서 조절하세요.',
    play: '재생',
    pause: '일시정지',
    previewRange: '선택 구간 미리보기',
    stopPreview: '미리보기 정지',
    currentTime: '현재 시점',
    totalDuration: '전체 길이',
    startTime: '시작 지점',
    endTime: '종료 지점',
    duration: '클립 길이',
    setCurrentAsStart: '현재 위치를 시작으로',
    setCurrentAsEnd: '현재 위치를 끝으로',
    apply: '구간 적용하기',
    cancel: '취소',
    minDurationWarning: '클립 길이는 최소 0.5초 이상이어야 해요.',
    seekHint: '타임라인을 클릭하거나 재생하며 원하는 장면을 찾아보세요.',
  };

  const rotationStyle = segment.rotation
    ? { transform: `rotate(${segment.rotation}deg)` }
    : undefined;

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop segment-trim-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="model-modal-card segment-trim-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="segment-trim-modal-title"
      >
        {/* Header */}
        <div className="model-modal-header segment-trim-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge segment-trim-icon-badge">
              <Scissors size={20} color="#0f172a" />
            </div>
            <div className="model-modal-titles">
              <h2 id="segment-trim-modal-title" className="model-modal-title">
                {t.title}
              </h2>
              <p className="model-modal-subtitle">
                <span className="font-semibold text-slate-700">{sourceVideo.name}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{segment.subtitleTitle || segment.reason}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={t.cancel}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="segment-trim-modal-body" data-modal-scrollable="true">
          {/* Video Player Box */}
          <div className="segment-trim-player-container">
            <div className="segment-trim-video-wrapper">
              {/* Ambient blurred backdrop to eliminate black empty side bars */}
              <video
                ref={ambientVideoRef}
                src={sourceVideo.url}
                className="segment-trim-video-ambient-bg"
                aria-hidden="true"
                tabIndex={-1}
                playsInline
                muted
                preload="metadata"
                style={rotationStyle}
              />

              {/* Main crisp video */}
              <video
                ref={videoRef}
                src={sourceVideo.url}
                className="segment-trim-video"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => {
                  setIsPlaying(true);
                  ambientVideoRef.current?.play().catch(() => {});
                }}
                onPause={() => {
                  setIsPlaying(false);
                  ambientVideoRef.current?.pause();
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setIsPreviewing(false);
                  ambientVideoRef.current?.pause();
                }}
                playsInline
                preload="metadata"
                style={rotationStyle}
              />

              {/* Video Overlay Info */}
              <div className="segment-trim-video-overlay-bar">
                <span className="segment-trim-time-badge">
                  {formatTime(currentTime)} / {formatTime(maxDuration)}
                </span>
                {Boolean(segment.rotation) && (
                  <span className="segment-trim-rot-badge">
                    <RotateCcw size={10} /> {segment.rotation}°
                  </span>
                )}
              </div>
            </div>

            {/* Quick Play & Preview Controls */}
            <div className="segment-trim-playback-bar">
              <button
                type="button"
                className={`segment-trim-ctrl-btn ${isPlaying && !isPreviewing ? 'active' : ''}`}
                onClick={togglePlay}
                title={isPlaying ? t.pause : t.play}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                <span>{isPlaying ? t.pause : t.play}</span>
              </button>

              <button
                type="button"
                className={`segment-trim-ctrl-btn segment-trim-preview-btn ${isPreviewing ? 'active' : ''}`}
                onClick={handleTogglePreviewRange}
                title={isPreviewing ? t.stopPreview : t.previewRange}
              >
                {isPreviewing ? <Pause size={15} /> : <Play size={15} />}
                <span>{isPreviewing ? t.stopPreview : t.previewRange}</span>
              </button>

              <button
                type="button"
                className="segment-trim-ctrl-btn-text"
                onClick={handleResetToAi}
                title="AI가 추천했던 원래 구간으로 복원"
              >
                <Sparkles size={13} className="text-blue-500" />
                <span>AI 원본 복원</span>
              </button>
            </div>
          </div>

          {/* Interactive Timeline Bar (Draggable Scrubbing Track) */}
          <div className="segment-trim-timeline-section">
            <div className="segment-trim-timeline-head">
              <span className="segment-trim-timeline-label">
                <Film size={13} className="text-blue-600" />
                <span>타임라인 구간 선택</span>
              </span>
              <span className="segment-trim-timeline-hint">
                {t.seekHint}
              </span>
            </div>

            <div
              ref={timelineRef}
              className={`segment-trim-timeline-track ${isDragging ? 'is-dragging' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              title="타임라인을 누르거나 빨간색 선을 드래그하여 재생 위치를 탐색하세요"
            >
              {/* Selected highlight range */}
              <div
                className="segment-trim-selected-range"
                style={{
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                }}
              >
                <span className="segment-trim-range-badge">
                  {clipDuration.toFixed(1)}s
                </span>
              </div>

              {/* Current Playhead indicator (Draggable Red Line) */}
              <div
                className={`segment-trim-playhead ${isDragging ? 'active' : ''}`}
                style={{ left: `${playheadPercent}%` }}
              >
                <div className="segment-trim-playhead-handle" />
              </div>
            </div>

            <div className="segment-trim-timeline-footer-times">
              <span>00:00.0</span>
              <span className="font-semibold text-blue-600">
                선택 구간: {formatTime(start)} ~ {formatTime(end)} ({clipDuration.toFixed(1)}초)
              </span>
              <span>{formatTime(maxDuration)}</span>
            </div>
          </div>

          {/* Fine Tuning Controllers Grid */}
          <div className="segment-trim-grid">
            {/* Start Controller Card */}
            <div className="segment-trim-card">
              <div className="segment-trim-card-header">
                <span className="segment-trim-card-title">
                  <Clock size={13} className="text-blue-600" />
                  {t.startTime}
                </span>
                <span className="segment-trim-card-value">{formatTime(start)}</span>
              </div>

              <div className="segment-trim-delta-buttons">
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleStartDelta(-1.0)}
                  title="-1.0초"
                >
                  -1s
                </button>
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleStartDelta(-0.1)}
                  title="-0.1초"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleStartDelta(0.1)}
                  title="+0.1초"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleStartDelta(1.0)}
                  title="+1.0초"
                >
                  +1s
                </button>
              </div>

              <button
                type="button"
                className="segment-trim-set-current-btn"
                onClick={handleSetCurrentAsStart}
              >
                <span className="segment-trim-btn-label-long">📍 {t.setCurrentAsStart}</span>
                <span className="segment-trim-btn-label-short">📍 시작점으로</span>
                <span className="segment-trim-btn-subtime">({formatTime(currentTime)})</span>
              </button>
            </div>

            {/* End Controller Card */}
            <div className="segment-trim-card">
              <div className="segment-trim-card-header">
                <span className="segment-trim-card-title">
                  <Clock size={13} className="text-blue-600" />
                  {t.endTime}
                </span>
                <span className="segment-trim-card-value">{formatTime(end)}</span>
              </div>

              <div className="segment-trim-delta-buttons">
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleEndDelta(-1.0)}
                  title="-1.0초"
                >
                  -1s
                </button>
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleEndDelta(-0.1)}
                  title="-0.1초"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleEndDelta(0.1)}
                  title="+0.1초"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  className="segment-trim-delta-btn"
                  onClick={() => handleEndDelta(1.0)}
                  title="+1.0초"
                >
                  +1s
                </button>
              </div>

              <button
                type="button"
                className="segment-trim-set-current-btn"
                onClick={handleSetCurrentAsEnd}
              >
                <span className="segment-trim-btn-label-long">📍 {t.setCurrentAsEnd}</span>
                <span className="segment-trim-btn-label-short">📍 끝점으로</span>
                <span className="segment-trim-btn-subtime">({formatTime(currentTime)})</span>
              </button>
            </div>
          </div>

          {/* Notice Bar */}
          <div className="segment-trim-notice">
            <Info size={14} className="shrink-0 text-blue-600 mt-0.5" />
            <p className="text-[12px] text-slate-600 leading-snug">
              구간을 수정한 후 <strong>{t.apply}</strong>을 누르면 타임라인에 즉시 반영되며, 상단의 <strong>다시 병합</strong> 버튼을 통해 최종 영상에 적용돼요.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="segment-trim-modal-footer">
          <div className="segment-trim-footer-info">
            <span className="segment-trim-footer-label">{t.duration}:</span>
            <span className="segment-trim-footer-duration">{clipDuration.toFixed(1)}초</span>
          </div>

          <div className="segment-trim-footer-btns">
            <button
              type="button"
              className="segment-trim-cancel-btn"
              onClick={onClose}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="segment-trim-apply-btn"
              onClick={handleSave}
              disabled={clipDuration < 0.5}
            >
              <Check size={16} />
              <span>{t.apply}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
