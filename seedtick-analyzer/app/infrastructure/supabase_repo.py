"""
Supabase 저장소: guru_votes 테이블 및 리포트 메타데이터 동기화
"""
import logging
from supabase import Client, create_client
from app.config.settings import settings
from app.config.constants import VERDICT_SCORE_MAP

logger = logging.getLogger("supabase_repo")


class SupabaseRepo:
    def __init__(self):
        self._client: Client | None = None
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                self._client = create_client(
                    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
                )
                logger.info("[Supabase] 클라이언트 초기화 성공")
            except Exception as e:
                logger.warning(f"[Supabase] 클라이언트 초기화 실패: {e}")

    def is_connected(self) -> bool:
        return self._client is not None

    async def save_full_report(
        self,
        date_str: str,
        ticker: str,
        company_name: str,
        current_price: float,
        verdict: str,
        overall_score: int,
        vote_summary: str,
        datapack_dict: dict,
        summaries_list: list[dict],
        discussion_md: str,
        final_report_md: str,
    ) -> bool:
        """
        public.guru_reports 테이블에 전체 리포트 본문(데이터팩, 13인요약, 토론, 최종보고서) 저장
        추후 어날리시스(Analysis) 및 웹 뷰어에서 본문과 지표를 조회할 수 있습니다.
        """
        if not self._client:
            logger.info(f"[Supabase] 설정 미제공 — guru_reports 건너뜀: {ticker} ({date_str})")
            return False

        report_id = f"{date_str}_{ticker.upper()}"
        row = {
            "id": report_id,
            "d": date_str,
            "ticker": ticker.upper(),
            "company_name": company_name,
            "current_price": current_price,
            "verdict": verdict,
            "overall_score": overall_score,
            "vote_summary": vote_summary,
            "datapack": datapack_dict,
            "summaries": summaries_list,
            "discussion": discussion_md,
            "final_report": final_report_md,
        }

        try:
            self._client.table("guru_reports").upsert(row).execute()
            logger.info(f"[Supabase] guru_reports 본문 저장 성공: {report_id}")
            return True
        except Exception as e:
            logger.error(f"[Supabase] guru_reports 저장 실패 ({report_id}): {e}")
            return False

    async def save_guru_votes(
        self,
        date_str: str,
        ticker: str,
        name: str,
        overall_score: int,
        scores_by_guru: dict[str, int],  # {g1: 0, g2: 1, ... g13: 2}
        screeners: list[str] | None = None,
    ) -> bool:
        """
        public.guru_votes 테이블에 13인의 거장 표결 결과 upsert (스크리너 대시보드 랭킹 연동)
        """
        if not self._client:
            logger.info(f"[Supabase] 설정 미제공 — guru_votes 건너뜀: {ticker} ({date_str})")
            return False

        row = {
            "d": date_str,
            "ticker": ticker.upper(),
            "name": name,
            "nation": "us",
            "screeners": screeners or ["공통"],
            "g0": overall_score,
        }

        # g1 ~ g13 채우기
        for i in range(1, 14):
            key = f"g{i}"
            if key in scores_by_guru:
                row[key] = scores_by_guru[key]

        try:
            self._client.table("guru_votes").upsert(row).execute()
            logger.info(f"[Supabase] guru_votes 점수 저장 성공: {ticker} (g0={overall_score})")
            return True
        except Exception as e:
            logger.error(f"[Supabase] guru_votes 저장 실패 ({ticker}): {e}")
            return False
