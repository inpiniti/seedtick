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

## 갤러리 이미지 (준비 완료)

`docs/launch/assets/`에 1270×760 PNG 6장이 있습니다. 모두 `https://penguincut.com/studio`에서 실제 클립 3개(55.8초)를 올리고 AI 분석을 돌린 **한 세션**을 캡처했습니다. 합성·리터치 없이 화면 그대로입니다.

| 순서 | 파일 | 캡션 | 보여주는 것 |
| --- | --- | --- | --- |
| 1 | `ph-01-editor.png` | `AI picks the moments. You keep control.` | 16:9 미리보기 + AI 컷 3개 + 타임라인 + 음악 |
| 2 | `ph-02-ai-analysis.png` | `It watches the footage, then proposes the cuts.` | 3개 클립 분석 진행 56% |
| 3 | `ph-03-bridges.png` | `Transitions only where the scene changes.` | 날짜·장소 브릿지 프리셋 |
| 4 | `ph-04-music.png` | `Built-in music, or bring your own track.` | Dreaming.mp3 30%, 오디오 레인 |
| 5 | `ph-05-export.png` | `55.8s in. 16.4s out. Rendered on your device.` | 71% shorter, 1080p·SRT 저장 |
| 6 | `ph-06-date-bridge.png` | `The date bridge itself.` | 2022.11.08 → 2020.05.06 플립 클락 |

- **1~3번이 승부처입니다.** 4~6번은 여유가 있을 때 올려도 됩니다.
- 6번은 선택 사항입니다. 5장만 써도 구성이 완결됩니다.
- 썸네일(240×240): `ph-thumbnail-240.png`
- 검토용 갤러리: [`gallery.html`](./gallery.html) — ←/→ 키로 이미지 이동, 1~6번 바로 보기

캡션은 PH 이미지 설명란에 그대로 붙여넣습니다. 이미지 자체에는 문구를 합성하지 않았습니다.

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
