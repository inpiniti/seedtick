// components/result/ResultView.tsx - 완성된 극적 하이라이트 영상 및 챕터 뷰어

import React, { useRef } from 'react';
import { Download, RefreshCw, Film, Clock, Scissors, Zap } from 'lucide-react';
import type { FinalVideoResult } from '../../types/video.ts';

interface ResultViewProps {
  result: FinalVideoResult;
  onReset: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ result, onReset }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

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
    a.download = `reportist-highlight-${dateStr}-${timeStr}.webm`;
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

  return (
    <div className="result-container">
      {/* 완성 비디오 플레이어 */}
      <div className="result-video-wrapper">
        <video
          ref={videoRef}
          src={result.url}
          controls
          autoPlay
          playsInline
          className="result-video"
        />
      </div>

      {/* 다운로드 및 초기화 액션 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
        <div>
          <h3 className="text-base font-bold text-[#0f172a]">
            🎉 극적 하이라이트 영상이 완성되었어요!
          </h3>
          <p className="text-xs text-[#64748b]">
            브라우저에서 직접 이어붙여 생성된 고화질 영상이에요.
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
            <Film className="w-3.5 h-3.5 text-indigo-500" />
            병합된 극적 장면
          </div>
          <div className="kpi-value text-indigo-600">
            {result.segments.length}개 구간
          </div>
        </div>
      </div>

      {/* 추출된 극적 구간 챕터 목록 */}
      <div className="segments-list-card">
        <div className="segments-header">
          <span>AI가 포착한 극적 순간 타임라인</span>
          <span className="text-xs font-normal text-slate-500 font-mono">
            클릭하면 해당 장면으로 바로 이동해요
          </span>
        </div>

        <div>
          {result.segments.map((segment, idx) => (
            <div
              key={segment.id}
              className="segment-item"
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
              <div className="segment-source">
                {segment.sourceVideoName} ({segment.start.toFixed(1)}s ~ {segment.end.toFixed(1)}s)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
