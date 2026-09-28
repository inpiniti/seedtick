import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GuruReportRow, GuruVoteRow, SystemLogItem } from "@/types/api";

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
 * 13인 거장 표결 점수 랭킹 최신 조회
 */
export async function fetchGuruVotes(limit = 50): Promise<GuruVoteRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("guru_votes")
      .select("*")
      .order("d", { ascending: false })
      .order("g0", { ascending: true }) // 0점(매수) 우선
      .limit(limit);

    if (error) {
      console.warn("fetchGuruVotes error:", error.message);
      return [];
    }
    return (data as GuruVoteRow[]) || [];
  } catch (err) {
    console.warn("fetchGuruVotes exception:", err);
    return [];
  }
}

/**
 * 심층 투자 보고서 목록 및 특정 종목 리포트 조회
 */
export async function fetchGuruReports(limit = 20): Promise<GuruReportRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("*")
      .order("d", { ascending: false })
      .limit(limit);

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
