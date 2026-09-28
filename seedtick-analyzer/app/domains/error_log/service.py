"""
ErrorLogService: 구조화된 이벤트 및 에러를 기록하고 Supabase error_logs 테이블에 적재하는 서비스
"""
import logging
from typing import Any
from app.infrastructure.supabase_repo import supabase_repo, SupabaseRepo
from app.domains.error_log.models import LogEvent, AlertLevel

logger = logging.getLogger("error_log_service")


class ErrorLogService:
    def __init__(self, repo: SupabaseRepo | None = None):
        self.repo = repo or supabase_repo

    async def log(
        self,
        level: str,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
        logger_name: str | None = None,
    ) -> bool:
        """이벤트/에러를 Supabase error_logs 테이블에 적재하고 파이썬 로거에 기록"""
        level_upper = level.upper()
        ctx = context or {}
        name = logger_name or "error_log_service"

        # 1. 파이썬 로거에도 전달 (콘솔 출력 유지)
        log_level_no = getattr(logging, level_upper, logging.INFO)
        logger.log(log_level_no, f"[{code}] {message}", extra={"code": code, "context": ctx, "logger_name": name})

        # 2. Supabase DB 저장
        return await self.repo.save_log(
            level=level_upper,
            message=message,
            code=code,
            context=ctx,
            logger_name=name,
        )

    async def info(
        self,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
        logger_name: str | None = None,
    ) -> bool:
        return await self.log(
            level=AlertLevel.INFO,
            code=code,
            message=message,
            context=context,
            logger_name=logger_name,
        )

    async def warning(
        self,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
        logger_name: str | None = None,
    ) -> bool:
        return await self.log(
            level=AlertLevel.WARNING,
            code=code,
            message=message,
            context=context,
            logger_name=logger_name,
        )

    async def error(
        self,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
        logger_name: str | None = None,
    ) -> bool:
        return await self.log(
            level=AlertLevel.ERROR,
            code=code,
            message=message,
            context=context,
            logger_name=logger_name,
        )

    async def critical(
        self,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
        logger_name: str | None = None,
    ) -> bool:
        return await self.log(
            level=AlertLevel.CRITICAL,
            code=code,
            message=message,
            context=context,
            logger_name=logger_name,
        )


error_log_service = ErrorLogService()
