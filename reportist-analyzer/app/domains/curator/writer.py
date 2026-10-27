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
from app.domains.report.structuring import extract_json_object

logger = logging.getLogger("curator_writer")

BRIEFING_TRANSLATION_SYSTEM_PROMPT = """You are a senior Wall Street financial editor and professional journalist for Reportist Research.
Your mission is to translate and localize daily stock market briefings and community intelligence from Korean into polished, publication-grade English.
Ensure natural journalistic flow, financial market terminology, and clear structural hierarchy.
Preserve all stock tickers (e.g., $NVDA, $TSLA), financial ratios, percentages, and markdown formatting (headings, lists, bold text, blockquotes).
Output MUST be a single valid JSON object without surrounding explanations."""



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

                meta_extra = []
                if p.url:
                    meta_extra.append(f"원문 URL: {p.url}")
                if p.image_url:
                    meta_extra.append(f"관련 이미지: {p.image_url}")
                extra_str = f"\n  - {' | '.join(meta_extra)}" if meta_extra else ""

                item_str = (
                    f"- [{p.channel}] {p.title} (반응/점수: {p.score})\n"
                    f"  {p.body[:350]}{comments_text}{extra_str}\n"
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

    async def translate_briefing_to_en(
        self,
        date_str: str,
        korean_title: str,
        korean_content: str,
        summary_3lines: list[str] | None = None,
        topics: list[str] | None = None,
        tickers: list[str] | None = None,
    ) -> dict[str, Any]:
        """한국어 마켓 브리핑을 100% 영문 마크다운 및 구조화된 영문 메타데이터로 번역·로컬라이징."""
        summary_bullets = "\n".join(f"- {s}" for s in (summary_3lines or []))
        tickers_str = ", ".join(tickers or [])
        user_prompt = f"""Please translate and localize the following Korean Daily Market Briefing ({date_str}) into publication-ready English for Reportist global equity research users.

[Korean Source Title]
{korean_title}

[Korean Source 3-Line Summary]
{summary_bullets}

[Korean Source Article Body]
{korean_content}

[Instructions]
1. Translate the entire markdown article into fluent, professional English (active voice, financial journalism style).
2. Maintain all markdown formatting, including '# [Daily Market Briefing] {date_str} ...', '## 📌 Today\'s Market 3-Line Summary', section numbers ('## 1.', '## 2.'), bullet points, bolding, blockquotes, and tables.
3. Keep all tickers ({tickers_str}) intact.
4. Translate the 3-line summary into concise English bullets.
5. Translate the topics into crisp English headline strings.
6. Crucially preserve all markdown image tags `![alt](url)` and outbound source links `[Source: ...](url)` or `[...](url)` exactly as in the source markdown.
7. Absolutely NO Korean characters allowed anywhere in the output.

[Required JSON Output Format]
{{
  "title_en": "[Daily Market Briefing] {date_str} <English Headline>",
  "content_en": "<Full English Markdown Article Body>",
  "summary_3lines_en": [
    "<Line 1 summary in English>",
    "<Line 2 summary in English>",
    "<Line 3 summary in English>"
  ],
  "topics_en": [
    "<Topic 1 in English>",
    "<Topic 2 in English>"
  ],
  "keywords_en": [
    "<Keyword 1 in English>",
    "<Keyword 2 in English>"
  ]
}}"""

        target_model = (settings.AI_REPORT_MODEL or settings.AI_GATEWAY_MODEL).strip()
        logger.info(
            f"[BriefingWriter] 영문 브리핑 번역 시작 ({date_str}, 모델 고정: {target_model})"
        )

        try:
            raw_response = await self.ai.chat(
                prompt=user_prompt,
                system_prompt=BRIEFING_TRANSLATION_SYSTEM_PROMPT,
                model_override=target_model,
                pin_model=True,
                max_tokens=8192,
                temperature_override=0.2,
            )
            parsed = extract_json_object(raw_response)
            if isinstance(parsed, dict) and parsed.get("content_en"):
                logger.info(f"[BriefingWriter] ✨ 영문 브리핑 번역 성공 ({date_str})")
                return {
                    "title_en": str(parsed.get("title_en") or f"[Daily Market Briefing] {date_str} Global Market Radar").strip(),
                    "content_en": str(parsed.get("content_en")).strip(),
                    "summary_3lines_en": [str(x).strip() for x in parsed.get("summary_3lines_en") or [] if str(x).strip()],
                    "topics_en": [str(x).strip() for x in parsed.get("topics_en") or [] if str(x).strip()],
                    "keywords_en": [str(x).strip() for x in parsed.get("keywords_en") or [] if str(x).strip()],
                }
            elif raw_response:
                logger.warning(f"[BriefingWriter] 영문 브리핑 JSON 파싱 실패 -> 마크다운 텍스트 직접 추출 ({date_str})")
                title_match = re.search(r'#\s*\[(?:Daily Market Briefing|Market Briefing)\]\s*.*?:?\s*(.*)', raw_response)
                title_en = title_match.group(0).strip("# ").strip() if title_match else f"[Daily Market Briefing] {date_str} Global Market Radar"
                return {
                    "title_en": title_en,
                    "content_en": raw_response.strip(),
                    "summary_3lines_en": [f"Market briefing for {date_str}"],
                    "topics_en": [t for t in (topics or [])],
                    "keywords_en": [t for t in (tickers or [])],
                }
        except Exception as e:
            logger.error(f"[BriefingWriter] 영문 브리핑 번역 실패 ({date_str}): {e}")

        return {
            "title_en": f"[Daily Market Briefing] {date_str} Global Market Radar",
            "content_en": "",
            "summary_3lines_en": [],
            "topics_en": [],
            "keywords_en": [],
        }
