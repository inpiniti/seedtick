"""
Screener API Route
"""
from fastapi import APIRouter, HTTPException, Query
from app.domains.screener.models import ScreenCriteria, ScreenResult
from app.domains.screener.service import ScreenerService

router = APIRouter(prefix="/api/screener", tags=["screener"])


@router.get("/run", response_model=ScreenResult, summary="토스 공통/해외 스크리너 실행")
async def run_screener(
    preset: str = Query("공통", description="거장 프리셋 (기본: 공통)"),
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
