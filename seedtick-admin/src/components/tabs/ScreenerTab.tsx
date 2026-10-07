"use client";

import React, { useState } from "react";
import {
  GuruReportRow,
  GuruSummaryItem,
  PipelineProgress,
  StockCandidate,
  ValuationConsensus,
} from "@/types/api";
import { fetchStockChart, fetchTickerLogo } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { ReportSummariesView } from "@/components/tabs/ReportSummariesView";
import { ReportDatapackView } from "@/components/tabs/ReportDatapackView";
import { StockChartView } from "@/components/tabs/StockChartView";
import { PipelineProgressCard } from "@/components/tabs/PipelineProgressCard";
import { getScoreBadge, formatTime } from "@/lib/utils";
import {
  FileText,
  Search,
  Users,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
} from "lucide-react";
import {
  fetchReportByDateAndTicker,
  fetchReportDatesByTicker,
} from "@/lib/supabase";

const LOGO_LOOKUP_INTERVAL_MS = 60_000;
const LOGO_LOOKUP_LAST_AT_KEY = "seedtick:last-logo-lookup-at";

function isValidLogoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}

function extractValuationConsensus(report?: GuruReportRow | null): ValuationConsensus | null {
  if (!report) return null;

  // 1. datapack.valuation_consensus 확인
  const consensus = report.datapack?.valuation_consensus;
  if (consensus && (consensus.fair_value_price || consensus.target_price_band || consensus.safety_entry_price)) {
    return consensus;
  }

  // 2. final_report 마크다운에서 정규식으로 실시간 파싱 (과거 리포트 또는 폴백)
  const md = report.final_report;
  if (!md) return null;

  let fairValuePrice: number | null = null;
  const fvMatch = md.match(/(?:종합\s*적정\s*내재가치|종합\s*적정가|적정\s*내재가치|적정가)[:\s\*]*[$₩]?\s*([\d,]+(?:\.\d+)?)/);
  if (fvMatch) {
    const raw = fvMatch[1].replace(/,/g, "").trim();
    const val = parseFloat(raw);
    if (!isNaN(val)) fairValuePrice = val;
  }

  let targetPriceBand: string | null = null;
  const bandMatch = md.match(/(?:적정\s*밴드|목표\s*밴드|밸류에이션\s*밴드)[:\s\*]*([^\n\)|]+)/);
  if (bandMatch) {
    targetPriceBand = bandMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let safetyEntryPrice: string | null = null;
  const safeMatch = md.match(/(?:\[안전마진\s*매수가\]|안전마진\s*매수가|안전마진\s*가격)[:\s\*]*([^\n|]+)/);
  if (safeMatch) {
    safetyEntryPrice = safeMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  let optimisticTargetPrice: string | null = null;
  const targetMatch = md.match(/(?:\[목표\s*매도가\]|목표\s*매도가|낙관적\s*목표주가|목표가)[:\s\*]*([^\n|]+)/);
  if (targetMatch) {
    optimisticTargetPrice = targetMatch[1].trim().replace(/^[\*`\[\(]+|[\*`\]\)]+$/g, "");
  }

  if (fairValuePrice || targetPriceBand || safetyEntryPrice || optimisticTargetPrice) {
    return {
      fair_value_price: fairValuePrice,
      target_price_band: targetPriceBand,
      safety_entry_price: safetyEntryPrice,
      optimistic_target_price: optimisticTargetPrice,
    };
  }

  return null;
}

interface ScreenerTabProps {
  guruReports: GuruReportRow[];
  liveCandidates: StockCandidate[];
  /** 두번째 스크리너: DataRoma 슈퍼인베스터 그랜드 포트폴리오 종목 */
  romaCandidates?: StockCandidate[];
  viewMode?: "default" | "screener-only" | "insights-only";
  isLoading: boolean;
  isRomaLoading?: boolean;
  pipelineProgress: PipelineProgress | null;
  onRefreshLive: () => void;
  onRefreshRoma?: () => void;
  onRefreshPipeline?: () => Promise<PipelineProgress | null> | void;
}

const GURU_NAMES = [
  "종합",
  "그레이엄",
  "클라먼",
  "파브라이",
  "그린블라트",
  "코스톨라니",
  "슈웨거",
  "버핏",
  "피셔",
  "멍거",
  "린치",
  "다모다란",
  "템플턴",
  "버리",
];

type GuruVoteTone = "buy" | "hold" | "sell" | "unknown";
type DecisionAction = "buy" | "hold" | "sell";
type IntrinsicStabilityLevel = "stable" | "watch" | "unstable" | "insufficient";

type IntrinsicStability = {
  level: IntrinsicStabilityLevel;
  label: string;
  sampleCount: number;
  rangeMultiple: number | null;
  cv: number | null;
};

const GURU_LABELS = GURU_NAMES.filter((name) => name !== "종합");

function normalizeGuruName(summary: GuruSummaryItem): string | null {
  const raw = `${summary.guru_name || summary.persona || ""}`.trim();
  if (!raw) return null;
  const found = GURU_LABELS.find((name) => raw.includes(name));
  return found ?? null;
}

function normalizeVoteTone(summary?: GuruSummaryItem | null): GuruVoteTone {
  if (!summary) return "unknown";
  const raw = `${summary.verdict || summary.stance || ""}`.toLowerCase();
  if (!raw) return "unknown";
  if (
    raw.includes("매수") ||
    raw.includes("buy") ||
    raw.includes("긍정") ||
    raw.includes("추천")
  ) {
    return "buy";
  }
  if (
    raw.includes("보유") ||
    raw.includes("중립") ||
    raw.includes("관망") ||
    raw.includes("hold")
  ) {
    return "hold";
  }
  if (
    raw.includes("매도") ||
    raw.includes("비추천") ||
    raw.includes("sell") ||
    raw.includes("부정")
  ) {
    return "sell";
  }
  return "unknown";
}

function normalizeVerdictTone(verdict?: string | null): GuruVoteTone {
  if (!verdict) return "unknown";
  const normalized = verdict.toLowerCase();
  if (normalized.includes("매수") || normalized.includes("buy") || normalized.includes("강력")) {
    return "buy";
  }
  if (normalized.includes("보유") || normalized.includes("중립") || normalized.includes("관망")) {
    return "hold";
  }
  if (normalized.includes("매도") || normalized.includes("비추천") || normalized.includes("sell")) {
    return "sell";
  }
  return "unknown";
}

function resolveDecisionAction(report?: GuruReportRow | null): DecisionAction {
  if (!report) return "hold";
  const verdictTone = normalizeVerdictTone(report.verdict);
  if (verdictTone === "buy" || verdictTone === "sell") return verdictTone;

  if (report.overall_score <= 0) return "buy";
  if (report.overall_score >= 3) return "sell";
  return "hold";
}

function getVoteToneMeta(tone: GuruVoteTone): {
  label: string;
  shortLabel: string;
  className: string;
} {
  switch (tone) {
    case "buy":
      return {
        label: "매수 의견",
        shortLabel: "매수",
        className: "bg-[#fef0f1] text-[#f04452] border-[#f04452]/20",
      };
    case "hold":
      return {
        label: "보유·중립 의견",
        shortLabel: "중립",
        className: "bg-[#e8f3ff] text-[#3182f6] border-[#3182f6]/20",
      };
    case "sell":
      return {
        label: "매도·비추천 의견",
        shortLabel: "매도",
        className: "bg-[#e6f8f0] text-[#03b26c] border-[#03b26c]/20",
      };
    default:
      return {
        label: "의견 없음",
        shortLabel: "-",
        className: "bg-[#f2f4f6] text-[#8b95a1] border-[#e5e8eb]",
      };
  }
}

function buildIntrinsicStability(fairValues: number[]): IntrinsicStability {
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

function getIntrinsicStabilityMeta(stability: IntrinsicStability): {
  variant: "success" | "warning" | "danger" | "neutral";
  text: string;
} {
  switch (stability.level) {
    case "stable":
      return {
        variant: "success",
        text: `내재가치 안정성: 안정`,
      };
    case "watch":
      return {
        variant: "warning",
        text: `내재가치 안정성: 주의`,
      };
    case "unstable":
      return {
        variant: "danger",
        text: `내재가치 안정성: 불안정`,
      };
    default:
      return {
        variant: "neutral",
        text: `내재가치 안정성: 표본 부족`,
      };
  }
}

export function ScreenerTab({
  guruReports,
  liveCandidates,
  romaCandidates = [],
  viewMode = "default",
  isLoading,
  isRomaLoading = false,
  pipelineProgress,
  onRefreshLive,
  onRefreshRoma,
  onRefreshPipeline,
}: ScreenerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"all" | "live" | "roma">("all");
  const [selectedReport, setSelectedReport] = useState<GuruReportRow | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<"final" | "discussion" | "summaries" | "datapack" | "chart">("final");
  const [searchTerm, setSearchTerm] = useState("");
  const [percentBByTicker, setPercentBByTicker] = useState<Record<string, number | null>>({});
  const [availableDatesForTicker, setAvailableDatesForTicker] = useState<string[]>([]);
  const [isLoadingReportDate, setIsLoadingReportDate] = useState(false);
  const [resolvedLogoByTicker, setResolvedLogoByTicker] = useState<Record<string, string>>({});
  const [brokenLogoTickers, setBrokenLogoTickers] = useState<Record<string, true>>({});
  const [logoLookupHeartbeat, setLogoLookupHeartbeat] = useState(0);
  const logoLookupRoundRobinIndexRef = React.useRef(0);
  const [selectedGuruForTimeline, setSelectedGuruForTimeline] = useState<string>(
    GURU_LABELS[0] || "그레이엄"
  );
  const [selectedDecisionTab, setSelectedDecisionTab] = useState<DecisionAction>("buy");
  const hasAutoRequestedRoma = React.useRef(false);
  const showInsights = viewMode !== "screener-only";
  const showScreener = viewMode !== "insights-only";

  React.useEffect(() => {
    const allCandidates = [...liveCandidates, ...romaCandidates];
    const hasBaseLogoByTicker = new Map<string, boolean>();
    for (const stock of allCandidates) {
      const ticker = stock.ticker.trim().toUpperCase();
      hasBaseLogoByTicker.set(
        ticker,
        hasBaseLogoByTicker.get(ticker) || isValidLogoUrl(stock.logo_image_url)
      );
    }
    const missingTickers = Array.from(
      new Set(
        allCandidates
          .map((stock) => stock.ticker.trim().toUpperCase())
          .filter((ticker) => {
            const alreadyHasValidLogo = Boolean(hasBaseLogoByTicker.get(ticker)) && !brokenLogoTickers[ticker];
            return !alreadyHasValidLogo && !resolvedLogoByTicker[ticker];
          })
      )
    );

    if (missingTickers.length === 0) return;

    const now = Date.now();
    const savedLastAtRaw =
      typeof window !== "undefined" ? window.localStorage.getItem(LOGO_LOOKUP_LAST_AT_KEY) : null;
    const savedLastAt = savedLastAtRaw ? Number(savedLastAtRaw) : 0;
    if (savedLastAt > 0 && now - savedLastAt < LOGO_LOOKUP_INTERVAL_MS) {
      const waitMs = LOGO_LOOKUP_INTERVAL_MS - (now - savedLastAt);
      const timer = window.setTimeout(() => {
        setLogoLookupHeartbeat((prev) => prev + 1);
      }, Math.max(200, waitMs));
      return () => {
        window.clearTimeout(timer);
      };
    }

    const targetIndex = logoLookupRoundRobinIndexRef.current % missingTickers.length;
    const targetTicker = missingTickers[targetIndex];
    logoLookupRoundRobinIndexRef.current += 1;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOGO_LOOKUP_LAST_AT_KEY, String(now));
    }

    let cancelled = false;
    fetchTickerLogo(targetTicker)
      .then((res) => {
        if (cancelled) return;

        const ticker = targetTicker;
        const resolved: Record<string, string> = {};
        if (isValidLogoUrl(res.logo_image_url)) {
          resolved[ticker] = res.logo_image_url as string;
        }

        if (Object.keys(resolved).length > 0) {
          setResolvedLogoByTicker((prev) => ({ ...prev, ...resolved }));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [liveCandidates, romaCandidates, resolvedLogoByTicker, brokenLogoTickers, logoLookupHeartbeat]);

  const getDisplayLogoUrl = (stock: StockCandidate): string | null => {
    const ticker = stock.ticker.trim().toUpperCase();
    const baseUrl = isValidLogoUrl(stock.logo_image_url) ? stock.logo_image_url : null;
    const resolvedUrl = isValidLogoUrl(resolvedLogoByTicker[ticker]) ? resolvedLogoByTicker[ticker] : null;
    if (brokenLogoTickers[ticker]) {
      return resolvedUrl || null;
    }
    return baseUrl || resolvedUrl || null;
  };

  const renderTickerAvatar = (stock: StockCandidate) => {
    const tickerKey = stock.ticker.trim().toUpperCase();
    const logoUrl = getDisplayLogoUrl(stock);
    if (logoUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={stock.ticker}
          className="w-9 h-9 rounded-full object-contain bg-white border border-[#e5e8eb] p-0.5 shrink-0"
          onError={() => {
            setBrokenLogoTickers((prev) => ({ ...prev, [tickerKey]: true }));
            setResolvedLogoByTicker((prev) => {
              const next = { ...prev };
              delete next[tickerKey];
              return next;
            });
          }}
        />
      );
    }

    return (
      <div className="w-9 h-9 rounded-full bg-[#e8f3ff] text-[#3182f6] font-bold text-xs flex items-center justify-center shrink-0">
        {stock.ticker.slice(0, 2)}
      </div>
    );
  };

  // 특정 종목의 과거 날짜 목록 동기화
  React.useEffect(() => {
    if (!selectedReport || selectedReport.id.startsWith("live-")) {
      setAvailableDatesForTicker([]);
      return;
    }

    const ticker = selectedReport.ticker;
    const localDates = guruReports
      .filter((r) => r.ticker === ticker)
      .map((r) => r.d);

    let isMounted = true;
    fetchReportDatesByTicker(ticker).then((dbDates) => {
      if (isMounted) {
        const merged = Array.from(new Set([...localDates, ...dbDates])).sort().reverse();
        setAvailableDatesForTicker(merged);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedReport?.ticker, guruReports]);

  // 특정 티커 클릭 시 저장된 리포트 열기 (targetDate 지원)
  const handleOpenReportByTicker = async (
    ticker: string,
    candidate?: StockCandidate,
    targetDate?: string
  ) => {
    let report: GuruReportRow | undefined = undefined;

    if (targetDate) {
      report = guruReports.find((r) => r.ticker === ticker && r.d === targetDate);
      if (!report) {
        setIsLoadingReportDate(true);
        const fetched = await fetchReportByDateAndTicker(targetDate, ticker);
        setIsLoadingReportDate(false);
        if (fetched) report = fetched;
      }
    }

    if (!report) {
      // 최신 리포트 탐색
      report = guruReports.find((r) => r.ticker === ticker);
    }

    if (report) {
      setSelectedReport(report);
      setReportModalOpen(true);
      setReportViewMode("final");
    } else {
      // 리포트가 아직 생성되지 않은 종목도 모달을 열고 바로 일봉 & 볼린저밴드 차트 표시
      const fallbackReport: GuruReportRow = {
        id: `live-${ticker}`,
        d: targetDate || new Date().toISOString().split("T")[0],
        ticker,
        company_name: candidate?.name || null,
        current_price: candidate?.price || null,
        verdict: "리포트 준비 중",
        overall_score: candidate?.guru_score || 0,
        vote_summary:
          candidate?.holders != null
            ? `DataRoma 슈퍼인베스터 보유 종목 (${candidate.holders}인)`
            : "실시간 스크리너 발굴 종목",
        datapack: null,
        summaries: null,
        discussion: null,
        final_report: null,
        created_at: new Date().toISOString(),
      };
      setSelectedReport(fallbackReport);
      setReportModalOpen(true);
      setReportViewMode("chart");
    }
  };

  // 모달 내에서 다른 분석 날짜 선택 시 리포트 전환
  const handleSelectReportDate = async (targetDate: string) => {
    if (!selectedReport || selectedReport.d === targetDate) return;

    setIsLoadingReportDate(true);
    try {
      const cached = guruReports.find(
        (r) => r.ticker === selectedReport.ticker && r.d === targetDate
      );
      if (cached) {
        setSelectedReport(cached);
        return;
      }

      const fetched = await fetchReportByDateAndTicker(targetDate, selectedReport.ticker);
      if (fetched) {
        setSelectedReport(fetched);
      } else {
        alert(`${targetDate} 날짜의 보고서를 불러오지 못했어요.`);
      }
    } catch (e) {
      console.error("보고서 날짜 변경 오류:", e);
    } finally {
      setIsLoadingReportDate(false);
    }
  };

  const latestReportByTicker = React.useMemo(() => {
    const map = new Map<string, GuruReportRow>();
    for (const report of guruReports) {
      const key = report.ticker.toUpperCase();
      if (!map.has(key)) {
        map.set(key, report);
      }
    }
    return map;
  }, [guruReports]);

  const intrinsicStabilityByTicker = React.useMemo(() => {
    const fairValuesByTicker = new Map<string, number[]>();
    for (const report of guruReports) {
      const fairValue = extractValuationConsensus(report)?.fair_value_price;
      if (fairValue == null || !Number.isFinite(fairValue) || fairValue <= 0) continue;
      const key = report.ticker.toUpperCase();
      const series = fairValuesByTicker.get(key) || [];
      series.push(fairValue);
      fairValuesByTicker.set(key, series);
    }

    const stabilityMap = new Map<string, IntrinsicStability>();
    for (const [ticker, fairValues] of fairValuesByTicker.entries()) {
      stabilityMap.set(ticker, buildIntrinsicStability(fairValues));
    }
    return stabilityMap;
  }, [guruReports]);

  const getCandidateInsight = React.useCallback(
    (stock: StockCandidate) => {
      const report = latestReportByTicker.get(stock.ticker.toUpperCase());
      const consensus = extractValuationConsensus(report);
      const fairValue = consensus?.fair_value_price ?? null;
      const confidenceSamples = (report?.summaries || [])
        .map((summary) => summary.confidence)
        .filter((value): value is number => value != null && Number.isFinite(value));
      const confidence =
        confidenceSamples.length > 0
          ? confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length
          : null;
      const intrinsicRatioPct =
        fairValue != null && Number.isFinite(stock.price) && stock.price > 0
          ? (fairValue / stock.price) * 100
          : null;
      const intrinsicStability =
        intrinsicStabilityByTicker.get(stock.ticker.toUpperCase()) ||
        buildIntrinsicStability([]);
      return {
        verdict: report?.verdict ?? null,
        confidence,
        fairValue,
        intrinsicRatioPct,
        intrinsicStability,
      };
    },
    [intrinsicStabilityByTicker, latestReportByTicker]
  );

  const matchesSearch = (stock: StockCandidate) =>
    searchTerm
      ? stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.name && stock.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;

  const sortByIntrinsicRatio = React.useCallback(
    (a: StockCandidate, b: StockCandidate) => {
      const ratioA = getCandidateInsight(a).intrinsicRatioPct;
      const ratioB = getCandidateInsight(b).intrinsicRatioPct;
      if (ratioA == null) return ratioB == null ? 0 : 1;
      if (ratioB == null) return -1;
      return ratioB - ratioA;
    },
    [getCandidateInsight]
  );

  const filteredLiveCandidates = [...liveCandidates]
    .filter(matchesSearch)
    .sort(sortByIntrinsicRatio);

  const filteredRomaCandidates = [...romaCandidates]
    .filter(matchesSearch)
    .sort(sortByIntrinsicRatio);

  type AllCandidateEntry = {
    stock: StockCandidate;
    sources: Array<"실시간" | "roma">;
  };

  const allCandidates = React.useMemo<AllCandidateEntry[]>(() => {
    const entries = new Map<string, { stock: StockCandidate; sources: Set<"실시간" | "roma"> }>();

    const addCandidates = (candidates: StockCandidate[], source: "실시간" | "roma") => {
      for (const stock of candidates) {
        const key = stock.ticker.trim().toUpperCase();
        const existing = entries.get(key);
        if (!existing) {
          entries.set(key, { stock, sources: new Set([source]) });
          continue;
        }

        existing.sources.add(source);
        existing.stock = {
          ...existing.stock,
          holders: existing.stock.holders ?? stock.holders,
          weight_pct: existing.stock.weight_pct ?? stock.weight_pct,
          hold_price: existing.stock.hold_price ?? stock.hold_price,
          week52_low: existing.stock.week52_low ?? stock.week52_low,
          week52_high: existing.stock.week52_high ?? stock.week52_high,
        };
      }
    };

    addCandidates(liveCandidates, "실시간");
    addCandidates(romaCandidates, "roma");

    return [...entries.values()]
      .sort((a, b) => sortByIntrinsicRatio(a.stock, b.stock))
      .map(({ stock, sources }) => ({ stock, sources: Array.from(sources) }));
  }, [liveCandidates, romaCandidates, sortByIntrinsicRatio]);

  const filteredAllCandidates = allCandidates.filter(({ stock }) => matchesSearch(stock));

  const coverageStats = React.useMemo(() => {
    const uniqueTickers = new Set(allCandidates.map(({ stock }) => stock.ticker.toUpperCase()));
    let reportCovered = 0;
    for (const ticker of uniqueTickers) {
      if (latestReportByTicker.has(ticker)) {
        reportCovered += 1;
      }
    }
    return {
      allCount: allCandidates.length,
      liveCount: liveCandidates.length,
      romaCount: romaCandidates.length,
      overlapCount: liveCandidates.filter((live) =>
        romaCandidates.some((roma) => roma.ticker.toUpperCase() === live.ticker.toUpperCase())
      ).length,
      coveredCount: reportCovered,
    };
  }, [allCandidates, latestReportByTicker, liveCandidates, romaCandidates]);

  const guruComparison = React.useMemo(() => {
    type VoteRecord = {
      reportKey: string;
      date: string;
      guru: string;
      tone: GuruVoteTone;
      reportTone: GuruVoteTone;
      confidence: number | null;
    };

    const votesByReport = new Map<string, Map<string, VoteRecord>>();
    const records: VoteRecord[] = [];

    for (const report of guruReports) {
      const reportTone = normalizeVerdictTone(report.verdict);
      const summaries = report.summaries || [];
      const reportKey = `${report.d}:${report.ticker.toUpperCase()}`;
      const reportVotes = votesByReport.get(reportKey) ?? new Map<string, VoteRecord>();
      for (const summary of summaries) {
        const guru = normalizeGuruName(summary);
        if (!guru) continue;
        const tone = normalizeVoteTone(summary);
        const confidenceRaw = summary.confidence;
        const confidence =
          confidenceRaw != null && Number.isFinite(confidenceRaw) ? Number(confidenceRaw) : null;
        const vote: VoteRecord = {
          reportKey,
          date: report.d,
          guru,
          tone,
          reportTone,
          confidence,
        };
        reportVotes.set(guru, vote);
        records.push(vote);
      }
      votesByReport.set(reportKey, reportVotes);
    }

    const guruStats = GURU_LABELS.map((guru) => {
      const guruVotes = records.filter((record) => record.guru === guru && record.tone !== "unknown");
      const comparable = guruVotes.filter((record) => record.reportTone !== "unknown");
      const agreement = comparable.filter((record) => record.tone === record.reportTone).length;
      const confidenceSamples = guruVotes
        .map((record) => record.confidence)
        .filter((value): value is number => value != null);
      const avgConfidence =
        confidenceSamples.length > 0
          ? confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length
          : null;

      return {
        guru,
        votes: guruVotes.length,
        comparable: comparable.length,
        agreementRate:
          comparable.length > 0 ? (agreement / comparable.length) * 100 : null,
        avgConfidence,
      };
    }).sort((a, b) => {
      const rateA = a.agreementRate ?? -1;
      const rateB = b.agreementRate ?? -1;
      if (rateB !== rateA) return rateB - rateA;
      return b.votes - a.votes;
    });

    const timelineByGuru = new Map<string, Array<{ date: string; rate: number | null; count: number; avgConfidence: number | null }>>();
    for (const guru of GURU_LABELS) {
      const byDate = new Map<string, { total: number; matches: number; confidenceSum: number; confidenceCount: number }>();
      for (const record of records) {
        if (record.guru !== guru || record.tone === "unknown") continue;
        const item = byDate.get(record.date) || {
          total: 0,
          matches: 0,
          confidenceSum: 0,
          confidenceCount: 0,
        };
        item.total += 1;
        if (record.reportTone !== "unknown" && record.tone === record.reportTone) {
          item.matches += 1;
        }
        if (record.confidence != null) {
          item.confidenceSum += record.confidence;
          item.confidenceCount += 1;
        }
        byDate.set(record.date, item);
      }

      const timeline = [...byDate.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .map(([date, item]) => ({
          date,
          rate: item.total > 0 ? (item.matches / item.total) * 100 : null,
          count: item.total,
          avgConfidence:
            item.confidenceCount > 0 ? item.confidenceSum / item.confidenceCount : null,
        }))
        .reverse();

      timelineByGuru.set(guru, timeline);
    }

    const correlationMatrix = GURU_LABELS.map((rowGuru) =>
      GURU_LABELS.map((colGuru) => {
        if (rowGuru === colGuru) return { percent: 100, samples: 0 };
        let same = 0;
        let total = 0;
        for (const voteMap of votesByReport.values()) {
          const rowVote = voteMap.get(rowGuru);
          const colVote = voteMap.get(colGuru);
          if (!rowVote || !colVote) continue;
          if (rowVote.tone === "unknown" || colVote.tone === "unknown") continue;
          total += 1;
          if (rowVote.tone === colVote.tone) same += 1;
        }
        return { percent: total > 0 ? (same / total) * 100 : null, samples: total };
      })
    );

    return { guruStats, timelineByGuru, correlationMatrix };
  }, [guruReports]);

  const selectedGuruTimeline = guruComparison.timelineByGuru.get(selectedGuruForTimeline) || [];

  const heatmapColumns = React.useMemo(() => {
    const columns = filteredAllCandidates
      .slice(0, 8)
      .map(({ stock }) => ({
        ticker: stock.ticker.toUpperCase(),
        name: stock.name,
        report: latestReportByTicker.get(stock.ticker.toUpperCase()) ?? null,
      }));
    return columns;
  }, [filteredAllCandidates, latestReportByTicker]);

  const heatmapRows = React.useMemo(() => {
    return GURU_LABELS.map((guru) => ({
      guru,
      cells: heatmapColumns.map((column) => {
        const summaries = column.report?.summaries ?? [];
        const matchedSummary =
          summaries.find((summary) => normalizeGuruName(summary) === guru) ?? null;
        return {
          ticker: column.ticker,
          tone: normalizeVoteTone(matchedSummary),
        };
      }),
    }));
  }, [heatmapColumns]);

  const chartTickerKey = (ticker: string) => ticker.trim().toUpperCase().replace(/\./g, "-");

  const decisionInsights = React.useMemo(() => {
    const rows = filteredAllCandidates.map(({ stock, sources }) => {
      const report = latestReportByTicker.get(stock.ticker.toUpperCase()) ?? null;
      const consensus = extractValuationConsensus(report);
      const fairValue = consensus?.fair_value_price ?? null;
      const upsidePct =
        fairValue != null && stock.price > 0 ? ((fairValue - stock.price) / stock.price) * 100 : null;
      const percentB = percentBByTicker[chartTickerKey(stock.ticker)] ?? null;
      const confidenceSamples = (report?.summaries || [])
        .map((summary) => summary.confidence)
        .filter((value): value is number => value != null && Number.isFinite(value));
      const confidence =
        confidenceSamples.length > 0
          ? confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length
          : null;
      const action = resolveDecisionAction(report);

      const priorityScore =
        (action === "buy" ? 30 : action === "sell" ? 20 : 10) +
        (confidence ?? 0) * 4 +
        (upsidePct ?? 0) * (action === "buy" ? 1.2 : action === "sell" ? -0.8 : 0.4);

      return {
        ticker: stock.ticker,
        name: stock.name,
        price: stock.price,
        sources,
        action,
        confidence,
        upsidePct,
        percentB,
        priorityScore,
        reason:
          report?.vote_summary ||
          report?.verdict ||
          "리포트 생성 후 더 정확한 매수/보유/매도 근거를 보여줘요.",
      };
    });

    const grouped = {
      buy: rows
        .filter((row) => row.action === "buy")
        .sort((a, b) => b.priorityScore - a.priorityScore),
      hold: rows
        .filter((row) => row.action === "hold")
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)),
      sell: rows
        .filter((row) => row.action === "sell")
        .sort((a, b) => b.priorityScore - a.priorityScore),
    };

    return {
      grouped,
      counts: {
        buy: grouped.buy.length,
        hold: grouped.hold.length,
        sell: grouped.sell.length,
      },
    };
  }, [filteredAllCandidates, latestReportByTicker, percentBByTicker]);

  const formatPercentB = (percentB: number | null | undefined) => {
    if (percentB === undefined) return "계산 중";
    if (percentB === null || !Number.isFinite(percentB)) return "조회 불가";
    return `${(percentB * 100).toFixed(1)}%`;
  };

  const formatIntrinsicRatio = (ratio: number | null) => {
    if (ratio == null || !Number.isFinite(ratio)) return null;
    return `${Math.round(ratio)}%`;
  };

  const formatIntrinsicStabilityDetail = (stability: IntrinsicStability) => {
    if (stability.rangeMultiple == null || stability.cv == null) {
      return "표본 2개 이상이 쌓이면 계산해요";
    }
    return `범위 ${stability.rangeMultiple.toFixed(1)}x · CV ${stability.cv.toFixed(2)} · 표본 ${stability.sampleCount}`;
  };

  React.useEffect(() => {
    if (activeSubTab !== "all" && activeSubTab !== "live" && activeSubTab !== "roma") return;

    const activeSources =
      activeSubTab === "all"
        ? [...liveCandidates, ...romaCandidates]
        : activeSubTab === "live"
          ? liveCandidates
          : romaCandidates;

    const uniqueTickers = Array.from(
      new Set(
        activeSources
          .map((s) => chartTickerKey(s.ticker))
          .filter((ticker) => Boolean(ticker) && percentBByTicker[ticker] === undefined)
      )
    );

    if (uniqueTickers.length === 0) return;

    let cancelled = false;
    const chunkSize = 6;

    const loadPercentB = async () => {
      for (let i = 0; i < uniqueTickers.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = uniqueTickers.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (ticker) => {
            try {
              const chart = await fetchStockChart(ticker, "6mo", "1d");
              return { ticker, percentB: chart.summary?.percent_b ?? null };
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (message.includes("404") || message.includes("Not Found")) {
                return { ticker, percentB: null };
              }
              console.warn(`[${ticker}] %B 조회 실패:`, err);
              return { ticker, percentB: null };
            }
          })
        );

        if (cancelled) return;
        setPercentBByTicker((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.ticker] = result.percentB;
          }
          return next;
        });
      }
    };

    loadPercentB();

    return () => {
      cancelled = true;
    };
  }, [activeSubTab, liveCandidates, romaCandidates, percentBByTicker]);

  React.useEffect(() => {
    if (
      activeSubTab === "all" &&
      romaCandidates.length === 0 &&
      !isRomaLoading &&
      onRefreshRoma &&
      !hasAutoRequestedRoma.current
    ) {
      hasAutoRequestedRoma.current = true;
      onRefreshRoma();
    }
  }, [activeSubTab, romaCandidates.length, isRomaLoading, onRefreshRoma]);

  return (
    <div className="space-y-5">
      {/* 13인 거장 파이프라인 진행 상황 (초경량 상태 표시) */}
      {pipelineProgress && pipelineProgress.status !== "idle" ? (
        <PipelineProgressCard
          progress={pipelineProgress}
          onRefresh={onRefreshPipeline}
        />
      ) : null}

      {/* 서브 탭 & 검색 바 */}
      {showScreener && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#f2f4f6] rounded-2xl w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveSubTab("all")}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "all"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            전체 ({allCandidates.length})
          </button>
          <button
            onClick={() => {
              setActiveSubTab("live");
              if (liveCandidates.length === 0 && !isLoading) {
                onRefreshLive();
              }
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "live"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            실시간 스크리너 ({liveCandidates.length})
          </button>
          <button
            onClick={() => {
              setActiveSubTab("roma");
              if (romaCandidates.length === 0 && !isRomaLoading && onRefreshRoma) {
                onRefreshRoma();
              }
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "roma"
                ? "bg-white text-[#191f28] shadow-xs"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            roma ({romaCandidates.length})
          </button>
        </div>

        {/* 검색 인풋 */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#8b95a1] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="티커 또는 종목명 검색..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e5e8eb] rounded-2xl focus:outline-hidden focus:border-[#3182f6] text-[#191f28]"
          />
        </div>
      </div>
      )}

      {showInsights && (
      <>
      <Card className="p-4 sm:p-5">
        <Card.Header className="pb-2">
          <Card.Title className="text-base sm:text-lg">매수/보유/매도 결정 카드</Card.Title>
          <Card.Description>
            지금 무엇을 해야 하는지 먼저 보여줘요. 종합 의견, 내재가치 대비 갭, 기술 상태를 함께 반영했어요.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setSelectedDecisionTab("buy")}
              className={`rounded-2xl border px-3 py-2 text-left cursor-pointer transition-all ${
                selectedDecisionTab === "buy"
                  ? "border-[#f04452]/30 bg-[#fef0f1]"
                  : "border-[#e5e8eb] bg-white"
              }`}
            >
              <p className="text-[11px] text-[#8b95a1]">매수 검토</p>
              <p className="text-base font-bold text-[#191f28] mt-0.5">
                {decisionInsights.counts.buy}개
              </p>
            </button>
            <button
              onClick={() => setSelectedDecisionTab("hold")}
              className={`rounded-2xl border px-3 py-2 text-left cursor-pointer transition-all ${
                selectedDecisionTab === "hold"
                  ? "border-[#3182f6]/30 bg-[#e8f3ff]"
                  : "border-[#e5e8eb] bg-white"
              }`}
            >
              <p className="text-[11px] text-[#8b95a1]">보유 관찰</p>
              <p className="text-base font-bold text-[#191f28] mt-0.5">
                {decisionInsights.counts.hold}개
              </p>
            </button>
            <button
              onClick={() => setSelectedDecisionTab("sell")}
              className={`rounded-2xl border px-3 py-2 text-left cursor-pointer transition-all ${
                selectedDecisionTab === "sell"
                  ? "border-[#03b26c]/30 bg-[#e6f8f0]"
                  : "border-[#e5e8eb] bg-white"
              }`}
            >
              <p className="text-[11px] text-[#8b95a1]">매도 검토</p>
              <p className="text-base font-bold text-[#191f28] mt-0.5">
                {decisionInsights.counts.sell}개
              </p>
            </button>
          </div>

          <div className="rounded-2xl border border-[#e5e8eb] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#f2f4f6]">
              <p className="text-sm font-bold text-[#191f28]">
                {selectedDecisionTab === "buy"
                  ? "지금 매수 검토할 종목"
                  : selectedDecisionTab === "sell"
                    ? "지금 매도 검토할 종목"
                    : "지금 보유 관찰할 종목"}
              </p>
              <span className="text-[11px] text-[#8b95a1]">
                우선순위 상위 8개
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {decisionInsights.grouped[selectedDecisionTab].slice(0, 8).length === 0 ? (
                <p className="text-xs text-[#8b95a1]">
                  현재 조건에서 표시할 종목이 없어요. 스크리너를 갱신해 주세요.
                </p>
              ) : (
                decisionInsights.grouped[selectedDecisionTab].slice(0, 8).map((item) => (
                  <button
                    key={`${selectedDecisionTab}-${item.ticker}`}
                    onClick={() => handleOpenReportByTicker(item.ticker)}
                    className="w-full text-left rounded-xl bg-[#f9fafb] hover:bg-[#f2f4f6] transition-colors px-2.5 py-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#191f28] truncate">
                          {item.ticker} · {item.name}
                        </p>
                        <p className="text-[11px] text-[#8b95a1] mt-0.5 truncate">
                          {item.reason}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-[#191f28]">
                          ${item.price.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-[#6b7684] mt-0.5">
                          상승여력{" "}
                          {item.upsidePct == null
                            ? "-"
                            : `${item.upsidePct >= 0 ? "+" : ""}${item.upsidePct.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 rounded-full border border-[#e5e8eb] bg-white text-[11px] text-[#4e5968]">
                        확신도 {item.confidence == null ? "-" : `${item.confidence.toFixed(1)}점`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full border border-[#e5e8eb] bg-white text-[11px] text-[#4e5968]">
                        %B {item.percentB == null ? "-" : `${(item.percentB * 100).toFixed(1)}%`}
                      </span>
                      {item.sources.map((source) => (
                        <Badge key={`${item.ticker}-${source}`} variant="neutral">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card className="p-4 sm:p-5">
        <Card.Header className="pb-2">
          <Card.Title className="text-base sm:text-lg">스크리닝 비교 인사이트</Card.Title>
          <Card.Description>
            실시간 스크리너와 DataRoma 결과를 한 번에 비교하고, 13인 거장 의견을 히트맵으로 확인해요.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <div className="rounded-2xl border border-[#e5e8eb] bg-[#f9fafb] px-3 py-2.5">
              <p className="text-[11px] text-[#8b95a1]">통합 후보</p>
              <p className="text-sm font-bold text-[#191f28] mt-0.5">
                {coverageStats.allCount.toLocaleString("ko-KR")}개
              </p>
            </div>
            <div className="rounded-2xl border border-[#e5e8eb] bg-[#f9fafb] px-3 py-2.5">
              <p className="text-[11px] text-[#8b95a1]">실시간 스크리너</p>
              <p className="text-sm font-bold text-[#191f28] mt-0.5">
                {coverageStats.liveCount.toLocaleString("ko-KR")}개
              </p>
            </div>
            <div className="rounded-2xl border border-[#e5e8eb] bg-[#f9fafb] px-3 py-2.5">
              <p className="text-[11px] text-[#8b95a1]">DataRoma 후보</p>
              <p className="text-sm font-bold text-[#191f28] mt-0.5">
                {coverageStats.romaCount.toLocaleString("ko-KR")}개
              </p>
            </div>
            <div className="rounded-2xl border border-[#e5e8eb] bg-[#f9fafb] px-3 py-2.5">
              <p className="text-[11px] text-[#8b95a1]">교집합(양쪽 공통)</p>
              <p className="text-sm font-bold text-[#191f28] mt-0.5">
                {coverageStats.overlapCount.toLocaleString("ko-KR")}개
              </p>
            </div>
            <div className="rounded-2xl border border-[#e5e8eb] bg-[#f9fafb] px-3 py-2.5">
              <p className="text-[11px] text-[#8b95a1]">리포트 커버리지</p>
              <p className="text-sm font-bold text-[#191f28] mt-0.5">
                {coverageStats.coveredCount.toLocaleString("ko-KR")} /{" "}
                {coverageStats.allCount.toLocaleString("ko-KR")}개
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5e8eb] bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-[#f2f4f6]">
              <Badge variant="primary">토스 13인 공통 필터 · nation=us · size=50</Badge>
              <Badge variant="neutral">DataRoma Grand · min_holders=10</Badge>
            </div>
            <p className="text-[11px] text-[#8b95a1] mt-2.5">
              상단 조건은 현재 대시보드 조회 파라미터를 기준으로 자동 반영해요.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e5e8eb] bg-white p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#191f28]">13인 거장 투표 히트맵</p>
                <p className="text-[11px] text-[#8b95a1] mt-0.5">
                  현재 정렬 기준 상위 {heatmapColumns.length}개 종목 기준이에요.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {(["buy", "hold", "sell", "unknown"] as GuruVoteTone[]).map((tone) => {
                  const meta = getVoteToneMeta(tone);
                  return (
                    <span
                      key={tone}
                      className={`px-2 py-1 rounded-full border font-semibold ${meta.className}`}
                    >
                      {meta.shortLabel}
                    </span>
                  );
                })}
              </div>
            </div>

            {heatmapColumns.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                  title="히트맵을 만들 후보 종목이 아직 없어요"
                  description="스크리너를 실행하면 거장별 의견을 비교해서 보여줘요."
                />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs border-separate border-spacing-y-1.5">
                  <thead>
                    <tr>
                      <th className="text-left text-[#8b95a1] font-semibold px-2 py-1">
                        거장
                      </th>
                      {heatmapColumns.map((column) => (
                        <th
                          key={column.ticker}
                          className="text-center text-[#6b7684] font-semibold px-2 py-1"
                          title={column.name || column.ticker}
                        >
                          {column.ticker}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapRows.map((row) => (
                      <tr key={row.guru}>
                        <th className="text-left text-[#4e5968] font-semibold px-2 py-1 whitespace-nowrap">
                          {row.guru}
                        </th>
                        {row.cells.map((cell) => {
                          const meta = getVoteToneMeta(cell.tone);
                          return (
                            <td key={`${row.guru}-${cell.ticker}`} className="px-1.5 py-1 text-center">
                              <span
                                className={`inline-flex min-w-[40px] justify-center px-2 py-1 rounded-lg border font-semibold ${meta.className}`}
                                title={`${row.guru} · ${cell.ticker} · ${meta.label}`}
                              >
                                {meta.shortLabel}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card.Content>
      </Card>

      <Card className="p-4 sm:p-5">
        <Card.Header className="pb-2">
          <Card.Title className="text-base sm:text-lg">13인 거장 비교 분석</Card.Title>
          <Card.Description>
            거장별 종합의견 합의율과 거장 간 의견 유사도를 함께 비교해요.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="rounded-2xl border border-[#e5e8eb] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#f2f4f6]">
              <p className="text-sm font-bold text-[#191f28]">거장별 합의율 랭킹</p>
              <span className="text-[11px] text-[#8b95a1]">
                종합의견과 같은 방향 비율 기준
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
              {guruComparison.guruStats.map((item, idx) => {
                const rate = item.agreementRate;
                const width = Math.max(6, Math.round(rate ?? 0));
                return (
                  <div key={item.guru} className="rounded-xl bg-[#f9fafb] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] text-[#8b95a1] w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-[#191f28] truncate">{item.guru}</span>
                      </div>
                      <span className="text-[11px] text-[#6b7684]">
                        {item.votes}회
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#e5e8eb] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#3182f6] transition-all duration-700"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-[#8b95a1]">
                        평균 확신도{" "}
                        {item.avgConfidence == null ? "-" : `${item.avgConfidence.toFixed(1)}점`}
                      </span>
                      <span className="font-bold text-[#191f28]">
                        {rate == null ? "-" : `${rate.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5e8eb] bg-white p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#191f28]">거장별 합의율 타임라인</p>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f2f4f6] overflow-x-auto">
                {GURU_LABELS.slice(0, 8).map((guru) => (
                  <button
                    key={guru}
                    onClick={() => setSelectedGuruForTimeline(guru)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
                      selectedGuruForTimeline === guru
                        ? "bg-white text-[#191f28]"
                        : "text-[#8b95a1] hover:text-[#4e5968]"
                    }`}
                  >
                    {guru}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {selectedGuruTimeline.length === 0 ? (
                <p className="text-xs text-[#8b95a1]">타임라인 데이터가 아직 부족해요.</p>
              ) : (
                selectedGuruTimeline.map((point) => {
                  const rate = point.rate ?? 0;
                  return (
                    <div
                      key={`${selectedGuruForTimeline}-${point.date}`}
                      className="grid grid-cols-[72px_1fr_auto] gap-2 items-center"
                    >
                      <span className="text-[11px] text-[#8b95a1]">{point.date.slice(5)}</span>
                      <div className="h-2 rounded-full bg-[#e5e8eb] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#3182f6] transition-all duration-700"
                          style={{ width: `${Math.max(4, Math.round(rate))}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[#4e5968] whitespace-nowrap">
                        {point.rate == null ? "-" : `${point.rate.toFixed(1)}%`} · {point.count}건
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5e8eb] bg-white p-3.5">
            <p className="text-sm font-bold text-[#191f28]">거장 간 의견 상관 매트릭스</p>
            <p className="text-[11px] text-[#8b95a1] mt-0.5">
              같은 종목에서 같은 의견(매수/중립/매도)을 낸 비율이에요.
            </p>
            <div className="mt-2.5 overflow-x-auto">
              <table className="min-w-full text-[11px] border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-[#8b95a1] px-1.5 py-1">거장</th>
                    {GURU_LABELS.map((guru) => (
                      <th key={`head-${guru}`} className="text-center text-[#8b95a1] px-1.5 py-1">
                        {guru}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GURU_LABELS.map((rowGuru, rowIdx) => (
                    <tr key={`row-${rowGuru}`}>
                      <th className="text-left text-[#4e5968] px-1.5 py-1 whitespace-nowrap">
                        {rowGuru}
                      </th>
                      {guruComparison.correlationMatrix[rowIdx].map((cell, colIdx) => {
                        const value = cell.percent;
                        const intensity =
                          value == null ? 0 : Math.min(1, Math.max(0, value / 100));
                        const bgColor =
                          rowIdx === colIdx
                            ? "#e8f3ff"
                            : value == null
                              ? "#f2f4f6"
                              : `rgba(49,130,246,${0.12 + intensity * 0.45})`;
                        const textColor =
                          rowIdx === colIdx || (value != null && value >= 70)
                            ? "#191f28"
                            : "#4e5968";
                        return (
                          <td key={`${rowGuru}-${GURU_LABELS[colIdx]}`} className="px-1 py-1 text-center">
                            <span
                              className="inline-flex min-w-[42px] justify-center rounded-md px-1.5 py-1 font-semibold"
                              style={{ backgroundColor: bgColor, color: textColor }}
                              title={
                                value == null
                                  ? "비교 표본 없음"
                                  : `${value.toFixed(1)}% · 표본 ${cell.samples}건`
                              }
                            >
                              {value == null ? "-" : `${Math.round(value)}%`}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card.Content>
      </Card>
      </>
      )}

      {/* 전체 스크리너 통합 뷰 */}
      {showScreener && activeSubTab === "all" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>전체 스크리너 종목</Card.Title>
                <Card.Description>
                  실시간 스크리너와 roma 종목을 티커 중복 없이 모았어요. 내재가치/종가가 높은 순으로 보여요.
                </Card.Description>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefreshLive}
                  isLoading={isLoading}
                >
                  실시간 갱신
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefreshRoma}
                  isLoading={isRomaLoading}
                >
                  roma 갱신
                </Button>
              </div>
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {filteredAllCandidates.length === 0 && (isLoading || isRomaLoading) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] animate-pulse h-24"
                  />
                ))}
              </div>
            ) : filteredAllCandidates.length === 0 ? (
              <EmptyState
                icon={<Search className="w-8 h-8 text-[#8b95a1]" />}
                title="조회된 종목이 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 종목이 없어요.`
                    : "실시간 스크리너와 roma를 갱신하면 종목을 함께 확인할 수 있어요."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {filteredAllCandidates.map(({ stock, sources }, i) => {
                  const insight = getCandidateInsight(stock);
                  const stabilityMeta = getIntrinsicStabilityMeta(insight.intrinsicStability);
                  const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);
                  const percentB = percentBByTicker[stock.ticker.toUpperCase()];
                  const changeRate =
                    typeof stock.change_rate === "number" && Number.isFinite(stock.change_rate)
                      ? stock.change_rate
                      : null;

                  return (
                    <div
                      key={stock.ticker.toUpperCase()}
                      className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] hover:border-[#3182f6] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
                      onClick={() => handleOpenReportByTicker(stock.ticker, stock)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {renderTickerAvatar(stock)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#191f28] text-sm group-hover:text-[#3182f6] transition-colors truncate">
                                {stock.ticker}
                              </span>
                              <Badge variant="primary">#{stock.rank || i + 1}</Badge>
                            </div>
                            <p className="text-xs text-[#8b95a1] truncate max-w-[150px] mt-0.5" title={stock.name}>
                              {stock.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[#191f28]">
                            ${Number.isFinite(stock.price) ? stock.price.toFixed(2) : "-"}
                          </div>
                          {changeRate !== null && (
                            <div className={`text-xs font-semibold ${changeRate >= 0 ? "text-[#f04452]" : "text-[#03b26c]"}`}>
                              {changeRate >= 0 ? "+" : ""}{changeRate.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#4e5968] pt-1.5 border-t border-[#f2f4f6]">
                        {sources.map((source) => (
                          <Badge key={source} variant="primary">{source}</Badge>
                        ))}
                        <Badge variant={insight.verdict === "매수" ? "success" : insight.verdict === "매도" ? "danger" : "neutral"}>
                          종합의견: {insight.verdict || "리포트 준비 중"}
                        </Badge>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                          %B: <strong>{formatPercentB(percentB)}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                          확신도:{" "}
                          <strong>{insight.confidence == null ? "-" : `${insight.confidence.toFixed(1)}점`}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                          내재가치/종가: <strong className={insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100 ? "text-[#03b26c]" : "text-[#4e5968]"}>
                            {ratioText || "리포트 준비 중"}
                          </strong>
                        </span>
                        <Badge
                          variant={stabilityMeta.variant}
                          title={formatIntrinsicStabilityDetail(insight.intrinsicStability)}
                        >
                          {stabilityMeta.text}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#8b95a1]">
                        <span>
                          {stock.roe != null ? <>ROE: <strong className="text-[#4e5968]">{(stock.roe * 100).toFixed(1)}%</strong></> : null}
                          {stock.holders != null ? <>{stock.roe != null ? " · " : ""}보유 <strong className="text-[#4e5968]">{stock.holders}명</strong></> : null}
                        </span>
                        <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                          리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 토스 공통 스크리너 실시간 뷰 */}
      {showScreener && activeSubTab === "live" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>토스 거장 공통 필터 통과 종목</Card.Title>
                <Card.Description>
                  13인의 거장 기준을 동시에 만족하는 미국 상위 200개 우량주 스크리닝 목록이에요.
                </Card.Description>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshLive}
                isLoading={isLoading}
              >
                스크리너 재실행
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] animate-pulse h-24 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200"></div>
                      <div className="space-y-1.5">
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-4 w-14 bg-gray-200 rounded ml-auto"></div>
                      <div className="h-3 w-10 bg-gray-100 rounded ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLiveCandidates.length === 0 ? (
              <EmptyState
                icon={<Search className="w-8 h-8 text-[#8b95a1]" />}
                title="스크리너 조회 결과가 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 종목이 없어요.`
                    : "상단의 [스크리너 재실행] 버튼을 누르면 실시간으로 토스 공통 스크리닝을 시작해요."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {filteredLiveCandidates.map((stock, i) => (
                  (() => {
                    const insight = getCandidateInsight(stock);
                    const stabilityMeta = getIntrinsicStabilityMeta(insight.intrinsicStability);
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);
                    const percentB = percentBByTicker[stock.ticker.toUpperCase()];
                    const changeRate =
                      typeof stock.change_rate === "number" && Number.isFinite(stock.change_rate)
                        ? stock.change_rate
                        : null;
                    return (
                      <div
                        key={`${stock.ticker}-${i}`}
                        className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] hover:border-[#3182f6] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
                        onClick={() => handleOpenReportByTicker(stock.ticker, stock)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {renderTickerAvatar(stock)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#191f28] text-sm group-hover:text-[#3182f6] transition-colors truncate">
                                  {stock.ticker}
                                </span>
                                <Badge variant="primary">#{stock.rank || i + 1}</Badge>
                              </div>
                              <p className="text-xs text-[#8b95a1] truncate max-w-[130px] mt-0.5" title={stock.name}>
                                {stock.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-[#191f28]">
                              ${stock.price?.toFixed(2) || "0.00"}
                            </div>
                            {changeRate !== null && (
                              <div
                                className={`text-xs font-semibold ${
                                  changeRate >= 0
                                    ? "text-[#f04452]"
                                    : "text-[#03b26c]"
                                }`}
                              >
                                {changeRate >= 0 ? "+" : ""}
                                {changeRate.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#4e5968] pt-1.5 border-t border-[#f2f4f6]">
                          <Badge variant={insight.verdict === "매수" ? "success" : insight.verdict === "매도" ? "danger" : "neutral"}>
                            종합의견: {insight.verdict || "리포트 준비 중"}
                          </Badge>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            %B: <strong>{formatPercentB(percentB)}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            확신도:{" "}
                            <strong>{insight.confidence == null ? "-" : `${insight.confidence.toFixed(1)}점`}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            내재가치/종가:{" "}
                            <strong className={ratioText && insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100 ? "text-[#03b26c]" : "text-[#4e5968]"}>
                              {ratioText || "리포트 준비 중"}
                            </strong>
                          </span>
                          <Badge
                            variant={stabilityMeta.variant}
                            title={formatIntrinsicStabilityDetail(insight.intrinsicStability)}
                          >
                            {stabilityMeta.text}
                          </Badge>
                        </div>

                        {stock.roe != null && (
                          <div className="flex items-center justify-between text-[11px] text-[#8b95a1]">
                            <span>
                              ROE: <strong className="text-[#4e5968]">{(stock.roe * 100).toFixed(1)}%</strong>
                            </span>
                            <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                              리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 2-2. DataRoma 슈퍼인베스터 스크리너(roma) 뷰 */}
      {showScreener && activeSubTab === "roma" && (
        <Card className="p-4 sm:p-6">
          <Card.Header className="border-b border-[#f2f4f6] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Card.Title>DataRoma 슈퍼인베스터 보유 종목</Card.Title>
                <Card.Description>
                  미국 슈퍼인베스터 10명 이상이 공동 보유한 종목이에요. 종목을 클릭하면
                  실시간 스크리너와 동일하게 5단계 리포트를 확인할 수 있어요.
                </Card.Description>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefreshRoma}
                isLoading={isRomaLoading}
              >
                roma 재실행
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="pt-2">
            {isRomaLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] animate-pulse h-24 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200"></div>
                      <div className="space-y-1.5">
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-4 w-14 bg-gray-200 rounded ml-auto"></div>
                      <div className="h-3 w-10 bg-gray-100 rounded ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRomaCandidates.length === 0 ? (
              <EmptyState
                icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                title="roma 스크리너 조회 결과가 없어요"
                description={
                  searchTerm
                    ? `'${searchTerm}' 검색 조건과 일치하는 종목이 없어요.`
                    : "상단의 [roma 재실행] 버튼을 누르면 DataRoma 그랜드 포트폴리오를 다시 조회해요."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {filteredRomaCandidates.map((stock, i) => (
                  (() => {
                    const insight = getCandidateInsight(stock);
                    const stabilityMeta = getIntrinsicStabilityMeta(insight.intrinsicStability);
                    const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct);
                    const percentB = percentBByTicker[stock.ticker.toUpperCase()];
                    return (
                      <div
                        key={`roma-${stock.ticker}-${i}`}
                        className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] hover:border-[#3182f6] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
                        onClick={() => handleOpenReportByTicker(stock.ticker, stock)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {renderTickerAvatar(stock)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#191f28] text-sm group-hover:text-[#3182f6] transition-colors truncate">
                                  {stock.ticker}
                                </span>
                                <Badge variant="primary">
                                  {stock.holders != null ? `${stock.holders}인` : `#${i + 1}`}
                                </Badge>
                              </div>
                              <p
                                className="text-xs text-[#8b95a1] truncate max-w-[130px] mt-0.5"
                                title={stock.name}
                              >
                                {stock.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-[#191f28]">
                              ${stock.price?.toFixed(2) || "0.00"}
                            </div>
                            {stock.weight_pct != null && (
                              <div className="text-xs font-semibold text-[#8b95a1]">
                                {stock.weight_pct}%
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#4e5968] pt-1.5 border-t border-[#f2f4f6]">
                          <Badge variant={insight.verdict === "매수" ? "success" : insight.verdict === "매도" ? "danger" : "neutral"}>
                            종합의견: {insight.verdict || "리포트 준비 중"}
                          </Badge>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            %B: <strong>{formatPercentB(percentB)}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            확신도:{" "}
                            <strong>{insight.confidence == null ? "-" : `${insight.confidence.toFixed(1)}점`}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8eb]">
                            내재가치/종가:{" "}
                            <strong className={ratioText && insight.intrinsicRatioPct != null && insight.intrinsicRatioPct >= 100 ? "text-[#03b26c]" : "text-[#4e5968]"}>
                              {ratioText || "리포트 준비 중"}
                            </strong>
                          </span>
                          <Badge
                            variant={stabilityMeta.variant}
                            title={formatIntrinsicStabilityDetail(insight.intrinsicStability)}
                          >
                            {stabilityMeta.text}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#8b95a1]">
                          <span>
                            보유{" "}
                            <strong className="text-[#4e5968]">
                              {stock.holders != null ? `${stock.holders}명` : "-"}
                            </strong>
                            {stock.hold_price != null ? (
                              <> · 매수가 ${stock.hold_price.toFixed(2)}</>
                            ) : null}
                          </span>
                          <span className="text-[#3182f6] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                            리포트 확인 <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* 리포트 상세 열람 모달 (마크다운 완벽 렌더링 + 과거 날짜 이동 + 즉시 매수) */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        className="sm:max-w-4xl"
      >
        <Modal.Header
          title={`${selectedReport?.ticker} 심층 투자 분석 보고서`}
          description={`${selectedReport?.company_name || ""} · 분석일: ${selectedReport?.d} · 종합 의견: ${selectedReport?.verdict}`}
        />
        <Modal.Body>
          <div className="space-y-4">
            {/* 1. 과거 날짜 리포트 선택 바 */}
            {availableDatesForTicker.length > 0 && (
              <div className="p-2.5 bg-[#f2f4f6] rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                  <span className="font-semibold text-[#6b7684] shrink-0 flex items-center gap-1 pl-1">
                    <History className="w-3.5 h-3.5 text-[#3182f6]" />
                    분석 일자:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {availableDatesForTicker.map((dt, idx) => {
                      const isCurrent = dt === selectedReport?.d;
                      const isLatest = idx === 0;
                      return (
                        <button
                          key={dt}
                          onClick={() => handleSelectReportDate(dt)}
                          disabled={isLoadingReportDate || isCurrent}
                          className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap text-xs cursor-pointer ${
                            isCurrent
                              ? "bg-[#3182f6] text-white shadow-xs"
                              : "bg-white text-[#4e5968] hover:text-[#191f28] hover:bg-white/80"
                          }`}
                        >
                          {dt} {isLatest && "(최신)"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {isLoadingReportDate && (
                  <span className="text-[11px] text-[#3182f6] font-semibold animate-pulse shrink-0">
                    리포트 불러오는 중...
                  </span>
                )}
              </div>
            )}

            {/* 표결 요약 및 종합 적정가 카드 */}
            {(() => {
              const valConsensus = extractValuationConsensus(selectedReport);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. 거장 원탁 표결 요약 */}
                  <div className="p-3.5 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6] flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#8b95a1]">
                        거장 원탁 표결 결과
                      </span>
                      <Badge variant="primary" className="text-xs font-bold px-2 py-0.5">
                        종합: {selectedReport?.verdict}
                      </Badge>
                    </div>
                    <div className="text-sm font-bold text-[#191f28]">
                      {selectedReport?.vote_summary || "13인 표결 완료"}
                    </div>
                  </div>

                  {/* 2. 종합 적정 내재가치 & 투자 실행 밴드 */}
                  <div className="p-3.5 rounded-2xl bg-[#f8fafd] border border-[#3182f6]/20 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#3182f6]">
                        종합 적정 내재가치
                      </span>
                      {valConsensus?.target_price_band && (
                        <span className="text-[11px] text-[#6b7684] bg-white px-2 py-0.5 rounded-md border border-[#e5e8eb]">
                          밴드: {valConsensus.target_price_band}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-base font-extrabold text-[#191f28]">
                        {valConsensus?.fair_value_price !== null && valConsensus?.fair_value_price !== undefined
                          ? (selectedReport?.ticker === "000660" || (selectedReport?.current_price && selectedReport.current_price > 1000)
                              ? `${valConsensus.fair_value_price.toLocaleString()}원`
                              : `$${valConsensus.fair_value_price.toFixed(2)}`)
                          : "토론 합의 중"}
                      </div>
                      {(valConsensus?.safety_entry_price || valConsensus?.optimistic_target_price) && (
                        <div className="text-[11px] text-[#4e5968] flex items-center gap-1.5 flex-wrap justify-end">
                          {valConsensus.safety_entry_price && (
                            <span><strong className="text-[#008040]">안전:</strong> {valConsensus.safety_entry_price}</span>
                          )}
                          {valConsensus.optimistic_target_price && (
                            <span><strong className="text-[#d93025]">목표:</strong> {valConsensus.optimistic_target_price}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 마크다운 뷰 탭 전환 버튼 (5개 모드: 최종보고서, 원탁토론, 개별서머리, 데이터팩, 일봉차트) */}
            <div className="flex items-center gap-1 p-1 bg-[#f2f4f6] rounded-2xl overflow-x-auto -mx-1 px-1">
              <button
                onClick={() => setReportViewMode("final")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "final"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                최종 마스터 보고서
              </button>
              <button
                onClick={() => setReportViewMode("discussion")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "discussion"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                13인 거장 원탁 토론
              </button>
              <button
                onClick={() => setReportViewMode("summaries")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "summaries"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                13인 개별 서머리
              </button>
              <button
                onClick={() => setReportViewMode("datapack")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  reportViewMode === "datapack"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                심층 데이터팩
              </button>
              <button
                onClick={() => setReportViewMode("chart")}
                className={`shrink-0 sm:shrink sm:flex-1 py-1.5 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${
                  reportViewMode === "chart"
                    ? "bg-white text-[#3182f6] shadow-xs"
                    : "text-[#8b95a1] hover:text-[#4e5968]"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                일봉 & 볼린저밴드
              </button>
            </div>

            {/* 리포트 본문 / 서머리 / 데이터팩 / 차트 렌더링 */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#e5e8eb] shadow-xs max-h-[62vh] overflow-y-auto">
              {reportViewMode === "final" && (
                selectedReport?.final_report ? (
                  <MarkdownViewer content={selectedReport.final_report} />
                ) : (
                  <EmptyState
                    icon={<FileText className="w-8 h-8 text-[#8b95a1]" />}
                    title="최종 보고서가 아직 생성되지 않았어요"
                    description="12:00 정기 배치 또는 수동 분석이 완료되면 이곳에 보고서가 등록돼요. '일봉 & 볼린저밴드' 탭에서 실시간 차트를 먼저 확인해 보세요."
                  />
                )
              )}

              {reportViewMode === "discussion" && (
                selectedReport?.discussion ? (
                  <MarkdownViewer content={selectedReport.discussion} />
                ) : (
                  <EmptyState
                    icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                    title="원탁 토론 전문이 아직 등록되지 않았어요"
                    description="거장 AI 분석 파이프라인이 진행되면 13인의 심층 토론 전문이 등록돼요."
                  />
                )
              )}

              {reportViewMode === "summaries" && (
                selectedReport?.summaries ? (
                  <ReportSummariesView summaries={selectedReport.summaries} />
                ) : (
                  <EmptyState
                    icon={<Users className="w-8 h-8 text-[#8b95a1]" />}
                    title="거장 개별 서머리가 아직 없어요"
                    description="리포트 파이프라인이 완료되면 13인의 종목 평가 의견이 표시돼요."
                  />
                )
              )}

              {reportViewMode === "datapack" && (
                selectedReport?.datapack ? (
                  <ReportDatapackView datapack={selectedReport.datapack} />
                ) : (
                  <EmptyState
                    icon={<FileText className="w-8 h-8 text-[#8b95a1]" />}
                    title="심층 데이터팩이 아직 없어요"
                    description="Yahoo Finance 및 재무제표 시계열 데이터팩이 수집되면 이곳에 표시돼요."
                  />
                )
              )}

              {reportViewMode === "chart" && selectedReport && (
                <StockChartView
                  ticker={selectedReport.ticker}
                  companyName={selectedReport.company_name}
                />
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-[#8b95a1] truncate hidden sm:block">
              {selectedReport?.ticker} · 분석일 {selectedReport?.d}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="secondary" onClick={() => setReportModalOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
