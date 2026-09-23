# Scheduler 함수 명세

## SchedulerService

### `start()` — APScheduler 초기화 및 잡 등록

FastAPI lifespan에서 앱 시작 시 호출.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await scheduler.start()    # 시작
    yield
    await scheduler.shutdown() # 종료
```

### `trigger_daily_pipeline(dry_run: bool = False) -> TriggerResult`

수동 트리거 (API 및 스케줄러에서 공용).

`dry_run=True`: 실제 매매 없이 리포트만 생성.

---

## daily_pipeline 잡 흐름

```python
async def daily_pipeline_job():
    """
    1. 이미 실행 중이면 중단 (중복 방지)
    2. screener.get_stock_list() 실행
    3. for ticker in tickers:
         report = await report.generate(ticker)
         await supabase.save(report)
    4. await auto_trading.execute_from_reports(reports)
    5. await error_log.notify_summary()
    """
```

---

## 에러 처리

- 개별 종목 분석 실패 → 해당 종목 건너뛰고 계속 진행
- 전체 파이프라인 실패 → `SCHEDULER_JOB_FAILED` + Discord 알림
- 중복 실행 → 신규 실행 거부, 로그만 기록
