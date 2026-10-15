"""
Error-Log 도메인 및 SupabaseLogHandler 단위 테스트
"""
import logging
import time
from unittest.mock import MagicMock
import pytest
from app.domains.error_log.handlers import SupabaseLogHandler, IGNORED_LOGGER_PREFIXES
from app.domains.error_log.models import LogEvent, AlertLevel
from app.domains.error_log.service import ErrorLogService


@pytest.mark.asyncio
async def test_error_log_service_save():
    mock_repo = MagicMock()
    mock_repo.is_connected.return_value = True

    async def mock_save_log(**kwargs):
        return True

    mock_repo.save_log = mock_save_log

    service = ErrorLogService(repo=mock_repo)

    res_info = await service.info(code="TEST_INFO", message="정상 안내 메시지", context={"key": "val"})
    assert res_info is True

    res_warn = await service.warning(code="TEST_WARN", message="주의 메시지")
    assert res_warn is True

    res_err = await service.error(code="TEST_ERR", message="에러 발생", context={"ticker": "NVDA"})
    assert res_err is True

    res_crit = await service.critical(code="TEST_CRIT", message="치명적 에러")
    assert res_crit is True


def test_supabase_log_handler_filtering_and_emit():
    mock_repo = MagicMock()
    mock_repo.is_connected.return_value = True
    saved_batches = []

    def mock_save_logs_batch_sync(batch):
        saved_batches.extend(batch)
        return True

    mock_repo.save_logs_batch_sync = mock_save_logs_batch_sync

    handler = SupabaseLogHandler(
        repo=mock_repo,
        batch_size=2,
        flush_interval_sec=0.1,
    )

    test_logger = logging.getLogger("test_domain_logger")
    test_logger.addHandler(handler)
    test_logger.setLevel(logging.INFO)

    # 1. 일반 로그 발생
    test_logger.info("테스트 정보 로그", extra={"code": "TEST_EVENT", "ticker": "AAPL"})
    test_logger.error("테스트 에러 로그", extra={"code": "ORDER_FAIL"})

    # 2. 내부 네트워크 라이브러리 로거 (필터링되어야 함)
    httpx_logger = logging.getLogger("httpx")
    httpx_logger.addHandler(handler)
    httpx_logger.info("HTTP Request: POST https://supabase.co/...")

    supabase_logger = logging.getLogger("supabase.client")
    supabase_logger.addHandler(handler)
    supabase_logger.info("Supabase executed query")

    # flush 및 대기
    time.sleep(0.3)
    handler.flush()
    handler.close()

    # 내부 라이브러리 로그는 제외되고 2개만 저장되어야 함
    assert len(saved_batches) == 2
    assert saved_batches[0]["level"] == "INFO"
    assert saved_batches[0]["message"] == "테스트 정보 로그"
    assert saved_batches[0]["code"] == "TEST_EVENT"
    assert saved_batches[0]["context"]["ticker"] == "AAPL"

    assert saved_batches[1]["level"] == "ERROR"
    assert saved_batches[1]["message"] == "테스트 에러 로그"
    assert saved_batches[1]["code"] == "ORDER_FAIL"


def test_log_event_model():
    event = LogEvent(
        level="WARNING",
        code="SCREENER_EMPTY",
        message="스크리닝 결과 0건",
        context={"count": 0},
    )
    assert event.level == AlertLevel.WARNING
    assert event.code == "SCREENER_EMPTY"
    assert event.context["count"] == 0
