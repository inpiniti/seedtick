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

interface ObstaclePlan {
  obstacleId: number;
  status: 'querying' | 'planned' | 'cleared';
  choice: 'JUMP' | 'RUN';
  confidence: number;
  triggerDistance: number;
}

export class DecisionController {
  private engine: DinoEngine | null = null;
  private modelId: DecisionModelId;
  private isEnabled = true;

  // 질의 및 계획 상태 관리
  private isQuerying = false;
  private obstaclePlans = new Map<number, ObstaclePlan>();
  private lastJumpedObstacleId: number | null = null;

  // 실시간 최신 장애물 거리 추적 (비동기 응답 도착 시 즉시 점프 판단용)
  private currentObstacleId: number | null = null;
  private currentDistance: number = 9999;
  private currentSpeed: number = 6.2;

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
   * 게임 엔진의 장애물 접근 이벤트 수신 시 선제적 질의 및 점프 실행 제어
   */
  async handleObstacleApproaching(state: {
    obstacleId: number;
    dinoY: number;
    speed: number;
    distance: number;
    obstacleType: string;
    obstacleWidth: number;
    obstacleHeight: number;
    obstacleY?: number;
  }) {
    if (!this.isEnabled || !this.engine) return;

    // 1. 실시간 최신 센서 데이터 동기화
    this.currentObstacleId = state.obstacleId;
    this.currentDistance = state.distance;
    this.currentSpeed = state.speed;

    const plan = this.obstaclePlans.get(state.obstacleId);
    const isGroundObstacle =
      state.obstacleType.startsWith('cactus') ||
      (state.obstacleType === 'pterodactyl' && (state.obstacleY ?? 175) >= 160);

    // 2. [실행 1단계] 이미 수립된 AI 계획이 JUMP인 경우, 최적 사정거리 도달 시 점프 실행
    if (plan && plan.choice === 'JUMP' && plan.status === 'planned') {
      if (
        this.lastJumpedObstacleId !== state.obstacleId &&
        state.distance <= plan.triggerDistance + 18 &&
        state.distance > 15
      ) {
        this.executeJump(state.obstacleId, 'Mercury Decide Action Plan');
        return;
      }
    }

    // 3. [실행 2단계: 안전 반사신경 (Reflex Arc)]
    // 네트워크 핑 지연(>800ms) 등으로 장애물이 95px까지 근접했는데 아직 도약하지 못한 경우 긴급 도약
    if (
      isGroundObstacle &&
      state.distance <= 95 &&
      state.distance > 15 &&
      this.lastJumpedObstacleId !== state.obstacleId &&
      state.dinoY === 0
    ) {
      this.executeJump(state.obstacleId, 'Reflex Arc (Latency Protection)');
      return;
    }

    // 4. [선제적 질의 Lookahead Query]
    // 장애물이 200px~520px 사정거리에 진입했고 아직 질의하지 않은 장애물인 경우 모델에 질의
    const isInsideLookaheadZone = state.distance <= 520 && state.distance >= 200;
    const isNotQueriedYet = !this.obstaclePlans.has(state.obstacleId);

    if (isInsideLookaheadZone && isNotQueriedYet && !this.isQuerying) {
      this.isQuerying = true;
      const targetObstacleId = state.obstacleId;

      this.obstaclePlans.set(targetObstacleId, {
        obstacleId: targetObstacleId,
        status: 'querying',
        choice: 'RUN',
        confidence: 0,
        triggerDistance: Math.max(95, Math.min(135, state.speed * 16)),
      });

      this.onBrainStatus?.({
        state: 'thinking',
        confidence: 0,
        choice: 'RUN',
        latencyMs: 0,
      });

      const queryPayload: DecisionQueryState = {
        obstacleId: targetObstacleId,
        dinoY: state.dinoY,
        speed: state.speed,
        distance: state.distance,
        obstacleType: state.obstacleType,
        obstacleWidth: state.obstacleWidth,
        obstacleHeight: state.obstacleHeight,
        obstacleY: state.obstacleY,
      };

      try {
        const result = await queryDecision(this.modelId, queryPayload);

        // 결과 로깅
        const confidencePct = Math.round(result.confidence * 100);
        const logEntry: DecisionLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          obstacleType: state.obstacleType,
          distance: Math.round(state.distance),
          speed: Number(state.speed.toFixed(1)),
          choice: result.choice,
          confidence: confidencePct,
          probabilities: {
            JUMP: Number(result.probabilities.JUMP.toFixed(2)),
            RUN: Number(result.probabilities.RUN.toFixed(2)),
          },
          latencyMs: result.latencyMs,
          model: result.model,
          actionTaken: result.choice === 'JUMP',
        };

        this.onDecisionLog?.(logEntry);

        const optimalTriggerDist = Math.max(95, Math.min(135, this.currentSpeed * 16));

        // 계획 확정
        this.obstaclePlans.set(targetObstacleId, {
          obstacleId: targetObstacleId,
          status: 'planned',
          choice: result.choice,
          confidence: confidencePct,
          triggerDistance: optimalTriggerDist,
        });

        this.onBrainStatus?.({
          state: result.choice === 'JUMP' ? 'action_ready' : 'idle',
          confidence: confidencePct,
          choice: result.choice,
          latencyMs: result.latencyMs,
        });

        // 질의가 진행되는 동안 이미 공룡이 이동하여 최적 도약 사정거리 이내에 도달한 경우 즉시 점프!
        if (
          result.choice === 'JUMP' &&
          this.currentObstacleId === targetObstacleId &&
          this.currentDistance <= optimalTriggerDist + 22 &&
          this.currentDistance > 15 &&
          this.lastJumpedObstacleId !== targetObstacleId
        ) {
          this.executeJump(targetObstacleId, 'Mercury Decide Plan (Immediate)');
        }
      } catch (e) {
        console.error('[DecisionController] Execution failed:', e);
      } finally {
        this.isQuerying = false;
      }
    }
  }

  private executeJump(obstacleId: number, reason: string) {
    if (!this.engine) return;
    this.lastJumpedObstacleId = obstacleId;
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
    this.obstaclePlans.clear();
    this.lastJumpedObstacleId = null;
    this.currentObstacleId = null;
    this.currentDistance = 9999;
  }
}
