"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AiModelStatus,
  AutoTradingStatus,
  BridgeStatus,
  BrokerBalance,
  GuruReportRow,
  GuruVoteRow,
  HealthStatus,
  IpStatus,
  PendingOrder,
  StockCandidate,
  SystemLogItem,
} from "@/types/api";
import {
  fetchAiModelStatus,
  fetchAutoTradingStatus,
  fetchBridgeBalance,
  fetchBridgeStatus,
  fetchHealth,
  fetchIp,
  fetchPendingOrders,
  fetchScreener,
  resetAiModelRotation,
} from "@/lib/api-client";
import {
  fetchGuruReports,
  fetchGuruVotes,
  fetchSystemLogs,
} from "@/lib/supabase";
import { LiveStatusBar } from "@/components/header/LiveStatusBar";
import { TradingTab } from "@/components/tabs/TradingTab";
import { ScreenerTab } from "@/components/tabs/ScreenerTab";
import { LogsTab } from "@/components/tabs/LogsTab";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Activity, BarChart2, Terminal } from "lucide-react";

export default function AdminDashboardPage() {
  // 활성 탭 (1: 트레이딩, 2: 스크리너, 3: 로그)
  const [activeTab, setActiveTab] = useState<"trading" | "screener" | "logs">(
    "trading"
  );

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isScreenerLoading, setIsScreenerLoading] = useState(false);

  // 상태 데이터
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ipInfo, setIpInfo] = useState<IpStatus | null>(null);
  const [aiModel, setAiModel] = useState<AiModelStatus | null>(null);
  const [isResettingModel, setIsResettingModel] = useState(false);
  const [tradingStatus, setTradingStatus] = useState<AutoTradingStatus | null>(
    null
  );
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [balance, setBalance] = useState<BrokerBalance | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);

  // Supabase 데이터
  const [guruVotes, setGuruVotes] = useState<GuruVoteRow[]>([]);
  const [guruReports, setGuruReports] = useState<GuruReportRow[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([]);
  const [liveCandidates, setLiveCandidates] = useState<StockCandidate[]>([]);

  // 1. 전체 데이터 병렬 로드 (Vercel Best Practice: async-parallel)
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        healthRes,
        ipRes,
        tradingRes,
        pendingRes,
        balanceRes,
        bridgeRes,
        votesRes,
        reportsRes,
        logsRes,
        aiModelRes,
      ] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchIp().catch(() => null),
        fetchAutoTradingStatus().catch(() => null),
        fetchPendingOrders().catch(() => ({ pending_count: 0, orders: [] })),
        fetchBridgeBalance().catch(() => null),
        fetchBridgeStatus().catch(() => null),
        fetchGuruVotes(200).catch(() => []),
        fetchGuruReports(200).catch(() => []),
        fetchSystemLogs(60).catch(() => []),
        fetchAiModelStatus().catch(() => null),
      ]);

      if (healthRes) setHealth(healthRes);
      if (ipRes) setIpInfo(ipRes);
      if (tradingRes) setTradingStatus(tradingRes);
      if (pendingRes) setPendingOrders(pendingRes.orders || []);
      if (balanceRes) setBalance(balanceRes);
      if (bridgeRes) setBridgeStatus(bridgeRes);
      if (aiModelRes) setAiModel(aiModelRes);
      setGuruVotes(votesRes);
      setGuruReports(reportsRes);
      setSystemLogs(logsRes);
    } catch (err) {
      console.error("대시보드 데이터 로드 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. 실시간 스크리너 별도 조회
  const loadLiveScreener = useCallback(async () => {
    setIsScreenerLoading(true);
    try {
      const res = await fetchScreener("공통", "us", 50);
      setLiveCandidates(res.items || res.tickers || []);
    } catch (err) {
      console.warn("실시간 스크리너 조회 실패:", err);
    } finally {
      setIsScreenerLoading(false);
    }
  }, []);

  // 3. AI 모델 순위 1순위 수동 초기화
  const handleResetAiModel = async () => {
    setIsResettingModel(true);
    try {
      await resetAiModelRotation();
      const fresh = await fetchAiModelStatus().catch(() => null);
      if (fresh) setAiModel(fresh);
    } catch (err) {
      console.warn("AI 모델 순위 초기화 오류:", err);
    } finally {
      setIsResettingModel(false);
    }
  };

  // 4. 로그 필터 새로고침
  const handleRefreshLogs = async (level?: string) => {
    try {
      const logs = await fetchSystemLogs(60, level);
      setSystemLogs(logs);
    } catch (err) {
      console.warn("로그 새로고침 오류:", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 스크리너 탭 진입 시 실시간 데이터가 없으면 자동 페칭
  useEffect(() => {
    if (activeTab === "screener" && liveCandidates.length === 0 && !isScreenerLoading) {
      loadLiveScreener();
    }
  }, [activeTab, liveCandidates.length, isScreenerLoading, loadLiveScreener]);

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col font-sans">
      {/* 1. 상단 라이브 헤더 바 */}
      <LiveStatusBar
        health={health}
        ipInfo={ipInfo}
        aiModel={aiModel}
        isResettingModel={isResettingModel}
        onResetModel={handleResetAiModel}
        isLoading={isLoading}
        onRefresh={loadDashboardData}
      />

      {/* 2. 메인 컨테이너 (모바일 하단 내비게이션 바 공간 확보: pb-24 md:pb-8) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-8 py-4 sm:py-6 space-y-5 pb-24 md:pb-8">
        {/* [데스크톱 전용] 상단 세그먼트 탭 바 */}
        <div className="hidden md:flex items-center gap-2 p-1.5 bg-white rounded-3xl border border-[#f2f4f6] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-x-auto">
          <button
            onClick={() => setActiveTab("trading")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "trading"
                ? "bg-[#3182f6] text-white shadow-sm"
                : "text-[#6b7684] hover:text-[#191f28] hover:bg-[#f9fafb]"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>1. 트레이딩 & 주문 센터</span>
            {pendingOrders.length > 0 ? (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "trading"
                    ? "bg-white text-[#3182f6]"
                    : "bg-[#fff5e6] text-[#ff9500]"
                }`}
              >
                {pendingOrders.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab("screener")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "screener"
                ? "bg-[#3182f6] text-white shadow-sm"
                : "text-[#6b7684] hover:text-[#191f28] hover:bg-[#f9fafb]"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>2. 스크리너 & 13인 거장 리포트</span>
            {guruVotes.length > 0 ? (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "screener"
                    ? "bg-white text-[#3182f6]"
                    : "bg-[#f2f4f6] text-[#6b7684]"
                }`}
              >
                {guruVotes.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "logs"
                ? "bg-[#3182f6] text-white shadow-sm"
                : "text-[#6b7684] hover:text-[#191f28] hover:bg-[#f9fafb]"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>3. 시스템 & 에러 로그</span>
            {systemLogs.length > 0 ? (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "logs"
                    ? "bg-white text-[#3182f6]"
                    : "bg-[#f2f4f6] text-[#6b7684]"
                }`}
              >
                {systemLogs.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* 탭 콘텐츠 렌더링 (도허티 임계 스켈레톤 적용) */}
        {isLoading && !health ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {activeTab === "trading" ? (
              <TradingTab
                tradingStatus={tradingStatus}
                pendingOrders={pendingOrders}
                balance={balance}
                bridgeStatus={bridgeStatus}
                onRefresh={loadDashboardData}
              />
            ) : null}

            {activeTab === "screener" ? (
              <ScreenerTab
                guruVotes={guruVotes}
                guruReports={guruReports}
                liveCandidates={liveCandidates}
                isLoading={isScreenerLoading}
                onRefreshLive={loadLiveScreener}
              />
            ) : null}

            {activeTab === "logs" ? (
              <LogsTab
                logs={systemLogs}
                isLoading={isLoading}
                onRefresh={handleRefreshLogs}
              />
            ) : null}
          </>
        )}
      </main>

      {/* [모바일 전용] 하단 고정 토스 스타일 네비게이션 바 (Bottom Nav) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#f2f4f6] z-40 px-2 py-1.5 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => setActiveTab("trading")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === "trading"
                ? "text-[#3182f6] font-bold"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            <div className="relative">
              <Activity className="w-5 h-5" />
              {pendingOrders.length > 0 ? (
                <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-[#f04452] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingOrders.length}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] mt-1 tracking-tight">트레이딩</span>
          </button>

          <button
            onClick={() => setActiveTab("screener")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === "screener"
                ? "text-[#3182f6] font-bold"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">스크리너</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === "logs"
                ? "text-[#3182f6] font-bold"
                : "text-[#8b95a1] hover:text-[#4e5968]"
            }`}
          >
            <Terminal className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">로그</span>
          </button>
        </div>
      </nav>

      {/* 데스크톱 푸터 */}
      <footer className="hidden md:block mt-auto py-6 border-t border-[#f2f4f6] text-center text-xs text-[#8b95a1]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SeedTick Admin Console · Toss & KIS Bridge Automation</span>
          <span className="font-mono text-[11px]">
            API Gateway: seedtick-ai-gateway · Engine: seedtick-analyzer
          </span>
        </div>
      </footer>
    </div>
  );
}
