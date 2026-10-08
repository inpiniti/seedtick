"""
Health check route
"""
from datetime import datetime
from fastapi import APIRouter
from app.config.settings import settings
from app.domains.scheduler.market_guard import MarketCalendarGuard

router = APIRouter(tags=["health"])


@router.get("/health", summary="서버 상태 및 한/미 증시 개장 여부 조회")
async def health_check():
    guard = MarketCalendarGuard()
    us_is_open, us_reason = guard.is_us_market_open()
    kr_is_open, kr_reason = guard.is_kr_market_open()

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "env": settings.ENV,
        "dry_run": settings.DRY_RUN,
        "default_broker": settings.DEFAULT_BROKER,
        "us_market_today": {
            "is_open": us_is_open,
            "status_text": us_reason,
        },
        "kr_market_today": {
            "is_open": kr_is_open,
            "status_text": kr_reason,
        },
    }

