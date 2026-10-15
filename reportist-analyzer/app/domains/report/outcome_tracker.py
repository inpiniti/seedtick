"""
투자 보고서 및 13인 거장 페르소나의 성과(Outcome) 추적 및 적중률 평가 워커

과거 생성된 guru_reports(분석일 기준 21, 63, 126, 252 거래일 경과분)에 대해:
1. 실제 주가 변동 및 SPY(S&P 500) 대비 초과 수익률 계산
2. 기간 내 적정 내재가치 도달(Hit) 여부 판정
3. 거장 페르소나별 투자의견 적중 여부(is_correct) 판정 및 신뢰도 분석 데이터 적재
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd
import yfinance as yf

from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("outcome_tracker")

STANDARD_HORIZONS = [21, 63, 126, 252]  # 1M, 3M, 6M, 1Y (거래일 기준)
BENCHMARK_TICKER = "SPY"


def _get_history(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """yfinance를 통해 주가 시계열(종가, 고가, 저가) 조회."""
    try:
        t = yf.Ticker(ticker)
        df = t.history(start=start_date, end=end_date, auto_adjust=True)
        if df.empty:
            return pd.DataFrame()
        return df
    except Exception as e:
        logger.warning(f"[{ticker}] 주가 이력 조회 실패: {e}")
        return pd.DataFrame()


def evaluate_report_outcomes(
    report: dict[str, Any],
    stock_df: pd.DataFrame,
    spy_df: pd.DataFrame,
    opinions: list[dict[str, Any]],
    horizons: list[int] = STANDARD_HORIZONS,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    단일 리포트 및 해당 리포트의 거장 의견들에 대해 경과 기간별 성과 계산.
    
    Returns:
        (report_outcome_rows, opinion_outcome_rows)
    """
    report_id = report.get("id") or f"{report.get('d')}_{report.get('ticker')}"
    ticker = (report.get("ticker") or "").upper()
    d_str = str(report.get("d"))
    report_price = report.get("current_price") or report.get("price_then")
    fair_value = report.get("fair_value")
    overall_verdict = report.get("verdict") or "관망"

    if stock_df.empty or spy_df.empty:
        return [], []

    # 거래일 기준 정렬
    stock_df = stock_df.sort_index()
    spy_df = spy_df.sort_index()

    # 분석일(d_str) 이후의 거래일 필터링
    report_date = pd.to_datetime(d_str).tz_localize(stock_df.index.tz)
    sub_stock = stock_df[stock_df.index >= report_date]
    sub_spy = spy_df[spy_df.index >= report_date]

    if len(sub_stock) < 2 or len(sub_spy) < 2:
        return [], []

    # 분석일 기준 실제 시작가 (데이터팩 current_price 또는 첫 거래일 종가)
    p0 = float(report_price) if report_price else float(sub_stock.iloc[0]["Close"])
    spy0 = float(sub_spy.iloc[0]["Close"])

    rep_outcomes: list[dict[str, Any]] = []
    op_outcomes: list[dict[str, Any]] = []

    for h in horizons:
        # h 거래일이 경과했는지 확인 (시작일 포함 h+1개 필요)
        if len(sub_stock) <= h or len(sub_spy) <= h:
            continue

        p_after = float(sub_stock.iloc[h]["Close"])
        spy_after = float(sub_spy.iloc[h]["Close"])

        ret_pct = round(((p_after / p0) - 1.0) * 100.0, 2)
        spy_ret_pct = round(((spy_after / spy0) - 1.0) * 100.0, 2)
        excess_ret_pct = round(ret_pct - spy_ret_pct, 2)

        # 관측 기간 내 적정가 도달(Hit) 여부
        hit_fair_value = None
        if fair_value is not None and isinstance(fair_value, (int, float)) and fair_value > 0:
            period_high = float(sub_stock.iloc[: h + 1]["High"].max())
            period_low = float(sub_stock.iloc[: h + 1]["Low"].min())
            if fair_value >= p0:
                hit_fair_value = bool(period_high >= fair_value)
            else:
                hit_fair_value = bool(period_low <= fair_value)

        rep_outcomes.append(
            {
                "report_id": report_id,
                "ticker": ticker,
                "d": d_str,
                "horizon_days": h,
                "verdict": overall_verdict,
                "price_then": round(p0, 2),
                "price_target": round(fair_value, 2) if fair_value is not None else None,
                "price_after": round(p_after, 2),
                "return_pct": ret_pct,
                "bench_return_pct": spy_ret_pct,
                "excess_return_pct": excess_ret_pct,
                "hit_fair_value": hit_fair_value,
            }
        )

        # 페르소나별 적중 여부 산출
        for op in opinions:
            op_id = op.get("id")
            if not op_id:
                continue

            op_verdict = op.get("verdict")
            is_correct = None
            if op_verdict == "매수":
                # 매수 의견: 절대수익률이 양수이거나 벤치마크 대비 초과수익 달성 시 적중
                is_correct = bool(ret_pct > 0 or excess_ret_pct > 0)
            elif op_verdict == "매도":
                # 매도 의견: 하락했거나 시장 대비 언더퍼폼 시 적중
                is_correct = bool(ret_pct < 0 or excess_ret_pct < 0)
            elif op_verdict == "보유":
                # 보유 의견: 급락하지 않고 안정적 흐름 (-7% ~ +20%)
                is_correct = bool(-7.0 <= ret_pct <= 25.0)

            op_outcomes.append(
                {
                    "opinion_id": op_id,
                    "report_id": report_id,
                    "ticker": ticker,
                    "persona": op.get("persona"),
                    "horizon_days": h,
                    "verdict": op_verdict,
                    "confidence": op.get("confidence"),
                    "price_then": round(p0, 2),
                    "price_after": round(p_after, 2),
                    "return_pct": ret_pct,
                    "is_correct": is_correct,
                }
            )

    return rep_outcomes, op_outcomes


def run_outcome_tracking(
    horizons: list[int] | None = None,
    tickers: list[str] | None = None,
    min_days_ago: int = 21,
    limit: int = 200,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    과거 리포트 성과 추적 워커 메인 루프.
    """
    target_horizons = horizons or STANDARD_HORIZONS
    cutoff_date = (date.today() - timedelta(days=min_days_ago)).isoformat()
    logger.info(f"성과 추적 워커 시작: {cutoff_date} 이전 리포트 대상 (시계: {target_horizons} 거래일)")

    reports = supabase_repo.get_reports_for_outcomes(max_date_str=cutoff_date, limit=limit)
    if tickers:
        filter_tickers = {t.upper().strip() for t in tickers}
        reports = [r for r in reports if (r.get("ticker") or "").upper() in filter_tickers]

    if not reports:
        logger.info("성과 추적 대상 리포트가 없습니다.")
        return {"reports_evaluated": 0, "outcomes_saved": 0}

    logger.info(f"성과 추적 대상 {len(reports)}건 리포트 확인.")

    # SPY 벤치마크 시계열 수집 (가장 오래된 리포트 일자 기준)
    oldest_date = min(str(r.get("d")) for r in reports)
    start_fetch = (pd.to_datetime(oldest_date) - timedelta(days=5)).strftime("%Y-%m-%d")
    end_fetch = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
    spy_df = _get_history(BENCHMARK_TICKER, start_fetch, end_fetch)

    total_report_rows: list[dict[str, Any]] = []
    total_opinion_rows: list[dict[str, Any]] = []

    for r in reports:
        ticker = (r.get("ticker") or "").upper()
        d_str = str(r.get("d"))
        report_id = r.get("id") or f"{d_str}_{ticker}"

        # 종목 주가 시계열 조회
        stock_df = _get_history(ticker, start_fetch, end_fetch)
        if stock_df.empty:
            continue

        opinions = supabase_repo.get_opinions_by_report_id(report_id)
        rep_rows, op_rows = evaluate_report_outcomes(
            r, stock_df, spy_df, opinions, horizons=target_horizons
        )
        total_report_rows.extend(rep_rows)
        total_opinion_rows.extend(op_rows)

    logger.info(
        f"성과 계산 완료: 리포트 성과 {len(total_report_rows)}행, 페르소나 성과 {len(total_opinion_rows)}행."
    )

    if not dry_run:
        if total_report_rows:
            supabase_repo.save_report_outcomes(total_report_rows)
        if total_opinion_rows:
            supabase_repo.save_opinion_outcomes(total_opinion_rows)
        logger.info("DB 저장 완료.")
    else:
        logger.info("[Dry Run] 저장을 건너뜁니다.")

    return {
        "reports_evaluated": len(reports),
        "report_outcomes": len(total_report_rows),
        "opinion_outcomes": len(total_opinion_rows),
    }


def main():
    parser = argparse.ArgumentParser(description="Reportist 거장 리포트 성과 추적 워커")
    parser.add_argument(
        "--horizons",
        type=int,
        nargs="+",
        default=STANDARD_HORIZONS,
        help="추적 관측 거래일 수 (기본: 21 63 126 252)",
    )
    parser.add_argument(
        "--tickers",
        type=str,
        nargs="+",
        default=None,
        help="특정 티커만 선별 추적",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help="최대 리포트 평가 수",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="DB 저장 없이 계산만 수행",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    run_outcome_tracking(
        horizons=args.horizons,
        tickers=args.tickers,
        limit=args.limit,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
