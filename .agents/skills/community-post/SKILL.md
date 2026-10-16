---
name: community-post
description: Supabase guru_reports를 요약해 커뮤니티 유입용 글을 root/post/에 txt로 생성한다. "모든 종목 분석 부탁해", "커뮤니티 글 써줘", "post 폴더에 글 작성" 이라고 하면 이 스킬을 사용한다. 이미 post/에 티커 파일이 있으면 건너뛰고 없는 종목만 생성한다.
---

# Community Post (리포리스트 커뮤니티 글 생성)

Supabase `guru_reports` + `guru_opinions` + `report_metrics`를 읽어 티커별 커뮤니티 요약글을 `post/{TICKER}.txt`로 쓴다. 마크다운이 아닌 plain txt다.

## 원칙

1. 지어내지 않는다. verdict / vote_summary / fair_value / bull·bear / metrics는 DB 값만 사용한다.
2. `post/`에 티커가 이미 있으면 건너뛴다 (파일명에 티커 포함 여부로 판단, 예: `TSM.txt`, `2026-10-16_TSM.txt` 모두 TSM으로 간주).
3. 키를 출력·커밋하지 않는다. `reportist-analyzer/.env.local`에서만 읽는다.
4. 글 끝에는 접속 유도 CTA + 투자 권유 아님 면책을 항상 넣는다.

## 실행

```bash
# 최신 일자 기준, 없는 종목 전부 생성 (기본 동작)
python .agents/skills/community-post/scripts/generate_posts.py

# 특정 일자 / 일부 티커만 / 덮어쓰기
python .agents/skills/community-post/scripts/generate_posts.py --date 2026-10-16
python .agents/skills/community-post/scripts/generate_posts.py --tickers TSM,PDD
python .agents/skills/community-post/scripts/generate_posts.py --force --limit 5
```

스크립트가 Supabase 조회 → `post/` 스킵 판정 → txt 렌더 → 저장을 전부 수행한다.
자세한 txt 구조는 [references/template.txt](references/template.txt)를 따른다.

## 완료 보고

- 대상 일자(d), 전체 건수, 신규 생성 / 스킵 건수 + 티커 목록을 보고한다.
- 생성된 파일 경로(`post/XXX.txt`)를 나열한다.
- 글 내용은 미리보여주지 않고 파일로만 전달한다 (사용자가 요청하면 1건만 요약 표시).
