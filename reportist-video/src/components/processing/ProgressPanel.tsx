// components/processing/ProgressPanel.tsx - AI 하이라이트 생성 진행 상태 패널 (실시간 썸네일, 분석 요약, 추론 로그 콘솔)

import React, { useEffect, useRef } from 'react';
import {
  Sparkles,
  XCircle,
  Film,
  Terminal,
  Clock,
  Scissors,
  CheckCircle2,
  Video,
  Activity,
} from 'lucide-react';
import type { ProcessingProgress, VideoItem } from '../../types/video.ts';

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

interface ProgressPanelProps {
  progress: ProcessingProgress;
  videos: VideoItem[];
  onCancel: () => void;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  progress,
  videos,
  onCancel,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // 새 로그 추가 시 자동 스크롤
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress.reasoningLogs, progress.liveReasoning, progress.liveContent]);

  const getPhaseStepClass = (targetPhase: 'extract' | 'compress' | 'analyze' | 'stitch') => {
    const normalizedCurrent = progress.currentPhase === 'extract' ? 'compress' : progress.currentPhase;
    const normalizedTarget = targetPhase === 'extract' ? 'compress' : targetPhase;
    const phases = ['compress', 'analyze', 'stitch', 'done'];
    const currentIndex = phases.indexOf(normalizedCurrent);
    const targetIndex = phases.indexOf(normalizedTarget);

    if (currentIndex > targetIndex) return 'done';
    if (currentIndex === targetIndex) return 'active';
    return '';
  };

  const currentVideo = videos[progress.currentVideoIndex] || videos[0];
  const analyzedVideos = videos.filter((v) => v.status === 'analyzed' && v.segments.length > 0);

  return (
    <div className="progress-card">
      {/* 헤더 및 진행 상태 */}
      <div className="progress-header">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          AI 극적 장면 탐색 & 16:9 시네마틱 렌더링
        </div>
        <h2 className="progress-title">
          {progress.totalVideos > 0
            ? `영상 분석 및 하이라이트 병합 중 (${Math.min(progress.currentVideoIndex + 1, progress.totalVideos)}/${progress.totalVideos})`
            : '하이라이트 생성 준비 중...'}
        </h2>
        <p className="progress-desc">
          지루한 빌드업을 덜어내고, 인물에 맞춘 16:9 유튜브 규격으로 가장 결정적인 순간만 엮고 있어요.
        </p>
      </div>

      {/* 3단계 파이프라인 인디케이터 */}
      <div className="pipeline-steps">
        <div className={`pipeline-step-item ${getPhaseStepClass('compress')}`}>
          <div className="pipeline-step-dot">1</div>
          <span>주요 프레임 추출</span>
        </div>
        <div className="text-slate-300">→</div>
        <div className={`pipeline-step-item ${getPhaseStepClass('analyze')}`}>
          <div className="pipeline-step-dot">2</div>
          <span>AI 극적 구간 분석</span>
        </div>
        <div className="text-slate-300">→</div>
        <div className={`pipeline-step-item ${getPhaseStepClass('stitch')}`}>
          <div className="pipeline-step-dot">3</div>
          <span>16:9 무결점 병합</span>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.max(5, progress.progressPercent)}%` }}
        ></div>
      </div>

      {/* 상태 메시지 */}
      <div className="progress-status-text">
        {progress.statusMessage || '잠시만 기다려주세요...'}
      </div>

      {/* 1. 지금 작업 중인 영상 쇼케이스 카드 */}
      {currentVideo && (
        <div className="current-video-card">
          <div className="current-video-thumb-wrapper">
            {currentVideo.thumbnailUrl ? (
              <img
                src={currentVideo.thumbnailUrl}
                alt={currentVideo.name}
                className="current-video-thumb"
              />
            ) : (
              <div className="current-video-thumb-placeholder">
                <Video className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div className="current-video-badge">
              <Activity className="w-3 h-3 text-blue-400 animate-pulse" />
              <span>현재 분석 중</span>
            </div>
          </div>

          <div className="current-video-info">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                #{progress.currentVideoIndex + 1}
              </span>
              <h4 className="text-sm font-bold text-slate-800 truncate" title={currentVideo.name}>
                {currentVideo.name}
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                원본 {currentVideo.duration.toFixed(1)}초
              </span>
              <span>•</span>
              <span>{currentVideo.width}x{currentVideo.height}</span>
              <span>•</span>
              <span className="text-blue-600 font-semibold flex items-center gap-1">
                <YoutubeIcon size={14} />
                16:9 커버 크롭 예정
              </span>
            </div>

            <div className="current-video-stage-pill">
              {progress.currentPhase === 'extract' && '📸 캔버스 기반 14개 핵심 프레임 추출 중...'}
              {progress.currentPhase === 'analyze' && '🧠 Google Gemma 4 31B 멀티모달 긴장도(Tension) 추론 중...'}
              {progress.currentPhase === 'stitch' && '✂️ 16:9 유튜브 시네마틱 캔버스(1280x720) 무결점 병합 중...'}
              {progress.currentPhase === 'compress' && '⚡ 프레임 리샘플링 중...'}
            </div>
          </div>
        </div>
      )}

      {/* 2. 분석 완료된 영상 하이라이트 요약 피드 */}
      {analyzedVideos.length > 0 && (
        <div className="analyzed-section">
          <div className="analyzed-header">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-700">AI 극적 구간 감지 완료 ({analyzedVideos.length}개)</span>
          </div>

          <div className="analyzed-grid">
            {analyzedVideos.map((vid, idx) => {
              const segTotal = vid.segments.reduce((sum, s) => sum + s.duration, 0);
              const savePct = Math.max(0, Math.round((1 - segTotal / (vid.duration || 1)) * 100));

              return (
                <div key={vid.id} className="analyzed-card">
                  <div className="analyzed-thumb-box">
                    {vid.thumbnailUrl ? (
                      <img src={vid.thumbnailUrl} alt={vid.name} className="analyzed-thumb" />
                    ) : (
                      <div className="analyzed-thumb-placeholder">
                        <Film className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <span className="analyzed-save-tag">-{savePct}%</span>
                  </div>

                  <div className="analyzed-content">
                    <div className="text-xs font-bold text-slate-800 truncate" title={vid.name}>
                      {vid.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 my-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{vid.duration.toFixed(1)}s → <b className="text-blue-600">{segTotal.toFixed(1)}s</b></span>
                      <span className="text-emerald-600 font-semibold">({vid.segments.length}개 구간)</span>
                    </div>

                    <div className="analyzed-reasons">
                      {vid.segments.map((s, sIdx) => (
                        <div key={s.id} className="analyzed-reason-item">
                          <span className="text-blue-600 font-mono font-bold mr-1">
                            [{s.start.toFixed(1)}s~{s.end.toFixed(1)}s]
                          </span>
                          <span className="truncate">{s.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. AI 실시간 추론 로그 터미널 (Live Reasoning Feed) */}
      <div className="reasoning-terminal">
        <div className="reasoning-header">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono font-bold text-slate-300">AI REASONING LOG (실시간 추론 콘솔)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>LIVE INFERENCE</span>
          </div>
        </div>

        <div className="reasoning-body">
          {(!progress.reasoningLogs || progress.reasoningLogs.length === 0) ? (
            <div className="text-xs font-mono text-slate-400 italic py-2">
              AI 비전 모델 초기화 및 프레임 시퀀스 수신 대기 중...
            </div>
          ) : (
            progress.reasoningLogs.map((log, idx) => {
              const timeMatch = log.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*(.*)$/);
              return (
                <div key={idx} className="reasoning-log-line">
                  <span className="reasoning-prompt-sym">&gt;</span>
                  {timeMatch ? (
                    <>
                      <span className="reasoning-time-tag">{timeMatch[1]}</span>
                      <span className="reasoning-log-content">{timeMatch[2]}</span>
                    </>
                  ) : (
                    <span className="reasoning-log-content">{log}</span>
                  )}
                </div>
              );
            })
          )}

          {(() => {
            const liveText = (progress.liveReasoning || '').trim()
              ? progress.liveReasoning || ''
              : (progress.liveContent || '').trim()
              ? progress.liveContent || ''
              : '';
            if (!liveText) {
              return progress.currentPhase === 'analyze' ? (
                <div className="toss-reasoning-waiting">
                  <span className="toss-live-caret" />
                  <span>모델이 첫 토큰을 생성할 때까지 대기 중...</span>
                </div>
              ) : null;
            }
            const isReasoning = Boolean((progress.liveReasoning || '').trim());
            return (
              <div className={`toss-live-reasoning-block ${isReasoning ? 'is-reasoning' : 'is-content'}`}>
                <div className="toss-live-reasoning-label">
                  <span>{isReasoning ? '💭 모델 사고 과정 (실시간)' : '⌨️ 모델 응답 생성 중 (실시간)'}</span>
                  <span className="toss-live-reasoning-count">{liveText.length.toLocaleString()}자</span>
                </div>
                <div className="toss-live-reasoning-text">
                  {liveText}
                  <span className="toss-live-caret" />
                </div>
              </div>
            );
          })()}

          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* 취소 버튼 */}
      <div className="mt-6">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          <XCircle className="w-4 h-4 text-slate-500" />
          작업 중단하기
        </button>
      </div>
    </div>
  );
};
