"""
Base Collector Interface
"""
from abc import ABC, abstractmethod
import logging
from app.domains.curator.models import CommunityPost

logger = logging.getLogger("curator_collector")


class BaseCollector(ABC):
    """모든 데이터 수집기의 기본 추상 클래스"""

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def collect(self) -> list[CommunityPost]:
        """지난 24시간 동안의 인기 게시글 또는 뉴스 기사 수집"""
        pass
