"""
일일 배치 파이프라인 잡 (daily_pipeline_job)
"""
import asyncio
import logging
from datetime import date as dt_date
from pathlib import Path
from app.config.settings import settings
from app.domains.error_log.notifiers.discord import DiscordNotifier
from app.domains.report.pipeline_progress import pipeline_progress
from app.domains.report.service import GuruReportService
from app.domains.scheduler.market_guard import MarketCalendarGuard
from app.domains.screener.roma_service import RomaScreenerService
from app.domains.screener.service import ScreenerService
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("scheduler_jobs")

_pipeline_lock = asyncio.Lock()


async def daily_pipeline_job(
    dry_run: bool | None = None,
    force: bool = False,
    max_analyze_count: int | None = None,
    skip_already_reported: bool = True,
) -> dict:
    """
    일일 스크리닝 → 13인 분석 파이프라인 전체 실행 래퍼.

    - 중복 실행 락을 획득한 뒤 메모리 진행 추적기(pipeline_progress)를 "실행중"으로 등록합니다.
    - 관리자 화면은 GET /api/scheduler/progress 를 폴링하여 실시간 진행률을 표시합니다.
    - skip_already_reported: True인 경우 오늘 이미 guru_reports에 등록된 종목은 제외하고 분석
    """
    if _pipeline_lock.locked():
        logger.warning("[Scheduler] 이미 일일 파이프라인이 실행 중입니다. 중복 실행 차단.")
        return {"status": "skipped", "reason": "already_running"}

    async with _pipeline_lock:
        today_str = dt_date.today().isoformat()
        pipeline_progress.start(date=today_str, triggered_by="manual")
        try:
            result = await _run_daily_pipeline(
                dry_run=dry_run,
                force=force,
                max_analyze_count=max_analyze_count,
                skip_already_reported=skip_already_reported,
            )
        except Exception as e:
            logger.exception(f"[Scheduler] 일일 파이프라인 예외 발생: {e}")
            pipeline_progress.finish("failed", error=str(e))
            raise
        pipeline_progress.finish(
            "completed" if result.get("status") == "success" else "skipped",
            summary=result,
        )
        return result


async def _run_daily_pipeline(
    dry_run: bool | None = None,
    force: bool = False,
    max_analyze_count: int | None = None,
    skip_already_reported: bool = True,
) -> dict:
    today = dt_date.today()
    today_str = today.isoformat()
    logger.info(f"========== [SeedTick 일일 파이프라인 시작: {today_str}] ==========")

    market_guard = MarketCalendarGuard()
    notifier = DiscordNotifier()

    # ── 1. 휴장일 및 주말 가드 검사 ──────────────────────
    pipeline_progress.set_stage("screening")
    is_open, reason = market_guard.is_market_open(today)
    if not is_open and not force:
        logger.info(f"[Scheduler] 파이프라인 스킵 사유: {reason}")
        pipeline_progress.log(f"파이프라인 스킵: {reason}")
        await notifier.notify_holiday_skip(reason)
        return {"status": "skipped", "reason": reason}

    if force:
        logger.info("[Scheduler] force=True 플래그로 인해 휴장일 가드를 우회하여 강제 실행합니다.")

    # ── 2. 스크리너 실행 (토스 공통/해외 200) ──────────────
    screener_service = ScreenerService()
    screen_result = await screener_service.get_stock_list()
    logger.info(f"[Scheduler] 스크리닝 통과 종목: 총 {screen_result.count}개")

    # ── 2-0. 두번째 스크리너(DataRoma) 병합 (중복 티커 제거) ─────
    # - 토스 스크리너 통과 종목을 1순위로 유지하고, roma 전용 종목만 뒤에 추가
    # - 이미 토스에 있는 종목은 screeners 라벨에 'roma'만 병합 (분석 중복 없음)
    ticker_screeners_map: dict[str, list[str]] = {
        item.ticker: list(item.screeners) for item in screen_result.tickers
    }
    ordered_tickers: list[str] = [item.ticker for item in screen_result.tickers]
    roma_count = 0
    roma_added_count = 0
    try:
        roma_result = await RomaScreenerService().get_stock_list()
        roma_count = roma_result.count
        for item in roma_result.items:
            ticker = item.ticker
            if ticker in ticker_screeners_map:
                if "roma" not in ticker_screeners_map[ticker]:
                    ticker_screeners_map[ticker].append("roma")
                continue
            ticker_screeners_map[ticker] = list(item.screeners)
            ordered_tickers.append(ticker)
            roma_added_count += 1
        logger.info(
            f"[Scheduler] DataRoma 병합 완료: 보유 종목 {roma_count}개 "
            f"(신규 편입 {roma_added_count}개, 최종 대상 {len(ordered_tickers)}개)"
        )
    except Exception as e:
        logger.warning(f"[Scheduler] DataRoma 스크리너 조회 실패 (토스 스크리닝만 진행): {e}")

    # 분석 대상 종목 선정 (기본 0 또는 None이면 전체 무제한 정밀 분석)
    limit = max_analyze_count if max_analyze_count is not None else settings.MAX_ANALYZE_COUNT
    if limit and limit > 0:
        target_tickers = ordered_tickers[:limit]
        logger.info(f"[Scheduler] 정밀 분석 대상 상위 종목 ({len(target_tickers)}/{len(ordered_tickers)}개): {target_tickers}")
    else:
        target_tickers = ordered_tickers
        logger.info(f"[Scheduler] 정밀 분석 대상 전체 종목 (무제한 {len(target_tickers)}개): {target_tickers}")

    # ── 2-1. 오늘 이미 리포트 등록된 종목 제외 ─────────────────
    skipped_tickers: list[str] = []
    if skip_already_reported:
        already_reported = supabase_repo.get_reported_tickers_for_date(today_str)
        # 로컬 파일 시스템 마크다운 보고서 보조 확인
        local_report_dir = Path("docs/report") / today_str / "최종"
        if local_report_dir.exists():
            for f in local_report_dir.glob("*_최종보고서.md"):
                already_reported.add(f.name.replace("_최종보고서.md", "").upper().strip())

        remaining_tickers = [t for t in target_tickers if t.upper().strip() not in already_reported]
        skipped_tickers = [t for t in target_tickers if t.upper().strip() in already_reported]
        if skipped_tickers:
            logger.info(
                f"[Scheduler] 오늘({today_str}) 이미 리포트가 등록된 {len(skipped_tickers)}개 종목 제외: {skipped_tickers}"
            )
        target_tickers = remaining_tickers
        logger.info(f"[Scheduler] 제외 후 최종 분석 대상 종목 ({len(target_tickers)}개): {target_tickers}")

    # 진행 추적기에 분석 대상 등록 (화면의 "n/총" 분모가 됨)
    pipeline_progress.set_targets(target_tickers)

    # ── 3. 종목별 5단계 Guru-Report 실행 ──────────────────
    report_service = GuruReportService(progress=pipeline_progress)
    generated_reports = []

    for ticker in target_tickers:
        pipeline_progress.begin_ticker(ticker)
        try:
            screeners = ticker_screeners_map.get(ticker)
            report = await report_service.generate_full_report(
                ticker, today_str, screeners=screeners
            )
            generated_reports.append(report)
            pipeline_progress.complete_ticker(
                ticker, verdict=report.overall_verdict
            )
        except Exception as e:
            logger.error(f"[Scheduler] {ticker} 분석 리포트 실패: {e}")
            pipeline_progress.complete_ticker(ticker, failed=True)

    # ── 4. 자동매매 주문 실행 (기존 리포트 자동매매 폐기: 수동 등록 기반 그리드로 전환됨) ──
    logger.info("[Scheduler] 기존 리포트 자동매매는 폐기되었습니다. (그리드 수동 등록 체계 운용)")

    # ── 5. Discord 결과 알림 ──────────────────────────────
    await notifier.notify_pipeline_summary(
        date_str=today_str,
        screened_count=len(ordered_tickers),
        reported_count=len(generated_reports),
        orders=[],
    )

    logger.info("========== [SeedTick 일일 파이프라인 정상 완료] ==========")
    return {
        "status": "success",
        "date": today_str,
        "screened_count": len(ordered_tickers),
        "toss_screened_count": screen_result.count,
        "roma_screened_count": roma_count,
        "roma_added_count": roma_added_count,
        "reported_count": len(generated_reports),
        "skipped_already_reported_count": len(skipped_tickers),
        "skipped_already_reported_tickers": skipped_tickers,
        "orders_count": 0,
    }


async def cleanup_old_logs_job(hours: int = 24) -> dict:
    """
    일일 만료 시스템 로그 정리 잡:
    - 12:00 메인 파이프라인 1시간 전(오전 11:00 KST) 실행
    - 24시간 이전의 INFO 레벨 로그만 선별 삭제하여 DB 용량 절약
    - WARNING, ERROR, CRITICAL 로그는 보존
    """
    logger.info("========== [일일 만료 시스템 로그 정리 잡 시작] ==========")
    from app.infrastructure.supabase_repo import supabase_repo

    deleted_count = supabase_repo.delete_old_info_logs(hours=hours)
    logger.info(f"[Scheduler] {hours}시간 이전 INFO 시스템 로그 정리 완료: 총 {deleted_count}건 삭제")
    logger.info("========== [일일 만료 시스템 로그 정리 잡 종료] ==========")
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "hours": hours,
    }


async def reset_model_rotation_job() -> dict:
    """
    AI 모델 순위 초기화 잡: 매일 00:00 KST 실행.

    1순위 모델(nvidia/nemotron-3-ultra-550b-a55b:free)은 프로바이더 과부하가
    심야/자정 지나면 자연 복구되는 패턴이므로, 하루가 바뀌는 시점에 1순위로 되돌린다.
    서버 재시작 시에도 프로세스 상태라서 1순위로 초기화된다.
    """
    from app.domains.report.model_rotation import model_rotation

    before = model_rotation.snapshot()
    active = model_rotation.reset("일일 초기화 (KST 00:00)")
    after = model_rotation.snapshot()

    logger.info(f"[Scheduler] AI 모델 순위 초기화 완료: {active}")
    return {
        "status": "success",
        "previous_model": before["active_model"],
        "active_model": active,
        "chain": after["chain"],
        "switch_count": after["switch_count"],
    }