import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import {
  getServerAllowedFreeDate,
  isDateAllowedForAccess,
  maskReportRow,
  resolveReportAccess,
} from "@/lib/subscription/reportAccess";
import { deduplicateReportsByLatestDate } from "@/lib/reportUtils";
import type { GuruReportRow } from "@/types/api";

/**
 * 리포트 목록 게이트웨이 — guru_reports 직접 조회 금지 이후 유일한 진입점.
 * 권한 없는 일자 행은 민감 컬럼을 제거한 티저(현재가만)까지만 반환합니다.
 * date와 prev_date가 함께 전달될 경우 두 일자의 리포트를 조회하고
 * 동일 종목코드는 최신 일자 우선으로 중복을 제거하여 반환합니다.
 */
export async function GET(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { success: false, message: "서버 리포트 조회 설정이 없습니다." },
      { status: 500 }
    );
  }
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const prevDate = searchParams.get("prev_date");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || "200") || 200, 1),
    500
  );

  const access = await resolveReportAccess(req);

  const LIST_COLUMNS = [
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
    "conclusion",
    "hot_topics",
    "bull_points",
    "bear_points",
    "key_drivers",
    "action_guide",
    "valuation_flags",
    "parse_mode",
    "prompt_version",
    "created_at",
    "updated_at",
    "summaries",
  ].join(",");

  try {
    let query = supabase
      .from("guru_reports")
      .select(LIST_COLUMNS)
      .order("d", { ascending: false });

    const hasPrevDate =
      Boolean(prevDate && prevDate !== "ALL" && prevDate !== date);

    if (date && date !== "ALL") {
      if (hasPrevDate) {
        // 선택 일자와 직전 일자를 함께 조회 (최신일 우선)
        query = query
          .in("d", [date, prevDate!])
          .order("overall_score", { ascending: true })
          .limit(Math.min(limit * 2, 500));
      } else {
        query = query
          .eq("d", date)
          .order("overall_score", { ascending: true })
          .limit(limit);
      }
    } else {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const rawReports = (data as GuruReportRow[]) || [];
    const processedReports = hasPrevDate
      ? deduplicateReportsByLatestDate(rawReports).slice(0, limit)
      : rawReports;

    const now = new Date();
    // Free(체험 없음)일 때만 DB 기준 폴백 무료일자 1개를 허용 (클라와 동일 규칙)
    const allowedFreeDate =
      access.tier === "free" && !access.isTrialActive
        ? await getServerAllowedFreeDate(supabase, now)
        : undefined;
    const reports = processedReports.map((rawRow: any) => {
      // 거장 의견 중 목록·모달 표시에 필요한 필드만 경량화 (체크리스트, 프롬프트 해시 등 거대 필드 제외)
      const slimmedSummaries = Array.isArray(rawRow.summaries)
        ? rawRow.summaries.map((s: any) => ({
            persona: s.persona || s.guru_name || null,
            verdict: s.verdict || s.stance || null,
            confidence: typeof s.confidence === "number" ? s.confidence : null,
            quote:
              s.quote ||
              s.rationale ||
              (Array.isArray(s.core_arguments) && s.core_arguments.length > 0
                ? s.core_arguments[0]
                : null) ||
              null,
            core_arguments: Array.isArray(s.core_arguments)
              ? s.core_arguments.slice(0, 2)
              : null,
            parse_mode: s.parse_mode || null,
          }))
        : null;

      const row: GuruReportRow = {
        ...rawRow,
        datapack: null,
        final_report: null,
        discussion: null,
        summaries: slimmedSummaries,
      };

      return maskReportRow(
        row,
        isDateAllowedForAccess(row.d, access, now, allowedFreeDate)
      );
    });

    return NextResponse.json({ success: true, reports });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "리포트 조회 실패",
      },
      { status: 500 }
    );
  }
}
