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
from app.api.routes.debug_ai import router as debug_ai_router
from app.api.routes.debug_yahoo import router as debug_yahoo_router
from app.config.settings import settings
from app.domains.error_log.handlers import SupabaseLogHandler
from app.domains.screener.logo_warmup_service import logo_warmup_service
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
    for _noisy in ("httpx", "httpcore", "supabase_repo", "yfinance"):
        logging.getLogger(_noisy).setLevel(logging.CRITICAL if _noisy == "yfinance" else logging.WARNING)

# Supabase error_logs 테이블 자동 적재 핸들러 등록 (INFO, WARNING, ERROR, CRITICAL)
supabase_log_handler = SupabaseLogHandler()
supabase_log_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logging.getLogger().addHandler(supabase_log_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 수명 주기 관리 (스케줄러 시작 및 종료)"""
    logger.info("🚀 SeedTick Analyzer 시작 중...")
    scheduler_service.start()
    await logo_warmup_service.start()
    yield
    logger.info("🛑 SeedTick Analyzer 종료 중...")
    scheduler_service.shutdown()
    await logo_warmup_service.stop()
    supabase_log_handler.close()


app = FastAPI(
    title="SeedTick Analyzer",
    description="미국 주식 13인 거장 심층 분석 · 일일 배치 스케줄러 서버",
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
app.include_router(screener_router)
app.include_router(report_router)
app.include_router(scheduler_router)
app.include_router(debug_ai_router)
app.include_router(debug_yahoo_router)



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
