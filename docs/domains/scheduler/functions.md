# Scheduler 함수 명세

## 1. MarketCalendarGuard (미국장/한국장 개장일 판별)

```python
from datetime import date
import holidays

class MarketCalendarGuard:
    def __init__(self):
        # 미국 증시(NYSE) 및 한국 거래소(KRX) 공식 휴일 캘린더
        self._nyse_holidays = holidays.financial_holidays("NYSE")
        self._krx_holidays = holidays.financial_holidays("KRX")

    def is_us_market_open(self, target_date: date | None = None) -> tuple[bool, str]:
        """해당 일자가 미국 정규장(NYSE/NASDAQ) 거래일인지 확인"""

    def is_kr_market_open(self, target_date: date | None = None) -> tuple[bool, str]:
        """해당 일자가 한국 정규장(KRX) 거래일인지 확인"""

    def is_market_open(self, target_date: date | None = None, market: str = "us") -> tuple[bool, str]:
        """시장별('us' 또는 'kr') 거래일 판별 (하위 호환성 유지)"""
```

---

## 2. SchedulerService

### `start()` — APScheduler 초기화 및 잡 등록

FastAPI lifespan에서 앱 시작 시 호출.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_service.start()
    # 등록 잡:
    # 00:01 KST - reset_model_rotation_job
    # 08:00 KST - cleanup_old_logs_job
    # 09:00 KST - us_daily_pipeline_job (월~금)
    # 16:00 KST - kr_daily_pipeline_job (월~금)
    yield
    scheduler_service.shutdown()
```


### `trigger_daily_pipeline(dry_run: bool = False, force: bool = False) -> TriggerResult`

수동 트리거 (API 및 스케줄러에서 공용).
- `dry_run=True`: 실제 주문 발주 없이 스크리닝 및 리포트만 생성.
- `force=True`: 주말/휴장일 가드를 우회하여 강제 실행.

### `start_pipeline_background(...) -> dict` — 관리자 화면용 즉시 응답 트리거

```python
scheduler_service.start_pipeline_background(
    dry_run=None, force=False, max_count=None, skip_already_reported=True
)
# 이미 실행 중 -> {"status": "skipped", "reason": "already_running"}
# 새로 시작   -> {"status": "started", "reason": None}
```

`asyncio.create_task(daily_pipeline_job(...))`로 백그라운드 실행하고 즉시 반환합니다.
태스크 참조는 `SchedulerService._background_tasks`에 보관하여 GC를 방지합니다.

### `get_pipeline_progress() -> dict`

`pipeline_progress.snapshot()`을 반환합니다. (관리자 화면 폴링용)

```
GET /api/scheduler/progress
```

---

## 3. PipelineProgressTracker (메모리 진행 추적기)

`app/domains/report/pipeline_progress.py`에 정의된 스레드 안전 전역 싱글턴.

| 메서드 | 설명 |
|:---|:---|
| `start(date, triggered_by)` | 상태를 `running`으로 초기화하고 시작 시각 기록 |
| `set_targets(tickers)` | 분석 대상 확정 (`total_tickers`, ticker 목록) |
| `begin_ticker(ticker)` | 현재 종목 설정 + `gurus_done` 초기화 |
| `complete_ticker(ticker, verdict, failed)` | 종목 성공/실패 집계 |
| `set_stage(stage_key, detail)` | 현재 단계 전환 |
| `set_guru_progress(done, total)` / `tick_guru()` | 13인 요약 진행률 |
| `finish(status, summary, error)` | `completed` / `failed` / `skipped` 종료 |
| `snapshot()` | 프론트 폴링 응답용 스냅샷 (경과 시간 포함) |

---

## 4. daily_pipeline 잡 흐름

```python
async def daily_pipeline_job(dry_run: bool = False, force: bool = False):
    """
    1. 이미 실행 중이면 중단 (중복 방지 락)
    2. pipeline_progress.start() 로 메모리에 "실행중" 등록
    3. [휴장일 가드] force가 아닌 경우 market_guard.is_market_open(today) 검사
       -> 미개장일이면 [스킵] 로그 기록 후 안전하게 조기 종료
    4. screener.get_stock_list() 실행 (토스 공통/해외 필터)
    5. pipeline_progress.set_targets() 로 n/총 분모 확정
    6. 선정된 상위 종목들에 대해 guru_report.generate_full_report(ticker) 실행
       -> 1단계: DataPackBuilder -> 가치드라이버 -> 2단계: 13인 요약 -> 3단계: 최종보고서 -> 4단계: DB 저장
       -> 단계마다 pipeline_progress.set_stage() / tick_guru() 로 진행률 기록
    7. pipeline_progress.finish() 로 종료 상태 기록
    8. discord_notifier.send_pipeline_summary() (결과 통보)
    """
```

---

## 에러 처리

- 주말/휴장일 스킵 → 정상 종료 (에러 아님, 슬랙/디스코드에 스킵 안내)
- 개별 종목 분석 실패 → 해당 종목 건너뛰고 나머지 진행
- 전체 파이프라인 실패 → `SCHEDULER_JOB_FAILED` + Discord 긴급 알림
- 중복 실행 → 신규 실행 거부, 로그만 기록
