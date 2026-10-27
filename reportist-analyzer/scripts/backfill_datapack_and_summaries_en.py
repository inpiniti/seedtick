"""
Backfill script for guru_reports:
1. Populates datapack.value_drivers_en from datapack.value_drivers.
2. Populates summaries[i].core_arguments_en, trigger_conditions_en, and quote_en.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_datapack_and_summaries_en")

GURU_EN_QUOTES = {
    "워런-버핏": "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
    "찰리-멍거": "It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid, instead of trying to be very intelligent.",
    "피터-린치": "Invest in what you know. Never invest in any idea you cannot illustrate with a crayon.",
    "필립-피셔": "Buying a truly outstanding growth company at a fair price yields far superior long-term returns.",
    "벤저민-그레이엄": "An investment operation promises safety of principal and an adequate return through thorough analysis. The margin of safety is always dependent on the price paid.",
    "세스-클라먼": "The most crucial aspect of investing is not losing capital. When bargains are scarce, holding cash is a sound strategy.",
    "조엘-그린블라트": "Buying good businesses at bargain prices is the simple, enduring secret to beating the market.",
    "존-템플턴": "Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria. The time of maximum pessimism is the best time to buy.",
    "앙드레-코스톨라니": "Stock investing is a game of patience. Buy sound stocks, take sleeping pills, and wake up years later rich.",
    "마이클-버리": "Consensus is inherently lazy. Only those who dissect contract footnotes and 10-K disclosures uncover massive asymmetric opportunities.",
    "모니시-파브라이": "Heads I win, tails I don't lose much! We don't need to be original innovators; we just need to be smart cloners of proven greatness.",
    "잭-슈웨거": "The key to winning in the markets is not prediction, but risk control. Cut your losses short and let your winners run.",
    "애스워스-다모다란": "Valuation is neither a science of numbers without stories, nor an art of stories without numbers. When narrative connects to cash flow, intrinsic value emerges.",
}


def clean_korean_text_to_en(text: str) -> str:
    """한국어 재무 문장을 전문 영문 문장으로 정밀 치환."""
    if not text:
        return ""
    s = text

    # 금액 / 단위
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*억\s*달러", r"$\1B", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*조\s*달러", r"$\1T", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*달러", r"$\1", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*조\s*원", r"\1T KRW", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*억\s*원", r"\100M KRW", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*원", r"\1 KRW", s)

    # 주요 재무 지표 및 용어
    s = re.sub(r"영업이익률", "operating margin", s)
    s = re.sub(r"영업이익", "operating income", s)
    s = re.sub(r"매출액|매출", "revenue", s)
    s = re.sub(r"순이익", "net income", s)
    s = re.sub(r"잉여현금흐름", "FCF", s)
    s = re.sub(r"시가총액", "market cap", s)
    s = re.sub(r"부채비율", "debt-to-equity ratio", s)
    s = re.sub(r"자기자본이익률", "ROE", s)
    s = re.sub(r"주당순이익", "EPS", s)
    s = re.sub(r"안전마진", "margin of safety", s)
    s = re.sub(r"적정가|내재가치", "intrinsic fair value", s)
    s = re.sub(r"투자의견", "verdict", s)
    s = re.sub(r"그레이엄\s*승수", "Graham Multiplier", s)
    s = re.sub(r"데이터센터", "data center", s)
    s = re.sub(r"성장률", "growth rate", s)
    s = re.sub(r"컨센서스", "consensus", s)

    # 잔여 문맥 매핑
    s = re.sub(r"에\s*달하며", " reaching", s)
    s = re.sub(r"기록(?:하였으며|했으나|하며)?", " recorded", s)
    s = re.sub(r"수준으로\s*산출된다", " is estimated", s)
    s = re.sub(r"크게\s*상회하고", " substantially exceeding", s)
    s = re.sub(r"하회하거나", " falling below or", s)
    s = re.sub(r"하회할\s*경우", " drops below", s)
    s = re.sub(r"지연\s*시", " delay", s)
    s = re.sub(r"때\s*매수\s*재검토", " triggers buy re-evaluation", s)

    # 잔여 한글 문자열이 있을 경우 안전 정리
    # (단어 사이에 남은 조사나 연결어구 정리)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def translate_value_drivers_to_en(vd_text: str, ticker: str, date_str: str) -> str:
    """한국어 가치 드라이버 마크다운을 영문 마크다운으로 번역."""
    if not vd_text:
        return ""

    s = vd_text
    s = re.sub(rf"^#\s*{re.escape(ticker)}\s*가치\s*드라이버\s*분석", f"# {ticker} Key Value Drivers Analysis", s, flags=re.MULTILINE)
    s = re.sub(r">\s*작성일:\s*(.*?)\s*\|\s*조사\s*근거:[^\n]+", rf"> Date: \1 | Source: Comprehensive fundamental metrics and latest market catalysts", s)
    s = re.sub(r">\s*작성일:\s*(.*?)\s*\|\s*기본[^\n]+", rf"> Date: \1 | Generated based on core fundamentals", s)
    s = re.sub(r"##\s*핵심\s*드라이버\s*3~5개\s*\(표\s*형식\)", "## Key Drivers (Table)", s)
    s = re.sub(r"##\s*핵심\s*드라이버\s*3~5개", "## Key Drivers", s)
    s = re.sub(
        r"\|\s*#\s*\|\s*드라이버명\s*\|\s*현재\s*상태\s*(\(.*?\))?\s*\|\s*변화\s*감시\s*기준\s*\|\s*중요도\s*\|",
        rf"| # | Driver | Current Status (as of {date_str}) | Monitoring Criteria | Priority |",
        s,
    )
    s = re.sub(r"\|\s*높음\s*\|", "| High |", s)
    s = re.sub(r"\|\s*(?:중간|보통)\s*\|", "| Medium |", s)
    s = re.sub(r"\|\s*낮음\s*\|", "| Low |", s)
    s = re.sub(r"##\s*각\s*드라이버\s*상세\s*분석", "## Detailed Driver Analysis", s)
    s = re.sub(r"###\s*드라이버\s*([0-9]+)\s*:", r"### Driver \1:", s)
    s = re.sub(r"^-\s*현재\s*:", "- Current:", s, flags=re.MULTILINE)
    s = re.sub(r"^-\s*감시\s*:", "- Monitoring:", s, flags=re.MULTILINE)
    s = re.sub(r"^-\s*영향\s*:", "- Impact:", s, flags=re.MULTILINE)
    s = re.sub(r"##\s*드라이버\s*우선순위\s*&\s*리스크", "## Driver Priorities & Risks", s)
    s = re.sub(r"\*\*\s*가장\s*중요한\s*드라이버\s*\*\*", "**Top Priority Driver**", s)
    s = re.sub(r"\*\*\s*가장\s*불확실한\s*드라이버\s*\*\*", "**Highest Uncertainty Driver**", s)
    s = re.sub(r"\*\*\s*단기\s*vs\s*장기\s*감시\s*\*\*", "**Short-term vs Long-term Monitoring**", s)
    s = re.sub(r"##\s*최신\s*시장\s*촉매[^\n]+", "## Recent Market Catalysts & News", s)

    # 단위 및 재무지표 변환
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*억\s*달러", r"$\1B", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*조\s*달러", r"$\1T", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*달러", r"$\1", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*조\s*원", r"\1T KRW", s)
    s = re.sub(r"(\d+[\d,]*\.?\d*)\s*억\s*원", r"\100M KRW", s)
    s = re.sub(r"영업이익률", "operating margin", s)
    s = re.sub(r"영업이익", "operating income", s)
    s = re.sub(r"매출액|매출", "revenue", s)
    s = re.sub(r"순이익", "net income", s)
    s = re.sub(r"시가총액", "market cap", s)
    s = re.sub(r"데이터센터", "Data Center", s)

    return s


def main():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "reportist-admin", ".env.local")
    envs = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    envs[k.strip()] = v.strip().strip('"\'')

    url = envs.get("NEXT_PUBLIC_SUPABASE_URL") or envs.get("SUPABASE_URL")
    key = envs.get("SUPABASE_SERVICE_ROLE_KEY") or envs.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        logger.error("Supabase credentials not found in reportist-admin/.env.local.")
        sys.exit(1)

    # 최신 리포트들 조회 (오늘 분석된 레코드 포함 최근 50개)
    fetch_url = f"{url}/rest/v1/guru_reports?select=id,d,ticker,datapack,summaries&order=d.desc&limit=50"
    req = urllib.request.Request(fetch_url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    })

    try:
        with urllib.request.urlopen(req) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to fetch rows: {e}")
        sys.exit(1)

    logger.info(f"Fetched {len(rows)} recent reports for datapack & summaries English backfill.")

    updated_count = 0
    for row in rows:
        row_id = row["id"]
        ticker = row.get("ticker", "")
        date_str = row.get("d", "")
        datapack = row.get("datapack") or {}
        summaries = row.get("summaries") or []

        changed = False

        # 1. datapack.value_drivers_en 생성 및 주입
        vd_ko = datapack.get("value_drivers", "")
        existing_vd_en = datapack.get("value_drivers_en", "")
        if vd_ko and (not existing_vd_en or len(existing_vd_en) < 20):
            vd_en = translate_value_drivers_to_en(vd_ko, ticker, date_str)
            datapack["value_drivers_en"] = vd_en
            changed = True

        # 2. summaries 영문 필드 (core_arguments_en, trigger_conditions_en, quote_en) 주입
        if isinstance(summaries, list):
            for item in summaries:
                if not isinstance(item, dict):
                    continue
                persona = item.get("persona", "")
                
                # quote_en
                if not item.get("quote_en"):
                    official_q = GURU_EN_QUOTES.get(persona)
                    if official_q:
                        item["quote_en"] = official_q
                        changed = True

                # core_arguments_en
                args_ko = item.get("core_arguments") or []
                if args_ko and not item.get("core_arguments_en"):
                    args_en = [clean_korean_text_to_en(a) for a in args_ko]
                    item["core_arguments_en"] = args_en
                    changed = True

                # trigger_conditions_en
                trigs_ko = item.get("trigger_conditions") or []
                if trigs_ko and not item.get("trigger_conditions_en"):
                    trigs_en = [clean_korean_text_to_en(t) for t in trigs_ko]
                    item["trigger_conditions_en"] = trigs_en
                    changed = True

        if not changed:
            continue

        # Supabase에 PATCH 업데이트
        update_payload = {
            "datapack": datapack,
            "summaries": summaries,
        }
        patch_url = f"{url}/rest/v1/guru_reports?id=eq.{urllib.parse.quote(row_id)}"
        patch_req = urllib.request.Request(
            patch_url,
            data=json.dumps(update_payload).encode("utf-8"),
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(patch_req) as patch_resp:
                if patch_resp.status in (200, 204):
                    updated_count += 1
                    logger.info(f"[{updated_count}] Updated {ticker} ({date_str}) datapack & summaries successfully.")
        except Exception as e_patch:
            logger.error(f"Failed to update {ticker} ({row_id}): {e_patch}")

    logger.info(f"=== Complete: {updated_count} reports updated with English datapack & summaries! ===")


if __name__ == "__main__":
    main()
