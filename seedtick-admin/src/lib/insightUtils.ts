import {
  GuruReportRow,
  ValuationConsensus,
} from "@/types/api";

export type IntrinsicStabilityLevel =
  | "stable"
  | "watch"
  | "unstable"
  | "insufficient";

export interface IntrinsicStability {
  level: IntrinsicStabilityLevel;
  label: string;
  sampleCount: number;
  rangeMultiple: number | null;
  cv: number | null;
}

export function chartTickerKey(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

export function isValidChartTicker(ticker?: string | null): boolean {
  if (!ticker || typeof ticker !== "string") return false;
  const clean = ticker.trim().toUpperCase();
  if (!clean) return false;
  // 토스 내부 주식 코드 (US19890516001, NAS0250224006 등) 차단
  if (/^(US|NAS|NYS|AMS)\d{6,}/i.test(clean)) return false;
  // 한국 종목코드 (6자리 숫자, 예: 033100)
  if (/^\d{6}$/.test(clean)) return true;
  // 미국 및 글로벌 티커 (예: AAPL, BRK-B, NVDA 등)
  if (/^[A-Z0-9.-]{1,10}$/.test(clean)) return true;
  return false;
}

export function parseSafetyPrice(
  safetyPrice?: string | number | null
): number | null {
  if (safetyPrice == null) return null;
  if (typeof safetyPrice === "number")
    return Number.isFinite(safetyPrice) && safetyPrice > 0 ? safetyPrice : null;
  const match = String(safetyPrice).replace(/,/g, "").match(/[\d]+(?:\.\d+)?/);
  if (!match) return null;
  const val = parseFloat(match[0]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

export function extractValuationConsensus(
  report?: GuruReportRow | null
): ValuationConsensus | null {
  if (!report) return null;

  // 1순위: DB 정규 구조화 컬럼 우선 사용
  if (report.fair_value !== undefined && report.fair_value !== null) {
    const consensus = report.datapack?.valuation_consensus;
    const band =
      report.band_low != null && report.band_high != null
        ? `$${report.band_low} ~ $${report.band_high}`
        : null;
    const safetyValue =
      report.safety_entry != null
        ? report.safety_entry
        : parseSafetyPrice(consensus?.safety_entry_value ?? consensus?.safety_entry_price);
    return {
      ...consensus,
      fair_value_price: report.fair_value,
      target_price_band: band ?? consensus?.target_price_band ?? null,
      safety_entry_price:
        report.safety_entry != null
          ? `$${report.safety_entry} 이하`
          : consensus?.safety_entry_price ?? null,
      safety_entry_value: safetyValue,
      optimistic_target_price:
        report.target_sell != null
          ? `$${report.target_sell}`
          : consensus?.optimistic_target_price ?? null,
      // 집계 지표는 정규 컬럼을 우선하고, 미적재 레거시 행만 jsonb로 폴백한다.
      dispersion_pct: report.dispersion_pct ?? consensus?.dispersion_pct ?? null,
      price_estimate_count:
        report.price_estimate_count ?? consensus?.price_estimate_count ?? null,
    };
  }

  // 2순위: 데이터팩 내 valuation_consensus
  const consensus = report.datapack?.valuation_consensus;
  if (
    consensus &&
    (consensus.fair_value_price != null ||
      consensus.target_price_band ||
      consensus.safety_entry_price ||
      consensus.safety_entry_value != null ||
      consensus.dispersion_pct != null)
  ) {
    const safetyValue =
      consensus.safety_entry_value ??
      (report.safety_entry != null
        ? report.safety_entry
        : parseSafetyPrice(consensus.safety_entry_price));
    return {
      ...consensus,
      safety_entry_value: safetyValue,
    };
  }

  const md = report.final_report;
  if (!md) return null;

  let fairValuePrice: number | null = null;
  const fvMatch = md.match(
    /(?:종합\s*적정\s*내재가치|종합\s*적정가|적정\s*내재가치|적정가)[:\s\*]*[$₩]?\s*([\d,]+(?:\.\d+)?)/
  );
  if (fvMatch) {
    const raw = fvMatch[1].replace(/,/g, "").trim();
    const val = parseFloat(raw);
    if (!isNaN(val)) fairValuePrice = val;
  }

  let targetPriceBand: string | null = null;
  const bandMatch = md.match(
    /(?:적정\s*밴드|목표\s*밴드|밸류에이션\s*밴드)[:\s\*]*([^\n\)|]+)/
  );
  if (bandMatch) {
    targetPriceBand = bandMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let safetyEntryPrice: string | null = null;
  const safeMatch = md.match(
    /(?:\[안전마진\s*매수가\]|안전마진\s*매수가|안전마진\s*가격)[:\s\*]*([^\n|]+)/
  );
  if (safeMatch) {
    safetyEntryPrice = safeMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let optimisticTargetPrice: string | null = null;
  const targetMatch = md.match(
    /(?:\[목표\s*매도가\]|목표\s*매도가|낙관적\s*목표주가|목표가)[:\s\*]*([^\n|]+)/
  );
  if (targetMatch) {
    optimisticTargetPrice = targetMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  const safetyEntryValue =
    report.safety_entry != null
      ? report.safety_entry
      : parseSafetyPrice(safetyEntryPrice);

  if (
    fairValuePrice ||
    targetPriceBand ||
    safetyEntryPrice ||
    safetyEntryValue != null ||
    optimisticTargetPrice
  ) {
    return {
      fair_value_price: fairValuePrice,
      target_price_band: targetPriceBand,
      safety_entry_price: safetyEntryPrice,
      safety_entry_value: safetyEntryValue,
      optimistic_target_price: optimisticTargetPrice,
    };
  }

  return null;
}

export function getVoteAgreementPercent(report?: GuruReportRow | null): number | null {
  if (!report) return null;
  const counts = [
    report.votes_buy,
    report.votes_hold,
    report.votes_watch,
    report.votes_sell,
  ].filter((count): count is number => count != null && Number.isFinite(count));
  const total = counts.reduce((sum, count) => sum + count, 0);
  return total > 0 ? (Math.max(...counts) / total) * 100 : null;
}

export function buildIntrinsicStability(fairValues: number[]): IntrinsicStability {
  const sanitized = fairValues.filter((value) => Number.isFinite(value) && value > 0);
  if (sanitized.length < 2) {
    return {
      level: "insufficient",
      label: "표본 부족",
      sampleCount: sanitized.length,
      rangeMultiple: null,
      cv: null,
    };
  }

  const min = Math.min(...sanitized);
  const max = Math.max(...sanitized);
  const mean = sanitized.reduce((sum, value) => sum + value, 0) / sanitized.length;
  const variance =
    sanitized.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sanitized.length;
  const std = Math.sqrt(variance);
  const rangeMultiple = min > 0 ? max / min : null;
  const cv = mean > 0 ? std / mean : null;

  if (rangeMultiple == null || cv == null) {
    return {
      level: "insufficient",
      label: "계산 대기",
      sampleCount: sanitized.length,
      rangeMultiple: null,
      cv: null,
    };
  }

  if (rangeMultiple > 3 || cv > 0.5) {
    return {
      level: "unstable",
      label: "불안정",
      sampleCount: sanitized.length,
      rangeMultiple,
      cv,
    };
  }

  if (rangeMultiple >= 1.8 || cv >= 0.25) {
    return {
      level: "watch",
      label: "주의",
      sampleCount: sanitized.length,
      rangeMultiple,
      cv,
    };
  }

  return {
    level: "stable",
    label: "안정",
    sampleCount: sanitized.length,
    rangeMultiple,
    cv,
  };
}

export function getIntrinsicStabilityMeta(stability: IntrinsicStability): {
  variant: "success" | "warning" | "danger" | "neutral";
  text: string;
} {
  switch (stability.level) {
    case "stable":
      return {
        variant: "success",
        text: "안정",
      };
    case "watch":
      return {
        variant: "warning",
        text: "주의",
      };
    case "unstable":
      return {
        variant: "danger",
        text: "불안정",
      };
    default:
      return {
        variant: "neutral",
        text: "표본 부족",
      };
  }
}

export function formatPercentB(percentB: number | null | undefined): string {
  if (percentB === undefined) return "계산 중";
  if (percentB === null || !Number.isFinite(percentB)) return "-";
  return `${(percentB * 100).toFixed(1)}%`;
}

export function formatIntrinsicRatio(ratio: number | null): string | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return `${Math.round(ratio)}%`;
}

export function normalizeVerdictTone(verdict?: string | null): "buy" | "hold" | "sell" | "neutral" {
  if (!verdict) return "neutral";
  const normalized = verdict.toLowerCase();
  if (normalized.includes("매수") || normalized.includes("buy") || normalized.includes("강력")) {
    return "buy";
  }
  if (normalized.includes("보유") || normalized.includes("중립") || normalized.includes("관망") || normalized.includes("hold")) {
    return "hold";
  }
  if (normalized.includes("매도") || normalized.includes("비추천") || normalized.includes("sell")) {
    return "sell";
  }
  return "neutral";
}
