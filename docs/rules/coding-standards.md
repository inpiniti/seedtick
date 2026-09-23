# 코딩 컨벤션

## 공통

- **언어**: 한국어 주석, 변수명/함수명은 영어 (camelCase or snake_case)
- **비즈니스 로직**: 도메인 레이어에만 위치. 라우트/컨트롤러에 로직 금지
- **에러 처리**: 모든 외부 호출(HTTP, DB)은 try-except/try-catch 필수
- **로깅**: print/console.log 금지. logger 사용 (Python: structlog, TS: pino)

---

## seedtick-ai-gateway (TypeScript + Bun + Elysia)

### 파일/폴더 네이밍
```
PascalCase:  클래스, 인터페이스, 타입 (KeyRotator.ts, ILLMAdapter.ts)
camelCase:   함수, 변수, 파일 (keyRotator.ts는 인스턴스 파일)
kebab-case:  라우트 파일 (chat.ts, health.ts)
```

### 타입 규칙
```typescript
// ✅ 명시적 반환 타입 선언
async function rotateTolNextKey(pool: KeyPool): Promise<ApiKey> { ... }

// ❌ any 금지
function process(data: any) { ... }

// ✅ unknown 사용 후 타입 가드
function process(data: unknown) {
  if (!isValidRequest(data)) throw new Error(...)
}
```

### Elysia 규칙
```typescript
// ✅ 각 라우트에 타입 명시
app.post('/v1/chat/completions', ({ body }) => ..., {
  body: t.Object({
    model: t.String(),
    messages: t.Array(...)
  })
})

// ❌ body 타입 없이 사용 금지
app.post('/v1/chat/completions', ({ body }) => ...)
```

### 린트/포맷
- **Biome** 사용 (ESLint + Prettier 대체)
- 설정: `biome.json` 참조 → [lint-config.md](./lint-config.md)

---

## seedtick-analyzer (Python + FastAPI)

### 파일/폴더 네이밍
```
snake_case:  모든 파일, 함수, 변수 (screener_service.py, get_stock_list)
PascalCase:  클래스 (ScreenerService, Report)
UPPER_SNAKE: 상수 (MAX_AMOUNT_KRW, DAILY_LIMIT)
```

### 타입 규칙
```python
# ✅ Pydantic 모델 사용
class Report(BaseModel):
    ticker: str
    verdict: Literal["BUY", "SELL", "HOLD", "WATCH"]

# ✅ 함수 시그니처에 타입 힌트 필수
async def generate_report(ticker: str) -> Report:
    ...

# ❌ Dict, List 등 미구체화 타입 금지
def process(data: dict) -> list:
    ...
```

### FastAPI 규칙
```python
# ✅ 응답 모델 명시
@router.post("/report/generate", response_model=Report)
async def generate(request: GenerateRequest):
    ...

# ✅ Depends로 의존성 주입
@router.get("/screener/run")
async def run(service: ScreenerService = Depends(get_screener_service)):
    ...
```

### 도메인 계층 규칙
```python
# ✅ service는 도메인 로직만
class ReportService:
    async def generate(self, ticker: str) -> Report:
        metrics = await self._fetch_metrics(ticker)
        prompt = self.prompt_builder.build(metrics)
        llm_response = await self.ai_client.chat(prompt)
        return self._parse_response(llm_response, metrics)

# ❌ 라우트에 비즈니스 로직 금지
@router.post("/report/generate")
async def generate(request: GenerateRequest):
    # 여기서 직접 HTTP 호출, 파싱 금지
    metrics = await httpx.get(...)  # ❌
    ...
```

### 린트/포맷
- **Ruff** 사용 (Flake8 + Black + isort 대체)
- 설정: `pyproject.toml` 참조 → [lint-config.md](./lint-config.md)
