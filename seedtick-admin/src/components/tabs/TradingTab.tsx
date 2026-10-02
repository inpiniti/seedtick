"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AutoTradingStatus,
  BridgeStatus,
  BrokerBalance,
  BrokerPosition,
  GridTradeItem,
  GridTradingMarketStatus,
  PipelineProgress,
} from "@/types/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { formatKRW, formatUSD, formatTime } from "@/lib/utils";
import { useRealtimePrices } from "@/hooks/useRealtimePrices";
import { PipelineProgressCard } from "@/components/tabs/PipelineProgressCard";
import {
  closeGridItem,
  reactivateGridItem,
  fetchGridItems,
  fetchGridMarketStatus,
  manualBuyGrid,
  syncGridHoldings,
  triggerPipeline,
} from "@/lib/api-client";
import {
  Play,
  Wallet,
  Sparkles,
  TrendingUp,
  Activity,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCw,
  Layers,
} from "lucide-react";

interface TradingTabProps {
  tradingStatus: AutoTradingStatus | null;
  balance: BrokerBalance | null;
  bridgeStatus: BridgeStatus | null;
  pipelineProgress: PipelineProgress | null;
  onRefresh: () => void;
  onRefreshPipeline: () => Promise<PipelineProgress | null>;
}

/**
 * 실시간 체결가를 표시하는 현재가 셀.
 * 가격이 바뀔 때 상승/하락 방향에 따라 배경색을 짧게 플래시한다.
 */
function RealtimePriceCell({ price, prevPrice }: { price?: number; prevPrice: number | null }) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const lastPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!price || price <= 0) return;
    const prev = lastPriceRef.current;
    lastPriceRef.current = price;

    if (prev === null || prev === price) return;

    setFlash(price > prev ? "up" : "down");
    const timer = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(timer);
  }, [price]);

  if (!price || price <= 0) {
    return <span className="text-[#8b95a1]">-</span>;
  }

  return (
    <span
      className={`inline-block px-1 -mx-1 tabular-nums ${
        flash === "up" ? "price-flash-up" : flash === "down" ? "price-flash-down" : ""
      }`}
      title={prevPrice ? `이전 체결가 $${prevPrice.toFixed(2)}` : undefined}
    >
      ${price.toFixed(2)}
    </span>
  );
}

export function TradingTab({
  tradingStatus,
  balance,
  bridgeStatus,
  pipelineProgress,
  onRefresh,
  onRefreshPipeline,
}: TradingTabProps) {
  // 모달 상태 (파이프라인 실행)
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [forceMarket, setForceMarket] = useState(false);
  const [skipAlreadyReported, setSkipAlreadyReported] = useState(true);

  // 그리드 트레이딩 상태
  const [gridItems, setGridItems] = useState<GridTradeItem[]>([]);
  const [gridMarketStatus, setGridMarketStatus] = useState<GridTradingMarketStatus | null>(null);
  const [buyTickerInput, setBuyTickerInput] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [buyFeedback, setBuyFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 실시간 체결가 SSE 구독 (현재가 실시간 표시)
  const { prices: livePrices, isConnected: isPriceStreamConnected } = useRealtimePrices(true);

  // 13인 거장 파이프라인 실행 여부 (상위 page.tsx에서 전역 폴링)
  const isPipelineRunning = pipelineProgress?.status === "running";

  // 증권사 보유 포지션 안전 파싱 (배열 또는 딕셔너리 모두 대응)
  // 실시간 체결가가 수신된 종목은 현재가를 SSE 값으로 덮어쓰고 수익률을 재계산한다.
  const positionsList: BrokerPosition[] = useMemo(() => {
    let list: BrokerPosition[] = [];
    if (Array.isArray(balance?.positions)) {
      list = balance.positions;
    } else if (balance?.positions && typeof balance.positions === "object") {
      list = Object.entries(balance.positions).map(([k, v]) => ({
        ticker: k,
        name: k,
        quantity: typeof v === "number" ? v : Number(v) || 0,
        purchase_price: 0,
        current_price: 0,
        return_rate: 0,
      }));
    } else {
      return [];
    }

    const hasLive = Object.keys(livePrices).length > 0;
    if (!hasLive) return list;

    return list.map((pos) => {
      const sym = pos.ticker?.toUpperCase();
      const live = sym ? livePrices[sym] : undefined;
      if (!live || live.price <= 0) return pos;

      const purchasePrice = pos.purchase_price ?? 0;
      const returnRate =
        purchasePrice > 0 ? ((live.price - purchasePrice) / purchasePrice) * 100 : pos.return_rate ?? 0;

      return {
        ...pos,
        current_price: live.price,
        return_rate: returnRate,
      };
    });
  }, [balance?.positions, livePrices]);

  // 그리드 데이터 로드
  const loadGridData = async () => {
    try {
      const [itemsRes, statusRes] = await Promise.all([
        fetchGridItems(),
        fetchGridMarketStatus(),
      ]);
      setGridItems(itemsRes.items || []);
      setGridMarketStatus(statusRes);
    } catch (e) {
      console.error("그리드 데이터 로드 실패:", e);
    }
  };

  useEffect(() => {
    loadGridData();
    const interval = setInterval(loadGridData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 토스 계좌 보유 종목 그리드 수동 동기화 핸들러
  const handleSyncHoldings = async () => {
    setIsSyncing(true);
    setBuyFeedback(null);
    try {
      const res = await syncGridHoldings();
      setBuyFeedback({ type: "success", message: res.message });
      await loadGridData();
      onRefresh();
      setTimeout(() => setBuyFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "보유 종목 동기화에 실패했어요.";
      setBuyFeedback({ type: "error", message: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // 1,000원 수동 매수 및 그리드 등록 핸들러
  const handleManualBuy = async () => {
    const sym = buyTickerInput.trim().toUpperCase();
    if (!sym) return;

    setIsBuying(true);
    setBuyFeedback(null);
    try {
      const res = await manualBuyGrid(sym);
      setBuyFeedback({ type: "success", message: res.message });
      setBuyTickerInput("");
      await loadGridData();
      onRefresh();
      setTimeout(() => setBuyFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "매수 발주에 실패했어요.";
      setBuyFeedback({ type: "error", message: msg });
    } finally {
      setIsBuying(false);
    }
  };

  // 그리드 감지 수동 종료 핸들러
  const handleCloseGrid = async (ticker: string) => {
    if (!confirm(`${ticker} 종목의 실시간 감지를 종료할까요?`)) return;
    try {
      await closeGridItem(ticker);
      await loadGridData();
    } catch (e) {
      alert("종료 처리에 실패했어요.");
    }
  };

  // 그리드 감지 재활성화 핸들러
  const [reactivatingTicker, setReactivatingTicker] = useState<string | null>(null);

  const handleReactivateGrid = async (ticker: string) => {
    setReactivatingTicker(ticker);
    setBuyFeedback(null);
    try {
      const res = await reactivateGridItem(ticker);
      setBuyFeedback({ type: "success", message: res.message });
      await loadGridData();
      setTimeout(() => setBuyFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "재활성화에 실패했어요.";
      setBuyFeedback({ type: "error", message: msg });
    } finally {
      setReactivatingTicker(null);
    }
  };

  // 12:00 파이프라인 수동 즉시 실행 (서버는 백그라운드 실행 + 즉시 응답)
  const handleTriggerPipeline = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await triggerPipeline({
        force: forceMarket,
        skipAlreadyReported: skipAlreadyReported,
      });
      if (res?.status === "skipped") {
        setActionMessage("이미 파이프라인이 실행 중이에요. 진행 상황을 확인해 주세요.");
      } else {
        setActionMessage(
          "파이프라인을 시작했어요. 진행 상황이 실시간으로 표시됩니다."
        );
      }
      await onRefreshPipeline();
      setTimeout(() => {
        setIsPipelineModalOpen(false);
        setActionMessage(null);
        onRefresh();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
      setActionMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const activeGridCount = gridItems.filter((i) => i.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      {/* 1. 상단 요약 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* 실시간 그리드 매매 상태 */}
        <Card className="p-4 sm:p-6">
          <Card.Header className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8b95a1]">
                고정 갭(3%) 그리드 트레이딩
              </span>
              <Badge variant={activeGridCount > 0 ? "success" : "neutral"}>
                {activeGridCount}개 종목 감지 중
              </Badge>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#191f28] mt-1.5 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#3182f6]" />
              <span>실시간 무한 분할 매매</span>
            </div>
          </Card.Header>
          <Card.Content>
            <p className="text-[12px] text-[#4e5968] mt-1 font-medium">
              1회 주문 단위: <strong>1,000원 고정</strong>
            </p>
            <p className="text-[11px] text-[#8b95a1] mt-0.5">
              갭 이상 상승 시 매도(잔고 0 시 종료) · 갭 이하 하락 시 매수
            </p>
          </Card.Content>
        </Card>

        {/* 증권사 잔고 */}
        <Card className="p-4 sm:p-6">
          <Card.Header className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8b95a1]">
                증권사 예수금 ({tradingStatus?.active_broker?.toUpperCase() || "TOSS"})
              </span>
              <Wallet className="w-4 h-4 text-[#3182f6]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#191f28] mt-1.5">
              {formatUSD(balance?.available_usd)}
              <span className="text-xs font-normal text-[#8b95a1] ml-2">
                (원화: {formatKRW(balance?.available_krw)})
              </span>
            </div>
          </Card.Header>
          <Card.Content>
            <p className="text-[11px] text-[#8b95a1]">
              {balance?.error ? (
                <span className="text-[#f04452]">잔고 조회 오류: {balance.error}</span>
              ) : (
                `보유 포지션 총 ${positionsList.length}개 종목 운용 중`
              )}
            </p>
          </Card.Content>
        </Card>

        {/* 빠른 실행 제어 콘솔 */}
        <Card className="p-4 sm:p-6">
          <Card.Header className="pb-2">
            <span className="text-xs font-semibold text-[#8b95a1]">
              수동 제어 센터
            </span>
            <div className="text-sm sm:text-base font-bold text-[#191f28] mt-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#3182f6]" />
              13인 거장 파이프라인
            </div>
          </Card.Header>
          <Card.Content>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPipelineModalOpen(true)}
              disabled={isPipelineRunning}
              leftIcon={
                isPipelineRunning ? (
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )
              }
              className="w-full justify-center text-xs sm:text-sm"
            >
              {isPipelineRunning
                ? "파이프라인 실행 중..."
                : "12:00 파이프라인 지금 실행하기"}
            </Button>
          </Card.Content>
        </Card>
      </div>

      {/* 1-1. 13인 거장 파이프라인 실시간 진행 상황 (실행 중이거나 최근 실행 결과가 있으면 표시) */}
      {pipelineProgress && pipelineProgress.status !== "idle" ? (
        <PipelineProgressCard progress={pipelineProgress} />
      ) : null}

      {/* 2. 실시간 고정 갭(3%) 무한 그리드 매매 섹션 */}
      <Card className="p-4 sm:p-6 border-2 border-[#3182f6]/20">
        <Card.Header className="border-b border-[#f2f4f6] pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Card.Title className="text-lg font-bold text-[#191f28] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#3182f6]" />
                  실시간 고정 갭(3%) 그리드 트레이딩
                </Card.Title>
                <Badge variant={gridMarketStatus?.is_market_open ? "success" : "neutral"}>
                  {gridMarketStatus?.is_market_open ? "● 정규장 운영 중" : "○ 정규장 마감"}
                </Badge>
                <Badge variant={gridMarketStatus?.is_ws_connected ? "primary" : "neutral"}>
                  {gridMarketStatus?.is_ws_connected ? "⚡ WebSocket 실시간 감지" : "WS 대기 중"}
                </Badge>
              </div>
              <Card.Description className="mt-1 text-xs text-[#6b7684]">
                처음 매수한 가격을 기준으로 <strong>3% 갭(Gap)</strong>이 영구 고정되며, 갭 이상 상승 시 1,000원치 매도(잔고 0 시 종료) · 갭 이하 하락 시 1,000원치 매수를 실시간으로 자동 실행해요.
                <br />
                현재가와 수익률(마지막매매주가 기준)은 토스 실시간 체결가로 갱신돼요.
              </Card.Description>
            </div>

            {/* 상단 액션 버튼 그룹 (보유 종목 동기화 & 1,000원 수동 매수 등록) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncHoldings}
                isLoading={isSyncing}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />}
                className="w-full sm:w-auto justify-center whitespace-nowrap font-medium text-xs sm:text-sm"
                title="토스 계좌에 보유 중인 종목을 조회하여 아직 등록되지 않은 종목을 그리드에 자동 등록합니다."
              >
                보유 종목 동기화
              </Button>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={buyTickerInput}
                  onChange={(e) => setBuyTickerInput(e.target.value.toUpperCase())}
                  placeholder="티커 (예: NVDA)"
                  className="px-3 py-2 text-sm border border-[#e5e8eb] rounded-xl focus:outline-none focus:border-[#3182f6] font-semibold uppercase w-full sm:w-32 min-w-0"
                  disabled={!gridMarketStatus?.is_market_open || isBuying}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleManualBuy}
                  disabled={!gridMarketStatus?.is_market_open || isBuying || !buyTickerInput.trim()}
                  isLoading={isBuying}
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                  className="w-full sm:w-auto justify-center whitespace-nowrap font-bold"
                >
                  1,000원 매수 및 등록
                </Button>
              </div>
            </div>
          </div>

          {!gridMarketStatus?.is_market_open && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#8b95a1] bg-[#f9fafb] p-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 text-[#8b95a1] shrink-0" />
              <span>
                현재 미국 정규장 시간이 아니에요. 신규 매수 등록 버튼은 <strong>정규장(22:30~05:00 KST)</strong>에만 활성화됩니다.
              </span>
            </div>
          )}

          {buyFeedback && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                buyFeedback.type === "success"
                  ? "bg-[#e8f8f0] text-[#03b26c]"
                  : "bg-[#fdeeed] text-[#f04452]"
              }`}
            >
              {buyFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{buyFeedback.message}</span>
            </div>
          )}
        </Card.Header>

        <Card.Content className="pt-4">
          {gridItems.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-8 h-8 text-[#8b95a1]" />}
              title="등록된 그리드 매매 종목이 없어요"
              description="상단의 '보유 종목 동기화'를 누르거나, 정규장에 '1,000원 매수 및 등록'을 실행하면 실시간 갭 매매가 시작돼요."
            />
          ) : (
            <>
              {/* [모바일 전용] 그리드 종목 카드 리스트 — 8컬럼 테이블은 좁은 화면에서 터진다 */}
              <div className="md:hidden space-y-2.5">
                {gridItems.map((item) => {
                  const sym = item.ticker?.toUpperCase();
                  const liveTick = sym ? livePrices[sym] : undefined;
                  const isLive = Boolean(liveTick && liveTick.price > 0);
                  const currentPrice =
                    isLive && liveTick ? liveTick.price : item.last_trade_price;
                  const basePrice = item.last_trade_price;
                  const gridReturn =
                    basePrice > 0 ? ((currentPrice - basePrice) / basePrice) * 100 : 0;
                  const isPositive = gridReturn > 0;
                  const isZero = gridReturn === 0;

                  return (
                    <div
                      key={`m-${item.ticker}`}
                      className="p-3.5 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6]"
                    >
                      {/* 1줄: 종목명 + 실시간 Dot + 상태 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[#191f28] text-sm">
                            {item.ticker}
                          </span>
                          {isLive && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#03b26c] live-dot shrink-0"
                              title="실시간 체결가 수신 중"
                            />
                          )}
                          {item.status === "ACTIVE" ? (
                            <Badge variant="success">감지 중</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivateGrid(item.ticker)}
                              disabled={reactivatingTicker === item.ticker}
                              title="그리드 감지 다시 활성화"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#f2f4f6] text-[#6b7684] active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <span>종료됨</span>
                              <RotateCw
                                className={`w-2.5 h-2.5 ${
                                  reactivatingTicker === item.ticker ? "animate-spin" : ""
                                }`}
                              />
                            </button>
                          )}
                        </div>
                        {item.status === "ACTIVE" && (
                          <button
                            onClick={() => handleCloseGrid(item.ticker)}
                            title="실시간 감지 종료"
                            className="shrink-0 text-[11px] text-[#8b95a1] active:text-[#f04452] transition-colors font-medium"
                          >
                            종료
                          </button>
                        )}
                      </div>

                      {/* 2줄: 현재가 + 수익률 */}
                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-[#8b95a1]">
                            현재가
                          </div>
                          <div className="text-lg font-bold text-[#191f28] leading-tight">
                            <RealtimePriceCell
                              price={currentPrice}
                              prevPrice={liveTick?.prevPrice ?? null}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-semibold text-[#8b95a1] mb-0.5">
                            수익률
                          </div>
                          <span
                            className={`text-sm font-bold px-2 py-0.5 rounded-lg inline-block ${
                              isZero
                                ? "bg-[#f2f4f6] text-[#6b7684]"
                                : isPositive
                                ? "bg-[#fdeeed] text-[#f04452]"
                                : "bg-[#e8f8f0] text-[#03b26c]"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {gridReturn.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* 3줄: 그리드 기준가 2열 그리드 */}
                      <div className="mt-2.5 pt-2.5 border-t border-[#e5e8eb] grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[#8b95a1] shrink-0">처음매수주가</span>
                          <span className="font-semibold text-[#191f28] tabular-nums whitespace-nowrap">
                            ${item.initial_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[#8b95a1] shrink-0">고정 갭</span>
                          <span className="font-semibold text-[#3182f6] tabular-nums whitespace-nowrap">
                            ±${item.gap.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[#8b95a1] shrink-0">마지막매매주가</span>
                          <span className="font-semibold text-[#191f28] tabular-nums whitespace-nowrap">
                            ${item.last_trade_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[#8b95a1] shrink-0">추적 수량</span>
                          <span className="font-semibold text-[#191f28] tabular-nums whitespace-nowrap">
                            {item.holdings_qty.toFixed(4)}주
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* [데스크톱 전용] 그리드 종목 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#f2f4f6] text-[#8b95a1] text-xs font-semibold">
                      <th className="pb-3 pl-2">종목</th>
                      <th className="pb-3">처음매수주가</th>
                      <th className="pb-3">고정 갭 (3%)</th>
                      <th className="pb-3">마지막매매주가</th>
                      <th className="pb-3">현재가</th>
                      <th className="pb-3">수익률</th>
                      <th className="pb-3">추적 수량</th>
                      <th className="pb-3 pr-2">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f9fafb]">
                    {gridItems.map((item) => {
                      const sym = item.ticker?.toUpperCase();
                      const liveTick = sym ? livePrices[sym] : undefined;
                      const isLive = Boolean(liveTick && liveTick.price > 0);
                      // 실시간 체결가 우선, 미수신 시 마지막매매가로 폴백
                      const currentPrice =
                        isLive && liveTick ? liveTick.price : item.last_trade_price;
                      // 마지막매매주가 대비 수익률 (다음 갭까지의 진행도)
                      const basePrice = item.last_trade_price;
                      const gridReturn =
                        basePrice > 0 ? ((currentPrice - basePrice) / basePrice) * 100 : 0;
                      const isPositive = gridReturn > 0;
                      const isZero = gridReturn === 0;

                      return (
                        <tr key={item.ticker} className="hover:bg-[#f9fafb] transition-colors">
                          <td className="py-3 pl-2">
                            <div className="font-bold text-[#191f28] flex items-center gap-1.5">
                              {item.ticker}
                              {isLive && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-[#03b26c] live-dot shrink-0"
                                  title="실시간 체결가 수신 중"
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-[#191f28] font-medium whitespace-nowrap">
                            ${item.initial_price.toFixed(2)}
                          </td>
                          <td className="py-3 text-[#3182f6] font-semibold whitespace-nowrap">
                            ±${item.gap.toFixed(2)}
                          </td>
                          <td className="py-3 text-[#191f28] font-bold whitespace-nowrap">
                            ${item.last_trade_price.toFixed(2)}
                          </td>
                          <td className="py-3 text-[#191f28] font-bold whitespace-nowrap">
                            <RealtimePriceCell
                              price={currentPrice}
                              prevPrice={liveTick?.prevPrice ?? null}
                            />
                          </td>
                          <td className="py-3">
                            <span
                              className={`text-sm font-bold px-2 py-0.5 rounded-lg inline-block whitespace-nowrap ${
                                isZero
                                  ? "bg-[#f2f4f6] text-[#6b7684]"
                                  : isPositive
                                  ? "bg-[#fdeeed] text-[#f04452]"
                                  : "bg-[#e8f8f0] text-[#03b26c]"
                              }`}
                              title="마지막매매주가 대비 수익률"
                            >
                              {isPositive ? "+" : ""}
                              {gridReturn.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 text-xs font-medium text-[#191f28] whitespace-nowrap">
                            {item.holdings_qty.toFixed(4)}주
                          </td>
                          <td className="py-3 pr-2">
                            {item.status === "ACTIVE" ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="success">실시간 감지 중</Badge>
                                <button
                                  onClick={() => handleCloseGrid(item.ticker)}
                                  title="실시간 감지 종료"
                                  className="text-xs text-[#8b95a1] hover:text-[#f04452] transition-colors font-medium"
                                >
                                  종료
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivateGrid(item.ticker)}
                                disabled={reactivatingTicker === item.ticker}
                                title="클릭하여 그리드 감지 다시 활성화"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#f2f4f6] text-[#6b7684] hover:bg-[#e8f3ff] hover:text-[#3182f6] hover:ring-1 hover:ring-[#3182f6]/30 active:scale-95 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span>종료됨</span>
                                <RotateCw
                                  className={`w-3 h-3 text-[#8b95a1] group-hover:text-[#3182f6] transition-transform ${
                                    reactivatingTicker === item.ticker
                                      ? "animate-spin text-[#3182f6]"
                                      : "group-hover:rotate-45"
                                  }`}
                                />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      {/* 3. 증권사 계좌 보유 자산 (전체 목록) */}
      <Card className="p-4 sm:p-6">
        <Card.Header className="border-b border-[#f2f4f6] pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Card.Title className="text-base font-bold text-[#191f28]">
                  증권사 계좌 보유 자산
                </Card.Title>
                <Badge variant={positionsList.length > 0 ? "primary" : "neutral"}>
                  {positionsList.length}개 종목
                </Badge>
                {/* 실시간 체결가 스트림 연결 상태 */}
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8b95a1]"
                  title={
                    isPriceStreamConnected
                      ? "토스 실시간 체결가 스트림에 연결됨"
                      : "실시간 스트림 미연결 (자동 재연결 시도 중)"
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isPriceStreamConnected ? "bg-[#03b26c] live-dot" : "bg-[#d1d5db]"
                    }`}
                  />
                  {isPriceStreamConnected ? "실시간" : "연결 대기"}
                </span>
              </div>
              <Card.Description className="text-xs text-[#8b95a1] mt-0.5">
                현재 연결된 증권사({tradingStatus?.active_broker?.toUpperCase() || "TOSS"}) 실계좌에 보유 중인 주식 내역이에요.
                {isPriceStreamConnected && " 보유 종목의 현재가는 실시간 체결가로 갱신돼요."}
              </Card.Description>
            </div>
            <TrendingUp className="w-5 h-5 text-[#3182f6]" />
          </div>
        </Card.Header>

        <Card.Content className="pt-4">
          {positionsList.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-8 h-8 text-[#8b95a1]" />}
              title="보유 중인 주식이 없어요"
              description="증권사 계좌에 보유 중인 주식이 없거나 잔고 동기화 중이에요."
            />
          ) : (
            <>
              {/* [모바일 전용] 보유 자산 카드 리스트 — 5컬럼 테이블은 좁은 화면에서 텍스트가 깨진다 */}
              <div className="md:hidden divide-y divide-[#f2f4f6]">
                {positionsList.map((pos) => {
                  const retRate = pos.return_rate ?? 0;
                  const isPositive = retRate > 0;
                  const isZero = retRate === 0;
                  const sym = pos.ticker?.toUpperCase();
                  const liveTick = sym ? livePrices[sym] : undefined;
                  const isLive = Boolean(liveTick && liveTick.price > 0);

                  return (
                    <div key={`m-${pos.ticker}`} className="py-3 first:pt-0 last:pb-0">
                      {/* 1줄: 티커 + 이름 / 현재가 + 수익률 */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#191f28]">{pos.ticker}</span>
                            {isLive && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-[#03b26c] live-dot shrink-0"
                                title="실시간 체결가 수신 중"
                              />
                            )}
                          </div>
                          {pos.name && pos.name !== pos.ticker && (
                            <div className="text-xs text-[#8b95a1] truncate max-w-[150px]">
                              {pos.name}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-[#191f28] text-[15px] leading-tight">
                            <RealtimePriceCell
                              price={pos.current_price}
                              prevPrice={liveTick?.prevPrice ?? null}
                            />
                          </div>
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 whitespace-nowrap ${
                              isZero
                                ? "bg-[#f2f4f6] text-[#6b7684]"
                                : isPositive
                                ? "bg-[#fdeeed] text-[#f04452]"
                                : "bg-[#e8f8f0] text-[#03b26c]"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {retRate.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* 2줄: 보유 수량 + 평균 매입가 */}
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#8b95a1]">
                        <span className="whitespace-nowrap">
                          보유{" "}
                          <strong className="text-[#4e5968] font-semibold tabular-nums">
                            {pos.quantity}주
                          </strong>
                        </span>
                        <span className="whitespace-nowrap">
                          평균매입{" "}
                          <strong className="text-[#4e5968] font-semibold tabular-nums">
                            {pos.purchase_price && pos.purchase_price > 0
                              ? `$${pos.purchase_price.toFixed(2)}`
                              : "-"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* [데스크톱 전용] 보유 자산 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#f2f4f6] text-[#8b95a1] text-xs font-semibold">
                      <th className="pb-3 pl-2">종목</th>
                      <th className="pb-3">보유 수량</th>
                      <th className="pb-3 whitespace-nowrap">평균 매입가</th>
                      <th className="pb-3">현재가</th>
                      <th className="pb-3 pr-2 text-right">수익률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f9fafb]">
                    {positionsList.map((pos) => {
                      const retRate = pos.return_rate ?? 0;
                      const isPositive = retRate > 0;
                      const isZero = retRate === 0;
                      const sym = pos.ticker?.toUpperCase();
                      const liveTick = sym ? livePrices[sym] : undefined;
                      const isLive = Boolean(liveTick && liveTick.price > 0);

                      return (
                        <tr key={pos.ticker} className="hover:bg-[#f9fafb] transition-colors">
                          <td className="py-3 pl-2">
                            <div className="font-bold text-[#191f28] flex items-center gap-1.5">
                              {pos.ticker}
                              {isLive && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-[#03b26c] live-dot shrink-0"
                                  title="실시간 체결가 수신 중"
                                />
                              )}
                            </div>
                            {pos.name && pos.name !== pos.ticker && (
                              <div className="text-xs text-[#8b95a1]">{pos.name}</div>
                            )}
                          </td>
                          <td className="py-3 font-semibold text-[#191f28] whitespace-nowrap tabular-nums">
                            {pos.quantity}주
                          </td>
                          <td className="py-3 text-[#4e5968] font-medium whitespace-nowrap tabular-nums">
                            {pos.purchase_price && pos.purchase_price > 0
                              ? `$${pos.purchase_price.toFixed(2)}`
                              : "-"}
                          </td>
                          <td className="py-3 text-[#191f28] font-bold whitespace-nowrap">
                            <RealtimePriceCell
                              price={pos.current_price}
                              prevPrice={liveTick?.prevPrice ?? null}
                            />
                          </td>
                          <td className="py-3 pr-2 text-right">
                            <span
                              className={`text-sm font-bold px-2 py-0.5 rounded-lg inline-block whitespace-nowrap ${
                                isZero
                                  ? "bg-[#f2f4f6] text-[#6b7684]"
                                  : isPositive
                                  ? "bg-[#fdeeed] text-[#f04452]"
                                  : "bg-[#e8f8f0] text-[#03b26c]"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {retRate.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      {/* 모달: 일일 파이프라인 수동 즉시 실행 모달 */}
      <Modal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
      >
        <Modal.Header
          title="12:00 일일 분석 파이프라인을 실행할까요?"
          description="토스 거장 통합 스크리닝 통과 종목 전체에 대해 13인 심층 분석 보고서를 생성합니다. (자동 매매 주문은 나가지 않습니다)"
        />
        <Modal.Body>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-[#191f28] cursor-pointer">
              <input
                type="checkbox"
                checked={skipAlreadyReported}
                onChange={(e) => setSkipAlreadyReported(e.target.checked)}
                className="w-4 h-4 rounded text-[#3182f6] focus:ring-0"
              />
              <span className="font-medium">
                오늘 이미 리포트 등록된 종목은 제외하고 작성{" "}
                <span className="text-[#3182f6] text-xs font-semibold">(추천)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#191f28] cursor-pointer">
              <input
                type="checkbox"
                checked={forceMarket}
                onChange={(e) => setForceMarket(e.target.checked)}
                className="w-4 h-4 rounded text-[#3182f6] focus:ring-0"
              />
              <span>휴장일/주말 가드를 건너뛰고 강제 실행</span>
            </label>
            {actionMessage && (
              <div className="p-3 rounded-2xl bg-[#e8f3ff] text-[#3182f6] text-sm font-medium">
                {actionMessage}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setIsPipelineModalOpen(false)}
            disabled={isActionLoading}
          >
            닫기
          </Button>
          <Button
            variant="primary"
            onClick={handleTriggerPipeline}
            disabled={isPipelineRunning}
            isLoading={isActionLoading}
          >
            {isPipelineRunning ? "이미 실행 중이에요" : "파이프라인 실행하기"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
