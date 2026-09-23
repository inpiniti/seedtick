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


class AutoTradingService:
    def __init__(self, broker: IBrokerAdapter | None = None):
        self.broker = broker or get_broker_adapter(settings.DEFAULT_BROKER)
        self.today_ordered_tickers: set[str] = set()
        self.today_spent_krw: int = 0
        self.current_date: date = date.today()

    def _reset_daily_limits_if_needed(self):
        if date.today() != self.current_date:
            self.current_date = date.today()
            self.today_ordered_tickers.clear()
            self.today_spent_krw = 0

    async def execute_from_reports(
        self,
        reports: list[FinalMasterReport],
        dry_run: bool | None = None,
    ) -> list[OrderResult]:
        """
        리포트 목록 중 종합 매수(overall_score == 0) 종목에 대해 소액 분할 발주
        """
        self._reset_daily_limits_if_needed()
        is_dry_run = settings.DRY_RUN if dry_run is None else dry_run

        results: list[OrderResult] = []

        # 매수 추천 종목 필터링 (g0 == 0)
        buy_targets = [r for r in reports if r.overall_score == 0]
        logger.info(f"[AutoTrading] 매수 후보 종목 {len(buy_targets)}개 발견 (DryRun={is_dry_run})")

        for r in buy_targets:
            ticker = r.ticker

            # 1. 일일 중복 주문 방지
            if ticker in self.today_ordered_tickers:
                logger.info(f"[AutoTrading] {ticker}: 오늘 이미 주문 발주됨 (중복 방지 스킵)")
                continue

            # 2. 일일 한도 검사 (최대 10만원)
            order_krw = DEFAULT_ORDER_AMOUNT_KRW
            if self.today_spent_krw + order_krw > MAX_DAILY_INVESTMENT_KRW:
                logger.warning(
                    f"[AutoTrading] 일일 한도 초과 ({self.today_spent_krw:,}원 + {order_krw:,}원 > {MAX_DAILY_INVESTMENT_KRW:,}원) - 발주 중단"
                )
                break

            order = BrokerOrder(
                ticker=ticker,
                action="BUY",
                amount_krw=order_krw,
                memo=f"seedtick-{self.current_date.isoformat()}",
            )

            # Dry-run인 경우 Mock 브로커 강제 적용
            broker = get_broker_adapter("mock") if is_dry_run else self.broker

            res = await broker.place_order(order)
            results.append(res)

            if res.success:
                self.today_ordered_tickers.add(ticker)
                self.today_spent_krw += order_krw
                logger.info(
                    f"[AutoTrading] 주문 완료: {ticker} ({order_krw:,}원, 금일 누적 {self.today_spent_krw:,}원)"
                )
            else:
                logger.error(f"[AutoTrading] 주문 실패: {ticker} ({res.error_message})")

        return results
