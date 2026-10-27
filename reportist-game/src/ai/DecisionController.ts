// ai/DecisionController.ts - Inception Mercury Decide 선제적 질의 및 점프 실행 제어기

import { queryDecision, type DecisionQueryState } from '../services/decisionsApi.ts';
import type { DecisionLogEntry, DecisionModelId } from '../types/game.ts';
import type { DinoEngine } from '../game/DinoEngine.ts';

export interface DecisionControllerOptions {
  modelId: DecisionModelId;
  onDecisionLog?: (entry: DecisionLogEntry) => void;
  onBrainStatus?: (status: {
    state: 'idle' | 'thinking' | 'action_ready' | 'jumped';
    confidence: number;
    choice: 'JUMP' | 'RUN';
    latencyMs: number;
  }) => void;
}

export class DecisionController {
  private engine: DinoEngine | null = null;
  private modelId: DecisionModelId;
  private isEnabled = true;

  // 인플라이트 질의 방지 및 중복 질의 방지
  private isQuerying = false;
  private lastQueriedDistance = 9999;
  private pendingJumpTriggerDistance: number | null = null;

  // 콜백
  private onDecisionLog?: DecisionControllerOptions['onDecisionLog'];
  private onBrainStatus?: DecisionControllerOptions['onBrainStatus'];

  constructor(options: DecisionControllerOptions) {
    this.modelId = options.modelId;
    this.onDecisionLog = options.onDecisionLog;
    this.onBrainStatus = options.onBrainStatus;
  }

  attachEngine(engine: DinoEngine) {
    this.engine = engine;
  }

  setModel(modelId: DecisionModelId) {
    this.modelId = modelId;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * 게임 엔진의 장애물 접근 이벤트 수신 시 선제적 질의 실행
   */
  async handleObstacleApproaching(state: {
    dinoY: number;
    speed: number;
    distance: number;
    obstacleType: string;
    obstacleWidth: number;
    obstacleHeight: number;
  }) {
    if (!this.isEnabled || !this.engine) return;

    // 1. 이미 질의 중이거나 방금 질의한 동일 장애물인 경우 스킵
    if (this.isQuerying) {
      // 대기 중인 점프 액션이 사정거리(80~120px)에 도달했는지 체크
      this.checkPendingJump(state.distance, state.speed);
      return;
    }

    // 2. 점프 대기 큐 확인
    this.checkPendingJump(state.distance, state.speed);

    // 3. 선제적 질의 사정거리: 220px ~ 360px 구간에서 1회 질의
    const isInsideLookaheadZone = state.distance <= 350 && state.distance >= 200;
    const isNewObstacle = Math.abs(state.distance - this.lastQueriedDistance) > 120;

    if (isInsideLookaheadZone && isNewObstacle) {
      this.isQuerying = true;
      this.lastQueriedDistance = state.distance;

      this.onBrainStatus?.({
        state: 'thinking',
        confidence: 0,
        choice: 'RUN',
        latencyMs: 0,
      });

      const queryPayload: DecisionQueryState = {
        dinoY: state.dinoY,
        speed: state.speed,
        distance: state.distance,
        obstacleType: state.obstacleType,
        obstacleWidth: state.obstacleWidth,
        obstacleHeight: state.obstacleHeight,
      };

      try {
        const result = await queryDecision(this.modelId, queryPayload);

        // 결과 로깅
        const logEntry: DecisionLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          obstacleType: state.obstacleType,
          distance: Math.round(state.distance),
          speed: Number(state.speed.toFixed(1)),
          choice: result.choice,
          confidence: Math.round(result.confidence * 100),
          probabilities: {
            JUMP: Number(result.probabilities.JUMP.toFixed(2)),
            RUN: Number(result.probabilities.RUN.toFixed(2)),
          },
          latencyMs: result.latencyMs,
          model: result.model,
          actionTaken: result.choice === 'JUMP',
        };

        this.onDecisionLog?.(logEntry);

        this.onBrainStatus?.({
          state: result.choice === 'JUMP' ? 'action_ready' : 'idle',
          confidence: Math.round(result.confidence * 100),
          choice: result.choice,
          latencyMs: result.latencyMs,
        });

        if (result.choice === 'JUMP') {
          // 속도에 따른 최적 점프 시작 거리 산출 (속도 * 14 ~ 18 frame)
          const optimalJumpDist = Math.max(75, Math.min(135, state.speed * 15));
          this.pendingJumpTriggerDistance = optimalJumpDist;

          // 이미 그 거리 이내에 들어와 있다면 즉시 점프
          if (state.distance <= optimalJumpDist + 25) {
            this.executeJump();
          }
        }
      } catch (e) {
        console.error('[DecisionController] Execution failed:', e);
      } finally {
        this.isQuerying = false;
      }
    }
  }

  private checkPendingJump(currentDistance: number, speed: number) {
    if (this.pendingJumpTriggerDistance !== null) {
      const triggerThreshold = this.pendingJumpTriggerDistance;
      // 공룡이 목표 사정거리 이내로 들어온 순간 점프 트리거
      if (currentDistance <= triggerThreshold + 15 && currentDistance > 20) {
        this.executeJump();
      } else if (currentDistance <= 20) {
        // 이미 지나친 경우 초기화
        this.pendingJumpTriggerDistance = null;
      }
    }
  }

  private executeJump() {
    if (!this.engine) return;
    this.pendingJumpTriggerDistance = null;
    const jumped = this.engine.jump();
    if (jumped) {
      this.onBrainStatus?.({
        state: 'jumped',
        confidence: 100,
        choice: 'JUMP',
        latencyMs: 0,
      });
    }
  }

  reset() {
    this.isQuerying = false;
    this.lastQueriedDistance = 9999;
    this.pendingJumpTriggerDistance = null;
  }
}
