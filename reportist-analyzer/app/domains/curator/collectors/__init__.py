"""
Collectors package
"""
from app.domains.curator.collectors.base import BaseCollector
from app.domains.curator.collectors.reddit_collector import RedditCollector
from app.domains.curator.collectors.news_collector import NewsCollector
from app.domains.curator.collectors.stocktwits_collector import StocktwitsCollector
from app.domains.curator.collectors.kr_community_collector import KRCommunityCollector

__all__ = [
    "BaseCollector",
    "RedditCollector",
    "NewsCollector",
    "StocktwitsCollector",
    "KRCommunityCollector",
]
