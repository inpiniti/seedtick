"""
DiscussionEngine & MasterReportBuilder: 거장 원탁 토론 전문 및 최종 종합 보고서 생성
"""
import logging
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
        prompt = f"""너는 세계 최고의 투자 거장 13인의 원탁 토론 진행자(모더레이터)다.
종목: {datapack.ticker} (현재가: ${datapack.current_price:.2f})

아래는 13인 거장들의 사전 개별 평가 요약 블록이다:
{summaries.raw_markdown}

[진행 규칙]
1. 거장들 사이에서 의견이 팽팽하게 맞서는 핵심 쟁점 2~3개(예: 밸류에이션 고평가 여부, 성장의 지속성, 해자의 견고함 등)를 추출하라.
2. 거장들이 서로의 논거와 실측 수치를 직접 인용하며 치열하게 반박하는 생생한 대화 전문을 작성하라.
   - 예: 버핏과 다모다란의 내재가치 논쟁, 그레이엄과 피셔의 성장성 vs 안전마진 충돌, 버리와 슈웨거의 리스크/추세 공방 등.
3. 토론 말미에 '최종 입장 정리 및 13인 표결 집계'를 명시하라.

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
        dialogue = await self.ai.chat(prompt)

        # 표결 카운트 추출 (단순 파싱)
        vote_counts = {"매수": 0, "보유": 0, "관망": 0, "매도": 0}
        for s in summaries.summaries:
            vote_counts[s.verdict] = vote_counts.get(s.verdict, 0) + 1

        return GuruDiscussionDoc(
            ticker=datapack.ticker,
            date=datapack.date,
            hot_topics=["밸류에이션 및 안전마진", "성장 동력 및 해자", "리스크 및 다운사이드"],
            dialogue=dialogue,
            final_vote_counts=vote_counts,
            raw_markdown=dialogue,
        )

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

[13인 요약 블록]
{summaries.raw_markdown}

[원탁 토론 결과 요약]
{discussion.dialogue[:1500]}

[필수 구성]
# {datapack.ticker} 최종 투자 보고서
> 날짜: {datapack.date} | 종합 의견: (매수/보유/관망/매도) | 표결: 매수 {discussion.final_vote_counts.get('매수', 0)} · 보유 {discussion.final_vote_counts.get('보유', 0)} · 관망 {discussion.final_vote_counts.get('관망', 0)} · 매도 {discussion.final_vote_counts.get('매도', 0)}

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
        master_md = await self.ai.chat(prompt)

        # 종합 의견 및 점수 판정
        votes = discussion.final_vote_counts
        buy_cnt = votes.get("매수", 0)
        sell_cnt = votes.get("매도", 0)
        hold_cnt = votes.get("보유", 0)

        if buy_cnt >= 7:
            overall_verdict = "매수"
            overall_score = 0
        elif sell_cnt >= 5:
            overall_verdict = "매도"
            overall_score = 3
        elif buy_cnt + hold_cnt >= 8:
            overall_verdict = "보유"
            overall_score = 1
        else:
            overall_verdict = "관망"
            overall_score = 2

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
        )
