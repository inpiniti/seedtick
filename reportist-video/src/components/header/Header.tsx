// components/header/Header.tsx - Reportist Admin 스타일 상단 헤더 및 모델/노력 선택 위젯

import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import { cleanModelName } from '../../services/modelMetrics.ts';
import { useI18n } from '../../i18n/index.tsx';

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
  const { dict } = useI18n();
  const currentModelMeta = models.find((m) => m.id === selectedModel) || models[0];
  const supportedEfforts = currentModelMeta?.supportedEfforts || ['high', 'medium', 'low', 'none'];

  return (
    <header className="top-header">
      {/* Brand Section */}
      <a
        href="/"
        className="brand-section"
        title={dict.common.brandName || 'PenguinCut'}
      >
        <div className="brand-logo-icon">
          <PenguinLogo size={28} color="#0f172a" />
        </div>
        <div className="brand-title">
          <span>PenguinCut</span>
          <span className="brand-badge">AI VIDEO</span>
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
        <div
          className="model-widget"
          title={dict.common.modelWidgetTitle || '다중 프레임 시각 분석 지원 모델만 선별되어 제공됩니다'}
        >
          <Cpu className="w-3.5 h-3.5 text-[#2563eb] shrink-0" />
          <span className="text-[#64748b] text-[11px] font-mono">{dict.common.modelLabel || '모델:'}</span>
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isLoadingModels}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {cleanModelName(model.name)}
              </option>
            ))}
          </select>

          {/* Reasoning Effort (노력) 선택기 */}
          <div className="flex items-center gap-1 pl-1 border-l border-[#e2e8f0]">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="text-[#64748b] text-[11px] font-mono">{dict.common.effortLabel || '노력:'}</span>
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
