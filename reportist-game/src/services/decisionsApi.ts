// services/decisionsApi.ts - Gateway Decisions API 호출 및 상태 질의 서비스

import type { DecisionModelId, DecisionsApiResponse } from '../types/game.ts';

export const DEFAULT_GATEWAY_URL = 'https://seedtick-ai-gateway.vercel.app';
export const DEFAULT_GATEWAY_SECRET =
  '377d4fa71b90fdbbd6eab6765f3050598de8c259ed86e615c9b18ae4ed63e8bd';

const STORAGE_KEY_GATEWAY_CONFIG = 'reportist_game_gateway_config';

export interface GatewayConfig {
  baseUrl: string;
  gatewaySecret: string;
}

export function loadGatewayConfig(): GatewayConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY_GATEWAY_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          baseUrl: parsed.baseUrl?.trim() || DEFAULT_GATEWAY_URL,
          gatewaySecret: parsed.gatewaySecret?.trim() || DEFAULT_GATEWAY_SECRET,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load gateway config:', e);
  }
  return {
    baseUrl: DEFAULT_GATEWAY_URL,
    gatewaySecret: DEFAULT_GATEWAY_SECRET,
  };
}

export function saveGatewayConfig(config: GatewayConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_GATEWAY_CONFIG, JSON.stringify(config));
    }
  } catch (e) {
    console.error('Failed to save gateway config:', e);
  }
}

export interface DecisionQueryState {
  obstacleId?: number;
  dinoY: number;
  speed: number;
  distance: number;
  obstacleType: string;
  obstacleWidth: number;
  obstacleHeight: number;
  obstacleY?: number;
}

export interface DecisionQueryResult {
  choice: 'JUMP' | 'RUN';
  confidence: number;
  probabilities: {
    JUMP: number;
    RUN: number;
  };
  collisionThreat: number; // 0 ~ 100
  clearanceRate: number; // 0 ~ 100
  latencyMs: number;
  model: string;
}

/**
 * OpenRouter Inception Mercury Decide 규격으로 다차원 의사결정 요청
 */
export async function queryDecision(
  modelId: DecisionModelId,
  state: DecisionQueryState,
  config?: GatewayConfig
): Promise<DecisionQueryResult> {
  const cfg = config || loadGatewayConfig();
  const startTime = performance.now();

  const isBird = state.obstacleType === 'pterodactyl';
  const isHighBird = isBird && (state.obstacleY ?? 175) < 160;

  let obstacleDesc = '';
  if (isHighBird) {
    obstacleDesc = `high-flying pterodactyl (bird flying overhead at height ${state.obstacleHeight}px). Dinosaur can safely run under it.`;
  } else if (isBird) {
    obstacleDesc = `low-flying pterodactyl (bird flying close to ground). Dinosaur must jump over it.`;
  } else {
    obstacleDesc = `ground obstacle (${state.obstacleType}, width ${state.obstacleWidth}px, height ${state.obstacleHeight}px) directly on the running path.`;
  }

  const stateDescription =
    `Chrome Dinosaur Game: Dinosaur is running on ground at speed ${state.speed.toFixed(1)} px/frame. ` +
    `Upcoming obstacle is ${obstacleDesc} approaching at distance ${state.distance.toFixed(0)}px ahead.`;

  const payload = {
    model: modelId,
    state: stateDescription,
    questions: {
      action: {
        type: 'choice',
        instructions:
          'Determine the required evasive maneuver to safely overcome this upcoming obstacle.',
        criteria: {
          JUMP: 'The obstacle is a ground obstacle or low-flying obstacle that must be jumped over to avoid collision.',
          RUN: 'The obstacle is flying high overhead and dinosaur can safely stay running on the ground without jumping.',
        },
      },
      collision_risk: {
        type: 'choice',
        instructions: `Evaluate collision threat level given obstacle distance of ${state.distance.toFixed(0)}px.`,
        criteria: {
          HIGH: 'Collision threat is immediate or imminent.',
          MODERATE: 'Obstacle approaching within intermediate caution zone.',
          LOW: 'Obstacle is distant with minimal immediate hazard.',
        },
      },
      clearance_rate: {
        type: 'choice',
        instructions: 'Predict clearance confidence for safely evading this obstacle.',
        criteria: {
          HIGH_CONFIDENCE: 'High margin of clearance with standard maneuver.',
          UNCERTAIN: 'Tight maneuver window requiring precise execution.',
        },
      },
    },
  };

  const endpoint = `${cfg.baseUrl.replace(/\/+$/, '')}/v1/decisions`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.gatewaySecret}`,
        'HTTP-Referer': 'https://game.reportist.kr',
        'X-Title': 'Reportist Game',
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[DecisionsAPI] HTTP ${response.status}: ${errText}`);
      throw new Error(`Gateway returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as DecisionsApiResponse;

    if (data.error) {
      throw new Error(data.error.message);
    }

    // 1. 행동 결정
    const action = data.answers?.action;
    const choice = action?.choice === 'JUMP' ? 'JUMP' : 'RUN';
    const probs = action?.probabilities || {
      JUMP: choice === 'JUMP' ? 0.95 : 0.05,
      RUN: choice === 'RUN' ? 0.95 : 0.05,
    };
    const confidence =
      action?.confidence !== undefined && action.confidence > 0
        ? action.confidence
        : Math.abs((probs.JUMP ?? 0.5) - (probs.RUN ?? 0.5));

    // 2. 충돌 위협도 (0 ~ 100)
    const riskProbs = data.answers?.collision_risk?.probabilities || {};
    const pHigh = riskProbs.HIGH ?? (state.distance < 200 ? 0.7 : 0.1);
    const pMod = riskProbs.MODERATE ?? (state.distance < 350 ? 0.6 : 0.2);
    const threatScore = Math.round(pHigh * 100 + pMod * 50);
    const collisionThreat = Math.max(15, Math.min(98, threatScore));

    // 3. 통과 신뢰율 (0 ~ 100)
    const clearProbs = data.answers?.clearance_rate?.probabilities || {};
    const pClear = clearProbs.HIGH_CONFIDENCE ?? 0.85;
    const clearanceRate = Math.round(pClear * 100);

    return {
      choice,
      confidence,
      probabilities: {
        JUMP: probs.JUMP ?? (choice === 'JUMP' ? 0.95 : 0.05),
        RUN: probs.RUN ?? (choice === 'RUN' ? 0.95 : 0.05),
      },
      collisionThreat,
      clearanceRate,
      latencyMs,
      model: data.model || modelId,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    console.error('[DecisionsAPI] Decision query failed:', err);

    // 폴백 로직: 네트워크 에러 시 안전하게 휴리스틱 반응
    const isClose = state.distance < 160 && state.distance > 20;
    const distRatio = Math.max(0, Math.min(1, 1 - state.distance / 500));
    return {
      choice: isClose ? 'JUMP' : 'RUN',
      confidence: 0.65 + Math.random() * 0.2,
      probabilities: {
        JUMP: isClose ? 0.82 : 0.18,
        RUN: isClose ? 0.18 : 0.82,
      },
      collisionThreat: Math.round(distRatio * 75 + 15),
      clearanceRate: Math.round(75 + Math.random() * 15),
      latencyMs,
      model: `${modelId} (Local Reflex)`,
    };
  }
}
