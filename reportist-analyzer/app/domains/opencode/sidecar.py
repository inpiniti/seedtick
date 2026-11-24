"""로컬 Bun 기반 OpenCode SDK 사이드카의 수명 주기 관리."""
import asyncio
import logging
import os
from pathlib import Path

from app.config.settings import settings

logger = logging.getLogger(__name__)


class OpenCodeSidecarManager:
    def __init__(self) -> None:
        self._process: asyncio.subprocess.Process | None = None
        self._watchdog: asyncio.Task | None = None
        self._stopping = False

    @property
    def running(self) -> bool:
        return self._process is not None and self._process.returncode is None

    @property
    def pid(self) -> int | None:
        return self._process.pid if self.running else None

    async def start(self) -> None:
        if not settings.OPENCODE_SHIM_ENABLED:
            logger.info("[OpenCodeSidecar] 비활성화됨")
            return
        if self.running:
            return
        self._stopping = False
        shim_dir = Path(__file__).resolve().parents[2] / "opencode-shim"
        if not (shim_dir / "src" / "server.ts").exists():
            logger.warning("[OpenCodeSidecar] 사이드카 소스가 없어 시작하지 않습니다: %s", shim_dir)
            return

        env = os.environ.copy()
        env["OPENCODE_SHIM_PORT"] = str(settings.OPENCODE_SHIM_PORT)
        if settings.AI_GATEWAY_SECRET:
            env["OPENCODE_SHIM_SECRET"] = settings.AI_GATEWAY_SECRET
        if not env.get("OPENCODE_API_KEY"):
            bootstrap = next((k.strip() for k in settings.OPENCODE_API_KEYS.split(",") if k.strip()), "")
            if bootstrap:
                env["OPENCODE_API_KEY"] = bootstrap

        self._process = await asyncio.create_subprocess_exec(
            settings.OPENCODE_SHIM_COMMAND,
            "src/server.ts",
            cwd=str(shim_dir),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        self._watchdog = asyncio.create_task(self._watch(), name="opencode-sidecar-watchdog")
        logger.info("[OpenCodeSidecar] 시작 pid=%s port=%s", self._process.pid, settings.OPENCODE_SHIM_PORT)

    async def _watch(self) -> None:
        process = self._process
        if process is None or process.stdout is None:
            return
        try:
            async for line in process.stdout:
                text = line.decode("utf-8", "replace").rstrip()
                if text:
                    logger.info("[OpenCodeSidecar] %s", text)
            code = await process.wait()
            if not self._stopping:
                logger.error("[OpenCodeSidecar] 프로세스 종료 code=%s", code)
        except asyncio.CancelledError:
            pass

    async def stop(self) -> None:
        self._stopping = True
        process = self._process
        if self._watchdog:
            self._watchdog.cancel()
            try:
                await self._watchdog
            except asyncio.CancelledError:
                pass
            self._watchdog = None
        if process is None or process.returncode is not None:
            return
        try:
            process.terminate()
            await asyncio.wait_for(process.wait(), timeout=10.0)
        except (TimeoutError, ProcessLookupError):
            process.kill()
            await process.wait()
        self._process = None
        logger.info("[OpenCodeSidecar] 종료")


opencode_sidecar = OpenCodeSidecarManager()
