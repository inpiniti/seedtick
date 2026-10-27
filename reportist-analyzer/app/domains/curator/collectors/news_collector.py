"""
Global & Domestic News Collector
Yahoo Finance API 및 Google News RSS를 활용하여 지난 24시간 동안의
주요 글로벌/국내 경제·주식 뉴스를 수집합니다.
"""
from __future__ import annotations

import asyncio
import html
import logging
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import httpx

from app.domains.curator.collectors.base import BaseCollector
from app.domains.curator.models import CommunityPost, SourcePlatform

logger = logging.getLogger("news_collector")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# 24시간 글로벌 & 국내 시장 핵심 검색 키워드
MARKET_QUERIES = [
    "Stock Market",
    "Wall Street",
    "Federal Reserve Interest Rate",
    "Tech Earnings AI",
    "한국 증시 코스피",
    "반도체 주식",
]


class NewsCollector(BaseCollector):
    def __init__(
        self,
        queries: list[str] | None = None,
        max_news_per_query: int = 4,
    ):
        super().__init__(name="news")
        self.queries = queries or MARKET_QUERIES
        self.max_news_per_query = max_news_per_query

    async def collect(self) -> list[CommunityPost]:
        posts: list[CommunityPost] = []
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=12.0) as client:
            tasks = [self._fetch_query_news(client, q) for q in self.queries]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            seen_titles = set()
            for res in results:
                if isinstance(res, list):
                    for post in res:
                        # 중복 뉴스 제목 제거
                        clean_title = post.title.strip().lower()
                        if clean_title not in seen_titles:
                            seen_titles.add(clean_title)
                            posts.append(post)
                elif isinstance(res, Exception):
                    logger.warning(f"[NewsCollector] 뉴스 수집 오류: {res}")
        return posts

    async def _fetch_query_news(self, client: httpx.AsyncClient, query: str) -> list[CommunityPost]:
        items: list[CommunityPost] = []
        # 1. 야후 파이낸스 뉴스 시도
        try:
            y_url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(query)}&newsCount=6"
            resp = await client.get(y_url)
            if resp.status_code == 200:
                raw_news = resp.json().get("news", [])
                for n in raw_news:
                    title = n.get("title", "").strip()
                    publisher = n.get("publisher", "")
                    link = n.get("link", "")
                    uuid = n.get("uuid", "")
                    pub_time = n.get("providerPublishTime")
                    pub_str = ""
                    if pub_time:
                        try:
                            pub_str = datetime.fromtimestamp(pub_time, timezone.utc).strftime("%Y-%m-%d %H:%M")
                        except Exception:
                            pass

                    # 썸네일 이미지 추출
                    image_url = None
                    thumb_dict = n.get("thumbnail")
                    if isinstance(thumb_dict, dict):
                        resolutions = thumb_dict.get("resolutions", [])
                        if resolutions and isinstance(resolutions, list):
                            image_url = resolutions[-1].get("url")
                        elif thumb_dict.get("url"):
                            image_url = thumb_dict.get("url")

                    if title:
                        items.append(
                            CommunityPost(
                                id=f"yahoo_{uuid or hash(title)}",
                                platform=SourcePlatform.NEWS,
                                channel=f"Yahoo ({publisher})",
                                title=title,
                                body=f"출처: {publisher}. 주요 글로벌 마켓 뉴스 ({query})",
                                url=link,
                                image_url=image_url,
                                published_at=pub_str,
                                score=50,  # 뉴스 가중치
                            )
                        )
                        if len(items) >= self.max_news_per_query:
                            break
        except Exception as e:
            logger.debug(f"[News] 야후 뉴스 실패 (query={query}): {e}")

        # 2. 구글 뉴스 RSS (야후 뉴스가 부족하거나 국내 뉴스일 경우)
        if len(items) < self.max_news_per_query:
            gnews_items = await self._fetch_gnews_rss(client, query)
            items.extend(gnews_items[: (self.max_news_per_query - len(items))])

        return items

    async def _fetch_gnews_rss(self, client: httpx.AsyncClient, query: str) -> list[CommunityPost]:
        posts: list[CommunityPost] = []
        is_korean = any(ord(c) >= 0xAC00 and ord(c) <= 0xD7A3 for c in query)
        hl, gl, ceid = ("ko", "KR", "KR:ko") if is_korean else ("en-US", "US", "US:en")

        try:
            res = await client.get(
                "https://news.google.com/rss/search",
                params={"q": f"{query} when:1d", "hl": hl, "gl": gl, "ceid": ceid},
                timeout=10.0,
            )
            if res.status_code != 200 or not res.content:
                return []
            root = ET.fromstring(res.content[:2_000_000])
            for item in root.iter("item"):
                raw_title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                source_el = item.find("source")
                source = (source_el.text or "").strip() if source_el is not None else "Google News"
                pub_raw = (item.findtext("pubDate") or "").strip()

                # 이미지 URL 추출 (enclosure 또는 description img 태그)
                img_url = None
                enclosure = item.find("enclosure")
                if enclosure is not None and enclosure.get("url"):
                    img_url = enclosure.get("url")
                if not img_url:
                    desc = item.findtext("description") or ""
                    m = re.search(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', desc)
                    if m:
                        img_url = m.group(1)

                title, publisher = raw_title, source
                if " - " in raw_title:
                    title, tail = raw_title.rsplit(" - ", 1)
                    if not publisher or publisher == "Google News":
                        publisher = tail

                pub_str = ""
                if pub_raw:
                    try:
                        pub_str = parsedate_to_datetime(pub_raw).strftime("%Y-%m-%d %H:%M")
                    except Exception:
                        pass

                clean_title = html.unescape(title.strip())
                if clean_title:
                    posts.append(
                        CommunityPost(
                            id=f"gnews_{abs(hash(clean_title))}",
                            platform=SourcePlatform.NEWS,
                            channel=f"GoogleNews ({publisher})",
                            title=clean_title,
                            body=f"출처: {publisher}. 지난 24시간 실시간 주요 뉴스.",
                            url=link,
                            image_url=img_url,
                            published_at=pub_str,
                            score=40,
                        )
                    )
                if len(posts) >= self.max_news_per_query:
                    break
        except Exception as e:
            logger.debug(f"[News] Google News RSS 실패 ({query}): {e}")

        return posts
