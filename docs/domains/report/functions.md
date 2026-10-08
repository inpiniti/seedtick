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
        progress: PipelineProgressTracker | None = None,  # 진행률 기록 (선택)
    ):
        ...

    async def generate_full_report(self, ticker: str, date: str | None = None) -> FinalMasterReport:
        """
        전체 5단계 파이프라인 실행:
        - progress가 주어지면 단계 전환(set_stage)과 13인 진행률(tick_guru)을 기록
        1단계: await datapack_builder.build(ticker, date)
        2단계: await self.generate_guru_summaries(datapack)
        3단계: 토론 활성 시 AI 토론 생성, 기본 설정은 요약 기반 compact 토론 문서 생성
        4단계: 유효 의견/가격을 고정 규칙으로 집계하고, AI는 근거 서술만 생성
        5단계: await self.sync_to_db(ticker, date, master_report)

        보고서 호출은 AI_REPORT_MODEL(미설정 시 AI_GATEWAY_MODEL)과
        AI_REPORT_TEMPERATURE를 공통 적용한다. 모델 오류 시 다른 모델로 조용히
        전환하지 않는다. 입력 fingerprint, 모델, temperature, prompt version,
        결정 정책 버전을 datapack.analysis_metadata에 기록한다.
        """
        ...

    async def generate_guru_summaries(self, datapack: StockDataPack) -> GuruSummaryDoc:
        """
        13인 거장 페르소나별 요약 블록을 최대 concurrency(기본 10)개 동시 병렬 처리 (asyncio.Semaphore)
        AI-Gateway 키 로테이션을 활용해 13인 분석을 1~2 라운드(수십 초 내외)만에 고속 완료
        결과 저장: docs/report/{date}/_data/{ticker}_요약.md
        """
        ...

    async def generate_roundtable_discussion(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc
    ) -> GuruDiscussionDoc:
        """
        ENABLE_ROUND_TABLE_DISCUSSION=true면 AI 상호 반박 원탁 토론을 생성
        기본 false면 AI 호출 없이 13인 요약/표결을 담은 compact 호환 문서를 생성
        두 경우 모두 결과 저장: docs/report/{date}/최종/{ticker}_토론.md
        """
        ...

    async def generate_master_report(
        self,
        datapack: StockDataPack,
        summaries: GuruSummaryDoc,
        discussion: GuruDiscussionDoc
    ) -> FinalMasterReport:
        """
        최종 보고서 생성. 판정은 유효 응답 12개 이상 및 60% supermajority,
        적정가는 가격 구간 중점값의 중앙값으로 결정한다. 전체 가격 추정 폭이
        중앙값의 20%를 넘으면 단일 가격을 보류한다. AI는 설명 문장만 작성한다.
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
