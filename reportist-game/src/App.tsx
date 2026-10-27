// App.tsx - Reportist Game 메인 애플리케이션

import React, { useState, useEffect } from 'react';
import './App.css';
import { Header } from './components/Header.tsx';
import { GameCanvas } from './components/GameCanvas.tsx';
import { BattleArena } from './components/BattleArena.tsx';
import { TelemetryPanel } from './components/TelemetryPanel.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { sounds } from './game/SoundEffects.ts';
import type {
  GameMode,
  DecisionModelId,
  DecisionLogEntry,
} from './types/game.ts';

const STORAGE_KEY_HI_SCORE = 'reportist_game_hi_score';

export function App() {
  const [mode, setMode] = useState<GameMode>('ai');
  const [selectedModel, setSelectedModel] = useState<DecisionModelId>(
    'inception/mercury-decide:free'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 최고 점수 관리
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEY_HI_SCORE) || 0);
    } catch {
      return 0;
    }
  });

  // 실시간 AI 의사결정 로그 스트림
  const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>([]);
  const [brainStatus, setBrainStatus] = useState<{
    state: 'idle' | 'thinking' | 'action_ready' | 'jumped';
    confidence: number;
    choice: 'JUMP' | 'RUN';
    latencyMs: number;
  }>({
    state: 'idle',
    confidence: 0,
    choice: 'RUN',
    latencyMs: 0,
  });

  // 점수 갱신 시 하이스코어 체크
  const handleScoreUpdate = (score: number) => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem(STORAGE_KEY_HI_SCORE, String(score));
      } catch (e) {
        console.warn('Failed to save high score:', e);
      }
    }
  };

  const handleDecisionLog = (entry: DecisionLogEntry) => {
    setDecisionLogs((prev) => [entry, ...prev.slice(0, 24)]);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  return (
    <div className="game-app-layout">
      {/* 1. 상단 글로벌 헤더 */}
      <Header
        mode={mode}
        onSelectMode={setMode}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        highScore={highScore}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. 메인 게임 & 텔레메트리 레이아웃 */}
      <main className="game-main-content">
        <div className="game-arena-column">
          {mode === 'battle' ? (
            <BattleArena
              modelId={selectedModel}
              onDecisionLog={handleDecisionLog}
              onBrainStatusChange={setBrainStatus}
            />
          ) : (
            <GameCanvas
              isAiMode={mode === 'ai'}
              modelId={selectedModel}
              onScoreUpdate={handleScoreUpdate}
              onGameOver={handleScoreUpdate}
              onDecisionLog={handleDecisionLog}
              onBrainStatusChange={setBrainStatus}
            />
          )}

          {/* 하단 안내 카드 */}
          <section className="game-guide-card">
            <div className="guide-item">
              <span className="guide-badge">HOW IT WORKS</span>
              <p>
                <strong>Inception: Mercury Decide</strong> 모델은 텍스트를 생성하지 않고,
                공룡과 전방 장애물 사이의 실시간 물리 거리·속도를 분석하여{' '}
                <code>JUMP</code> 또는 <code>RUN</code> 결정을 수십 밀리초 만에 도출합니다.
              </p>
            </div>
            <div className="guide-item">
              <span className="guide-badge">LOOKAHEAD PREDICTION</span>
              <p>
                한국-미국 간 네트워크 왕복 핑(~250ms)을 극복하기 위해, 장애물이 300px 전방에
                포착되는 즉시 미리 질의하고 최적 타이밍에 점프를 실행하는 선제적 큐(Pre-emptive Action Queue) 알고리즘이 탑재되어 있습니다.
              </p>
            </div>
          </section>
        </div>

        {/* 우측 실시간 텔레메트리 패널 */}
        <TelemetryPanel
          logs={decisionLogs}
          latestStatus={brainStatus}
          isAiActive={mode === 'ai' || mode === 'battle'}
          modelName={selectedModel}
        />
      </main>

      {/* 3. 하단 푸터 */}
      <footer className="game-footer">
        <div className="footer-links">
          <a href="https://www.reportist.kr" target="_blank" rel="noopener noreferrer">
            Reportist Home
          </a>
          <span>·</span>
          <a href="https://chat.reportist.kr" target="_blank" rel="noopener noreferrer">
            Reportist Chat
          </a>
          <span>·</span>
          <a href="https://video.reportist.kr" target="_blank" rel="noopener noreferrer">
            Reportist Video
          </a>
          <span>·</span>
          <span className="text-slate-400">Powered by OpenRouter Inception Mercury Decide</span>
        </div>
      </footer>

      {/* 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
