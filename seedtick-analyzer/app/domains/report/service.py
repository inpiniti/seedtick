"""
GuruReportService: 13인의 거장 심층 투자 보고서 5단계 파이프라인 오케스트레이터
"""
import asyncio
import logging
from datetime import date as dt_date
from pathlib import Path
import re

from app.config.constants import GURU_NAMES, VERDICT_SCORE_MAP
from app.config.settings import settings
from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.datapack_builder import DataPackBuilder
from app.domains.report.discussion_engine import DiscussionEngine
from app.domains.report.models import (
    FinalMasterReport,
    GuruDiscussionDoc,
    GuruSummaryDoc,
    PersonaSummaryBlock,
    StockDataPack,
)
from app.domains.report.personas.prompts import GURU_PERSONAS, build_persona_prompt
from app.infrastructure.supabase_repo import SupabaseRepo

logger = logging.getLogger("guru_report_service")


class GuruReportService:
    def __init__(
        self,
        datapack_builder: DataPackBuilder | None = None,
        ai_client: AiGatewayClient | None = None,
        supabase_repo: SupabaseRepo | None = None,
        base_report_dir: str | Path = "docs/report",
        request_interval: float | None = None,
        concurrency: int | None = None,
    ):
        self.base_report_dir = Path(base_report_dir)
        self.datapack_builder = datapack_builder or DataPackBuilder(base_report_dir)
        self.ai = ai_client or AiGatewayClient()
        self.discussion_engine = DiscussionEngine(self.ai)
        self.supabase = supabase_repo or SupabaseRepo()
        self.request_interval = (
            request_interval if request_interval is not None else settings.AI_REQUEST_INTERVAL_SEC
        )
        self.concurrency = (
            concurrency if concurrency is not None else settings.AI_CONCURRENCY
        )

    async def generate_full_report(
        self, ticker: str, target_date: str | None = None
    ) -> FinalMasterReport:
        """
        13인 거장 5단계 파이프라인 전체 실행:
        ① 공용 심층 데이터 팩 (_data/{ticker}.md)
        ② 13인 개별 요약 블록 (_data/{ticker}_요약.md) [최대 concurrency 동시 처리]
        ③ 거장 원탁 토론 전문 (최종/{ticker}_토론.md)
        ④ 최종 종합 투자 보고서 (최종/{ticker}_최종보고서.md)
        ⑤ Supabase DB 동기화 (guru_votes)
        """
        clean_ticker = ticker.upper().strip()
        date_str = target_date or dt_date.today().isoformat()
        logger.info(f"[{clean_ticker}] 5단계 Guru Report 파이프라인 시작 (기준일: {date_str})")

        # ── 1단계: 공용 심층 데이터 팩 작성 ───────────────────
        datapack = await self.datapack_builder.build(clean_ticker, date_str)

        # ── 2단계: 13인 개별 요약 블록 생성 (최대 concurrency개 동시 병렬 실행) ───
        summary_doc = await self.generate_guru_summaries(datapack)

        # ── 3단계: 거장 원탁 토론 전문 생성 ───────────────────
        if self.request_interval > 0:
            await asyncio.sleep(self.request_interval)
        discussion_doc = await self.discussion_engine.generate_discussion(datapack, summary_doc)
        self._save_discussion_file(discussion_doc)

        # ── 4단계: 최종 종합 투자 보고서 생성 ──────────────────
        if self.request_interval > 0:
            await asyncio.sleep(self.request_interval)
        master_report = await self.discussion_engine.generate_master_report(
            datapack, summary_doc, discussion_doc
        )
        self._save_master_report_file(master_report)

        # ── 5단계: Supabase DB 동기화 ────────────────────────
        await self.sync_to_db(
            clean_ticker, date_str, datapack, summary_doc, discussion_doc, master_report
        )

        logger.info(
            f"[{clean_ticker}] 5단계 파이프라인 완료! "
            f"(종합: {master_report.overall_verdict} / {master_report.vote_summary})"
        )
        return master_report

    async def generate_guru_summaries(self, datapack: StockDataPack) -> GuruSummaryDoc:
        """
        13인 거장별 페르소나 프롬프트를 조립하여 AI-Gateway를 최대 concurrency(기본 10)개 동시 병렬 처리합니다.
        AI-Gateway의 키 로테이션 능력을 활용하여 빠르고 안정적으로 요약 블록을 완성합니다.
        """
        date_str = datapack.date
        ticker = datapack.ticker
        personas_list = list(GURU_PERSONAS.keys())
        total_gurus = len(personas_list)

        logger.info(
            f"[{ticker}] 13인 거장 요약 분석 시작 (총 {total_gurus}명, 동시 처리 한도: {self.concurrency}개)"
        )

        semaphore = asyncio.Semaphore(self.concurrency)

        async def _fetch_with_sem(idx: int, p_key: str) -> tuple[int, PersonaSummaryBlock]:
            async with semaphore:
                logger.info(f"[{ticker}] ({idx}/{total_gurus}) 거장 '{p_key}' 분석 시작...")
                try:
                    block = await self._fetch_single_persona_summary(p_key, datapack.raw_markdown)
                    logger.info(
                        f"[{ticker}] 거장 '{p_key}' 분석 완료 -> "
                        f"의견: {block.verdict} (확신도: {block.confidence}/10)"
                    )
                except Exception as e:
                    logger.warning(
                        f"[{ticker}] 거장 '{p_key}' 분석 중 오류 발생 ({e}) - 기본값 설정"
                    )
                    block = PersonaSummaryBlock(
                        persona=p_key,
                        verdict="관망",
                        confidence=5,
                        core_arguments=["AI 호출 제한 또는 지연으로 인한 기본값 판정"],
                        quote="데이터를 조금 더 지켜보고 판단하겠다.",
                    )

                if self.request_interval > 0:
                    await asyncio.sleep(self.request_interval)
                return idx, block

        tasks = [
            _fetch_with_sem(idx, p_key)
            for idx, p_key in enumerate(personas_list, start=1)
        ]
        raw_results = await asyncio.gather(*tasks)

        # 원래 페르소나 순서(1~13)대로 정렬 유지
        raw_results.sort(key=lambda x: x[0])
        summaries: list[PersonaSummaryBlock] = [res[1] for res in raw_results]

        md_blocks: list[str] = [
            f"# {ticker} — 13인의 거장 요약 블록",
            f"> 날짜: {date_str} | 종목: {ticker} | 현재가: ${datapack.current_price:.2f}",
            "",
            "---",
            "",
        ]

        for block in summaries:
            md_blocks.extend([
                f"### {block.persona}",
                f"**의견**: {block.verdict} | **확신도**: {block.confidence}/10",
                "**핵심 논거**:",
            ])
            for arg in block.core_arguments:
                md_blocks.append(f"- {arg}")
            if block.target_price_range:
                md_blocks.append(f"**적정가/매수 가격대**: {block.target_price_range}")
            if block.trigger_conditions:
                md_blocks.append(f"**트리거 조건**: {', '.join(block.trigger_conditions)}")
            md_blocks.append(f"**대표 발언**: *\"{block.quote}\"*")
            md_blocks.append("")

        raw_md = "\n".join(md_blocks)

        # 파일 저장: docs/report/{date}/_data/{ticker}_요약.md
        out_dir = self.base_report_dir / date_str / "_data"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{ticker}_요약.md"
        out_file.write_text(raw_md, encoding="utf-8")

        return GuruSummaryDoc(
            ticker=ticker,
            date=date_str,
            summaries=summaries,
            file_path=str(out_file),
            raw_markdown=raw_md,
        )

    async def _fetch_single_persona_summary(
        self, persona_key: str, datapack_md: str
    ) -> PersonaSummaryBlock:
        prompt = build_persona_prompt(persona_key, datapack_md)
        text = await self.ai.chat(prompt)
        return self._parse_summary_block(persona_key, text)

    def _parse_summary_block(self, persona_key: str, text: str) -> PersonaSummaryBlock:
        # 형식 파싱: 인물: {persona} | 의견: {verdict} | 확신도: {conf}
        verdict = "관망"
        confidence = 5
        arguments = []
        target_price = None
        trigger_conditions = []
        quote = ""

        # 의견 및 확신도 정규식
        v_match = re.search(r"의견[:\s]*([매수|보유|관망|매도]+)", text)
        if v_match:
            cand = v_match.group(1).strip()
            if cand in ["매수", "보유", "관망", "매도"]:
                verdict = cand

        c_match = re.search(r"확신도[:\s]*(\d+)", text)
        if c_match:
            try:
                confidence = max(1, min(10, int(c_match.group(1))))
            except ValueError:
                pass

        # 논거 추출
        in_args = False
        for line in text.splitlines():
            line_str = line.strip()
            if "핵심 논거:" in line_str:
                in_args = True
                continue
            if in_args:
                if line_str.startswith("- ") or line_str.startswith("* "):
                    arguments.append(line_str.lstrip("-* ").strip())
                elif any(line_str.startswith(k) for k in ["적정가", "트리거", "대표 발언"]):
                    in_args = False

            if "적정가/매수 가격대:" in line_str:
                target_price = line_str.replace("적정가/매수 가격대:", "").strip()
            elif "트리거" in line_str and ":" in line_str:
                trigger_conditions.append(line_str.split(":", 1)[1].strip())
            elif "대표 발언:" in line_str:
                quote = line_str.replace("대표 발언:", "").strip().strip('"*\'')

        if not arguments:
            arguments = ["재무 펀더멘털 및 가치평가 데이터 기반 종합 평가"]
        if not quote:
            quote = f"{persona_key}의 원칙에 따라 신중하게 평가했다."

        return PersonaSummaryBlock(
            persona=persona_key,
            verdict=verdict,
            confidence=confidence,
            core_arguments=arguments[:3],
            target_price_range=target_price,
            trigger_conditions=trigger_conditions[:2],
            quote=quote,
        )

    def _save_discussion_file(self, doc: GuruDiscussionDoc) -> None:
        out_dir = self.base_report_dir / doc.date / "최종"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{doc.ticker}_토론.md"
        out_file.write_text(doc.raw_markdown, encoding="utf-8")
        doc.file_path = str(out_file)

    def _save_master_report_file(self, report: FinalMasterReport) -> None:
        out_dir = self.base_report_dir / report.date / "최종"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{report.ticker}_최종보고서.md"
        out_file.write_text(report.raw_markdown, encoding="utf-8")
        report.file_path = str(out_file)

    async def sync_to_db(
        self,
        ticker: str,
        date_str: str,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        discussion: GuruDiscussionDoc,
        report: FinalMasterReport,
    ) -> None:
        """
        1. guru_reports 테이블에 전체 리포트 본문(데이터팩, 13인요약, 토론, 최종보고서) 저장
        2. guru_votes 테이블에 13인 표결 점수(g0~g13) 저장
        """
        # g1 ~ g13 점수 매핑
        scores_by_guru: dict[str, int] = {}
        persona_map = {s.persona.replace("-", " "): s.verdict for s in summaries.summaries}

        for idx, guru_name in enumerate(GURU_NAMES, start=1):
            verdict_val = "관망"
            for p_k, v in persona_map.items():
                if any(part in p_k for part in guru_name.split()):
                    verdict_val = v
                    break
            scores_by_guru[f"g{idx}"] = VERDICT_SCORE_MAP.get(verdict_val, 2)

        report.persona_scores = scores_by_guru

        # 1. guru_reports 본문 저장 (추후 어날리시스 및 상세 조회용)
        datapack_dict = {
            "current_price": datapack.current_price,
            "overview": datapack.overview,
            "income_annual": [r.model_dump() for r in datapack.income_annual],
            "cashflow_annual": [c.model_dump() for c in datapack.cashflow_annual],
            "balance_sheet": datapack.balance_sheet.model_dump(),
            "valuation": datapack.valuation.model_dump(),
            "market_metrics": datapack.market_metrics,
            "analyst_consensus": datapack.analyst_consensus,
        }
        summaries_list = [s.model_dump() for s in summaries.summaries]

        await self.supabase.save_full_report(
            date_str=date_str,
            ticker=ticker,
            company_name=datapack.company_name,
            current_price=datapack.current_price,
            verdict=report.overall_verdict,
            overall_score=report.overall_score,
            vote_summary=report.vote_summary,
            datapack_dict=datapack_dict,
            summaries_list=summaries_list,
            discussion_md=discussion.raw_markdown,
            final_report_md=report.raw_markdown,
        )

        # 2. guru_votes 점수 저장 (스크리너 랭킹 연동)
        await self.supabase.save_guru_votes(
            date_str=date_str,
            ticker=ticker,
            name=datapack.company_name,
            overall_score=report.overall_score,
            scores_by_guru=scores_by_guru,
            screeners=["공통"],
        )
