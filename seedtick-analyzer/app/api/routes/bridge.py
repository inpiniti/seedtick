"""
Bridge & AutoTrading 모니터링 라우터
"""
import logging
from fastapi import APIRouter, Query
from app.config.constants import DEFAULT_ORDER_AMOUNT_KRW, MAX_DAILY_INVESTMENT_KRW
from app.config.settings import settings
from app.domains.bridge.factory import get_broker_adapter
from app.domains.bridge.toss_ip_guard import toss_ip_guard
from app.domains.auto_trading.service import AutoTradingService

logger = logging.getLogger("bridge_route")

router = APIRouter(prefix="/api", tags=["bridge & auto-trading"])

# 금일 주문 추적용 서비스 인스턴스
_trading_service = AutoTradingService()


@router.get("/bridge/status", summary="증권사 브릿지 연동 상태 조회")
async def get_bridge_status():
    """
    현재 설정된 증권사 브릿지(Bridge) 설정 및 증권사별 API 자격증명 등록 여부 조회
    """
    return {
        "default_broker": settings.DEFAULT_BROKER,
        "dry_run": settings.DRY_RUN,
        "toss_ip": toss_ip_guard.snapshot(),
        "configured_adapters": {
            "mock": True,
            "toss": bool(settings.TOSS_CLIENT_ID and settings.TOSS_CLIENT_SECRET),
            "kis": bool(settings.KIS_APP_KEY and settings.KIS_APP_SECRET and settings.KIS_CANO),
        },
        "details": {
            "toss": {
                "client_id_configured": bool(settings.TOSS_CLIENT_ID),
                "account_seq_configured": bool(settings.TOSS_ACCOUNT_SEQ),
            },
            "kis": {
                "app_key_configured": bool(settings.KIS_APP_KEY),
                "cano_configured": bool(settings.KIS_CANO),
                "acnt_prdt_cd": settings.KIS_ACNT_PRDT_CD,
            },
        },
    }


@router.get("/bridge/balance", summary="증권사 계좌 잔고 조회")
async def get_bridge_balance(
    broker_type: str | None = Query(
        None, description="조회할 브로커 (mock, toss, kis). 미지정 시 설정된 기본 브로커 사용"
    )
):
    """
    브로커 계좌 잔고(KRW, USD, 보유 포지션) 조회
    """
    target = broker_type or settings.DEFAULT_BROKER
    try:
        broker = get_broker_adapter(target)
        balance = await broker.get_balance()
        # 보유 종목 상세 목록 구성 (프론트엔드 BrokerPosition[] 배열 스펙 준수)
        positions_list = []
        if hasattr(broker, "get_holdings_details"):
            try:
                holdings_raw = await broker.get_holdings_details()
                for item in holdings_raw:
                    avg_p = float(item.get("average_price") or 0.0)
                    last_p = float(item.get("last_price") or 0.0)
                    ret_rate = (
                        round(((last_p - avg_p) / avg_p) * 100, 2)
                        if avg_p > 0 and last_p > 0
                        else 0.0
                    )
                    positions_list.append(
                        {
                            "ticker": item["symbol"],
                            "name": item.get("name", ""),
                            "quantity": item["quantity"],
                            "purchase_price": avg_p,
                            "current_price": last_p,
                            "return_rate": ret_rate,
                        }
                    )
            except Exception as e:
                logger.warning(f"[{target}] holdings_details 조회 실패: {e}")

        # 폴백: get_holdings_details가 없거나 빈 경우 balance.positions dict 변환
        if not positions_list and isinstance(balance.positions, dict):
            for sym, qty in balance.positions.items():
                positions_list.append(
                    {
                        "ticker": sym,
                        "name": sym,
                        "quantity": qty,
                        "purchase_price": 0.0,
                        "current_price": 0.0,
                        "return_rate": 0.0,
                    }
                )

        return {
            "broker": target,
            "available_krw": balance.available_krw,
            "available_usd": balance.available_usd,
            "positions": positions_list,
            "positions_map": balance.positions,
        }
    except Exception as e:
        logger.warning(f"[{target}] 잔고 조회 실패: {e}")
        return {
            "broker": target,
            "error": str(e),
            "hint": "API 키 설정 또는 토스/한투 개발자 콘솔 허용 IP 등록 여부를 확인하세요.",
        }


@router.get("/bridge/toss-ip", summary="토스 허용 IP 차단 상태 조회")
async def get_toss_ip_status():
    """
    토스 Open API 허용 IP 미등록(403)으로 호출이 차단된 상태인지 조회합니다.
    차단 중이면 관리 화면에서 안내 배너를 표시하고, IP 등록 후 다시 연결할 수 있어요.
    """
    return toss_ip_guard.snapshot()


@router.post("/bridge/toss-ip/retry", summary="토스 허용 IP 등록 후 연결 재시도")
async def retry_toss_ip_connection():
    """
    사용자가 토스 WTS에 서버 IP를 등록한 뒤 호출합니다.
    차단 상태와 무관하게 1회 실제 프로브를 보내고, 성공하면 차단을 풀어
    정상 동작(WebSocket 포함)을 재개합니다. 다시 403이면 재차단됩니다.
    """
    broker = get_broker_adapter("toss")
    if not hasattr(broker, "probe_connection"):
        return {
            "success": False,
            "blocked": toss_ip_guard.is_blocked,
            "message": "토스 브로커가 설정되어 있지 않아 연결을 확인할 수 없어요.",
        }

    # 프로브는 가드를 우회해 1회 실제 요청을 보낸다 (실패 시 내부에서 재차단).
    ok, message = await broker.probe_connection()
    if ok:
        toss_ip_guard.clear()
        logger.info("[bridge] 토스 허용 IP 연결 재시도 성공 — 정상 동작 재개")
        return {"success": True, "blocked": False, "message": message}

    return {
        "success": False,
        "blocked": toss_ip_guard.is_blocked,
        "message": message,
    }


@router.get("/auto-trading/status", summary="오토트레이딩 상태 및 금일 주문 현황 조회")
async def get_auto_trading_status():
    """
    오토트레이딩 서비스의 금일 매수 주문 내역, 금일 지출액, 일일 한도 및 매매 규칙 조회
    """
    _trading_service._reset_daily_limits_if_needed()
    return {
        "current_date": _trading_service.current_date.isoformat(),
        "today_ordered_tickers": list(_trading_service.today_ordered_tickers),
        "today_spent_krw": _trading_service.today_spent_krw,
        "max_daily_limit_krw": MAX_DAILY_INVESTMENT_KRW,
        "order_amount_per_ticker_krw": DEFAULT_ORDER_AMOUNT_KRW,
        "order_action": "BUY (매수 전용)",
        "strategy_rule": "거장 13인 종합 의견 0점(강력 매수 추천) 종목만 소액 분할 매수. 매도 주문은 나가지 않습니다.",
        "dry_run": settings.DRY_RUN,
        "active_broker": settings.DEFAULT_BROKER,
    }
