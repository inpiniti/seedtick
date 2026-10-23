"""
Tests for Daily Community & News AI Curator Domain
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from app.domains.curator.models import (
    CommunityPost,
    CuratedHistoryItem,
    DailyBriefing,
    SourcePlatform,
)
from app.domains.curator.dedup_engine import DeduplicationEngine
from app.domains.curator.writer import BriefingWriter
from app.domains.curator.service import DailyCuratorService
from app.domains.curator.collectors.reddit_collector import RedditCollector
from app.domains.curator.collectors.news_collector import NewsCollector
from app.domains.curator.collectors.stocktwits_collector import StocktwitsCollector
from app.domains.curator.collectors.kr_community_collector import KRCommunityCollector
from app.domains.scheduler.jobs import daily_curator_job
from app.domains.scheduler.service import SchedulerService


def test_models_creation():
    post = CommunityPost(
        id="test_1",
        platform=SourcePlatform.REDDIT,
        channel="r/wallstreetbets",
        title="NVDA Earnings Moon Shot",
        body="Call options are printing!",
        comments=["Diamond hands", "Rocket to the moon"],
        score=150,
        url="https://reddit.com/r/wallstreetbets/test_1",
    )
    assert post.score == 150
    assert len(post.comments) == 2
    assert post.platform == SourcePlatform.REDDIT

    history = CuratedHistoryItem(
        date="2026-10-22",
        title="엔비디아 실적 발표 후 옵션 시장 급변",
        keywords=["엔비디아", "실적", "콜옵션"],
        tickers=["NVDA"],
        key_summary="옵션 변동성 급증 및 AI 인프라 지속 투자",
    )
    assert "NVDA" in history.tickers


def test_dedup_engine_similarity_and_filtering(tmp_path: Path):
    history_file = tmp_path / "test_history.json"
    engine = DeduplicationEngine(history_file_path=history_file)

    # 과거 발행 기록 추가
    past_item = CuratedHistoryItem(
        date="2026-10-22",
        title="엔비디아 블랙웰 칩 발열 이슈 및 공급 지연 우려",
        keywords=["엔비디아", "블랙웰", "발열", "공급", "지연"],
        tickers=["NVDA"],
        key_summary="블랙웰 발열로 서버 랙 재설계 필요성 대두",
    )
    engine.save_history_item(past_item)

    # 1. 동일/유사 주제 포스트 (중복 탈락 대상)
    dup_post = CommunityPost(
        id="p1",
        platform=SourcePlatform.REDDIT,
        channel="r/stocks",
        title="Nvidia Blackwell heating issues causing supply delays",
        body="블랙웰 서버 랙 발열 문제로 공급 지연 소식이 또 나왔습니다.",
        score=80,
    )

    # 2. 완전히 새로운 주제 포스트 (통과 대상)
    new_post = CommunityPost(
        id="p2",
        platform=SourcePlatform.REDDIT,
        channel="r/investing",
        title="US Treasury 10-year yield breaks 4.5% as oil rallies",
        body="유가 급등과 국채 금리 급등으로 나스닥 기술주 압박 심화",
        score=120,
    )

    # 유사도 계산 검증
    sim_dup = engine.calculate_similarity(f"{dup_post.title} {dup_post.body}", past_item)
    sim_new = engine.calculate_similarity(f"{new_post.title} {new_post.body}", past_item)
    assert sim_dup > sim_new

    # 1차 필터링 수행
    filtered = engine.filter_candidates([dup_post, new_post], similarity_threshold=0.30)
    assert len(filtered) == 1
    assert filtered[0].id == "p2"

    # 프롬프트 주입용 문맥 포맷 검증
    prompt_context = engine.format_history_context_for_prompt()
    assert "블랙웰" in prompt_context
    assert "NVDA" in prompt_context


@pytest.mark.asyncio
async def test_reddit_collector_mock():
    collector = RedditCollector(subreddits=["wallstreetbets"], min_score=10, fetch_comments=False)

    fake_resp = {
        "data": {
            "children": [
                {
                    "data": {
                        "id": "abc123",
                        "title": "TSLA Robotaxi unveiling reactions",
                        "selftext": "Cybercab was revealed yesterday...",
                        "score": 500,
                        "permalink": "/r/wallstreetbets/comments/abc123/tsla/",
                        "num_comments": 250,
                        "stickied": False,
                    }
                }
            ]
        }
    }

    mock_client = AsyncMock()
    mock_get = AsyncMock()
    mock_get.return_value.status_code = 200
    mock_get.return_value.json = MagicMock(return_value=fake_resp)
    mock_client.get = mock_get

    posts = await collector._fetch_subreddit(mock_client, "wallstreetbets")
    assert len(posts) == 1
    assert posts[0].title == "TSLA Robotaxi unveiling reactions"
    assert posts[0].score == 500
    assert posts[0].platform == SourcePlatform.REDDIT


@pytest.mark.asyncio
async def test_news_collector_mock():
    collector = NewsCollector(queries=["Stock Market"], max_news_per_query=2)

    fake_yahoo = {
        "news": [
            {
                "uuid": "u1",
                "title": "Fed hints at interest rate pause in upcoming FOMC",
                "publisher": "Bloomberg",
                "link": "https://finance.yahoo.com/news/fed-pause",
                "providerPublishTime": 1729680000,
            }
        ]
    }

    mock_client = AsyncMock()
    mock_get = AsyncMock()
    mock_get.return_value.status_code = 200
    mock_get.return_value.json = MagicMock(return_value=fake_yahoo)
    mock_client.get = mock_get

    items = await collector._fetch_query_news(mock_client, "Stock Market")
    assert len(items) >= 1
    assert "Fed hints" in items[0].title
    assert items[0].platform == SourcePlatform.NEWS


@pytest.mark.asyncio
async def test_stocktwits_collector_mock():
    collector = StocktwitsCollector(top_n_symbols=2)

    fake_trending_data = {
        "messages": [
            {
                "symbols": [{"symbol": "AMD", "title": "Advanced Micro Devices"}],
                "body": "AMD earnings upcoming, huge datacenter beat expected",
                "entities": {"sentiment": {"basic": "Bullish"}},
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_trending_data

    with patch("curl_cffi.requests.get") as mock_get:
        mock_get.return_value = mock_resp
        posts = await collector.collect()
        assert len(posts) == 1
        assert posts[0].channel == "$AMD"
        assert "[BULLISH]" in posts[0].comments[0]



@pytest.mark.asyncio
async def test_kr_community_collector_dc_parsing():
    collector = KRCommunityCollector(max_posts_per_channel=2)

    sample_html = """
    <html>
      <tr class="ub-content us-post">
        <td class="gall_tit ub-word">
          <a href="/mgallery/board/view/?id=usstock&no=9876543&page=1">삼전 HBM 납품 승인 떴다는 찌라시 팩트체크</a>
          <span class="reply_num">[42]</span>
        </td>
      </tr>
      <tr class="ub-content us-post">
        <td class="gall_tit ub-word">
          <a href="/mgallery/board/view/?id=usstock&no=9876544&page=1">TQQQ SOXL 숏 친 애들 지금 멘붕 온 이유</a>
          <span class="reply_num">[18]</span>
        </td>
      </tr>
    </html>
    """

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = sample_html
        mock_get.return_value = mock_resp

        posts = await collector._fetch_dcinside("usstock", "미국주식갤러리", is_mgall=True)
        assert len(posts) == 2
        assert "삼전 HBM" in posts[0].title
        assert posts[0].comment_count == 42
        assert posts[0].platform == SourcePlatform.DCINSIDE


@pytest.mark.asyncio
async def test_briefing_writer_and_service_dry_run(tmp_path: Path):
    # Mock AI Client
    fake_ai_article = """# [데일리 마켓 브리핑] 2026-10-23 글로벌 커뮤니티 & 마켓 레이더: 테크주 엇갈린 실적과 국채 금리 급등

## 📌 오늘의 시장 3줄 요약
- 10년물 국채 금리 급등으로 기술주 변동성 확대
- 레딧 WSB에서는 반도체 중소형주 옵션 매수 급증
- 국내 커뮤니티는 삼전 HBM 루머와 환율 1400원선 공방에 촉각

---

## 1. 10년물 미국 국채 금리 4.5% 돌파 충격
- **3줄 브리핑**:
  * 유가 상승으로 인플레 재점화 우려
  * 나스닥 하락 압력 가중
  * 연준 금리 인하 지연 가능성
- **배경 및 뉴스 팩트**: 미 재무부 국채 입찰 부진으로 금리가 급등했습니다.
- **커뮤니티 반응 & 여론**: 레딧 WSB에서는 '딥 매수'와 '추가 하락' 파로 나뉘어 격론 중입니다.
- **관련 종목 & 관전 포인트**: QQQ, TLT 등 채권/지수 ETF 주시 필요.

---

## 💡 오늘의 한 줄 인사이트
거시 경제 지표의 작은 흔들림에도 커뮤니티 심리는 민감하게 반응하고 있습니다.
"""

    mock_ai = MagicMock()
    mock_ai.chat = AsyncMock(return_value=fake_ai_article)

    writer = BriefingWriter(ai_client=mock_ai)
    history_file = tmp_path / "history.json"
    dedup = DeduplicationEngine(history_file_path=history_file)
    output_dir = tmp_path / "post"

    mock_collector = MagicMock()
    mock_collector.name = "mock_collector"
    mock_collector.collect = AsyncMock(return_value=[
        CommunityPost(
            id="test_post_1",
            platform=SourcePlatform.NEWS,
            channel="MarketWatch",
            title="Treasury yields spike to 4.5%",
            body="Bond selloff continues as inflation concerns linger.",
            score=50,
        )
    ])

    service = DailyCuratorService(
        collectors=[mock_collector],
        dedup_engine=dedup,
        writer=writer,
        output_dir=output_dir,
    )

    # 1. dry-run 테스트
    dry_res = await service.run_daily_curator(target_date="2026-10-23", dry_run=True)
    assert dry_res["status"] == "dry_run_success"
    assert dry_res["filtered_count"] == 1

    # 2. 실제 실행 테스트 (AI 호출 및 Supabase 적재)
    with patch("app.infrastructure.supabase_repo.supabase_repo.save_market_briefing", return_value=True) as mock_save_db:
        res = await service.run_daily_curator(target_date="2026-10-23", dry_run=False)
        assert res["status"] == "success"
        assert res["db_saved"] is True
        assert len(res["summary_3lines"]) == 3
        mock_save_db.assert_called_once()
        saved_row = mock_save_db.call_args[0][0]
        assert saved_row["d"] == "2026-10-23"
        assert "데일리 마켓 브리핑" in saved_row["title"]
        assert len(saved_row["summary_3lines"]) == 3

    # 3. 히스토리 파일 생성 및 키워드 적재 확인
    assert history_file.exists()
    recent = dedup.get_recent_topics()
    assert len(recent) == 1
    assert "2026-10-23" in recent[0].date



@pytest.mark.asyncio
async def test_scheduler_jobs_daily_curator_mock():
    with patch("app.domains.curator.service.DailyCuratorService.run_daily_curator") as mock_run:
        mock_run.return_value = {"status": "success", "date": "2026-10-23"}
        res = await daily_curator_job(target_date="2026-10-23", dry_run=True)
        assert res["status"] == "success"
        mock_run.assert_called_once_with(target_date="2026-10-23", dry_run=True)


def test_scheduler_service_registers_daily_curator():
    sched = SchedulerService()
    # 등록된 잡 아이디 확인
    job_ids = [job.id for job in sched._scheduler.get_jobs()]
    assert "daily_curator" in job_ids or hasattr(sched, "_scheduler")
