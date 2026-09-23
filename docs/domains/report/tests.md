# Report 테스트 케이스

## 단위 테스트

### verdict 집계 알고리즘

```python
def test_buy_verdict_when_majority_buy():
    votes = [
        PersonaVote(persona="A", verdict="BUY", confidence=8, reason="..."),
        PersonaVote(persona="B", verdict="BUY", confidence=7, reason="..."),
        PersonaVote(persona="C", verdict="HOLD", confidence=5, reason="..."),
    ]
    verdict, confidence = aggregate_verdict(votes)
    assert verdict == "BUY"
    assert confidence >= 60

def test_sell_verdict_when_sell_threshold():
    votes = [
        PersonaVote(persona="A", verdict="SELL", confidence=8, reason="..."),
        PersonaVote(persona="B", verdict="SELL", confidence=7, reason="..."),
        PersonaVote(persona="C", verdict="BUY", confidence=6, reason="..."),
    ]
    verdict, _ = aggregate_verdict(votes)
    assert verdict == "SELL"
```

### 응답 파싱

```python
def test_parse_valid_llm_response():
    raw = "인물: 워런 버핏 | 의견: 보유 | 확신도: 7 | 근거: 위대한 기업이나..."
    votes = parse_llm_response(raw)
    assert len(votes) >= 1
    assert votes[0].persona == "워런 버핏"
    assert votes[0].verdict == "HOLD"

def test_parse_invalid_response_raises():
    raw = "완전히 잘못된 응답"
    with pytest.raises(ReportParseError):
        parse_llm_response(raw)
```

## 통합 테스트 (AI-Gateway Mock)

```python
@pytest.mark.asyncio
async def test_generate_report_full_flow(mock_ai_client, mock_supabase):
    mock_ai_client.chat.return_value = "인물: 워런 버핏 | 의견: 매수 | 확신도: 8 | ..."
    
    service = ReportService(ai_client=mock_ai_client, supabase=mock_supabase)
    report = await service.generate("NVDA")
    
    assert report.ticker == "NVDA"
    assert report.verdict in ["BUY", "SELL", "HOLD", "WATCH"]
    assert 0 <= report.confidence <= 100
    assert len(report.personas) > 0
    mock_supabase.save.assert_called_once()
```
