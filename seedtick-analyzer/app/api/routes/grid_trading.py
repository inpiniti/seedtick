"""
Grid Trading 라우터
수동 매수 등록, 그리드 감지 로우 조회, 정규장 운영 상태 확인
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.domains.auto_trading.grid_service import GridTradingService
from app.domains.bridge.adapters.toss import TossBrokerAdapter
from app.domains.bridge.adapters.toss_ws import TossWebSocketClient
from app.domains.bridge.factory import get_broker_adapter
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("grid_trading_route")

router = APIRouter(prefix="/api/grid-trading", tags=["grid-trading"])

# 전역 그리드 서비스 인스턴스 (메인 앱 라이프사이클에서 초기화 가능)
_broker = get_broker_adapter("toss") if hasattr(get_broker_adapter, "__call__") else None
grid_service = GridTradingService(broker=_broker, repo=supabase_repo)
ws_client: TossWebSocketClient | None = None


def setup_realtime_ws():
    """토스 브로커가 설정되어 있으면 실시간 WebSocket 클라이언트 바인딩"""
    global ws_client
    if isinstance(_broker, TossBrokerAdapter):
        ws_client = TossWebSocketClient(
            get_access_token_func=_broker._get_access_token,
            on_trade_tick_func=grid_service.on_realtime_tick,
        )
        grid_service._ws_subscriber = ws_client


setup_realtime_ws()


class ManualBuyRequest(BaseModel):
    ticker: str


@router.get("/market-status", summary="정규장 운영 여부 및 그리드 감지 상태 조회")
async def get_market_status():
    """
    현재 시각 미국 정규장 운영 여부, WebSocket 연결 상태, 감지 중인 종목 목록
    """
    is_open = False
    try:
        is_open = await grid_service.broker.is_us_market_open()
    except Exception as e:
        logger.warning(f"정규장 여부 조회 실패: {e}")

    active_items = grid_service.repo.get_active_grid_trades()
    return {
        "is_market_open": is_open,
        "is_ws_connected": ws_client.is_connected if ws_client else False,
        "active_count": len(active_items),
        "active_tickers": [item.ticker for item in active_items],
    }


@router.post("/buy", summary="정규장 1,000원 수동 매수 및 그리드 등록")
async def manual_buy(req: ManualBuyRequest):
    """
    미국 정규장에 1,000원치 시장가 매수를 실행하고 고정 갭(3%) 그리드 감지 목록에 등록합니다.
    - 정규장 외 시간에는 400 에러를 반환합니다.
    """
    ticker = req.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="종목 티커를 입력해주세요.")

    try:
        item = await grid_service.manual_buy_and_register(ticker)
        return {
            "success": True,
            "message": f"{ticker} 1,000원 매수 완료 및 갭(3%) 그리드 감지가 시작되었어요.",
            "item": item.model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"수동 매수 등록 실패 ({ticker}): {e}")
        raise HTTPException(status_code=500, detail=f"매수 발주 중 오류가 발생했습니다: {str(e)}")


@router.get("/items", summary="등록된 그리드 매매 로우 목록 조회")
async def get_grid_items():
    """
    등록된 모든 그리드 종목 및 감지 상태(처음매수주가, 갭 3%, 마지막매매주가, 체결횟수) 조회
    """
    items = grid_service.repo.get_all_grid_trades()
    return {
        "items": [item.model_dump() for item in items],
        "count": len(items),
    }


@router.post("/items/{ticker}/close", summary="그리드 감지 수동 종료")
async def close_grid_item(ticker: str):
    """
    지정된 종목의 그리드 감지를 즉시 종료(FINISHED) 처리합니다.
    """
    sym = ticker.strip().upper()
    active_items = grid_service.repo.get_active_grid_trades()
    target = next((it for it in active_items if it.ticker == sym), None)
    if not target:
        raise HTTPException(status_code=404, detail="감지 중인 종목을 찾을 수 없습니다.")

    target.status = "FINISHED"
    grid_service.repo.update_grid_trade(target)
    return {
        "success": True,
        "message": f"{sym} 종목의 그리드 감지를 종료했어요.",
    }
