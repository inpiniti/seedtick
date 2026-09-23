"""
일일 배치 파이프라인 잡 (daily_pipeline_job)
"""
import asyncio
import logging
from datetime import date as dt_date
from app.domains.auto_trading.service import AutoTradingService
from app.domains.error_log.notifiers.discord import DiscordNotifier
from app.domains.report.service import GuruReportService
from app.domains.scheduler.market_guard import MarketCalendarGuard
from app.domains.screener.service import ScreenerService

logger = logging.getLogger("scheduler_jobs")

_pipeline_lock = asyncio.Lock()


async def daily_pipeline_job(
    dry_run: bool | None = None,
    force: bool = False,
    max_analyze_count: int = 5,
) -> dict:
    """
    일일 스크리닝 → 13인 분석 → 자동매매 파이프라인 전체 실행
    """
    if _pipeline_lock.locked():
        logger.warning("[Scheduler] 이미 일일 파이프라인이 실행 중입니다. 중복 실행 차단.")
        return {"status": "skipped", "reason": "already_running"}

    async with _pipeline_lock:
        today = dt_date.today()
        today_str = today.isoformat()
        logger.info(f"========== [SeedTick 일일 파이프라인 시작: {today_str}] ==========")

        market_guard = MarketCalendarGuard()
        notifier = DiscordNotifier()

        # ── 1. 휴장일 및 주말 가드 검사 ──────────────────────
        is_open, reason = market_guard.is_market_open(today)
        if not is_open and not force:
            logger.info(f"[Scheduler] 파이프라인 스킵 사유: {reason}")
            await notifier.notify_holiday_skip(reason)
            return {"status": "skipped", "reason": reason}

        if force:
            logger.info("[Scheduler] force=True 플래그로 인해 휴장일 가드를 우회하여 강제 실행합니다.")

        # ── 2. 스크리너 실행 (토스 공통/해외 200) ──────────────
        screener_service = ScreenerService()
        screen_result = await screener_service.get_stock_list()
        logger.info(f"[Scheduler] 스크리닝 통과 종목: 총 {screen_result.count}개")

        # 상위 종목 선정 (기본 최대 5개 정밀 분석)
        target_tickers = [item.ticker for item in screen_result.tickers[:max_analyze_count]]
        logger.info(f"[Scheduler] 정밀 분석 대상 상위 종목: {target_tickers}")

        # ── 3. 종목별 5단계 Guru-Report 실행 ──────────────────
        report_service = GuruReportService()
        generated_reports = []

        for ticker in target_tickers:
            try:
                report = await report_service.generate_full_report(ticker, today_str)
                generated_reports.append(report)
            except Exception as e:
                logger.error(f"[Scheduler] {ticker} 분석 리포트 실패: {e}")

        # ── 4. 자동매매 주문 실행 ─────────────────────────────
        trading_service = AutoTradingService()
        orders = await trading_service.execute_from_reports(
            generated_reports, dry_run=dry_run
        )

        # ── 5. Discord 결과 알림 ──────────────────────────────
        await notifier.notify_pipeline_summary(
            date_str=today_str,
            screened_count=screen_result.count,
            reported_count=len(generated_reports),
            orders=orders,
        )

        logger.info("========== [SeedTick 일일 파이프라인 정상 완료] ==========")
        return {
            "status": "success",
            "date": today_str,
            "screened_count": screen_result.count,
            "reported_count": len(generated_reports),
            "orders_count": len(orders),
        }
