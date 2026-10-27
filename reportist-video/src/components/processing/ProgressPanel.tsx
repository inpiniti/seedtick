// components/processing/ProgressPanel.tsx - AI 하이라이트 생성 진행 상태 패널

import React from 'react';
import { Sparkles, XCircle } from 'lucide-react';
import type { ProcessingProgress } from '../../types/video.ts';

interface ProgressPanelProps {
  progress: ProcessingProgress;
  onCancel: () => void;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({ progress, onCancel }) => {
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

  return (
    <div className="progress-card">
      <div className="progress-header">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          AI 극적 장면 탐색 파이프라인
        </div>
        <h2 className="progress-title">
          {progress.totalVideos > 0
            ? `영상 분석 및 하이라이트 병합 중 (${Math.min(progress.currentVideoIndex + 1, progress.totalVideos)}/${progress.totalVideos})`
            : '하이라이트 생성 준비 중...'}
        </h2>
        <p className="progress-desc">
          AI가 여러 영상에서 가장 결정적이고 극적인 순간만 찾아내어 하나로 엮고 있어요.
        </p>
      </div>

      {/* 단계별 파이프라인 스텝 인디케이터 (Reportist Admin 스타일) */}
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
          <span>구간 컷 & 병합</span>
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
