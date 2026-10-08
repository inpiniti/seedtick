"""
Screener API Route
"""
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from app.domains.screener.chart_service import ChartService
from app.domains.screener.clients.dataroma import MIN_HOLDERS_DEFAULT
from app.domains.screener.logo_service import TickerLogoService
from app.domains.screener.models import (
    ScreenCriteria,
    ScreenResult,
    StockChartResponse,
    TickerLogoBatchResponse,
    TickerLogoResponse,
)
from app.domains.screener.roma_service import RomaScreenerService
from app.domains.screener.service import ScreenerService

router = APIRouter(prefix="/api/screener", tags=["screener"])


class TickerLogoBatchRequest(BaseModel):
    tickers: list[str] = Field(default_factory=list)
    max_count: int = Field(default=12, ge=1, le=30)


@router.get("/run", response_model=ScreenResult, summary="토스 종합 및 12인 거장 스크리너 실행 (중복 제거)")
async def run_screener(
    preset: str = Query("공통", description="거장 프리셋 (기본: '공통' - 종합+12인 거장 통합 조회, 피셔 제외, 특정 거장명 지정 가능)"),
    nation: str = Query("us", description="국가 (us: 해외, kr: 국내)"),
    size: int = Query(200, ge=1, le=200, description="조회 건수 (최대 200)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    tighten_step: int = Query(5, ge=0, le=7, description="조건 강화 옵션 단계 (기본값: 5단계 고수익 저부채 핵심 알짜)"),
):
    try:
        criteria = ScreenCriteria(
            preset=preset,
            nation=nation,
            size=size,
            page=page,
            tighten_step=tighten_step,
        )
        service = ScreenerService()
        return await service.get_stock_list(criteria)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"스크리너 실행 실패: {e}")


@router.get(
    "/roma",
    response_model=ScreenResult,
    summary="DataRoma 슈퍼인베스터 그랜드 포트폴리오 스크리너 (보유자 10명 이상)",
)
async def run_roma_screener(
    min_holders: int = Query(
        MIN_HOLDERS_DEFAULT,
        ge=1,
        le=200,
        description="최소 보유 투자자 수 (기본: 10명 이상)",
    ),
    size: int = Query(0, ge=0, le=500, description="조회 건수 (0이면 전체)"),
):
    """
    DataRoma Grand Portfolio(https://www.dataroma.com/m/g/portfolio.php?o=c)를
    스크레이핑해 슈퍼인베스터들이 공동 보유한 종목을 반환합니다.
    """
    try:
        service = RomaScreenerService()
        return await service.get_stock_list(min_holders=min_holders, size=size)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"DataRoma 스크리너 실행 실패: {e}")


@router.get("/chart/{ticker}", response_model=StockChartResponse, summary="종목 일봉 캔들스틱 및 볼린저 밴드(20, 2) 조회")
async def get_stock_chart(
    ticker: str,
    range_period: str = Query("6mo", alias="range", description="조회 기간 (기본 6mo, 3mo/6mo/1y)"),
    interval: str = Query("1d", description="캔들 주기 (기본 1d)"),
):
    try:
        service = ChartService()
        return await service.get_stock_chart(ticker=ticker, range_period=range_period, interval=interval)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=f"[{ticker}] 차트를 찾을 수 없습니다: {ve}")
    except httpx.HTTPStatusError as he:
        if he.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"[{ticker}] Yahoo Finance에서 종목 차트를 찾을 수 없습니다.")
        raise HTTPException(status_code=502, detail=f"[{ticker}] 차트 데이터 조회 실패: {he}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"[{ticker}] 차트 데이터 조회 실패: {e}")


@router.get("/logo/{ticker}", response_model=TickerLogoResponse, summary="티커별 로고 URL 조회 (Supabase 캐시 + Toss 폴백)")
async def get_ticker_logo(ticker: str):
    normalized_ticker = ticker.strip().upper()
    if not normalized_ticker:
        raise HTTPException(status_code=400, detail="유효한 ticker가 필요합니다.")

    try:
        service = TickerLogoService()
        logo_image_url, source = await service.resolve_logo(normalized_ticker)
        return TickerLogoResponse(
            ticker=normalized_ticker,
            logo_image_url=logo_image_url,
            source=source,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"[{normalized_ticker}] 로고 조회 실패: {e}")


@router.post(
    "/logos",
    response_model=TickerLogoBatchResponse,
    summary="여러 티커 로고 URL 조회 (Supabase 캐시 + Toss 폴백)",
)
async def get_ticker_logos(req: TickerLogoBatchRequest):
    if not req.tickers:
        return TickerLogoBatchResponse(items=[])

    try:
        service = TickerLogoService()
        results = await service.resolve_logos(req.tickers, max_count=req.max_count)
        return TickerLogoBatchResponse(
            items=[
                TickerLogoResponse(
                    ticker=ticker,
                    logo_image_url=logo_image_url,
                    source=source,
                )
                for ticker, logo_image_url, source in results
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"로고 일괄 조회 실패: {e}")
