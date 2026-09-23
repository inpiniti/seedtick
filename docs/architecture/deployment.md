# 배포 전략

## seedtick-ai-gateway → Vercel

### 환경 구성
- **런타임**: Bun
- **프레임워크**: Elysia (Bun.serve 엔트리포인트)
- **리전**: ICN1 (Seoul) 또는 NRT1 (Tokyo) — 한국 시장 기준

### vercel.json
```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "functions": {
    "src/index.ts": {
      "runtime": "bun@1.x"
    }
  }
}
```

### 환경변수 (Vercel Dashboard)
```
GATEWAY_SECRET=           # 내부 호출 인증 토큰
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
OPENAI_API_KEY_1=
CLAUDE_API_KEY_1=
```

### 무료 티어 제약
- 함수 실행 시간: 최대 10초 (Hobby 플랜)
- 월간 요청 수: 100,000건
- 대역폭: 100GB

---

## seedtick-analyzer → HuggingFace Docker Space

### Space 설정
```
Space 이름: seedtick-analyzer
SDK: Docker
하드웨어: CPU Basic (무료)
Persistent Storage: 필요 없음 (Supabase 사용)
```

### Dockerfile
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

### HuggingFace Secrets
```
SUPABASE_URL=
SUPABASE_KEY=
AI_GATEWAY_URL=          # seedtick-ai-gateway Vercel URL
AI_GATEWAY_SECRET=
TOSS_API_KEY=
KIS_API_KEY=
DISCORD_WEBHOOK_URL=
PAPER_TRADING_MODE=true  # 실거래 전 반드시 false로 변경
```

### 무료 티어 제약
- **Sleep 정책**: 48시간 유휴 시 슬립
  - 대응: scheduler가 GitHub Actions cron으로 매일 깨우기
  - 또는 Space 설정에서 "Always On" 활성화 (유료)
- **메모리**: 16GB RAM (CPU Basic)
- **영구 저장소**: 없음 (필요 시 Supabase Storage 사용)

### GitHub Actions Warm-up (무료 대안)
```yaml
# .github/workflows/warmup.yml
name: Warmup HF Space
on:
  schedule:
    - cron: '0 8 * * *'  # UTC 08:00 = KST 17:00 (배치 1시간 전)
jobs:
  warmup:
    runs-on: ubuntu-latest
    steps:
      - run: curl ${{ secrets.HF_SPACE_URL }}/health
```

---

## Supabase

서버 배포 없음. 클라이언트 라이브러리로만 사용.

```
프로젝트 이름: seedtick
Region: ap-northeast-1 (Tokyo)
사용 테이블: reports, orders, error_logs
```

---

## 배포 순서

1. `seedtick-ai-gateway` Vercel 배포 → URL 확보
2. Supabase 프로젝트 생성 → 스키마 적용
3. `seedtick-analyzer` HF Space 배포 (PAPER_TRADING_MODE=true)
4. GitHub Actions warm-up 설정
5. 최소 1주일 paper-trading 모드로 검증
6. `PAPER_TRADING_MODE=false` 로 변경 → 실거래 시작
