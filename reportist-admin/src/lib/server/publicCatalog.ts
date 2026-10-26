/**
 * 공개(비로그인) 기준 카탈로그 서버 데이터 헬퍼.
 *
 * 목적:
 * 1. SEO — 정적 프리렌더 페이지(`/`, `/stocks`)의 HTML에 실제 종목 목록과
 *    크롤링 가능한 링크를 포함시킨다. (클라 fetch에만 의존하면 봇이 빈 페이지를 색인)
 * 2. 마스킹 일관성 — SSR 마스킹은 서버 API와 동일한 free 폴백 규칙을 따른다.
 *
 * 원칙:
 * - 공개 가능한(무료) 일자의 리포트만 노출한다.
 * - 마스터 리포트 본문(final_report)·데이터팩(datapack)·거장 서머리(summaries)는
 *   목록 렌더링에 필요하지 않으므로 조회하지 않는다. (HTML 페이로드 폭주 방지)
 */

import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import {
  getDefaultReportDate,
  isReportRestricted,
} from "@/lib/subscription/subscriptionPolicy";
import {
  getServerAllowedFreeDate,
  maskReportRowPublic,
} from "@/lib/subscription/reportAccess";
import {
  getPreviousAvailableDate,
  deduplicateReportsByLatestDate,
} from "@/lib/reportUtils";
import type { GuruReportRow } from "@/types/api";

/** 목록 렌더링에 필요한 경량 컬럼 (본문/데이터팩/서머리 제외) */
const CATALOG_COLUMNS = [
  "id",
  "d",
  "ticker",
  "company_name",
  "current_price",
  "verdict",
  "overall_score",
  "vote_summary",
  "fair_value",
  "band_low",
  "band_high",
  "safety_entry",
  "target_sell",
  "upside_pct",
  "votes_buy",
  "votes_hold",
  "votes_watch",
  "votes_sell",
  "avg_confidence",
  "dispersion_pct",
  "price_estimate_count",
  "created_at",
].join(",");

export interface TickerDirectoryEntry {
  ticker: string;
  /** 화면/SEO용 표시명 (한글명 → DB company_name → 티커 순) */
  name: string;
  /** 해당 티커의 최신 리포트 일자 */
  latestDate: string;
  /** 공개 열람 가능한(무료) 리포트 일자 목록 (최신순) */
  publicDates: string[];
}

export interface PublicCatalog {
  /** 모든 발행 일자 (최신순) */
  dates: string[];
  /** free 기준 기본 일자 (30일 이전이 없으면 가장 오래된 일자) */
  freeDate: string;
  /** freeDate 기준 공개 리포트 (마스킹 적용 후) */
  reports: GuruReportRow[];
  /** 전체 종목 디렉터리 */
  directory: TickerDirectoryEntry[];
  /** 티커 → 한글 종목명 (SSR 목록의 앵커 텍스트·키워드 커버리지용) */
  tickerNameMap: Record<string, string>;
}

const EMPTY_CATALOG: PublicCatalog = {
  dates: [],
  freeDate: "",
  reports: [],
  directory: [],
  tickerNameMap: {},
};

interface LightRow {
  ticker: unknown;
  d: unknown;
  company_name: unknown;
}

/**
 * 전역 발행 일자 목록 (최신순).
 *
 * IMPORTANT: /api/reports/dates 와 동일한 1000행 제한을 적용한다.
 * 제한이 다르면 "free 폴백 일자" 계산 결과가 서버 API / SSR / 클라이언트에서
 * 서로 달라져 공개 가능 날짜가 어긋난다. (단일 진실 규칙)
 */
export async function getGlobalReportDates(): Promise<string[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("d")
      .order("d", { ascending: false })
      .limit(1000);
    if (error) return [];

    return Array.from(
      new Set(
        ((data as Array<{ d: string }>) || [])
          .map((r) => r.d)
          .filter(Boolean)
      )
    ).sort().reverse();
  } catch {
    return [];
  }
}

/**
 * 티커/일자/종목명만 조회 (경량). supabase-js 1000행 제한을 피하기 위해 range 페이지네이션.
 */
async function fetchLightRows(): Promise<LightRow[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return [];

  const PAGE_SIZE = 1000;
  const MAX_ROWS = 50000;
  const rows: LightRow[] = [];

  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("guru_reports")
        .select("ticker, d, company_name")
        .order("d", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.warn("[publicCatalog] light query failed:", error);
        break;
      }
      if (!data || data.length === 0) break;

      rows.push(...(data as LightRow[]));
      if (data.length < PAGE_SIZE) break;
    }
  } catch (err) {
    console.warn("[publicCatalog] light query error:", err);
  }

  return rows;
}

/** 티커 → 한글 종목명 (ticker_logos) */
async function fetchKoreanNames(): Promise<Record<string, string>> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from("ticker_logos")
      .select("ticker, korean_name");
    if (error) return {};

    const map: Record<string, string> = {};
    for (const row of (data as Array<{ ticker?: string; korean_name?: string }>) || []) {
      const ticker = (row.ticker || "").trim().toUpperCase();
      const name = (row.korean_name || "").trim();
      if (ticker && name && name.toUpperCase() !== ticker) map[ticker] = name;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * 공개 기준 카탈로그를 조회한다.
 * - dates: 모든 발행 일자 (최신순)
 * - freeDate: free 티어가 볼 수 있는 기본 일자
 * - reports: freeDate 기준 공개(마스킹 후) 리포트
 * - directory: 전체 종목 디렉터리
 */
export async function getPublicCatalog(): Promise<PublicCatalog> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return EMPTY_CATALOG;

  const lightRows = await fetchLightRows();
  if (lightRows.length === 0) return EMPTY_CATALOG;

  const now = new Date();

  // 1. 발행 일자 목록 (최신순) — /api/reports/dates 와 동일 기준
  const dates = await getGlobalReportDates();
  if (dates.length === 0) return EMPTY_CATALOG;

  // 2. free 기준 기본 일자 (30일 이전 없으면 가장 오래된 일자)
  //    dates 가 /api/reports/dates 와 동일 조회이므로 getServerAllowedFreeDate 와
  //    동일한 값이 나온다. (API · SSR · 클라이언트 판정이 일치한다)
  const freeDate =
    getDefaultReportDate(dates, "free", now, false) || dates[dates.length - 1];

  // 3. 티커별 일자/company_name 집계
  const tickerDates = new Map<string, string[]>();
  const tickerCompanyName = new Map<string, string>();
  for (const row of lightRows) {
    const ticker = typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
    const d = typeof row.d === "string" ? row.d.trim() : "";
    if (!ticker || !d) continue;
    // 유효한 주식 티커 심볼(미국 1~6자 영문/점, 국내 6자리) 및 YYYY-MM-DD 형식만 허용
    if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;

    const list = tickerDates.get(ticker) || [];
    list.push(d);
    tickerDates.set(ticker, list);
    if (!tickerCompanyName.has(ticker)) {
      const cn = typeof row.company_name === "string" ? row.company_name.trim() : "";
      if (cn && cn.toUpperCase() !== ticker) tickerCompanyName.set(ticker, cn);
    }
  }

  // 4. 공개 열람 가능 일자 판정 (free 폴백 규칙과 동일)
  const isPublicDate = (d: string) =>
    !isReportRestricted(d, "free", now, freeDate, false);

  // 5. 종목 디렉터리
  const koreanNames = await fetchKoreanNames();
  const directory: TickerDirectoryEntry[] = Array.from(tickerDates.entries())
    .map(([ticker, list]) => {
      const sorted = Array.from(new Set(list)).sort().reverse();
      const name =
        koreanNames[ticker] || tickerCompanyName.get(ticker) || ticker;
      return {
        ticker,
        name,
        latestDate: sorted[0] || "",
        publicDates: sorted.filter(isPublicDate),
      };
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  // 6. freeDate 기준 공개 리포트 (직전 분석일 보완 및 최신 우선 종목 중복 제거)
  const prevDate = getPreviousAvailableDate(freeDate, dates);
  const targetDates = prevDate ? [freeDate, prevDate] : [freeDate];

  let reports: GuruReportRow[] = [];
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select(CATALOG_COLUMNS)
      .in("d", targetDates)
      .order("d", { ascending: false })
      .order("overall_score", { ascending: true })
      .limit(1000);
    if (error) {
      console.warn("[publicCatalog] report query failed:", error);
    } else {
      const rawRows = (data as unknown as GuruReportRow[]) || [];
      const validRows = rawRows.filter(
        (r) =>
          r.ticker &&
          /^[A-Z0-9.]{1,10}$/.test(r.ticker.trim().toUpperCase()) &&
          r.d &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.d.trim())
      );
      const dedupedRows = deduplicateReportsByLatestDate(validRows);
      reports = dedupedRows.map((row) =>
        maskReportRowPublic(
          {
            ...row,
            // 목록 렌더링에 필요 없는 본문/데이터팩/서머리는 항상 비운다.
            datapack: null,
            final_report: null,
            summaries: null,
          } as GuruReportRow,
          freeDate
        )
      );
    }
  } catch (err) {
    console.warn("[publicCatalog] report query error:", err);
  }

  return { dates, freeDate, reports, directory, tickerNameMap: koreanNames };
}

/**
 * 특정 티커의 특정 일자 리포트를 공개 기준으로 조회한다.
 * - allowedFreeDate가 주어지면 free 폴백 규칙까지 반영한다.
 */
export async function getPublicReportForDate(
  ticker: string,
  date?: string,
  allowedFreeDate?: string
): Promise<GuruReportRow | null> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const normTicker = (ticker || "").trim().toUpperCase();
  if (!normTicker || !/^[A-Z0-9.]{1,10}$/.test(normTicker)) return null;

  try {
    let row: GuruReportRow | null = null;

    if (date) {
      const { data } = await supabase
        .from("guru_reports")
        .select("*")
        .eq("id", `${date}_${normTicker}`)
        .maybeSingle();
      row = (data as GuruReportRow | null) || null;

      if (!row) {
        const fallback = await supabase
          .from("guru_reports")
          .select("*")
          .eq("d", date)
          .eq("ticker", normTicker)
          .limit(1)
          .maybeSingle();
        row = (fallback.data as GuruReportRow | null) || null;
      }
    } else {
      const { data } = await supabase
        .from("guru_reports")
        .select("*")
        .eq("ticker", normTicker)
        .order("d", { ascending: false })
        .limit(1)
        .maybeSingle();
      row = (data as GuruReportRow | null) || null;
    }

    if (!row) return null;
    return maskReportRowPublic(row, allowedFreeDate);
  } catch (err) {
    console.warn("[publicCatalog] getPublicReportForDate error:", err);
    return null;
  }
}

/**
 * 특정 티커의 발행 일자 목록 (최신순).
 * 종목 상세 페이지의 "분석 이력" 링크를 SSR에 포함시키기 위해 사용한다.
 */
export async function getTickerReportDates(ticker: string): Promise<string[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return [];
  const normTicker = (ticker || "").trim().toUpperCase();
  if (!normTicker || !/^[A-Z0-9.]{1,10}$/.test(normTicker)) return [];

  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("d")
      .eq("ticker", normTicker)
      .order("d", { ascending: false })
      .limit(500);
    if (error) return [];

    return Array.from(
      new Set(
        ((data as Array<{ d: string }>) || [])
          .map((r) => r.d)
          .filter(Boolean)
      )
    ).sort().reverse();
  } catch {
    return [];
  }
}

/**
 * free 기준 허용 기본 일자 (SSR 마스킹 기준일).
 * DB에 30일 이전 행이 하나도 없으면 가장 오래된 일자가 무료 폴백이 된다.
 * /api/reports/detail 과 동일한 기준(getServerAllowedFreeDate)을 사용한다.
 */
export async function getServerFreeDate(): Promise<string | undefined> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return undefined;
  return (await getServerAllowedFreeDate(supabase, new Date())) || undefined;
}

export interface TimelineStatItem {
  date: string;
  displayDate: string;
  avgApprovalRate: number;
  stocksCount: number;
  topStock: {
    ticker: string;
    name: string;
    rate: number;
    votesBuy: number;
    currentPrice?: number | null;
    fairValue?: number | null;
  } | null;
}

/**
 * 일자별 거장 심사 시계열 통계 요약 (최근 15개 일자)
 * /stats 페이지의 시계열 타임라인 차트에 사용된다.
 */
export async function getTimelineStats(): Promise<TimelineStatItem[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return [];

  try {
    const koreanNames = await fetchKoreanNames();
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 5000;
    const rows: Array<Record<string, any>> = [];

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("guru_reports")
        .select("d, ticker, company_name, votes_buy, votes_watch, votes_hold, votes_sell, current_price, fair_value, upside_pct")
        .order("d", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.warn("[publicCatalog] getTimelineStats query failed:", error);
        break;
      }
      if (!data || data.length === 0) break;

      rows.push(...(data as Array<Record<string, any>>));
      if (data.length < PAGE_SIZE) break;
    }

    if (rows.length === 0) return [];

    const grouped = new Map<string, Array<Record<string, any>>>();
    for (const row of rows) {
      const d = row.d;
      if (!d) continue;
      const list = grouped.get(d) || [];
      list.push(row);
      grouped.set(d, list);
    }

    const sortedDates = Array.from(grouped.keys()).sort();
    const recentDates = sortedDates.slice(-12); // 최근 12개 일자

    return recentDates.map((date) => {
      const list = grouped.get(date) || [];
      let totalRates = 0;
      let topStock: TimelineStatItem["topStock"] = null;
      let maxRate = -1;

      for (const item of list) {
        const votesBuy = typeof item.votes_buy === "number" ? item.votes_buy : 0;
        const totalVotes =
          votesBuy +
          (typeof item.votes_watch === "number" ? item.votes_watch : 0) +
          (typeof item.votes_hold === "number" ? item.votes_hold : 0) +
          (typeof item.votes_sell === "number" ? item.votes_sell : 0) || 13;
        const rate = Math.round((votesBuy / totalVotes) * 100);
        totalRates += rate;

        if (rate > maxRate) {
          maxRate = rate;
          const ticker = (item.ticker || "").toUpperCase();
          const name = koreanNames[ticker] || item.company_name || ticker;
          topStock = {
            ticker,
            name,
            rate,
            votesBuy,
            currentPrice: item.current_price,
            fairValue: item.fair_value,
          };
        }
      }

      const avgRate = list.length > 0 ? Math.round(totalRates / list.length) : 0;
      const parts = date.split("-");
      const displayDate = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : date;

      return {
        date,
        displayDate,
        avgApprovalRate: avgRate,
        stocksCount: list.length,
        topStock,
      };
    });
  } catch (err) {
    console.warn("[publicCatalog] getTimelineStats error:", err);
    return [];
  }
}

export interface StockTimelinePoint {
  date: string;
  displayDate: string;
  curr: number;
  fair: number | null;
  safety: number | null;
  fairRatio: number | null; // 적정가 / 종가 (%)
  safetyRatio: number | null; // 안전마진 / 종가 (%)
  votesBuy?: number;
  verdict?: string;
}

export interface StockTimelineSeries {
  ticker: string;
  name: string;
  latestDate: string;
  latestPrice: number | null;
  latestFairRatio: number | null;
  latestSafetyRatio: number | null;
  latestVotesBuy: number;
  isKr: boolean;
  points: StockTimelinePoint[];
}

/**
 * 117개 전 종목별 과거 발행일 시계열 데이터 집계
 * (X축: 실제 작성된 날짜 포인트들, Y축: 적정가/종가, 안전마진/종가)
 */
export async function getStockTimelines(): Promise<StockTimelineSeries[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return [];

  try {
    const koreanNames = await fetchKoreanNames();
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 20000;
    const rows: Array<Record<string, any>> = [];

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("guru_reports")
        .select("d, ticker, company_name, current_price, fair_value, safety_entry, upside_pct, votes_buy, verdict")
        .order("d", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.warn("[publicCatalog] getStockTimelines query failed:", error);
        break;
      }
      if (!data || data.length === 0) break;

      rows.push(...(data as Array<Record<string, any>>));
      if (data.length < PAGE_SIZE) break;
    }

    if (rows.length === 0) return [];

    const tickerMap = new Map<string, Array<Record<string, any>>>();
    for (const row of rows) {
      const ticker = (row.ticker || "").trim().toUpperCase();
      const d = row.d;
      if (!ticker || !d) continue;

      const list = tickerMap.get(ticker) || [];
      list.push(row);
      tickerMap.set(ticker, list);
    }

    const seriesList: StockTimelineSeries[] = [];

    for (const [ticker, rows] of tickerMap.entries()) {
      const points: StockTimelinePoint[] = [];
      let latestPrice: number | null = null;
      let latestFairRatio: number | null = null;
      let latestSafetyRatio: number | null = null;
      let latestVotesBuy = 0;
      let latestDate = "";
      let companyName = "";

      for (const r of rows) {
        if (!companyName && r.company_name) companyName = r.company_name;

        const curr = typeof r.current_price === "number" && r.current_price > 0 ? r.current_price : null;
        const fair = typeof r.fair_value === "number" && r.fair_value > 0 ? r.fair_value : null;
        const safety = typeof r.safety_entry === "number" && r.safety_entry > 0 ? r.safety_entry : null;

        if (curr) {
          latestPrice = curr;
          latestDate = r.d;
          latestVotesBuy = typeof r.votes_buy === "number" ? r.votes_buy : 0;

          // 적정가 / 종가 비율 (%)
          let fairRatio: number | null = null;
          if (fair && curr) {
            fairRatio = Math.round((fair / curr) * 100);
          } else if (typeof r.upside_pct === "number") {
            fairRatio = Math.round(100 + r.upside_pct);
          }

          // 안전마진 / 종가 비율 (%)
          let safetyRatio: number | null = null;
          if (safety && curr) {
            safetyRatio = Math.round((safety / curr) * 100);
          } else if (fairRatio) {
            safetyRatio = Math.round(fairRatio * 0.8);
          }

          if (fairRatio !== null || safetyRatio !== null) {
            const parts = (r.d || "").split("-");
            const displayDate = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : r.d;

            latestFairRatio = fairRatio;
            latestSafetyRatio = safetyRatio;

            points.push({
              date: r.d,
              displayDate,
              curr,
              fair,
              safety,
              fairRatio,
              safetyRatio,
              votesBuy: r.votes_buy,
              verdict: r.verdict,
            });
          }
        }
      }

      if (points.length > 0) {
        const name = koreanNames[ticker] || companyName || ticker;
        const isKr = /^\d{6}$/.test(ticker);

        seriesList.push({
          ticker,
          name,
          latestDate,
          latestPrice,
          latestFairRatio,
          latestSafetyRatio,
          latestVotesBuy,
          isKr,
          points,
        });
      }
    }

    // 최신 적정가/종가 높은 순(내림차순)으로 기본 정렬
    return seriesList.sort(
      (a, b) => (b.latestFairRatio || 0) - (a.latestFairRatio || 0)
    );
  } catch (err) {
    console.warn("[publicCatalog] getStockTimelines error:", err);
    return [];
  }
}
