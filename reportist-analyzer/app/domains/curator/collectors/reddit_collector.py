"""
Reddit Collector
5개 서브레딧 (wallstreetbets, stocks, investing, SideProject, ValueInvesting)의
최근 24시간 Top 게시글 및 주요 댓글 수집
"""
from __future__ import annotations

import asyncio
import html
import logging
from typing import Any
import xml.etree.ElementTree as ET
import httpx

from app.domains.curator.collectors.base import BaseCollector
from app.domains.curator.models import CommunityPost, SourcePlatform

logger = logging.getLogger("reddit_collector")

SUBREDDITS = [
    "wallstreetbets",
    "stocks",
    "investing",
    "SideProject",
    "ValueInvesting",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ReportistCuratorBot/1.0)"
}


class RedditCollector(BaseCollector):
    def __init__(
        self,
        subreddits: list[str] | None = None,
        min_score: int = 15,
        max_posts_per_sub: int = 5,
        fetch_comments: bool = True,
    ):
        super().__init__(name="reddit")
        self.subreddits = subreddits or SUBREDDITS
        self.min_score = min_score
        self.max_posts_per_sub = max_posts_per_sub
        self.fetch_comments = fetch_comments

    async def collect(self) -> list[CommunityPost]:
        posts: list[CommunityPost] = []
        async with httpx.AsyncClient(headers=HEADERS, timeout=12.0) as client:
            tasks = [self._fetch_subreddit(client, sub) for sub in self.subreddits]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, list):
                    posts.extend(res)
                elif isinstance(res, Exception):
                    logger.warning(f"[RedditCollector] 서브레딧 수집 예외: {res}")
        return posts

    async def _fetch_subreddit(self, client: httpx.AsyncClient, sub: str) -> list[CommunityPost]:
        url = f"https://www.reddit.com/r/{sub}/top.json?t=day&limit=25"
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.debug(f"[Reddit] r/{sub} 직접 요청 실패 (status={resp.status_code}) -> GNews RSS 폴백 시도")
                return await self._fetch_via_gnews_rss(client, sub)
            data = resp.json()
            children = data.get("data", {}).get("children", [])
        except Exception as e:
            logger.debug(f"[Reddit] r/{sub} 파싱 오류: {e} -> GNews RSS 폴백 시도")
            return await self._fetch_via_gnews_rss(client, sub)

        sub_posts: list[CommunityPost] = []
        for child in children:
            post_data = child.get("data", {})
            score = post_data.get("score", 0)
            if score < self.min_score:
                continue

            # 고정 공지글(Stickied) 제외
            if post_data.get("stickied", False):
                continue

            post_id = post_data.get("id", "")
            title = post_data.get("title", "").strip()
            selftext = post_data.get("selftext", "").strip()
            permalink = post_data.get("permalink", "")
            num_comments = post_data.get("num_comments", 0)

            # 본문 길이 제한 (1,200자)
            body_snippet = selftext[:1200] if selftext else ""
            full_url = f"https://www.reddit.com{permalink}"

            comments: list[str] = []
            if self.fetch_comments and permalink and len(sub_posts) < self.max_posts_per_sub:
                comments = await self._fetch_top_comments(client, permalink)

            sub_posts.append(
                CommunityPost(
                    id=f"reddit_{sub}_{post_id}",
                    platform=SourcePlatform.REDDIT,
                    channel=f"r/{sub}",
                    title=title,
                    body=body_snippet,
                    comments=comments,
                    score=score,
                    comment_count=num_comments,
                    url=full_url,
                )
            )

            if len(sub_posts) >= self.max_posts_per_sub:
                break

        return sub_posts

    async def _fetch_top_comments(self, client: httpx.AsyncClient, permalink: str) -> list[str]:
        """게시글의 베스트 댓글 상위 3개 수집"""
        url = f"https://www.reddit.com{permalink}.json?limit=5&depth=1"
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
            if not isinstance(data, list) or len(data) < 2:
                return []
            comment_children = data[1].get("data", {}).get("children", [])
            top_comments = []
            for c in comment_children:
                cdata = c.get("data", {})
                body = cdata.get("body", "").strip()
                author = cdata.get("author", "")
                ups = cdata.get("ups", 0)
                # AutoModerator 제외 및 너무 짧은 글 제외
                if author == "AutoModerator" or not body or len(body) < 5:
                    continue
                top_comments.append(f"{body[:250]} (추천 {ups})")
                if len(top_comments) >= 3:
                    break
            return top_comments
        except Exception as e:
            logger.debug(f"[Reddit] 댓글 수집 실패 ({permalink}): {e}")
            return []

    async def _fetch_via_gnews_rss(self, client: httpx.AsyncClient, sub: str) -> list[CommunityPost]:
        """Reddit 403 차단 시 Google News RSS를 통해 r/{sub} 인기 토픽 수집 폴백"""
        url = "https://news.google.com/rss/search"
        params = {
            "q": f"site:reddit.com/r/{sub} when:1d",
            "hl": "en-US",
            "gl": "US",
            "ceid": "US:en",
        }
        try:
            resp = await client.get(url, params=params, timeout=10.0)
            if resp.status_code != 200 or not resp.content:
                return []
            root = ET.fromstring(resp.content[:2_000_000])
            posts: list[CommunityPost] = []
            for item in root.iter("item"):
                raw_title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                pub_raw = (item.findtext("pubDate") or "").strip()
                if not raw_title:
                    continue
                # "Title - Reddit" 형태에서 Reddit 제거
                title = raw_title.rsplit(" - ", 1)[0].strip() if " - " in raw_title else raw_title
                if not title or title.lower() == f"r/{sub.lower()}":
                    continue

                posts.append(
                    CommunityPost(
                        id=f"reddit_{sub}_{abs(hash(title))}",
                        platform=SourcePlatform.REDDIT,
                        channel=f"r/{sub}",
                        title=html.unescape(title),
                        body=f"[r/{sub} 핫 토픽] {title}",
                        score=50,
                        url=link,
                        published_at=pub_raw,
                    )
                )
                if len(posts) >= self.max_posts_per_sub:
                    break
            logger.info(f"[Reddit] r/{sub} GNews RSS 폴백 성공: {len(posts)}건 수집")
            return posts
        except Exception as e:
            logger.debug(f"[Reddit] r/{sub} GNews RSS 폴백 실패: {e}")
            return []

