// services/modelMetrics.ts - 영상 분석 모델의 지능·속도·레이턴시 메타데이터
//
// 인위적인 하드코딩이나 추정치 없이 AI Gateway 및 OpenRouter 원천 데이터의 수신값을 그대로 사용한다.

import type { FreeModelMeta } from '../types/gateway.ts';

export interface ModelSpeedInfo {
  tokensPerSecond: number | null;
  latencyMs: number | null;
  isEstimate: boolean;
}

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
 * 게이트웨이가 수신한 원천 메타데이터를 정규화하고 지능순으로 정렬하여 반환한다.
 * 지능 지수가 없는 모델은 최신 출시순으로 뒤에 정렬한다.
 * 인위적인 임의 추정이나 덮어쓰기 없이 수신값을 100% 신뢰한다.
 */
export function enrichModelMetrics(models: FreeModelMeta[]): FreeModelMeta[] {
  const enriched = models.map((model) => ({
    ...model,
    name: cleanModelName(model.name),
    intelligenceIndex: model.intelligenceIndex ?? null,
    codingIndex: model.codingIndex ?? null,
    agenticIndex: model.agenticIndex ?? null,
    speedTokensPerSecond: model.speedTokensPerSecond ?? null,
    latencyMs: model.latencyMs ?? null,
    speedIsEstimate: false,
  }));
  return sortModelsByIntelligence(enriched);
}
