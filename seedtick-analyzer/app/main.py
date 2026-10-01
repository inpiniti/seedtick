"""
SeedTick Analyzer - 메인 FastAPI 애플리케이션 엔트리포인트
"""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.report import router as report_router
from app.api.routes.scheduler import router as scheduler_router
from app.api.routes.screener import router as screener_router
from app.api.routes.ip import router as ip_router
from app.api.routes.bridge import router as bridge_router
from app.api.routes.debug_ai import router as debug_ai_router
from app.api.routes.debug_yahoo import router as debug_yahoo_router
from app.api.routes.grid_trading import (
    router as grid_trading_router,
    ws_client,
    grid_service,
)
from app.config.settings import settings
from app.domains.error_log.handlers import SupabaseLogHandler
from app.domains.scheduler.service import scheduler_service

# 로깅 설정
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seedtick_analyzer")

# 성공적인 외부 HTTP 호출은 운영 로그에 불필요한 소음을 만듦.
# debug 모드일 때만 그대로 남기고, 그 외에는 WARNING 이상만 출력한다.
_root_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
if _root_level > logging.DEBUG:
    for _noisy in ("httpx", "httpcore", "supabase_repo"):
        logging.getLogger(_noisy).setLevel(logging.WARNING)

# Supabase error_logs 테이블 자동 적재 핸들러 등록 (INFO, WARNING, ERROR, CRITICAL)
supabase_log_handler = SupabaseLogHandler()
supabase_log_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logging.getLogger().addHandler(supabase_log_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 수명 주기 관리 (스케줄러, 실시간 그리드 WebSocket 시작 및 종료)"""
    logger.info("🚀 SeedTick Analyzer 시작 중...")
    scheduler_service.start()

    # 실시간 그리드 감지 WebSocket 시작 및 기존 활성 종목 등록
    if ws_client:
        try:
            active_items = grid_service.repo.get_active_grid_trades()
            active_tickers = [it.ticker for it in active_items]
            if active_tickers:
                await ws_client.set_subscribed_tickers(active_tickers)
                logger.info(f"[Lifespan] 기존 활성 그리드 종목 실시간 구독 등록: {active_tickers}")
            await ws_client.start()
        except Exception as e:
            logger.warning(f"[Lifespan] 그리드 WebSocket 시작 실패 (선택 기능): {e}")

    yield
    logger.info("🛑 SeedTick Analyzer 종료 중...")
    if ws_client:
        await ws_client.stop()
    scheduler_service.shutdown()
    supabase_log_handler.close()


app = FastAPI(
    title="SeedTick Analyzer",
    description="미국 주식 토스 공통 스크리닝 · 13인 거장 심층 분석 · 일일 배치 스케줄러 · 증권사 연동 자동매매 서버",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(health_router)
app.include_router(ip_router)
app.include_router(screener_router)
app.include_router(report_router)
app.include_router(scheduler_router)
app.include_router(bridge_router)
app.include_router(debug_ai_router)
app.include_router(debug_yahoo_router)
app.include_router(grid_trading_router)



@app.get("/", tags=["root"])
async def root():
    return {
        "service": "SeedTick Analyzer",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
