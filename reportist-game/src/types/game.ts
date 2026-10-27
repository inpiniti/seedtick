// types/game.ts - 게임 및 AI 의사결정 타입 정의

export type GameMode = 'solo' | 'ai' | 'battle';

export type DecisionModelId =
  | 'inception/mercury-decide:free'
  | 'baseten/elephant-1:free'
  | 'baseten/mammoth-1:free'
  | 'respan/span-01-lite:free';

export interface DecisionModelOption {
  id: DecisionModelId;
  name: string;
  provider: string;
  description: string;
  isDefault?: boolean;
}

export const SUPPORTED_DECISION_MODELS: DecisionModelOption[] = [
  {
    id: 'inception/mercury-decide:free',
    name: 'Inception: Mercury Decide (free)',
    provider: 'Inception Labs',
    description: '초고속 구조화 의사결정 모델 (Diffusion LLM 기반, 초당 15+ 판정)',
    isDefault: true,
  },
  {
    id: 'baseten/elephant-1:free',
    name: 'Baseten: Elephant 1 (free)',
    provider: 'Baseten',
    description: 'Qwen 9B 기반 경량 실시간 분기 판정 모델',
  },
  {
    id: 'baseten/mammoth-1:free',
    name: 'Baseten: Mammoth 1 (free)',
    provider: 'Baseten',
    description: 'Qwen 27B 기반 심층 의사결정 및 가치평가 모델',
  },
  {
    id: 'respan/span-01-lite:free',
    name: 'Respan: Span-01 Lite (free)',
    provider: 'Respan',
    description: '행동 감지 및 상태 이상 평가 모델',
  },
];

export interface ObstacleState {
  id: number;
  type: 'cactus_small' | 'cactus_large' | 'cactus_multi' | 'pterodactyl';
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export interface DinoPhysicsState {
  x: number;
  y: number;
  vy: number;
  width: number;
  height: number;
  isJumping: boolean;
  isDucking: boolean;
  isDead: boolean;
  score: number;
  speed: number;
}

export interface BrainGaugesState {
  collisionThreat: number; // 0 ~ 100
  jumpTrajectory: number; // 0 ~ 100
  obstacleClearance: number; // 0 ~ 100
  actionProbability: {
    JUMP: number; // 0 ~ 100
    RUN: number; // 0 ~ 100
  };
  threatLevelText: 'NOMINAL' | 'CAUTION' | 'CRITICAL';
  currentDistance: number;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  obstacleType: string;
  distance: number;
  speed: number;
  choice: 'JUMP' | 'RUN';
  confidence: number;
  probabilities: {
    JUMP: number;
    RUN: number;
  };
  collisionThreat?: number;
  clearanceRate?: number;
  latencyMs: number;
  model: string;
  actionTaken: boolean;
}

export interface DecisionsApiResponse {
  model?: string;
  answers?: {
    action?: {
      type: string;
      choice: 'JUMP' | 'RUN';
      probabilities?: {
        JUMP?: number;
        RUN?: number;
      };
      confidence?: number;
    };
    collision_risk?: {
      type: string;
      choice: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    };
    clearance_rate?: {
      type: string;
      choice: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    };
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cost?: number;
  };
  id?: string;
  error?: {
    message: string;
  };
}
