"""
영문 트윗 텍스트 포맷터
X(트위터) 280자 제한 및 t.co URL(23자) 규칙을 준수하여 가독성 높은 영문 분석 요약을 생성합니다.
"""
import re
from typing import Any

VERDICT_MAP = {
    "매수": "BUY",
    "보유": "HOLD",
    "관망": "WATCH",
    "매도": "SELL",
}


def clean_quote(quote: str, max_len: int = 55) -> str:
    """인용문 정제 및 길이 제한"""
    if not quote:
        return ""
    q = quote.strip().replace("\n", " ").replace('"', "").replace("'", "")
    # 이모지나 특수문자 정리
    q = re.sub(r"\s+", " ", q)
    if len(q) > max_len:
        return q[: max_len - 3].rstrip() + "..."
    return q


def format_stock_tweet(report: dict[str, Any]) -> str:
    """
    guru_reports 단일 행 데이터를 기반으로 고품질 영문 트윗 텍스트 생성
    """
    ticker = (report.get("ticker") or "").upper().strip()
    company_name = report.get("company_name_en") or report.get("company_name") or ticker

    raw_verdict = report.get("verdict") or report.get("overall_verdict") or ""
    verdict_en = VERDICT_MAP.get(raw_verdict, raw_verdict.upper() or "WATCH")

    votes_buy = report.get("votes_buy") or 0
    votes_watch = (report.get("votes_watch") or 0) + (report.get("votes_hold") or 0)
    votes_sell = report.get("votes_sell") or 0
    total_votes = votes_buy + votes_watch + votes_sell or 13

    fair_value = report.get("fair_value_price") or report.get("fair_value")
    current_price = report.get("current_price")
    upside_pct = report.get("upside_pct")

    # upside_pct 가 없고 fair_value & current_price 가 유효하면 직접 계산
    if upside_pct is None and fair_value and current_price and current_price > 0:
        upside_pct = ((float(fair_value) - float(current_price)) / float(current_price)) * 100

    # 13인 요약(summaries)에서 워런 버핏 또는 피터 린치 코멘트 추출
    guru_highlight = ""
    summaries = report.get("summaries") or []
    if isinstance(summaries, list):
        for s in summaries:
            persona = str(s.get("persona") or "")
            if "버핏" in persona or "Buffett" in persona:
                quote = clean_quote(s.get("quote") or "")
                p_verdict = VERDICT_MAP.get(s.get("verdict", ""), s.get("verdict", "BUY"))
                if quote:
                    guru_highlight = f'• Warren Buffett ({p_verdict}): "{quote}"'
                break
        if not guru_highlight:
            for s in summaries:
                persona = str(s.get("persona") or "")
                if "린치" in persona or "Lynch" in persona:
                    quote = clean_quote(s.get("quote") or "")
                    p_verdict = VERDICT_MAP.get(s.get("verdict", ""), s.get("verdict", "BUY"))
                    if quote:
                        guru_highlight = f'• Peter Lynch ({p_verdict}): "{quote}"'
                    break

    # 라인 조합
    lines = [
        f"${ticker} AI Valuation & 13-Guru Consensus 📊",
        "",
        f"Consensus: {verdict_en} (Buy {votes_buy} | Watch {votes_watch} | Sell {votes_sell})",
    ]

    if fair_value and float(fair_value) > 0:
        val_line = f"• Intrinsic Value: ${float(fair_value):.2f}"
        if upside_pct is not None:
            val_line += f" ({float(upside_pct):+.1f}% upside)"
        lines.append(val_line)

    if guru_highlight:
        lines.append(guru_highlight)

    lines.append("")
    lines.append("Full valuation & margin of safety bands:")
    lines.append(f"https://www.reportist.kr/en/stocks/{ticker}")
    lines.append(f"#{ticker} #Stocks #FinTwit #Investing")

    tweet_text = "\n".join(lines)

    # 280자 제한 안전 체크 (Twitter t.co URL은 23자로 계산)
    # URL 치환 후 길이 계산
    url_pattern = r"https?://\S+"
    text_without_urls = re.sub(url_pattern, "", tweet_text)
    effective_length = len(text_without_urls) + 23  # URL 1개당 23자

    if effective_length > 275 and guru_highlight:
        # 인용문 제거하여 길이 축소
        lines = [l for l in lines if not l.startswith("• Warren Buffett") and not l.startswith("• Peter Lynch")]
        tweet_text = "\n".join(lines)

    return tweet_text
