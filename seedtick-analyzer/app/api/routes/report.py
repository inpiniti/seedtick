"""
Report API Route
"""
import logging
from fastapi import APIRouter, HTTPException, Query
from app.domains.report.datapack_builder import DataPackBuilder
from app.domains.report.models import FinalMasterReport, StockDataPack
from app.domains.report.service import GuruReportService

logger = logging.getLogger("report_route")
router = APIRouter(prefix="/api/report", tags=["report"])


@router.post("/generate", response_model=FinalMasterReport, summary="13인 거장 5단계 리포트 생성")
async def generate_report(
    ticker: str = Query(..., description="미국 주식 티커 (예: NVDA, AAPL)"),
    date: str | None = Query(None, description="기준 일자 (YYYY-MM-DD, 기본: 오늘)"),
):
    try:
        service = GuruReportService()
        return await service.generate_full_report(ticker, date)
    except Exception as e:
        logger.exception(f"리포트 생성 실패 ({ticker}): {e}")
        raise HTTPException(status_code=500, detail=f"리포트 생성 실패 ({ticker}): {e}")


@router.get("/datapack/{ticker}", response_model=StockDataPack, summary="종목 공용 심층 데이터팩 단독 생성")
async def get_datapack(
    ticker: str,
    date: str | None = Query(None, description="기준 일자 (YYYY-MM-DD, 기본: 오늘)"),
):
    try:
        builder = DataPackBuilder()
        return await builder.build(ticker, date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터팩 생성 실패 ({ticker}): {e}")
