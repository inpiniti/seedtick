# Scheduler 함수 명세

## 1. MarketCalendarGuard (미장 개장일 판별)

```python
from datetime import date
import holidays

class MarketCalendarGuard:
    def __init__(self):
        # 미국 증시(NYSE) 공식 휴일 캘린더
        self._nyse_holidays = holidays.financial_holidays("NYSE")

    def is_market_open(self, target_date: date) -> tuple[bool, str]:
        """
        해당 일자가 미국 정규장 거래일인지 확인
        Returns: (개장여부, 사유문구)
        """
        # 1. 주말 체크 (5: 토, 6: 일)
        if target_date.weekday() in (5, 6):
            return False, f"주말({target_date.strftime('%A')})"

        # 2. 미국 공휴일 체크
        if target_date in self._nyse_holidays:
            holiday_name = self._nyse_holidays.get(target_date)
            return False, f"미국 증시 공휴일({holiday_name})"

        return True, "정상 개장일"
```

---

## 2. SchedulerService

### `start()` — APScheduler 초기화 및 잡 등록

FastAPI lifespan에서 앱 시작 시 호출.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await scheduler.start()    # 시작 (Cron: 월~금 18:00 KST)
    yield
    await scheduler.shutdown() # 종료
```

### `trigger_daily_pipeline(dry_run: bool = False, force: bool = False) -> TriggerResult`

수동 트리거 (API 및 스케줄러에서 공용).
- `dry_run=True`: 실제 주문 발주 없이 스크리닝 및 리포트만 생성.
- `force=True`: 주말/휴장일 가드를 우회하여 강제 실행.

---

## 3. daily_pipeline 잡 흐름

```python
async def daily_pipeline_job(dry_run: bool = False, force: bool = False):
    """
    1. 이미 실행 중이면 중단 (중복 방지 락)
    2. [휴장일 가드] force가 아닌 경우 market_guard.is_market_open(today) 검사
       -> 미개장일이면 [스킵] 로그 기록 후 안전하게 조기 종료
    3. screener.get_stock_list() 실행 (토스 공통/해외 필터)
    4. 선정된 상위 종목들에 대해 guru_report.generate_full_report(ticker) 실행
       -> 1단계: DataPackBuilder -> 2단계: 13인 요약 -> 3단계: 원탁토론 -> 4단계: 최종보고서 -> 5단계: DB 저장
    5. auto_trading.execute_from_reports(reports, dry_run=dry_run) (소액 주문 발주)
    6. discord_notifier.send_pipeline_summary() (결과 통보)
    """
```

---

## 에러 처리

- 주말/휴장일 스킵 → 정상 종료 (에러 아님, 슬랙/디스코드에 스킵 안내)
- 개별 종목 분석 실패 → 해당 종목 건너뛰고 나머지 진행
- 전체 파이프라인 실패 → `SCHEDULER_JOB_FAILED` + Discord 긴급 알림
- 중복 실행 → 신규 실행 거부, 로그만 기록
