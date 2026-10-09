"""
DiscussionEngine & MasterReportBuilder: 최종 종합 보고서 생성 및 파싱 유틸리티
"""
import json
import logging
import re
from typing import Any, Literal
from app.config.constants import VERDICT_SCORE_MAP
from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.models import (
    FinalMasterReport,
    GuruSummaryDoc,
    StockDataPack,
)

logger = logging.getLogger("discussion_engine")


class DiscussionEngine:
    def __init__(self, ai_client: AiGatewayClient):
        self.ai = ai_client

    async def generate_master_report(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        model_override: str | None = None,
        temperature_override: float | None = None,
    ) -> FinalMasterReport:
        """Generate narrative while deterministic rules own verdict and valuation."""
        from app.domains.report.master_report_builder import build_master_report

        return await build_master_report(
            ai=self.ai,
            datapack=datapack,
            summaries=summaries,
            model_override=model_override,
            temperature_override=temperature_override,
        )

    def parse_report_valuation(self, raw_md: str) -> dict[str, Any]:
        """
        LLM 마스터 보고서 마크다운에서 종합 적정 내재가치 및 투자 실행 밴드를 파싱합니다.

        1순위: 레거시 리포트의 JSON 블록(valuation_consensus) — 신규 리포트에는 없으므로
               과거 산출물 재파싱 전용 경로다.
        2순위: 마크다운 헤더/본문 텍스트 정규식 파싱
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

        신규 마스터 리포트는 본문에 JSON 블록을 싣지 않는다(정규 컬럼으로만 적재).
        이 경로는 JSON 블록이 붙어 있던 과거 리포트/파일 재파싱 호환용으로 남겨둔다.
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
