"""
DiscussionEngine & MasterReportBuilder: 거장 원탁 토론 전문 및 최종 종합 보고서 생성
"""
import logging
import re
from typing import Literal
from app.config.constants import VERDICT_SCORE_MAP
from app.domains.report.ai_client import AiGatewayClient
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
        self, datapack: StockDataPack, summaries: GuruSummaryDoc
    ) -> GuruDiscussionDoc:
        """
        3단계: 13인 거장들의 치열한 원탁 토론 전문 생성
        """
        # 프롬프트 크기 최적화: raw_markdown 전체 대신 핵심만 압축
        compact_summaries = "\n".join(
            f"- {s.persona}: {s.verdict}({s.confidence}/10) | {'; '.join(s.core_arguments[:2])}"
            for s in summaries.summaries
        )

        prompt = f"""너는 세계 최고의 투자 거장 13인의 원탁 토론 진행자(모더레이터)다.
종목: {datapack.ticker} (현재가: ${datapack.current_price:.2f})

[13인 거장 사전 평가 요약]
{compact_summaries}

[진행 규칙]
1. 거장들 사이에서 의견이 팽팽하게 맞서는 핵심 쟁점 2~3개(예: 밸류에이션 고평가 여부, 성장의 지속성, 해자의 견고함 등)를 추출하라.
2. 거장들이 서로의 논거와 실측 수치를 직접 인용하며 치열하게 반박하는 생생한 대화 전문을 작성하라.
   - 예: 버핏과 다모다란의 내재가치 논쟁, 그레이엄과 피셔의 성장성 vs 안전마진 충돌, 버리와 슈웨거의 리스크/추세 공방 등.
3. 각 거장당 1~2회 핵심 발언으로 압축하여 토론이 중간에 잘리지 않도록 전체 길이를 2,500자(약 2,000 토큰) 내외로 완결성 있게 작성하라.
4. 토론 말미에 반드시 '## 3. 최종 입장 정리 및 표결 집계'를 명시하고 완결하라.

[반환 형식]
# {datapack.ticker} — 13인의 거장 원탁 토론 전문
> 날짜: {datapack.date} | 종목: {datapack.ticker} | 현재가: ${datapack.current_price:.2f}

## 1. 토론 핵심 쟁점
- 쟁점 1: ...
- 쟁점 2: ...

## 2. 거장들의 치열한 원탁 토론 (격돌)
(실제 인물들이 대화하는 스크립트 형태)

## 3. 최종 입장 정리 및 표결 집계
- 매수: n명 (인물들)
- 보유: n명 (인물들)
- 관망: n명 (인물들)
- 매도: n명 (인물들)
- 종합 표결 결론: ...
"""

        logger.info(f"[{datapack.ticker}] 13인 거장 원탁 토론 AI 생성 시작...")
        dialogue = await self.ai.chat(prompt, max_tokens=4000)
        logger.info(f"[{datapack.ticker}] 원탁 토론 AI 생성 완료 (길이: {len(dialogue)}자)")

        # 표결 카운트 추출 (단순 파싱)
        vote_counts = {"매수": 0, "보유": 0, "관망": 0, "매도": 0}
        for s in summaries.summaries:
            vote_counts[s.verdict] = vote_counts.get(s.verdict, 0) + 1

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
            args_text = " ".join(s.core_arguments) if s.core_arguments else "재무 및 시장 지표 종합 검토"
            lines.append(f"**{s.persona}** (의견: {s.verdict}, 확신도: {s.confidence}/10):")
            lines.append(f"> \"{s.quote}\"")
            lines.append(f"- 핵심 논거: {args_text}")
            if s.target_price_range:
                lines.append(f"- 목표/적정 가격대: {s.target_price_range}")
            lines.append("")

        lines.extend([
            "## 3. 최종 입장 정리 및 표결 집계",
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
    ) -> FinalMasterReport:
        """
        4단계: 최종 마스터 종합 투자 보고서 생성
        """
        prompt = f"""너는 글로벌 최고 수준의 리서치 센터장이다.
종목: {datapack.ticker}
데이터팩:
- 현재가: ${datapack.current_price:.2f}
- PER: {datapack.valuation.trailing_pe}x | PBR: {datapack.valuation.pbr}x | ROE: {datapack.balance_sheet.roe_pct}%

아래 13인의 요약 블록과 원탁 토론 결과를 토대로, 투자자가 실전에 즉시 활용할 수 있는 '최종 종합 마스터 투자 보고서'를 완벽한 마크다운으로 작성하라.
불필요한 미사여구는 배제하고 핵심 논거와 구체적 가격/수치 위주로 3,000자(약 2,500 토큰) 내외로 완결성 있게 작성하라.

[13인 요약 블록]
{summaries.raw_markdown}

[원탁 토론 결과 요약]
{discussion.dialogue[:1500]}

[필수 구성]
# {datapack.ticker} 최종 투자 보고서
> 날짜: {datapack.date} | 종합 의견: (매수/보유/관망/매도 중 택1, 필요시 상세수식어 병기) | 표결: 매수 {discussion.final_vote_counts.get('매수', 0)} · 보유 {discussion.final_vote_counts.get('보유', 0)} · 관망 {discussion.final_vote_counts.get('관망', 0)} · 매도 {discussion.final_vote_counts.get('매도', 0)}

## 1. 종합 결론
(단순 다수결이 아니라, 토론에서 가장 견고하게 살아남은 논거를 토대로 종합 결론 도출)

## 2. 강세론 핵심 (Bull Case)
(성장·해자·품질 측면의 강력한 논거)

## 3. 약세론 핵심 (Bear Case)
(치명적인 리스크·고평가·회계적 우려 지적)

## 4. 가치를 움직이는 핵심 드라이버 (KPI)
(기업 가치를 결정짓는 핵심 지표 3~5개)

## 5. 실전 투자 실행 가이드
- 분할 진입 권장 가격대 및 비중
- 트레이딩 접근 (슈웨거 관점의 손익비/손절선)
- 손절 및 전면 재검토 조건

## 6. 13인의 거장 요약표
| 인물 | 투자의견 | 확신도 | 핵심 논거 |
|---|---|---|---|
...

*본 보고서는 서적 기반 시뮬레이션이며 투자 자문이 아닙니다.*
"""
        logger.info(f"[{datapack.ticker}] 최종 마스터 보고서 AI 생성 시작...")
        master_md = await self.ai.chat(prompt, max_tokens=4000)
        logger.info(f"[{datapack.ticker}] 최종 마스터 보고서 AI 생성 완료 (길이: {len(master_md)}자)")

        # 4단계: LLM 리서치 센터장의 최종 투자의견을 시스템 판정(verdict 및 score)으로 채택
        votes = discussion.final_vote_counts
        overall_verdict, overall_score = self.parse_report_verdict(
            master_md, fallback_votes=votes
        )

        vote_summary = (
            f"매수 {votes.get('매수', 0)} · 보유 {votes.get('보유', 0)} · "
            f"관망 {votes.get('관망', 0)} · 매도 {votes.get('매도', 0)}"
        )

        return FinalMasterReport(
            ticker=datapack.ticker,
            date=datapack.date,
            overall_verdict=overall_verdict,
            overall_score=overall_score,
            vote_summary=vote_summary,
            bull_case="AI 및 독점적 해자 기반 중장기 복리 성장",
            bear_case="단기 밸류에이션 부담 및 매크로 불확실성",
            raw_markdown=master_md,
            discussion=discussion.raw_markdown,
        )

    def parse_report_verdict(
        self,
        raw_md: str,
        fallback_votes: dict[str, int] | None = None,
    ) -> tuple[Literal["매수", "보유", "관망", "매도"], int]:
        """
        LLM이 작성한 최종 마스터 보고서 마크다운에서 리서치 센터장의 최종 투자의견을 파싱합니다.

        1순위: '종합 의견:' 바로 뒤에 오는 첫 의견 단어 (매수/보유/관망/매도) 추출
        2순위: '## 1. 종합 결론' 섹션 내 첫 의견 단어 추출
        3순위: 파싱 실패 시 사전 13인 표결 다수결(fallback_votes) 룰 적용
        """
        verdict_keywords = ["매수", "보유", "관망", "매도"]

        # 1. '종합 의견:' 바로 뒤의 첫 의견 단어만 엄격하게 추출
        #    예: "종합 의견: 관망" → "관망"
        #    예: "종합 의견: **매수 (적극 분할 진입)**" → "매수"
        #    예: "종합 의견: 관망(매도우위)" → "관망"
        m = re.search(r"종합\s*의견\s*[:：]\s*\**\s*(매수|보유|관망|매도)", raw_md)
        if m:
            verdict = m.group(1)  # type: ignore
            score = VERDICT_SCORE_MAP.get(verdict, 2)
            logger.info(
                f"LLM 마스터 보고서에서 최종 판정 추출 성공 (1순위): '{verdict}' (score: {score})"
            )
            return verdict, score  # type: ignore

        # 2. '## 1. 종합 결론' 섹션 내 첫 의견 단어 탐색
        conclusion_m = re.search(
            r"##\s*\d*\.?\s*종합\s*결론(.{0,300})",
            raw_md,
            re.DOTALL,
        )
        if conclusion_m:
            section = conclusion_m.group(1)
            for kw in verdict_keywords:
                if kw in section:
                    score = VERDICT_SCORE_MAP.get(kw, 2)
                    logger.info(
                        f"LLM 마스터 보고서에서 최종 판정 추출 성공 (2순위): '{kw}' (score: {score})"
                    )
                    return kw, score  # type: ignore

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

