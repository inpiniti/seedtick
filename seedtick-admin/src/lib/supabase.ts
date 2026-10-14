import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GuruReportRow, SystemLogItem } from "@/types/api";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/** 리포트 게이트웨이 호출용 Bearer 토큰 (없으면 비로그인 public扱い) */
async function getReportAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = (await supabase?.auth.getSession())?.data.session
      ?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * 최신 에러 및 시스템 로그 조회 (비민감 운영 로그 — 직접 조회 유지)
 */
export async function fetchSystemLogs(
  limit = 50,
  level?: string
): Promise<SystemLogItem[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (level && level !== "ALL") {
      query = query.eq("level", level);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("fetchSystemLogs error:", error.message);
      return [];
    }
    return (data as SystemLogItem[]) || [];
  } catch (err) {
    console.warn("fetchSystemLogs exception:", err);
    return [];
  }
}

/**
 * 심층 투자 보고서 목록 — 서버 게이트웨이 경유 (직접 DB 접근 금지).
 * 권한 없는 행은 서버가 민감 컬럼을 제거한 티저(현재가만)로 반환합니다.
 */
export async function fetchGuruReports(limit = 200, date?: string): Promise<GuruReportRow[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (date && date !== "ALL") params.set("date", date);
    const res = await fetch(`/api/reports?${params.toString()}`, {
      headers: await getReportAuthHeaders(),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      console.warn("fetchGuruReports error:", json?.message);
      return [];
    }
    return (json.reports as GuruReportRow[]) || [];
  } catch (err) {
    console.warn("fetchGuruReports exception:", err);
    return [];
  }
}

/**
 * 보고서에 존재하는 고유한 날짜 목록 조회 — 일자 자체는 비민감
 */
export async function fetchGuruReportDates(): Promise<string[]> {
  try {
    const res = await fetch("/api/reports/dates", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return [];
    return (json.dates as string[]) || [];
  } catch (err) {
    console.warn("fetchGuruReportDates exception:", err);
    return [];
  }
}

/**
 * 특정 종목(ticker)에 존재하는 보고서 날짜 목록 조회 — 일자 자체는 비민감
 */
export async function fetchReportDatesByTicker(ticker: string): Promise<string[]> {
  try {
    const res = await fetch(
      `/api/reports/dates-by-ticker?ticker=${encodeURIComponent(ticker.toUpperCase())}`,
      { cache: "no-store" }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return [];
    return (json.dates as string[]) || [];
  } catch (err) {
    console.warn("fetchReportDatesByTicker exception:", err);
    return [];
  }
}

/**
 * 특정 날짜와 티커의 단일 보고서 조회 — 서버 게이트웨이 경유.
 * 권한 없으면 티저(현재가만) 반환, 원문은 포함되지 않습니다.
 */
export async function fetchReportByDateAndTicker(
  date: string,
  ticker: string
): Promise<GuruReportRow | null> {
  try {
    const params = new URLSearchParams({ date, ticker: ticker.toUpperCase() });
    const res = await fetch(`/api/reports/detail?${params.toString()}`, {
      headers: await getReportAuthHeaders(),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return null;
    return (json.report as GuruReportRow) || null;
  } catch (err) {
    console.warn("fetchReportByDateAndTicker exception:", err);
    return null;
  }
}

export interface HistoricalValuationRecord {
  ticker: string;
  d: string;
  fair_value_price: number;
}

/**
 * 티커 -> 한글 종목명 맵 조회 (ticker_logos 캐시 — 비민감 공개 데이터)
 */
export async function fetchTickerNameMap(
  limit = 5000
): Promise<Record<string, string>> {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from("ticker_logos")
      .select("ticker,korean_name")
      .not("korean_name", "is", null)
      .limit(limit);

    if (error) {
      console.warn("fetchTickerNameMap error:", error.message);
      return {};
    }

    const map: Record<string, string> = {};
    for (const row of data || []) {
      const ticker = ((row as { ticker?: string }).ticker || "").trim().toUpperCase();
      const name = ((row as { korean_name?: string }).korean_name || "").trim();
      if (ticker && name) map[ticker] = name;
    }
    return map;
  } catch (err) {
    console.warn("fetchTickerNameMap exception:", err);
    return {};
  }
}

/**
 * 전 기간 종목별 내재가치 히스토리 — 서버 게이트웨이 경유.
 * 권한 없는 일자(최근 30일)의 적정가는 서버가 한 건도 반환하지 않습니다.
 */
export async function fetchHistoricalValuations(): Promise<HistoricalValuationRecord[]> {
  try {
    const res = await fetch("/api/reports/valuations", {
      headers: await getReportAuthHeaders(),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return [];
    return (json.records as HistoricalValuationRecord[]) || [];
  } catch (err) {
    console.warn("fetchHistoricalValuations exception:", err);
    return [];
  }
}
