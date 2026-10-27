// components/GameCanvas.tsx - 공룡 게임 캔버스 뷰어 및 사용자 입력 처리기

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Pause, Sparkles, AlertCircle } from 'lucide-react';
import { DinoEngine } from '../game/DinoEngine.ts';
import { DecisionController } from '../ai/DecisionController.ts';
import type { DecisionLogEntry, DecisionModelId } from '../types/game.ts';

interface GameCanvasProps {
  isAiMode: boolean;
  modelId: DecisionModelId;
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  onDecisionLog: (entry: DecisionLogEntry) => void;
  onBrainStatusChange: (status: {
    state: 'idle' | 'thinking' | 'action_ready' | 'jumped';
    confidence: number;
    choice: 'JUMP' | 'RUN';
    latencyMs: number;
  }) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  isAiMode,
  modelId,
  onScoreUpdate,
  onGameOver,
  onDecisionLog,
  onBrainStatusChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<DinoEngine | null>(null);
  const aiControllerRef = useRef<DecisionController | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOverState, setIsGameOverState] = useState(false);

  // AI 두뇌 실시간 말풍선 오버레이 상태
  const [bubbleText, setBubbleText] = useState<string | null>(null);

  // 부모로부터 전달되는 콜백들을 ref에 보관하여 엔진 라이프사이클과 완전히 분리
  const callbacksRef = useRef({
    onScoreUpdate,
    onGameOver,
    onDecisionLog,
    onBrainStatusChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onScoreUpdate,
      onGameOver,
      onDecisionLog,
      onBrainStatusChange,
    };
  });

  // 1. AI 컨트롤러 초기화 및 모델 동적 갱신
  useEffect(() => {
    if (!aiControllerRef.current) {
      aiControllerRef.current = new DecisionController({
        modelId,
        onDecisionLog: (entry) => callbacksRef.current.onDecisionLog(entry),
        onBrainStatus: (st) => {
          callbacksRef.current.onBrainStatusChange(st);
          if (st.state === 'thinking') {
            setBubbleText('Thinking...');
          } else if (st.choice === 'JUMP') {
            setBubbleText(`JUMP! (${st.confidence}%)`);
          } else if (st.choice === 'RUN') {
            setBubbleText(`RUN (${st.confidence}%)`);
          }
        },
      });
    } else {
      aiControllerRef.current.setModel(modelId);
    }
  }, [modelId]);

  // 2. 엔진 초기화 (오직 isAiMode 변경 시에만 초기화되며 콜백 변경에 영향받지 않음)
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new DinoEngine({
      canvas: canvasRef.current,
      isAiControlled: isAiMode,
      onScore: (s) => {
        callbacksRef.current.onScoreUpdate(s);
      },
      onGameOver: (finalScore) => {
        setIsGameOverState(true);
        setIsPlaying(false);
        callbacksRef.current.onGameOver(finalScore);
      },
      onObstacleApproaching: (st) => {
        if (isAiMode && aiControllerRef.current) {
          aiControllerRef.current.handleObstacleApproaching(st);
        }
      },
    });

    engineRef.current = engine;
    if (aiControllerRef.current) {
      aiControllerRef.current.attachEngine(engine);
    }

    engine.start();
    setIsPlaying(true);
    setIsGameOverState(false);

    return () => {
      engine.destroy();
    };
  }, [isAiMode]);

  // 3. 키보드 입력 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        // 인간 모드일 때만 스페이스바 점프 허용 (AI 모드일 때는 AI가 조작)
        if (!isAiMode) {
          engineRef.current.jump();
          if (isGameOverState) {
            setIsGameOverState(false);
            setIsPlaying(true);
          }
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (!isAiMode) {
          engineRef.current.setDucking(true);
        }
      }
    },
    [isAiMode, isGameOverState]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (!isAiMode) {
          engineRef.current.setDucking(false);
        }
      }
    },
    [isAiMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // 버튼 핸들러
  const handleRestart = () => {
    if (!engineRef.current) return;
    aiControllerRef.current?.reset();
    engineRef.current.restart();
    setIsGameOverState(false);
    setIsPlaying(true);
    setBubbleText(null);
  };

  const handleCanvasClick = () => {
    if (!isAiMode && engineRef.current) {
      engineRef.current.jump();
      if (isGameOverState) {
        setIsGameOverState(false);
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="game-canvas-container">
      {/* 캔버스 상단 상태 바 */}
      <div className="canvas-header-bar">
        <div className="flex items-center gap-2">
          <span
            className={`mode-indicator-pill ${isAiMode ? 'ai' : 'human'}`}
          >
            {isAiMode ? '🤖 AI AUTOPILOT' : '👤 HUMAN CONTROL'}
          </span>
          {isAiMode && (
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
              <Sparkles size={13} className="text-blue-500" />
              Inception Mercury Decide 주행 중
            </span>
          )}
        </div>

        {/* 점수 & 컨트롤 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="action-btn-sm"
            onClick={handleRestart}
            title="게임 다시 시작"
          >
            <RotateCcw size={14} />
            <span>재시작</span>
          </button>
        </div>
      </div>

      {/* 게임 캔버스 뷰포트 */}
      <div
        className="canvas-wrapper"
        onClick={handleCanvasClick}
        tabIndex={0}
        role="button"
        aria-label="공룡 게임 캔버스 (클릭 시 점프)"
      >
        <canvas
          ref={canvasRef}
          className="dino-canvas"
          style={{ width: '100%', height: '260px' }}
        />

        {/* AI 생각 말풍선 오버레이 (공룡 머리 위 위치) */}
        {isAiMode && bubbleText && (
          <div className="ai-thought-bubble">
            <Sparkles size={11} className="text-blue-600 shrink-0" />
            <span>{bubbleText}</span>
          </div>
        )}

        {/* 사용자 조작 힌트 배너 */}
        {!isAiMode && !isGameOverState && (
          <div className="human-hint-banner">
            <span>[스페이스바 / 터치] 점프 &nbsp;|&nbsp; [아래 화살표] 숙이기</span>
          </div>
        )}
      </div>
    </div>
  );
};
