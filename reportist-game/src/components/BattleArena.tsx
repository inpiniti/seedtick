// components/BattleArena.tsx - 인간 vs AI 1:1 듀얼 트랙 대결 아레나

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Swords, RotateCcw, Trophy, Sparkles, User, Bot } from 'lucide-react';
import { DinoEngine } from '../game/DinoEngine.ts';
import { DecisionController } from '../ai/DecisionController.ts';
import type { DecisionLogEntry, DecisionModelId, BrainGaugesState } from '../types/game.ts';

interface BattleArenaProps {
  modelId: DecisionModelId;
  onDecisionLog: (entry: DecisionLogEntry) => void;
  onBrainStatusChange: (status: {
    state: 'idle' | 'thinking' | 'action_ready' | 'jumped';
    confidence: number;
    choice: 'JUMP' | 'RUN';
    latencyMs: number;
  }) => void;
  onGaugesUpdate?: (gauges: BrainGaugesState) => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  modelId,
  onDecisionLog,
  onBrainStatusChange,
  onGaugesUpdate,
}) => {
  const humanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const humanEngineRef = useRef<DinoEngine | null>(null);
  const aiEngineRef = useRef<DinoEngine | null>(null);
  const aiControllerRef = useRef<DecisionController | null>(null);

  const [humanScore, setHumanScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);

  const [isHumanDead, setIsHumanDead] = useState(false);
  const [isAiDead, setIsAiDead] = useState(false);

  const [winner, setWinner] = useState<'HUMAN' | 'AI' | 'DRAW' | null>(null);
  const [aiBubble, setAiBubble] = useState<string | null>(null);

  // 부모 콜백들을 ref에 보관
  const callbacksRef = useRef({
    onDecisionLog,
    onBrainStatusChange,
    onGaugesUpdate,
  });

  useEffect(() => {
    callbacksRef.current = {
      onDecisionLog,
      onBrainStatusChange,
      onGaugesUpdate,
    };
  });

  // 1. AI 컨트롤러
  useEffect(() => {
    if (!aiControllerRef.current) {
      aiControllerRef.current = new DecisionController({
        modelId,
        onDecisionLog: (entry) => callbacksRef.current.onDecisionLog(entry),
        onBrainStatus: (st) => {
          callbacksRef.current.onBrainStatusChange(st);
          if (st.choice === 'JUMP') {
            setAiBubble(`JUMP! (${st.confidence}%)`);
          } else if (st.choice === 'RUN') {
            setAiBubble(`RUN (${st.confidence}%)`);
          }
        },
        onGaugesUpdate: (g) => callbacksRef.current.onGaugesUpdate?.(g),
      });
      if (aiEngineRef.current) {
        aiControllerRef.current.attachEngine(aiEngineRef.current);
      }
    } else {
      aiControllerRef.current.setModel(modelId);
    }
  }, [modelId]);

  // 2. 엔진 초기화
  const initEngines = useCallback(() => {
    if (!humanCanvasRef.current || !aiCanvasRef.current) return;

    // 인간 엔진
    const humanEngine = new DinoEngine({
      canvas: humanCanvasRef.current,
      isAiControlled: false,
      onScore: setHumanScore,
      onGameOver: () => {
        setIsHumanDead(true);
      },
    });

    // AI 엔진
    const aiEngine = new DinoEngine({
      canvas: aiCanvasRef.current,
      isAiControlled: true,
      onScore: setAiScore,
      onGameOver: () => {
        setIsAiDead(true);
      },
      onObstacleApproaching: (st) => {
        aiControllerRef.current?.handleObstacleApproaching(st);
      },
    });

    humanEngineRef.current = humanEngine;
    aiEngineRef.current = aiEngine;
    aiControllerRef.current?.attachEngine(aiEngine);

    humanEngine.start();
    aiEngine.start();

    setIsHumanDead(false);
    setIsAiDead(false);
    setWinner(null);
    setHumanScore(0);
    setAiScore(0);
  }, []);

  useEffect(() => {
    initEngines();
    return () => {
      humanEngineRef.current?.destroy();
      aiEngineRef.current?.destroy();
    };
  }, [initEngines]);

  // 승자 판정
  useEffect(() => {
    if (isHumanDead && isAiDead) {
      if (humanScore > aiScore) setWinner('HUMAN');
      else if (aiScore > humanScore) setWinner('AI');
      else setWinner('DRAW');
    } else if (isHumanDead && !isAiDead) {
      setWinner('AI');
    } else if (!isHumanDead && isAiDead) {
      setWinner('HUMAN');
    }
  }, [isHumanDead, isAiDead, humanScore, aiScore]);

  // 키보드 조작
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!isHumanDead && humanEngineRef.current) {
          humanEngineRef.current.jump();
        } else if (isHumanDead && isAiDead) {
          initEngines();
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        humanEngineRef.current?.setDucking(true);
      }
    },
    [isHumanDead, isAiDead, initEngines]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      humanEngineRef.current?.setDucking(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="battle-arena-container">
      {/* 듀얼 스코어보드 & 승패 결과 배너 */}
      <div className="battle-scoreboard">
        <div className={`score-card human ${winner === 'HUMAN' ? 'winner' : ''}`}>
          <div className="score-user-info">
            <User size={16} className="text-slate-700" />
            <span className="font-bold text-sm">YOU (인간)</span>
            {isHumanDead && <span className="dead-tag">CRASHED</span>}
          </div>
          <span className="score-display font-mono">{String(humanScore).padStart(5, '0')}</span>
        </div>

        <div className="battle-versus-badge">
          <Swords size={20} className="text-blue-500 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-500">VS</span>
        </div>

        <div className={`score-card ai ${winner === 'AI' ? 'winner' : ''}`}>
          <div className="score-user-info">
            <Bot size={16} className="text-blue-600" />
            <span className="font-bold text-sm">MERCURY DECIDE (AI)</span>
            {isAiDead && <span className="dead-tag">CRASHED</span>}
          </div>
          <span className="score-display font-mono">{String(aiScore).padStart(5, '0')}</span>
        </div>

        <button type="button" className="action-btn-sm ml-auto" onClick={initEngines}>
          <RotateCcw size={14} />
          <span>매치 재시작</span>
        </button>
      </div>

      {/* 승자 판정 오버레이 배너 */}
      {winner && (
        <div className={`match-result-banner ${winner.toLowerCase()}`}>
          <Trophy size={18} />
          <span>
            {winner === 'HUMAN' && '🎉 당신의 승리! AI보다 더 멀리 살아남았습니다!'}
            {winner === 'AI' && '🤖 AI의 승리! Inception Mercury Decide가 승리했습니다!'}
            {winner === 'DRAW' && '🤝 무승부! 동점으로 경기가 종료되었습니다.'}
          </span>
          <button type="button" className="restart-inline-btn" onClick={initEngines}>
            한 판 더 하기
          </button>
        </div>
      )}

      {/* 트랙 1: 인간 플레이어 */}
      <div className="battle-track human-track">
        <div className="track-label">
          <User size={14} />
          <span>PLAYER 1: 인간 (스페이스바 조작)</span>
        </div>
        <div
          className="canvas-wrapper"
          onClick={() => !isHumanDead && humanEngineRef.current?.jump()}
        >
          <canvas
            ref={humanCanvasRef}
            className="dino-canvas"
            style={{ width: '100%', height: '170px' }}
          />
        </div>
      </div>

      {/* 트랙 2: AI 플레이어 */}
      <div className="battle-track ai-track">
        <div className="track-label">
          <Bot size={14} className="text-blue-600" />
          <span>PLAYER 2: Inception Mercury Decide AI 자율주행</span>
        </div>
        <div className="canvas-wrapper">
          <canvas
            ref={aiCanvasRef}
            className="dino-canvas"
            style={{ width: '100%', height: '170px' }}
          />
          {aiBubble && (
            <div className="ai-thought-bubble">
              <Sparkles size={11} className="text-blue-600 shrink-0" />
              <span>{aiBubble}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
