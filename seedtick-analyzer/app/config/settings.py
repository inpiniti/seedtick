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
    AI_GATEWAY_MODEL: str = "gemini-2.5-pro"
    AI_GATEWAY_TIMEOUT: float = 60.0
    AI_GATEWAY_SECRET: str = ""  # seedtick-ai-gateway의 GATEWAY_SECRET (Bearer 토큰)
    AI_CONCURRENCY: int = 10  # 동시 처리 요청 수 (기본 최대 10개 병렬)
    AI_REQUEST_INTERVAL_SEC: float = 0.0  # 요청 간 대기시간(초)

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

    # BTC-AI Backend Toss Screener URL
    BTC_AI_TOSS_URL: str = "https://younginpiniti-bitcoin-ai-backend.hf.space/toss"


settings = Settings()
