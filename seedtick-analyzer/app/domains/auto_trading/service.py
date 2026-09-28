"""
AutoTradingService: 13인 거장 리포트 기반 소액 자동매매 실행
"""
import logging
from datetime import date
from app.config.constants import DEFAULT_ORDER_AMOUNT_KRW, MAX_DAILY_INVESTMENT_KRW
from app.config.settings import settings
from app.domains.bridge.factory import get_broker_adapter
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerOrder, OrderResult
from app.domains.report.models import FinalMasterReport

logger = logging.getLogger("auto_trading_service")

# 매도 트리거 시그널 점수 (관망=2, 매도=3)
SELL_SIGNAL_SCORES = {2, 3}


class AutoTradingService:
    def __init__(
        self,
        broker: IBrokerAdapter | None = None,
        order_amount_krw: int = DEFAULT_ORDER_AMOUNT_KRW,
        max_daily_investment_krw: int = MAX_DAILY_INVESTMENT_KRW,
    ):
        self.broker = broker or get_broker_adapter(settings.DEFAULT_BROKER)
        self.order_amount_krw = order_amount_krw
        self.max_daily_investment_krw = max_daily_investment_krw
        self.today_ordered_tickers: set[str] = set()
        self.today_sold_tickers: set[str] = set()
        self.today_spent_krw: int = 0
        self.current_date: date = date.today()

    def _reset_daily_limits_if_needed(self):
        if date.today() != self.current_date:
            self.current_date = date.today()
            self.today_ordered_tickers.clear()
            self.today_sold_tickers.clear()
            self.today_spent_krw = 0

    async def execute_from_reports(
        self,
        reports: list[FinalMasterReport],
        dry_run: bool | None = None,
    ) -> list[OrderResult]:
        """
        리포트 목록을 기반으로 분할 매수 및 분할 매도 실행.

        - 매수(overall_score=0): 1만원씩 분할 매수 (일일 10만원 한도)
        - 관망(overall_score=2) / 매도(overall_score=3): 보유 종목에 한해 1만원씩 분할 매도 (한도 없음)
        - 보유(overall_score=1): 무시
        """
        self._reset_daily_limits_if_needed()
        is_dry_run = settings.DRY_RUN if dry_run is None else dry_run
        broker = get_broker_adapter("mock") if is_dry_run else self.broker

        results: list[OrderResult] = []

        # ── 1. 분할 매수 ─────────────────────────────────────
        buy_targets = [r for r in reports if r.overall_score == 0]
        logger.info(f"[AutoTrading] 매수 후보 종목 {len(buy_targets)}개 발견 (DryRun={is_dry_run})")

        for r in buy_targets:
            ticker = r.ticker

            if ticker in self.today_ordered_tickers:
                logger.info(f"[AutoTrading] {ticker}: 오늘 이미 주문 발주됨 (중복 방지 스킵)")
                continue

            order_krw = self.order_amount_krw
            if self.today_spent_krw + order_krw > self.max_daily_investment_krw:
                logger.warning(
                    f"[AutoTrading] 일일 한도 초과 ({self.today_spent_krw:,}원 + {order_krw:,}원 > {self.max_daily_investment_krw:,}원) - 발주 중단"
                )
                break

            order = BrokerOrder(
                ticker=ticker,
                action="BUY",
                amount_krw=order_krw,
                memo=f"seedtick-{self.current_date.isoformat()}",
            )
            res = await broker.place_order(order)
            results.append(res)

            if res.success:
                self.today_ordered_tickers.add(ticker)
                self.today_spent_krw += order_krw
                logger.info(
                    f"[AutoTrading] 매수 완료: {ticker} ({order_krw:,}원, 금일 누적 {self.today_spent_krw:,}원)"
                )
            else:
                logger.error(f"[AutoTrading] 매수 실패: {ticker} ({res.error_message})")

        # ── 2. 분할 매도 (관망/매도 시그널) ──────────────────
        sell_targets = [r for r in reports if r.overall_score in SELL_SIGNAL_SCORES]
        logger.info(f"[AutoTrading] 매도 후보 종목 {len(sell_targets)}개 발견 (DryRun={is_dry_run})")

        if sell_targets:
            # 잔고 조회 (보유 종목 확인용)
            try:
                balance = await broker.get_balance()
                positions = balance.positions
            except Exception as e:
                logger.error(f"[AutoTrading] 잔고 조회 실패 — 매도 전량 스킵: {e}")
                return results

            for r in sell_targets:
                ticker = r.ticker

                # 당일 중복 매도 방지
                if ticker in self.today_sold_tickers:
                    logger.info(f"[AutoTrading] {ticker}: 오늘 이미 매도 발주됨 (중복 방지 스킵)")
                    continue

                # 보유 수량 확인 — 없으면 스킵 (불변식: 미보유 종목 매도 금지)
                if positions.get(ticker, 0.0) <= 0:
                    logger.info(
                        f"[AutoTrading] {ticker}: 보유 없음 — 매도 스킵 "
                        f"(시그널={r.overall_verdict})"
                    )
                    continue

                order = BrokerOrder(
                    ticker=ticker,
                    action="SELL",
                    amount_krw=self.order_amount_krw,
                    memo=f"seedtick-sell-{self.current_date.isoformat()}",
                )
                res = await broker.place_order(order)
                results.append(res)

                if res.success:
                    self.today_sold_tickers.add(ticker)
                    logger.info(
                        f"[AutoTrading] 매도 완료: {ticker} "
                        f"(시그널={r.overall_verdict}, {self.order_amount_krw:,}원)"
                    )
                else:
                    logger.error(f"[AutoTrading] 매도 실패: {ticker} ({res.error_message})")

        return results
