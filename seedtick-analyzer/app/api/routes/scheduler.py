"""
Scheduler API Route
"""
from fastapi import APIRouter, HTTPException, Query
from app.domains.scheduler.service import scheduler_service

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.post("/trigger", summary="일일 파이프라인 수동 즉시 트리거 (백그라운드 실행)")
async def trigger_pipeline(
    dry_run: bool | None = Query(None, description="Dry-run 모드 여부 (미입력 시 설정값 사용)"),
    force: bool = Query(False, description="휴장일/주말 가드를 우회하여 강제 실행"),
    market: str = Query("all", description="분석 대상 시장 ('us', 'kr', 'all')"),
    max_count: int | None = Query(
        None, ge=0, description="정밀 분석할 종목 수 (0 또는 None 시 스크리닝 통과 전 종목 무제한 분석)"
    ),
    skip_already_reported: bool = Query(
        True, description="오늘 이미 리포트가 등록된 종목은 분석 대상에서 제외 (기본값: True)"
    ),
):
    """
    파이프라인을 백그라운드로 시작하고 즉시 응답합니다.
    진행 상황은 GET /api/scheduler/progress 를 폴링하여 확인합니다.
    """
    try:
        return scheduler_service.start_pipeline_background(
            dry_run=dry_run,
            force=force,
            market=market,
            max_count=max_count,
            skip_already_reported=skip_already_reported,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파이프라인 실행 오류: {e}")



@router.get("/progress", summary="13인 거장 파이프라인 실시간 진행 상태 조회")
async def get_pipeline_progress():
    """
    관리자 화면(seedtick-admin)이 주기적으로 폴링하여
    현재 단계, 종목 진행률(n/총), 13인 요약 진행률(n/13), 경과 시간을 표시합니다.
    """
    return scheduler_service.get_pipeline_progress()


@router.post("/cleanup-logs", summary="만료 시스템 로그 수동 즉시 정리")
async def cleanup_logs(
    hours: int = Query(24, ge=1, le=720, description="정리할 이전 시간 기준 (기본 24시간)"),
):
    """지정된 시간(기본 24시간) 이전의 INFO 레벨 시스템 로그를 삭제하여 DB 용량을 최적화합니다."""
    try:
        result = await scheduler_service.trigger_log_cleanup(hours=hours)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그 정리 실행 오류: {e}")

