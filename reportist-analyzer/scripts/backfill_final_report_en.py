"""
Backfill script for guru_reports:
1. Cleans Korean words (e.g. '(관망)', '관망', '매수') from conclusion_en and English bullet points.
2. Builds and populates final_report_en for rows where final_report_en is NULL.
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
logger = logging.getLogger("backfill_final_report_en")

GURU_REPORT_ROSTER = [
    ("벤저민 그레이엄", "벤저민-그레이엄"),
    ("세스 클라먼", "세스-클라먼"),
    ("모니시 파브라이", "모니시-파브라이"),
    ("조엘 그린블라트", "조엘-그린블라트"),
    ("앙드레 코스톨라니", "앙드레-코스톨라니"),
    ("잭 슈웨거", "잭-슈웨거"),
    ("워런 버핏", "워런-버핏"),
    ("필립 피셔", "필립-피셔"),
    ("찰리 멍거", "찰리-멍거"),
    ("피터 린치", "피터-린치"),
    ("애스워스 다모다란", "애스워스-다모다란"),
    ("존 템플턴", "존-템플턴"),
    ("마이클 버리", "마이클-버리"),
]

GURU_EN_NAME_MAP = {
    "벤저민 그레이엄": "Benjamin Graham",
    "세스 클라먼": "Seth Klarman",
    "모니시 파브라이": "Mohnish Pabrai",
    "조엘 그린블라트": "Joel Greenblatt",
    "앙드레 코스톨라니": "André Kostolany",
    "잭 슈웨거": "Jack Schwager",
    "워런 버핏": "Warren Buffett",
    "필립 피셔": "Philip Fisher",
    "찰리 멍거": "Charlie Munger",
    "피터 린치": "Peter Lynch",
    "애스워스 다모다란": "Aswath Damodaran",
    "존 템플턴": "John Templeton",
    "마이클 버리": "Michael Burry",
}

STYLE_EN_MAP = {
    "가치/안전마진": "Value / Safety Margin",
    "성장/GARP": "Growth / GARP",
    "퀄리티/자본수익률": "Quality / Capital Efficiency",
    "퀀트/자본수익률": "Quant / Capital Efficiency",
    "DCF/가치평가": "DCF / Valuation",
    "매크로/유동성": "Macro / Liquidity",
    "모멘텀/추세추종": "Momentum / Trend",
    "포렌식/회계검증": "Forensic / Accounting",
}

VERDICT_EN_MAP = {"매수": "BUY", "보유": "HOLD", "관망": "WATCH", "매도": "SELL"}


def clean_korean_from_en(text: str) -> str:
    """영문 텍스트 내에 섞인 한글 투자의견 및 한글 단어들을 영문 표준 용어로 치환 및 정제."""
    if not text:
        return ""
    s = text
    # 괄호 안 한글 투자의견 치환: (관망) -> (WATCH), (매수) -> (BUY) 등
    s = re.sub(r"\(\s*관망\s*\)", "(WATCH)", s)
    s = re.sub(r"\(\s*매수\s*\)", "(BUY)", s)
    s = re.sub(r"\(\s*보유\s*\)", "(HOLD)", s)
    s = re.sub(r"\(\s*매도\s*\)", "(SELL)", s)
    # 단독 한글 투자의견 치환
    s = re.sub(r"관망", "WATCH", s)
    s = re.sub(r"매수", "BUY", s)
    s = re.sub(r"보유", "HOLD", s)
    s = re.sub(r"매도", "SELL", s)
    # 금액/단위 치환
    s = re.sub(r"조\s*원", "T KRW", s)
    s = re.sub(r"억\s*원", "00M KRW", s)
    s = re.sub(r"(\d+)\s*원", r"KRW \1", s)
    return s.strip()


def _format_price_en(value: float | None, currency: str) -> str:
    if value is None:
        return "Pending"
    curr = (currency or "USD").upper()
    if curr == "USD":
        return f"${value:,.2f}"
    return f"{curr} {value:,.0f}"


def build_final_report_en(row: dict[str, Any]) -> str:
    ticker = row.get("ticker", "")
    date_str = row.get("d", "")
    company_name_en = row.get("company_name_en") or row.get("company_name") or ticker
    verdict = row.get("verdict", "관망")
    verdict_en = VERDICT_EN_MAP.get(verdict, "WATCH")
    vote_summary = row.get("vote_summary", "")
    vote_summary_en = (
        vote_summary.replace("매수", "BUY")
        .replace("보유", "HOLD")
        .replace("관망", "WATCH")
        .replace("매도", "SELL")
    )
    current_price = row.get("current_price")
    currency = "KRW" if (ticker.isdigit() or len(ticker) == 6) else "USD"

    fair_val = row.get("fair_value")
    band_l = row.get("band_low")
    band_h = row.get("band_high")
    safety_entry = row.get("safety_entry")
    target_sell = row.get("target_sell")
    dispersion_pct = row.get("dispersion_pct")
    mean_score = row.get("mean_score")
    score_std = row.get("score_std")
    net_buy_ratio = row.get("net_buy_ratio")
    style_breakdown = row.get("style_breakdown") or {}
    data_gap_watch_count = row.get("data_gap_watch_count") or 0
    review_flags = row.get("valuation_flags") or []

    fair_value_header_en = _format_price_en(fair_val, currency)
    safety_header_en = f"Below {_format_price_en(safety_entry, currency)}" if safety_entry is not None else "Pending"
    target_header_en = _format_price_en(target_sell, currency) if target_sell is not None else "Pending"
    
    if band_l is not None and band_h is not None:
        band_header_en = f"{_format_price_en(band_l, currency)} – {_format_price_en(band_h, currency)}"
    else:
        band_header_en = "Pending"

    dispersion_text_en = f"{dispersion_pct:.1f}%" if dispersion_pct is not None else "N/A"
    mean_score_str_en = f"Mean {mean_score:.2f} pts" if mean_score is not None else "Score Pending"
    score_std_str_en = f"(Std Dev: {score_std:.2f})" if score_std is not None else ""
    net_buy_str = f"{net_buy_ratio:+.1%}" if net_buy_ratio is not None else "N/A"

    style_desc_items_en = []
    for bucket_name, b_counts in style_breakdown.items():
        b_en = STYLE_EN_MAP.get(bucket_name, bucket_name)
        sub_items = [f"{VERDICT_EN_MAP.get(v, v)} {c}" for v, c in b_counts.items() if c > 0]
        if sub_items:
            style_desc_items_en.append(f"{b_en} ({', '.join(sub_items)})")
    style_summary_text_en = " · ".join(style_desc_items_en) if style_desc_items_en else "Calculating"

    conclusion_en = clean_korean_from_en(row.get("conclusion_en") or "")
    if not conclusion_en:
        conclusion_en = (
            f"Based on deterministic aggregation rules, overall consensus is {verdict_en} "
            f"for {company_name_en} with median fair value of {fair_value_header_en}."
        )

    lines_en = [
        f"# {ticker} ({company_name_en}) Final Investment Master Report",
        f"> **Date**: {date_str} | **Consensus Verdict**: **{verdict_en}** | **Votes**: {vote_summary_en}",
        f"> **Current Price**: {_format_price_en(current_price, currency)} | **13-Guru Fair Value Median**: {fair_value_header_en} (Fair Value Band Q1–Q3: {band_header_en})",
        f"> **Execution Reference**: [Margin of Safety Entry] {safety_header_en} | [Target Price Upper Reference] {target_header_en}",
        "",
        "## 1. Executive Summary & Consensus Rationale",
        f"- **Consensus Verdict**: {verdict_en}",
        f"- **Executive Rationale**: {conclusion_en}",
        f"- **Continuous Score Stats**: {mean_score_str_en} {score_std_str_en} [0=BUY ~ 3=SELL], Net Buy Ratio: {net_buy_str}".replace("  ", " "),
        f"- **Style Breakdown**: {style_summary_text_en}",
        f"- **Consensus Rule**: Requires at least 7 valid votes out of 13. A verdict requires at least 60% agreement; otherwise classified as WATCH.",
        f"- **Valuation Aggregation**: Median of midpoints from valid price ranges. Fair value band represents the interquartile range (Q1–Q3).",
        f"- **Valuation Dispersion**: {dispersion_text_en} (Interquartile Range Q1–Q3 width ÷ Median Fair Value; IQR dispersion)",
    ]
    if data_gap_watch_count > 0:
        lines_en.append(f"- **Conditional Watch**: {data_gap_watch_count} gurus reserved judgment pending additional financial disclosures.")
    if review_flags:
        lines_en.append("- **Review Items**: " + "; ".join(review_flags))

    # Bull Case
    lines_en.extend(["", "## 2. Key Bullish Catalysts (Bull Case)"])
    bull_pts = [clean_korean_from_en(p) for p in (row.get("bull_points_en") or []) if clean_korean_from_en(p)]
    if bull_pts:
        for pt in bull_pts:
            lines_en.append(f"- {pt}")
    else:
        lines_en.append("- Insufficient structured bullish arguments collected.")

    # Bear Case
    lines_en.extend(["", "## 3. Key Bearish Risks (Bear Case)"])
    bear_pts = [clean_korean_from_en(p) for p in (row.get("bear_points_en") or []) if clean_korean_from_en(p)]
    if bear_pts:
        for pt in bear_pts:
            lines_en.append(f"- {pt}")
    else:
        lines_en.append("- Insufficient structured bearish risks collected.")

    # Topics & Drivers
    lines_en.extend(["", "## 4. Core Analytical Debates & Value Drivers"])
    hot_topics_en = [clean_korean_from_en(t) for t in (row.get("hot_topics_en") or []) if clean_korean_from_en(t)]
    key_drivers_en = [clean_korean_from_en(d) for d in (row.get("key_drivers_en") or []) if clean_korean_from_en(d)]
    if hot_topics_en:
        lines_en.extend([f"- {t}" for t in hot_topics_en])
    if key_drivers_en:
        lines_en.extend([f"- {d}" for d in key_drivers_en])
    if not hot_topics_en and not key_drivers_en:
        lines_en.append("- Fundamental growth catalysts and competitive moat sustainability.")

    # Practical Reference
    lines_en.extend(["", "## 5. Practical Investment Reference"])
    lines_en.append(f"- Margin of Safety Reference: {safety_header_en}")
    lines_en.append(f"- Current Price: {_format_price_en(current_price, currency)}")
    lines_en.append(f"- Verdict: {verdict_en} (Supermajority vote consensus applied)")

    # 13-Guru Table
    lines_en.extend(
        [
            "",
            "## 6. 13-Guru Consensus Summary Table",
            "| Guru | Verdict | Confidence | Fair Value Range | Core Thesis |",
            "|---|---|---:|---|---|",
        ]
    )
    summaries_list = row.get("summaries") or []
    persona_by_key = {s.get("persona"): s for s in summaries_list if isinstance(s, dict)}

    for guru_name, persona_key in GURU_REPORT_ROSTER:
        s = persona_by_key.get(persona_key)
        guru_en = GURU_EN_NAME_MAP.get(guru_name, guru_name)
        if not s or s.get("parse_mode") == "fallback":
            lines_en.append(f"| {guru_en} | NO RESPONSE | — | — | — |")
            continue
        v_raw = s.get("verdict", "")
        v_en = VERDICT_EN_MAP.get(v_raw, v_raw)
        conf = s.get("confidence", "—")
        target = clean_korean_from_en((s.get("target_price_range") or "—").replace("|", "/"))
        args = s.get("core_arguments") or []
        arg = clean_korean_from_en((args[0] if args else "").replace("|", "/"))
        lines_en.append(f"| {guru_en} | {v_en} | {conf}/10 | {target} | {arg} |")

    lines_en.extend(["", "*This report is generated via simulated book-based AI personas and does not constitute financial advice.*"])
    return "\n".join(lines_en)


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
        logger.error("Supabase credentials not found.")
        sys.exit(1)

    # 1. conclusion_en이 있는 레코드들 우선 조회 (최신 보고서들)
    fetch_url = f"{url}/rest/v1/guru_reports?select=*&conclusion_en=not.is.null&final_report_en=is.null&order=d.desc&limit=200"
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

    logger.info(f"Fetched {len(rows)} rows needing final_report_en backfill (with conclusion_en).")

    updated_count = 0
    for row in rows:
        row_id = row["id"]
        ticker = row.get("ticker")
        date_str = row.get("d")

        # 1) Clean Korean words in conclusion_en and bullet points
        cleaned_conclusion = clean_korean_from_en(row.get("conclusion_en") or "")
        cleaned_bull = [clean_korean_from_en(p) for p in (row.get("bull_points_en") or [])]
        cleaned_bear = [clean_korean_from_en(p) for p in (row.get("bear_points_en") or [])]
        cleaned_hot = [clean_korean_from_en(p) for p in (row.get("hot_topics_en") or [])]
        cleaned_drivers = [clean_korean_from_en(p) for p in (row.get("key_drivers_en") or [])]

        row_for_builder = dict(row)
        row_for_builder["conclusion_en"] = cleaned_conclusion
        row_for_builder["bull_points_en"] = cleaned_bull
        row_for_builder["bear_points_en"] = cleaned_bear
        row_for_builder["hot_topics_en"] = cleaned_hot
        row_for_builder["key_drivers_en"] = cleaned_drivers

        # 2) Build final_report_en markdown
        final_report_en = build_final_report_en(row_for_builder)

        # 3) Update row in Supabase
        update_payload = {
            "conclusion_en": cleaned_conclusion,
            "bull_points_en": cleaned_bull,
            "bear_points_en": cleaned_bear,
            "hot_topics_en": cleaned_hot,
            "key_drivers_en": cleaned_drivers,
            "final_report_en": final_report_en,
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
                    logger.info(f"[{updated_count}/{len(rows)}] Updated {ticker} ({date_str}) successfully.")
        except Exception as e_patch:
            logger.error(f"Failed to update {ticker} ({row_id}): {e_patch}")

    logger.info(f"=== Backfill complete: {updated_count}/{len(rows)} reports updated. ===")


if __name__ == "__main__":
    main()
