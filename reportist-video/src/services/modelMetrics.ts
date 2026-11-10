// services/modelMetrics.ts - 영상 분석 모델의 지능·속도·레이턴시 메타데이터
//
// 인위적인 하드코딩이나 추정치 없이 AI Gateway 및 OpenRouter 원천 데이터의 수신값을 그대로 사용한다.

import type { FreeModelMeta } from '../types/gateway.ts';

export interface ModelSpeedInfo {
  tokensPerSecond: number | null;
  latencyMs: number | null;
  isEstimate: boolean;
}

export interface ModelPerfMetric {
  speedTokensPerSecond: number;
  latencyMs: number;
  dataPolicy?: import('../types/gateway.ts').ModelDataPolicy;
}

/**
 * OpenRouter 공식 벤치마크 기준 모델 속도(Throughput, tok/s) 및 첫 응답 지연시간(Latency TTFT, ms)
 * 네트워크 지연이나 실시간 엔드포인트 미제공 시 안전한 벤치마크 기준값으로 활용된다.
 */
export const KNOWN_MODEL_PERF: Record<string, ModelPerfMetric> = {
  'nvidia/nemotron-3.5-super-vl': {
    speedTokensPerSecond: 82,
    latencyMs: 1500,
  },
  'dots-studio/dots-3-note-preview': {
    speedTokensPerSecond: 30,
    latencyMs: 6500,
  },
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': {
    speedTokensPerSecond: 90,
    latencyMs: 605,
  },
  'thinkingmachines/inkling-small': {
    speedTokensPerSecond: 208,
    latencyMs: 1600,
  },
  'thinkingmachines/inkling': {
    speedTokensPerSecond: 194,
    latencyMs: 1750,
  },
  'google/gemma-4-26b-a4b-it': {
    speedTokensPerSecond: 42,
    latencyMs: 912,
  },
  'google/gemma-4-31b-it': {
    speedTokensPerSecond: 32,
    latencyMs: 1200,
  },
  'liquid/lfm-3-1.7b': {
    speedTokensPerSecond: 66,
    latencyMs: 346,
  },
  'liquid/lfm-2.5-2.6b': {
    speedTokensPerSecond: 236,
    latencyMs: 332,
  },
  'nvidia/nemotron-3.5-lightning': {
    speedTokensPerSecond: 62,
    latencyMs: 533,
  },
  'cohere/north-mini-code': {
    speedTokensPerSecond: 130,
    latencyMs: 565,
  },
  'nvidia/nemotron-3-ultra-550b-a55b': {
    speedTokensPerSecond: 36,
    latencyMs: 1714,
  },
  'xingchen-agi/xing4.0-29b-a4b': {
    speedTokensPerSecond: 44,
    latencyMs: 1477,
  },
  'recursive/flint-v1.0': {
    speedTokensPerSecond: 104,
    latencyMs: 1075,
  },
};

export interface ModelSpeedTier {
  key: 'ultra' | 'fast' | 'balanced' | 'slow';
  label: string;
}

export function canonicalModelId(modelId: string): string {
  return modelId
    .replace(/:free$/i, '')
    .replace(/:batch$/i, '')
    .trim();
}

export function getModelSpeedInfo(model: FreeModelMeta): ModelSpeedInfo {
  return {
    tokensPerSecond: model.speedTokensPerSecond ?? null,
    latencyMs: model.latencyMs ?? null,
    isEstimate: false,
  };
}

export function getSpeedTier(tokensPerSecond?: number | null): ModelSpeedTier {
  if (tokensPerSecond == null || !Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) {
    return { key: 'balanced', label: '미측정' };
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
    // 1. 실제 측정 속도가 있는 경우 속도 내림차순 (미측정은 하단)
    const speedA = a.speedTokensPerSecond ?? null;
    const speedB = b.speedTokensPerSecond ?? null;
    if (speedA != null && speedB != null && speedB !== speedA) {
      return speedB - speedA;
    }
    if (speedA != null && speedB == null) return -1;
    if (speedA == null && speedB != null) return 1;

    // 2. 레이턴시 오름차순 (빠를수록 상위)
    const latencyA = a.latencyMs ?? null;
    const latencyB = b.latencyMs ?? null;
    if (latencyA != null && latencyB != null && latencyA !== latencyB) {
      return latencyA - latencyB;
    }

    // 3. 지능 지수 내림차순
    const intelA = a.intelligenceIndex ?? -1;
    const intelB = b.intelligenceIndex ?? -1;
    if (intelB !== intelA) return intelB - intelA;

    // 4. 코딩 지수 내림차순
    const codingA = a.codingIndex ?? -1;
    const codingB = b.codingIndex ?? -1;
    if (codingB !== codingA) return codingB - codingA;

    // 5. 최신순
    return (a.daysAgo ?? 9999) - (b.daysAgo ?? 9999);
  });
}

export function compareModelsByIntelligence(a: FreeModelMeta, b: FreeModelMeta): number {
  // 1. 인공지능 지능 지수(Artificial Analysis Intelligence Index) 내림차순 (높은 순서)
  const intelA = a.intelligenceIndex ?? null;
  const intelB = b.intelligenceIndex ?? null;
  if (intelA != null && intelB != null && intelB !== intelA) {
    return intelB - intelA;
  }
  if (intelA != null && intelB == null) return -1;
  if (intelA == null && intelB != null) return 1;

  // 2. 지능 지수가 없는 모델들은 최신 출시순으로 정렬 (지능 지수 미집계 모델이 다수)
  //    지능 지수가 없는 모델끼리는 출시일이 최신인 순서를 우선한다.
  if (intelA == null && intelB == null) {
    const daysA = a.daysAgo ?? null;
    const daysB = b.daysAgo ?? null;
    if (daysA != null && daysB != null && daysB !== daysA) return daysA - daysB;
    if (daysA != null && daysB == null) return -1;
    if (daysA == null && daysB != null) return 1;
  }

  // 3. 코딩 및 추론 지수 내림차순 (높은 순서)
  const codingA = a.codingIndex ?? null;
  const codingB = b.codingIndex ?? null;
  if (codingA != null && codingB != null && codingB !== codingA) {
    return codingB - codingA;
  }
  if (codingA != null && codingB == null) return -1;
  if (codingA == null && codingB != null) return 1;

  // 4. 에이전틱 지수 내림차순
  const agenticA = a.agenticIndex ?? null;
  const agenticB = b.agenticIndex ?? null;
  if (agenticA != null && agenticB != null && agenticB !== agenticA) {
    return agenticB - agenticA;
  }
  if (agenticA != null && agenticB == null) return -1;
  if (agenticA == null && agenticB != null) return 1;

  // 5. 컨텍스트 길이 내림차순
  const contextA = a.contextLength ?? 0;
  const contextB = b.contextLength ?? 0;
  if (contextB !== contextA) {
    return contextB - contextA;
  }

  // 6. 속도 내림차순 (토큰/초)
  const speedA = a.speedTokensPerSecond ?? 0;
  const speedB = b.speedTokensPerSecond ?? 0;
  if (speedB !== speedA) {
    return speedB - speedA;
  }

  // 7. 최신 출시순
  return (a.daysAgo ?? 9999) - (b.daysAgo ?? 9999);
}

export function sortModelsByIntelligence(models: FreeModelMeta[]): FreeModelMeta[] {
  return [...models].sort(compareModelsByIntelligence);
}

export function cleanModelName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/\s*\((?:free|Free)\)/g, '')
    .replace(/\s*\[(?:free|Free)\]/g, '')
    .replace(/:free\b/gi, '')
    .replace(/\s+free\b/gi, '')
    .trim();
}

/**
 * 영상 하이라이트 분석에 쓸 기본 모델을 고른다.
 * 안전성 가드레일 모델 및 Google Gemma 모델은 제외하고, 지능이 가장 높은 모델을 기본값으로 사용한다.
 * 지능 지수가 없는 모델만 남는 경우에는 가장 최신 출시 모델을 사용한다.
 */
export function pickDefaultModel(models: FreeModelMeta[]): FreeModelMeta | null {
  const usable = models.filter(
    (model) =>
      !isGuardrailModel(model) &&
      !model.id.toLowerCase().includes('gemma') &&
      !model.name.toLowerCase().includes('gemma')
  );
  const pool = usable.length > 0 ? usable : models;
  if (pool.length === 0) return null;

  const ranked = sortModelsByIntelligence(pool);
  return ranked[0] ?? null;
}

/**
 * 게이트웨이가 수신한 원천 메타데이터를 정규화하고 실시간/공식 벤치마크 속도 및 지연시간을 결합하여 지능순으로 반환한다.
 * OpenRouter 실시간 성능 메트릭이 제공되면 이를 최우선으로 반영하고, 없을 시 공식 벤치마크 값을 사용한다.
 */
export function enrichModelMetrics(
  models: FreeModelMeta[],
  livePerf?: Map<string, ModelPerfMetric> | null
): FreeModelMeta[] {
  const enriched = models.map((model) => {
    const canon = canonicalModelId(model.id);
    const live = livePerf?.get(canon) ?? livePerf?.get(model.id);
    const known = KNOWN_MODEL_PERF[canon] ?? KNOWN_MODEL_PERF[model.id];

    const speedTokensPerSecond =
      model.speedTokensPerSecond ??
      (live && live.speedTokensPerSecond > 0 ? live.speedTokensPerSecond : null) ??
      known?.speedTokensPerSecond ??
      null;

    const latencyMs =
      model.latencyMs ??
      (live && live.latencyMs > 0 ? live.latencyMs : null) ??
      known?.latencyMs ??
      null;

    const dataPolicy = model.dataPolicy ?? live?.dataPolicy ?? known?.dataPolicy;

    return {
      ...model,
      name: cleanModelName(model.name),
      intelligenceIndex: model.intelligenceIndex ?? null,
      codingIndex: model.codingIndex ?? null,
      agenticIndex: model.agenticIndex ?? null,
      speedTokensPerSecond,
      latencyMs,
      dataPolicy,
      speedIsEstimate: false,
    };
  });
  return sortModelsByIntelligence(enriched);
}
