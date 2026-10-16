"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  OutcomesOverview,
  GuruAccuracyStat,
  HorizonPerformanceStat,
  ReportOutcomeRow,
} from "@/types/api";
import { fetchOutcomes, triggerOutcomeTracking } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import {
  TrendingUp,
  Award,
  RefreshCw,
  Play,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Percent,
} from "lucide-react";

interface OutcomesViewProps {
  isAdmin?: boolean;
  onSelectReport?: (reportId: string, ticker: string, date: string) => void;
}

const HORIZON_TABS = [
  { id: "all", label: "전체 기간" },
  { id: "21", label: "1개월 (21일)" },
  { id: "63", label: "3개월 (63일)" },
  { id: "126", label: "6개월 (126일)" },
  { id: "252", label: "1년 (252일)" },
] as const;

export function OutcomesView({ isAdmin = false, onSelectReport }: OutcomesViewProps) {
  const [data, setData] = useState<OutcomesOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHorizon, setSelectedHorizon] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"gurus" | "horizons" | "reports">("gurus");
  const [searchTerm, setSearchTerm] = useState("");

  // 수동 배치 실행 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);

  const refresh = useCallback(async (horizonVal = selectedHorizon) => {
    setIsLoading(true);
    try {
      const h = horizonVal === "all" ? undefined : Number(horizonVal);
      const res = await fetchOutcomes(h);
      setData(res);
    } catch (err) {
      console.warn("성과 추적 데이터 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedHorizon]);

  useEffect(() => {
    let cancelled = false;
    const h = selectedHorizon === "all" ? undefined : Number(selectedHorizon);
    fetchOutcomes(h)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("성과 추적 데이터 로드 오류:", err);
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedHorizon]);

  const handleTriggerBatch = async () => {
    setIsTriggering(true);
    setTriggerFeedback(null);
    try {
      const res = await triggerOutcomeTracking();
      setTriggerFeedback(
        res.evaluated != null
          ? `${res.evaluated}건의 과거 리포트 성과 평가를 완료했어요.`
          : res.message || "배치를 완료했어요."
      );
      // 데이터 다시 불러오기
      await refresh();
    } catch (err) {
      setTriggerFeedback(
        err instanceof Error ? err.message : "배치 실행 중 오류가 발생했어요."
      );
    } finally {
      setIsTriggering(false);
    }
  };

  const filteredRecentOutcomes = (data?.recent_outcomes || []).filter((r) => {
    if (!searchTerm.trim()) return true;
    return r.ticker.toLowerCase().includes(searchTerm.toLowerCase().trim());
  });

  return (
    <div className="space-y-8 font-sans">
      {/* ── 1. 헤더 & 액션바 ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              Track Record & Accuracy
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              실시간 검증
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-[#0f172a]" />
            투자 리포트 성과 및 거장 적중률
          </h1>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
            발행된 가치평가 리포트와 13인 거장들의 투자의견이 실제 시장에서 어떤 수익률을 기록했는지 투명하게 추적해요.
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
            className="flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>새로고침</span>
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setTriggerFeedback(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>성과 추적 배치 실행</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── 2. 핵심 KPI 카드 4종 ── */}
      {isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 animate-pulse">
              <div className="h-3 w-1/2 bg-[#f1f5f9] rounded" />
              <div className="h-6 w-3/4 bg-[#e2e8f0] rounded" />
              <div className="h-3 w-2/3 bg-[#f8fafc] rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 카드 1: 누적 평가 리포트 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[#64748b] text-xs font-medium">
              <span>추적 대상 리포트</span>
              <Calendar className="w-4 h-4 text-[#94a3b8]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[#0f172a]">
              {data?.total_reports_tracked?.toLocaleString() ?? 0}
              <span className="text-xs font-normal text-[#64748b] ml-1">종목</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              총 {data?.total_evaluations?.toLocaleString() ?? 0}건 기간별 관측 완료
            </p>
          </div>

          {/* 카드 2: SPY 대비 초과수익률 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[#64748b] text-xs font-medium">
              <span>SPY 대비 평균 알파(초과)</span>
              <TrendingUp className="w-4 h-4 text-[#94a3b8]" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold font-mono flex items-center gap-1 ${
                (data?.avg_excess_return_pct ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {(data?.avg_excess_return_pct ?? 0) >= 0 ? (
                <ArrowUpRight className="w-5 h-5 shrink-0" />
              ) : (
                <ArrowDownRight className="w-5 h-5 shrink-0" />
              )}
              {data?.avg_excess_return_pct != null
                ? `${data.avg_excess_return_pct > 0 ? "+" : ""}${data.avg_excess_return_pct}%`
                : "집계중"}
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              벤치마크(S&P 500) 대비 초과 성과
            </p>
          </div>

          {/* 카드 3: 적정가 도달 성공률 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[#64748b] text-xs font-medium">
              <span>적정가 도달 성공률</span>
              <Percent className="w-4 h-4 text-[#94a3b8]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[#0f172a]">
              {data?.fair_value_hit_rate_pct != null
                ? `${data.fair_value_hit_rate_pct}%`
                : "집계중"}
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              관측 기간 내 제시한 적정가 터치 비율
            </p>
          </div>

          {/* 카드 4: 최고 적중 거장 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[#64748b] text-xs font-medium">
              <span>최고 적중률 거장</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-[#0f172a] truncate">
              {data?.top_guru?.name || "분석 대기"}
            </div>
            <p className="text-[11px] font-mono text-emerald-600 font-semibold">
              {data?.top_guru ? `적중률 ${data.top_guru.accuracy_pct}%` : "표본 수집 중"}
            </p>
          </div>
        </div>
      )}

      {/* ── 3. 관측 시계(Horizon) 필터 칩 ── */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
        <span className="text-[11px] font-mono text-[#64748b] px-2 font-medium">관측 시계:</span>
        {HORIZON_TABS.map((tab) => {
          const isActive = selectedHorizon === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedHorizon(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-pointer ${
                isActive
                  ? "bg-[#0f172a] text-white font-semibold shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 4. 탭 네비게이션 ── */}
      <div className="border-b border-[#e2e8f0]">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("gurus")}
            className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "gurus"
                ? "border-[#0f172a] text-[#0f172a] font-bold"
                : "border-transparent text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>13인 거장 적중률 랭킹 ({data?.guru_stats?.length ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("horizons")}
            className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "horizons"
                ? "border-[#0f172a] text-[#0f172a] font-bold"
                : "border-transparent text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>보유 기간별 성과 매트릭스</span>
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "reports"
                ? "border-[#0f172a] text-[#0f172a] font-bold"
                : "border-transparent text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>최근 평가 리포트 ({data?.recent_outcomes?.length ?? 0})</span>
          </button>
        </div>
      </div>

      {/* ── 5. 탭 콘텐츠 ── */}
      {/* 탭 A: 13인 거장 적중률 랭킹 */}
      {activeTab === "gurus" && (
        <div className="space-y-4">
          {(!data?.guru_stats || data.guru_stats.length === 0) ? (
            <EmptyState
              icon="🏆"
              title="아직 거장 적중률 표본이 쌓이지 않았어요"
              description="최소 21거래일(1개월)이 경과한 리포트의 주가 변화를 토대로 거장별 예측 적중률이 자동 계산돼요."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-2xs">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">순위</th>
                    <th className="py-3 px-4">투자 거장</th>
                    <th className="py-3 px-4">투자 스타일</th>
                    <th className="py-3 px-4 text-center">예측 적중률</th>
                    <th className="py-3 px-4 text-right">평가 표본</th>
                    <th className="py-3 px-4 text-right">평균 수익률</th>
                    <th className="py-3 px-4 text-right">평균 확신도</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {data.guru_stats.map((g, idx) => {
                    const rankBadge =
                      idx === 0
                        ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                        : idx === 1
                        ? "bg-slate-200 text-slate-800 border-slate-300 font-bold"
                        : idx === 2
                        ? "bg-orange-100 text-orange-800 border-orange-300 font-bold"
                        : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]";

                    return (
                      <tr key={g.persona} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block w-6 h-6 leading-6 rounded-full text-center font-mono text-[11px] border ${rankBadge}`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#0f172a] text-sm">
                          {g.name}
                        </td>
                        <td className="py-3 px-4 text-[#64748b]">
                          {g.style}
                        </td>
                        <td className="py-3 px-4 min-w-[160px]">
                          {g.accuracy_pct != null ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between font-mono text-xs font-semibold">
                                <span
                                  className={
                                    g.accuracy_pct >= 60
                                      ? "text-emerald-600"
                                      : g.accuracy_pct >= 45
                                      ? "text-[#0f172a]"
                                      : "text-[#64748b]"
                                  }
                                >
                                  {g.accuracy_pct}%
                                </span>
                                <span className="text-[10px] text-[#94a3b8] font-normal">
                                  {g.correct_count} / {g.evaluated_count} 적중
                                </span>
                              </div>
                              <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    g.accuracy_pct >= 60
                                      ? "bg-emerald-500"
                                      : g.accuracy_pct >= 45
                                      ? "bg-[#0f172a]"
                                      : "bg-slate-400"
                                  }`}
                                  style={{ width: `${Math.min(g.accuracy_pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#94a3b8] font-mono text-xs">평가 대기</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#0f172a]">
                          {g.evaluated_count}건
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {g.avg_return_pct != null ? (
                            <span
                              className={`font-semibold ${
                                g.avg_return_pct >= 0 ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {g.avg_return_pct > 0 ? "+" : ""}
                              {g.avg_return_pct}%
                            </span>
                          ) : (
                            <span className="text-[#94a3b8]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#64748b]">
                          {g.avg_confidence != null ? `${g.avg_confidence} / 10` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 탭 B: 보유 기간별 성과 매트릭스 */}
      {activeTab === "horizons" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.horizon_stats?.map((h) => {
              const hasData = h.evaluated_count > 0;
              return (
                <div
                  key={h.horizon_days}
                  className="p-5 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-[#0f172a]">{h.horizon_label}</h3>
                      <p className="text-[11px] text-[#94a3b8] font-mono">
                        {h.horizon_days} 거래일 경과 시점
                      </p>
                    </div>
                    <Badge variant={hasData ? "primary" : "neutral"}>
                      {h.evaluated_count}건
                    </Badge>
                  </div>

                  {hasData ? (
                    <div className="space-y-3 font-mono text-xs">
                      {/* 평균 수익률 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b]">리포트 평균 수익률:</span>
                        <span
                          className={`font-bold ${
                            (h.avg_return_pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {(h.avg_return_pct ?? 0) > 0 ? "+" : ""}
                          {h.avg_return_pct ?? 0}%
                        </span>
                      </div>

                      {/* SPY 벤치마크 수익률 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b]">S&P 500 (SPY):</span>
                        <span className="font-medium text-[#0f172a]">
                          {(h.avg_bench_return_pct ?? 0) > 0 ? "+" : ""}
                          {h.avg_bench_return_pct ?? 0}%
                        </span>
                      </div>

                      {/* 초과 수익률 (알파) */}
                      <div className="flex items-center justify-between p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                        <span className="font-semibold text-[#0f172a]">초과 수익률 (알파):</span>
                        <span
                          className={`font-bold ${
                            (h.avg_excess_return_pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {(h.avg_excess_return_pct ?? 0) > 0 ? "+" : ""}
                          {h.avg_excess_return_pct ?? 0}%
                        </span>
                      </div>

                      {/* 적정가 도달 성공률 */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[#64748b]">적정가 도달률:</span>
                        <span className="font-bold text-[#0f172a]">
                          {h.fair_value_hit_rate_pct != null ? `${h.fair_value_hit_rate_pct}%` : "-"}
                        </span>
                      </div>

                      {/* 시장 대비 승률 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b]">시장 초과 승률:</span>
                        <span className="font-bold text-emerald-600">
                          {h.win_rate_pct != null ? `${h.win_rate_pct}%` : "-"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-[#94a3b8] text-xs">
                      아직 {h.horizon_days}거래일이 경과한 리포트가 없어요.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 C: 최근 평가 리포트 목록 */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* 검색 바 */}
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="티커 검색 (예: AAPL, NVDA)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3.5 py-2 border border-[#e2e8f0] rounded-lg text-xs font-mono w-full max-w-xs focus:outline-hidden focus:border-[#0f172a]"
            />
            <span className="text-xs text-[#64748b] font-mono">
              총 {filteredRecentOutcomes.length}건 표시
            </span>
          </div>

          {filteredRecentOutcomes.length === 0 ? (
            <EmptyState
              icon="📄"
              title="평가된 리포트가 없습니다"
              description="검색어를 변경하거나 성과 추적 배치가 실행된 뒤 확인해 주세요."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-2xs">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">분석일</th>
                    <th className="py-3 px-4">종목</th>
                    <th className="py-3 px-4">관측 시계</th>
                    <th className="py-3 px-4">당시 판정</th>
                    <th className="py-3 px-4 text-right">당시 주가</th>
                    <th className="py-3 px-4 text-right">관측 주가</th>
                    <th className="py-3 px-4 text-right">종목 수익률</th>
                    <th className="py-3 px-4 text-right">SPY 초과수익</th>
                    <th className="py-3 px-4 text-center">적정가 도달</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredRecentOutcomes.map((r, i) => {
                    const isExcessPositive = (r.excess_return_pct ?? 0) >= 0;
                    return (
                      <tr
                        key={`${r.report_id}-${r.horizon_days}-${i}`}
                        onClick={() => onSelectReport?.(r.report_id, r.ticker, r.d)}
                        className="hover:bg-[#f8fafc] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-[#64748b]">
                          {r.d}
                        </td>
                        <td className="py-3 px-4 font-bold font-mono text-[#0f172a]">
                          ${r.ticker}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#64748b]">
                          {r.horizon_days}거래일
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              r.verdict.includes("매수") || r.verdict.toUpperCase().includes("BUY")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : r.verdict.includes("보유") || r.verdict.toUpperCase().includes("HOLD")
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {r.verdict}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#475569]">
                          ${r.price_then.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#0f172a] font-semibold">
                          {r.price_after != null ? `$${r.price_after.toFixed(2)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {r.return_pct != null ? (
                            <span
                              className={`font-semibold ${
                                r.return_pct >= 0 ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {r.return_pct > 0 ? "+" : ""}
                              {r.return_pct.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-[#94a3b8]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {r.excess_return_pct != null ? (
                            <span
                              className={`font-bold ${
                                isExcessPositive ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {r.excess_return_pct > 0 ? "+" : ""}
                              {r.excess_return_pct.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-[#94a3b8]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {r.hit_fair_value === true ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-mono text-[11px] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              달성
                            </span>
                          ) : r.hit_fair_value === false ? (
                            <span className="inline-flex items-center gap-1 text-[#94a3b8] font-mono text-[11px]">
                              <XCircle className="w-3.5 h-3.5" />
                              미달
                            </span>
                          ) : (
                            <span className="text-[#cbd5e1] font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 6. 수동 성과 추적 배치 모달 ── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Modal.Header
          title="성과 추적 배치를 실행할까요?"
          description="과거 발행된 리포트들의 21·63·126·252일 경과 주가와 S&P500 대비 초과수익률, 13인 거장 적중률을 재계산해요."
        />
        <Modal.Body>
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-[#0f172a] font-semibold">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>성과 평가 프로세스</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[#64748b]">
                <li>분석 기준일로부터 각 관측 시계가 지난 과거 리포트를 모두 조회해요.</li>
                <li>야후 파이낸스에서 경과 시점의 종가 및 SPY 종가를 수집해 수익률을 계산해요.</li>
                <li>당시 13인 거장들의 투자의견(매수/보유/매도)이 적중했는지 판정해요.</li>
              </ul>
            </div>

            {triggerFeedback && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-medium">
                {triggerFeedback}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setIsModalOpen(false)}
            disabled={isTriggering}
          >
            닫기
          </Button>
          <Button
            variant="primary"
            onClick={handleTriggerBatch}
            isLoading={isTriggering}
          >
            지금 실행하기
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
