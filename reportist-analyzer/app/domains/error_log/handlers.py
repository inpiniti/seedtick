"""
Supabase 통합 로깅 핸들러 (SupabaseLogHandler)
- Python 표준 logging과 연동하여 INFO, WARNING, ERROR, CRITICAL 로그를 error_logs 테이블에 자동 적재
- 내부 HTTP 통신 라이브러리의 무한 루프 호출 방지 필터링
- 백그라운드 비차단(non-blocking) 큐 및 배치 워커 스레드 적용
"""
import atexit
import logging
import queue
import threading
import time
import traceback
from typing import Any
from app.infrastructure.supabase_repo import supabase_repo, SupabaseRepo

# 무한 루프 방지를 위해 Supabase 저장을 건너뛸 내부 라이브러리 로거 접두사
IGNORED_LOGGER_PREFIXES = (
    "httpx",
    "httpcore",
    "supabase",
    "postgrest",
    "urllib3",
    "asyncio",
    "hpack",
)


class SupabaseLogHandler(logging.Handler):
    def __init__(
        self,
        repo: SupabaseRepo | None = None,
        batch_size: int = 10,
        flush_interval_sec: float = 1.0,
        max_queue_size: int = 5000,
    ):
        super().__init__()
        self.repo = repo or supabase_repo
        self.batch_size = batch_size
        self.flush_interval_sec = flush_interval_sec
        self._queue: queue.Queue = queue.Queue(maxsize=max_queue_size)
        self._stop_event = threading.Event()

        # 백그라운드 워커 스레드 시작
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name="SupabaseLogWorker",
            daemon=True,
        )
        self._worker_thread.start()
        atexit.register(self.close)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            # 1. 무한 루프 방지: HTTP/Supabase 내부 통신 로거는 제외
            if any(record.name.startswith(prefix) for prefix in IGNORED_LOGGER_PREFIXES):
                return

            # 2. 메시지 및 예외 트레이스백 포맷팅
            message = self.format(record) if self.formatter else record.getMessage()
            context: dict[str, Any] = {
                "pathname": record.pathname,
                "lineno": record.lineno,
                "funcName": record.funcName,
            }

            if record.exc_info:
                context["traceback"] = "".join(traceback.format_exception(*record.exc_info))

            # extra 필드 추출 (표준 필드가 아닌 사용자 전달 dict)
            for k, v in record.__dict__.items():
                if k not in (
                    "args", "asctime", "created", "exc_info", "exc_text", "filename",
                    "funcName", "levelname", "levelno", "lineno", "module", "msecs",
                    "message", "msg", "name", "pathname", "process", "processName",
                    "relativeCreated", "stack_info", "thread", "threadName", "taskName",
                ):
                    try:
                        context[k] = v
                    except Exception:
                        pass

            # code 식별 (extra에 'code'가 있으면 사용, 없으면 level 기본값)
            code = getattr(record, "code", "LOG")

            log_entry = {
                "level": record.levelname,
                "logger_name": record.name,
                "code": str(code),
                "message": message,
                "context": context,
            }

            # 3. 큐에 적재 (큐 가득 참 시 예외 없이 드롭하여 메인 스레드 보호)
            try:
                self._queue.put_nowait(log_entry)
            except queue.Full:
                pass
        except Exception:
            self.handleError(record)

    def _worker_loop(self) -> None:
        """백그라운드에서 큐의 로그를 배치로 꺼내 Supabase에 저장"""
        batch: list[dict] = []
        last_flush = time.time()

        while not self._stop_event.is_set():
            try:
                # 0.5초 타임아웃으로 항목 대기
                item = self._queue.get(timeout=0.5)
                batch.append(item)
                self._queue.task_done()
            except queue.Empty:
                pass

            now = time.time()
            is_time_to_flush = (now - last_flush) >= self.flush_interval_sec
            is_batch_full = len(batch) >= self.batch_size

            if batch and (is_batch_full or is_time_to_flush):
                self._flush_batch(batch)
                batch = []
                last_flush = now

        # 루프 종료 후 남아있는 항목 최종 저장
        while not self._queue.empty():
            try:
                item = self._queue.get_nowait()
                batch.append(item)
                self._queue.task_done()
            except queue.Empty:
                break
        if batch:
            self._flush_batch(batch)

    def _flush_batch(self, batch: list[dict]) -> None:
        if not batch or not self.repo or not self.repo.is_connected():
            return
        try:
            self.repo.save_logs_batch_sync(batch)
        except Exception:
            pass

    def flush(self) -> None:
        """현재 큐가 비워질 때까지 대기"""
        try:
            self._queue.join()
        except Exception:
            pass

    def close(self) -> None:
        """핸들러 종료 시 잔여 로그 flush 및 스레드 정리"""
        self._stop_event.set()
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
        super().close()
