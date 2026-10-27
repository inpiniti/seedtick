// components/Header.tsx - Reportist Game 상단 헤더 및 모드/모델 셀렉터

import React from 'react';
import { Volume2, VolumeX, Cpu, Trophy, Swords, Bot, User, Settings } from 'lucide-react';
import { ReportistLogo } from './ReportistLogo.tsx';
import {
  type GameMode,
  type DecisionModelId,
  SUPPORTED_DECISION_MODELS,
} from '../types/game.ts';

interface HeaderProps {
  mode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  selectedModel: DecisionModelId;
  onSelectModel: (modelId: DecisionModelId) => void;
  highScore: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onSelectMode,
  selectedModel,
  onSelectModel,
  highScore,
  isMuted,
  onToggleMute,
  onOpenSettings,
}) => {
  return (
    <header className="top-header">
      {/* 1. 브랜드 영역 */}
      <div className="header-left">
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
            <span>Reportist Game</span>
            <span className="brand-badge">DECISION AI</span>
          </div>
        </a>

        {/* 2. 게임 모드 탭 */}
        <nav className="mode-tabs" aria-label="게임 모드 선택">
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'solo' ? 'active' : ''}`}
            onClick={() => onSelectMode('solo')}
          >
            <User size={15} />
            <span>인간 단독</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'ai' ? 'active' : ''}`}
            onClick={() => onSelectMode('ai')}
          >
            <Bot size={15} />
            <span>AI 자율주행</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'battle' ? 'active' : ''}`}
            onClick={() => onSelectMode('battle')}
          >
            <Swords size={15} />
            <span>인간 vs AI 대결</span>
          </button>
        </nav>
      </div>

      {/* 3. 우측 컨트롤 (최고점수, 모델 선택, 사운드, 설정) */}
      <div className="header-actions">
        {/* 최고 점수 */}
        <div className="high-score-badge" title="개인 최고 기록">
          <Trophy size={14} className="trophy-icon" />
          <span className="label">HI</span>
          <span className="score-num">{String(highScore).padStart(5, '0')}</span>
        </div>

        {/* 의사결정 모델 선택 위젯 */}
        <div className="model-selector-wrap" title="AI 판정에 사용할 디시즌 모델">
          <Cpu size={14} className="model-icon" />
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value as DecisionModelId)}
          >
            {SUPPORTED_DECISION_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 사운드 음소거 토글 버튼 */}
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMute}
          title={isMuted ? '소리 켜기' : '소리 끄기'}
          aria-label={isMuted ? '소리 켜기' : '소리 끄기'}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* 게이트웨이 설정 버튼 */}
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title="AI 게이트웨이 설정"
          aria-label="AI 게이트웨이 설정"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
