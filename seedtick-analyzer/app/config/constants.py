"""
시스템 전역 상수 정의
"""

# 안전 매매 한도 (소액 검증용)
MAX_DAILY_INVESTMENT_KRW = 100_000   # 일일 최대 투자 한도: 10만원
DEFAULT_ORDER_AMOUNT_KRW = 30_000    # 종목당 기본 주문 금액: 3만원
MIN_ORDER_AMOUNT_KRW = 10_000        # 최소 주문 금액: 1만원

# 스크리너 상수
DEFAULT_SCREENER_GURU = "공통"
DEFAULT_SCREENER_NATION = "us"
DEFAULT_SCREENER_SIZE = 200
BTC_AI_TOSS_URL = "https://younginpiniti-bitcoin-ai-backend.hf.space/toss"

# 13인 거장 명단 및 순서 (guru_votes 컬럼 g1 ~ g13 매핑)
GURU_NAMES = [
    "벤저민 그레이엄",   # g1
    "세스 클라먼",       # g2
    "모니시 파브라이",   # g3
    "조엘 그린블라트",   # g4
    "앙드레 코스톨라니", # g5
    "잭 슈웨거",         # g6
    "워런 버핏",         # g7
    "필립 피셔",         # g8
    "뉴욕주민",         # g9 (또는 찰리 멍거)
    "피터 린치",         # g10
    "애스워스 다모다란", # g11
    "존 템플턴",         # g12
    "마이클 버리",       # g13
]

# 투자의견 및 DB 점수 매핑
VERDICT_SCORE_MAP = {
    "매수": 0,
    "보유": 1,
    "관망": 2,
    "매도": 3,
}

SCORE_VERDICT_MAP = {v: k for k, v in VERDICT_SCORE_MAP.items()}

# 스케줄 시간
DEFAULT_PIPELINE_CRON = "0 18 * * 1-5"  # 월~금 18:00 KST
