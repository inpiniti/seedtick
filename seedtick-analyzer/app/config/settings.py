"""
애플리케이션 설정 관리 (Pydantic Settings)
"""
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 기본 환경
    ENV: Literal["development", "production", "test"] = "development"
    LOG_LEVEL: str = "INFO"
    DRY_RUN: bool = True  # 안전을 위해 기본값 True

    # AI-Gateway 연동
    AI_GATEWAY_URL: str = "http://localhost:3000"
    AI_GATEWAY_MODEL: str = "inclusionai/ling-3.1-flash"
    # 모델 순위 체인 (쉼표 구분, 앞쪽이 1순위).
    # 1순위가 트래픽 과부하(OpenRouter 200 내부 error code=503 등)로 실패하면 자동으로
    # 다음 순위로 내려가며, 매일 KST 00:00에 1순위로 초기화된다.
    # 미설정 시 AI_GATEWAY_MODEL 단일 값으로 1단계 체인이 구성된다(하위 호환).
    AI_MODEL_CHAIN: str = (
        "inclusionai/ling-3.1-flash,"
        "thinkingmachines/inkling-small:free,"
        "thinkingmachines/inkling:free,"
        "nvidia/nemotron-3-ultra-550b-a55b:free,"
        "poolside/laguna-s-2.1:free,"
        "inclusionai/ling-3.0-flash-sante:free,"
        "google/gemma-4-31b-it:free,"
        "google/gemma-4-26b-a4b-it:free,"
        "nvidia/nemotron-3.5-lightning:free,"
        "nvidia/nemotron-3-super-120b-a12b:free,"
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,"
        "cohere/north-mini-code:free,"
        "liquid/lfm-2.5-2.6b:free,"
        "dots-studio/dots-3-note-preview:free,"
        "apodex/apodex-1.1-mini:free,"
        "poolside/laguna-xs-2.1:free,"
        "nvidia/nemotron-3.5-content-safety:free"
    )
    # 보고서 판단값은 한 실행 안에서 모델이 섞이지 않도록 단일 모델을 고정한다.
    # 비우면 AI_GATEWAY_MODEL을 사용한다. 장애 시 다른 모델로 조용히 갈아타지 않고
    # 해당 모델의 키/슬롯 재시도 후 실패 처리한다.
    AI_REPORT_MODEL: str = ""
    AI_REPORT_TEMPERATURE: float = 0.0
    AI_GATEWAY_TIMEOUT: float = 300.0  # 긴 32K 응답 수용을 위해 300초로 상향
    AI_FIRST_TOKEN_TIMEOUT: float = 20.0  # 스트리밍 첫 글자(TTFT) 대기 상한(초). 20초 내 무응답 시 즉시 탈락 및 다음 슬롯 전환
    AI_CHUNK_TIMEOUT: float = 20.0  # 토큰 간 지연 상한(초). 생성 중 연결 정체(Hang) 감지
    # 생성 다양성(temperature). 내재가치·투자의견 변동 폭을 줄이기 위해 기본값을 낮춘다.
    AI_GATEWAY_TEMPERATURE: float = 0.1
    # 순위 강등까지 필요한 연속 모델 레벨 실패 횟수. 1이면 첫 실패 즉시 강등.
    # 2 이상이면 일시적 503 한 번으로는 순위를 내리지 않아 불필요한 하향을 줄인다.
    AI_MODEL_FAILURE_THRESHOLD: int = 1
    # 강등된 모델을 다시 시도하기 전까지 대기하는 초 (half-open 프로모션 쿨다운).
    # 프로바이더 과부하는 실제로 몇 분 안에 풀리므로 00:01 리셋까지 기다릴 필요가 없다.
    AI_MODEL_PROMOTION_COOLDOWN_SEC: float = 600.0
    # 반복 실패 시 백오프 상한(초)
    AI_MODEL_PROMOTION_MAX_COOLDOWN_SEC: float = 3600.0
    AI_GATEWAY_SECRET: str = ""  # seedtick-ai-gateway의 GATEWAY_SECRET (Bearer 토큰)
    AI_CONCURRENCY: int = 13  # 동시 처리 요청 수 (13인 거장 전원 동시 병렬)
    AI_REQUEST_INTERVAL_SEC: float = 0.0  # 요청 간 대기시간(초)
    AI_GATEWAY_MAX_TOKENS: int = 32768  # 모델 최대 생성 토큰 (32K 지원)

    # 프롬프트 규격 버전 (guru_opinions.prompt_version 에 기록 → 품질 회귀 추적용)
    REPORT_PROMPT_VERSION: str = "2026-10-08.v4"

    MAX_ANALYZE_COUNT: int = 0  # 1일 최대 리포트 분석 종목 수 (0: 스크리너 전체 무제한)
    # AI 프로바이더 직접 호출 (게이트웨이 우회 시 사용, 쉼표 구분 멀티키 지원)
    OPENROUTER_API_KEYS: str = ""
    OPENROUTER_API_KEY: str = ""
    CLINE_API_KEYS: str = ""
    CLINE_API_KEY: str = ""
    KILO_API_KEYS: str = ""
    KILO_API_KEY: str = ""

    # Supabase 연동
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # 증권사 연동 (Bridge)
    DEFAULT_BROKER: Literal["mock", "toss", "kis"] = "mock"

    # 토스증권 Open API
    TOSS_CLIENT_ID: str = ""
    TOSS_CLIENT_SECRET: str = ""
    TOSS_ACCOUNT_SEQ: str = ""

    # 한국투자증권 Open API
    KIS_APP_KEY: str = ""
    KIS_APP_SECRET: str = ""
    KIS_CANO: str = ""
    KIS_ACNT_PRDT_CD: str = "01"

    # 알림
    DISCORD_WEBHOOK_URL: str = ""

    # BTC-AI Backend Toss Screener URL (토스 WTS 비공개 API 직접 호출로 전환됨)
    BTC_AI_TOSS_URL: str = "https://younginpiniti-bitcoin-ai-backend.hf.space/toss"


settings = Settings()
