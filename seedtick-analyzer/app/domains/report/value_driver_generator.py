"""
ValueDriverGenerator: 기업 특유의 가치 드라이버(KPI 3~5개) 및 최신 뉴스/촉매 분석 생성기
과거 guru-value-driver 에이전트의 동적 분석 역량을 AI-Gateway 기반 파이프라인으로 복원합니다.
"""
import logging
from datetime import date as dt_date
from pathlib import Path

from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.models import StockDataPack

logger = logging.getLogger("value_driver_generator")

SYSTEM_PROMPT = """너는 13인의 투자 거장 보고서(Guru Report) 파이프라인의 **가치 드라이버 분석(Value Drivers Analyst)** 담당 전문가다.
한 기업의 주가와 기업 본질 가치를 움직이는 **핵심 KPI 3~5개**와 **최신 시장 촉매(Catalysts)**를 분석해 최고 수준의 전문 마크다운 보고서를 작성하는 것이 유일한 임무다.

## 절대 규칙
1. **업종 하드코딩 금지**: "SaaS면 ARR", "제조업이면 가동률"처럼 뻔한 교과서적 지표만 쓰지 마라. 해당 기업 특유의 핵심 동인(예: HBM 점유율, 첨단 패키징 수주 잔고, 2nm GAA 전환 시점, 대중 수출규제 영향 등)을 정확히 도출하라.
2. **구체성 필수**: "좋은 제품", "시장 확대" 같은 모호한 표현은 엄격히 금지한다. 반드시 추적 가능한 메트릭, 고객사 동향, 가이던스 변화, 규제 여파 등 구체적 팩트를 다뤄라.
3. **최신 뉴스 및 시장 이벤트 적극 연계**: 제공된 최신 뉴스 헤드라인과 시장 이슈를 가치 드라이버 및 촉매와 긴밀히 엮어라.
4. **기준 시점 명시**: 각 드라이버별로 [현재 상태]와 [변화 감시 기준(무엇이 바뀌면 가치가 움직이는가)]을 명시하라.
5. 반드시 마크다운(Markdown) 형식으로 작성하며 서두나 결미에 불필요한 인사말이나 부연 설명 없이 본문만 출력하라.
6. 핵심 드라이버 및 촉매 도출이 완료되면 불필요한 꼬리물기 추론 없이 즉시 규격대로 본문을 완결하라.
"""


class ValueDriverGenerator:
    def __init__(
        self,
        ai_client: AiGatewayClient | None = None,
        base_report_dir: str | Path = "docs/report",
    ):
        self.ai = ai_client or AiGatewayClient()
        self.base_report_dir = Path(base_report_dir)

    async def generate_value_drivers(
        self, datapack: StockDataPack, target_date: str | None = None
    ) -> str:
        """
        StockDataPack의 재무, 시세, 뉴스 데이터를 바탕으로
        가치 드라이버 분석을 생성하고 docs/report/{date}/_data/{ticker}_VALUE_DRIVERS.md에 저장합니다.
        """
        date_str = target_date or datapack.date or dt_date.today().isoformat()
        ticker = datapack.ticker.upper().strip()

        logger.info(f"[{ticker}] 핵심 가치 드라이버 및 촉매 분석 시작...")

        prompt = self._build_prompt(datapack, date_str)
        try:
            markdown_content = await self.ai.chat(prompt, system_prompt=SYSTEM_PROMPT)
            markdown_content = markdown_content.strip()
        except Exception as e:
            logger.error(f"[{ticker}] 가치 드라이버 생성 AI 호출 실패: {e}")
            markdown_content = self._build_fallback_content(datapack, date_str)

        # 파일 저장: docs/report/{date}/_data/{ticker}_VALUE_DRIVERS.md
        out_dir = self.base_report_dir / date_str / "_data"
        out_dir.mkdir(parents=True, exist_ok=True)
        file_path = out_dir / f"{ticker}_VALUE_DRIVERS.md"
        file_path.write_text(markdown_content, encoding="utf-8")
        logger.info(f"[{ticker}] 가치 드라이버 파일 저장 완료: {file_path}")

        return markdown_content

    def _build_prompt(self, dp: StockDataPack, date_str: str) -> str:
        news_text = ""
        if dp.news_items:
            news_text = "\n".join(
                f"- {n['title']} ({n.get('publisher', '')}, {n.get('published_at', '')})"
                for n in dp.news_items
            )
        else:
            news_text = "(최신 수집 뉴스 없음 - 기업 비즈니스 모델 및 시장 포지션 기반 분석 수행)"

        fin_summary = ""
        if dp.income_annual:
            latest_inc = dp.income_annual[-1]
            fin_summary += (
                f"- 최근 연도: {latest_inc.year}, 매출: {latest_inc.revenue}, "
                f"영업이익: {latest_inc.operating_income} (마진 {latest_inc.operating_margin_pct}%), "
                f"순이익: {latest_inc.net_income}\n"
            )

        val = dp.valuation
        metrics_text = (
            f"- 현재가: ${val.current_price} (시가총액: {val.market_cap})\n"
            f"- Trailing PER: {val.trailing_pe}x, Forward PER: {val.forward_pe}x, PEG: {val.peg}x, PBR: {val.pbr}x\n"
        )

        return f"""다음 기업에 대해 주가와 가치를 결정짓는 **핵심 가치 드라이버 3~5개**와 **최신 촉매(Catalysts)**를 분석해 줘.

### 기업 기본 정보
- 티커: {dp.ticker} ({dp.company_name})
- 분석 기준일: {date_str}
- 시세 및 밸류에이션:
{metrics_text}
- 사업 개요:
{dp.overview}
- 최근 재무 실적 요약:
{fin_summary}

### 최근 시장 뉴스 및 헤드라인:
{news_text}

---
### 작성 형식 규격:
```markdown
# {dp.ticker} 가치 드라이버 분석
> 작성일: {date_str} | 조사 근거: 펀더멘털 재무 지표 및 최신 시장 뉴스·이슈 종합

## 핵심 드라이버 3~5개 (표 형식)
| # | 드라이버명 | 현재 상태 ({date_str} 기준) | 변화 감시 기준 | 중요도 |
|---|---|---|---|---|
| 1 | (핵심 KPI명) | (현재 구체적 상황·수치) | (무엇이 바뀌면 기업 가치에 영향) | 높음 |
| 2 | ... | ... | ... | ... |

## 각 드라이버 상세 분석
### 드라이버 1: (드라이버명)
- 현재: (구체적 팩트 및 현황)
- 감시: (앞으로 무엇을 추적해야 하는지)
- 영향: (왜 이것이 기업 가치와 주가를 움직이는가)

### 드라이버 2: (드라이버명)
- 현재: ...
- 감시: ...
- 영향: ...
(3~5개 작성)

## 드라이버 우선순위 & 리스크
- **가장 중요한 드라이버**: #1 (선정 사유)
- **가장 불확실한 드라이버**: #X (변수 및 리스크 요인)
- **단기 vs 장기 감시**: (단기 분기 추적 요소 vs 중장기 구조적 요소)

## 최신 시장 촉매 및 주요 뉴스 연계 (Catalysts)
- (최신 뉴스 헤드라인과 연계된 단기 주가 모멘텀 및 이벤트 분석 2~3개)
```
위 규격대로 다른 설명 없이 마크다운 전문만 출력해라.
"""

    def _build_fallback_content(self, dp: StockDataPack, date_str: str) -> str:
        return f"""# {dp.ticker} 가치 드라이버 분석
> 작성일: {date_str} | 기본 펀더멘털 기반 생성

## 핵심 드라이버 3개
| # | 드라이버명 | 현재 상태 | 변화 감시 기준 | 중요도 |
|---|---|---|---|---|
| 1 | 매출 성장세 및 시장 점유율 | 영업이익률 및 마진 추이 | 분기 실적 및 가이던스 달성 여부 | 높음 |
| 2 | 밸류에이션 및 현금흐름 창출력 | PER {dp.valuation.forward_pe or dp.valuation.trailing_pe or 'N/A'}x | 잉여현금흐름(FCF) 성장률 | 보통 |
| 3 | 산업 경기 사이클 및 매크로 리스크 | 매크로 금리 및 섹터 수급 | 고객사 캐펙스 및 수요 둔화 여부 | 높음 |
"""
