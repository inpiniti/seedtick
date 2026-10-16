import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { requireAdmin } from "@/lib/subscription/admin";
import {
  ReportOutcomeRow,
  GuruOpinionOutcomeRow,
  GuruAccuracyStat,
  HorizonPerformanceStat,
  OutcomesOverview,
} from "@/types/api";
import { GURU_PERSONAS } from "@/lib/guruPersonas";

const ANALYZER_URL =
  process.env.NEXT_PUBLIC_ANALYZER_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const HORIZON_LABELS: Record<number, string> = {
  21: "1개월 (21거래일)",
  63: "3개월 (63거래일)",
  126: "6개월 (126거래일)",
  252: "1년 (252거래일)",
};

/** 페르소나 명칭을 GURU_PERSONAS 메타데이터에 매핑 */
function resolveGuruMeta(rawPersona: string): { name: string; style: string; slug: string } {
  const norm = rawPersona.replace(/[\s\-_]/g, "").toLowerCase();
  for (const [slug, persona] of Object.entries(GURU_PERSONAS)) {
    const slugNorm = slug.toLowerCase();
    const nameNorm = persona.name.replace(/[\s\-_]/g, "").toLowerCase();
    const engNorm = persona.englishName.replace(/[\s\-_]/g, "").toLowerCase();
    if (norm.includes(slugNorm) || norm.includes(nameNorm) || norm.includes(engNorm) || nameNorm.includes(norm)) {
      return { name: persona.name, style: persona.style.split("/")[0].trim(), slug };
    }
  }
  return { name: rawPersona, style: "가치투자", slug: rawPersona };
}

export async function GET(req: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const horizonParam = searchParams.get("horizon");
  const horizonFilter = horizonParam && horizonParam !== "all" ? Number(horizonParam) : null;
  const limitParam = Number(searchParams.get("limit") || "100");

  try {
    // 1. report_outcomes 조회
    let reportOutcomesQuery = supabase
      .from("report_outcomes")
      .select("*")
      .order("d", { ascending: false })
      .order("horizon_days", { ascending: true });

    if (horizonFilter) {
      reportOutcomesQuery = reportOutcomesQuery.eq("horizon_days", horizonFilter);
    }

    const { data: reportOutcomesData, error: reportOutcomesError } = await reportOutcomesQuery.limit(limitParam * 2);

    if (reportOutcomesError) {
      // 테이블이 아직 없는 경우 빈 상태 반환
      if (reportOutcomesError.code === "42P01") {
        return NextResponse.json({
          success: true,
          data: buildEmptyOverview(),
          message: "성과 추적 테이블이 아직 준비되지 않았어요.",
        });
      }
      return NextResponse.json(
        { success: false, message: reportOutcomesError.message },
        { status: 500 }
      );
    }

    // 2. guru_opinion_outcomes 조회
    let guruOutcomesQuery = supabase
      .from("guru_opinion_outcomes")
      .select("*");

    if (horizonFilter) {
      guruOutcomesQuery = guruOutcomesQuery.eq("horizon_days", horizonFilter);
    }

    const { data: guruOutcomesData, error: guruOutcomesError } = await guruOutcomesQuery.limit(1000);

    const reportRows: ReportOutcomeRow[] = (reportOutcomesData || []).map((r) => ({
      report_id: String(r.report_id),
      ticker: String(r.ticker),
      d: String(r.d),
      horizon_days: Number(r.horizon_days),
      verdict: String(r.verdict),
      price_then: Number(r.price_then),
      price_target: r.price_target != null ? Number(r.price_target) : null,
      price_after: r.price_after != null ? Number(r.price_after) : null,
      return_pct: r.return_pct != null ? Number(r.return_pct) : null,
      bench_return_pct: r.bench_return_pct != null ? Number(r.bench_return_pct) : null,
      excess_return_pct: r.excess_return_pct != null ? Number(r.excess_return_pct) : null,
      hit_fair_value: r.hit_fair_value != null ? Boolean(r.hit_fair_value) : null,
      measured_at: String(r.measured_at),
    }));

    const guruRows: GuruOpinionOutcomeRow[] = (guruOutcomesData || []).map((g) => ({
      opinion_id: Number(g.opinion_id),
      report_id: String(g.report_id),
      ticker: String(g.ticker),
      persona: String(g.persona),
      horizon_days: Number(g.horizon_days),
      verdict: String(g.verdict),
      confidence: g.confidence != null ? Number(g.confidence) : null,
      price_then: Number(g.price_then),
      price_after: g.price_after != null ? Number(g.price_after) : null,
      return_pct: g.return_pct != null ? Number(g.return_pct) : null,
      is_correct: g.is_correct != null ? Boolean(g.is_correct) : null,
      measured_at: String(g.measured_at),
    }));

    // 3. 통계 집계: 거장별 성과 및 적중률
    const guruGroupMap: Record<string, {
      meta: { name: string; style: string; slug: string };
      total: number;
      correct: number;
      returns: number[];
      confidences: number[];
    }> = {};

    for (const g of guruRows) {
      const meta = resolveGuruMeta(g.persona);
      const key = meta.slug;
      if (!guruGroupMap[key]) {
        guruGroupMap[key] = {
          meta,
          total: 0,
          correct: 0,
          returns: [],
          confidences: [],
        };
      }
      guruGroupMap[key].total += 1;
      if (g.is_correct === true) {
        guruGroupMap[key].correct += 1;
      }
      if (g.return_pct != null) {
        guruGroupMap[key].returns.push(g.return_pct);
      }
      if (g.confidence != null) {
        guruGroupMap[key].confidences.push(g.confidence);
      }
    }

    const guru_stats: GuruAccuracyStat[] = Object.values(guruGroupMap).map((item) => {
      const evaluated = item.total;
      const acc = evaluated > 0 ? (item.correct / evaluated) * 100 : null;
      const avgRet = item.returns.length > 0
        ? item.returns.reduce((a, b) => a + b, 0) / item.returns.length
        : null;
      const avgConf = item.confidences.length > 0
        ? item.confidences.reduce((a, b) => a + b, 0) / item.confidences.length
        : null;

      return {
        persona: item.meta.slug,
        name: item.meta.name,
        style: item.meta.style,
        total_opinions: item.total,
        evaluated_count: evaluated,
        correct_count: item.correct,
        accuracy_pct: acc != null ? Math.round(acc * 10) / 10 : null,
        avg_return_pct: avgRet != null ? Math.round(avgRet * 10) / 10 : null,
        avg_confidence: avgConf != null ? Math.round(avgConf * 10) / 10 : null,
      };
    }).sort((a, b) => (b.accuracy_pct ?? -1) - (a.accuracy_pct ?? -1));

    // 4. 통계 집계: 관측 시계(Horizon)별 성과
    const horizonGroupMap: Record<number, {
      returns: number[];
      benchReturns: number[];
      excessReturns: number[];
      hitFairValues: boolean[];
      wins: number[];
    }> = {
      21: { returns: [], benchReturns: [], excessReturns: [], hitFairValues: [], wins: [] },
      63: { returns: [], benchReturns: [], excessReturns: [], hitFairValues: [], wins: [] },
      126: { returns: [], benchReturns: [], excessReturns: [], hitFairValues: [], wins: [] },
      252: { returns: [], benchReturns: [], excessReturns: [], hitFairValues: [], wins: [] },
    };

    for (const r of reportRows) {
      const h = r.horizon_days;
      if (!horizonGroupMap[h]) {
        horizonGroupMap[h] = { returns: [], benchReturns: [], excessReturns: [], hitFairValues: [], wins: [] };
      }
      if (r.return_pct != null) horizonGroupMap[h].returns.push(r.return_pct);
      if (r.bench_return_pct != null) horizonGroupMap[h].benchReturns.push(r.bench_return_pct);
      if (r.excess_return_pct != null) {
        horizonGroupMap[h].excessReturns.push(r.excess_return_pct);
        horizonGroupMap[h].wins.push(r.excess_return_pct > 0 ? 1 : 0);
      }
      if (r.hit_fair_value != null) {
        horizonGroupMap[h].hitFairValues.push(r.hit_fair_value);
      }
    }

    const horizon_stats: HorizonPerformanceStat[] = [21, 63, 126, 252].map((h) => {
      const data = horizonGroupMap[h];
      const count = data.returns.length;
      const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

      const avgRet = avg(data.returns);
      const avgBench = avg(data.benchReturns);
      const avgExcess = avg(data.excessReturns);
      const fairHit = data.hitFairValues.length > 0
        ? (data.hitFairValues.filter(Boolean).length / data.hitFairValues.length) * 100
        : null;
      const winRate = data.wins.length > 0
        ? (data.wins.reduce((a, b) => a + b, 0) / data.wins.length) * 100
        : null;

      return {
        horizon_days: h,
        horizon_label: HORIZON_LABELS[h] || `${h}일`,
        evaluated_count: count,
        avg_return_pct: avgRet != null ? Math.round(avgRet * 10) / 10 : null,
        avg_bench_return_pct: avgBench != null ? Math.round(avgBench * 10) / 10 : null,
        avg_excess_return_pct: avgExcess != null ? Math.round(avgExcess * 10) / 10 : null,
        fair_value_hit_rate_pct: fairHit != null ? Math.round(fairHit * 10) / 10 : null,
        win_rate_pct: winRate != null ? Math.round(winRate * 10) / 10 : null,
      };
    });

    // 5. 전체 종합 요약 지표
    const allExcess = reportRows.map((r) => r.excess_return_pct).filter((v): v is number => v != null);
    const avgExcessAll = allExcess.length > 0 ? allExcess.reduce((a, b) => a + b, 0) / allExcess.length : null;

    const allFairHits = reportRows.map((r) => r.hit_fair_value).filter((v): v is boolean => v != null);
    const fairHitAll = allFairHits.length > 0
      ? (allFairHits.filter(Boolean).length / allFairHits.length) * 100
      : null;

    const topGuruCandidate = guru_stats.find((g) => g.accuracy_pct != null && g.evaluated_count >= 1);

    const overview: OutcomesOverview = {
      total_reports_tracked: new Set(reportRows.map((r) => r.report_id)).size,
      total_evaluations: reportRows.length,
      avg_excess_return_pct: avgExcessAll != null ? Math.round(avgExcessAll * 10) / 10 : null,
      fair_value_hit_rate_pct: fairHitAll != null ? Math.round(fairHitAll * 10) / 10 : null,
      top_guru: topGuruCandidate
        ? {
            persona: topGuruCandidate.persona,
            name: topGuruCandidate.name,
            accuracy_pct: topGuruCandidate.accuracy_pct!,
          }
        : null,
      guru_stats,
      horizon_stats,
      recent_outcomes: reportRows.slice(0, limitParam),
    };

    return NextResponse.json({ success: true, data: overview });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "성과 추적 데이터 조회에 실패했어요.",
      },
      { status: 500 }
    );
  }
}

/** 성과 추적 배치 수동 실행 (관리자 전용) */
export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: gate.message },
      { status: gate.status }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = `${ANALYZER_URL}/api/scheduler/outcomes`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      return NextResponse.json(
        {
          success: false,
          message: json?.message || `분석기 서버 오류 (${res.status})`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: json.message || "성과 추적 배치를 성공적으로 실행했어요.",
      evaluated: json.evaluated,
      duration_sec: json.duration_sec,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "성과 추적 배치 실행에 실패했어요.",
      },
      { status: 500 }
    );
  }
}

function buildEmptyOverview(): OutcomesOverview {
  return {
    total_reports_tracked: 0,
    total_evaluations: 0,
    avg_excess_return_pct: null,
    fair_value_hit_rate_pct: null,
    top_guru: null,
    guru_stats: [],
    horizon_stats: [21, 63, 126, 252].map((h) => ({
      horizon_days: h,
      horizon_label: HORIZON_LABELS[h] || `${h}일`,
      evaluated_count: 0,
      avg_return_pct: null,
      avg_bench_return_pct: null,
      avg_excess_return_pct: null,
      fair_value_hit_rate_pct: null,
      win_rate_pct: null,
    })),
    recent_outcomes: [],
  };
}
