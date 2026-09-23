from app.api.routes.health import router as health_router
from app.api.routes.screener import router as screener_router
from app.api.routes.report import router as report_router
from app.api.routes.scheduler import router as scheduler_router

__all__ = ["health_router", "screener_router", "report_router", "scheduler_router"]
