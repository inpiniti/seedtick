"""
structuring.py 및 구조화 데이터 파싱 단위 테스트
"""
import pytest
from app.domains.report.structuring import (
    extract_json_object,
    parse_number,
    parse_price_range,
    normalize_verdict,
    format_price_range,
    pct_change,
    extract_master_sections,
    count_votes,
    guru_index,
    build_opinion_rows,
    build_metrics_row,
    build_report_columns,
)
from app.domains.report.service import GuruReportService


def test_extract_json_object():
    # 1. ```json 코드블록
    text1 = 'Here is the response:\n```json\n{"verdict": "매수", "confidence": 9}\n```\nThanks!'
    assert extract_json_object(text1) == {"verdict": "매수", "confidence": 9}

    # 2. 코드블록 없이 순수 JSON
    text2 = '{"persona": "워런-버핏", "verdict": "보유"}'
    assert extract_json_object(text2) == {"persona": "워런-버핏", "verdict": "보유"}

    # 3. 잘못된 JSON
    assert extract_json_object("None here") is None


def test_parse_number():
    assert parse_number("$150.50") == 150.50
    assert parse_number("2,500.00") == 2500.0
    assert parse_number("15.4%") == 15.4
    assert parse_number("3.2T") == 3.2e12
    assert parse_number("450B") == 450e9
    assert parse_number("12M") == 12e6
    assert parse_number("N/A") is None
    assert parse_number("-") is None
    assert parse_number(None) is None


def test_parse_price_range():
    assert parse_price_range("$150 ~ $175") == (150.0, 175.0)
    assert parse_price_range("$160 이하") == (None, 160.0)
    assert parse_price_range("$200 이상") == (200.0, None)
    assert parse_price_range("$180") == (180.0, 180.0)
    assert parse_price_range("해당 없음") == (None, None)


def test_normalize_verdict():
    assert normalize_verdict("**매수 (적극 분할)**") == "매수"
    assert normalize_verdict("관망 (Hold)") == "관망"
    assert normalize_verdict("보유") == "보유"
    assert normalize_verdict("매도 권고") == "매도"
    assert normalize_verdict("기타의견") is None


def test_format_price_range_and_pct_change():
    assert format_price_range(150.0, 175.0) == "$150 ~ $175"
    assert format_price_range(None, 160.0) == "$160 이하"
    assert format_price_range(200.0, None) == "$200 이상"
    assert pct_change(230.0, 200.0) == 15.0


def test_extract_master_sections():
    sample_md = """# AAPL 최종 투자 보고서
> **날짜**: 2026-10-07 | **종합 의견**: **매수** | **표결**: 매수 10 · 보유 2 · 관망 1 · 매도 0
> **현재가**: $220.00 | **종합 적정 내재가치**: $250

## 1. 종합 결론 및 밸류에이션 산출 근거
- 종합 결론: 애플은 강력한 해자와 서비스 마진 개선으로 여전히 매력적이다.
- 밸류에이션: PER 30배 수준이나 FCF 창출 능력이 우수하다.

## 2. 강세론 핵심 (Bull Case)
- 서비스 부문 고마진 지속 및 가입자 증가
- 강력한 자사주 매입 정책
- 차세대 AI 기능 도입으로 교체 수요 촉진

## 3. 약세론 핵심 (Bear Case)
- 중국 시장 점유율 둔화 리스크
- 높은 밸류에이션 부담

## 4. 가치를 움직이는 핵심 드라이버 (KPI)
- 서비스 매출 총이익률 (Gross Margin)
- 활성 기기 설치 기반 (Installed Base)
"""
    sec = extract_master_sections(sample_md)
    assert "애플은 강력한 해자" in sec["conclusion"]
    assert len(sec["bull_points"]) == 3
    assert len(sec["bear_points"]) == 2
    assert len(sec["key_drivers"]) == 2


def test_parse_summary_block_json():
    service = GuruReportService()
    json_text = """```json
{
  "persona": "워런-버핏",
  "verdict": "보유",
  "confidence": 8,
  "core_arguments": [
    "ROE 140%로 자본배분 효율이 탁월함",
    "다만 현재 PER 32배로 안전마진이 부족함"
  ],
  "target_price_low": 180.0,
  "target_price_high": 200.0,
  "trigger_conditions": ["주가 $180 이하로 조정 시 적극 매수"],
  "quote": "좋은 기업이지만 지금 가격은 충분히 싸지 않다."
}
```"""
    block = service._parse_summary_block("워런-버핏", json_text)
    assert block.verdict == "보유"
    assert block.confidence == 8
    assert block.target_price_low == 180.0
    assert block.target_price_high == 200.0
    assert block.parse_mode == "json"
    assert len(block.core_arguments) == 2


def test_parse_summary_block_regex_fallback():
    service = GuruReportService()
    regex_text = """인물: 워런-버핏 | 의견: 매수 | 확신도: 9
핵심 논거:
- 강력한 브랜드 해자와 지속 가능한 현금흐름
- 탁월한 주주환원 정책
적정가/매수 가격대: $230 ~ $250
트리거 조건: 마진율 5%p 이상 하락 시 재검토
대표 발언: "훌륭한 기업을 적당한 가격에 사는 기회다."
"""
    block = service._parse_summary_block("워런-버핏", regex_text)
    assert block.verdict == "매수"
    assert block.confidence == 9
    assert block.target_price_low == 230.0
    assert block.target_price_high == 250.0
    assert block.parse_mode == "regex"
    assert len(block.core_arguments) == 2
