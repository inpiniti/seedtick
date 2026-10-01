"""
GridTradingService: 고정 갭(3%) 실시간 무한 분할 매매 서비스
"""
import asyncio
import logging
from typing import Any
from app.config.settings import settings
from app.domains.auto_trading.grid_models import GridTradeItem
from app.domains.bridge.factory import get_broker_adapter
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerOrder
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("grid_trading_service")


class GridTradingService:
    def __init__(
        self,
        broker: IBrokerAdapter | None = None,
        repo: Any | None = None,
    ):
        self.broker = broker or get_broker_adapter(settings.DEFAULT_BROKER)
        self.repo = repo or supabase_repo
        self._ticker_locks: dict[str, asyncio.Lock] = {}
        self._ws_subscriber = None  # 토스 WebSocket 연동 시 바인딩

    def _get_lock(self, ticker: str) -> asyncio.Lock:
        sym = ticker.upper()
        if sym not in self._ticker_locks:
            self._ticker_locks[sym] = asyncio.Lock()
        return self._ticker_locks[sym]

    async def manual_buy_and_register(self, ticker: str) -> GridTradeItem:
        """
        0. 최초 수동 진입 (정규장 필수)
        - 미국 정규장 운영 여부 검사
        - 1,000원치 시장가 매수 발주
        - 체결가 기준 고정 갭(3%) 계산 및 DB 등록
        """
        sym = ticker.upper()
        async with self._get_lock(sym):
            # 1. 정규장 여부 검사
            is_open = await self.broker.is_us_market_open()
            if not is_open:
                raise ValueError(f"미국 정규장 운영 시간대에만 신규 수동 매수가 가능합니다. ({sym})")

            # 2. 1,000원치 매수 주문 발주
            order = BrokerOrder(
                ticker=sym,
                action="BUY",
                amount_krw=1000,
                memo=f"grid-first-{sym}",
            )
            res = await self.broker.place_order(order)
            if not res.success:
                raise RuntimeError(f"수동 매수 발주 실패 ({sym}): {res.error_message}")

            # 3. 체결가 또는 현재가 조회
            price = res.executed_price
            if not price:
                price = await self.broker.get_quote(sym)

            # 4. 고정 갭(3%) 및 초기 아이템 생성
            gap = round(price * 0.03, 4)
            holdings_qty = res.executed_qty or 0.0
            if holdings_qty <= 0:
                # 잔고에서 수량 확인 시도
                try:
                    bal = await self.broker.get_balance()
                    holdings_qty = bal.positions.get(sym, 0.0)
                except Exception:
                    holdings_qty = 0.0

            item = GridTradeItem(
                ticker=sym,
                initial_price=price,
                gap=gap,
                last_trade_price=price,
                order_amount_krw=1000,
                status="ACTIVE",
                holdings_qty=holdings_qty,
                total_buy_count=1,
                total_sell_count=0,
            )

            # 5. DB 저장
            self.repo.save_grid_trade(item)
            logger.info(
                f"[GridTrading] 🟢 신규 종목 수동 등록 완료: {sym} "
                f"(진입가: ${price:.4f}, 고정 갭: ${gap:.4f})"
            )

            # 6. WebSocket 실시간 구독 갱신 알림
            if self._ws_subscriber:
                try:
                    await self._ws_subscriber.subscribe_tickers([sym])
                except Exception as e:
                    logger.warning(f"[GridTrading] 실시간 구독 갱신 실패: {e}")

            return item

    async def on_realtime_tick(self, ticker: str, current_price: float) -> None:
        """
        실시간 체결가 수신 시 갭 판정 및 자동 매수/매도 주문 실행
        1. 현재가 >= 마지막매매가 + 갭: 1,000원치 매도
        2. 현재가 <= 마지막매매가 - 갭: 1,000원치 매수
        """
        sym = ticker.upper()
        lock = self._get_lock(sym)
        if lock.locked():
            # 이전 주문이 아직 처리 중이면 중복 발주 방지를 위해 틱 스킵
            return

        async with lock:
            # 1. 활성 종목 조회
            active_items = self.repo.get_active_grid_trades()
            target_item = next((it for it in active_items if it.ticker == sym), None)
            if not target_item or target_item.status != "ACTIVE":
                return

            last_price = target_item.last_trade_price
            gap = target_item.gap

            # ── 1. 매도 트리거 (현재가 >= 마지막매매가 + 갭) ───────────
            if current_price >= round(last_price + gap, 4):
                logger.info(
                    f"[GridTrading] 📈 {sym} 익절 갭 도달! 현재가 ${current_price:.4f} >= "
                    f"기준 ${last_price:.4f} + 갭 ${gap:.4f}"
                )

                # 현재 잔고 확인
                bal = await self.broker.get_balance()
                current_holdings = bal.positions.get(sym, target_item.holdings_qty)

                if current_holdings <= 0:
                    logger.info(f"[GridTrading] {sym} 보유 수량 없음 -> 즉시 종료(FINISHED) 처리")
                    target_item.status = "FINISHED"
                    self.repo.update_grid_trade(target_item)
                    return

                # 1,000원치 매도 발주
                order = BrokerOrder(
                    ticker=sym,
                    action="SELL",
                    amount_krw=1000,
                    memo=f"grid-sell-{sym}",
                )
                res = await self.broker.place_order(order)
                if res.success:
                    # 환율 및 매도 수량 계산 (체결 후 잔여 확인)
                    fx_rate = await self.broker.get_exchange_rate()
                    sell_qty = round(1000.0 / fx_rate / current_price, 4)
                    rem_qty = max(0.0, current_holdings - sell_qty)

                    target_item.total_sell_count += 1
                    target_item.holdings_qty = rem_qty

                    # 1-2. 매도하고 남은 수량이 없는 경우 종료
                    if rem_qty <= 0.0001:
                        target_item.status = "FINISHED"
                        logger.info(f"[GridTrading] {sym} 잔여 수량 전량 매도 완료 -> 감지 종료(FINISHED)")
                    else:
                        # 1-1. 남은 수량이 있는 경우 마지막 매매주가 수정
                        target_item.last_trade_price = current_price
                        logger.info(
                            f"[GridTrading] {sym} 분할 매도 완료 -> 마지막매매가 갱신: ${current_price:.4f} (잔여: {rem_qty:.4f})"
                        )

                    self.repo.update_grid_trade(target_item)
                else:
                    logger.error(f"[GridTrading] {sym} 매도 주문 실패: {res.error_message}")

            # ── 2. 매수 트리거 (현재가 <= 마지막매매가 - 갭) ───────────
            elif current_price <= round(last_price - gap, 4):
                logger.info(
                    f"[GridTrading] 📉 {sym} 하락 갭 도달! 현재가 ${current_price:.4f} <= "
                    f"기준 ${last_price:.4f} - 갭 ${gap:.4f}"
                )

                order = BrokerOrder(
                    ticker=sym,
                    action="BUY",
                    amount_krw=1000,
                    memo=f"grid-buy-{sym}",
                )
                res = await self.broker.place_order(order)
                if res.success:
                    fx_rate = await self.broker.get_exchange_rate()
                    buy_qty = round(1000.0 / fx_rate / current_price, 4)

                    target_item.total_buy_count += 1
                    target_item.holdings_qty += buy_qty
                    target_item.last_trade_price = current_price
                    logger.info(
                        f"[GridTrading] {sym} 분할 매수 완료 -> 마지막매매가 갱신: ${current_price:.4f} (보유: {target_item.holdings_qty:.4f})"
                    )
                    self.repo.update_grid_trade(target_item)
                else:
                    logger.error(f"[GridTrading] {sym} 매수 주문 실패: {res.error_message}")

    async def sync_with_holdings(self) -> None:
        """
        0-3. 계좌 잔고 동기화: 등록되어 있었는데 보유종목에서 사라진 경우 종료 처리
        """
        try:
            bal = await self.broker.get_balance()
            positions = bal.positions
            active_items = self.repo.get_active_grid_trades()

            for item in active_items:
                sym = item.ticker
                if positions.get(sym, 0.0) <= 0:
                    logger.info(f"[GridTrading] {sym}: 계좌 보유 종목에서 사라짐 -> 종료(FINISHED) 처리")
                    item.status = "FINISHED"
                    self.repo.update_grid_trade(item)
        except Exception as e:
            logger.warning(f"[GridTrading] 계좌 보유 동기화 실패: {e}")
