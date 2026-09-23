"""
SeedTick Analyzer 간편 CLI 실행 스크립트

사용법:
  # 1. 특정 종목 13인 거장 심층 분석 & Supabase DB 저장
  python run.py analyze NVDA
  python run.py analyze AAPL

  # 2. 특정 종목 공용 데이터팩만 즉시 생성
  python run.py datapack NVDA

  # 3. 토스 거장 공통 스크리너 실행
  python run.py screen

  # 4. 전체 일일 파이프라인 (스크리닝 -> 상위 5개 분석 -> 자동매매) 즉시 실행
  python run.py pipeline
  python run.py pipeline --force    # 주말/휴장일 무시하고 강제 실행
  python run.py pipeline --dry-run  # 실제 발주 없이 시뮬레이션

  # 5. FastAPI 웹 서버 구동 (Swagger UI)
  python run.py server
"""
import argparse
import asyncio
import logging
import sys

# Windows cp949 콘솔 이모지 인코딩 방어
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 기본 로깅 설정 (진행 상황 실시간 콘솔 출력)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


def cmd_analyze(args):
    """단일 종목 13인 거장 심층 분석 및 DB 저장"""
    ticker = args.ticker.upper().strip()
    print(f"\n🚀 [{ticker}] 13인의 거장 심층 분석을 시작합니다...")
    from app.domains.report.service import GuruReportService

    async def _run():
        service = GuruReportService()
        report = await service.generate_full_report(ticker)
        print("\n" + "=" * 60)
        print(f"✅ [{ticker}] 분석 완료!")
        print(f"• 종합 의견: {report.overall_verdict} (점수: {report.overall_score})")
        print(f"• 13인 표결: {report.vote_summary}")
        print(f"• 산출물 파일:")
        print(f"  - 데이터팩: docs/report/{report.date}/_data/{ticker}.md")
        print(f"  - 13인요약: docs/report/{report.date}/_data/{ticker}_요약.md")
        print(f"  - 원탁토론: docs/report/{report.date}/최종/{ticker}_토론.md")
        print(f"  - 최종보고: docs/report/{report.date}/최종/{ticker}_최종보고서.md")
        print("• Supabase DB: guru_reports 및 guru_votes 동기화 완료")
        print("=" * 60 + "\n")

    asyncio.run(_run())


def cmd_datapack(args):
    """단일 종목 공용 데이터팩 생성"""
    ticker = args.ticker.upper().strip()
    print(f"\n📊 [{ticker}] 공용 데이터팩 수집 및 마크다운 빌드 중...")
    from app.domains.report.datapack_builder import DataPackBuilder

    async def _run():
        builder = DataPackBuilder()
        dp = await builder.build(ticker)
        print("\n" + "=" * 60)
        print(f"✅ [{ticker}] 데이터팩 생성 완료: {dp.file_path}")
        print(f"• 현재가: ${dp.current_price:.2f}")
        print(f"• Trailing PER: {dp.valuation.trailing_pe}x")
        print(f"• ROE: {dp.balance_sheet.roe_pct}%")
        print("=" * 60 + "\n")

    asyncio.run(_run())


def cmd_screen(args):
    """토스 공통 스크리너 실행"""
    print(f"\n🔍 토스 13인 거장 '공통' 스크리너 조회 중 (미국 주식)...")
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.models import ScreenCriteria

    async def _run():
        service = ScreenerService()
        result = await service.get_stock_list(ScreenCriteria(size=args.size))
        print("\n" + "=" * 60)
        print(f"✅ 스크리닝 완료! (총 {result.count}개 종목 통과)")
        print("-" * 60)
        print(f"{'티커':<8} {'종목명':<16} {'현재가':<10} {'ROE':<8} {'부채비율':<8}")
        print("-" * 60)
        for s in result.tickers:
            p = f"${s.price:.2f}" if s.price else "-"
            roe = f"{s.roe * 100:.1f}%" if s.roe else "-"
            debt = f"{s.debt_ratio * 100:.1f}%" if s.debt_ratio else "-"
            name = s.name[:14]
            print(f"{s.ticker:<8} {name:<16} {p:<10} {roe:<8} {debt:<8}")
        print("=" * 60 + "\n")

    asyncio.run(_run())


def cmd_pipeline(args):
    """전체 일일 파이프라인 실행"""
    print(f"\n⚙️ 일일 배치 파이프라인 실행 (force={args.force}, dry_run={args.dry_run})...")
    from app.domains.scheduler.jobs import daily_pipeline_job

    async def _run():
        res = await daily_pipeline_job(
            dry_run=args.dry_run,
            force=args.force,
            max_analyze_count=args.count,
        )
        print("\n" + "=" * 60)
        print(f"파이프라인 결과: {res}")
        print("=" * 60 + "\n")

    asyncio.run(_run())


def cmd_server(args):
    """FastAPI 웹 서버 구동"""
    import uvicorn
    print(f"\n🌐 FastAPI 웹 서버를 시작합니다: http://localhost:{args.port}")
    print(f"📖 Swagger 문서 확인: http://localhost:{args.port}/docs\n")
    uvicorn.run("app.main:app", host="0.0.0.0", port=args.port, reload=True)


def main():
    parser = argparse.ArgumentParser(description="SeedTick Analyzer CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # analyze
    p_analyze = subparsers.add_parser("analyze", help="특정 종목 13인 심층 분석 및 DB 저장")
    p_analyze.add_argument("ticker", help="티커 심볼 (예: NVDA, AAPL)")
    p_analyze.set_defaults(func=cmd_analyze)

    # datapack
    p_datapack = subparsers.add_parser("datapack", help="특정 종목 데이터팩 생성")
    p_datapack.add_argument("ticker", help="티커 심볼 (예: NVDA, AAPL)")
    p_datapack.set_defaults(func=cmd_datapack)

    # screen
    p_screen = subparsers.add_parser("screen", help="토스 거장 공통 스크리너 실행")
    p_screen.add_argument("--size", type=int, default=200, help="최대 종목 수")
    p_screen.set_defaults(func=cmd_screen)

    # pipeline
    p_pipe = subparsers.add_parser("pipeline", help="일일 배치 파이프라인 실행")
    p_pipe.add_argument("--force", action="store_true", help="휴장일 무시하고 강제 실행")
    p_pipe.add_argument("--dry-run", action="store_true", help="가상 매매 모드")
    p_pipe.add_argument("--count", type=int, default=5, help="분석 대상 상위 종목 수")
    p_pipe.set_defaults(func=cmd_pipeline)

    # server
    p_server = subparsers.add_parser("server", help="FastAPI 웹 서버 실행")
    p_server.add_argument("--port", type=int, default=8000, help="포트 번호")
    p_server.set_defaults(func=cmd_server)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
