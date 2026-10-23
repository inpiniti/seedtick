"""
StockTwits Collector
StockTwits 공개 API를 통해 현재 가장 뜨겁게 논의되는 트렌딩 종목(Trending Symbols)과
투자자들의 불(Bull) / 베어(Bear) 코멘트를 수집합니다.
"""
from __future__ import annotations

import asyncio
import logging
import httpx

try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
except ImportError:
    HAS_CURL_CFFI = False

from app.domains.curator.collectors.base import BaseCollector
from app.domains.curator.models import CommunityPost, SourcePlatform

logger = logging.getLogger("stocktwits_collector")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}


class StocktwitsCollector(BaseCollector):
    def __init__(self, top_n_symbols: int = 5, comments_per_symbol: int = 4):
        super().__init__(name="stocktwits")
        self.top_n_symbols = top_n_symbols
        self.comments_per_symbol = comments_per_symbol

    async def collect(self) -> list[CommunityPost]:
        posts: list[CommunityPost] = []
        url = "https://api.stocktwits.com/api/2/streams/trending.json"

        try:
            data = {}
            if HAS_CURL_CFFI:
                resp = await asyncio.to_thread(
                    cffi_requests.get, url, timeout=10, impersonate="chrome120"
                )
                if resp.status_code == 200:
                    data = resp.json()
            else:
                async with httpx.AsyncClient(headers=HEADERS, timeout=10.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()


            # 1. messages 직접 파싱 (트렌딩 스트림)
            messages = data.get("messages", [])
            seen_symbols = set()
            for m in messages:
                syms = m.get("symbols", [])
                sym = syms[0].get("symbol") if syms else ""
                title = syms[0].get("title", sym) if syms else ""
                if not sym or sym in seen_symbols:
                    continue
                seen_symbols.add(sym)

                body = m.get("body", "").strip()
                sentiment = (
                    m.get("entities", {})
                    .get("sentiment", {})
                    .get("basic", "")
                )
                sentiment_tag = f"[{sentiment.upper()}] " if sentiment else ""
                comment = f"{sentiment_tag}{body[:250]}" if body else ""

                posts.append(
                    CommunityPost(
                        id=f"stocktwits_{sym}",
                        platform=SourcePlatform.STOCKTWITS,
                        channel=f"${sym}",
                        title=f"[StockTwits 트렌딩] ${sym} ({title})",
                        body=f"StockTwits 트렌딩 #{sym} ({title}) 실시간 인기 토론",
                        comments=[comment] if comment else [],
                        score=35,
                        comment_count=1,
                        url=f"https://stocktwits.com/symbol/{sym}",
                    )
                )
                if len(posts) >= self.top_n_symbols:
                    break

            # 2. symbols 배열 형태인 경우 하위 호환
            if not posts and "symbols" in data:
                for sym_info in data.get("symbols", [])[: self.top_n_symbols]:
                    symbol = sym_info.get("symbol")
                    title = sym_info.get("title", symbol)
                    if symbol:
                        posts.append(
                            CommunityPost(
                                id=f"stocktwits_{symbol}",
                                platform=SourcePlatform.STOCKTWITS,
                                channel=f"${symbol}",
                                title=f"[StockTwits 트렌딩] ${symbol} ({title})",
                                body=f"StockTwits 트렌딩 #{symbol} ({title})",
                                score=30,
                                url=f"https://stocktwits.com/symbol/{symbol}",
                            )
                        )
        except Exception as e:
            logger.debug(f"[StockTwits] 수집 오류: {e}")

        return posts


    async def _fetch_symbol_stream(self, client: httpx.AsyncClient, symbol: str) -> list[str]:
        url = f"https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json?limit={self.comments_per_symbol}"
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                messages = resp.json().get("messages", [])
                comments = []
                for m in messages:
                    body = m.get("body", "").strip()
                    sentiment = (
                        m.get("entities", {})
                        .get("sentiment", {})
                        .get("basic", "")
                    )
                    sentiment_tag = f"[{sentiment.upper()}] " if sentiment else ""
                    if body:
                        comments.append(f"{sentiment_tag}{body[:200]}")
                return comments
        except Exception as e:
            logger.debug(f"[StockTwits] Stream API 오류 ({symbol}): {e}")
        return []
