"""
BTC-AI Backend Toss Screener API 클라이언트 (1차 스크리너 소스)
"""
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

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.get(url, params=params, headers=headers)
            res.raise_for_status()
            data = res.json()
            return data
