"""
Screener API Route
"""
from fastapi import APIRouter, HTTPException, Query
from app.domains.screener.chart_service import ChartService
from app.domains.screener.models import ScreenCriteria, ScreenResult, StockChartResponse
from app.domains.screener.service import ScreenerService

router = APIRouter(prefix="/api/screener", tags=["screener"])


@router.get("/run", response_model=ScreenResult, summary="토스 종합 및 12인 거장 스크리너 실행 (중복 제거)")
async def run_screener(
    preset: str = Query("공통", description="거장 프리셋 (기본: '공통' - 종합+12인 거장 통합 조회, 피셔 제외, 특정 거장명 지정 가능)"),
    nation: str = Query("us", description="국가 (us: 해외, kr: 국내)"),
    size: int = Query(200, ge=1, le=200, description="조회 건수 (최대 200)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
):
    try:
        criteria = ScreenCriteria(
            preset=preset,
            nation=nation,
            size=size,
            page=page,
        )
        service = ScreenerService()
        return await service.get_stock_list(criteria)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"스크리너 실행 실패: {e}")


@router.get("/chart/{ticker}", response_model=StockChartResponse, summary="종목 일봉 캔들스틱 및 볼린저 밴드(20, 2) 조회")
async def get_stock_chart(
    ticker: str,
    range_period: str = Query("6mo", alias="range", description="조회 기간 (기본 6mo, 3mo/6mo/1y)"),
    interval: str = Query("1d", description="캔들 주기 (기본 1d)"),
):
    try:
        service = ChartService()
        return await service.get_stock_chart(ticker=ticker, range_period=range_period, interval=interval)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"[{ticker}] 차트 데이터 조회 실패: {e}")

