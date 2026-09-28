import logging
import pytest
import os
import sys

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture(autouse=True)
def suppress_supabase_log_handler():
    """테스트 실행 중 SupabaseLogHandler를 루트 로거에서 제거하여
    실제 Supabase DB로 테스트 로그가 전송되지 않도록 격리한다."""
    from app.domains.error_log.handlers import SupabaseLogHandler

    root_logger = logging.getLogger()
    removed: list[tuple[logging.Logger, logging.Handler]] = []

    # 루트 로거 및 모든 하위 로거에서 SupabaseLogHandler 수집 후 제거
    for name, lgr in list(logging.Logger.manager.loggerDict.items()):
        if not isinstance(lgr, logging.Logger):
            continue
        for handler in list(lgr.handlers):
            if isinstance(handler, SupabaseLogHandler):
                lgr.removeHandler(handler)
                removed.append((lgr, handler))

    for handler in list(root_logger.handlers):
        if isinstance(handler, SupabaseLogHandler):
            root_logger.removeHandler(handler)
            removed.append((root_logger, handler))

    yield

    # 테스트 종료 후 핸들러 복원
    for lgr, handler in removed:
        lgr.addHandler(handler)

