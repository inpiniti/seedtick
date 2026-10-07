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

