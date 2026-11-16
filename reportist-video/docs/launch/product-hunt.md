# Product Hunt 런치

대상: producthunt.com
형식: 메이커 계정으로 제품 등록 → 런치 날짜 예약
성격: 영어권 단발 트래픽. 런치 당일 상위권에 들면 수백~수천 방문이 몰리지만, **다음 날이면 끝**입니다. 그래서 서버·링크가 안정된 뒤 마지막에 하는 게 맞습니다.

## 제품 정보

**Name**

```
PenguinCut
```

**Tagline (60자 제한)**

```
Turn hours of footage into one cinematic highlight
```

대안:
- `AI highlight editor that runs in your browser` (48)
- `Long videos in. One cinematic 16:9 highlight out.` (51)

**Description (260자 제한)**

```
PenguinCut finds the strongest moments in long footage and cuts them into one cinematic 16:9 highlight, with captions, music, and intro/outro. Analysis and rendering run in your browser, so originals stay on your device. Free AI models included. 7 languages.
```

**Topics** (3개 선택)

- Video
- Artificial Intelligence
- Content Creation

**Pricing**

```
Free
```

**Link**

```
https://penguincut.com
```

## 첫 댓글 (메이커 코멘트)

Product Hunt에서 가장 중요한 글입니다. 제품 설명이 아니라 **왜 만들었는지**를 씁니다.

```
Hi Product Hunt 👋

I built PenguinCut because I had 40 minutes of travel footage I never touched. Opening an editor meant an hour of scrubbing before I made a single cut, so I didn't.

So I flipped it: the AI picks the candidates, and I only review and adjust.

How it works:
1. Frames are sampled in your browser — the original file never leaves your device.
2. A vision model scores those frames and returns candidate moments as JSON.
3. Candidates are filtered (min 1s, no overlaps) into a cut list.
4. You review, trim, reorder.
5. Canvas + MediaRecorder + Web Audio render the final 16:9 film in the browser — intro, date/place bridges, outro, music, captions.

Two things I deliberately kept: rendering in the browser (server cost doesn't scale with video length, which is how the free tier survives) and 16:9 only for now (vertical needs a different crop and caption layout).

It supports 7 languages, and the bundled AI models are free — you can also plug in your own API key.

I'd love to know: what would you actually use this for — travel, weddings, sports, or something else? And does a 16:9-only output block you?

Thanks for looking 🙏
```

## 갤러리 이미지 계획

Product Hunt는 이미지가 사실상 첫인상을 결정합니다. 1270×760(가로) 기준으로 4장을 권장합니다.

| 순서 | 내용 | 캡션 |
| --- | --- | --- |
| 1 | 완성된 하이라이트 재생 화면 (16:9 필름) | "One cinematic highlight, rendered in your browser" |
| 2 | AI가 고른 컷 목록 + 타임라인 | "AI picks the moments. You keep control." |
| 3 | 인트로·브릿지·아웃트로 편집 화면 | "Intro, date bridges, outro — included" |
| 4 | 원본 대비 절약률이 표시된 다운로드 화면 | "2h 14m → 58s" |

썸네일(240×240)은 `public/icon-512x512.png`를 리사이즈해 사용합니다.

**현재 상태: 제품 스크린샷 없음.** 스튜디오 화면 캡처가 선행되어야 합니다.

## 런치 당일 체크리스트

- [ ] 사이트 응답 확인 (`https://penguincut.com` 200, `/studio` 진입 가능)
- [ ] 예약 시각: **태평양 시간 자정(00:01 PT)**, 한국 시간 오후 5시 1분 (11월 기준 PST)
- [ ] 요일: 화·수·목 중 하루. 월요일과 금요일은 경쟁이 몰리거나 관심이 분산됨
- [ ] 런치 후 6~8시간은 댓글에 바로 답변 (응답 속도가 순위에 영향)
- [ ] 댓글에 링크를 반복해서 붙이지 않기 — 스팸으로 보임
- [ ] 지인에게 "업보트 부탁" 메시지를 돌리지 않기. PH는 탐지해서 순위를 내립니다
- [ ] X 계정(`@penguincut_ai`)과 유튜브 커뮤니티 탭에 런치 링크 게시

## 주의

- Product Hunt는 **한 제품당 사실상 한 번**이 승부입니다. 스크린샷과 첫 댓글이 준비되지 않았으면 예약하지 마세요.
- 영어 카피에 과장 표현(revolutionary, 10x, seamless)을 넣지 않습니다. PH 댓글에서 바로 지적받습니다.
- "Free"로 등록했는데 실제로 유료 모델이 기본이면 신뢰를 잃습니다. 현재는 기본 모델이 무료이므로 문제 없습니다.
- 런치 다음 날 바로 유료 전환을 공지하지 마세요. 최소 몇 주는 무료 정책을 유지하는 편이 좋습니다.
