"""
DiscussionEngine & MasterReportBuilder: 거장 원탁 토론 전문 및 최종 종합 보고서 생성
"""
import json
import logging
import re
from typing import Any, Literal
from app.config.constants import VERDICT_SCORE_MAP
from app.config.settings import settings
from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.decision_engine import aggregate_report_consensus
from app.domains.report.models import (
    FinalMasterReport,
    GuruDiscussionDoc,
    GuruSummaryDoc,
    StockDataPack,
)

logger = logging.getLogger("discussion_engine")


class DiscussionEngine:
    def __init__(self, ai_client: AiGatewayClient):
        self.ai = ai_client

    async def generate_discussion(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        model_override: str | None = None,
        temperature_override: float | None = None,
    ) -> GuruDiscussionDoc:
        """
        3단계: 13인 거장들의 치열한 원탁 토론 전문 생성
        (기본 설정에서는 비활성 — build_compact_discussion + 마스터 이관으로 대체)
        """
        # 프롬프트 크기 최적화: raw_markdown 전체 대신 핵심만 압축
        # 13인 거장 요약 전문 (모든 논거 및 목표가/트리거 반영)
        compact_summaries = "\n".join(
            (
                f"- {s.persona}: 미응답(표결·가격 집계 제외)"
                if s.parse_mode == "fallback"
                else f"- {s.persona}: {s.verdict}({s.confidence}/10) | 논거: {'; '.join(s.core_arguments)}"
            )
            + (f" | 적정가: {s.target_price_range}" if s.target_price_range else "")
            + (f" | 트리거: {', '.join(s.trigger_conditions)}" if s.trigger_conditions else "")
            for s in summaries.summaries
        )
        consensus = aggregate_report_consensus(summaries.summaries)
        currency = datapack.currency or "USD"
        fair_value_text = (
            f"{consensus.fair_value:,.2f} {currency}"
            if consensus.fair_value is not None
            else "산출 보류"
        )
        band_text = (
            f"{consensus.band_low:,.2f} ~ {consensus.band_high:,.2f} {currency}"
            if consensus.band_low is not None and consensus.band_high is not None
            else "산출 보류"
        )
        dispersion_text = (
            f"{consensus.dispersion_pct:.1f}%"
            if consensus.dispersion_pct is not None
            else "계산 불가"
        )

        prompt = f"""너는 세계 최고의 투자 거장 13인의 원탁 토론 진행자(모더레이터)다.
종목: {datapack.ticker} (현재가: ${datapack.current_price:.2f})

[13인 거장 사전 평가 요약]
{compact_summaries}

[고정 집계 결과 — 변경 금지]
- 종합 의견 및 표결: {consensus.verdict} / {consensus.vote_summary}
- 적정가 중앙값: {fair_value_text}
- 중앙 50% 구간: {band_text}
- 개별 가격 추정 전체 분산: {dispersion_text}
- 검토 플래그: {', '.join(consensus.review_flags) or '없음'}

[진행 규칙]
1. 거장들 사이에서 의견이 팽팽하게 맞서는 핵심 쟁점 2~4개(예: 밸류에이션 고평가 여부, 성장의 지속성, 해자의 견고함, 최신 뉴스/촉매의 실질 영향 등)를 추출하라.
2. 거장들이 서로의 논거와 실측 수치(PER, ROE, FCF, 마진율 등)를 직접 인용하며 치열하게 반박하는 생생하고 깊이 있는 원탁 토론 전문을 작성하라.
   - 예: 버핏과 다모다란의 내재가치 논쟁, 그레이엄과 피셔의 성장성 vs 안전마진 충돌, 버리와 슈웨거의 리스크/추세 공방 등.
3. 13인 거장 전원이 자신만의 고유한 투자 철학에 입각하여 치열하게 반박하고 논쟁하며, 서두부터 결론까지 완결성 있는 풍부한 대화 전문을 작성하라.
4. 개별 적정가 의견의 차이를 설명하되 새로운 적정가나 합의 밴드를 계산하지 마라. 최종 가격은 위 고정 집계 결과만 사용하고, 산출 보류라면 보류라고 써라.
5. 토론 말미에는 위 고정 표결과 종합 의견을 그대로 옮겨 적어라. 숫자나 의견을 새로 집계하지 마라.

[반환 형식]
# {datapack.ticker} — 13인의 거장 원탁 토론 전문
> 날짜: {datapack.date} | 종목: {datapack.ticker} | 현재가: ${datapack.current_price:.2f}

## 1. 토론 핵심 쟁점
- 쟁점 1: ...
- 쟁점 2: ...

## 2. 거장들의 치열한 원탁 토론 (격돌)
(실제 인물들이 대화하는 스크립트 형태)

## 3. 거장들의 적정가 의견 차이 및 고정 집계 결과
- 확정 적정가 중앙값: {fair_value_text}
- 중앙 50% 구간: {band_text}
- 전체 가격 의견 분산: {dispersion_text}
- 검토 필요: {', '.join(consensus.review_flags) or '없음'}

## 4. 고정 표결 결과
- 표결: {consensus.vote_summary}
- 종합 의견: {consensus.verdict}

[작성 절대 규칙]
1. 거장들의 토론과 논쟁이 충분히 전개되어 합의와 표결에 도달하면, 불필요한 반복 꼬리물기 없이 즉시 최종 표결로 수렴(Converge)하여 마크다운 본문을 완결하라.
"""

        logger.info(f"[{datapack.ticker}] 13인 거장 원탁 토론 AI 생성 시작 (32K 지원)...")
        dialogue = await self.ai.chat(
            prompt,
            model_override=model_override,
            pin_model=bool(model_override),
            temperature_override=temperature_override,
        )
        logger.info(f"[{datapack.ticker}] 원탁 토론 AI 생성 완료 (길이: {len(dialogue)}자)")

        # 토론이 AI로 작성되어도 투표 집계는 위 고정 정책을 따른다.
        vote_counts = consensus.vote_counts

        # 만약 AI 응답이 비어있다면 13인 요약 블록을 기반으로 폴백 토론 문서 생성 (DB 빈값 방어)
        if not dialogue or len(dialogue.strip()) < 50:
            logger.warning(
                f"[{datapack.ticker}] 원탁 토론 내용이 비어있음 -> 13인 요약 기반 폴백 토론 문서 생성"
            )
            dialogue = self._build_fallback_discussion(datapack, summaries, vote_counts)

        return GuruDiscussionDoc(
            ticker=datapack.ticker,
            date=datapack.date,
            hot_topics=["밸류에이션 및 안전마진", "성장 동력 및 해자", "리스크 및 다운사이드"],
            dialogue=dialogue,
            final_vote_counts=vote_counts,
            raw_markdown=dialogue,
        )

    def build_compact_discussion(
        self, datapack: StockDataPack, summaries: GuruSummaryDoc
    ) -> GuruDiscussionDoc:
        """
        AI 호출 없이 13인 요약만으로 원탁 토론 문서를 경량 생성한다.
        (기본 설정 ENABLE_ROUND_TABLE_DISCUSSION=False 에서 사용)

        - AI 토론 생성 대신, 쟁점·적정가 합의밴드·표결 요약 도출은 4단계 마스터로 이관
        - DB 컬럼(guru_reports.discussion)과 어드민 '원탁 토론' 탭 호환을 위해 문서 형태 유지
        - 토큰 소비 0 (결정론적 문자열 조립)
        """
        vote_counts = aggregate_report_consensus(summaries.summaries).vote_counts

        lines = [
            f"# {datapack.ticker} — 13인 거장 사전 평가 (원탁 토론 생략 모드)",
            f"> 날짜: {datapack.date} | 종목: {datapack.ticker} | 현재가: ${datapack.current_price:.2f}",
            "> 3단계 AI 원탁 토론은 생략되었습니다. 핵심 쟁점·적정가 합의 밴드·표결 요약은",
            "> 4단계 최종 마스터 보고서에서 13인 요약을 교차검증해 직접 도출합니다.",
            "",
            "## 1. 13인 사전 평가 표",
            "| 인물 | 의견 | 확신도 | 적정가/매수 가격대 | 대표 논거 |",
            "|---|---|---|---|---|",
        ]
        for s in summaries.summaries:
            if s.parse_mode == "fallback":
                lines.append(f"| {s.persona} | 미응답(집계 제외) | — | — | — |")
                continue
            argument = s.core_arguments[0] if s.core_arguments else "재무·가치평가 종합 검토"
            target = s.target_price_range or "—"
            # 마크다운 표 셀 깨짐 방지
            lines.append(
                f"| {s.persona} | {s.verdict} | {s.confidence}/10 | "
                f"{target.replace('|', '/')} | {argument.replace('|', '/')} |"
            )

        lines.extend(
            [
                "",
                "## 2. 표결 집계",
                f"- 매수: {vote_counts['매수']}명 | 보유: {vote_counts['보유']}명 | "
                f"관망: {vote_counts['관망']}명 | 매도: {vote_counts['매도']}명",
                "",
                "## 3. 마스터로 이관된 도출 항목",
                "- 핵심 쟁점 2~3개 / 적정가 합의 밴드(보수·중립·낙관) / 종합 판정 "
                "— 4단계 최종 마스터 보고서에서 직접 도출",
            ]
        )

        raw_markdown = "\n".join(lines)
        return GuruDiscussionDoc(
            ticker=datapack.ticker,
            date=datapack.date,
            hot_topics=["밸류에이션 및 안전마진", "성장 동력 및 해자", "리스크 및 다운사이드"],
            dialogue=raw_markdown,
            final_vote_counts=vote_counts,
            raw_markdown=raw_markdown,
        )

    def _build_fallback_discussion(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        vote_counts: dict[str, int],
    ) -> str:
        """
        AI 응답 실패 또는 빈 텍스트 반환 시 13인의 사전 분석을 바탕으로 기본 원탁 토론 문서를 생성합니다.
        """
        lines = [
            f"# {datapack.ticker} — 13인의 거장 원탁 토론 전문",
            f"> 날짜: {datapack.date} | 종목: {datapack.ticker} | 현재가: ${datapack.current_price:.2f}",
            "",
            "## 1. 토론 핵심 쟁점",
            f"- 쟁점 1: 현재 주가(${datapack.current_price:.2f})의 밸류에이션 적정성 및 안전마진",
            "- 쟁점 2: 미래 성장 지속성 및 핵심 비즈니스 해자의 견고함",
            "",
            "## 2. 거장들의 치열한 원탁 토론 (사전 분석 종합)",
        ]
        for s in summaries.summaries:
            if s.parse_mode == "fallback":
                lines.extend([
                    f"**{s.persona}** (미응답 — 집계 제외)",
                    "",
                ])
                continue
            args_text = " ".join(s.core_arguments) if s.core_arguments else "재무 및 시장 지표 종합 검토"
            lines.append(f"**{s.persona}** (의견: {s.verdict}, 확신도: {s.confidence}/10):")
            lines.append(f"> \"{s.quote}\"")
            lines.append(f"- 핵심 논거: {args_text}")
            if s.target_price_range:
                lines.append(f"- 목표/적정 가격대: {s.target_price_range}")
            lines.append("")

        lines.extend([
            "## 3. 적정가 의견 차이",
            "- 이 토론 문서는 새로운 적정가를 만들지 않습니다. 고정 집계 적정가와 분산은 최종 보고서를 따릅니다.",
            "",
            "## 4. 최종 입장 정리 및 표결 집계",
            f"- 매수: {vote_counts.get('매수', 0)}명",
            f"- 보유: {vote_counts.get('보유', 0)}명",
            f"- 관망: {vote_counts.get('관망', 0)}명",
            f"- 매도: {vote_counts.get('매도', 0)}명",
            "",
        ])
        return "\n".join(lines)

    async def generate_master_report(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        discussion: GuruDiscussionDoc,
        model_override: str | None = None,
        temperature_override: float | None = None,
    ) -> FinalMasterReport:
        """Generate narrative while deterministic rules own verdict and valuation."""
        from app.domains.report.master_report_builder import build_master_report

        return await build_master_report(
            ai=self.ai,
            datapack=datapack,
            summaries=summaries,
            discussion=discussion,
            model_override=model_override,
            temperature_override=temperature_override,
        )
    def parse_report_valuation(self, raw_md: str) -> dict[str, Any]:
        """
        LLM 마스터 보고서 마크다운에서 종합 적정 내재가치 및 투자 실행 밴드를 파싱합니다.

        1순위: 기계 파싱용 JSON 블록(valuation_consensus)
        2순위: 기존 마크다운 텍스트 정규식 파싱
        3순위: 이상치/불일치 자동 보정 없이 review flag만 남김
        """
        review_flags: list[str] = []

        parsed_json = self._parse_valuation_from_json_block(raw_md)
        if parsed_json is not None:
            self._append_valuation_review_flags(parsed_json, review_flags)
            parsed_json["review_flags"] = review_flags
            return parsed_json

        # 1. 종합 적정 내재가치 (숫자, 예: 185.0)
        fair_value: float | None = None
        fv_m = re.search(
            r"(?:종합\s*적정\s*내재가치|종합\s*적정가|적정\s*내재가치|적정가)[:\s\*]*[$₩]?\s*([\d,]+(?:\.\d+)?)",
            raw_md,
        )
        if fv_m:
            try:
                fair_value = float(fv_m.group(1).replace(",", "").strip())
            except ValueError:
                fair_value = None

        # 2. 적정 밴드 (예: "$155 ~ $230", "210,000원 - 290,000원")
        target_band: str | None = None
        band_m = re.search(
            r"(?:적정\s*밴드|목표\s*밴드|밸류에이션\s*밴드)[:\s\*]*([^\n\)|]+)",
            raw_md,
        )
        if band_m:
            target_band = band_m.group(1).strip().strip("[]*`")

        # 3. 안전마진 매수가 (예: "$160 이하")
        safety_entry: str | None = None
        safe_m = re.search(
            r"(?:\[안전마진\s*매수가\]|안전마진\s*매수가|안전마진\s*가격)[:\s\*]*([^\n|]+)",
            raw_md,
        )
        if safe_m:
            safety_entry = safe_m.group(1).strip().strip("[]*`")

        # 4. 목표 매도가 (예: "$230")
        optimistic_target: str | None = None
        target_m = re.search(
            r"(?:\[목표\s*매도가\]|목표\s*매도가|낙관적\s*목표주가|목표가)[:\s\*]*([^\n|]+)",
            raw_md,
        )
        if target_m:
            optimistic_target = target_m.group(1).strip().strip("[]*`")

        parsed = {
            "fair_value_price": fair_value,
            "target_price_band": target_band,
            "safety_entry_price": safety_entry,
            "optimistic_target_price": optimistic_target,
            "parse_mode": "regex",
        }
        self._append_valuation_review_flags(parsed, review_flags)
        parsed["review_flags"] = review_flags
        return parsed

    def _parse_valuation_from_json_block(self, raw_md: str) -> dict[str, Any] | None:
        """
        리포트 내 JSON 코드블록에서 valuation_consensus를 추출한다.
        실패 시 None 반환(정규식 파싱으로 폴백).
        """
        for match in re.finditer(r"```json\s*(\{[\s\S]*?\})\s*```", raw_md):
            candidate = match.group(1).strip()
            try:
                payload = json.loads(candidate)
            except json.JSONDecodeError:
                continue

            if not isinstance(payload, dict):
                continue
            consensus = payload.get("valuation_consensus")
            if not isinstance(consensus, dict):
                continue

            fair_value = self._parse_numeric_value(consensus.get("fair_value_price"))
            target_band = self._as_clean_str(consensus.get("target_price_band"))
            safety_entry = self._as_clean_str(consensus.get("safety_entry_price"))
            optimistic_target = self._as_clean_str(consensus.get("optimistic_target_price"))

            logger.info("valuation_consensus JSON 블록 파싱 성공")
            return {
                "fair_value_price": fair_value,
                "target_price_band": target_band,
                "safety_entry_price": safety_entry,
                "optimistic_target_price": optimistic_target,
                "parse_mode": "json",
            }

        return None

    def _parse_numeric_value(self, value: Any) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if not isinstance(value, str):
            return None

        match = re.search(r"([-+]?\d[\d,]*(?:\.\d+)?)", value.replace(" ", ""))
        if not match:
            return None
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None

    def _as_clean_str(self, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip().strip("[]*`")
        return text or None

    def _append_valuation_review_flags(
        self, parsed: dict[str, Any], review_flags: list[str]
    ) -> None:
        fair_value = self._parse_numeric_value(parsed.get("fair_value_price"))
        safety_entry = self._parse_numeric_value(parsed.get("safety_entry_price"))
        optimistic_target = self._parse_numeric_value(parsed.get("optimistic_target_price"))

        if safety_entry is not None and fair_value is not None and safety_entry > fair_value:
            review_flags.append("safety_entry_price가 fair_value_price보다 큽니다")

        if fair_value is not None and optimistic_target is not None and fair_value > optimistic_target:
            review_flags.append("fair_value_price가 optimistic_target_price보다 큽니다")

        target_band = parsed.get("target_price_band")
        if isinstance(target_band, str):
            band_values = [
                self._parse_numeric_value(num)
                for num in re.findall(r"[-+]?\d[\d,]*(?:\.\d+)?", target_band)
            ]
            numeric_band = [value for value in band_values if value is not None]
            if len(numeric_band) >= 2 and fair_value is not None:
                band_low = min(numeric_band[0], numeric_band[1])
                band_high = max(numeric_band[0], numeric_band[1])
                if fair_value < band_low or fair_value > band_high:
                    review_flags.append(
                        "fair_value_price가 target_price_band 범위를 벗어났습니다"
                    )

        if review_flags:
            logger.warning(
                "밸류에이션 review flag 감지: %s",
                ", ".join(review_flags),
            )

    def parse_report_verdict(
        self,
        raw_md: str,
        fallback_votes: dict[str, int] | None = None,
    ) -> tuple[Literal["매수", "보유", "관망", "매도"], int]:
        """
        LLM이 작성한 최종 마스터 보고서 마크다운에서 리서치 센터장의 최종 투자의견을 파싱합니다.

        1순위: 메타데이터 헤더의 종합의견/투자의견 바로 뒤 첫 의견 단어 (매수/보유/관망/매도) 추출
               (볼드, 콜론 안팎 마크다운, 공백, 괄호, 영문 병기 등 다양한 서식 지원)
        2순위: '## 1. 종합 결론' 섹션 내 명시적 결론 라벨 또는 첫 독립 투자의견 단어 탐색
        3순위: 파싱 실패 시 사전 13인 표결 다수결(fallback_votes) 룰 적용
        """
        # 1. 메타데이터 헤더 또는 상단 라벨에서 추출 (볼드/콜론 변형 및 수식어 완벽 대응)
        #    예: "> **종합 의견**: **관망 (Hold / Wait for Better Entry)**" -> "관망"
        #    예: "> **종합 의견:** **관망**" -> "관망"
        #    예: "> 종합 의견: **매수 (적극 분할 진입)**" -> "매수"
        #    예: "> **종합의견**: 관망" -> "관망"
        #    예: "> **최종 투자의견**: **매도**" -> "매도"
        #    예: "> **종합 의견**: **신중 관망**" -> "관망"
        #    예: "> **종합 의견**: **조건부 관망**" -> "관망"
        #    예: "> **종합 의견**: **강력 매도**" -> "매도"
        header_pattern = (
            r"(?:종합\s*의견|종합\s*판정|최종\s*투자의견|최종\s*의견|최종\s*판단|투자의견|종합\s*결론)"
            r"[^\n]{0,60}?"
            r"(?:조건부|적극|강력|강한|단기|중기|중장기|장기|보수적|공격적|신중|[가-힣]{1,4}\s+)*"
            r"['\"*`\[(]*\s*"
            r"(매수|보유|관망|매도)"
        )
        m = re.search(header_pattern, raw_md)
        if m:
            verdict = m.group(1)  # type: ignore
            score = VERDICT_SCORE_MAP.get(verdict, 2)
            logger.info(
                f"LLM 마스터 보고서에서 최종 판정 추출 성공 (1순위 헤더): '{verdict}' (score: {score})"
            )
            return verdict, score  # type: ignore

        # 2. '## 1. 종합 결론' 섹션 내에서 검색
        conclusion_m = re.search(
            r"##\s*\d*\.?\s*종합\s*결론(.*?)(?=##|\Z)",
            raw_md,
            re.DOTALL,
        )
        if conclusion_m:
            section = conclusion_m.group(1)

            # 2-1: 결론 섹션 내 명시적 라벨 탐색 (예: **최종 판단**: **'관망'**)
            label_m = re.search(
                r"(?:최종\s*판단|최종\s*의견|종합\s*판단|종합\s*결론|종합\s*의견|결론|판정)"
                r"[^\n]{0,60}?"
                r"(?:조건부|적극|강력|강한|단기|중기|중장기|장기|보수적|공격적|신중|[가-힣]{1,4}\s+)*"
                r"['\"*`\[(]*\s*"
                r"(매수|보유|관망|매도)",
                section,
            )
            if label_m:
                verdict = label_m.group(1)  # type: ignore
                score = VERDICT_SCORE_MAP.get(verdict, 2)
                logger.info(
                    f"LLM 마스터 보고서에서 최종 판정 추출 성공 (2-1순위 결론 라벨): '{verdict}' (score: {score})"
                )
                return verdict, score  # type: ignore

            # 2-2: 라벨이 없는 경우, 투표수/가격대/행동수식어가 아닌 첫 번째 독립 투자의견 단어 탐색
            candidate_matches: list[tuple[int, str]] = []
            for match in re.finditer(
                r"['\"*`\[(]*\s*(매수|보유|관망|매도)\s*['\"*`\])]*", section
            ):
                kw = match.group(1)
                start = match.start()
                end = match.end()
                pre_context = section[max(0, start - 15) : start]
                post_context = section[end : min(len(section), end + 15)]

                # 제외 조건: '매수 7인', '매수 5표', '분할 매수', '적극 매수', '매수 구간', '매수 허용'
                if re.search(r"^\s*\d+\s*[인표명]", post_context):
                    continue
                if re.search(r"(?:분할|적극|추가|신규|목표|허용)\s*$", pre_context):
                    continue
                if re.search(r"^\s*(?:구간|밴드|가격|시점|전략|버튼)", post_context):
                    continue

                candidate_matches.append((start, kw))

            if candidate_matches:
                candidate_matches.sort(key=lambda x: x[0])
                first_verdict = candidate_matches[0][1]
                score = VERDICT_SCORE_MAP.get(first_verdict, 2)
                logger.info(
                    f"LLM 마스터 보고서에서 최종 판정 추출 성공 (2-2순위 결론 첫 키워드): '{first_verdict}' (score: {score})"
                )
                return first_verdict, score  # type: ignore

        # 3. 폴백: 13인 사전 표결 다수결 적용
        logger.warning(
            "LLM 마스터 보고서에서 투자의견 파싱 실패. 사전 표결 다수결 폴백 적용."
        )
        if fallback_votes:
            buy_cnt = fallback_votes.get("매수", 0)
            sell_cnt = fallback_votes.get("매도", 0)
            hold_cnt = fallback_votes.get("보유", 0)
            watch_cnt = fallback_votes.get("관망", 0)

            max_cnt = max(buy_cnt, sell_cnt, hold_cnt, watch_cnt)
            if watch_cnt == max_cnt:
                return "관망", 2
            elif buy_cnt == max_cnt:
                return "매수", 0
            elif hold_cnt == max_cnt:
                return "보유", 1
            else:
                return "매도", 3

        return "관망", 2
