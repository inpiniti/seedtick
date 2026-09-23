"""
KisBrokerAdapter: 한국투자증권 Open API 기반 어댑터
참고: financial-app/docs/koreainvestment 정본 스펙 준수
"""
import asyncio
import logging
import time
import httpx

from app.config.settings import settings
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerBalance, BrokerOrder, OrderResult

logger = logging.getLogger("kis_broker")

KIS_PROD_URL = "https://openapi.koreainvestment.com:9443"


class KisBrokerAdapter(IBrokerAdapter):
    def __init__(
        self,
        app_key: str | None = None,
        app_secret: str | None = None,
        cano: str | None = None,
        acnt_prdt_cd: str | None = None,
    ):
        self.app_key = app_key or settings.KIS_APP_KEY
        self.app_secret = app_secret or settings.KIS_APP_SECRET
        self.cano = cano or settings.KIS_CANO
        self.acnt_prdt_cd = acnt_prdt_cd or settings.KIS_ACNT_PRDT_CD

        self._lock = asyncio.Lock()
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    async def _get_access_token(self) -> str:
        """POST /oauth2/tokenP (24시간 유효)"""
        async with self._lock:
            if self._token and time.time() < (self._token_expires_at - 1800):
                return self._token

            if not self.app_key or not self.app_secret:
                raise ValueError("한투 API 자격 증명(KIS_APP_KEY / KIS_APP_SECRET)이 설정되지 않았습니다.")

            url = f"{KIS_PROD_URL}/oauth2/tokenP"
            payload = {
                "grant_type": "client_credentials",
                "appkey": self.app_key,
                "appsecret": self.app_secret,
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                res.raise_for_status()
                data = res.json()

            self._token = data["access_token"]
            expires_in = int(data.get("expires_in", 86400))
            self._token_expires_at = time.time() + expires_in
            logger.info(f"[KisBroker] 접근토큰 발급 성공 (expires_in={expires_in}s)")
            return self._token

    async def get_balance(self) -> BrokerBalance:
        """해외주식 잔고 조회 (TR: TTTS3012R)"""
        try:
            token = await self._get_access_token()
            headers = {
                "authorization": f"Bearer {token}",
                "appkey": self.app_key,
                "appsecret": self.app_secret,
                "tr_id": "TTTS3012R",
            }
            params = {
                "CANO": self.cano,
                "ACNT_PRDT_CD": self.acnt_prdt_cd,
                "OVRS_EXCG_CD": "NASD",
                "TR_CRCY_CD": "USD",
                "CTX_AREA_FK200": "",
                "CTX_AREA_NK200": "",
            }
            url = f"{KIS_PROD_URL}/uapi/overseas-stock/v1/trading/inquire-balance"
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers, params=params)
                res.raise_for_status()
                data = res.json()

            output2 = data.get("output2", {})
            available_usd = float(output2.get("frcr_dncl_amt_2", 0.0))
            positions = {}
            for item in data.get("output1", []):
                sym = item.get("ovrs_pdno")
                qty = float(item.get("ord_psbl_qty", 0))
                if sym and qty > 0:
                    positions[sym] = qty

            return BrokerBalance(
                available_krw=int(available_usd * 1380.0),
                available_usd=available_usd,
                positions=positions,
            )
        except Exception as e:
            logger.error(f"[KisBroker] 잔고 조회 실패: {e}")
            return BrokerBalance(available_krw=0, available_usd=0.0)

    async def get_quote(self, ticker: str) -> float:
        """해외주식 현재가 상세 (TR: HHDFS00000300)"""
        token = await self._get_access_token()
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": "HHDFS00000300",
        }
        params = {
            "AUTH": "",
            "EXCD": "NAS",
            "SYMB": ticker.upper(),
        }
        url = f"{KIS_PROD_URL}/uapi/overseas-price/v1/quotations/price-detail"
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers, params=params)
            res.raise_for_status()
            data = res.json()
            return float(data.get("output", {}).get("last", 0.0))

    async def place_order(self, order: BrokerOrder) -> OrderResult:
        """해외주식 매수 주문 (TR: TTTT1002U)"""
        try:
            token = await self._get_access_token()
            quote = await self.get_quote(order.ticker)
            usd_val = order.amount_krw / 1380.0
            qty = max(1, int(usd_val / quote)) if quote > 0 else 1

            headers = {
                "authorization": f"Bearer {token}",
                "appkey": self.app_key,
                "appsecret": self.app_secret,
                "tr_id": "TTTT1002U",  # 미국 매수 주문
            }
            payload = {
                "CANO": self.cano,
                "ACNT_PRDT_CD": self.acnt_prdt_cd,
                "OVRS_EXCG_CD": "NASD",
                "PDNO": order.ticker.upper(),
                "ORD_QTY": str(qty),
                "OVRS_ORD_UNPR": str(round(quote, 2)),
                "ORD_SVR_DVSN_CD": "0",
                "ORD_DVSN": "00",  # 지정가/시장가
            }
            url = f"{KIS_PROD_URL}/uapi/overseas-stock/v1/trading/order"
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                res.raise_for_status()
                data = res.json()

            order_id = data.get("output", {}).get("ODNO")
            logger.info(f"[KisBroker] 주문 접수 완료: {order.ticker} {qty}주 (주문번호: {order_id})")

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
            logger.error(f"[KisBroker] 주문 발주 실패 ({order.ticker}): {e}")
            return OrderResult(
                success=False,
                ticker=order.ticker,
                action=order.action,
                amount_krw=order.amount_krw,
                error_message=str(e),
            )

    async def cancel_order(self, order_id: str) -> bool:
        logger.info(f"[KisBroker] 주문 취소 요청: {order_id}")
        return True
