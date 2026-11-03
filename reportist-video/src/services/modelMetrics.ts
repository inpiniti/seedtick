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
 * 안전성 가드레일 모델 및 Nemotron Super VL은 제외하고, 추천 순위가 가장 높은 모델을 기본값으로 사용한다.
 */
export function pickDefaultModel(models: FreeModelMeta[]): FreeModelMeta | null {
  const usable = models.filter((model) => !isGuardrailModel(model) && !model.id.includes('super-vl'));
  const pool = usable.length > 0 ? usable : models;
  if (pool.length === 0) return null;

  // 플래그십 비전 모델(Gemma 31B/26B 또는 Dots 3) 우선 매칭
  const preferred = pool.find((m) => m.id.includes('gemma-4-31b')) ||
                    pool.find((m) => m.id.includes('gemma-4-26b')) ||
                    pool.find((m) => m.id.includes('dots-3'));
  if (preferred) return preferred;

  const ranked = sortModelsBySpeed(pool);
  return ranked[0] ?? null;
}

/**
 * 게이트웨이가 수신한 원천 메타데이터를 정규화하여 반환한다.
 * 인위적인 임의 추정이나 덮어쓰기 없이 수신값을 100% 신뢰한다.
 */
export function enrichModelMetrics(models: FreeModelMeta[]): FreeModelMeta[] {
  return models.map((model) => ({
    ...model,
    name: cleanModelName(model.name),
    intelligenceIndex: model.intelligenceIndex ?? null,
    codingIndex: model.codingIndex ?? null,
    agenticIndex: model.agenticIndex ?? null,
    speedTokensPerSecond: model.speedTokensPerSecond ?? null,
    latencyMs: model.latencyMs ?? null,
    speedIsEstimate: false,
  }));
}
