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
import {
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";

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
          setError("일봉 및 볼린저 밴드 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
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

  // 2. Lightweight Charts 캔들 & 볼린저 라인 렌더링
  useEffect(() => {
    if (isLoading || !data || !chartContainerRef.current) return;

    // 기존 인스턴스 정리
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7684",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: "#f2f4f6" },
        horzLines: { color: "#f2f4f6" },
      },
      crosshair: {
        vertLine: { color: "#3182f6", width: 1, style: LineStyle.Dotted },
        horzLine: { color: "#3182f6", width: 1, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: "#e5e8eb",
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: "#e5e8eb",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    // 2-1. 캔들스틱 시리즈 (토스 스타일: 상승 빨강 #f04452, 하락 파랑/초록 #3182f6 or #03b26c)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#f04452",
      downColor: "#3182f6",
      borderUpColor: "#f04452",
      borderDownColor: "#3182f6",
      wickUpColor: "#f04452",
      wickDownColor: "#3182f6",
    });

    const candleData = data.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // 2-2. 볼린저 밴드 상단 라인 (Upper: #f04452)
    const upperSeries = chart.addSeries(LineSeries, {
      color: "#f04452",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "BB 상단 (+2σ)",
      crosshairMarkerVisible: false,
    });
    const upperData = data.bollinger
      .filter((b) => b.upper != null)
      .map((b) => ({ time: b.time, value: b.upper as number }));
    upperSeries.setData(upperData);

    // 2-3. 볼린저 밴드 중심선 (Middle 20 SMA: #8b95a1)
    const middleSeries = chart.addSeries(LineSeries, {
      color: "#8b95a1",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      title: "BB 중심 (20 SMA)",
      crosshairMarkerVisible: false,
    });
    const middleData = data.bollinger
      .filter((b) => b.middle != null)
      .map((b) => ({ time: b.time, value: b.middle as number }));
    middleSeries.setData(middleData);

    // 2-4. 볼린저 밴드 하단 라인 (Lower: #03b26c)
    const lowerSeries = chart.addSeries(LineSeries, {
      color: "#03b26c",
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

    // 반응형 리사이즈 대응
    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [data, isLoading]);

  // 상태 배지 매핑
  const getStatusBadge = (status?: string): { variant: BadgeVariant; text: string } => {
    switch (status) {
      case "UPPER_BREAK":
        return { variant: "danger", text: "⚡ 상단 밴드 돌파 (과열)" };
      case "UPPER_NEAR":
        return { variant: "danger", text: "🔴 상단 저항선 근접" };
      case "MIDDLE":
        return { variant: "primary", text: "🔵 중심선 영역 (안정)" };
      case "LOWER_NEAR":
        return { variant: "success", text: "🟢 하단 지지선 근접 (저점)" };
      case "LOWER_BREAK":
        return { variant: "warning", text: "⚠️ 하단 이탈 (극단적 과매도)" };
      default:
        return { variant: "neutral", text: "분석 중" };
    }
  };

  const summary = data?.summary;
  const badgeInfo = getStatusBadge(summary?.status);

  return (
    <div className="space-y-4">
      {/* 1. 상단 컨트롤 및 종목 정보 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#191f28]">{ticker}</span>
            {companyName && (
              <span className="text-xs text-[#8b95a1] font-medium">{companyName}</span>
            )}
            <Badge variant={badgeInfo.variant}>{badgeInfo.text}</Badge>
          </div>
          <p className="text-xs text-[#4e5968] mt-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#3182f6] shrink-0" />
            {summary?.status_description || "일봉 데이터와 20일 볼린저 밴드(±2σ)를 분석하고 있어요."}
          </p>
        </div>

        {/* 기간 선택 버튼 (3mo / 6mo / 1y) */}
        <div className="flex items-center gap-1 p-1 bg-white border border-[#e5e8eb] rounded-xl self-start sm:self-center">
          {(["3mo", "6mo", "1y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedRange === r
                  ? "bg-[#3182f6] text-white"
                  : "text-[#8b95a1] hover:text-[#191f28]"
              }`}
            >
              {r === "3mo" ? "3개월" : r === "6mo" ? "6개월" : "1년"}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 핵심 수치 요약 매트릭스 카드 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 bg-white rounded-2xl border border-[#e5e8eb] shadow-2xs">
            <div className="text-[11px] font-medium text-[#8b95a1]">현재 종가</div>
            <div className="text-base font-bold text-[#191f28] mt-0.5">
              ${summary.current_price.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-[#e5e8eb] shadow-2xs">
            <div className="text-[11px] font-medium text-[#f04452] flex items-center gap-1">
              <span className="w-2 h-0.5 bg-[#f04452] rounded-full inline-block" />
              BB 상단 (+2σ)
            </div>
            <div className="text-base font-bold text-[#f04452] mt-0.5">
              ${summary.upper.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-[#e5e8eb] shadow-2xs">
            <div className="text-[11px] font-medium text-[#8b95a1] flex items-center gap-1">
              <span className="w-2 h-0.5 bg-[#8b95a1] rounded-full inline-block" />
              BB 중심 (20일)
            </div>
            <div className="text-base font-bold text-[#191f28] mt-0.5">
              ${summary.middle.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-[#e5e8eb] shadow-2xs">
            <div className="text-[11px] font-medium text-[#03b26c] flex items-center gap-1">
              <span className="w-2 h-0.5 bg-[#03b26c] rounded-full inline-block" />
              BB 하단 (-2σ)
            </div>
            <div className="text-base font-bold text-[#03b26c] mt-0.5">
              ${summary.lower.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-[#e5e8eb] shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-[#8b95a1]">밴드 위치 (%B)</div>
            <div className="text-base font-bold text-[#3182f6] mt-0.5">
              {(summary.percent_b * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* 3. 차트 렌더링 영역 */}
      <div className="relative p-3.5 bg-white rounded-3xl border border-[#e5e8eb] shadow-2xs">
        {/* 범례 표시 */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f2f4f6] text-[11px] text-[#8b95a1]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#f04452] rounded-xs inline-block" /> 양봉
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#3182f6] rounded-xs inline-block" /> 음봉
            </span>
            <span className="flex items-center gap-1 text-[#f04452]">
              <span className="w-3 border-b-2 border-dashed border-[#f04452] inline-block" /> 상단
            </span>
            <span className="flex items-center gap-1 text-[#8b95a1]">
              <span className="w-3 border-b-2 border-[#8b95a1] inline-block" /> 중심
            </span>
            <span className="flex items-center gap-1 text-[#03b26c]">
              <span className="w-3 border-b-2 border-dashed border-[#03b26c] inline-block" /> 하단
            </span>
          </div>
          <span className="hidden sm:inline text-[#8b95a1]">마우스 휠로 확대/축소 가능</span>
        </div>

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="h-[380px] flex flex-col justify-center items-center gap-3">
            <RefreshCw className="w-6 h-6 text-[#3182f6] animate-spin" />
            <p className="text-xs text-[#8b95a1]">일봉 캔들과 볼린저 밴드를 계산하고 있어요...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {!isLoading && error && (
          <div className="h-[380px] flex flex-col justify-center items-center gap-3 text-center p-6">
            <AlertTriangle className="w-8 h-8 text-[#ff9500]" />
            <p className="text-sm font-semibold text-[#191f28]">{error}</p>
            <button
              onClick={() => setSelectedRange(selectedRange)}
              className="mt-2 px-3.5 py-1.5 text-xs font-semibold bg-[#3182f6] text-white rounded-xl cursor-pointer"
            >
              다시 시도하기
            </button>
          </div>
        )}

        {/* 실제 차트가 마운트될 DOM 컨테이너 */}
        <div
          ref={chartContainerRef}
          className={`w-full ${isLoading || error ? "hidden" : "block"}`}
        />
      </div>
    </div>
  );
}
