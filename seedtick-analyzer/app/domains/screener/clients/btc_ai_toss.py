"""
Toss Screener API 클라이언트 (직접 WTS 호출)
기존 btc-ai-backend 원격 프록시(hf.space) 호출을 완전히 중단하고
토스 WTS 비공개 API를 직접 호출하도록 상속 래핑합니다.
"""
import logging
from app.domains.screener.clients.toss_wts import TossWtsClient

logger = logging.getLogger("btc_ai_toss_client")


class BtcAiTossClient(TossWtsClient):
    """
    하위 호환성을 위한 클라이언트 클래스.
    외부 프록시(hf.space)를 거치지 않고 TossWtsClient를 직접 상속하여 동작합니다.
    """
    def __init__(self, base_url: str | None = None, timeout: float = 25.0):
        super().__init__()
        self.base_url = "https://wts-cert-api.tossinvest.com"
        self.timeout = timeout
        logger.info("[BtcAiTossClient] 외부 프록시 우회 -> 토스 WTS 직접 호출 모드로 초기화됨")
