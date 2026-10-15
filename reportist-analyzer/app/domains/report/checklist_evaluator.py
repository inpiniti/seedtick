"""
ChecklistEvaluator: 13인의 투자 거장별 철학에 기반한 결정론적(Deterministic) 팩트 검증기

LLM이 재무 데이터를 부정확하게 계산하거나 지어내지 않도록,
Python에서 사전에 엄밀한 수학 공식으로 각 거장의 핵심 체크리스트를 검증(Pass/Fail/Caution)하고
그 결과를 데이터팩 및 프롬프트에 주입합니다.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

from app.domains.report.models import StockDataPack


@dataclass(frozen=True)
class ChecklistItem:
    criterion: str          # 검증 항목 (예: "PER × PBR <= 22.5")
    metric_value: str       # 실제 수치 (예: "18.4x")
    threshold: str          # 기준 (예: "<= 22.5x")
    status: Literal["PASS", "FAIL", "CAUTION", "N/A"]
    note: str               # 해석 설명 (예: "안전마진 기준 부합")


def evaluate_guru_checklists(dp: StockDataPack) -> dict[str, list[dict]]:
    """
    StockDataPack을 입력받아 13인의 거장별 결정론적 체크리스트를 사전 검정합니다.
    """
    bs = dp.balance_sheet
    v = dp.valuation
    inc = dp.income_annual[-1] if dp.income_annual else None
    cf = dp.cashflow_annual[-1] if dp.cashflow_annual else None
    fm = getattr(dp, "forensic_metrics", {}) or {}
    mm = dp.market_metrics or {}

    results: dict[str, list[ChecklistItem]] = {}

    # 1. 벤저민 그레이엄 (Benjamin Graham)
    graham_items: list[ChecklistItem] = []
    # (1) PER * PBR <= 22.5
    if v.graham_multiplier is not None:
        passed = v.graham_multiplier <= 22.5
        graham_items.append(
            ChecklistItem(
                criterion="그레이엄 승수 (PER × PBR)",
                metric_value=f"{v.graham_multiplier:.2f}",
                threshold="<= 22.5",
                status="PASS" if passed else "FAIL",
                note="전통적 안전마진 밸류에이션 충족" if passed else "가치 대비 고평가 영역",
            )
        )
    else:
        graham_items.append(
            ChecklistItem(
                criterion="그레이엄 승수 (PER × PBR)",
                metric_value="N/A",
                threshold="<= 22.5",
                status="N/A",
                note="PER 또는 PBR 결측",
            )
        )

    # (2) 순유동자산(NCAV) 안전마진
    if bs.ncav is not None and v.market_cap and v.market_cap > 0:
        ncav_ratio = (bs.ncav / v.market_cap) * 100.0
        passed = ncav_ratio >= 66.7  # 시총 대비 NCAV 67% 이상 (넷넷)
        graham_items.append(
            ChecklistItem(
                criterion="NCAV(순유동자산) / 시가총액",
                metric_value=f"{ncav_ratio:.1f}%",
                threshold=">= 66.7% (넷넷 기준)",
                status="PASS" if passed else "CAUTION",
                note="청산가치 대비 절대적 안전마진" if passed else "청산가치 초과 거래 (프리미엄 반영)",
            )
        )

    # (3) 유동비율 >= 2.0x
    if bs.current_ratio is not None:
        passed = bs.current_ratio >= 2.0
        graham_items.append(
            ChecklistItem(
                criterion="유동비율 (Current Ratio)",
                metric_value=f"{bs.current_ratio:.2f}x",
                threshold=">= 2.0x",
                status="PASS" if passed else "CAUTION",
                note="단기 채무 상환 안정성 확보" if passed else "유동성 버퍼 주의 필요",
            )
        )

    results["벤저민-그레이엄"] = [asdict(i) for i in graham_items]

    # 2. 세스 클라먼 (Seth Klarman)
    klarman_items: list[ChecklistItem] = []
    # (1) 순현금 여부 (Net Debt <= 0)
    if bs.net_debt is not None:
        passed = bs.net_debt <= 0
        klarman_items.append(
            ChecklistItem(
                criterion="순차입금 (Net Debt) 방어력",
                metric_value="순현금 상태" if passed else "순부채 보유",
                threshold="<= 0 (Net Cash)",
                status="PASS" if passed else "CAUTION",
                note="거시 충격에도 파산 위험 원천 차단" if passed else "외부 충격 시 부채 부담 발생 가능",
            )
        )
    results["세스-클라먼"] = [asdict(i) for i in klarman_items]

    # 3. 모니시 파브라이 (Mohnish Pabrai)
    pabrai_items: list[ChecklistItem] = []
    # (1) 부채비율 낮은 저위험 비즈니스 (Debt / Equity <= 0.5x)
    if bs.debt_ratio is not None:
        passed = bs.debt_ratio <= 0.5
        pabrai_items.append(
            ChecklistItem(
                criterion="부채비율 (Debt / Equity)",
                metric_value=f"{bs.debt_ratio:.2f}x",
                threshold="<= 0.5x",
                status="PASS" if passed else "CAUTION",
                note="단도 투자 원칙: 잃을 것이 적은 저위험 자본구조" if passed else "다운사이드 리스크 상존",
            )
        )
    results["모니시-파브라이"] = [asdict(i) for i in pabrai_items]

    # 4. 조엘 그린블라트 (Joel Greenblatt)
    greenblatt_items: list[ChecklistItem] = []
    # (1) 이익수익률 EY = EBIT / EV
    if v.earnings_yield_pct is not None:
        passed = v.earnings_yield_pct >= 8.0
        greenblatt_items.append(
            ChecklistItem(
                criterion="이익수익률 (EBIT / EV)",
                metric_value=f"{v.earnings_yield_pct:.2f}%",
                threshold=">= 8.0%",
                status="PASS" if passed else "FAIL",
                note="기업가치 대비 높은 영업수익 창출력" if passed else "가격 대비 이익수익률 낮음",
            )
        )

    # (2) 투하자본수익률 ROC / ROIC >= 15%
    if bs.roic_pct is not None:
        passed = bs.roic_pct >= 15.0
        greenblatt_items.append(
            ChecklistItem(
                criterion="자본수익률 (ROIC)",
                metric_value=f"{bs.roic_pct:.1f}%",
                threshold=">= 15.0%",
                status="PASS" if passed else "FAIL",
                note="마법공식: 뛰어난 자본 효율을 지닌 우량 기업" if passed else "자본수익률 평이하거나 낮음",
            )
        )
    results["조엘-그린블라트"] = [asdict(i) for i in greenblatt_items]

    # 5. 워런 버핏 (Warren Buffett)
    buffett_items: list[ChecklistItem] = []
    # (1) ROE >= 15% (경제적 해자)
    if bs.roe_pct is not None:
        passed = bs.roe_pct >= 15.0
        buffett_items.append(
            ChecklistItem(
                criterion="자기자본이익률 (ROE)",
                metric_value=f"{bs.roe_pct:.1f}%",
                threshold=">= 15.0%",
                status="PASS" if passed else "FAIL",
                note="탁월한 주주 자본 수익률 (경제적 해자 신호)" if passed else "해자 기준(15%) 미달",
            )
        )

    # (2) 부채상환연수 (Total Debt / Net Income <= 3~4년)
    debt_years = fm.get("debt_payoff_years")
    if debt_years is not None:
        passed = debt_years <= 4.0
        buffett_items.append(
            ChecklistItem(
                criterion="부채상환 소요연수 (Total Debt / Net Income)",
                metric_value=f"{debt_years:.1f}년",
                threshold="<= 4.0년",
                status="PASS" if passed else "CAUTION",
                note="순이익으로 3~4년 내 상환 가능한 건전 부채" if passed else "부채 규모가 연간 순이익 대비 과중",
            )
        )

    # (3) 영업이익률 안정성 >= 15%
    if inc and inc.operating_margin_pct is not None:
        passed = inc.operating_margin_pct >= 15.0
        buffett_items.append(
            ChecklistItem(
                criterion="영업이익률 (Operating Margin)",
                metric_value=f"{inc.operating_margin_pct:.1f}%",
                threshold=">= 15.0%",
                status="PASS" if passed else "CAUTION",
                note="강력한 가격결정력(Pricing Power) 증명" if passed else "수익성 버퍼 보통",
            )
        )
    results["워런-버핏"] = [asdict(i) for i in buffett_items]

    # 6. 피터 린치 (Peter Lynch)
    lynch_items: list[ChecklistItem] = []
    # (1) PEG < 1.0 (GARP 기준)
    if v.peg is not None:
        if v.peg <= 0.5:
            status = "PASS"
            note = "초특가 바겐세일 영역 (PEG <= 0.5)"
        elif v.peg <= 1.0:
            status = "PASS"
            note = "성장률 대비 적정 가격 (GARP 충족)"
        else:
            status = "FAIL"
            note = "성장률 대비 밸류에이션 부담 (PEG > 1.0)"
        lynch_items.append(
            ChecklistItem(
                criterion="PEG 비율 (PER / 이익성장률)",
                metric_value=f"{v.peg:.2f}x",
                threshold="< 1.0x",
                status=status,
                note=note,
            )
        )

    # (2) 재고 증가율 vs 매출 증가율
    inv_growth = fm.get("inventory_growth_pct")
    rev_growth = inc.revenue_growth_pct if inc else None
    if inv_growth is not None and rev_growth is not None:
        passed = inv_growth <= rev_growth
        lynch_items.append(
            ChecklistItem(
                criterion="재고 건전성 (재고 증가율 vs 매출 증가율)",
                metric_value=f"재고 {inv_growth:+.1f}% vs 매출 {rev_growth:+.1f}%",
                threshold="재고증가율 <= 매출증가율",
                status="PASS" if passed else "CAUTION",
                note="수요 견조, 재고 소진 원활" if passed else "재고 급증에 따른 덤핑/마진 압박 경고",
            )
        )
    results["피터-린치"] = [asdict(i) for i in lynch_items]

    # 7. 마이클 버리 & 찰리 멍거 (포렌식 & 현금흐름 질)
    forensic_items: list[ChecklistItem] = []
    # (1) 발생액 괴리 (Net Income vs OCF)
    accrual = fm.get("accrual_gap")
    if accrual is not None and inc and inc.net_income:
        # 발생액이 순이익의 20%를 초과하는지 여부
        is_aggressive = accrual > (abs(inc.net_income) * 0.20)
        forensic_items.append(
            ChecklistItem(
                criterion="이익의 질 (순이익 - 영업현금흐름 발생액)",
                metric_value="영업현금 유입 양호 (NI <= OCF)" if not is_aggressive else "순이익 대비 현금유입 부족 (회계적 발생주의 괴리)",
                threshold="Net Income <= OCF",
                status="PASS" if not is_aggressive else "CAUTION",
                note="진짜 현금 창출력 검증됨" if not is_aggressive else "매출채권 급증 또는 미실현 이익 주의",
            )
        )

    # (2) 주식기준보상(SBC) 과다 희석 여부
    dilution = fm.get("shares_dilution_pct")
    if dilution is not None:
        passed = dilution <= 2.0  # 연간 희석률 2% 이하
        forensic_items.append(
            ChecklistItem(
                criterion="주식 희석률 (발행주식수 연간 변동률)",
                metric_value=f"{dilution:+.2f}%",
                threshold="<= +2.0%/년",
                status="PASS" if passed else "CAUTION",
                note="주주가치 보존 우수" if passed else "SBC/증자로 인한 주주가치 희석 주의",
            )
        )
    results["마이클-버리"] = [asdict(i) for i in forensic_items]
    results["찰리-멍거"] = [asdict(i) for i in forensic_items]

    # 8. 잭 슈웨거 (Jack Schwager - 추세와 손익비)
    schwager_items: list[ChecklistItem] = []
    ma50_str = mm.get("50일 이동평균선", "")
    ma200_str = mm.get("200일 이동평균선", "")
    from app.domains.report.structuring import parse_number
    ma50 = parse_number(ma50_str)
    ma200 = parse_number(ma200_str)
    price = dp.current_price
    if ma50 and ma200 and price > 0:
        is_bull_trend = price > ma50 > ma200
        is_bear_trend = price < ma50 < ma200
        status = "PASS" if is_bull_trend else ("FAIL" if is_bear_trend else "CAUTION")
        note = "주가 > MA50 > MA200 정배열 상승추세" if is_bull_trend else ("주가 < MA50 < MA200 역배열 하락추세" if is_bear_trend else "혼조/전환 구간")
        schwager_items.append(
            ChecklistItem(
                criterion="이동평균선 추세 정합성 (50일 / 200일선)",
                metric_value=f"현재가 ${price:.2f} (50일: ${ma50:.2f}, 200일: ${ma200:.2f})",
                threshold="현재가 > MA50 > MA200",
                status=status,
                note=note,
            )
        )
    results["잭-슈웨거"] = [asdict(i) for i in schwager_items]

    # 9. 애스워스 다모다란 (Aswath Damodaran - DCF 펀더멘털)
    damodaran_items: list[ChecklistItem] = []
    if cf and cf.fcf and v.enterprise_value and v.enterprise_value > 0:
        fcf_yield = (cf.fcf / v.enterprise_value) * 100.0
        passed = fcf_yield >= 5.0
        damodaran_items.append(
            ChecklistItem(
                criterion="잉여현금흐름 수익률 (FCF / Enterprise Value)",
                metric_value=f"{fcf_yield:.2f}%",
                threshold=">= 5.0%",
                status="PASS" if passed else "CAUTION",
                note="내재가치를 지지하는 견고한 FCFF 창출" if passed else "고밸류에이션으로 DCF 업사이드 민감",
            )
        )
    results["애스워스-다모다란"] = [asdict(i) for i in damodaran_items]

    return results


def format_checklist_markdown(items: list[dict]) -> str:
    """체크리스트 항목 리스트를 마크다운 표 또는 불릿으로 렌더링."""
    if not items:
        return "- 사전 계산된 체크리스트 지표 없음"
    lines = []
    for it in items:
        icon = {"PASS": "✅ PASS", "FAIL": "❌ FAIL", "CAUTION": "⚠️ CAUTION", "N/A": "⚪ N/A"}.get(it["status"], it["status"])
        lines.append(f"- **{it['criterion']}**: {it['metric_value']} (기준: {it['threshold']}) → **{icon}** [{it['note']}]")
    return "\n".join(lines)
