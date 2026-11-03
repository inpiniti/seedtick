// src/i18n/modelLocalization.ts - AI Model metadata localization (Tier, Parameters, Context) for Reportist Video

import type { Locale } from './types.ts';

// Exact match dictionary for all known intelligence tiers across supported locales
const EXACT_TIER_TRANSLATIONS: Record<string, Record<Locale, string>> = {
  // Flagship / Ultra models
  '플래그십 120B 멀티모달 & 1M 윈도우': {
    en: 'Flagship 120B Multimodal & 1M Window',
    ko: '플래그십 120B 멀티모달 & 1M 윈도우',
    ja: 'フラグシップ 120B マルチモーダル & 1M 窓',
    zh: '旗舰 120B 多模态 & 1M 窗口',
    es: 'Flagship 120B Multimodal y 1M Ventana',
    fr: 'Flagship 120B Multimodal & 1M Fenêtre',
    de: 'Flaggschiff 120B Multimodal & 1M Fenster',
  },
  'Flagship 120B Multimodal & 1M Window': {
    en: 'Flagship 120B Multimodal & 1M Window',
    ko: '플래그십 120B 멀티모달 & 1M 윈도우',
    ja: 'フラグシップ 120B マルチモーダル & 1M 窓',
    zh: '旗舰 120B 多模态 & 1M 窗口',
    es: 'Flagship 120B Multimodal y 1M Ventana',
    fr: 'Flagship 120B Multimodal & 1M Fenêtre',
    de: 'Flaggschiff 120B Multimodal & 1M Fenster',
  },
  '플래그십 120B 멀티모달': {
    en: 'Flagship 120B Multimodal',
    ko: '플래그십 120B 멀티모달',
    ja: 'フラグシップ 120B マルチモーダル',
    zh: '旗舰 120B 多模态',
    es: 'Flagship 120B Multimodal',
    fr: 'Flagship 120B Multimodal',
    de: 'Flaggschiff 120B Multimodal',
  },
  '플래그십 거대 975B MoE': {
    en: 'Flagship Giant 975B MoE',
    ko: '플래그십 거대 975B MoE',
    ja: 'フラグシップ 巨大 975B MoE',
    zh: '旗舰 巨型 975B MoE',
    es: 'Flagship Gigante 975B MoE',
    fr: 'Flagship Géant 975B MoE',
    de: 'Flaggschiff Riesiges 975B MoE',
  },
  '거대 975B MoE 플래그십': {
    en: 'Flagship Giant 975B MoE',
    ko: '플래그십 거대 975B MoE',
    ja: 'フラグシップ 巨大 975B MoE',
    zh: '旗舰 巨型 975B MoE',
    es: 'Flagship Gigante 975B MoE',
    fr: 'Flagship Géant 975B MoE',
    de: 'Flaggschiff Riesiges 975B MoE',
  },
  '플래그십 550B 프론티어 추론': {
    en: 'Flagship 550B Frontier Reasoning',
    ko: '플래그십 550B 프론티어 추론',
    ja: 'フラグシップ 550B フロンティア推論',
    zh: '旗舰 550B 前沿推理',
    es: 'Flagship 550B Razonamiento frontera',
    fr: 'Flagship 550B Raisonnement frontière',
    de: 'Flaggschiff 550B Frontier-Inferenz',
  },
  '초대형 550B 프론티어 추론': {
    en: 'Ultra-large 550B Frontier Reasoning',
    ko: '초대형 550B 프론티어 추론',
    ja: '超大型 550B フロンティア推論',
    zh: '超大型 550B 前沿推理',
    es: 'Ultra grande 550B Razonamiento frontera',
    fr: 'Ultra grand 550B Raisonnement frontière',
    de: 'Ultragroßes 550B Frontier-Inferenz',
  },

  // Multimodal / Vision models
  '멀티모달 시각 추론': {
    en: 'Multimodal Visual Reasoning',
    ko: '멀티모달 시각 추론',
    ja: 'マルチモーダル視覚推論',
    zh: '多模态视觉推理',
    es: 'Razonamiento visual multimodal',
    fr: 'Raisonnement visuel multimodal',
    de: 'Multimodale visuelle Inferenz',
  },
  'Multimodal Visual Reasoning': {
    en: 'Multimodal Visual Reasoning',
    ko: '멀티모달 시각 추론',
    ja: 'マルチモーダル視覚推論',
    zh: '多模态视觉推理',
    es: 'Razonamiento visual multimodal',
    fr: 'Raisonnement visuel multimodal',
    de: 'Multimodale visuelle Inferenz',
  },
  '멀티모달 276B MoE': {
    en: 'Multimodal 276B MoE',
    ko: '멀티모달 276B MoE',
    ja: 'マルチモーダル 276B MoE',
    zh: '多模态 276B MoE',
    es: 'Multimodal 276B MoE',
    fr: 'Multimodal 276B MoE',
    de: 'Multimodal 276B MoE',
  },
  '옴니 멀티모달 추론': {
    en: 'Omni Multimodal Reasoning',
    ko: '옴니 멀티모달 추론',
    ja: 'オムニマルチモーダル推論',
    zh: '全能多模态推理',
    es: 'Razonamiento multimodal omni',
    fr: 'Raisonnement multimodal omni',
    de: 'Omni-Multimodale Inferenz',
  },
  '초대형 280B 비전 MoE': {
    en: 'Ultra-large 280B Vision MoE',
    ko: '초대형 280B 비전 MoE',
    ja: '超大型 280B ビジョン MoE',
    zh: '超大型 280B 视觉 MoE',
    es: 'Ultra grande 280B Visión MoE',
    fr: 'Ultra grand 280B Vision MoE',
    de: 'Ultragroßes 280B Vision-MoE',
  },
  '초대형 280B 추론 MoE': {
    en: 'Ultra-large 280B Reasoning MoE',
    ko: '초대형 280B 추론 MoE',
    ja: '超大型 280B 推論 MoE',
    zh: '超大型 280B 推理 MoE',
    es: 'Ultra grande 280B Razonamiento MoE',
    fr: 'Ultra grand 280B Raisonnement MoE',
    de: 'Ultragroßes 280B Inferenz-MoE',
  },
  '초대형 280B 심층 추론 MoE': {
    en: 'Ultra-large 280B Deep Reasoning MoE',
    ko: '초대형 280B 심층 추론 MoE',
    ja: '超大型 280B 深層推論 MoE',
    zh: '超大型 280B 深度推理 MoE',
    es: 'Ultra grande 280B Razonamiento profundo MoE',
    fr: 'Ultra grand 280B Raisonnement profond MoE',
    de: 'Ultragroßes 280B Tiefes Inferenz-MoE',
  },

  // Google models
  'Google 경량 고성능 MoE': {
    en: 'Google Lightweight High-Performance MoE',
    ko: 'Google 경량 고성능 MoE',
    ja: 'Google 軽量高性能 MoE',
    zh: 'Google 轻量高性能 MoE',
    es: 'Google MoE ligero de alto rendimiento',
    fr: 'Google MoE léger haute performance',
    de: 'Google Leichtes Hochleistungs-MoE',
  },
  'Google 31B Dense 종합 지능': {
    en: 'Google 31B Dense General Intelligence',
    ko: 'Google 31B Dense 종합 지능',
    ja: 'Google 31B Dense 総合知能',
    zh: 'Google 31B 稠密综合智能',
    es: 'Google 31B Inteligencia general Dense',
    fr: 'Google 31B Intelligence générale Dense',
    de: 'Google 31B Dense Allgemeine Intelligenz',
  },
  'Google 31B 비전 멀티모달': {
    en: 'Google 31B Vision Multimodal',
    ko: 'Google 31B 비전 멀티모달',
    ja: 'Google 31B ビジョンマルチモーダル',
    zh: 'Google 31B 视觉多模态',
    es: 'Google 31B Visión Multimodal',
    fr: 'Google 31B Vision Multimodale',
    de: 'Google 31B Vision-Multimodal',
  },

  // Coding & Agent models
  '코딩 에이전트 특화': {
    en: 'Coding Agent Specialized',
    ko: '코딩 에이전트 특화',
    ja: 'コーディングエージェント特化',
    zh: '编程智能体专用',
    es: 'Especializado en agente de código',
    fr: 'Spécialisé agent de code',
    de: 'Spezialisiert auf Coding-Agenten',
  },
  '코딩 에이전트 특화 MoE': {
    en: 'Coding Agent Specialized MoE',
    ko: '코딩 에이전트 특화 MoE',
    ja: 'コーディングエージェント特化 MoE',
    zh: '编程智能体专用 MoE',
    es: 'MoE especializado en agente de código',
    fr: 'MoE spécialisé agent de code',
    de: 'Spezialisiertes Coding-Agenten MoE',
  },
  '최상위 코딩 에이전트 118B': {
    en: 'Top-tier Coding Agent 118B',
    ko: '최상위 코딩 에이전트 118B',
    ja: '最上位 コーディングエージェント 118B',
    zh: '顶级 编程智能体 118B',
    es: 'Agente de código de primer nivel 118B',
    fr: 'Agent de code haut de gamme 118B',
    de: 'Spitzenklasse Coding-Agent 118B',
  },
  '경량 고속 코딩 MoE': {
    en: 'Lightweight Fast Coding MoE',
    ko: '경량 고속 코딩 MoE',
    ja: '軽量高速コーディング MoE',
    zh: '轻量快速编程 MoE',
    es: 'MoE de codificación rápida y ligera',
    fr: 'MoE de codage rapide et léger',
    de: 'Leichtes schnelles Coding-MoE',
  },
  'Cohere 코딩 에이전트': {
    en: 'Cohere Coding Agent',
    ko: 'Cohere 코딩 에이전트',
    ja: 'Cohere コーディングエージェント',
    zh: 'Cohere 编程智能体',
    es: 'Agente de código Cohere',
    fr: 'Agent de code Cohere',
    de: 'Cohere Coding-Agent',
  },
  '에이전트 특화 MoE (40B/2.5B)': {
    en: 'Agent Specialized MoE (40B/2.5B)',
    ko: '에이전트 특화 MoE (40B/2.5B)',
    ja: 'エージェント特化 MoE (40B/2.5B)',
    zh: '智能体专用 MoE (40B/2.5B)',
    es: 'MoE especializado en agente (40B/2.5B)',
    fr: 'MoE spécialisé agent (40B/2.5B)',
    de: 'Agenten-spezifisches MoE (40B/2.5B)',
  },

  // Fast / Lightweight / Reasoning
  '초고속 에이전트 MoE': {
    en: 'Ultra-fast Agent MoE',
    ko: '초고속 에이전트 MoE',
    ja: '超高速 エージェント MoE',
    zh: '超高速 智能体 MoE',
    es: 'MoE de agente ultrarrápido',
    fr: 'MoE d\'agent ultra-rapide',
    de: 'Ultraschneller Agenten-MoE',
  },
  '초경량 초고속 추론': {
    en: 'Ultra-lightweight Fast Reasoning',
    ko: '초경량 초고속 추론',
    ja: '超軽量 高速推論',
    zh: '超轻量 极速推理',
    es: 'Razonamiento ultraligero y rápido',
    fr: 'Raisonnement ultra-léger et rapide',
    de: 'Ultra-leichte schnelle Inferenz',
  },
  '초경량 고속': {
    en: 'Ultra-lightweight Fast',
    ko: '초경량 고속',
    ja: '超軽量 高速',
    zh: '超轻量 高速',
    es: 'Ultraligero Rápido',
    fr: 'Ultra-léger Rapide',
    de: 'Ultra-leicht Schnell',
  },
  '심층 논리 추론': {
    en: 'Deep Logical Reasoning',
    ko: '심층 논리 추론',
    ja: '深層論理推論',
    zh: '深度逻辑推理',
    es: 'Razonamiento lógico profundo',
    fr: 'Raisonnement logique profond',
    de: 'Tiefe logische Inferenz',
  },
  '다목적 고성능 MoE': {
    en: 'Versatile High-Performance MoE',
    ko: '다목적 고성능 MoE',
    ja: '多目的 高性能 MoE',
    zh: '多用途 高性能 MoE',
    es: 'MoE versátil de alto rendimiento',
    fr: 'MoE polyvalent haute performance',
    de: 'Vielseitiges Hochleistungs-MoE',
  },
  '하이브리드 Mamba-MoE 120B': {
    en: 'Hybrid Mamba-MoE 120B',
    ko: '하이브리드 Mamba-MoE 120B',
    ja: 'ハイブリッド Mamba-MoE 120B',
    zh: '混合 Mamba-MoE 120B',
    es: 'Híbrido Mamba-MoE 120B',
    fr: 'Hybride Mamba-MoE 120B',
    de: 'Hybrides Mamba-MoE 120B',
  },
  '안전성 검증 & 필터링': {
    en: 'Safety Guardrail & Filter',
    ko: '안전성 검증 & 필터링',
    ja: '安全性検証 & フィルタリング',
    zh: '安全验证与过滤',
    es: 'Verificación de seguridad y filtrado',
    fr: 'Garde-fou de sécurité et filtrage',
    de: 'Sicherheitsprüfung & Filterung',
  },
  '범용 언어 모델': {
    en: 'General Language Model',
    ko: '범용 언어 모델',
    ja: '汎用言語モデル',
    zh: '通用语言模型',
    es: 'Modelo de lenguaje general',
    fr: 'Modèle linguistique général',
    de: 'Allgemeines Sprachmodell',
  },
};

/**
 * Localizes model parameters summary (e.g. '120B (활성 12B)' -> '120B (12B active)')
 */
export function localizeParametersSummary(
  summary: string | undefined | null,
  locale: Locale
): string {
  if (!summary || summary === 'N/A') return 'N/A';

  // MoE pattern: '120B (활성 12B)' or '120B (12B active)' or '120B (active 12B)'
  const moeMatch = summary.match(
    /^(\d+(?:\.\d+)?B)\s*\((?:활성\s*|active\s*)?(\d+(?:\.\d+)?B)(?:\s*active)?\)$/i
  );
  if (moeMatch) {
    const total = moeMatch[1];
    const active = moeMatch[2];
    switch (locale) {
      case 'ko':
        return `${total} (활성 ${active})`;
      case 'ja':
        return `${total} (アクティブ ${active})`;
      case 'zh':
        return `${total} (激活 ${active})`;
      case 'es':
        return `${total} (${active} activo)`;
      case 'fr':
        return `${total} (${active} actif)`;
      case 'de':
        return `${total} (${active} aktiv)`;
      case 'en':
      default:
        return `${total} (${active} active)`;
    }
  }

  // Dense pattern: '31B Dense' or '31B 단일(Dense)'
  const denseMatch = summary.match(/^(\d+(?:\.\d+)?B)\s*(?:Dense|단일\(Dense\))$/i);
  if (denseMatch) {
    const total = denseMatch[1];
    switch (locale) {
      case 'ko':
        return `${total} 단일(Dense)`;
      case 'ja':
        return `${total} 単一(Dense)`;
      case 'zh':
        return `${total} 稠密(Dense)`;
      default:
        return `${total} Dense`;
    }
  }

  return summary;
}

/**
 * Localizes context length formatting (e.g. '1M tokens (초대용량)' -> '1M tokens (Ultra Capacity)')
 */
export function localizeContextLength(
  context: string | undefined | null,
  locale: Locale
): string {
  if (!context) return '';

  const isUltra =
    context.includes('초대용량') ||
    context.toLowerCase().includes('ultra capacity') ||
    context.toLowerCase().includes('ultra-large');

  if (isUltra) {
    const base = context
      .replace(/\s*\((?:초대용량|ultra\s+capacity|ultra-capacity)\)/i, '')
      .trim();

    switch (locale) {
      case 'ko':
        return `${base} (초대용량)`;
      case 'ja':
        return `${base} (超大容量)`;
      case 'zh':
        return `${base} (超大容量)`;
      case 'es':
        return `${base} (Ultra capacidad)`;
      case 'fr':
        return `${base} (Ultra capacité)`;
      case 'de':
        return `${base} (Ultra-Kapazität)`;
      case 'en':
      default:
        return `${base} (Ultra Capacity)`;
    }
  }

  return context;
}

/**
 * Localizes intelligence tier badge text across 7 languages
 */
export function localizeIntelligenceTier(
  tier: string | undefined | null,
  locale: Locale
): string {
  if (!tier) return '';
  const trimmed = tier.trim();

  // 1. Exact match lookup
  if (EXACT_TIER_TRANSLATIONS[trimmed]?.[locale]) {
    return EXACT_TIER_TRANSLATIONS[trimmed][locale];
  }

  // If locale is Korean and tier contains Korean characters, keep original
  if (locale === 'ko') {
    return trimmed;
  }

  // 2. Keyword-based fallback translation if string has Korean tokens
  let localized = trimmed;

  const replaceMap: Record<Locale, Array<[RegExp, string]>> = {
    en: [
      [/플래그십/g, 'Flagship'],
      [/멀티모달/g, 'Multimodal'],
      [/시각\s*추론/g, 'Visual Reasoning'],
      [/시각/g, 'Visual'],
      [/추론/g, 'Reasoning'],
      [/윈도우/g, 'Window'],
      [/초대형|거대/g, 'Ultra-large'],
      [/초경량/g, 'Ultra-lightweight'],
      [/경량/g, 'Lightweight'],
      [/초고속/g, 'Ultra-fast'],
      [/고속/g, 'Fast'],
      [/코딩/g, 'Coding'],
      [/에이전트/g, 'Agent'],
      [/특화/g, 'Specialized'],
      [/최상위/g, 'Top-tier'],
      [/비전/g, 'Vision'],
      [/옴니/g, 'Omni'],
      [/심층/g, 'Deep'],
      [/논리/g, 'Logical'],
      [/프론티어/g, 'Frontier'],
      [/종합\s*지능/g, 'General Intelligence'],
      [/지능/g, 'Intelligence'],
      [/안전성\s*검증/g, 'Safety Guardrail'],
      [/필터링/g, 'Filter'],
      [/범용\s*언어\s*모델/g, 'General Language Model'],
      [/활성/g, 'active'],
    ],
    ko: [],
    ja: [
      [/플래그십/g, 'フラグシップ'],
      [/멀티모달/g, 'マルチモーダル'],
      [/시각\s*추론/g, '視覚推論'],
      [/시각/g, '視覚'],
      [/추론/g, '推論'],
      [/윈도우/g, '窓'],
      [/초대형|거대/g, '超大型'],
      [/초경량/g, '超軽量'],
      [/경량/g, '軽量'],
      [/초고속/g, '超高速'],
      [/고속/g, '高速'],
      [/코딩/g, 'コーディング'],
      [/에이전트/g, 'エージェント'],
      [/특화/g, '特化'],
      [/최상위/g, '最上位'],
      [/비전/g, 'ビジョン'],
      [/옴니/g, 'オムニ'],
      [/심층/g, '深層'],
      [/논리/g, '論理'],
      [/프론티어/g, 'フロンティア'],
      [/종합\s*지능/g, '総合知能'],
      [/지능/g, '知能'],
      [/안전성\s*검증/g, '安全性検証'],
      [/필터링/g, 'フィルタリング'],
      [/범용\s*언어\s*모델/g, '汎用言語モデル'],
      [/활성/g, 'アクティブ'],
    ],
    zh: [
      [/플래그십/g, '旗舰'],
      [/멀티모달/g, '多模态'],
      [/시각\s*추론/g, '视觉推理'],
      [/시각/g, '视觉'],
      [/추론/g, '推理'],
      [/윈도우/g, '窗口'],
      [/초대형|거대/g, '超大型'],
      [/초경량/g, '超轻量'],
      [/경량/g, '轻量'],
      [/초고속/g, '超高速'],
      [/고속/g, '高速'],
      [/코딩/g, '编程'],
      [/에이전트/g, '智能体'],
      [/특화/g, '专用'],
      [/최상위/g, '顶级'],
      [/비전/g, '视觉'],
      [/옴니/g, '全能'],
      [/심층/g, '深度'],
      [/논리/g, '逻辑'],
      [/프론티어/g, '前沿'],
      [/종합\s*지능/g, '综合智能'],
      [/지능/g, '智能'],
      [/안전성\s*검증/g, '安全验证'],
      [/필터링/g, '过滤'],
      [/범용\s*언어\s*모델/g, '通用语言模型'],
      [/활성/g, '激活'],
    ],
    es: [
      [/플래그십/g, 'Flagship'],
      [/멀티모달/g, 'Multimodal'],
      [/시각\s*추론/g, 'Razonamiento visual'],
      [/추론/g, 'Razonamiento'],
      [/윈도우/g, 'Ventana'],
      [/초대형|거대/g, 'Ultra grande'],
      [/초경량/g, 'Ultraligero'],
      [/경량/g, 'Ligero'],
      [/초고속/g, 'Ultrarrápido'],
      [/고속/g, 'Rápido'],
      [/코딩/g, 'Código'],
      [/에이전트/g, 'Agente'],
      [/특화/g, 'Especializado'],
      [/최상위/g, 'Primer nivel'],
      [/비전/g, 'Visión'],
      [/안전성\s*검증/g, 'Seguridad'],
      [/필터링/g, 'Filtrado'],
      [/범용\s*언어\s*모델/g, 'Modelo general'],
    ],
    fr: [
      [/플래그십/g, 'Flagship'],
      [/멀티모달/g, 'Multimodal'],
      [/시각\s*추론/g, 'Raisonnement visuel'],
      [/추론/g, 'Raisonnement'],
      [/윈도우/g, 'Fenêtre'],
      [/초대형|거대/g, 'Ultra grand'],
      [/초경량/g, 'Ultra-léger'],
      [/경량/g, 'Léger'],
      [/초고속/g, 'Ultra-rapide'],
      [/고속/g, 'Rapide'],
      [/코딩/g, 'Codage'],
      [/에이전트/g, 'Agent'],
      [/특화/g, 'Spécialisé'],
      [/최상위/g, 'Haut niveau'],
      [/비전/g, 'Vision'],
      [/안전성\s*검증/g, 'Sécurité'],
      [/필터링/g, 'Filtrage'],
      [/범용\s*언어\s*모델/g, 'Modèle général'],
    ],
    de: [
      [/플래그십/g, 'Flaggschiff'],
      [/멀티모달/g, 'Multimodal'],
      [/시각\s*추론/g, 'Visuelle Inferenz'],
      [/추론/g, 'Inferenz'],
      [/윈도우/g, 'Fenster'],
      [/초대형|거대/g, 'Ultragroß'],
      [/초경량/g, 'Ultra-leicht'],
      [/경량/g, 'Leicht'],
      [/초고속/g, 'Ultraschnell'],
      [/고속/g, 'Schnell'],
      [/코딩/g, 'Coding'],
      [/에이전트/g, 'Agent'],
      [/특화/g, 'Spezialisiert'],
      [/최상위/g, 'Spitzenklasse'],
      [/비전/g, 'Vision'],
      [/안전성\s*검증/g, 'Sicherheit'],
      [/필터링/g, 'Filterung'],
      [/범용\s*언어\s*모델/g, 'Allgemeines Modell'],
    ],
  };

  const rules = replaceMap[locale] || replaceMap.en;
  for (const [pattern, replacement] of rules) {
    localized = localized.replace(pattern, replacement);
  }

  return localized.replace(/\s+/g, ' ').trim();
}
