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


def is_kr_ticker(ticker: str) -> bool:
    return bool(re.match(r"^\d{6}$", (ticker or "").strip()))


def fmt_price(v, is_kr: bool = False) -> str:
    if v is None:
        return "-"
    try:
        f = float(v)
        if is_kr:
            return f"{round(f):,}원"
        return f"${f:,.2f}"
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


CJK_MAP = {
    "盈利能力": "수익성",
    "结构性": "구조적",
    "经历的": "거친",
    "市场和": "시장과",
    "资金": "자금",
    "主体": "주체",
    "分成": "배분",
    "改善": "개선",
    "安全": "안전",
    "优秀": "우수",
    "優越": "우수",
    "海外": "해외",
    "资本": "자본",
    "資本": "자본",
    "损益": "손익",
    "关注": "주목",
    "警戒": "경계",
    "互动": "상호작용",
    "进度": "진행 상황",
    "减值": "감액",
    "估值": "가치평가",
    "兑现": "실현",
    "回忆": "",
    "影视剧": "억원",
    "四个": "",
    "景氣": "경기",
    "准时率": "정시 가동률",
    "指导": "가이던스",
    "大二": "",
    "偿": "상환",
    "감가상산": "감가상각",
}


def clean_text(text: str) -> str:
    if not text:
        return ""
    # 1. 한자 매핑 치환
    for k, v in CJK_MAP.items():
        text = text.replace(k, v)
    # 2. 잔여 한자(CJK) 제거
    text = re.sub(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", "", text)
    # 3. 아랍어/키릴어 등 비라틴 외래 문자 제거
    text = re.sub(r"[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0400-\u04ff]", "", text)
    # 4. 프롬프트 누출/오염 토큰 패턴 제거 (_DMA, Poul_UNIONAMENT_skewed 등)
    text = re.sub(r"\b[A-Za-z]+_[A-Za-z0-9_]+(?:\)[a-zA-Z_]*)?", "", text)
    text = re.sub(r"_[A-Za-z0-9_]+", "", text)
    # 5. 영어 재무 약어를 친절한 한국어로 순화
    text = re.sub(r'(\d{4})년?\s*[- ]?Q([1-4])', r'\1년 \2분기', text)
    text = re.sub(r'(?<![A-Za-z0-9])Q([1-4])(?![A-Za-z0-9])', r'\1분기', text)
    text = re.sub(r'(?<![A-Za-z0-9])QoQ(?![A-Za-z0-9])', '전 분기 대비', text)
    text = re.sub(r'(?<![A-Za-z0-9])YoY(?![A-Za-z0-9])', '전년 동기 대비', text)
    text = re.sub(r'(?<![A-Za-z0-9])FCF(?![A-Za-z0-9])', '잉여현금흐름(FCF)', text)
    text = re.sub(r'(?<![A-Za-z0-9])CapEx(?![A-Za-z0-9])', '설비투자(CapEx)', text)
    text = re.sub(r'(?<![A-Za-z0-9])ASP(?![A-Za-z0-9])', '평균판매단가(ASP)', text)
    # 6. 불필요한 공백 및 문장부호 정돈
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\s+([,\.?!])", r"\1", text)
    return text.strip()


def render_txt(report: dict, opinions: list[dict], metrics: dict | None) -> str:
    ticker = (report.get("ticker") or "").strip()
    is_kr = is_kr_ticker(ticker)
    company = (report.get("company_name") or ticker).strip()
    verdict = report.get("verdict") or "관망"
    cur = report.get("current_price")
    fair = report.get("fair_value")
    band_low = report.get("band_low")
    band_high = report.get("band_high")
    upside = report.get("upside_pct")
    date = report.get("d") or ""

    bulls = [clean_text(b) for b in (report.get("bull_points") or []) if clean_text(b)]
    bears = [clean_text(b) for b in (report.get("bear_points") or []) if clean_text(b)]
    drivers = [clean_text(d) for d in (report.get("key_drivers") or []) if clean_text(d)]

    m = metrics or {}
    fwd_per = m.get("fwd_per")
    per = m.get("per")
    peg = m.get("peg")
    pbr = m.get("pbr")
    roe = m.get("roe_pct")

    try:
        upside_f = float(upside) if upside is not None else None
    except (TypeError, ValueError):
        upside_f = None
    if upside_f is not None:
        upside_label = f"+{upside_f:.1f}%" if upside_f > 0 else f"{upside_f:.1f}%"
    else:
        upside_label = "-"

    name_display = f"{company}({ticker})" if company and company != ticker else ticker
    cur_str = fmt_price(cur, is_kr)
    fair_str = fmt_price(fair, is_kr)
    band_low_str = fmt_price(band_low, is_kr)
    band_high_str = fmt_price(band_high, is_kr)

    lines: list[str] = []
    lines.append(f"{name_display} 오늘 리포트")
    lines.append("")

    if fair is not None:
        lines.append(f"현재가 {cur_str} 대비 산출된 적정가는 {fair_str}(상승여력 {upside_label}) 수준임.")
    else:
        lines.append(f"현재가는 {cur_str} 수준임.")

    band_bits = []
    if band_low is not None and band_high is not None:
        band_bits.append(f"적정가 밴드는 {band_low_str}~{band_high_str}")
    if report.get("safety_entry") is not None:
        band_bits.append(f"안전마진을 고려한 진입 참고 라인은 {fmt_price(report.get('safety_entry'), is_kr)} 이하")
    if band_bits:
        lines.append("이며, ".join(band_bits) + "로 제시됨.")

    lines.append("")
    lines.append("왜 이렇게 봤냐면,")
    lines.append("")

    if bulls:
        lines.append("[긍정 포인트]")
        for b in bulls[:3]:
            lines.append(f"- {b}")
        lines.append("")

    if bears:
        lines.append("[망설임·리스크 포인트]")
        for b in bears[:2]:
            lines.append(f"- {b}")
        lines.append("")

    metric_bits = []
    if fwd_per is not None:
        try:
            metric_bits.append(f"예상 순이익 대비 주가(Forward PER) {float(fwd_per):.1f}배")
        except (TypeError, ValueError):
            metric_bits.append(f"예상 순이익 대비 주가(Forward PER) {fwd_per}배")
    elif per is not None:
        try:
            metric_bits.append(f"순이익 대비 주가(PER) {float(per):.1f}배")
        except (TypeError, ValueError):
            metric_bits.append(f"순이익 대비 주가(PER) {per}배")
    if pbr is not None:
        try:
            metric_bits.append(f"순자산 대비 주가(PBR) {float(pbr):.2f}배")
        except (TypeError, ValueError):
            metric_bits.append(f"순자산 대비 주가(PBR) {pbr}배")
    if roe is not None:
        try:
            metric_bits.append(f"자기자본이익률(ROE) {float(roe):.1f}%")
        except (TypeError, ValueError):
            pass
    if peg is not None:
        metric_bits.append(f"이익성장 대비 주가(PEG) {peg}")

    if metric_bits:
        lines.append("[주요 지표]")
        lines.append("체크할 숫자는 " + ", ".join(metric_bits) + " 수준임.")
        lines.append("")

    if drivers:
        lines.append("[앞으로 지켜볼 주요 포인트]")
        for d in drivers[:3]:
            lines.append(f"- {d}")
        lines.append("")

    closings = {
        "매수": "현재 가격대는 눌림목 분할 매수 관점에서 매력적인 구간으로 평가됨. 무리한 추격 매수보다는 분할 접근이 유리해 보임.",
        "보유": "신규 진입보다는 기존 보유 물량을 유지하면서 실적과 주요 지표를 확인하는 편이 좋아 보임.",
        "관망": "서두르기보다는 실적 및 가격 흐름을 조금 더 확인한 뒤 접근해도 늦지 않은 구간으로 평가됨.",
        "매도": "고평가 부담이나 펀더멘털 리스크가 지적되는 만큼, 신규 매수는 신중히 접근할 필요가 있어 보임.",
    }
    lines.append(closings.get(verdict, closings["관망"]))
    lines.append("")

    lines.append(f"적정가 밴드 계산 과정과 상세 분석 지표까지 다 보고 싶으면 구글에서 \"리포리스트\" (https://www.reportist.kr) 검색해봐. 전 종목 가치평가 랭킹(상승여력순)이랑 {date} 분석 종목들도 같이 볼 수 있음.")
    lines.append("")
    lines.append("이 글은 정보 요약용이고 투자 권유가 아님. 매매 판단은 본인 책임.")
    return "\n".join(lines) + "\n"


def latest_date(base: str, key: str, market: str = "all") -> str:
    rows = sb_request(base, key, "guru_reports", {"select": "d,ticker", "order": "d.desc", "limit": "500"})
    if not rows:
        raise RuntimeError("guru_reports가 비어 있음")
    for r in rows:
        t = (r.get("ticker") or "").strip()
        if market == "kr" and is_kr_ticker(t):
            return r["d"]
        elif market == "us" and not is_kr_ticker(t):
            return r["d"]
        elif market == "all":
            return r["d"]
    return rows[0]["d"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=None, help="분석 일자 YYYY-MM-DD (기본: 최신)")
    ap.add_argument("--market", choices=["all", "kr", "us"], default="all", help="시장 구분 (기본: all)")
    ap.add_argument("--kr", action="store_true", help="국내 주식만 생성 (--market kr 단축)")
    ap.add_argument("--tickers", default=None, help="콤마 구분 티커 subset (기본: 전체)")
    ap.add_argument("--limit", type=int, default=0, help="최대 생성 건수 (0=제한 없음)")
    ap.add_argument("--force", action="store_true", help="post/에 있어도 덮어쓰기")
    args = ap.parse_args()

    market = "kr" if args.kr else args.market

    if not os.path.isfile(ENV_PATH):
        print(f"ENV 파일 없음: {ENV_PATH}", file=sys.stderr)
        return 1
    env = load_env(ENV_PATH)
    base = env.get("SUPABASE_URL", "")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("SUPABASE_URL/KEY가 .env.local에 없음", file=sys.stderr)
        return 1

    target_date = args.date or latest_date(base, key, market=market)
    os.makedirs(POST_DIR, exist_ok=True)
    done = existing_tickers(POST_DIR)

    reports = sb_request(
        base, key, "guru_reports",
        {"d": f"eq.{target_date}", "select": "id,d,ticker,company_name,current_price,verdict,overall_score,vote_summary,fair_value,band_low,band_high,safety_entry,target_sell,upside_pct,avg_confidence,conclusion,hot_topics,bull_points,bear_points,key_drivers", "order": "ticker.asc", "limit": "500"},
    )
    if market == "kr":
        reports = [r for r in reports if is_kr_ticker(r.get("ticker", ""))]
    elif market == "us":
        reports = [r for r in reports if not is_kr_ticker(r.get("ticker", ""))]
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
