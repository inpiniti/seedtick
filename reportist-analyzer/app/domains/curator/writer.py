"""
Briefing Writer & AI Generator
정제된 커뮤니티/뉴스 포스트와 히스토리 문맥을 바탕으로 AI 모델을 호출하여
최종 데일리 뉴스 브리핑을 생성하고 메타데이터를 추출합니다.
"""
from __future__ import annotations

import logging
import re
from typing import Sequence

from app.config.settings import settings
from app.domains.curator.models import (
    CommunityPost,
    CuratedHistoryItem,
    DailyBriefing,
)
from app.domains.curator.prompts import (
    CURATOR_SYSTEM_PROMPT,
    build_curator_user_prompt,
)
from app.domains.report.ai_client import AiGatewayClient

logger = logging.getLogger("curator_writer")


class BriefingWriter:
    def __init__(self, ai_client: AiGatewayClient | None = None):
        self.ai = ai_client or AiGatewayClient()

    def format_posts_for_prompt(self, posts: Sequence[CommunityPost], max_total_chars: int = 15000) -> str:
        """수집된 포스트들을 LLM 입력용 텍스트 블록으로 포맷팅 (토큰 과부하 방지)"""
        chunks: list[str] = []
        current_len = 0

        # 플랫폼별로 정리
        by_platform: dict[str, list[CommunityPost]] = {}
        for p in posts:
            by_platform.setdefault(p.platform.value, []).append(p)

        for plat, plat_posts in by_platform.items():
            header = f"\n### [{plat.upper()} 채널]"
            chunks.append(header)
            current_len += len(header)

            for p in plat_posts:
                comments_text = ""
                if p.comments:
                    comments_snippet = " | ".join(p.comments[:3])
                    comments_text = f"\n  - 주요 반응/댓글: {comments_snippet}"

                item_str = (
                    f"- [{p.channel}] {p.title} (반응/점수: {p.score})\n"
                    f"  {p.body[:350]}{comments_text}\n"
                )
                if current_len + len(item_str) > max_total_chars:
                    chunks.append("\n... (데이터 길이 제한으로 일부 항목 생략) ...")
                    return "\n".join(chunks)

                chunks.append(item_str)
                current_len += len(item_str)

        return "\n".join(chunks)

    async def generate_briefing(
        self,
        date_str: str,
        posts: Sequence[CommunityPost],
        history_context: str,
    ) -> tuple[DailyBriefing, CuratedHistoryItem]:
        """AI를 호출하여 브리핑 기사 본문과 히스토리용 메타데이터 생성"""
        posts_text = self.format_posts_for_prompt(posts)
        user_prompt = build_curator_user_prompt(date_str, history_context, posts_text)

        target_model = (settings.AI_REPORT_MODEL or settings.AI_GATEWAY_MODEL).strip()
        logger.info(
            f"[BriefingWriter] AI 브리핑 생성 시작 ({date_str}, 모델 고정: {target_model}, 수집 포스트 {len(posts)}건)"
        )

        raw_article = await self.ai.chat(
            prompt=user_prompt,
            system_prompt=CURATOR_SYSTEM_PROMPT,
            model_override=target_model,
            pin_model=True,
            max_tokens=8192,
            temperature_override=0.2,
        )

        # 메인 타이틀 파싱
        title_match = re.search(r'#\s*\[데일리 마켓 브리핑\]\s*.*?:?\s*(.*)', raw_article)
        main_title = title_match.group(0).strip("# ").strip() if title_match else f"[데일리 마켓 브리핑] {date_str} 글로벌 마켓 & 커뮤니티 레이더"

        # 티커 심볼 정규식 추출 ($AAPL, NVDA 등)
        found_tickers = list(set(re.findall(r'\b[A-Z]{2,5}\b', raw_article)))
        # 일반 대문자 영단어 필터링 (불용어)
        stop_words = {"AND", "THE", "FOR", "WITH", "FROM", "TOP", "HOT", "NOT", "ALL", "NEW", "KST", "USD", "KRW", "GDP", "FED", "CPI"}
        valid_tickers = [t for t in found_tickers if t not in stop_words][:6]

        # 주요 키워드 추출 (이슈 헤드라인 중심)
        section_titles = re.findall(r'##\s*\d+\.\s*(.+)', raw_article)
        keywords = [st.strip() for st in section_titles[:5]]

        # 3줄 요약 블록 추출
        summary_3lines: list[str] = []
        summary_block = re.search(r'##\s*📌?\s*오늘의 시장 3줄 요약\s*(.*?)(?=\n---|\n##|$)', raw_article, re.DOTALL)
        if summary_block:
            summary_3lines = [
                line.strip("- *• \t")
                for line in summary_block.group(1).strip().splitlines()
                if line.strip("- *• \t")
            ][:3]

        daily_briefing = DailyBriefing(
            date=date_str,
            title=main_title,
            intro="",
            summary_3lines=summary_3lines,
            raw_content=raw_article,
        )


        history_item = CuratedHistoryItem(
            date=date_str,
            title=main_title,
            keywords=keywords,
            tickers=valid_tickers,
            key_summary=raw_article[:300].replace("\n", " "),
        )

        return daily_briefing, history_item
