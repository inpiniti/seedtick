# Auto-Trading 데이터 구조 (v3)

## 1. Pydantic 모델

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class GridTradeItem(BaseModel):
    id: str | None = None
    ticker: str
    initial_price: float               # 처음매수주가 ($)
    gap: float                         # 고정 갭 ($) = initial_price * 0.03
    last_trade_price: float            # 마지막매매주가 ($)
    order_amount_krw: int = 1000       # 주문금액 (1000원 고정)
    status: Literal["ACTIVE", "FINISHED"] = "ACTIVE"
    holdings_qty: float = 0.0          # 현재 추적 보유 수량
    total_buy_count: int = 1           # 누적 매수 체결 횟수
    total_sell_count: int = 0          # 누적 매도 체결 횟수
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GridTradingStatus(BaseModel):
    is_ws_connected: bool
    is_market_open: bool
    active_count: int
    active_tickers: list[str]
```

## 2. Supabase 테이블 스키마 (grid_trades)

```sql
create table if not exists public.grid_trades (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  initial_price numeric not null,
  gap numeric not null,
  last_trade_price numeric not null,
  order_amount_krw numeric not null default 1000,
  status text not null default 'ACTIVE',
  holdings_qty numeric not null default 0,
  total_buy_count integer not null default 1,
  total_sell_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grid_trades_status_idx on public.grid_trades (status);
create index if not exists grid_trades_ticker_idx on public.grid_trades (ticker);
```
