import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GuruReportRow, SystemLogItem } from "@/types/api";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * 최신 에러 및 시스템 로그 조회
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
 * 심층 투자 보고서 목록 및 특정 일자 리포트 조회
 */
export async function fetchGuruReports(limit = 200, date?: string): Promise<GuruReportRow[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from("guru_reports")
      .select("*")
      .order("d", { ascending: false });

    if (date && date !== "ALL") {
      query = query.eq("d", date).order("overall_score", { ascending: false });
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.warn("fetchGuruReports error:", error.message);
      return [];
    }
    return (data as GuruReportRow[]) || [];
  } catch (err) {
    console.warn("fetchGuruReports exception:", err);
    return [];
  }
}

/**
 * 보고서(guru_reports)에 존재하는 고유한 날짜 목록 조회 (내림차순)
 */
export async function fetchGuruReportDates(): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("d")
      .order("d", { ascending: false });

    if (error) {
      console.warn("fetchGuruReportDates error:", error.message);
      return [];
    }
    const dates = Array.from(new Set((data || []).map((row) => row.d as string)));
    return dates;
  } catch (err) {
    console.warn("fetchGuruReportDates exception:", err);
    return [];
  }
}

/**
 * 특정 종목(ticker)에 존재하는 보고서 날짜 목록 조회 (내림차순)
 */
export async function fetchReportDatesByTicker(ticker: string): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("d")
      .eq("ticker", ticker.toUpperCase())
      .order("d", { ascending: false });

    if (error) {
      console.warn("fetchReportDatesByTicker error:", error.message);
      return [];
    }
    const dates = Array.from(new Set((data || []).map((row) => row.d as string)));
    return dates;
  } catch (err) {
    console.warn("fetchReportDatesByTicker exception:", err);
    return [];
  }
}

/**
 * 특정 날짜와 티커의 단일 보고서 조회
 */
export async function fetchReportByDateAndTicker(
  date: string,
  ticker: string
): Promise<GuruReportRow | null> {
  if (!supabase) return null;
  try {
    const reportId = `${date}_${ticker.toUpperCase()}`;
    const { data, error } = await supabase
      .from("guru_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (error) {
      // id 매칭 안될 경우 d, ticker 복합조건으로 폴백
      const fallbackRes = await supabase
        .from("guru_reports")
        .select("*")
        .eq("d", date)
        .eq("ticker", ticker.toUpperCase())
        .limit(1)
        .maybeSingle();
      return (fallbackRes.data as GuruReportRow) || null;
    }

    return (data as GuruReportRow) || null;
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
 * 티커 -> 한글 종목명 맵 조회 (ticker_logos 캐시, 로고 워밍업과 동일한 저장 구조)
 * 관리자 화면의 모든 메뉴에서 종목명을 한글명으로 통일 표시하기 위해 사용한다.
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
 * 전 기간 종목별 내재가치 히스토리 조회 (안정성 계산용 경량 쿼리)
 */
export async function fetchHistoricalValuations(): Promise<HistoricalValuationRecord[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("ticker, d, datapack->valuation_consensus->fair_value_price")
      .order("d", { ascending: true });

    if (error) {
      console.warn("fetchHistoricalValuations error:", error.message);
      return [];
    }

    const records: HistoricalValuationRecord[] = [];
    for (const row of data || []) {
      const fv = (row as any).fair_value_price;
      if (typeof fv === "number" && Number.isFinite(fv) && fv > 0) {
        records.push({
          ticker: (row.ticker as string).toUpperCase(),
          d: row.d as string,
          fair_value_price: fv,
        });
      }
    }
    return records;
  } catch (err) {
    console.warn("fetchHistoricalValuations exception:", err);
    return [];
  }
}

