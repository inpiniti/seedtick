"""커뮤니티 유입용 txt 생성: Supabase guru_reports -> post/{TICKER}.txt.

- post/에 티커 파일이 이미 있으면 스킵 (파일명에 티커 포함 시 스킵)
- 출력은 plain txt (마크다운 금지), CTA + 면책 포함
- 키는 reportist-analyzer/.env.local에서만 읽고 절대 출력하지 않음

사용:
  python .agents/skills/community-post/scripts/generate_posts.py [--date YYYY-MM-DD] [--tickers TSM,PDD] [--limit N] [--force]
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# .agents/skills/community-post/scripts -> repo root (4 levels up)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
POST_DIR = os.path.join(REPO_ROOT, "post")
ENV_PATH = os.path.join(REPO_ROOT, "reportist-analyzer", ".env.local")


def load_env(path: str) -> dict:
    env: dict = {}
    with io.open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def sb_request(base: str, key: str, table: str, params: dict):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{base}/rest/v1/{table}?{qs}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def existing_tickers(post_dir: str) -> set[str]:
    found: set[str] = set()
    if not os.path.isdir(post_dir):
        return found
    for fn in os.listdir(post_dir):
        if not fn.lower().endswith(".txt"):
            continue
        stem = fn[:-4].upper()
        # 날짜 prefix 제거 (2026-10-16_TSM -> TSM)
        stem = re.sub(r"^\d{4}-\d{2}-\d{2}_", "", stem)
        found.add(stem)
    return found


def fmt_money(v) -> str:
    if v is None:
        return "-"
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v)


def fmt_pct(v) -> str:
    if v is None:
        return "-"
    try:
        f = float(v)
        sign = "+" if f > 0 else ""
        return f"{sign}{f:.1f}%"
    except (TypeError, ValueError):
        return str(v)


def pick_quote(opinions: list[dict], verdicts: tuple[str, ...]):
    for o in opinions:
        if o.get("verdict") in verdicts and o.get("quote"):
            return o
    for o in opinions:
        if o.get("quote"):
            return o
    return None


def render_txt(report: dict, opinions: list[dict], metrics: dict | None) -> str:
    ticker = report.get("ticker", "")
    company = (report.get("company_name") or ticker).strip()
    verdict = report.get("verdict") or "관망"
    vote_summary = report.get("vote_summary") or "-"
    cur = report.get("current_price")
    fair = report.get("fair_value")
    band_low = report.get("band_low")
    band_high = report.get("band_high")
    upside = report.get("upside_pct")
    avg_conf = report.get("avg_confidence")
    date = report.get("d") or ""

    bulls = report.get("bull_points") or []
    bears = report.get("bear_points") or []
    drivers = report.get("key_drivers") or []

    m = metrics or {}
    fwd_per = m.get("fwd_per")
    peg = m.get("peg")
    roe = m.get("roe_pct")

    try:
        upside_f = float(upside) if upside is not None else None
    except (TypeError, ValueError):
        upside_f = None
    if upside_f is not None:
        upside_label = f"+{upside_f:.1f}%" if upside_f > 0 else f"{upside_f:.1f}%"
    else:
        upside_label = "-"

    hook = "왜 엇갈렸을까" if verdict in ("관망", "보유") else ("왜 샀을까" if verdict == "매수" else "왜 팔자일까")

    bull_q = pick_quote(opinions, ("매수", "보유"))
    # bear 쿼트는 매도/관망 우선
    bear_q = pick_quote(opinions, ("매도", "관망"))

    def persona_short(p: str) -> str:
        return (p or "").replace("-", " ").strip()

    company_line = f"{company}({ticker}) 오늘 리포트 나왔길래 요약해봄." if company != ticker else f"{ticker} 오늘 리포트 나왔길래 요약해봄."
    conclusion_sentence = (
        f"13명 표결 결과 종합 의견은 {verdict}였음. "
        f"적정가 중앙값은 ${fmt_money(fair)}, 지금 ${fmt_money(cur)} 대비 {upside_label} 정도 남는 자리로 계산됨."
    )

    closings = {
        "매수": "눌림 오면 분할 관점에서 보는 구간이라는 해석이 제일 와닿았음. 추격보다는 눌림 대기.",
        "보유": "새로 들어가기보다 들고 있는 물량 유지하면서 지표 확인하자는 의견이 다수였음.",
        "관망": "서두를 자리가 아니라 지표·가격 확인하고 봐도 된다는 의견이 다수였음.",
        "매도": "고평가·펀더멘털 훼손 지적이 강해서 손대기 전 한 번 더 확인하는 게 좋아 보임.",
    }

    lines: list[str] = []
    lines.append(f"제목 후보: {ticker} {verdict} 나왔음 - 13인 표결 {vote_summary}")
    lines.append(f"제목 후보: {ticker} ${fmt_money(cur)}, 적정 ${fmt_money(fair)} 대비 {upside_label}인데 {hook}")
    lines.append("")
    lines.append(company_line)
    lines.append("")
    lines.append("결론부터 말하면 " + conclusion_sentence)
    if band_low is not None and band_high is not None:
        lines.append(f"밴드는 ${fmt_money(band_low)}~${fmt_money(band_high)}, 표결은 {vote_summary}, 평균 확신도 {avg_conf}/10이었음.")
    else:
        lines.append(f"표결은 {vote_summary}, 평균 확신도 {avg_conf}/10이었음.")
    if report.get("safety_entry") is not None:
        lines.append(f"안전마진 참고 라인은 ${fmt_money(report.get('safety_entry'))} 이하로 제시됨.")
    lines.append("")
    lines.append("왜 이렇게 봤냐면,")
    lines.append("")
    lines.append("[긍정 포인트]")
    for b in bulls[:3]:
        lines.append(f"- {b}")
    if bull_q:
        lines.append(f"(대표 한마디: {persona_short(bull_q.get('persona'))} - \"{bull_q.get('quote')}\")")
    lines.append("")
    lines.append("[망설임·리스크 포인트]")
    for b in bears[:2]:
        lines.append(f"- {b}")
    if bear_q:
        lines.append(f"(대표 한마디: {persona_short(bear_q.get('persona'))} - \"{bear_q.get('quote')}\")")
    lines.append("")
    metric_bits = []
    if fwd_per is not None:
        try:
            metric_bits.append(f"Forward PER {float(fwd_per):.2f}")
        except (TypeError, ValueError):
            metric_bits.append(f"Forward PER {fwd_per}")
    if peg is not None:
        metric_bits.append(f"PEG {peg}")
    if roe is not None:
        try:
            metric_bits.append(f"ROE {float(roe):.1f}%")
        except (TypeError, ValueError):
            pass
    if metric_bits:
        lines.append("체크할 숫자는 " + ", ".join(metric_bits) + " 정도. 핵심 드라이버는 " + (" / ".join(drivers[:4]) if drivers else "-") + "임.")
    elif drivers:
        lines.append("핵심 드라이버는 " + " / ".join(drivers[:4]) + "임.")
    lines.append("")
    lines.append(closings.get(verdict, closings["관망"]))
    lines.append("")
    lines.append(f"13인 개별 코멘트 전문이랑 적정밴드 계산 과정까지 다 보고 싶으면 구글에서 리포리스트 검색해봐. {date} 분석 종목들도 같이 올라와 있음.")
    lines.append("")
    lines.append("이 글은 정보 요약용이고 투자 권유가 아님. 매매 판단은 본인 책임.")
    return "\n".join(lines) + "\n"


def latest_date(base: str, key: str) -> str:
    rows = sb_request(base, key, "guru_reports", {"select": "d", "order": "d.desc", "limit": "1"})
    if not rows:
        raise RuntimeError("guru_reports가 비어 있음")
    return rows[0]["d"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=None, help="분석 일자 YYYY-MM-DD (기본: 최신)")
    ap.add_argument("--tickers", default=None, help="콤마 구분 티커 subset (기본: 전체)")
    ap.add_argument("--limit", type=int, default=0, help="최대 생성 건수 (0=제한 없음)")
    ap.add_argument("--force", action="store_true", help="post/에 있어도 덮어쓰기")
    args = ap.parse_args()

    if not os.path.isfile(ENV_PATH):
        print(f"ENV 파일 없음: {ENV_PATH}", file=sys.stderr)
        return 1
    env = load_env(ENV_PATH)
    base = env.get("SUPABASE_URL", "")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("SUPABASE_URL/KEY가 .env.local에 없음", file=sys.stderr)
        return 1

    target_date = args.date or latest_date(base, key)
    os.makedirs(POST_DIR, exist_ok=True)
    done = existing_tickers(POST_DIR)

    reports = sb_request(
        base, key, "guru_reports",
        {"d": f"eq.{target_date}", "select": "id,d,ticker,company_name,current_price,verdict,overall_score,vote_summary,fair_value,band_low,band_high,safety_entry,target_sell,upside_pct,avg_confidence,conclusion,hot_topics,bull_points,bear_points,key_drivers", "order": "ticker.asc", "limit": "500"},
    )
    if args.tickers:
        want = {t.strip().upper() for t in args.tickers.split(",") if t.strip()}
        reports = [r for r in reports if (r.get("ticker") or "").upper() in want]

    created: list[str] = []
    skipped: list[str] = []
    for r in reports:
        ticker = (r.get("ticker") or "").upper().strip()
        if not ticker:
            continue
        if ticker in done and not args.force:
            skipped.append(ticker)
            continue
        if args.limit and len(created) >= args.limit:
            skipped.append(ticker + "(limit)")
            continue
        report_id = r.get("id")
        opinions = sb_request(
            base, key, "guru_opinions",
            {"report_id": f"eq.{report_id}", "select": "persona,guru_idx,verdict,score,confidence,target_text,upside_pct,arguments,quote", "order": "guru_idx.asc"},
        )
        mets_rows = sb_request(base, key, "report_metrics", {"report_id": f"eq.{report_id}", "select": "*"})
        metrics = mets_rows[0] if mets_rows else None
        txt = render_txt(r, opinions, metrics)
        # 파일명 안전화 (BRK.A 허용, 경로문자만 제거)
        safe = re.sub(r"[\\/:*?\"<>|]", "_", ticker)
        out_path = os.path.join(POST_DIR, f"{safe}.txt")
        with io.open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(txt)
        created.append(ticker)
        done.add(ticker)

    print(f"date={target_date} total={len(reports)} created={len(created)} skipped={len(skipped)}")
    if created:
        print("created: " + ", ".join(created))
    if skipped:
        print("skipped: " + ", ".join(skipped))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
