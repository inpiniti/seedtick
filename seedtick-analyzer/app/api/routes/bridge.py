"""
Bridge & AutoTrading 모니터링 라우터
"""
import logging
from fastapi import APIRouter, Query
from app.config.constants import DEFAULT_ORDER_AMOUNT_KRW, MAX_DAILY_INVESTMENT_KRW
from app.config.settings import settings
from app.domains.bridge.factory import get_broker_adapter
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
        return {
            "broker": target,
            "available_krw": balance.available_krw,
            "available_usd": balance.available_usd,
            "positions": balance.positions,
        }
    except Exception as e:
        logger.warning(f"[{target}] 잔고 조회 실패: {e}")
        return {
            "broker": target,
            "error": str(e),
            "hint": "API 키 설정 또는 토스/한투 개발자 콘솔 허용 IP 등록 여부를 확인하세요.",
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


@router.get("/auto-trading/pending-orders", summary="대기 중인 예약 주문 목록 조회")
async def get_pending_orders():
    """
    미국 정규장 개장 전 등록되어 발주 대기 중인 소수점 예약 매수 주문 목록 조회
    """
    from app.domains.bridge.order_queue import pending_order_queue
    return {
        "pending_count": len(pending_order_queue.get_pending_orders()),
        "orders": pending_order_queue.get_pending_orders(),
    }


@router.post("/auto-trading/execute-pending", summary="대기 중인 예약 주문 수동 즉시 발주")
async def execute_pending_orders_endpoint(
    dry_run: bool | None = Query(None, description="Dry-run 여부 (미지정 시 설정값 사용)")
):
    """
    대기 중인 예약 매수 주문들을 즉시 브로커(토스 등)로 발주
    """
    from app.domains.scheduler.jobs import execute_pending_orders_job
    res = await execute_pending_orders_job(dry_run=dry_run)
    return res
