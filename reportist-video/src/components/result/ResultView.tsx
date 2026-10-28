// components/result/ResultView.tsx - 완성된 극적 하이라이트 영상 및 챕터 뷰어 (구간 삭제 & 16:9 유튜브 규격)

import React, { useRef, useState, useEffect } from 'react';
import { Download, RefreshCw, Film, Clock, Scissors, Zap, Trash2, RotateCcw } from 'lucide-react';
import type { FinalVideoResult, HighlightSegment } from '../../types/video.ts';

const YoutubeIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 15,
  className = 'youtube-badge-icon',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="#ef4444"
    className={className}
    style={{
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      maxWidth: size,
      maxHeight: size,
      display: 'inline-block',
      verticalAlign: 'middle',
      flexShrink: 0,
    }}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface ResultViewProps {
  result: FinalVideoResult;
  onReset: () => void;
  onReStitch?: (updatedSegments: HighlightSegment[]) => Promise<void>;
  isReStitching?: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  onReset,
  onReStitch,
  isReStitching = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [segments, setSegments] = useState<HighlightSegment[]>(result.segments);

  // 상위 결과가 갱신되면 로컬 구간 목록도 동기화
  useEffect(() => {
    setSegments(result.segments);
  }, [result.segments]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 시간 압축률 계산
  const compressionRatio =
    result.originalTotalDuration > 0
      ? Math.max(0, Math.round((1 - result.duration / result.originalTotalDuration) * 100))
      : 0;

  // 다운로드 핸들러
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = result.url;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    a.download = `reportist-highlight-16x9-${dateStr}-${timeStr}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 챕터 클릭 시 해당 위치로 시크
  const handleSeekToSegment = (segIndex: number) => {
    if (!videoRef.current) return;
    let accumulatedTime = 0;
    for (let i = 0; i < segIndex; i++) {
      accumulatedTime += result.segments[i].duration;
    }
    videoRef.current.currentTime = accumulatedTime;
    videoRef.current.play().catch(() => {});
  };

  // 특정 하이라이트 구간 삭제 핸들러
  const handleDeleteSegment = (segId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSegments((prev) => prev.filter((s) => s.id !== segId));
  };

  // 원본 추출 구간으로 되돌리기
  const handleResetSegments = () => {
    setSegments(result.segments);
  };

  const hasModifications = segments.length !== result.segments.length;
  const currentTotalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="result-container">
      {/* 완성 비디오 플레이어 (16:9 유튜브 비율) */}
      <div className="result-video-wrapper">
        <video
          ref={videoRef}
          src={result.url}
          controls
          autoPlay
          playsInline
          className="result-video"
        />
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-white/90 border border-white/20 flex items-center gap-1.5">
          <YoutubeIcon size={14} />
          <span>16:9 HD (1280x720)</span>
        </div>
      </div>

      {/* 다운로드 및 초기화 액션 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
        <div>
          <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
            <span>🎉 16:9 유튜브 맞춤 하이라이트 영상 완성!</span>
          </h3>
          <p className="text-xs text-[#64748b]">
            가로/세로 비율에 맞춰 인물 중심으로 16:9 규격화되고 멈춤 구간 없이 매끄럽게 병합되었어요.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary" onClick={onReset}>
            <RefreshCw className="w-4 h-4 text-slate-500" />
            새로 만들기
          </button>
          <button type="button" className="btn-primary" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            영상 다운로드 ({formatSize(result.fileSize)})
          </button>
        </div>
      </div>

      {/* KPI 통계 요약 카드 (Reportist Admin 스타일) */}
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            하이라이트 길이
          </div>
          <div className="kpi-value text-blue-600">
            {formatDuration(result.duration)}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            원본 영상 총합
          </div>
          <div className="kpi-value text-slate-700">
            {formatDuration(result.originalTotalDuration)}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-emerald-500" />
            시간 절약률
          </div>
          <div className="kpi-value text-emerald-600">
            {compressionRatio}% 단축
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-1.5">
            <YoutubeIcon size={14} />
            유튜브 화면 비율
          </div>
          <div className="kpi-value text-slate-800 text-lg">
            16:9 (1280x720)
          </div>
        </div>
      </div>

      {/* 추출된 극적 구간 타임라인 및 직접 삭제/재병합 컨트롤러 */}
      <div className="segments-list-card">
        <div className="segments-header">
          <div>
            <span className="text-base font-bold text-slate-900">AI가 포착한 극적 순간 타임라인</span>
            <p className="text-xs font-normal text-slate-500 mt-0.5">
              마음에 들지 않는 구간은 우측 휴지통 버튼으로 직접 삭제하고 다시 병합할 수 있어요.
            </p>
          </div>
          <span className="text-xs font-mono text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
            {segments.length}개 구간 ({formatDuration(currentTotalDuration)})
          </span>
        </div>

        {/* 구간 삭제 시 실시간 재병합 안내 배너 */}
        {hasModifications && (
          <div className="restitch-action-banner">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-600 animate-pulse" />
              <div>
                <span className="font-bold text-amber-900 text-sm">
                  {result.segments.length - segments.length}개 구간이 제외되었습니다.
                </span>
                <span className="text-xs text-amber-700 ml-2">
                  (남은 {segments.length}개 구간: 약 {currentTotalDuration.toFixed(1)}초)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary py-1.5 px-3 text-xs"
                onClick={handleResetSegments}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                원래대로 복구
              </button>
              <button
                type="button"
                className="btn-primary py-1.5 px-3.5 text-xs shadow-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={() => onReStitch?.(segments)}
                disabled={isReStitching || segments.length === 0}
              >
                {isReStitching ? '새로 병합 중...' : '✂️ 수정된 구간으로 즉시 다시 병합하기'}
              </button>
            </div>
          </div>
        )}

        {/* 구간 리스트 */}
        <div className="segments-list-scroll">
          {segments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
              모든 구간이 제외되었습니다. '원래대로 복구' 버튼을 눌러 구간을 되돌려보세요.
            </div>
          ) : (
            segments.map((segment, idx) => (
              <div
                key={segment.id}
                className="segment-item group"
                onClick={() => handleSeekToSegment(idx)}
                title="클릭하여 이 장면으로 이동"
              >
                <div className="segment-left">
                  <span className="segment-badge">
                    #{idx + 1} ({segment.duration.toFixed(1)}초)
                  </span>
                  <span className="segment-reason">
                    {segment.reason}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="segment-source">
                    {segment.sourceVideoName} ({segment.start.toFixed(1)}s ~ {segment.end.toFixed(1)}s)
                  </div>
                  <button
                    type="button"
                    className="segment-delete-btn"
                    title="이 하이라이트 구간 제외하기"
                    onClick={(e) => handleDeleteSegment(segment.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-500 hover:!text-red-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
