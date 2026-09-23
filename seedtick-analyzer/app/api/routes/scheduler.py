"""
Scheduler API Route
"""
from fastapi import APIRouter, HTTPException, Query
from app.domains.scheduler.service import scheduler_service

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.post("/trigger", summary="일일 파이프라인 수동 즉시 트리거")
async def trigger_pipeline(
    dry_run: bool | None = Query(None, description="Dry-run 모드 여부 (미입력 시 설정값 사용)"),
    force: bool = Query(False, description="휴장일/주말 가드를 우회하여 강제 실행"),
    max_count: int = Query(5, ge=1, le=50, description="정밀 분석할 상위 종목 수"),
):
    try:
        result = await scheduler_service.trigger_pipeline(
            dry_run=dry_run, force=force, max_count=max_count
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파이프라인 실행 오류: {e}")
