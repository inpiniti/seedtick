"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  IChartApi,
} from "lightweight-charts";
import { StockChartResponse } from "@/types/api";
import { fetchStockChart } from "@/lib/api-client";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";

interface StockChartViewProps {
  ticker: string;
  companyName?: string | null;
}

export function StockChartView({ ticker, companyName }: StockChartViewProps) {
  const [data, setData] = useState<StockChartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<"3mo" | "6mo" | "1y">("6mo");

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  // 1. 차트 데이터 로드
  useEffect(() => {
    let isCancelled = false;

    async function loadChart() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchStockChart(ticker, selectedRange);
        if (!isCancelled) {
          setData(res);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("차트 조회 오류:", err);
          setError("일봉 및 볼린저 밴드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (ticker) {
      loadChart();
    }

    return () => {
      isCancelled = true;
    };
  }, [ticker, selectedRange]);

  /** 차트 높이 */
  const getChartHeight = () => (typeof window !== "undefined" && window.innerWidth < 640 ? 300 : 380);

  // 2. Lightweight Charts 캔들 & 볼린저 라인 렌더링 (모노크롬 에디토리얼 테마)
  useEffect(() => {
    if (isLoading || !data || !chartContainerRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: getChartHeight(),
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#64748b",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      crosshair: {
        vertLine: { color: "#64748b", width: 1, style: LineStyle.Dotted },
        horzLine: { color: "#64748b", width: 1, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    // 2-1. 모노크롬 캔들스틱 (상승: 딥 블랙 솔리드 #0f172a, 하락: 라이트 슬레이트 아웃라인 #ffffff / #64748b)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#0f172a",
      downColor: "#ffffff",
      borderUpColor: "#0f172a",
      borderDownColor: "#64748b",
      wickUpColor: "#0f172a",
      wickDownColor: "#64748b",
    });

    const candleData = data.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // 2-2. 볼린저 밴드 상단 라인 (+2σ: 다크 슬레이트 대시)
    const upperSeries = chart.addSeries(LineSeries, {
      color: "#475569",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "BB 상단 (+2σ)",
      crosshairMarkerVisible: false,
    });
    const upperData = data.bollinger
      .filter((b) => b.upper != null)
      .map((b) => ({ time: b.time, value: b.upper as number }));
    upperSeries.setData(upperData);

    // 2-3. 볼린저 밴드 중심선 (20 SMA: 미드 슬레이트 실선)
    const middleSeries = chart.addSeries(LineSeries, {
      color: "#94a3b8",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      title: "BB 중심 (20 SMA)",
      crosshairMarkerVisible: false,
    });
    const middleData = data.bollinger
      .filter((b) => b.middle != null)
      .map((b) => ({ time: b.time, value: b.middle as number }));
    middleSeries.setData(middleData);

    // 2-4. 볼린저 밴드 하단 라인 (-2σ: 다크 슬레이트 대시)
    const lowerSeries = chart.addSeries(LineSeries, {
      color: "#475569",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "BB 하단 (-2σ)",
      crosshairMarkerVisible: false,
    });
    const lowerData = data.bollinger
      .filter((b) => b.lower != null)
      .map((b) => ({ time: b.time, value: b.lower as number }));
    lowerSeries.setData(lowerData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({
          width: container.clientWidth,
          height: getChartHeight(),
        });
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      resizeObserver?.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [data, isLoading]);

  // 상태 배지 매핑 (모노크롬 정제)
  const getStatusBadge = (status?: string): { variant: BadgeVariant; text: string } => {
    switch (status) {
      case "UPPER_BREAK":
        return { variant: "primary", text: "상단 밴드 돌파 (과열)" };
      case "UPPER_NEAR":
        return { variant: "neutral", text: "상단 저항선 근접" };
      case "MIDDLE":
        return { variant: "neutral", text: "중심선 영역 (안정)" };
      case "LOWER_NEAR":
        return { variant: "primary", text: "하단 지지선 근접 (저점)" };
      case "LOWER_BREAK":
        return { variant: "primary", text: "하단 이탈 (극단적 과매도)" };
      default:
        return { variant: "neutral", text: "분석 중" };
    }
  };

  const summary = data?.summary;
  const badgeInfo = getStatusBadge(summary?.status);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. 상단 컨트롤 및 종목 정보 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-[#0f172a] shrink-0">
              ${ticker}
            </span>
            {companyName && (
              <span className="text-xs text-[#64748b] font-medium truncate min-w-0 max-w-[140px] sm:max-w-none">
                {companyName}
              </span>
            )}
            <Badge variant={badgeInfo.variant} className="shrink-0 font-mono text-[10px]">
              {badgeInfo.text}
            </Badge>
          </div>
          <p className="text-xs text-[#64748b] mt-1 flex items-start gap-1.5 font-mono">
            <Info className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
            <span className="min-w-0">
              {summary?.status_description || "일봉 데이터와 20일 볼린저 밴드(±2σ)를 분석한 차트입니다."}
            </span>
          </p>
        </div>

        {/* 기간 선택 버튼 (3mo / 6mo / 1y) */}
        <div className="flex items-center gap-1 p-0.5 bg-white border border-[#cbd5e1] rounded font-mono text-xs self-stretch sm:self-auto justify-center sm:justify-start">
          {(["3mo", "6mo", "1y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`flex-1 sm:flex-none px-2.5 py-1 text-xs rounded transition-colors cursor-pointer whitespace-nowrap ${
                selectedRange === r
                  ? "bg-[#0f172a] text-white font-semibold"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              {r === "3mo" ? "3M" : r === "6mo" ? "6M" : "1Y"}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 핵심 수치 요약 매트릭스 카드 (모노크롬 정밀 지표) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
          <div className="p-3 bg-white rounded-md border border-[#e2e8f0] shadow-2xs">
            <div className="text-[11px] font-medium text-[#64748b]">현재 종가</div>
            <div className="text-base font-bold text-[#0f172a] mt-0.5">
              ${summary.current_price.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-md border border-[#e2e8f0] shadow-2xs">
            <div className="text-[11px] font-medium text-[#64748b] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#475569] rounded-xs inline-block" />
              BB 상단 (+2σ)
            </div>
            <div className="text-base font-bold text-[#0f172a] mt-0.5">
              ${summary.upper.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-md border border-[#e2e8f0] shadow-2xs">
            <div className="text-[11px] font-medium text-[#64748b] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#94a3b8] rounded-xs inline-block" />
              BB 중심 (20일)
            </div>
            <div className="text-base font-bold text-[#0f172a] mt-0.5">
              ${summary.middle.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-md border border-[#e2e8f0] shadow-2xs">
            <div className="text-[11px] font-medium text-[#64748b] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#475569] rounded-xs inline-block" />
              BB 하단 (-2σ)
            </div>
            <div className="text-base font-bold text-[#0f172a] mt-0.5">
              ${summary.lower.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-md border border-[#e2e8f0] shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-[#64748b]">밴드 위치 (%B)</div>
            <div className="text-base font-bold text-[#0f172a] mt-0.5">
              {(summary.percent_b * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* 3. 차트 렌더링 영역 */}
      <div className="relative p-3.5 bg-white rounded-md border border-[#e2e8f0] shadow-2xs">
        {/* 모노크롬 범례 표시 */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pb-2 mb-2 border-b border-[#f1f5f9] text-[11px] font-mono text-[#64748b]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#0f172a] border border-[#0f172a] rounded-2xs inline-block" /> 양봉 (상승)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-white border border-[#64748b] rounded-2xs inline-block" /> 음봉 (하락)
            </span>
            <span className="flex items-center gap-1 text-[#475569]">
              <span className="w-3 border-b-2 border-dashed border-[#475569] inline-block" /> 상단 (+2σ)
            </span>
            <span className="flex items-center gap-1 text-[#94a3b8]">
              <span className="w-3 border-b-2 border-[#94a3b8] inline-block" /> 중심 (SMA)
            </span>
            <span className="flex items-center gap-1 text-[#475569]">
              <span className="w-3 border-b-2 border-dashed border-[#475569] inline-block" /> 하단 (-2σ)
            </span>
          </div>
          <span className="hidden sm:inline text-[#94a3b8]">휠 스크롤: 줌 인/아웃</span>
        </div>

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="h-[300px] sm:h-[380px] flex flex-col justify-center items-center gap-3">
            <RefreshCw className="w-5 h-5 text-[#0f172a] animate-spin" />
            <p className="text-xs font-mono text-[#64748b]">일봉 캔들과 볼린저 밴드를 계산하고 있습니다...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {!isLoading && error && (
          <div className="h-[300px] sm:h-[380px] flex flex-col justify-center items-center gap-3 text-center p-6">
            <AlertTriangle className="w-7 h-7 text-[#0f172a]" />
            <p className="text-xs font-mono font-semibold text-[#0f172a]">{error}</p>
            <button
              onClick={() => setSelectedRange(selectedRange)}
              className="mt-2 px-3 py-1.5 text-xs font-mono font-semibold bg-[#0f172a] text-white rounded cursor-pointer"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 실제 차트 DOM 컨테이너 */}
        <div
          ref={chartContainerRef}
          className={`w-full ${isLoading || error ? "hidden" : "block"}`}
        />
      </div>
    </div>
  );
}
