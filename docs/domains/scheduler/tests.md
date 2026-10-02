# Scheduler 테스트 케이스

## 단위 테스트

```python
@pytest.mark.asyncio
async def test_daily_pipeline_skips_on_duplicate():
    """이미 실행 중인 잡이 있을 때 중복 실행 방지"""
    service = SchedulerService()
    service._running = True
    result = await service.trigger_daily_pipeline()
    assert result.status == "already_running"

@pytest.mark.asyncio
async def test_dry_run_does_not_call_auto_trading(mock_auto_trading):
    """dry_run=True 시 auto_trading 호출 안 됨"""
    service = SchedulerService(auto_trading=mock_auto_trading)
    await service.trigger_daily_pipeline(dry_run=True)
    mock_auto_trading.execute_from_reports.assert_not_called()
```

## 통합 테스트 (전체 파이프라인)

```python
@pytest.mark.asyncio
async def test_full_pipeline_smoke(mock_screener, mock_report, mock_trading):
    """파이프라인 전체가 정상 호출 순서를 따르는지 확인"""
    mock_screener.get_stock_list.return_value = ScreenResult(tickers=[Ticker(symbol="NVDA", ...)], ...)
    mock_report.generate.return_value = Report(ticker="NVDA", verdict="BUY", ...)
    
    service = SchedulerService(screener=mock_screener, report=mock_report, trading=mock_trading)
    await service.trigger_daily_pipeline()
    
    mock_screener.get_stock_list.assert_called_once()
    mock_report.generate.assert_called_with("NVDA")
    mock_trading.execute_from_reports.assert_called_once()
```

## 진행 추적 테스트 (`tests/domains/test_pipeline_progress.py`)

- `test_tracker_idle_snapshot`: 초기 `idle` 상태 및 단계 메타 반환
- `test_tracker_full_lifecycle`: `start → set_targets → begin_ticker → tick_guru → complete_ticker → finish` 전 과정 집계 검증
- `test_tracker_stage_index_matches_frontend_order`: 프론트 단계 순서와 `stage_index` 일치
- `test_tracker_event_buffer_is_capped`: 최근 로그 버퍼 상한 유지

## API 라우트 테스트 (`tests/test_api_routes.py`)

- `test_scheduler_trigger_route`: 트리거 라우트가 `start_pipeline_background`를 올바른 인자로 호출하는지 검증
- `test_scheduler_progress_route`: `/api/scheduler/progress`가 `status`/`stages`/`elapsed_seconds`를 반환하는지 검증
