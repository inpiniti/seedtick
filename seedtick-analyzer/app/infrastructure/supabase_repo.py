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
        # korean_name 컬럼 미적용 DB(구 스키마) 감지 시 반복 쿼리/로그 폭주를 막는 서킷브레이커.
        # 최초 1회 42703(korean_name does not exist) 오류를 확인하면 True로 잠근다.
        self._korean_name_column_missing = False
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
        final_report_md: str,
        extra_columns: dict | None = None,
    ) -> bool:
        """
        public.guru_reports 테이블에 전체 리포트 본문(데이터팩, 13인요약, 최종보고서 및 구조화 컬럼) 저장
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
            "final_report": final_report_md,
        }

        # 확장 구조화 컬럼 병합 (DB에 해당 컬럼이 아직 없으면 실패할 수 있으므로 실패 시 기본 컬럼만으로 폴백)
        if extra_columns:
            for k, v in extra_columns.items():
                if v is not None:
                    row[k] = v

        try:
            self._client.table("guru_reports").upsert(row).execute()
            logger.info(f"[Supabase] guru_reports 본문 및 구조화 컬럼 저장 성공: {report_id}")
            return True
        except Exception as e:
            logger.warning(f"[Supabase] guru_reports 확장 저장 실패({e}) -> 기본 컬럼으로 폴백 시도")
            base_row = {
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
                "final_report": final_report_md,
            }
            try:
                self._client.table("guru_reports").upsert(base_row).execute()
                logger.info(f"[Supabase] guru_reports 기본 컬럼 저장 성공: {report_id}")
                return True
            except Exception as e2:
                logger.error(f"[Supabase] guru_reports 기본 저장마저 실패 ({report_id}): {e2}")
                return False

    async def save_opinions(self, rows: list[dict]) -> bool:
        """
        public.guru_opinions 테이블에 13인 개별 평가 상세 행 저장
        """
        if not self._client or not rows:
            return False
        try:
            self._client.table("guru_opinions").upsert(rows, on_conflict="report_id,persona").execute()
            logger.info(f"[Supabase] guru_opinions {len(rows)}건 저장 성공 ({rows[0].get('report_id')})")
            return True
        except Exception as e:
            logger.warning(f"[Supabase] guru_opinions 저장 건너뜀 (테이블 미생성 또는 오류): {e}")
            return False

    async def save_metrics(self, row: dict) -> bool:
        """
        public.report_metrics 테이블에 데이터팩 핵심 재무/시장 지표 숫자 컬럼 저장
        """
        if not self._client or not row:
            return False
        try:
            self._client.table("report_metrics").upsert(row, on_conflict="report_id").execute()
            logger.info(f"[Supabase] report_metrics 저장 성공 ({row.get('report_id')})")
            return True
        except Exception as e:
            logger.warning(f"[Supabase] report_metrics 저장 건너뜀 (테이블 미생성 또는 오류): {e}")
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

    def get_reported_tickers_for_date(self, date_str: str) -> set[str]:
        """
        지정된 날짜(date_str, 예: '2026-10-01')에 이미 guru_reports 또는 guru_votes에
        등록된 종목 티커(대문자) 집합을 반환합니다.
        """
        if not self._client:
            return set()

        reported_tickers: set[str] = set()

        # 1. guru_reports 확인
        try:
            res_reports = (
                self._client.table("guru_reports")
                .select("ticker")
                .eq("d", date_str)
                .execute()
            )
            if res_reports.data:
                for row in res_reports.data:
                    if row.get("ticker"):
                        reported_tickers.add(row["ticker"].upper().strip())
        except Exception as e:
            logger.warning(f"[Supabase] {date_str} guru_reports 등록 종목 확인 중 오류: {e}")

        # 2. guru_votes 확인 (보조)
        try:
            res_votes = (
                self._client.table("guru_votes")
                .select("ticker")
                .eq("d", date_str)
                .execute()
            )
            if res_votes.data:
                for row in res_votes.data:
                    if row.get("ticker"):
                        reported_tickers.add(row["ticker"].upper().strip())
        except Exception as e:
            logger.warning(f"[Supabase] {date_str} guru_votes 등록 종목 확인 중 오류: {e}")

        return reported_tickers

    def list_report_tickers(self, limit: int = 2000) -> list[str]:
        """
        guru_reports 기준 티커 목록을 최신순으로 반환 (중복 제거).
        로고 워밍업 큐 시드에 사용합니다.
        """
        if not self._client:
            return []

        try:
            res = (
                self._client.table("guru_reports")
                .select("ticker")
                .order("created_at", desc=True)
                .limit(max(1, min(limit, 10000)))
                .execute()
            )
            seen: set[str] = set()
            ordered: list[str] = []
            for row in res.data or []:
                ticker = (row.get("ticker") or "").upper().strip()
                if not ticker or ticker in seen:
                    continue
                seen.add(ticker)
                ordered.append(ticker)
            return ordered
        except Exception as e:
            logger.warning(f"[Supabase] guru_reports 티커 목록 조회 실패: {e}")
            return []

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

    # ── Ticker Logo 캐시 ──────────────────────────────
    def get_ticker_logo(self, ticker: str) -> str | None:
        """ticker_logos에서 단일 티커 로고 URL 조회"""
        if not self._client:
            return None

        normalized = (ticker or "").strip().upper()
        if not normalized:
            return None

        try:
            res = (
                self._client.table("ticker_logos")
                .select("logo_image_url")
                .eq("ticker", normalized)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("logo_image_url"):
                return res.data[0]["logo_image_url"]
        except Exception as e:
            logger.warning(f"[Supabase] ticker_logos 단일 조회 실패 ({normalized}): {e}")
        return None

    def get_ticker_logos(self, tickers: list[str]) -> dict[str, str]:
        """ticker_logos에서 여러 티커 로고 URL 조회"""
        if not self._client or not tickers:
            return {}

        normalized = sorted({(t or "").strip().upper() for t in tickers if (t or "").strip()})
        if not normalized:
            return {}

        try:
            res = (
                self._client.table("ticker_logos")
                .select("ticker,logo_image_url")
                .in_("ticker", normalized)
                .execute()
            )
            mapping: dict[str, str] = {}
            for row in res.data or []:
                ticker = (row.get("ticker") or "").strip().upper()
                logo = row.get("logo_image_url")
                if ticker and logo and (logo.startswith("http://") or logo.startswith("https://")):
                    mapping[ticker] = logo
            return mapping
        except Exception as e:
            logger.warning(f"[Supabase] ticker_logos 일괄 조회 실패: {e}")
            return {}

    def upsert_ticker_logo(
        self,
        ticker: str,
        logo_image_url: str | None,
        stock_code: str | None = None,
        source: str = "toss_screener",
        korean_name: str | None = None,
    ) -> bool:
        """ticker_logos에 티커별 로고 URL/한글명 저장/갱신"""
        if not self._client:
            return False

        normalized = (ticker or "").strip().upper()
        logo = (logo_image_url or "").strip()
        name = (korean_name or "").strip()
        # 서킷브레이커가 올라간 DB에는 korean_name을 아예 싣지 않는다(헛 저장/재시도 방지).
        if self._korean_name_column_missing:
            name = ""
        # 로고도 한글명도 없으면 저장할 의미가 없음
        if not normalized or (not logo and not name):
            return False

        row: dict = {
            "ticker": normalized,
            "stock_code": stock_code,
            "logo_image_url": logo or None,
            "source": source,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if name:
            row["korean_name"] = name

        try:
            self._client.table("ticker_logos").upsert(row, on_conflict="ticker").execute()
            return True
        except Exception as e:
            # 구 스키마(korean_name 컬럼 미적용)에서는 한글명 없이 재시도
            if name and ("korean_name" in str(e)):
                self._mark_korean_name_column_missing(e)
                row.pop("korean_name", None)
                if not row.get("logo_image_url"):
                    return False
                try:
                    self._client.table("ticker_logos").upsert(row, on_conflict="ticker").execute()
                    return True
                except Exception as e2:
                    logger.warning(f"[Supabase] ticker_logos 저장 실패 ({normalized}): {e2}")
                    return False
            logger.warning(f"[Supabase] ticker_logos 저장 실패 ({normalized}): {e}")
            return False

    def upsert_ticker_logos(
        self,
        items: list[dict],
    ) -> bool:
        """ticker_logos에 여러 티커 로고 URL 일괄 저장/갱신 (배치)"""
        if not self._client or not items:
            return False

        rows = []
        now = datetime.now(timezone.utc).isoformat()
        for item in items:
            ticker = (item.get("ticker") or "").strip().upper()
            logo = (item.get("logo_image_url") or "").strip()
            name = (item.get("korean_name") or "").strip()
            # 서킷브레이커가 올라간 DB에는 korean_name을 아예 싣지 않는다.
            if self._korean_name_column_missing:
                name = ""
            if not ticker or (not logo and not name):
                continue
            row: dict = {
                "ticker": ticker,
                "stock_code": item.get("stock_code"),
                "logo_image_url": logo or None,
                "source": item.get("source", "toss_screener"),
                "updated_at": now,
            }
            if name:
                row["korean_name"] = name
            rows.append(row)

        if not rows:
            return False

        try:
            self._client.table("ticker_logos").upsert(rows, on_conflict="ticker").execute()
            return True
        except Exception as e:
            if "korean_name" in str(e):
                self._mark_korean_name_column_missing(e)
                for row in rows:
                    row.pop("korean_name", None)
                rows = [r for r in rows if r.get("logo_image_url")]
                if not rows:
                    return False
                try:
                    self._client.table("ticker_logos").upsert(rows, on_conflict="ticker").execute()
                    return True
                except Exception as e2:
                    logger.warning(f"[Supabase] ticker_logos 일괄 저장 실패 ({len(rows)}건): {e2}")
                    return False
            logger.warning(f"[Supabase] ticker_logos 일괄 저장 실패 ({len(rows)}건): {e}")
            return False

    def _mark_korean_name_column_missing(self, err: Exception) -> bool:
        """
        오류가 'korean_name 컬럼 없음(42703)'이면 서킷브레이커를 올리고 True 반환.
        최초 1회에만 경고를 남기고, 이후에는 재쿼리/재시도를 하지 않는다.
        """
        text = str(err)
        if "korean_name" in text and ("42703" in text or "does not exist" in text):
            if not self._korean_name_column_missing:
                self._korean_name_column_missing = True
                logger.warning(
                    "[Supabase] ticker_logos.korean_name 컬럼이 없어 한글명 캐시를 비활성화합니다. "
                    "scripts/migration_ticker_korean_name.sql 을 Supabase SQL Editor에서 실행하면 "
                    "한글명 표시가 활성화됩니다. (로고 캐시는 정상 동작)"
                )
            return True
        return False

    def get_ticker_names(self, tickers: list[str]) -> dict[str, str]:
        """ticker_logos에서 여러 티커 한글명 일괄 조회"""
        if not self._client or not tickers:
            return {}
        # 서킷브레이커: korean_name 컬럼이 없다고 확인된 DB에는 재쿼리하지 않는다.
        if self._korean_name_column_missing:
            return {}

        normalized = sorted({(t or "").strip().upper() for t in tickers if (t or "").strip()})
        if not normalized:
            return {}

        try:
            res = (
                self._client.table("ticker_logos")
                .select("ticker,korean_name")
                .in_("ticker", normalized)
                .execute()
            )
            mapping: dict[str, str] = {}
            for row in res.data or []:
                ticker = (row.get("ticker") or "").strip().upper()
                name = (row.get("korean_name") or "").strip()
                if ticker and name:
                    mapping[ticker] = name
            return mapping
        except Exception as e:
            # 구 스키마(DB에 korean_name 미적용)에서는 빈 결과로 폴백
            if self._mark_korean_name_column_missing(e):
                return {}
            logger.warning(f"[Supabase] ticker_logos 한글명 조회 실패: {e}")
            return {}


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
