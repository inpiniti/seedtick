"""
Korean Community Collector
디시인사이드(미국주식 갤러리, 국내주식 갤러리) 개념글 및
에펨코리아(주식/재테크 게시판) 인기글을 수집합니다.
"""
from __future__ import annotations

import asyncio
import html
import logging
import re
from typing import Any
import httpx

try:
    from curl_cffi.requests import AsyncSession
    HAS_CURL_CFFI = True
except ImportError:
    HAS_CURL_CFFI = False

from app.domains.curator.collectors.base import BaseCollector
from app.domains.curator.models import CommunityPost, SourcePlatform

logger = logging.getLogger("kr_community_collector")

DC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://gall.dcinside.com/",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}


class KRCommunityCollector(BaseCollector):
    def __init__(self, max_posts_per_channel: int = 5):
        super().__init__(name="kr_community")
        self.max_posts_per_channel = max_posts_per_channel

    async def collect(self) -> list[CommunityPost]:
        posts: list[CommunityPost] = []
        # 비동기로 병렬 수집
        tasks = [
            self._fetch_dcinside("usstock", "미국주식갤러리", is_mgall=True),
            self._fetch_dcinside("stockus", "국내주식갤러리", is_mgall=False),
            self._fetch_fmkorea_stock(),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, list):
                posts.extend(res)
            elif isinstance(res, Exception):
                logger.warning(f"[KRCommunityCollector] 수집 오류: {res}")
        return posts

    async def _fetch_dcinside(self, gall_id: str, channel_name: str, is_mgall: bool = True) -> list[CommunityPost]:
        """디시인사이드 개념글(추천글) 목록 파싱"""
        base_path = "mgallery/board/lists/" if is_mgall else "board/lists/"
        url = f"https://gall.dcinside.com/{base_path}?id={gall_id}&exception_mode=recommend"

        posts: list[CommunityPost] = []
        try:
            html_text = ""
            async with httpx.AsyncClient(headers=DC_HEADERS, timeout=10.0, follow_redirects=True) as client:
                # 1. 개념글 시도
                resp = await client.get(url)
                if resp.status_code == 200:
                    html_text = resp.text
                # 개념글이 비어있으면 일반 최신글 목록으로 폴백
                if not html_text or "empty_list" in html_text:
                    fallback_url = f"https://gall.dcinside.com/{base_path}?id={gall_id}"
                    resp_fallback = await client.get(fallback_url)
                    if resp_fallback.status_code == 200:
                        html_text = resp_fallback.text

            if not html_text:
                return []

            # 정규식으로 게시글 행 추출: 번호, 제목 HTML, 댓글수
            pattern = re.compile(
                r'href="([^"]*view/\?id=' + re.escape(gall_id) + r'&no=(\d+)[^"]*)"[^>]*>(.*?)</a>(?:.*?reply_num[^>]*>\[(\d+)\])?',
                re.DOTALL,
            )

            matches = pattern.findall(html_text)
            seen_no = set()
            for href, post_no, raw_html, reply_count in matches:
                if post_no in seen_no:
                    continue
                seen_no.add(post_no)

                clean_title = re.sub(r'<[^>]+>', '', raw_html).strip()
                clean_title = html.unescape(clean_title)
                # 설문조사, 공지사항 등 스킵
                if not clean_title or clean_title.startswith("[공지]") or clean_title.startswith("[설문]"):
                    continue

                comments_cnt = int(reply_count) if reply_count else 0
                full_url = f"https://gall.dcinside.com{href}" if href.startswith("/") else href

                posts.append(
                    CommunityPost(
                        id=f"dc_{gall_id}_{post_no}",
                        platform=SourcePlatform.DCINSIDE,
                        channel=channel_name,
                        title=clean_title,
                        body=f"[{channel_name} 핫이슈] {clean_title} (댓글 {comments_cnt}개 반응)",
                        comments=[],
                        score=25,
                        comment_count=comments_cnt,
                        url=full_url,
                    )
                )

                if len(posts) >= self.max_posts_per_channel:
                    break
        except Exception as e:
            logger.debug(f"[DCInside] {channel_name} 크롤링 예외: {e}")

        return posts

    async def _fetch_fmkorea_stock(self) -> list[CommunityPost]:
        """에펨코리아 주식/재테크 게시판 인기글 수집 (curl_cffi로 Cloudflare 우회 시도)"""
        url = "https://www.fmkorea.com/index.php?mid=stock&listStyle=webzine&sort_index=pop"
        posts: list[CommunityPost] = []

        try:
            html_text = ""
            if HAS_CURL_CFFI:
                async with AsyncSession(impersonate="chrome120") as s:
                    res = await s.get(url, timeout=10)
                    if res.status_code == 200:
                        html_text = res.text
            else:
                async with httpx.AsyncClient(headers=DC_HEADERS, timeout=10.0) as client:
                    res = await client.get(url)
                    if res.status_code == 200:
                        html_text = res.text

            if not html_text:
                return []

            # 펨코 웹진형/리스트형 제목 추출
            # <a href="/123456789" class="hx" ...>제목 <span class="comment_count">[12]</span></a>
            fmk_pattern = re.compile(
                r'href="/(\d{7,12})"[^>]*class="[^"]*hx[^"]*"[^>]*>\s*([^<]+?)\s*(?:<span[^>]*class="[^"]*comment_count[^"]*"[^>]*>\[(\d+)\])?',
                re.DOTALL,
            )
            matches = fmk_pattern.findall(html_text)
            seen_ids = set()
            for doc_id, raw_title, reply_cnt in matches:
                if doc_id in seen_ids:
                    continue
                seen_ids.add(doc_id)
                title = raw_title.strip()
                if not title or len(title) < 4:
                    continue
                c_cnt = int(reply_cnt) if reply_cnt else 0

                posts.append(
                    CommunityPost(
                        id=f"fmkorea_{doc_id}",
                        platform=SourcePlatform.FMKOREA,
                        channel="에펨코리아 주식판",
                        title=title,
                        body=f"[에펨코리아 주식/재테크 인기글] {title} (댓글 {c_cnt}개 반응)",
                        score=25,
                        comment_count=c_cnt,
                        url=f"https://www.fmkorea.com/{doc_id}",
                    )
                )
                if len(posts) >= self.max_posts_per_channel:
                    break
        except Exception as e:
            logger.debug(f"[FMKorea] 수집 예외: {e}")

        return posts
