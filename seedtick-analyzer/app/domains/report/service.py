"""
GuruReportService: 13인의 거장 심층 투자 보고서 4단계 파이프라인 오케스트레이터
"""
import asyncio
import hashlib
import logging
from datetime import date as dt_date
from pathlib import Path
import re

from app.config.constants import GURU_REPORT_ROSTER, VERDICT_SCORE_MAP
from app.config.settings import settings
from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.datapack_builder import DataPackBuilder
from app.domains.report.discussion_engine import DiscussionEngine
from app.domains.report.value_driver_generator import ValueDriverGenerator
from app.domains.report.models import (
    FinalMasterReport,
    GuruSummaryDoc,
    PersonaSummaryBlock,
    StockDataPack,
)
from app.domains.report.personas.prompts import build_persona_prompt
from app.domains.report.pipeline_progress import PipelineProgressTracker
from app.domains.screener.logo_warmup_service import logo_warmup_service
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
        progress: PipelineProgressTracker | None = None,
    ):
        self.base_report_dir = Path(base_report_dir)
        # 진행 상태 추적기 (지정 시 4단계 진행률을 실시간으로 기록)
        self.progress = progress
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
        self,
        ticker: str,
        target_date: str | None = None,
        screeners: list[str] | None = None,
    ) -> FinalMasterReport:
        """
        13인 거장 4단계 파이프라인 전체 실행:
        ① 공용 심층 데이터 팩 (_data/{ticker}.md)
        ② 13인 개별 요약 블록 (_data/{ticker}_요약.md) [최대 concurrency 동시 처리]
        ③ 최종 종합 투자 보고서 (최종/{ticker}_최종보고서.md)
        ④ Supabase DB 동기화 (guru_votes)
        """
        clean_ticker = ticker.upper().strip()
        date_str = target_date or dt_date.today().isoformat()
        report_model = (settings.AI_REPORT_MODEL or settings.AI_GATEWAY_MODEL).strip()
        report_temperature = settings.AI_REPORT_TEMPERATURE
        logger.info(f"[{clean_ticker}] 4단계 Guru Report 파이프라인 시작 (기준일: {date_str})")
        logger.info(
            f"[{clean_ticker}] 보고서 모델 고정: {report_model} "
            f"(temperature={report_temperature})"
        )

        # ── 1단계: 공용 심층 데이터 팩 작성 ───────────────────
        if self.progress:
            self.progress.set_stage("datapack", f"[{clean_ticker}] 심층 데이터팩 수집")
        datapack = await self.datapack_builder.build(clean_ticker, date_str)

        # ── 1-1단계: 가치 드라이버 및 최신 시장 촉매(Catalysts) 동적 발굴 ────
        if self.progress:
            self.progress.set_stage("value_driver")
        try:
            vd_markdown = await self.value_driver_generator.generate_value_drivers(
                datapack,
                date_str,
                model_override=report_model,
                pin_model=True,
                temperature_override=report_temperature,
            )
            datapack.value_drivers = vd_markdown
            # 가치 드라이버를 데이터팩 마크다운에 통합 및 파일 갱신
            datapack.raw_markdown = self.datapack_builder._render_markdown(datapack)
            if datapack.file_path:
                Path(datapack.file_path).write_text(datapack.raw_markdown, encoding="utf-8")
            logger.info(f"[{clean_ticker}] 데이터팩에 가치 드라이버 병합 및 갱신 완료")
        except Exception as e:
            logger.warning(f"[{clean_ticker}] 가치 드라이버 생성 실패(계속 진행): {e}")

        # ── 2단계: 13인 개별 요약 블록 생성 (최대 concurrency개 동시 병렬 실행) ───
        if self.progress:
            self.progress.set_stage("summaries")
        summary_doc = await self.generate_guru_summaries(
            datapack,
            model_override=report_model,
            temperature_override=report_temperature,
        )

        # ── 3단계: 최종 종합 투자 보고서 생성 ──────────────────
        logger.info(f"[{clean_ticker}] 3단계: 최종 종합 마스터 투자 보고서 생성 시작...")
        if self.progress:
            self.progress.set_stage("master")
        if self.request_interval > 0:
            await asyncio.sleep(self.request_interval)
        master_report = await self.discussion_engine.generate_master_report(
            datapack,
            summary_doc,
            model_override=report_model,
            temperature_override=report_temperature,
        )
        self._save_master_report_file(master_report)
        logger.info(
            f"[{clean_ticker}] 3단계: 최종 마스터 보고서 저장 완료 "
            f"(판정: {master_report.overall_verdict}, 점수: {master_report.overall_score})"
        )

        # ── 4단계: Supabase DB 동기화 ────────────────────────
        if self.progress:
            self.progress.set_stage("sync")
        await self.sync_to_db(
            clean_ticker,
            date_str,
            datapack,
            summary_doc,
            master_report,
            screeners=screeners,
            analysis_model=report_model,
            analysis_temperature=report_temperature,
        )

        logger.info(
            f"[{clean_ticker}] 4단계 파이프라인 완료! "
            f"(종합: {master_report.overall_verdict} / {master_report.vote_summary})"
        )
        return master_report

    async def generate_guru_summaries(
        self,
        datapack: StockDataPack,
        model_override: str | None = None,
        temperature_override: float | None = None,
    ) -> GuruSummaryDoc:
        """
        13인 거장별 페르소나 프롬프트를 조립하여 AI 클라이언트를 최대 concurrency(기본 13)개 동시 병렬 처리합니다.
        AI-Gateway의 키 로테이션 능력을 활용하여 빠르고 안정적으로 요약 블록을 완성합니다.
        """
        date_str = datapack.date
        ticker = datapack.ticker
        personas_list = [persona_key for _, persona_key in GURU_REPORT_ROSTER]
        total_gurus = len(personas_list)

        logger.info(
            f"[{ticker}] 13인 거장 요약 분석 시작 (총 {total_gurus}명, 동시 처리 한도: {self.concurrency}개)"
        )
        if self.progress:
            self.progress.set_guru_progress(0, total_gurus)

        semaphore = asyncio.Semaphore(self.concurrency)

        async def _fetch_with_sem(idx: int, p_key: str) -> tuple[int, PersonaSummaryBlock]:
            # 거장 간 동시 호출로 인한 429 버스트 방지 (순차 출발 간격)
            if self.request_interval > 0:
                await asyncio.sleep((idx - 1) * self.request_interval)

            async with semaphore:
                logger.info(f"[{ticker}] ({idx}/{total_gurus}) 거장 '{p_key}' 분석 시작...")
                try:
                    block = await self._fetch_single_persona_summary(
                        p_key,
                        datapack.raw_markdown,
                        model_override=model_override,
                        temperature_override=temperature_override,
                    )  # compact 변환은 내부에서 처리
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
                        parse_mode="fallback",
                    )

                if self.progress:
                    self.progress.tick_guru()

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
            if block.parse_mode == "fallback":
                md_blocks.extend([
                    f"### {block.persona}",
                    "**응답 상태**: 미응답 — 표결·가격 집계 제외",
                    "",
                ])
                continue
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
        self,
        persona_key: str,
        datapack_md: str,
        model_override: str | None = None,
        temperature_override: float | None = None,
    ) -> PersonaSummaryBlock:
        # 뉴스, IR 일정, 재무제표, 밸류에이션, 가치드라이버가 모두 포함된 전체 데이터팩 전달
        prompt = build_persona_prompt(persona_key, datapack_md)
        text = await self.ai.chat(
            prompt,
            model_override=model_override,
            pin_model=bool(model_override),
            temperature_override=temperature_override,
        )
        block = self._parse_summary_block(persona_key, text)
        block.raw_text = text
        return block

    def _parse_summary_block(self, persona_key: str, text: str) -> PersonaSummaryBlock:
        from app.domains.report.structuring import (
            extract_json_object,
            parse_number,
            parse_price_range,
            format_price_range,
            as_str_list,
        )

        # ── 1. JSON 구조화 파싱 우선 시도 ──
        parsed_json = extract_json_object(text)
        if parsed_json and isinstance(parsed_json, dict):
            raw_v = parsed_json.get("verdict")
            cand_v = str(raw_v).strip().strip("*_`") if raw_v else ""
            verdict_norm = {
                "BUY": "매수", "STRONG_BUY": "매수", "매수": "매수",
                "HOLD": "보유", "NEUTRAL": "보유", "보유": "보유",
                "WATCH": "관망", "WAIT": "관망", "관망": "관망",
                "SELL": "매도", "STRONG_SELL": "매도", "매도": "매도",
            }
            cand_v_upper = cand_v.upper()
            verdict = verdict_norm.get(cand_v, verdict_norm.get(cand_v_upper, "관망"))
            is_valid_verdict = cand_v in verdict_norm or cand_v_upper in verdict_norm

            try:
                conf = int(parsed_json.get("confidence", 5))
                confidence = max(1, min(10, conf))
            except (ValueError, TypeError):
                confidence = 5

            args = as_str_list(parsed_json.get("core_arguments"), limit=5)
            low = parse_number(parsed_json.get("target_price_low"))
            high = parse_number(parsed_json.get("target_price_high"))

            # 만약 low/high가 직접 안 주어졌으면 target_price_range 텍스트에서 파싱
            tp_text = parsed_json.get("target_price_range")
            if low is None and high is None and tp_text:
                low, high = parse_price_range(tp_text)

            trigs = as_str_list(parsed_json.get("trigger_conditions"), limit=3)
            q = str(parsed_json.get("quote") or "").strip().strip('*_`"\'')

            if not q and args:
                q = f"{persona_key}의 원칙에 따라 분석: {args[0][:40]}..."
            elif not q:
                q = f"{persona_key}의 원칙에 따라 신중하게 평가했다."

            if not args:
                args = ["재무 펀더멘털 및 가치평가 데이터 기반 종합 평가"]

            target_range_str = format_price_range(low, high) or (str(tp_text).strip() if tp_text else None)

            return PersonaSummaryBlock(
                persona=persona_key,
                verdict=verdict,
                confidence=confidence,
                core_arguments=args,
                target_price_range=target_range_str,
                target_price_low=low,
                target_price_high=high,
                trigger_conditions=trigs,
                quote=q,
                parse_mode="json" if is_valid_verdict else "fallback",
            )

        # ── 2. 기존 정규식 텍스트 파싱 폴백 ──
        verdict = "관망"
        confidence = 5
        arguments: list[str] = []
        target_price = None
        trigger_conditions: list[str] = []
        quote = ""

        # 1. 의견 정규식 (매수 / 보유 / 관망 / 매도 / BUY / HOLD / WATCH / SELL)
        v_match = re.search(r"(?:의견|Verdict)[:\s\*]*((?:매수|보유|관망|매도|BUY|HOLD|WATCH|SELL))", text, re.IGNORECASE)
        if v_match:
            raw_v_match = v_match.group(1).strip()
            verdict = {"BUY": "매수", "HOLD": "보유", "WATCH": "관망", "SELL": "매도"}.get(raw_v_match.upper(), raw_v_match)

        # 2. 확신도 정규식 (1~10)
        c_match = re.search(r"(?:확신도|Confidence)[:\s\*]*(\d+)", text, re.IGNORECASE)
        if c_match:
            try:
                confidence = max(1, min(10, int(c_match.group(1))))
            except ValueError:
                pass

        # 3. 적정가 / 목표 가격대 정규식
        tp_match = re.search(r"(?:적정가[/매수\s가격대]*|목표가|Target\s*Price)[:\s\*]*([^\n]+)", text, re.IGNORECASE)
        if tp_match:
            raw_tp = tp_match.group(1).strip().strip("*_`")
            if raw_tp and not raw_tp.lower().startswith(("트리거", "대표", "핵심", "trigger", "quote", "core")):
                target_price = raw_tp

        # 4. 트리거 조건 정규식
        trig_match = re.search(r"(?:트리거[·\s]*재검토\s*조건|트리거\s*조건|Trigger\s*Conditions?)[:\s\*]*([^\n]+)", text, re.IGNORECASE)
        if trig_match:
            raw_trig = trig_match.group(1).strip().strip("*_`")
            if raw_trig and not raw_trig.lower().startswith(("대표", "핵심", "quote", "core")):
                trigger_conditions.append(raw_trig)

        # 5. 대표 발언 정규식
        q_match = re.search(r"(?:대표\s*발언|한줄\s*평|Quote)[:\s\*]*([^\n]+)", text, re.IGNORECASE)
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
            clean_lower = clean_line.lower()
            if any(k in clean_line for k in ["핵심 논거", "핵심논거", "투자 논거"]) or "core arguments" in clean_lower:
                in_args = True
                continue
            if in_args:
                # 다음 섹션 시작 키워드 감지 시 중단
                if any(k in clean_line for k in ["적정가", "트리거", "대표 발언", "대표발언", "우려 사항", "우려 요인"]) or any(k in clean_lower for k in ["target price", "trigger", "quote"]):
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

        low, high = parse_price_range(target_price)

        return PersonaSummaryBlock(
            persona=persona_key,
            verdict=verdict,
            confidence=confidence,
            core_arguments=arguments[:5],
            target_price_range=target_price,
            target_price_low=low,
            target_price_high=high,
            trigger_conditions=trigger_conditions[:3],
            quote=quote,
            parse_mode="regex" if v_match else "fallback",
        )

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
        report: FinalMasterReport,
        screeners: list[str] | None = None,
        analysis_model: str | None = None,
        analysis_temperature: float | None = None,
    ) -> None:
        """
        1. guru_reports 테이블에 전체 리포트 본문(데이터팩, 13인요약, 최종보고서) 저장
        2. guru_votes 테이블에 13인 표결 점수(g0~g13) 저장
        """
        # 공식 13인 roster와 DB의 g1~g13 슬롯을 일대일로 매핑한다.
        scores_by_guru: dict[str, int] = {}
        persona_map = {s.persona: s.verdict for s in summaries.summaries}

        for idx, (_, persona_key) in enumerate(GURU_REPORT_ROSTER, start=1):
            verdict_val = persona_map.get(persona_key, "관망")
            scores_by_guru[f"g{idx}"] = VERDICT_SCORE_MAP.get(verdict_val, 2)

        report.persona_scores = scores_by_guru

        # 1. guru_reports 본문 저장 (추후 어날리시스 및 상세 조회용)
        input_fingerprint = hashlib.sha256(
            datapack.raw_markdown.encode("utf-8")
        ).hexdigest()
        datapack_dict = {
            "current_price": datapack.current_price,
            "overview": datapack.overview,
            "income_annual": [r.model_dump() for r in datapack.income_annual],
            "cashflow_annual": [c.model_dump() for c in datapack.cashflow_annual],
            "balance_sheet": datapack.balance_sheet.model_dump(),
            "valuation": datapack.valuation.model_dump(),
            "valuation_consensus": {
                "fair_value_price": report.fair_value_price,
                "target_price_band": report.target_price_band,
                "safety_entry_price": report.safety_entry_price,
                "optimistic_target_price": report.optimistic_target_price,
                "review_flags": report.valuation_review_flags,
                "dispersion_pct": report.valuation_dispersion_pct,
                "price_estimate_count": report.valuation_estimate_count,
                "method": report.action_guide.get("fair_value_method"),
            },
            "market_metrics": datapack.market_metrics,
            "analyst_consensus": datapack.analyst_consensus,
            "news_items": datapack.news_items,
            "ir_schedule": datapack.ir_schedule,
            "value_drivers": datapack.value_drivers,
            "analysis_metadata": {
                "model": analysis_model,
                "temperature": analysis_temperature,
                "prompt_version": settings.REPORT_PROMPT_VERSION,
                "decision_policy": "robust-consensus-v2",
                "input_fingerprint": input_fingerprint,
            },
        }
        summaries_list = [s.model_dump() for s in summaries.summaries]

        from app.domains.report.structuring import (
            build_report_columns,
            build_opinion_rows,
            build_metrics_row,
        )

        extra_cols = build_report_columns(
            current_price=datapack.current_price,
            summaries=summaries_list,
            fair_value=report.fair_value_price,
            target_price_band=report.target_price_band,
            safety_entry_price=report.safety_entry_price,
            optimistic_target_price=report.optimistic_target_price,
            band_low=getattr(report, "band_low", None),
            band_high=getattr(report, "band_high", None),
            safety_entry_value=getattr(report, "safety_entry_value", None),
            target_sell_value=getattr(report, "target_sell_value", None),
            conclusion=getattr(report, "conclusion", ""),
            hot_topics=getattr(report, "hot_topics", []),
            bull_points=getattr(report, "bull_points", []),
            bear_points=getattr(report, "bear_points", []),
            key_drivers=getattr(report, "key_drivers", []),
            action_guide=getattr(report, "action_guide", {}),
            review_flags=getattr(report, "valuation_review_flags", []),
            parse_mode=getattr(report, "parse_mode", "regex"),
            prompt_version=settings.REPORT_PROMPT_VERSION,
        )

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
            final_report_md=report.raw_markdown,
            extra_columns=extra_cols,
        )

        # 1-1. 세분화 데이터: guru_opinions 및 report_metrics 저장
        report_id = f"{date_str}_{ticker.upper()}"
        raw_texts = {s.persona: s.raw_text for s in summaries.summaries if s.raw_text}
        opinion_rows = build_opinion_rows(
            report_id=report_id,
            date_str=date_str,
            ticker=ticker,
            current_price=datapack.current_price,
            summaries=summaries_list,
            prompt_version=settings.REPORT_PROMPT_VERSION,
            raw_texts=raw_texts,
        )
        op_res = self.supabase.save_opinions(opinion_rows)
        if asyncio.iscoroutine(op_res):
            await op_res

        metrics_row = build_metrics_row(
            report_id=report_id,
            date_str=date_str,
            ticker=ticker,
            datapack=datapack_dict,
        )
        met_res = self.supabase.save_metrics(metrics_row)
        if asyncio.iscoroutine(met_res):
            await met_res

        # 2. guru_votes 점수 저장 (스크리너 랭킹 연동)
        await self.supabase.save_guru_votes(
            date_str=date_str,
            ticker=ticker,
            name=datapack.company_name,
            overall_score=report.overall_score,
            scores_by_guru=scores_by_guru,
            screeners=screeners or ["공통"],
        )

        # 로고 캐시 백그라운드 갱신 대상 큐에 추가 (중복 자동 제거)
        await logo_warmup_service.enqueue_tickers([ticker])
