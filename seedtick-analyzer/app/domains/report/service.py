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
from app.domains.report.value_driver_generator import ValueDriverGenerator
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
        self.value_driver_generator = ValueDriverGenerator(self.ai, base_report_dir)
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

        # ── 1-1단계: 가치 드라이버 및 최신 시장 촉매(Catalysts) 동적 발굴 ────
        try:
            vd_markdown = await self.value_driver_generator.generate_value_drivers(datapack, date_str)
            datapack.value_drivers = vd_markdown
            # 가치 드라이버를 데이터팩 마크다운에 통합 및 파일 갱신
            datapack.raw_markdown = self.datapack_builder._render_markdown(datapack)
            if datapack.file_path:
                Path(datapack.file_path).write_text(datapack.raw_markdown, encoding="utf-8")
            logger.info(f"[{clean_ticker}] 데이터팩에 가치 드라이버 병합 및 갱신 완료")
        except Exception as e:
            logger.warning(f"[{clean_ticker}] 가치 드라이버 생성 실패(계속 진행): {e}")

        # ── 2단계: 13인 개별 요약 블록 생성 (최대 concurrency개 동시 병렬 실행) ───
        summary_doc = await self.generate_guru_summaries(datapack)

        # ── 3단계: 거장 원탁 토론 전문 생성 ───────────────────
        logger.info(f"[{clean_ticker}] 3단계: 13인 거장 원탁 토론 전문 생성 시작...")
        if self.request_interval > 0:
            await asyncio.sleep(self.request_interval)
        discussion_doc = await self.discussion_engine.generate_discussion(datapack, summary_doc)
        self._save_discussion_file(discussion_doc)
        logger.info(
            f"[{clean_ticker}] 3단계: 원탁 토론 전문 저장 완료 "
            f"(길이: {len(discussion_doc.raw_markdown)}자, 경로: {discussion_doc.file_path})"
        )

        # ── 4단계: 최종 종합 투자 보고서 생성 ──────────────────
        logger.info(f"[{clean_ticker}] 4단계: 최종 종합 마스터 투자 보고서 생성 시작...")
        if self.request_interval > 0:
            await asyncio.sleep(self.request_interval)
        master_report = await self.discussion_engine.generate_master_report(
            datapack, summary_doc, discussion_doc
        )
        self._save_master_report_file(master_report)
        logger.info(
            f"[{clean_ticker}] 4단계: 최종 마스터 보고서 저장 완료 "
            f"(판정: {master_report.overall_verdict}, 점수: {master_report.overall_score})"
        )

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
        text = await self.ai.chat(prompt, max_tokens=800)
        return self._parse_summary_block(persona_key, text)

    def _parse_summary_block(self, persona_key: str, text: str) -> PersonaSummaryBlock:
        # 형식 파싱: 인물: {persona} | 의견: {verdict} | 확신도: {conf}
        verdict = "관망"
        confidence = 5
        arguments: list[str] = []
        target_price = None
        trigger_conditions: list[str] = []
        quote = ""

        # 1. 의견 정규식 (매수 / 보유 / 관망 / 매도)
        v_match = re.search(r"의견[:\s\*]*([매수|보유|관망|매도]+)", text)
        if v_match:
            cand = v_match.group(1).strip()
            if cand in ["매수", "보유", "관망", "매도"]:
                verdict = cand

        # 2. 확신도 정규식 (1~10)
        c_match = re.search(r"확신도[:\s\*]*(\d+)", text)
        if c_match:
            try:
                confidence = max(1, min(10, int(c_match.group(1))))
            except ValueError:
                pass

        # 3. 적정가 / 목표 가격대 정규식
        tp_match = re.search(r"(?:적정가[/매수\s가격대]*|목표가)[:\s\*]*([^\n]+)", text)
        if tp_match:
            raw_tp = tp_match.group(1).strip().strip("*_`")
            if raw_tp and not raw_tp.startswith(("트리거", "대표", "핵심")):
                target_price = raw_tp

        # 4. 트리거 조건 정규식
        trig_match = re.search(r"(?:트리거[·\s]*재검토\s*조건|트리거\s*조건)[:\s\*]*([^\n]+)", text)
        if trig_match:
            raw_trig = trig_match.group(1).strip().strip("*_`")
            if raw_trig and not raw_trig.startswith(("대표", "핵심")):
                trigger_conditions.append(raw_trig)

        # 5. 대표 발언 정규식
        q_match = re.search(r"(?:대표\s*발언|한줄\s*평)[:\s\*]*([^\n]+)", text)
        if q_match:
            raw_q = q_match.group(1).strip().strip('*_`"\'')
            if raw_q:
                quote = raw_q

        # 6. 핵심 논거 추출 (불릿 또는 문단 형태 모두 유연하게 처리)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        in_args = False
        raw_arg_lines: list[str] = []

        for line in lines:
            clean_line = line.strip().strip("*#_`")
            if any(k in clean_line for k in ["핵심 논거", "핵심논거", "투자 논거"]):
                in_args = True
                continue
            if in_args:
                # 다음 섹션 시작 키워드 감지 시 중단
                if any(k in clean_line for k in ["적정가", "트리거", "대표 발언", "대표발언", "우려 사항", "우려 요인"]):
                    in_args = False
                    continue

                # 불릿 기호 제거 및 라인 수집
                stripped = re.sub(r"^[-*•\d\.\s]+", "", line).strip().strip("*_`")
                if stripped and len(stripped) >= 10:
                    raw_arg_lines.append(stripped)

        # 불릿으로 나뉜 항목들 추가
        for arg in raw_arg_lines:
            if arg not in arguments:
                arguments.append(arg)

        # 만약 불릿이 없어 arguments가 비었을 경우 본문에서 팩트 문장 추출
        if not arguments:
            for line in lines:
                clean = re.sub(r"^[-*•\d\.\s]+", "", line).strip().strip("*_`")
                # 헤더성 라인 건너뛰기
                if any(clean.startswith(k) for k in ["인물:", "의견:", "핵심", "적정가", "트리거", "대표", "http", "#"]):
                    continue
                if len(clean) >= 20 and clean not in arguments:
                    arguments.append(clean)
                if len(arguments) >= 3:
                    break

        # 대표 발언이 파싱되지 않은 경우 논거의 핵심 문장으로 대체
        if not quote and arguments:
            quote = f"{persona_key}의 원칙에 따라 분석: {arguments[0][:40]}..."
        elif not quote:
            quote = f"{persona_key}의 원칙에 따라 신중하게 평가했다."

        if not arguments:
            arguments = ["재무 펀더멘털 및 가치평가 데이터 기반 종합 평가"]

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
            "news_items": datapack.news_items,
            "value_drivers": datapack.value_drivers,
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
