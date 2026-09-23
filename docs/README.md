# SeedTick 프로젝트 문서

> 미국 주식 자동 스크리닝·분석·매매 시스템 (소액 검증용, 10만원 미만)

## 프로젝트 구성

| 프로젝트 | 역할 | 스택 | 배포 |
|:---|:---|:---|:---|
| `seedtick-ai-gateway` | LLM 멀티키 로테이션 게이트웨이 | Elysia + Bun | Vercel |
| `seedtick-analyzer` | 스크리닝 → 분석 → 스케줄 → 자동매매 통합 서버 | FastAPI + Python | HuggingFace Docker Space |

> **Note**: Supabase는 서버가 아닌 클라이언트 라이브러리로만 사용.
> Bridge(증권사 연동)는 `seedtick-analyzer` 내장 라이브러리로 구현.

---

## 문서 구조

```
docs/
├── README.md
├── architecture/
│   ├── overview.md                    # 전체 시스템 아키텍처
│   ├── folder-structure.md            # 프로젝트 폴더 구조
│   └── deployment.md                  # 배포 전략
├── contract/
│   ├── api-spec.md                    # 서비스 간 API 스펙
│   ├── report-schema.md               # 분석 리포트 스키마
│   ├── order-interface.md             # 주문 인터페이스
│   └── error-codes.md                 # 공통 에러 코드 규칙
├── rules/
│   ├── coding-standards.md            # 코딩 컨벤션
│   ├── lint-config.md                 # 린트 설정 규칙
│   ├── git-convention.md              # 커밋/브랜치 컨벤션
│   └── safety-rules.md                # 자동매매 안전 규칙 (필수)
└── domains/
    ├── screener/
    ├── report/
    ├── scheduler/
    ├── auto-trading/
    ├── bridge/
    ├── error-log/
    └── ai-gateway/
```

---

## 빠른 링크

### 아키텍처
- [전체 시스템 아키텍처](./architecture/overview.md)
- [폴더 구조](./architecture/folder-structure.md)
- [배포 전략](./architecture/deployment.md)

### 프로젝트 간 계약 (Contract)
- [API 스펙](./contract/api-spec.md)
- [리포트 스키마](./contract/report-schema.md)
- [주문 인터페이스](./contract/order-interface.md)
- [에러 코드](./contract/error-codes.md)

### 규칙
- [코딩 컨벤션](./rules/coding-standards.md)
- [린트 설정](./rules/lint-config.md)
- [Git 컨벤션](./rules/git-convention.md)
- [자동매매 안전 규칙](./rules/safety-rules.md)

### 도메인
- [Screener](./domains/screener/overview.md)
- [Report](./domains/report/overview.md)
- [Scheduler](./domains/scheduler/overview.md)
- [Auto-Trading](./domains/auto-trading/overview.md)
- [Bridge](./domains/bridge/overview.md)
- [Error-Log](./domains/error-log/overview.md)
- [AI-Gateway](./domains/ai-gateway/overview.md)
