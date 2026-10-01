"use client";

import React, { useState, useEffect } from "react";
import {
  AutoTradingStatus,
  BridgeStatus,
  BrokerBalance,
  GridTradeItem,
  GridTradingMarketStatus,
  PendingOrder,
} from "@/types/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { formatKRW, formatUSD, formatTime } from "@/lib/utils";
import {
  closeGridItem,
  executePendingOrders,
  fetchGridItems,
  fetchGridMarketStatus,
  manualBuyGrid,
  triggerPipeline,
} from "@/lib/api-client";
import {
  Play,
  Send,
  Wallet,
  Clock,
  Sparkles,
  TrendingUp,
  Activity,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface TradingTabProps {
  tradingStatus: AutoTradingStatus | null;
  pendingOrders: PendingOrder[];
  balance: BrokerBalance | null;
  bridgeStatus: BridgeStatus | null;
  onRefresh: () => void;
}

export function TradingTab({
  tradingStatus,
  pendingOrders,
  balance,
  bridgeStatus,
  onRefresh,
}: TradingTabProps) {
  // 모달 상태
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // 그리드 트레이딩 상태
  const [gridItems, setGridItems] = useState<GridTradeItem[]>([]);
  const [gridMarketStatus, setGridMarketStatus] = useState<GridTradingMarketStatus | null>(null);
  const [buyTickerInput, setBuyTickerInput] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [buyFeedback, setBuyFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  // 파이프라인 옵션
  const [forceMarket, setForceMarket] = useState(false);
  const [skipAlreadyReported, setSkipAlreadyReported] = useState(true);

  // 대기 주문 즉시 발주 실행
  const handleExecuteOrders = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await executePendingOrders();
      setActionMessage(
        res.message ||
          `${res.executed_count}건의 주문을 증권사로 발주했어요.`
      );
      setTimeout(() => {
        setIsExecuteModalOpen(false);
        setActionMessage(null);
        onRefresh();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "발주 중 문제가 발생했어요.";
      setActionMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 12:00 파이프라인 수동 즉시 실행
  const handleTriggerPipeline = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await triggerPipeline({
        force: forceMarket,
        skipAlreadyReported: skipAlreadyReported,
      });
      const skippedMsg =
        typeof res?.skipped_already_reported_count === "number" &&
        res.skipped_already_reported_count > 0
          ? ` (오늘 이미 완료된 ${res.skipped_already_reported_count}개 종목 제외)`
          : "";
      setActionMessage(`일일 분석 파이프라인을 시작했어요.${skippedMsg}`);
      setTimeout(() => {
        setIsPipelineModalOpen(false);
        setActionMessage(null);
        onRefresh();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "파이프라인 실행 중 오류가 발생했어요.";
      setActionMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const spentKRW = tradingStatus?.today_spent_krw || 0;
  const maxKRW = tradingStatus?.max_daily_limit_krw || 100000;
  const spentPercent = Math.min(100, Math.round((spentKRW / maxKRW) * 100));

  return (
    <div className="space-y-5">
      {/* 1. 상단 요약 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* 일일 한도 소진율 */}
        <Card className="p-4 sm:p-6">
          <Card.Header className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8b95a1]">
                금일 투자 한도
              </span>
              <Badge variant={spentPercent >= 100 ? "danger" : "primary"}>
                소진율 {spentPercent}%
              </Badge>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#191f28] mt-1.5">
              {formatKRW(spentKRW)}
              <span className="text-xs sm:text-sm font-normal text-[#8b95a1] ml-1.5">
                / {formatKRW(maxKRW)}
              </span>
            </div>
          </Card.Header>
          <Card.Content>
            {/* 게이지 바 */}
            <div className="w-full h-2.5 bg-[#f2f4f6] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-[#3182f6] rounded-full transition-all duration-500"
                style={{ width: `${spentPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[#8b95a1] mt-2">
              종목당 {formatKRW(tradingStatus?.order_amount_per_ticker_krw || 10000)}씩 안전 분할 매수해요.
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
                `보유 포지션 ${balance?.positions?.length || 0}개 종목 운용 중`
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
              파이프라인 즉시 트리거
            </div>
          </Card.Header>
          <Card.Content>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPipelineModalOpen(true)}
              leftIcon={<Play className="w-3.5 h-3.5" />}
              className="w-full justify-center text-xs sm:text-sm"
            >
              12:00 파이프라인 지금 실행하기
            </Button>
          </Card.Content>
        </Card>
      </div>

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
              </Card.Description>
            </div>

            {/* 신규 종목 1,000원 수동 매수 등록 바 (정규장일 때만 활성화) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={buyTickerInput}
                onChange={(e) => setBuyTickerInput(e.target.value.toUpperCase())}
                placeholder="티커 (예: NVDA)"
                className="px-3 py-2 text-sm border border-[#e5e8eb] rounded-xl focus:outline-none focus:border-[#3182f6] font-semibold uppercase w-full sm:w-36"
                disabled={!gridMarketStatus?.is_market_open || isBuying}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleManualBuy}
                disabled={!gridMarketStatus?.is_market_open || isBuying || !buyTickerInput.trim()}
                isLoading={isBuying}
                leftIcon={<PlusCircle className="w-4 h-4" />}
                className="whitespace-nowrap font-bold"
              >
                1,000원 매수 및 등록
              </Button>
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
              description="정규장에 상단 입력창에서 종목을 입력하고 '1,000원 매수 및 등록'을 누르면 실시간 갭 매매가 시작돼요."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#f2f4f6] text-[#8b95a1] text-xs font-semibold">
                    <th className="pb-3 pl-2">종목</th>
                    <th className="pb-3">처음매수주가</th>
                    <th className="pb-3">고정 갭 (3%)</th>
                    <th className="pb-3">마지막매매주가</th>
                    <th className="pb-3">누적 체결</th>
                    <th className="pb-3">추적 수량</th>
                    <th className="pb-3">상태</th>
                    <th className="pb-3 pr-2 text-right">제어</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f9fafb]">
                  {gridItems.map((item) => (
                    <tr key={item.ticker} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="py-3 pl-2 font-bold text-[#191f28]">
                        {item.ticker}
                      </td>
                      <td className="py-3 text-[#191f28] font-medium">
                        ${item.initial_price.toFixed(2)}
                      </td>
                      <td className="py-3 text-[#3182f6] font-semibold">
                        ±${item.gap.toFixed(2)}
                      </td>
                      <td className="py-3 text-[#191f28] font-bold">
                        ${item.last_trade_price.toFixed(2)}
                      </td>
                      <td className="py-3 text-xs text-[#4e5968]">
                        <span className="text-[#3182f6] font-semibold">매수 {item.total_buy_count}회</span>
                        {" · "}
                        <span className="text-[#f04452] font-semibold">매도 {item.total_sell_count}회</span>
                      </td>
                      <td className="py-3 text-xs font-medium text-[#191f28]">
                        {item.holdings_qty.toFixed(4)}주
                      </td>
                      <td className="py-3">
                        <Badge variant={item.status === "ACTIVE" ? "success" : "neutral"}>
                          {item.status === "ACTIVE" ? "실시간 감지 중" : "종료됨"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-2 text-right">
                        {item.status === "ACTIVE" && (
                          <button
                            onClick={() => handleCloseGrid(item.ticker)}
                            className="text-xs text-[#8b95a1] hover:text-[#f04452] transition-colors font-medium"
                          >
                            감지 종료
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card.Content>
      </Card>


      {/* 2. 대기 중인 예약 주문 섹션 */}
      <Card className="p-4 sm:p-6">
        <Card.Header className="border-b border-[#f2f4f6] pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Card.Title>대기 중인 예약 주문 목록</Card.Title>
                <Badge variant={pendingOrders.length > 0 ? "warning" : "neutral"}>
                  {pendingOrders.length}건 대기
                </Badge>
              </div>
              <Card.Description>
                미국 정규장(22:30 KST) 개장 시 브로커로 자동 발주될 소수점 예약 매수 주문이에요.
              </Card.Description>
            </div>

            {pendingOrders.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsExecuteModalOpen(true)}
                leftIcon={<Send className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto"
              >
                예약 주문 즉시 발주하기
              </Button>
            )}
          </div>
        </Card.Header>

        <Card.Content className="pt-3">
          {pendingOrders.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8 text-[#8b95a1]" />}
              title="지금은 대기 중인 예약 주문이 없어요"
              description="매일 12:00 스크리너 분석이 완료되면 강력 매수 추천(0점) 종목이 이곳에 등록돼요."
            />
          ) : (
            <>
              {/* [모바일 전용] 예약 주문 카드 뷰 */}
              <div className="divide-y divide-[#f2f4f6] sm:hidden">
                {pendingOrders.map((order, idx) => (
                  <div key={`m-order-${order.ticker}-${idx}`} className="py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-[#191f28]">
                        {order.ticker}
                      </span>
                      <Badge variant={order.status === "FAILED" ? "danger" : "warning"}>
                        {order.status || "PENDING"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#4e5968]">
                      <span>주문 금액: <strong className="text-[#191f28]">{formatKRW(order.amount_krw)}</strong></span>
                      <span className="text-[#8b95a1]">{formatTime(order.created_at)}</span>
                    </div>
                    {order.status === "FAILED" && order.error_message ? (
                      <p className="text-[11px] text-[#f04452] font-medium">
                        실패: {order.error_message}
                      </p>
                    ) : order.reason ? (
                      <p className="text-[11px] text-[#8b95a1] truncate">
                        사유: {order.reason}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* [데스크톱 전용] 테이블 뷰 */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#f2f4f6] text-[#8b95a1] text-xs font-semibold">
                      <th className="pb-3 pl-2">티커</th>
                      <th className="pb-3">주문 금액</th>
                      <th className="pb-3">사유 / 실패 원인</th>
                      <th className="pb-3">상태</th>
                      <th className="pb-3 pr-2">등록 일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f9fafb]">
                    {pendingOrders.map((order, idx) => (
                      <tr key={`${order.ticker}-${idx}`} className="hover:bg-[#f9fafb] transition-colors">
                        <td className="py-3 pl-2 font-bold text-[#191f28]">
                          {order.ticker}
                        </td>
                        <td className="py-3 text-[#191f28] font-medium">
                          {formatKRW(order.amount_krw)}
                        </td>
                        <td className="py-3 text-xs max-w-[260px]">
                          {order.status === "FAILED" && order.error_message ? (
                            <span className="text-[#f04452] font-medium" title={order.error_message}>
                              {order.error_message}
                            </span>
                          ) : (
                            <span className="text-[#4e5968] truncate block" title={order.reason}>
                              {order.reason || "13인 거장 종합 매수 추천(g0==0)"}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge variant={order.status === "FAILED" ? "danger" : "warning"}>
                            {order.status || "PENDING"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 text-xs text-[#8b95a1]">
                          {formatTime(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      {/* 3. 오늘 체결된 주문 & 브릿지 보유 포지션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* 금일 매수 주문 완료 티커 */}
        <Card className="p-4 sm:p-6">
          <Card.Header>
            <Card.Title>금일 매수 실행 완료 종목</Card.Title>
            <Card.Description>
              오늘 이미 주문이 체결되었거나 나간 종목들이에요.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {tradingStatus?.today_ordered_tickers &&
            tradingStatus.today_ordered_tickers.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {tradingStatus.today_ordered_tickers.map((t) => (
                  <Badge key={t} variant="success" className="px-3 py-1.5 text-xs sm:text-sm">
                    ✓ {t}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#8b95a1]">
                오늘 아직 체결된 주문이 없어요.
              </div>
            )}
          </Card.Content>
        </Card>

        {/* 현재 보유 포지션 */}
        <Card className="p-4 sm:p-6">
          <Card.Header>
            <div className="flex items-center justify-between">
              <Card.Title>증권사 계좌 보유 자산</Card.Title>
              <TrendingUp className="w-4 h-4 text-[#03b26c]" />
            </div>
            <Card.Description>
              현재 연결된 계좌에 보유 중인 주식 내역이에요.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {balance?.positions && balance.positions.length > 0 ? (
              <div className="space-y-2">
                {balance.positions.map((pos) => (
                  <div
                    key={pos.ticker}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6]"
                  >
                    <div>
                      <span className="font-bold text-sm text-[#191f28]">
                        {pos.ticker}
                      </span>
                      {pos.name && (
                        <span className="text-xs text-[#8b95a1] ml-2">
                          {pos.name}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#191f28]">
                        {pos.quantity}주
                      </div>
                      {pos.return_rate !== undefined && (
                        <div
                          className={`text-xs font-medium ${
                            pos.return_rate >= 0
                              ? "text-[#f04452]"
                              : "text-[#03b26c]"
                          }`}
                        >
                          {pos.return_rate >= 0 ? "+" : ""}
                          {pos.return_rate.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#8b95a1]">
                보유 중인 주식이 없거나 모의투자 모드예요.
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* 모달 1: 예약 주문 즉시 발주 확인 모달 */}
      <Modal
        isOpen={isExecuteModalOpen}
        onClose={() => setIsExecuteModalOpen(false)}
      >
        <Modal.Header
          title="대기 중인 예약 주문을 지금 발주할까요?"
          description={`현재 ${pendingOrders.length}건의 예약 주문이 대기 중이에요. 브로커(${tradingStatus?.active_broker?.toUpperCase()})로 즉시 발주를 요청합니다.`}
        />
        <Modal.Body>
          {actionMessage ? (
            <div className="p-3 rounded-2xl bg-[#e8f3ff] text-[#3182f6] text-sm font-medium">
              {actionMessage}
            </div>
          ) : (
            <p className="text-xs text-[#8b95a1]">
              미국 정규장 운영 시간에 맞춰 증권사 시스템에 접수됩니다.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setIsExecuteModalOpen(false)}
            disabled={isActionLoading}
          >
            닫기
          </Button>
          <Button
            variant="primary"
            onClick={handleExecuteOrders}
            isLoading={isActionLoading}
          >
            주문 발주하기
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 모달 2: 일일 파이프라인 수동 즉시 실행 모달 */}
      <Modal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
      >
        <Modal.Header
          title="12:00 일일 분석 파이프라인을 실행할까요?"
          description="토스 거장 통합 스크리닝 통과 종목 전체에 대해 13인 심층 분석 보고서 생성 및 자동 주문 등록 전 과정을 즉시 실행합니다."
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
            isLoading={isActionLoading}
          >
            파이프라인 실행하기
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
