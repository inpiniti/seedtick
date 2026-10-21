import asyncio
from datetime import date as dt_date
import logging
from fastapi import APIRouter, HTTPException, Query
from app.domains.report.datapack_builder import DataPackBuilder
from app.domains.report.models import FinalMasterReport, StockDataPack
from app.domains.report.ondemand_tracker import ondemand_manager
from app.domains.report.service import GuruReportService
from app.domains.scheduler.coordinator import pipeline_coordinator
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("report_route")
router = APIRouter(prefix="/api/report", tags=["report"])


@router.post("/generate", response_model=FinalMasterReport, summary="13인 거장 4단계 리포트 생성")
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


@router.post("/ondemand/request", summary="온디맨드 즉시 13인 거장 AI 심층 분석 요청")
async def request_ondemand_report(
    ticker: str = Query(..., description="티커 심볼 (예: 079550, LMT, NVDA)"),
    force: bool = Query(False, description="이미 리포트가 있어도 강제 재분석"),
):
    """
    온디맨드 즉시 AI 분석 요청:
    - 일일 배치가 돌고 있으면 일시정지시키고 이 종목을 최우선으로 분석합니다.
    - 백그라운드 태스크로 실행되며 즉시 시작 상태와 트래커 스냅샷을 반환합니다.
    """
    clean_ticker = ticker.upper().strip()
    today_str = dt_date.today().isoformat()

    # 1. 오늘 이미 작성된 보고서가 있는지 확인
    if not force:
        try:
            reported = supabase_repo.get_reported_tickers_for_date(today_str)
            if clean_ticker in reported:
                return {
                    "status": "already_completed",
                    "ticker": clean_ticker,
                    "already_completed": True,
                    "message": f"[{clean_ticker}] 이미 오늘 발행된 최신 분석 보고서가 존재합니다.",
                }
        except Exception as e:
            logger.warning(f"기존 보고서 확인 중 경미한 에러: {e}")

    # 2. 이미 실행 중인지 확인
    existing_tracker = ondemand_manager.get(clean_ticker)
    if existing_tracker and existing_tracker._status == "running":
        return {
            "status": "running",
            "ticker": clean_ticker,
            "message": f"[{clean_ticker}] 이미 13인 거장 AI 분석이 진행 중입니다.",
            "progress": existing_tracker.snapshot(),
        }

    # 3. 신규 트래커 생성 및 백그라운드 태스크 시작
    tracker = ondemand_manager.get_or_create(clean_ticker)
    tracker.start()

    async def _run_ondemand_task():
        async with pipeline_coordinator.ondemand_scope(clean_ticker):
            try:
                service = GuruReportService(progress=tracker)
                report = await service.generate_full_report(clean_ticker, today_str)
                verdict = getattr(report, "overall_verdict", None)
                score = getattr(report, "overall_score", None)
                tracker.finish(verdict=verdict, overall_score=score)
                logger.info(
                    f"✅ [OnDemand] [{clean_ticker}] 분석 완료! (판정: {verdict}, 점수: {score})"
                )
            except Exception as err:
                logger.exception(f"❌ [OnDemand] [{clean_ticker}] 분석 실패: {err}")
                tracker.finish(error=str(err))

    asyncio.create_task(_run_ondemand_task())

    return {
        "status": "started",
        "ticker": clean_ticker,
        "message": f"[{clean_ticker}] 13인 거장 AI 분석이 백그라운드에서 시작되었습니다.",
        "progress": tracker.snapshot(),
    }


@router.get("/ondemand/{ticker}/progress", summary="온디맨드 종목 분석 실시간 진행 상태 조회")
async def get_ondemand_progress(ticker: str):
    """
    온디맨드 분석 진행 상태 조회:
    진행 단계, 진행률(%), 13인 거장 채점 카운트, 경과 시간 등을 반환합니다.
    """
    clean_ticker = ticker.upper().strip()
    tracker = ondemand_manager.get(clean_ticker)
    if not tracker:
        return {
            "ticker": clean_ticker,
            "status": "idle",
            "message": f"[{clean_ticker}] 진행 중인 온디맨드 분석 요청이 없습니다.",
            "progress_percent": 0,
        }
    return tracker.snapshot()

