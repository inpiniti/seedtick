// services/modelMetrics.ts - 영상 분석 모델의 지능·속도·레이턴시 메타데이터
//
// 속도(tok/s)와 레이턴시(TTFT)는 Artificial Analysis 공개 측정값을 기준으로 하며,
// 측정값이 없는 모델은 활성 파라미터 수를 바탕으로 보수적으로 추정한다.

import type { FreeModelMeta } from '../types/gateway.ts';

export interface ModelSpeedInfo {
  tokensPerSecond: number;
  latencyMs: number;
  isEstimate: boolean;
}

export interface ModelSpeedTier {
  key: 'ultra' | 'fast' | 'balanced' | 'slow';
  label: string;
}

interface KnownModelMetric extends ModelSpeedInfo {
  intelligenceIndex?: number;
  codingIndex?: number;
  agenticIndex?: number;
}

// Artificial Analysis 측정값 (2026-10 기준)
// 키는 :free / :batch 접미사를 제거한 정규화 ID를 사용한다.
const KNOWN_MODEL_METRICS: Record<string, KnownModelMetric> = {
  'nvidia/nemotron-3.5-super-vl': {
    tokensPerSecond: 448.1,
    latencyMs: 813,
    isEstimate: false,
    intelligenceIndex: 26.5,
  },
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': {
    tokensPerSecond: 230.0,
    latencyMs: 739,
    isEstimate: false,
    intelligenceIndex: 10.3,
    codingIndex: 13.8,
  },
  'thinkingmachines/inkling-small': {
    tokensPerSecond: 208.2,
    latencyMs: 1598,
    isEstimate: false,
    intelligenceIndex: 25.7,
    codingIndex: 52.9,
    agenticIndex: 23.5,
  },
  'thinkingmachines/inkling': {
    tokensPerSecond: 194.2,
    latencyMs: 1754,
    isEstimate: false,
    intelligenceIndex: 25.0,
    codingIndex: 52.1,
    agenticIndex: 22.5,
  },
  'google/gemma-4-26b-a4b-it': {
    tokensPerSecond: 96.0,
    latencyMs: 933,
    isEstimate: false,
    intelligenceIndex: 16.7,
    codingIndex: 39.3,
    agenticIndex: 2.9,
  },
  'google/gemma-4-31b-it': {
    tokensPerSecond: 35.5,
    latencyMs: 1093,
    isEstimate: false,
    intelligenceIndex: 14.7,
    codingIndex: 43.4,
    agenticIndex: 4.2,
  },
  'dots-studio/dots-3-note-preview': {
    tokensPerSecond: 45.0,
    latencyMs: 1200,
    isEstimate: true,
  },
  'nvidia/nemotron-3.5-content-safety': {
    tokensPerSecond: 140.0,
    latencyMs: 450,
    isEstimate: true,
  },
};

export function canonicalModelId(modelId: string): string {
  return modelId
    .replace(/:free$/i, '')
    .replace(/:batch$/i, '')
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseActiveParametersB(parametersSummary?: string): number | null {
  if (!parametersSummary) return null;

  // "120B (활성 12B)" 형태
  const activeMatch = parametersSummary.match(/활성\s*([\d.]+)\s*B/i);
  if (activeMatch) {
    const value = Number(activeMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  // "30B-A3B" 형태
  const moeMatch = parametersSummary.match(/([\d.]+)\s*B\s*[-–]\s*A\s*([\d.]+)\s*B/i);
  if (moeMatch) {
    const value = Number(moeMatch[2]);
    return Number.isFinite(value) ? value : null;
  }

  // "2.6B" 같은 dense 모델
  const denseMatch = parametersSummary.match(/([\d.]+)\s*B/i);
  if (denseMatch) {
    const value = Number(denseMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function estimateSpeedFromParameters(activeParametersB: number | null): ModelSpeedInfo {
  if (
    activeParametersB == null ||
    !Number.isFinite(activeParametersB) ||
    activeParametersB <= 0
  ) {
    return { tokensPerSecond: 80, latencyMs: 900, isEstimate: true };
  }

  // 활성 파라미터가 작을수록 빠르다는 경험적 곡선. 너무 낙관적인 값을 피하기 위해 상한을 둔다.
  const tokensPerSecond = Math.round(
    clamp(220 / Math.pow(activeParametersB, 0.35), 25, 220)
  );
  const latencyMs = Math.round(clamp(250 + activeParametersB * 35, 350, 2500));

  return { tokensPerSecond, latencyMs, isEstimate: true };
}

export function getModelSpeedInfo(model: FreeModelMeta): ModelSpeedInfo {
  const known = KNOWN_MODEL_METRICS[canonicalModelId(model.id)];
  if (known) {
    return {
      tokensPerSecond: known.tokensPerSecond,
      latencyMs: known.latencyMs,
      isEstimate: known.isEstimate,
    };
  }

  return estimateSpeedFromParameters(parseActiveParametersB(model.parametersSummary));
}

export function getSpeedTier(tokensPerSecond?: number | null): ModelSpeedTier {
  if (tokensPerSecond == null || !Number.isFinite(tokensPerSecond)) {
    return { key: 'balanced', label: '측정 전' };
  }
  if (tokensPerSecond >= 300) return { key: 'ultra', label: '초고속' };
  if (tokensPerSecond >= 150) return { key: 'fast', label: '빠름' };
  if (tokensPerSecond >= 70) return { key: 'balanced', label: '보통' };
  return { key: 'slow', label: '느림' };
}

export function isGuardrailModel(model: FreeModelMeta): boolean {
  const haystack = `${model.id} ${model.name} ${model.intelligenceTier ?? ''}`.toLowerCase();
  return (
    haystack.includes('content-safety') ||
    haystack.includes('content safety') ||
    haystack.includes('guardrail') ||
    haystack.includes('안전성')
  );
}

export function sortModelsBySpeed(models: FreeModelMeta[]): FreeModelMeta[] {
  return [...models].sort((a, b) => {
    const speedA = a.speedTokensPerSecond ?? 0;
    const speedB = b.speedTokensPerSecond ?? 0;
    if (speedB !== speedA) return speedB - speedA;

    const latencyA = a.latencyMs ?? Number.POSITIVE_INFINITY;
    const latencyB = b.latencyMs ?? Number.POSITIVE_INFINITY;
    if (latencyA !== latencyB) return latencyA - latencyB;

    return (b.intelligenceIndex ?? 0) - (a.intelligenceIndex ?? 0);
  });
}

/**
 * 영상 하이라이트 분석에 쓸 기본 모델을 고른다.
 * 안전성 가드레일 모델은 제외하고, 가장 빠른 모델을 기본값으로 사용한다.
 */
export function pickDefaultModel(models: FreeModelMeta[]): FreeModelMeta | null {
  const usable = models.filter((model) => !isGuardrailModel(model));
  const ranked = sortModelsBySpeed(usable.length > 0 ? usable : models);
  return ranked[0] ?? null;
}

/**
 * 게이트웨이 응답에 없는 벤치마크/속도 정보를 보강한다.
 * 게이트웨이가 내려준 값이 있으면 그 값을 우선한다.
 */
export function enrichModelMetrics(models: FreeModelMeta[]): FreeModelMeta[] {
  return models.map((model) => {
    const known = KNOWN_MODEL_METRICS[canonicalModelId(model.id)];
    const speedInfo = getModelSpeedInfo(model);

    return {
      ...model,
      intelligenceIndex: model.intelligenceIndex ?? known?.intelligenceIndex ?? null,
      codingIndex: model.codingIndex ?? known?.codingIndex ?? null,
      agenticIndex: model.agenticIndex ?? known?.agenticIndex ?? null,
      speedTokensPerSecond:
        model.speedTokensPerSecond ?? speedInfo.tokensPerSecond,
      latencyMs: model.latencyMs ?? speedInfo.latencyMs,
      speedIsEstimate: model.speedIsEstimate ?? speedInfo.isEstimate,
    };
  });
}
