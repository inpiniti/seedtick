"""
Supabase 저장소: guru_votes 테이블 및 리포트 메타데이터 동기화
"""
import logging
from datetime import datetime, timedelta, timezone
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

    def save_log_sync(
        self,
        level: str,
        message: str,
        code: str = "LOG",
        context: dict | None = None,
        logger_name: str | None = None,
    ) -> bool:
        """
        public.error_logs 테이블에 동기적으로 단일 로그 이벤트 저장
        """
        if not self._client:
            return False

        row = {
            "level": level.upper(),
            "message": message,
            "code": code,
            "context": context or {},
            "logger_name": logger_name or "",
        }

        try:
            self._client.table("error_logs").insert(row).execute()
            return True
        except Exception as e:
            # 로깅 핸들러 내에서 호출될 수 있으므로 무한루프 방지를 위해 sys.stderr에만 출력하거나 안전 처리
            return False

    def save_logs_batch_sync(self, rows: list[dict]) -> bool:
        """
        public.error_logs 테이블에 여러 로그 이벤트를 일괄(batch) 저장
        """
        if not self._client or not rows:
            return False

        try:
            self._client.table("error_logs").insert(rows).execute()
            return True
        except Exception:
            return False

    async def save_log(
        self,
        level: str,
        message: str,
        code: str = "LOG",
        context: dict | None = None,
        logger_name: str | None = None,
    ) -> bool:
        """
        public.error_logs 테이블에 비동기적으로 단일 로그 이벤트 저장
        """
        return self.save_log_sync(
            level=level,
            message=message,
            code=code,
            context=context,
            logger_name=logger_name,
        )

    def delete_old_info_logs(self, hours: int = 24) -> int:
        """
        지정된 시간(기본 24시간) 이전의 INFO 레벨 시스템 로그 삭제
        - WARNING, ERROR, CRITICAL 로그는 감사 및 장애 분석을 위해 영구 보존
        - 반환값: 삭제된 로그 레코드 수
        """
        if not self._client:
            logger.info("[Supabase] 클라이언트 미연결 — 로그 정리 건너뜀")
            return 0

        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        try:
            res = (
                self._client.table("error_logs")
                .delete()
                .eq("level", "INFO")
                .lt("created_at", cutoff)
                .execute()
            )
            deleted_count = len(res.data) if res.data else 0
            logger.info(
                f"[Supabase] {hours}시간 이전 INFO 로그 정리 완료 "
                f"({deleted_count}건 삭제, 기준시각: {cutoff})"
            )
            return deleted_count
        except Exception as e:
            logger.error(f"[Supabase] INFO 로그 정리 중 오류 발생: {e}")
            return 0

    # ── Grid Trading 영속성 ──────────────────────────────
    def save_grid_trade(self, item) -> None:
        """신규 그리드 감지 종목 저장"""
        data = {
            "ticker": item.ticker,
            "initial_price": float(item.initial_price),
            "gap": float(item.gap),
            "last_trade_price": float(item.last_trade_price),
            "order_amount_krw": item.order_amount_krw,
            "status": item.status,
            "holdings_qty": float(item.holdings_qty),
            "total_buy_count": item.total_buy_count,
            "total_sell_count": item.total_sell_count,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if not hasattr(self, "_in_memory_grid_trades"):
            self._in_memory_grid_trades = {}
        self._in_memory_grid_trades[item.ticker] = data

        if not self._client:
            return

        try:
            self._client.table("grid_trades").upsert(data, on_conflict="ticker").execute()
            logger.info(f"[Supabase] grid_trades 저장 완료: {item.ticker}")
        except Exception as e:
            logger.error(f"[Supabase] grid_trades 저장 실패 ({item.ticker}): {e}")

    def update_grid_trade(self, item) -> None:
        """그리드 감지 종목 상태/가격 갱신"""
        self.save_grid_trade(item)

    def get_active_grid_trades(self) -> list:
        """감지 중(ACTIVE)인 그리드 종목 목록 조회"""
        from app.domains.auto_trading.grid_models import GridTradeItem

        if not hasattr(self, "_in_memory_grid_trades"):
            self._in_memory_grid_trades = {}

        if not self._client:
            return [
                GridTradeItem(**v)
                for v in self._in_memory_grid_trades.values()
                if v.get("status") == "ACTIVE"
            ]

        try:
            res = (
                self._client.table("grid_trades")
                .select("*")
                .eq("status", "ACTIVE")
                .execute()
            )
            items = []
            for row in res.data or []:
                items.append(GridTradeItem(**row))
                self._in_memory_grid_trades[row["ticker"]] = row
            return items
        except Exception as e:
            logger.warning(f"[Supabase] grid_trades 조회 실패 -> 메모리 캐시 폴백: {e}")
            return [
                GridTradeItem(**v)
                for v in self._in_memory_grid_trades.values()
                if v.get("status") == "ACTIVE"
            ]

    def get_all_grid_trades(self) -> list:
        """모든 그리드 종목 목록 조회 (ACTIVE, FINISHED 포함)"""
        from app.domains.auto_trading.grid_models import GridTradeItem

        if not hasattr(self, "_in_memory_grid_trades"):
            self._in_memory_grid_trades = {}

        if not self._client:
            return [GridTradeItem(**v) for v in self._in_memory_grid_trades.values()]

        try:
            res = (
                self._client.table("grid_trades")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
            items = []
            for row in res.data or []:
                items.append(GridTradeItem(**row))
                self._in_memory_grid_trades[row["ticker"]] = row
            return items
        except Exception as e:
            logger.warning(f"[Supabase] grid_trades 전체 조회 실패 -> 메모리 캐시 폴백: {e}")
            return [GridTradeItem(**v) for v in self._in_memory_grid_trades.values()]


supabase_repo = SupabaseRepo()


