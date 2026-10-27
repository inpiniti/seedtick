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
    const raw = localStorage.getItem(STORAGE_KEY_GATEWAY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseUrl: parsed.baseUrl?.trim() || DEFAULT_GATEWAY_URL,
        gatewaySecret: parsed.gatewaySecret?.trim() || DEFAULT_GATEWAY_SECRET,
      };
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
    localStorage.setItem(STORAGE_KEY_GATEWAY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save gateway config:', e);
  }
}

export interface DecisionQueryState {
  dinoY: number;
  speed: number;
  distance: number;
  obstacleType: string;
  obstacleWidth: number;
  obstacleHeight: number;
}

export interface DecisionQueryResult {
  choice: 'JUMP' | 'RUN';
  confidence: number;
  probabilities: {
    JUMP: number;
    RUN: number;
  };
  latencyMs: number;
  model: string;
}

/**
 * OpenRouter Inception Mercury Decide 규격으로 의사결정 요청
 */
export async function queryDecision(
  modelId: DecisionModelId,
  state: DecisionQueryState,
  config?: GatewayConfig
): Promise<DecisionQueryResult> {
  const cfg = config || loadGatewayConfig();
  const startTime = performance.now();

  const stateDescription =
    `Chrome Dinosaur Game: Dinosaur is running on ground (y=${state.dinoY.toFixed(0)}). ` +
    `Speed is ${state.speed.toFixed(1)} px/frame. Upcoming obstacle is ${state.obstacleType} ` +
    `at distance ${state.distance.toFixed(0)}px ahead (width ${state.obstacleWidth}px, height ${state.obstacleHeight}px).`;

  const payload = {
    model: modelId,
    state: stateDescription,
    questions: {
      action: {
        type: 'choice',
        instructions:
          'Decide what the dinosaur must do right now based on upcoming obstacle distance and speed.',
        criteria: {
          JUMP: 'Jump immediately into the air to jump over the approaching obstacle',
          RUN: 'Keep running on the ground safely without jumping',
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

    const action = data.answers?.action;
    const choice = action?.choice === 'JUMP' ? 'JUMP' : 'RUN';
    const confidence = action?.confidence ?? 0.5;
    const probs = action?.probabilities || {
      JUMP: choice === 'JUMP' ? 0.8 : 0.2,
      RUN: choice === 'RUN' ? 0.8 : 0.2,
    };

    return {
      choice,
      confidence,
      probabilities: {
        JUMP: probs.JUMP ?? 0.5,
        RUN: probs.RUN ?? 0.5,
      },
      latencyMs,
      model: data.model || modelId,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    console.error('[DecisionsAPI] Decision query failed:', err);

    // 폴백 로직: 네트워크 에러 시 안전하게 휴리스틱 반응
    const isClose = state.distance < 150 && state.distance > 20;
    return {
      choice: isClose ? 'JUMP' : 'RUN',
      confidence: 0.5,
      probabilities: {
        JUMP: isClose ? 0.6 : 0.1,
        RUN: isClose ? 0.4 : 0.9,
      },
      latencyMs,
      model: `${modelId} (Fallback Heuristic)`,
    };
  }
}
