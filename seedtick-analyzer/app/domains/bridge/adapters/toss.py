"""
TossBrokerAdapter: 토스증권 Open API 기반 증권사 어댑터
참고: financial-desktop/docs/toss open api 정본 스펙 준수
"""
import asyncio
from datetime import datetime, timezone, timedelta
import json
import logging
from pathlib import Path
import time
from typing import Any
import uuid
import httpx

from app.config.settings import settings
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerBalance, BrokerOrder, OrderResult
from app.domains.bridge.toss_ip_guard import toss_ip_guard

logger = logging.getLogger("toss_broker")

TOSS_API_BASE = "https://openapi.tossinvest.com"
_TOSS_CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent


def _token_cache_path(client_id: str) -> Path:
    """계좌(client_id)별 토큰 캐시 파일 경로 — 멀티 계좌 충돌 방지"""
    safe_id = client_id[:12] if client_id else "unknown"
    return _TOSS_CACHE_DIR / f".toss_token_cache_{safe_id}.json"


class _TokenState:
    """계좌(client_id) 단위로 프로세스 전역 공유되는 토큰 상태.

    토스 Open API는 client당 유효 토큰이 단 1개이며, 새 토큰을 발급하면 이전 토큰이
    즉시 무효화(token-revoked)된다. 따라서 어댑터 인스턴스가 여러 개 생성되더라도
    토큰을 인스턴스별로 따로 보유하면 서로의 토큰을 상쇄하는 루프가 발생한다.
    모든 인스턴스가 이 객체를 공유해야 한다.
    """

    def __init__(self, client_id: str, cache_file: Path):
        self.client_id = client_id
        self.cache_file = cache_file
        self.token: str | None = None
        self.expires_at: float = 0.0
        # 이벤트 루프별 락 (테스트 등 루프가 재생성되는 환경 대비)
        self._locks: dict[Any, asyncio.Lock] = {}

    def lock(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        lk = self._locks.get(loop)
        if lk is None:
            lk = asyncio.Lock()
            self._locks[loop] = lk
        return lk


_TOKEN_STATES: dict[str, _TokenState] = {}


def _get_token_state(client_id: str) -> _TokenState:
    """계좌별 공유 토큰 상태 조회 (최초 생성 시 파일 캐시 로드)"""
    key = client_id or "unknown"
    st = _TOKEN_STATES.get(key)
    if st is None:
        st = _TokenState(client_id, _token_cache_path(client_id))
        _TOKEN_STATES[key] = st
    return st


class TossBrokerAdapter(IBrokerAdapter):
    # 토큰 만료 전 이만큼(초) 여유를 두고 조기 재발급
    _TOKEN_EXPIRY_SKEW = 1800

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        account_seq: str | None = None,
    ):
        self.client_id = client_id or settings.TOSS_CLIENT_ID
        self.client_secret = client_secret or settings.TOSS_CLIENT_SECRET
        self.raw_account_seq = account_seq or settings.TOSS_ACCOUNT_SEQ

        # 토큰은 계좌 단위로 프로세스 전역 공유 (인스턴스별 보유 시 상호 상쇄 루프 발생)
        self._token_state = _get_token_state(self.client_id)

        self._throttle_lock = asyncio.Lock()
        self._last_request_time: float = 0.0
        self._resolved_account_seq: int | None = None

    async def _throttle(self) -> None:
        """토스 API 요청 최소 간격 (150ms) 준수 (동시 호출 간 락 보호)"""
        async with self._throttle_lock:
            elapsed = time.time() - self._last_request_time
            if elapsed < 0.15:
                await asyncio.sleep(0.15 - elapsed)
            self._last_request_time = time.time()


    def invalidate_token(self) -> None:
        """공유 토큰 상태를 즉시 무효화 — 다음 조회 시 강제 재발급 유도.

        WebSocket 재연결 등 토큰 수명이 보장되지 않는 경로에서 호출한다.
        """
        st = self._token_state
        st.token = None
        st.expires_at = 0.0
        try:
            if st.cache_file.exists():
                st.cache_file.unlink()
        except Exception:
            pass

    async def _get_access_token(self, force: bool = False, bypass_ip_guard: bool = False) -> str:
        """
        POST /oauth2/token
        주의: client당 유효 토큰은 1개(신규 발급 시 이전 토큰 즉시 무효).
        토큰을 계좌 단위 전역 상태로 공유하여, 여러 어댑터 인스턴스가
        서로의 토큰을 상쇄(token-revoked)하는 루프를 방지한다.
        """
        # 허용 IP 차단 상태에서는 네트워크를 두드리지 않는다 (프로브는 bypass).
        if not bypass_ip_guard:
            toss_ip_guard.ensure_allowed()

        st = self._token_state
        async with st.lock():
            # 1. 인메모리 유효성 검사
            if not force and st.token and time.time() < (st.expires_at - self._TOKEN_EXPIRY_SKEW):
                return st.token

            # 2. 파일 캐시 검사 (계좌별 독립 파일) — 강제 갱신이 아니면 재사용
            if not force and st.cache_file.exists():
                try:
                    cache = json.loads(st.cache_file.read_text(encoding="utf-8"))
                    if (
                        cache.get("client_id") == self.client_id
                        and cache.get("expires_at", 0) > time.time() + self._TOKEN_EXPIRY_SKEW
                    ):
                        st.token = cache["token"]
                        st.expires_at = cache["expires_at"]
                        return st.token
                except Exception:
                    pass

            # 3. 방금 다른 경로가 재발급했다면 그 토큰을 재사용 (상쇄 루프 차단)
            if force and st.token and time.time() < st.expires_at:
                logger.info("[TossBroker] 최근 발급된 공유 토큰 재사용 (재발급 생략)")
                return st.token

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
                    msg = "토스 API 403 Forbidden: WTS 설정 > Open API > 허용 IP에 현재 IP를 등록해야 합니다."
                    toss_ip_guard.mark_blocked(msg)
                    raise PermissionError(msg)
                if res.status_code == 401:
                    raise PermissionError(f"토스 API 401 Unauthorized: client_id/secret 오류: {res.text}")
                res.raise_for_status()
                token_data = res.json()

            st.token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 86400)
            st.expires_at = time.time() + expires_in

            # 파일 캐시 저장 (계좌별 독립 파일)
            try:
                st.cache_file.write_text(
                    json.dumps({
                        "client_id": self.client_id,
                        "token": st.token,
                        "expires_at": st.expires_at,
                    }),
                    encoding="utf-8",
                )
            except Exception as e:
                logger.warning(f"[TossBroker] 토큰 파일 캐시 저장 실패: {e}")

            logger.info(f"[TossBroker] 토큰 발급 성공 (expires_in={expires_in}s)")
            return st.token

    async def _resolve_account_seq(self) -> int:
        """
        토스 계좌 식별자(accountSeq: 정수) 확인
        - 숫자로 직접 지정된 경우(예: '1') 그대로 사용
        - 계좌번호 형식(예: '105-01-067825')이거나 비어있는 경우, GET /api/v1/accounts를 호출하여 자동 매칭
        """
        if self._resolved_account_seq is not None:
            return self._resolved_account_seq

        clean_raw = str(self.raw_account_seq or "").replace("-", "").strip()
        if clean_raw.isdigit() and len(clean_raw) <= 4:
            # accountSeq가 1, 2 등의 짧은 정수인 경우
            self._resolved_account_seq = int(clean_raw)
            return self._resolved_account_seq

        # 계좌 목록 조회를 통해 자동 매칭
        accounts = await self._request("GET", "/api/v1/accounts", with_account_header=False)
        account_list = accounts if isinstance(accounts, list) else []

        if not account_list:
            raise RuntimeError("토스 계좌 목록이 비어 있습니다. WTS에서 종합매매 계좌를 확인하세요.")

        # 1. 입력된 계좌번호와 일치하는 계좌 검색
        for acc in account_list:
            acc_no = str(acc.get("accountNo", "")).replace("-", "").strip()
            if clean_raw and acc_no == clean_raw:
                self._resolved_account_seq = int(acc["accountSeq"])
                logger.info(f"[TossBroker] 계좌번호({self.raw_account_seq}) 매칭 성공 -> accountSeq: {self._resolved_account_seq}")
                return self._resolved_account_seq

        # 2. 일치하는 게 없으면 첫 번째 BROKERAGE 계좌 자동 선택
        for acc in account_list:
            if acc.get("accountType") == "BROKERAGE":
                self._resolved_account_seq = int(acc["accountSeq"])
                logger.info(f"[TossBroker] 주 계좌(BROKERAGE) 자동 선택 -> accountSeq: {self._resolved_account_seq}")
                return self._resolved_account_seq

        # 3. 첫 번째 계좌 선택
        self._resolved_account_seq = int(account_list[0]["accountSeq"])
        return self._resolved_account_seq

    async def _request(
        self,
        method: str,
        path: str,
        json: dict | None = None,
        params: dict | None = None,
        with_account_header: bool = True,
        bypass_ip_guard: bool = False,
    ) -> dict | list:
        """공통 요청 처리: 429 지수 백오프, 401 토큰 1회 재발급"""
        # 허용 IP 차단 상태면 네트워크 호출 없이 즉시 단락 (프로브는 bypass).
        if not bypass_ip_guard:
            toss_ip_guard.ensure_allowed()

        for attempt in range(1, 4):
            token = await self._get_access_token(
                force=(attempt > 1), bypass_ip_guard=bypass_ip_guard
            )
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            if with_account_header:
                acc_seq = await self._resolve_account_seq()
                headers["X-Tossinvest-Account"] = str(acc_seq)

            await self._throttle()
            url = f"{TOSS_API_BASE}{path}"
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.request(method, url, headers=headers, json=json, params=params)

                if res.status_code == 200:
                    data = res.json()
                    return data.get("result") if "result" in data else data

                if res.status_code == 429:
                    retry_after = float(res.headers.get("Retry-After", 2.0))
                    logger.warning(f"[TossBroker] 429 RateLimit — {retry_after}s 대기 후 재시도")
                    await asyncio.sleep(retry_after)
                    continue

                if res.status_code == 401 and attempt == 1:
                    logger.warning("[TossBroker] 401 Unauthorized — 토큰 재발급 후 1회 재시도")
                    # 공유 토큰 상태 무효화 → 다음 시도에서 신규 토큰 발급
                    self.invalidate_token()
                    continue

                if res.status_code == 403:
                    msg = (
                        f"토스 API 403 Forbidden: 서버 공인 IP가 변경되었거나 허용 IP로 등록되지 않았습니다 ({res.text}). "
                        "토스 WTS/Open API 설정에서 현재 서버의 외부 공인 IP를 등록해주세요."
                    )
                    logger.error(f"[TossBroker] {msg}")
                    toss_ip_guard.mark_blocked(msg)
                    raise PermissionError(msg)

                raise RuntimeError(f"토스 API 호출 실패 ({res.status_code}): {res.text}")

        raise RuntimeError("토스 API 재시도 초과")

    async def get_balance(self) -> BrokerBalance:
        """
        계좌 잔고 조회
        - 원화 예수금: GET /api/v1/buying-power?currency=KRW
        - 달러 예수금: GET /api/v1/buying-power?currency=USD
        - 보유 주식: GET /api/v1/holdings
        """
        try:
            # 1. 원화 매수 가능 금액
            krw_res = await self._request("GET", "/api/v1/buying-power", params={"currency": "KRW"})
            # 2. 달러 매수 가능 금액
            usd_res = await self._request("GET", "/api/v1/buying-power", params={"currency": "USD"})
            # 3. 보유 주식
            holdings_res = await self._request("GET", "/api/v1/holdings")

            available_krw = 0
            if isinstance(krw_res, dict) and "cashBuyingPower" in krw_res:
                available_krw = int(float(krw_res["cashBuyingPower"] or 0))

            available_usd = 0.0
            if isinstance(usd_res, dict) and "cashBuyingPower" in usd_res:
                available_usd = float(usd_res["cashBuyingPower"] or 0.0)

            positions: dict[str, float] = {}
            if isinstance(holdings_res, dict):
                for item in holdings_res.get("items", []):
                    sym = item.get("symbol")
                    qty = float(item.get("quantity", 0))
                    if sym and qty > 0:
                        positions[sym] = qty

            return BrokerBalance(
                available_krw=available_krw,
                available_usd=available_usd,
                positions=positions,
            )
        except Exception as e:
            logger.error(f"[TossBroker] 잔고 조회 실패: {e}")
            raise

    async def get_holdings_details(self) -> list[dict]:
        """
        보유 주식 상세 목록 조회 (symbol, name, quantity, average_price, last_price)
        - GET /api/v1/holdings
        """
        try:
            holdings_res = await self._request("GET", "/api/v1/holdings")
            items = []
            if isinstance(holdings_res, dict):
                for raw in holdings_res.get("items", []):
                    sym = raw.get("symbol")
                    qty = float(raw.get("quantity", 0))
                    if sym and qty > 0:
                        avg_price = float(raw.get("averagePurchasePrice") or 0.0)
                        last_price = float(raw.get("lastPrice") or 0.0)
                        items.append({
                            "symbol": sym.upper(),
                            "name": raw.get("name", ""),
                            "quantity": qty,
                            "average_price": avg_price,
                            "last_price": last_price,
                            "currency": raw.get("currency", "USD"),
                        })
            return items
        except Exception as e:
            logger.error(f"[TossBroker] 보유 주식 상세 조회 실패: {e}")
            raise

    async def get_quote(self, ticker: str) -> float:
        """
        현재가 조회
        - GET /api/v1/prices?symbols={ticker}
        """
        data = await self._request(
            "GET",
            "/api/v1/prices",
            params={"symbols": ticker.upper()},
            with_account_header=False,
        )
        if isinstance(data, list) and len(data) > 0:
            price = data[0].get("lastPrice")
            if price is not None:
                return float(price)
        raise ValueError(f"토스 시세 조회 실패 ({ticker}): {data}")

    async def get_exchange_rate(self) -> float:
        """실시간 USD/KRW 환율 조회 (토스 API 연동, 실패 시 1370.0 폴백)"""
        try:
            res = await self._request(
                "GET",
                "/api/v1/exchange-rate",
                params={"baseCurrency": "USD", "quoteCurrency": "KRW"},
                with_account_header=False,
            )
            if isinstance(res, dict) and "rate" in res:
                return float(res["rate"])
        except Exception as e:
            logger.warning(f"[TossBroker] 환율 조회 실패({e}) -> 기본 1370.0 사용")
        return 1370.0

    async def is_us_market_open(self) -> bool:
        """현재 시각이 미국 정규장(regularMarket) 거래 시간인지 확인"""
        # 허용 IP 차단 상태에서는 API를 두드리지 않고 KST 시간 기반으로만 판정한다.
        if toss_ip_guard.is_blocked:
            return self._fallback_market_open()

        try:
            cal = await self._request("GET", "/api/v1/market-calendar/US", with_account_header=False)
            if isinstance(cal, dict):
                today_cal = cal.get("today", {})
                reg = today_cal.get("regularMarket")
                if reg:
                    start_str = reg.get("startTime")
                    end_str = reg.get("endTime")
                    if start_str and end_str:
                        now = datetime.now(timezone.utc)
                        start_dt = datetime.fromisoformat(start_str)
                        end_dt = datetime.fromisoformat(end_str)
                        return start_dt <= now <= end_dt
        except Exception as e:
            logger.warning(f"[TossBroker] 장 운영시간 조회 실패({e}) -> KST 시간 기반 판정")

        return self._fallback_market_open()

    def _fallback_market_open(self) -> bool:
        """폴백: 평일 KST 22:30 ~ 익일 06:00"""
        now_kst = datetime.now(timezone(timedelta(hours=9)))
        if now_kst.weekday() >= 5:  # 토, 일 주말
            return False
        if (now_kst.hour == 22 and now_kst.minute >= 30) or (now_kst.hour >= 23) or (now_kst.hour < 6):
            return True
        return False

    async def probe_connection(self) -> tuple[bool, str]:
        """허용 IP 등록 여부 확인용 경량 프로브.

        차단 상태와 무관하게 1회 실제 요청을 보낸다(bypass). 403이면 가드가
        자동으로 재차단하며, 성공하면 호출 측이 `clear()` 로 정상 동작을 재개한다.
        """
        try:
            await self._request(
                "GET",
                "/api/v1/market-calendar/US",
                with_account_header=False,
                bypass_ip_guard=True,
            )
            return True, "토스 API 연결에 성공했어요."
        except PermissionError as e:
            return False, str(e)
        except Exception as e:
            return False, f"토스 API 연결을 확인하지 못했어요: {e}"

    async def place_order(self, order: BrokerOrder) -> OrderResult:
        """
        주문 발주 (POST /api/v1/orders)
        - 미국 주식 소수점 시장가 매수(orderAmount) 지원
        - 정규장(regularMarket) 외 시간에는 발주하지 않고 실패로 반환한다.
          예약 큐 등록은 더 이상 하지 않으므로 장외 체결가는 어떤 주문으로도 이어지지 않는다.
        """
        client_order_id = str(uuid.uuid4())
        try:
            # 1. 미국 정규장 운영 여부 확인 (장외 발주 차단 — 환율 조회보다 먼저 판정)
            is_open = await self.is_us_market_open()
            if not is_open:
                logger.warning(
                    f"[TossBroker] 🌙 장외 시간 발주 차단: {order.ticker} {order.action} "
                    f"{order.amount_krw:,}원 — 정규장 시간에만 주문됩니다."
                )
                return OrderResult(
                    success=False,
                    ticker=order.ticker,
                    action=order.action,
                    amount_krw=order.amount_krw,
                    error_message="미국 정규장(regularMarket) 시간에만 주문이 접수됩니다.",
                )

            # 2. 환율 및 주문 달러 금액 계산
            fx_rate = await self.get_exchange_rate()
            usd_amount = round(order.amount_krw / fx_rate, 2)
            if usd_amount < 1.0:
                usd_amount = 1.0  # 토스 최소 금액 안전 하한선

            # 3. 소수점 시장가 즉시 발주 (orderAmount)
            payload = {
                "symbol": order.ticker.upper(),
                "side": order.action.upper(),  # BUY
                "orderType": "MARKET",
                "orderAmount": str(usd_amount),
                "clientOrderId": client_order_id,
            }

            res = await self._request("POST", "/api/v1/orders", json=payload)
            order_id = res.get("orderId") if isinstance(res, dict) else str(res)
            logger.info(
                f"[TossBroker] 🚀 정규장 소수점 시장가 발주 성공: {order.ticker} ${usd_amount} ({order.amount_krw:,}원) (주문ID: {order_id})"
            )

            return OrderResult(
                success=True,
                order_id=str(order_id),
                ticker=order.ticker,
                action=order.action,
                amount_krw=order.amount_krw,
                executed_price=None,
                executed_qty=None,
            )
        except Exception as e:
            err_msg = str(e)
            if "insufficient-buying-power" in err_msg:
                err_msg = (
                    "주문가능 달러가 부족합니다. 토스 Open API는 달러(USD) 예수금으로만 "
                    "소수점 매수가 가능하므로 토스 앱에서 원화를 달러로 환전해주세요."
                )
            logger.error(f"[TossBroker] 주문 실패 ({order.ticker}): {err_msg}")
            return OrderResult(
                success=False,
                ticker=order.ticker,
                action=order.action,
                amount_krw=order.amount_krw,
                error_message=err_msg,
            )

    async def cancel_order(self, order_id: str) -> bool:
        """주문 취소: POST /api/v1/orders/{order_id}/cancel"""
        try:
            await self._request("POST", f"/api/v1/orders/{order_id}/cancel")
            logger.info(f"[TossBroker] 주문 취소 성공: {order_id}")
            return True
        except Exception as e:
            logger.error(f"[TossBroker] 주문 취소 실패 ({order_id}): {e}")
            return False
