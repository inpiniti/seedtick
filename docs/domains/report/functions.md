# Report 함수 명세

## 1. DataPackBuilder (사전 구축된 데이터팩 생성 모듈)

매번 일회성 코드를 새로 작성할 필요 없이, 표준 API(Yahoo Finance, SEC EDGAR, Toss)를 호출하여 `docs/report/{날짜}/_data/{티커}.md`를 결정론적으로 1초 내외로 생성합니다.

```python
class DataPackBuilder:
    """Yahoo Finance, Toss, SEC EDGAR 등에서 팩트 수집 및 표준 데이터팩 마크다운 생성"""
    
    async def build(self, ticker: str, date: str | None = None) -> StockDataPack:
        """
        1. Yahoo Finance chart API → 현재가, 52주 고저, 이동평균선
        2. Yahoo fundamentals-timeseries → 연간/분기 손익계산서, 현금흐름표, 재무상태표
        3. Yahoo quoteSummary (crumb) → 밸류에이션 지표, 공매도 비율, 컨센서스
        4. SEC EDGAR / Toss Stock Info → 기업 개요 및 사업부문 매출 비중
        5. 수집된 지표로 마크다운 렌더링 후 파일 저장:
           docs/report/{date}/_data/{ticker}.md
        """
        ...
```

---

## 2. GuruReportService (5단계 파이프라인 오케스트레이터)

```python
class GuruReportService:
    def __init__(
        self,
        datapack_builder: DataPackBuilder,
        ai_client: AiGatewayClient,
        supabase_repo: SupabaseRepo,
    ):
        ...

    async def generate_full_report(self, ticker: str, date: str | None = None) -> FinalMasterReport:
        """
        전체 5단계 파이프라인 실행:
        1단계: await datapack_builder.build(ticker, date)
        2단계: await self.generate_guru_summaries(datapack)
        3단계: await self.generate_roundtable_discussion(datapack, summaries)
        4단계: await self.generate_master_report(datapack, summaries, discussion)
        5단계: await self.sync_to_db(ticker, date, master_report)
        """
        ...

    async def generate_guru_summaries(self, datapack: StockDataPack) -> GuruSummaryDoc:
        """
        13인 거장 페르소나별 요약 블록을 동시 호출하지 않고 차근차근 순차 호출(Sequential)
        무료 티어 레이트리밋(429) 방지를 위한 호출 간격(settings.AI_REQUEST_INTERVAL_SEC) 및 지수 백오프 적용
        결과 저장: docs/report/{date}/_data/{ticker}_요약.md
        """
        ...

    async def generate_roundtable_discussion(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc
    ) -> GuruDiscussionDoc:
        """
        거장들의 상호 반박 원탁 토론 생성
        결과 저장: docs/report/{date}/최종/{ticker}_토론.md
        """
        ...

    async def generate_master_report(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        discussion: GuruDiscussionDoc
    ) -> FinalMasterReport:
        """
        최종 종합 마스터 투자 보고서 생성
        결과 저장: docs/report/{date}/최종/{ticker}_최종보고서.md
        """
        ...

    async def sync_to_db(self, ticker: str, date: str, report: FinalMasterReport) -> None:
        """
        Supabase DB의 guru_votes 테이블에 13인 표결 및 종합 점수(g0) 저장
        """
        ...
```

---

## 3. AiGatewayClient

AI-Gateway(`seedtick-ai-gateway`)와의 통신 클라이언트.
- 멀티키 로테이션을 활용하여 13인 페르소나 호출 시 429 레이트 리밋 방지
- 타임아웃 및 재시도(Exponential Backoff) 내장

