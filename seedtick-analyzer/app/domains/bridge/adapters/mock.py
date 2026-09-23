"""
MockBrokerAdapter: 로컬 테스트 및 Dry-Run 모드용 가상 브로커
"""
import logging
import uuid
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerBalance, BrokerOrder, OrderResult

logger = logging.getLogger("mock_broker")


class MockBrokerAdapter(IBrokerAdapter):
    def __init__(self, initial_krw: int = 1_000_000, fx_rate: float = 1380.0):
        self.available_krw = initial_krw
        self.fx_rate = fx_rate
        self.positions: dict[str, float] = {}
        self.order_history: list[BrokerOrder] = []

    async def get_balance(self) -> BrokerBalance:
        return BrokerBalance(
            available_krw=self.available_krw,
            available_usd=round(self.available_krw / self.fx_rate, 2),
            positions=self.positions.copy(),
        )

    async def get_quote(self, ticker: str) -> float:
        # 가상 현재가 (기본 $150.0)
        return 150.0

    async def place_order(self, order: BrokerOrder) -> OrderResult:
        logger.info(f"[MockBroker] 주문 수신: {order.ticker} {order.action} {order.amount_krw:,}원")

        if order.action == "BUY":
            if self.available_krw < order.amount_krw:
                return OrderResult(
                    success=False,
                    ticker=order.ticker,
                    action=order.action,
                    amount_krw=order.amount_krw,
                    error_message=f"잔고 부족 (현재 잔고: {self.available_krw:,}원)",
                )

            quote = await self.get_quote(order.ticker)
            usd_amount = order.amount_krw / self.fx_rate
            qty = round(usd_amount / quote, 4)

            self.available_krw -= order.amount_krw
            self.positions[order.ticker] = self.positions.get(order.ticker, 0.0) + qty
            self.order_history.append(order)

            order_id = f"MOCK-{uuid.uuid4().hex[:8]}"
            logger.info(
                f"[MockBroker] 체결 성공: {order.ticker} {qty}주 (단가 ${quote:.2f}, 주문ID: {order_id})"
            )

            return OrderResult(
                success=True,
                order_id=order_id,
                ticker=order.ticker,
                action=order.action,
                amount_krw=order.amount_krw,
                executed_price=quote,
                executed_qty=qty,
            )

        elif order.action == "SELL":
            current_qty = self.positions.get(order.ticker, 0.0)
            if current_qty <= 0:
                return OrderResult(
                    success=False,
                    ticker=order.ticker,
                    action=order.action,
                    amount_krw=order.amount_krw,
                    error_message=f"보유 수량 부족 ({order.ticker})",
                )

            quote = await self.get_quote(order.ticker)
            krw_recovered = int(current_qty * quote * self.fx_rate)
            self.available_krw += krw_recovered
            del self.positions[order.ticker]

            order_id = f"MOCK-{uuid.uuid4().hex[:8]}"
            return OrderResult(
                success=True,
                order_id=order_id,
                ticker=order.ticker,
                action=order.action,
                amount_krw=krw_recovered,
                executed_price=quote,
                executed_qty=current_qty,
            )

        return OrderResult(
            success=False,
            ticker=order.ticker,
            action=order.action,
            amount_krw=order.amount_krw,
            error_message=f"지원하지 않는 주문 액션: {order.action}",
        )

    async def cancel_order(self, order_id: str) -> bool:
        logger.info(f"[MockBroker] 주문 취소: {order_id}")
        return True
