"""
커뮤니티 및 뉴스 큐레이터 데이터 모델
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class SourcePlatform(str, Enum):
    REDDIT = "reddit"
    NEWS = "news"
    STOCKTWITS = "stocktwits"
    DCINSIDE = "dcinside"
    FMKOREA = "fmkorea"
    TWITTER = "twitter"
    BLIND = "blind"


class CommunityPost(BaseModel):
    """수집된 원천 게시글 (커뮤니티 또는 뉴스)"""
    id: str
    platform: SourcePlatform
    channel: str  # e.g., "wallstreetbets", "stocks", "dc_usstock", "yahoo_news"
    title: str
    body: str = ""
    comments: list[str] = Field(default_factory=list)
    score: int = 0  # upvotes or recommendations
    comment_count: int = 0
    url: str = ""
    image_url: str | None = None  # 원문 대표 이미지/차트/썸네일 URL
    published_at: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TopicCandidate(BaseModel):
    """전처리 및 클러스터링 후 후보 이슈"""
    topic_id: str
    headline: str
    keywords: list[str] = Field(default_factory=list)
    related_tickers: list[str] = Field(default_factory=list)
    summary: str = ""
    source_posts: list[CommunityPost] = Field(default_factory=list)
    total_engagement: int = 0  # sum of score + comments


class BriefingSection(BaseModel):
    """뉴스레터 내 개별 토픽 섹션"""
    topic_number: int
    title: str
    summary_3lines: list[str] = Field(default_factory=list)
    context_and_facts: str = ""
    community_sentiment: str = ""
    key_quotes: list[str] = Field(default_factory=list)
    related_tickers: list[str] = Field(default_factory=list)
    investment_implications: str = ""


class DailyBriefing(BaseModel):
    """생성된 하루 종합 마켓 & 커뮤니티 브리핑 뉴스레터"""
    date: str  # YYYY-MM-DD
    title: str
    intro: str = ""
    summary_3lines: list[str] = Field(default_factory=list)
    sections: list[BriefingSection] = Field(default_factory=list)
    closing: str = ""
    disclaimer: str = (
        "※ 본 브리핑은 글로벌/국내 주요 커뮤니티의 실시간 여론과 24시간 주요 뉴스를 "
        "AI로 요약·정리한 정보 제공용 콘텐츠이며, 특정 종목에 대한 투자 권유나 매수/매도 추천이 아닙니다."
    )
    raw_content: str = ""
    # ── 영문 다국어 필드 (i18n) ──
    title_en: str = ""
    raw_content_en: str = ""
    summary_3lines_en: list[str] = Field(default_factory=list)
    topics_en: list[str] = Field(default_factory=list)
    keywords_en: list[str] = Field(default_factory=list)



class CuratedHistoryItem(BaseModel):
    """과거 발행된 기사의 주제 메타데이터 (중복 배제용)"""
    date: str
    title: str
    keywords: list[str] = Field(default_factory=list)
    tickers: list[str] = Field(default_factory=list)
    key_summary: str = ""
