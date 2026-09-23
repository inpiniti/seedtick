"""
TossBrokerAdapter: 토스증권 Open API 기반 증권사 어댑터
참고: financial-desktop/docs/toss open api 정본 스펙 준수
"""
import asyncio
import logging
import time
import uuid
import httpx

from app.config.settings import settings
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerBalance, BrokerOrder, OrderResult

logger = logging.getLogger("toss_broker")

TOSS_API_BASE = "https://openapi.tossinvest.com"


class TossBrokerAdapter(IBrokerAdapter):
    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        account_seq: str | None = None,
    ):
        self.client_id = client_id or settings.TOSS_CLIENT_ID
        self.client_secret = client_secret or settings.TOSS_CLIENT_SECRET
        self.account_seq = account_seq or settings.TOSS_ACCOUNT_SEQ

        self._lock = asyncio.Lock()
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._last_request_time: float = 0.0

    async def _throttle(self) -> None:
        """토스 API 요청 최소 간격 (120ms) 준수"""
        elapsed = time.time() - self._last_request_time
        if elapsed < 0.12:
            await asyncio.sleep(0.12 - elapsed)
        self._last_request_time = time.time()

    async def _get_access_token(self, force: bool = False) -> str:
        """
        POST /oauth2/token
        주의: client당 유효 토큰은 1개(신규 발급 시 이전 토큰 즉시 무효).
        """
        async with self._lock:
            if not force and self._token and time.time() < (self._token_expires_at - 1800):
                return self._token

            if not self.client_id or not self.client_secret:
                raise ValueError("토스 API 자격 증명(TOSS_CLIENT_ID / TOSS_CLIENT_SECRET)이 설정되지 않았습니다.")

            url = f"{TOSS_API_BASE}/oauth2/token"
            data = {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}

            await self._throttle()
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, data=data, headers=headers)
                if res.status_code == 403:
                    raise PermissionError(
                        "토스 API 403 Forbidden: WTS 설정 > Open API > 허용 IP에 현재 IP를 등록해야 합니다."
                    )
                res.raise_for_status()
                token_data = res.json()

            self._token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 86400)
            self._token_expires_at = time.time() + expires_in
            logger.info(f"[TossBroker] 토큰 발급 성공 (expires_in={expires_in}s)")
            return self._token

    async def _request(
        self, method: str, path: str, json: dict | None = None, params: dict | None = None
    ) -> dict:
        """공통 요청 처리: 429 지수 백오프, 401 토큰 1회 재발급"""
        for attempt in range(1, 4):
            token = await self._get_access_token(force=(attempt > 1))
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            if self.account_seq:
                headers["X-Tossinvest-Account"] = str(self.account_seq)

            await self._throttle()
            url = f"{TOSS_API_BASE}{path}"
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.request(method, url, headers=headers, json=json, params=params)

                if res.status_code == 200:
                    return res.json().get("result") or res.json()

                if res.status_code == 429:
                    retry_after = float(res.headers.get("Retry-After", 2.0))
                    logger.warning(f"[TossBroker] 429 RateLimit — {retry_after}s 대기 후 재시도")
                    await asyncio.sleep(retry_after)
                    continue

                if res.status_code == 401 and attempt == 1:
                    logger.warning("[TossBroker] 401 Unauthorized — 토큰 재발급 후 1회 재시도")
                    continue

                raise RuntimeError(f"토스 API 호출 실패 ({res.status_code}): {res.text}")

        raise RuntimeError("토스 API 재시도 초과")

    async def get_balance(self) -> BrokerBalance:
        """계좌 잔고 조회"""
        try:
            data = await self._request("GET", "/api/v1/accounts/balance")
            krw = data.get("availableKrw", 0)
            usd = data.get("availableUsd", 0.0)
            positions = {}
            for h in data.get("holdings", []):
                sym = h.get("symbol") or h.get("ticker")
                qty = float(h.get("quantity", 0))
                if sym and qty > 0:
                    positions[sym] = qty
            return BrokerBalance(available_krw=krw, available_usd=usd, positions=positions)
        except Exception as e:
            logger.error(f"[TossBroker] 잔고 조회 실패: {e}")
            return BrokerBalance(available_krw=0, available_usd=0.0)

    async def get_quote(self, ticker: str) -> float:
        """현재가 조회"""
        data = await self._request("GET", f"/api/v1/market-data/stocks/{ticker}/quote")
        return float(data.get("price", 0.0))

    async def place_order(self, order: BrokerOrder) -> OrderResult:
        """
        주문 발주
        - clientOrderId로 10분간 멱등성 보장
        - 미국 주식 가격 소수점: $1 미만 4자리, $1 이상 2자리 절삭
        """
        client_order_id = str(uuid.uuid4())
        try:
            quote = await self.get_quote(order.ticker)
            # 환율 대략 1380원 적용 추정 수량
            usd_val = order.amount_krw / 1380.0
            qty = max(1, int(usd_val / quote)) if quote > 0 else 1

            payload = {
                "clientOrderId": client_order_id,
                "ticker": order.ticker,
                "side": order.action,  # BUY or SELL
                "type": "MARKET",
                "quantity": qty,
                "timeInForce": "DAY",
            }

            res = await self._request("POST", "/api/v1/orders", json=payload)
            order_id = res.get("orderId")
            logger.info(f"[TossBroker] 주문 성공: {order.ticker} {qty}주 발주 (ID: {order_id})")

            return OrderResult(
                success=True,
                order_id=order_id,
                ticker=order.ticker,
                action=order.action,
                amount_krw=order.amount_krw,
                executed_price=quote,
                executed_qty=qty,
            )
        except Exception as e:
            logger.error(f"[TossBroker] 주문 실패 ({order.ticker}): {e}")
            return OrderResult(
                success=False,
                ticker=order.ticker,
                action=order.action,
                amount_krw=order.amount_krw,
                error_message=str(e),
            )

    async def cancel_order(self, order_id: str) -> bool:
        try:
            await self._request("DELETE", f"/api/v1/orders/{order_id}")
            logger.info(f"[TossBroker] 주문 취소 성공: {order_id}")
            return True
        except Exception as e:
            logger.error(f"[TossBroker] 주문 취소 실패 ({order_id}): {e}")
            return False
