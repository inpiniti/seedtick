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
    AI_GATEWAY_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    # 모델 순위 체인 (쉼표 구분, 앞쪽이 1순위).
    # 1순위가 트래픽 과부하(OpenRouter 200 내부 error code=503 등)로 실패하면 자동으로
    # 다음 순위로 내려가며, 매일 KST 00:00에 1순위로 초기화된다.
    # 미설정 시 AI_GATEWAY_MODEL 단일 값으로 1단계 체인이 구성된다(하위 호환).
    AI_MODEL_CHAIN: str = (
        "nvidia/nemotron-3-ultra-550b-a55b:free,"
        "stealth/space-bunny-alpha,"
        "dots-studio/dots-3-note-preview:free,"
        "poolside/laguna-s-2.1:free,"
        "inclusionai/ling-3.0-flash-sante:free,"
        "nvidia/nemotron-3.5-lightning:free"
    )
    AI_GATEWAY_TIMEOUT: float = 300.0  # 긴 32K 응답 수용을 위해 300초로 상향
    AI_GATEWAY_SECRET: str = ""  # seedtick-ai-gateway의 GATEWAY_SECRET (Bearer 토큰)
    AI_CONCURRENCY: int = 13  # 동시 처리 요청 수 (13인 거장 전원 동시 병렬)
    AI_REQUEST_INTERVAL_SEC: float = 0.0  # 요청 간 대기시간(초)
    AI_GATEWAY_MAX_TOKENS: int = 32768  # 모델 최대 생성 토큰 (32K 지원)
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
