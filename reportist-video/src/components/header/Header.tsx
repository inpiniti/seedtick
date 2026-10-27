// components/header/Header.tsx - Reportist Admin 스타일 상단 헤더 및 모델/노력 선택 위젯

import React from 'react';
import { Cpu, Sparkles, Activity } from 'lucide-react';
import { ReportistLogo } from '../common/ReportistLogo.tsx';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';

interface HeaderProps {
  models: FreeModelMeta[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  selectedEffort: ReasoningEffortOption;
  onSelectEffort: (effort: ReasoningEffortOption) => void;
  isLoadingModels: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  models,
  selectedModel,
  onSelectModel,
  selectedEffort,
  onSelectEffort,
  isLoadingModels,
}) => {
  const currentModelMeta = models.find((m) => m.id === selectedModel) || models[0];
  const supportedEfforts = currentModelMeta?.supportedEfforts || ['high', 'medium', 'low', 'none'];

  return (
    <header className="top-header">
      {/* Brand Section */}
      <a
        href="https://www.reportist.kr"
        target="_blank"
        rel="noopener noreferrer"
        className="brand-section"
        title="Reportist 홈으로 이동"
      >
        <div className="brand-logo-icon">
          <ReportistLogo size={18} inverted />
        </div>
        <div className="brand-title">
          <span>Reportist Video</span>
          <span className="brand-badge">AI HIGHLIGHTS</span>
        </div>
      </a>

      {/* Actions & Model Selector */}
      <div className="header-actions">
        {/* Gateway Live Status Indicator */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#64748b] font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot"></span>
          <span className="hidden sm:inline">AI Gateway</span>
        </div>

        {/* Vision Capable Model Selector */}
        <div className="model-widget" title="다중 프레임 시각 분석 지원 모델만 선별되어 제공됩니다">
          <Cpu className="w-3.5 h-3.5 text-[#2563eb] shrink-0" />
          <span className="text-[#64748b] text-[11px] font-mono">모델:</span>
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isLoadingModels}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name.replace(':free', '')}
              </option>
            ))}
          </select>

          {/* Reasoning Effort (노력) 선택기 */}
          <div className="flex items-center gap-1 pl-1 border-l border-[#e2e8f0]">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="text-[#64748b] text-[11px] font-mono">노력:</span>
            <select
              className="effort-select"
              value={selectedEffort}
              onChange={(e) => onSelectEffort(e.target.value as ReasoningEffortOption)}
            >
              {supportedEfforts.map((effort) => (
                <option key={effort} value={effort}>
                  {effort.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
