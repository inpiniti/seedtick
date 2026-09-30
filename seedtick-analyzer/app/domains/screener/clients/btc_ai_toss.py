"""
BTC-AI Backend Toss Screener API 클라이언트 (1차 스크리너 소스)
"""
import asyncio
import logging
from urllib.parse import quote
import httpx

from app.config.settings import settings

logger = logging.getLogger("btc_ai_toss_client")


class BtcAiTossClient:
    def __init__(self, base_url: str | None = None, timeout: float = 25.0):
        self.base_url = (base_url or settings.BTC_AI_TOSS_URL).rstrip("/")
        self.timeout = timeout

    async def get_guru_screener(
        self,
        guru: str = "공통",
        nation: str = "us",
        size: int = 200,
        page: int = 1,
        client: httpx.AsyncClient | None = None,
    ) -> dict:
        """
        GET /toss/{guru}?nation={nation}&size={size}&page={page}
        예: /toss/%EA%B3%B5%ED%86%B5?nation=us&size=200
        """
        encoded_guru = quote(guru)
        url = f"{self.base_url}/{encoded_guru}"
        params = {"nation": nation, "size": size, "page": page}

        headers = {
            "User-Agent": "seedtick-analyzer/0.1.0",
            "Accept": "application/json",
        }

        if client is not None:
            res = await client.get(url, params=params, headers=headers)
            res.raise_for_status()
            return res.json()

        async with httpx.AsyncClient(timeout=self.timeout) as ac:
            res = await ac.get(url, params=params, headers=headers)
            res.raise_for_status()
            return res.json()

    async def get_all_gurus_screeners(
        self,
        gurus: list[str],
        nation: str = "us",
        size: int = 200,
        page: int = 1,
    ) -> list[tuple[str, dict | Exception]]:
        """
        여러 거장 스크리너를 병렬로 동시 조회합니다.
        (gurus 리스트 순서대로 [(guru_key, data_or_exception), ...] 반환)
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            tasks = [
                self._fetch_single_safe(client, g, nation, size, page)
                for g in gurus
            ]
            results = await asyncio.gather(*tasks)
            return results

    async def _fetch_single_safe(
        self,
        client: httpx.AsyncClient,
        guru: str,
        nation: str,
        size: int,
        page: int,
    ) -> tuple[str, dict | Exception]:
        try:
            data = await self.get_guru_screener(
                guru=guru, nation=nation, size=size, page=page, client=client
            )
            return guru, data
        except Exception as e:
            logger.warning(f"[BtcAiTossClient] '{guru}' 스크리너 조회 실패: {e}")
            return guru, e
