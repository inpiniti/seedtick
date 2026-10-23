"""
Deduplication & Novelty Engine
과거 발행된 브리핑 주제 히스토리를 관리하고, 키워드 유사도 및 문맥 기반으로
기존 글과 중복되는 주제를 배제하여 새로운 인사이트만 선별합니다.
"""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Sequence

from app.domains.curator.models import (
    CommunityPost,
    CuratedHistoryItem,
    TopicCandidate,
)

logger = logging.getLogger("dedup_engine")

DEFAULT_HISTORY_FILE = Path(__file__).resolve().parents[4] / "post" / ".curated_history.json"


class DeduplicationEngine:
    def __init__(self, history_file_path: Path | str | None = None, max_history_days: int = 21):
        self.history_file = Path(history_file_path or DEFAULT_HISTORY_FILE)
        self.max_history_days = max_history_days
        self._history: list[CuratedHistoryItem] = self._load_history()

    def _load_history(self) -> list[CuratedHistoryItem]:
        # 1. Supabase market_briefings 테이블 우선 조회
        try:
            from app.infrastructure.supabase_repo import supabase_repo
            if supabase_repo.is_connected():
                rows = supabase_repo.get_recent_market_briefings(limit=20)
                if rows:
                    items: list[CuratedHistoryItem] = []
                    for r in rows:
                        items.append(
                            CuratedHistoryItem(
                                date=str(r.get("d")),
                                title=r.get("title", ""),
                                keywords=r.get("keywords") or r.get("topics") or [],
                                tickers=r.get("tickers") or [],
                                key_summary=" ".join(r.get("summary_3lines") or []),
                            )
                        )
                    logger.info(f"[DedupEngine] Supabase market_briefings 히스토리 {len(items)}건 로드 완료")
                    return items
        except Exception as e:
            logger.debug(f"[DedupEngine] Supabase 히스토리 조회 건너뜀: {e}")

        # 2. 로컬 JSON 파일 폴백
        if not self.history_file.exists():
            return []
        try:
            with open(self.history_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [CuratedHistoryItem(**item) for item in data]
        except Exception as e:
            logger.warning(f"[DedupEngine] 히스토리 파일 로드 실패: {e}")
            return []


    def save_history_item(self, item: CuratedHistoryItem) -> None:
        """새로 발행된 주제를 히스토리에 추가하고 디스크에 저장"""
        self._history.insert(0, item)
        # 최대 보관 일수 제한 (최신 순 100건 또는 21일치)
        self._history = self._history[:100]
        try:
            self.history_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump([h.model_dump() for h in self._history], f, ensure_ascii=False, indent=2)
            logger.info(f"[DedupEngine] 히스토리 저장 완료 ({item.date}: {item.title})")
        except Exception as e:
            logger.warning(f"[DedupEngine] 히스토리 저장 실패: {e}")

    def get_recent_topics(self, limit: int = 15) -> list[CuratedHistoryItem]:
        """최근 발행된 주제 목록 반환"""
        return self._history[:limit]

    def format_history_context_for_prompt(self, limit: int = 10) -> str:
        """LLM 프롬프트에 주입할 최근 발행 기사 목록 포맷팅"""
        recent = self.get_recent_topics(limit)
        if not recent:
            return "최근 발행된 기존 주제 내역이 없습니다 (모든 새로운 주제 선정 가능)."

        lines = ["## [필독] 최근 발행된 기존 브리핑 주제 목록 (중복 배제 대상):"]
        for idx, item in enumerate(recent, 1):
            tickers_str = f" [{', '.join(item.tickers)}]" if item.tickers else ""
            lines.append(f"{idx}. ({item.date}){tickers_str} {item.title} (키워드: {', '.join(item.keywords[:4])})")
        lines.append(
            "\n※ 주의: 위 목록에 이미 언급된 동일한 뉴스, 반복되는 단순 잡담, 또는 기존 이슈의 "
            "단순 연속선상인 주제는 반드시 제외(Drop)하고, 어제 24시간 동안 완전히 새롭게 점화되었거나 "
            "새로운 국면을 맞이한 핫 이슈만 선정하십시오."
        )
        return "\n".join(lines)

    def extract_keywords(self, text: str) -> set[str]:
        """단순 정규식 기반 주요 키워드 추출 (2글자 이상 단어)"""
        words = re.findall(r'[a-zA-Z가-힣0-9]{2,}', text.lower())
        # 불용어 제거
        stopwords = {
            "오늘", "어제", "내일", "관련", "대해", "주식", "시장", "게시글", "뉴스",
            "this", "that", "with", "from", "have", "stock", "market", "about",
            "what", "when", "where", "which", "there", "their"
        }
        return {w for w in words if w not in stopwords}

    def calculate_similarity(self, candidate_text: str, history_item: CuratedHistoryItem) -> float:
        """후보 텍스트와 과거 히스토리 항목 간의 유사도 계산 (0.0 ~ 1.0)"""
        c_keywords = self.extract_keywords(candidate_text)
        if not c_keywords:
            return 0.0

        all_h_keywords = set(history_item.keywords) | self.extract_keywords(f"{history_item.title} {history_item.key_summary}")
        if not all_h_keywords:
            return 0.0

        intersection = c_keywords.intersection(all_h_keywords)
        if not intersection:
            return 0.0

        union = c_keywords.union(all_h_keywords)
        jaccard = len(intersection) / len(union) if union else 0.0

        # 핵심 키워드(history_item.keywords) 포함 비율
        core_keywords = set(history_item.keywords)
        core_overlap = 0.0
        if core_keywords:
            core_overlap = len(c_keywords.intersection(core_keywords)) / len(core_keywords)

        # 오버랩 계수 (Overlap Coefficient: 작은 집합 기준)
        overlap_coeff = len(intersection) / min(len(c_keywords), len(all_h_keywords))

        return max(jaccard, core_overlap, overlap_coeff * 0.7)

    def filter_candidates(
        self,
        posts: Sequence[CommunityPost],
        similarity_threshold: float = 0.55,
    ) -> list[CommunityPost]:
        """
        과거 히스토리와 지나치게 유사한 키워드를 가진 게시글을 1차 필터링
        """
        recent = self.get_recent_topics(14)
        if not recent:
            return list(posts)

        filtered_posts: list[CommunityPost] = []
        for post in posts:
            post_full_text = f"{post.title} {post.body}"
            is_dup = False
            for past in recent:
                sim = self.calculate_similarity(post_full_text, past)
                if sim >= similarity_threshold:
                    logger.debug(
                        f"[DedupEngine] 중복 감지 (유사도 {sim:.2f} >= {similarity_threshold}): "
                        f"'{post.title}' vs 과거 '{past.title}'"
                    )
                    is_dup = True
                    break
            if not is_dup:
                filtered_posts.append(post)

        logger.info(
            f"[DedupEngine] 1차 중복 필터링 완료: {len(posts)}건 중 {len(filtered_posts)}건 통과 "
            f"({len(posts) - len(filtered_posts)}건 중복 배제됨)"
        )
        return filtered_posts
