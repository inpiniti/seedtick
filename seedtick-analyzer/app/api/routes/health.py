"""
Health check route
"""
from datetime import datetime
from fastapi import APIRouter
from app.config.settings import settings
from app.domains.scheduler.market_guard import MarketCalendarGuard

router = APIRouter(tags=["health"])


@router.get("/health", summary="서버 상태 및 미장 개장 여부 조회")
async def health_check():
    guard = MarketCalendarGuard()
    is_open, reason = guard.is_market_open()

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "env": settings.ENV,
        "dry_run": settings.DRY_RUN,
        "default_broker": settings.DEFAULT_BROKER,
        "us_market_today": {
            "is_open": is_open,
            "status_text": reason,
        },
    }
