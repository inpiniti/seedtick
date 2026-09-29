"""
PendingOrderQueue: 장외 시간 소수점 예약 매수 주문 큐 및 영속화 관리자
"""
import json
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Any

from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.models import BrokerOrder, OrderResult

logger = logging.getLogger("order_queue")

_QUEUE_DIR = Path(__file__).resolve().parent.parent.parent.parent


def _queue_file_path(account_id: str = "default") -> Path:
    """계좌별 예약 주문 큐 파일 경로 — 멀티 계좌 파일 충돌 방지"""
    safe_id = account_id.replace("/", "-").replace(" ", "_")[:20]
    return _QUEUE_DIR / f".pending_orders_{safe_id}.json"


class PendingOrderQueue:
    def __init__(self, account_id: str = "default", file_path: Path | None = None):
        self.account_id = account_id
        self.file_path = file_path or _queue_file_path(account_id)

    def _load_data(self) -> dict[str, Any]:
        if not self.file_path.exists():
            return {"date": date.today().isoformat(), "orders": []}
        try:
            data = json.loads(self.file_path.read_text(encoding="utf-8"))
            # 날짜가 바뀌었으면 지난 주문들 만료 처리
            today_str = date.today().isoformat()
            if data.get("date") != today_str:
                logger.info(f"[OrderQueue] 날짜 변경({data.get('date')} -> {today_str}): 이전 대기 주문 초기화")
                return {"date": today_str, "orders": []}
            return data
        except Exception as e:
            logger.warning(f"[OrderQueue] 큐 파일 읽기 실패, 초기화: {e}")
            return {"date": date.today().isoformat(), "orders": []}

    def _save_data(self, data: dict[str, Any]) -> None:
        try:
            self.file_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            logger.error(f"[OrderQueue] 큐 파일 저장 실패: {e}")

    def add_pending_order(
        self,
        ticker: str,
        amount_krw: int,
        amount_usd: float,
        action: str = "BUY",
        client_order_id: str | None = None,
    ) -> bool:
        """예약 주문 큐에 등록 (당일 동일 티커 중복 방지)"""
        data = self._load_data()
        ticker = ticker.upper()

        # 이미 큐에 등록된 종목인지 검사
        for item in data["orders"]:
            if item.get("ticker") == ticker:
                logger.info(f"[OrderQueue] {ticker}: 이미 당일 예약 주문 큐에 등록되어 있음 (중복 건너뜀)")
                return False

        new_entry = {
            "ticker": ticker,
            "amount_krw": amount_krw,
            "amount_usd": amount_usd,
            "action": action,
            "client_order_id": client_order_id,
            "created_at": datetime.now().isoformat(),
            "status": "PENDING",
            "error_message": None,
        }
        data["orders"].append(new_entry)
        self._save_data(data)
        logger.info(f"[OrderQueue] 예약 주문 등록 완료: {ticker} {amount_krw:,}원 (${amount_usd})")
        return True

    def get_pending_orders(self) -> list[dict[str, Any]]:
        """현재 대기 중인 예약 주문 목록 조회"""
        return self._load_data().get("orders", [])

    def update_order_status(self, ticker: str, status: str, error_message: str | None = None) -> None:
        """예약 주문 상태 및 에러 메시지 갱신"""
        data = self._load_data()
        ticker = ticker.upper()
        for item in data["orders"]:
            if item.get("ticker") == ticker:
                item["status"] = status
                if error_message is not None:
                    item["error_message"] = error_message
                item["updated_at"] = datetime.now().isoformat()
        self._save_data(data)

    def remove_pending_order(self, ticker: str) -> None:
        """특정 종목 예약 주문 큐에서 제거"""
        data = self._load_data()
        data["orders"] = [o for o in data["orders"] if o.get("ticker") != ticker.upper()]
        self._save_data(data)

    def clear(self) -> None:
        """큐 비우기"""
        self._save_data({"date": date.today().isoformat(), "orders": []})

    async def execute_all_pending(self, broker: IBrokerAdapter) -> list[OrderResult]:
        """대기 중인 예약 주문들을 실제 브로커로 발주"""
        orders = self.get_pending_orders()
        if not orders:
            logger.info("[OrderQueue] 발주 대기 중인 예약 주문이 없습니다.")
            return []

        logger.info(f"[OrderQueue] 총 {len(orders)}건의 예약 주문 정규장 발주 시작...")
        results: list[OrderResult] = []

        for item in list(orders):
            ticker = item["ticker"]
            amount_krw = item["amount_krw"]

            order = BrokerOrder(
                ticker=ticker,
                action=item.get("action", "BUY"),
                amount_krw=amount_krw,
                memo=f"seedtick-reserve-{ticker}",
            )

            res = await broker.place_order(order)
            results.append(res)

            if res.success and not (res.order_id and res.order_id.startswith("RESERVE-")):
                # 실제 주문 체결/접수 성공 시 큐에서 제거
                self.remove_pending_order(ticker)
                logger.info(f"[OrderQueue] 예약 매수 발주 완료 -> 큐에서 제거: {ticker} (주문ID: {res.order_id})")
            else:
                self.update_order_status(
                    ticker=ticker,
                    status="FAILED",
                    error_message=res.error_message or "발주 실패",
                )
                logger.error(f"[OrderQueue] 예약 매수 발주 실패: {ticker} ({res.error_message})")

        return results


pending_order_queue = PendingOrderQueue()
