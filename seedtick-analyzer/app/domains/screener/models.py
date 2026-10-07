"""
Screener 도메인 데이터 모델 (Pydantic)
"""
from datetime import datetime
from pydantic import BaseModel, Field


class ScreenCriteria(BaseModel):
    """스크리닝 기준 (기본: 토스 13인 거장 공통 필터)"""
    preset: str = "공통"
    nation: str = "us"
    size: int = 200
    page: int = 1
    exclude_tickers: list[str] = Field(default_factory=list)


class TossStockItem(BaseModel):
    """스크리닝 종목 아이템"""
    ticker: str                      # 심볼 (예: AAPL, NVDA)
    stock_code: str                  # 토스 코드 (예: US20020523001)
    name: str                        # 한글/영문 종목명
    price: float | None = None       # 현재가
    prev_close: float | None = None  # 전일 종가
    change_rate: float | None = None # 전일 대비 등락률 (%)
    market_cap: float | None = None  # 시가총액
    debt_ratio: float | None = None  # 부채비율
    interest_coverage: float | None = None # 이자보상배율
    operating_margin: float | None = None  # 영업이익률
    roe: float | None = None         # ROE
    logo_image_url: str | None = None
    screeners: list[str] = Field(default_factory=list) # 통과한 거장/스크리너 목록 (예: ['종합', '버핏'])

    # ── DataRoma 슈퍼인베스터 포트폴리오(두번째 스크리너) 전용 선택 필드 ──
    holders: int | None = None             # 해당 종목을 보유한 슈퍼인베스터 수
    weight_pct: float | None = None        # Grand Portfolio 내 비중 (%)
    hold_price: float | None = None        # 최종 보유 시점 가격 (Hold Price*)
    week52_low: float | None = None        # 52주 최저가
    week52_high: float | None = None       # 52주 최고가


class ScreenResult(BaseModel):
    """스크리닝 최종 결과"""
    tickers: list[TossStockItem]
    items: list[TossStockItem] = Field(default_factory=list)
    total_count: int
    count: int
    criteria: ScreenCriteria
    fetched_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    source: str = "toss_screener"

    def model_post_init(self, __context) -> None:
        if not self.items and self.tickers:
            self.items = self.tickers
        elif not self.tickers and self.items:
            self.tickers = self.items


class CandleItem(BaseModel):
    """일봉 캔들스틱 데이터 포인트"""
    time: str                        # YYYY-MM-DD
    open: float
    high: float
    low: float
    close: float
    volume: int | None = None


class BollingerPoint(BaseModel):
    """볼린저 밴드 시계열 포인트 (20일 SMA, 2표준편차)"""
    time: str                        # YYYY-MM-DD
    upper: float | None = None
    middle: float | None = None
    lower: float | None = None
    percent_b: float | None = None


class BollingerSummary(BaseModel):
    """현재 시점 볼린저 밴드 위치 및 상태 판정"""
    current_price: float
    upper: float
    middle: float
    lower: float
    percent_b: float                 # (현재가 - 하단) / (상단 - 하단)
    bandwidth: float                 # (상단 - 하단) / 중심선
    status: str                      # LOWER_BREAK | LOWER_NEAR | MIDDLE | UPPER_NEAR | UPPER_BREAK
    status_label: str                # 하단 이탈 | 하단 밴드 근접 | 중심선 영역 | 상단 밴드 근접 | 상단 돌파
    status_description: str


class StockChartResponse(BaseModel):
    """일봉 차트 및 볼린저 밴드 전체 응답"""
    ticker: str
    period: str = "6mo"
    interval: str = "1d"
    candles: list[CandleItem] = Field(default_factory=list)
    bollinger: list[BollingerPoint] = Field(default_factory=list)
    summary: BollingerSummary | None = None


class TickerLogoResponse(BaseModel):
    """티커별 로고 조회 응답"""
    ticker: str
    logo_image_url: str | None = None
    source: str = "none"  # cached | toss_lookup | none


class TickerLogoBatchResponse(BaseModel):
    """여러 티커 로고 조회 응답"""
    items: list[TickerLogoResponse] = Field(default_factory=list)
