# PenguinCut SEO 운영 가이드

`penguincut.com` 검색 노출을 위한 준비 상태와, Google Search Console · Bing · 네이버 등록 절차를 정리한 문서입니다.
코드는 이미 준비되어 있고, **도메인 DNS 연결과 검색엔진 소유 확인만 사용자 계정에서 진행**하면 됩니다.

- 최종 갱신: 2026-11-13
- 대상 사이트: `https://penguincut.com`
- 관련 코드: `seo/content.mjs`, `seo/template.mjs`, `scripts/generate-seo-pages.mjs`
- 페이지 생성: `npm run seo` (개발/빌드 시 자동 실행)

---

## 1. 현재 구현된 SEO 구성

| 항목 | 상태 | 위치 |
| --- | --- | --- |
| 크롤러가 읽을 수 있는 정적 랜딩 페이지 | 완료 | `/`, `/ko/`, `/ja/`, `/zh/`, `/es/`, `/fr/`, `/de/` |
| 앱 페이지 noindex 처리 | 완료 | `/studio` → `<meta name="robots" content="noindex, follow">` |
| 언어별 canonical | 완료 | 각 페이지 `<link rel="canonical">` |
| hreflang (7개 언어 + x-default) | 완료 | 각 페이지 `<head>` |
| 다국어 sitemap | 완료 | `https://penguincut.com/sitemap.xml` (index → `/sitemap-pages.xml`) |
| robots.txt | 완료 | `/robots.txt` (API 경로 차단, sitemap 명시) |
| 구조화 데이터 | 완료 | Organization, WebSite, WebPage, SoftwareApplication, FAQPage |
| Open Graph / Twitter Card | 완료 | `og-penguincut.png` (1200×630) |
| 모바일 반응형 | 완료 | 390px부터 검증 |
| 구 링크 보존 | 완료 | `/#projects`, `/#studio`, `/#community` → `/studio#...` |
| www → 루트 301 | 배포 설정 필요 | `vercel.json` |
| Search Console 소유 확인 | **사용자 작업 필요** | 아래 3장 |
| sitemap 제출 | **사용자 작업 필요** | 아래 3장 |

### 색인 대상 URL

검색에 노출할 페이지는 아래 7개뿐입니다. `/studio`는 의도적으로 제외합니다.

```
https://penguincut.com/
https://penguincut.com/ko/
https://penguincut.com/ja/
https://penguincut.com/zh/
https://penguincut.com/es/
https://penguincut.com/fr/
https://penguincut.com/de/
```

---

## 2. 배포 전제 조건

Search Console 등록 전에 아래가 먼저 되어 있어야 합니다.

1. **Vercel에 `penguincut.com` 도메인 연결**
   - Vercel 프로젝트 → Settings → Domains → `penguincut.com` 추가
   - `www.penguincut.com`도 추가하고 **`penguincut.com`으로 Redirect** 설정
2. **DNS 설정** (도메인 등록업체에서)
   - 루트 도메인: Vercel이 안내하는 A 레코드 (`76.76.21.21`) 또는 Vercel 네임서버
   - `www`: CNAME → `cname.vercel-dns.com`
   - DNS 전파는 보통 10분~48시간
3. **HTTPS 인증서 발급 완료** (Vercel 자동)
4. 아래 명령으로 200 응답과 리다이렉트 확인

```bash
curl -I https://penguincut.com/
curl -I https://penguincut.com/ko/
curl -I https://penguincut.com/sitemap.xml
curl -I https://www.penguincut.com/        # 301 → https://penguincut.com/
curl -I https://penguincut.com/studio      # 200, X-Robots-Tag 또는 meta noindex
```

> `www`가 아직 응답하지 않는다면 DNS 연결이 끝나지 않은 상태입니다. Search Console 등록은 루트 도메인이 열린 뒤 진행하세요.

---

## 3. Google Search Console 등록

### 3-1. 속성 추가 — 도메인 속성 권장

1. [Google Search Console](https://search.google.com/search-console) 접속 (사이트 소유자 Google 계정)
2. 좌측 상단 **속성 선택** → **속성 추가**
3. **도메인** 선택 → `penguincut.com` 입력 → **계속**
4. 안내되는 **DNS TXT 레코드**를 복사
5. 도메인 DNS 관리 화면에서 TXT 레코드 추가
   - 이름/호스트: `@` (또는 빈 값)
   - 값: `google-site-verification=...` 전체 문자열
   - TTL: 기본값
6. DNS 전파 후 Search Console에서 **확인** 클릭

도메인 속성은 `http`, `https`, `www`, 서브도메인까지 한 번에 관리하므로 URL 접두어 속성보다 편합니다.

### 3-2. 대안 — URL 접두어 속성

DNS를 직접 수정할 수 없을 때 사용합니다.

- **HTML 파일 방식**: `https://penguincut.com/google00cc3ed18672ae2e.html` 파일이 이미 `public/`에 있습니다.
  단, 이 파일은 **penguincut.com 속성에서 발급받은 파일이어야** 유효합니다. 이전 도메인에서 받은 파일이라면 새로 다운로드해 `reportist-video/public/`에 넣고 재배포하세요.
- **HTML 태그 방식**: Search Console이 주는 `<meta name="google-site-verification" content="...">`의 **content 값만** 복사해 `seo/content.mjs`의 `SITE.verification.google`에 넣고 `npm run seo` → 재배포 → 확인.

```js
// seo/content.mjs
verification: {
  google: "여기에_GSC_메타_토큰",
  naver: "",
},
```

> ⚠️ 예전에 넣어둔 `content="google00cc3ed18672ae2e"` 값은 HTML 파일 이름일 뿐 메타 태그 토큰이 아니어서 제거했습니다. 실제 토큰을 발급받아 넣어야 합니다.

### 3-3. sitemap 제출

1. Search Console → **색인 생성 → Sitemaps**
2. `sitemap.xml` 입력 → **제출**
3. 상태가 **성공**으로 바뀌는지 확인 (보통 수시간~2일)

```
https://penguincut.com/sitemap.xml
```

### 3-4. 주요 URL 색인 요청

1. 상단 **URL 검사**에 `https://penguincut.com/` 입력 → **색인 생성 요청**
2. 같은 방법으로 `/ko/`, `/ja/`, `/zh/`, `/es/`, `/fr/`, `/de/` 요청
3. 하루 요청 수 제한이 있으므로 2~3일에 나눠서 진행해도 됩니다.

### 3-5. 등록 후 확인 주기

- **3일 후**: 속성 확인, sitemap 상태, URL 검사 결과
- **1~2주 후**: 페이지 색인 생성 수, hreflang 오류, Core Web Vitals
- **4주 후**: 검색 실적(노출수·클릭수·평균 순위) 확인

---

## 4. Bing Webmaster Tools

1. [Bing Webmaster Tools](https://www.bing.com/webmasters) 접속
2. **Import from Google Search Console** 선택 → `penguincut.com` 속성 가져오기
3. 자동으로 sitemap이 등록되지 않으면 **Sitemaps** → `https://penguincut.com/sitemap.xml` 제출
4. **URL Submission**에서 상위 7개 URL 제출

Bing은 `IndexNow`도 지원합니다. 나중에 자동화하려면 배포 후 변경 URL을 IndexNow API로 전송하면 됩니다.

---

## 5. 네이버 서치어드바이저

1. [네이버 서치어드바이저](https://searchadvisor.naver.com) → **웹마스터 도구** → **사이트 등록**
2. 사이트 주소에 `https://penguincut.com` 입력
3. 소유 확인 방법 선택
   - **HTML 파일**: `public/`에 있는 `naverc564c14551f41fa5c23e164e5a6b5202.html` 사용 (단, penguincut.com 등록 시 발급된 파일이어야 함)
   - **메타 태그**: 새 토큰을 `seo/content.mjs`의 `SITE.verification.naver`에 넣고 `npm run seo` → 재배포
4. 확인 완료 후 **요청 → 사이트맵 제출** → `https://penguincut.com/sitemap.xml`
5. **요청 → 웹페이지 수집**에서 상위 URL 수집 요청

> 네이버는 한국어 페이지(`/ko/`) 비중이 높습니다. 한국 타깃 키워드는 `ko` 페이지 문구를 기준으로 관리하세요.

---

## 6. 색인 정책과 주의사항

- **랜딩 페이지만 색인**: `/studio`는 `noindex, follow`. 앱 화면이 검색 결과에 섞이지 않게 유지합니다.
- **자동 언어 리다이렉트 금지**: 사용자가 주소를 바꿔 들어왔을 때 자동으로 다른 언어로 보내면 Google이 색인하기 어려워집니다. 현재는 언어 전환 링크만 제공합니다.
- **canonical은 자기 자신**: 각 언어 페이지는 자기 URL을 canonical로 가집니다. 영어 페이지로 몰지 않습니다.
- **hreflang 상호 참조**: 7개 페이지 모두 동일한 hreflang 세트를 가져야 합니다. 페이지 추가/삭제 시 `seo/content.mjs`의 `LOCALES`와 `HREFLANG_ALIASES`를 함께 수정하세요.
- **sitemap lastmod**: 콘텐츠를 materially 수정하면 `SITE.contentUpdated` 날짜를 갱신하고 `npm run seo`를 실행하세요.
- **중복 콘텐츠**: 같은 문장을 언어별로 기계 번역만 돌리면 품질 평가가 떨어질 수 있습니다. 언어별로 최소한 제목·설명·FAQ를 자연스럽게 다듬으세요.

---

## 7. 배포 후 기술 점검 체크리스트

```bash
# 1) 상태 코드
curl -sI https://penguincut.com/ | findstr /I "HTTP canonical"
curl -sI https://penguincut.com/ko/ | findstr /I "HTTP"
curl -sI https://penguincut.com/sitemap.xml | findstr /I "HTTP content-type"

# 2) robots.txt
curl -s https://penguincut.com/robots.txt

# 3) noindex 확인
curl -s https://penguincut.com/studio | findstr /I "noindex"

# 4) sitemap index와 실제 URL 개수 (index → sitemap-pages.xml)
curl -s https://penguincut.com/sitemap.xml
curl -s https://penguincut.com/sitemap-pages.xml | findstr /C "<loc>"
```

브라우저에서 추가 확인:

- [ ] Google **Rich Results Test** — `https://penguincut.com/` (FAQ, SoftwareApplication)
- [ ] **PageSpeed Insights** — 모바일/데스크톱 (LCP 2.5s 이하 목표)
- [ ] **hreflang Tags Generator/Validator** — 7개 언어 상호 참조
- [ ] 모바일 390px에서 가로 스크롤 없음
- [ ] 언어 전환 드롭다운이 각 언어 페이지로 이동
- [ ] `/#projects` 접속 시 `/studio#projects`로 이동
- [ ] OG 이미지가 카카오톡/슬랙/X 미리보기에서 정상 표시

---

## 8. 콘텐츠·백링크 운영 계획

검색 노출은 등록만으로 끝나지 않습니다. 아래 순서로 4~8주 운영을 권장합니다.

### 1~2주: 기반 다지기
- Search Console/Bing/네이버 등록 및 sitemap 제출
- 상위 7개 URL 색인 요청
- 랜딩 페이지 문구 중 실제 검색 의도와 맞지 않는 표현 수정
- `ko` 페이지는 한국어 롱테일 키워드(예: "영상 하이라이트 자동 편집", "AI 영상 편집 브라우저") 반영

### 3~4주: 콘텐츠 확장
- 사용 사례별 랜딩 페이지 추가 검토
  - `/use-cases/travel-video-highlights/`
  - `/use-cases/wedding-highlight-video/`
  - `/use-cases/sports-highlights/`
- 각 페이지에 실제 예시 영상, Before/After, 3~5분 워크플로 설명 추가
- FAQ를 실제 검색 질문 기반으로 보강 (People Also Ask 활용)

### 5~8주: 외부 신호
- YouTube에 기능 데모 2~3개 업로드 (설명란에 `https://penguincut.com` 링크)
- Product Hunt, Reddit(r/videoediting, r/NewTubers), Indie Hackers에 소개
- 여행/결혼/스포츠 커뮤니티에 실제 결과물 공유 (과도한 홍보성 글 지양)
- 국내는 네이버 블로그/브런치에 활용 사례 1~2편

### 측정 지표
- GSC: 노출수, 클릭수, CTR, 평균 게재순위, 색인된 페이지 수
- Bing/네이버: 유입 키워드와 페이지
- 사이트: `/studio` 진입 수, 언어별 전환

---

## 9. 자주 발생하는 문제

| 증상 | 원인/해결 |
| --- | --- |
| sitemap이 "가져올 수 없음" | 배포 전이거나 `robots.txt`/방화벽 차단. `curl -I`로 200 확인 |
| "색인 생성됨, but not selected canonical" | hreflang/canonical 불일치 또는 중복 콘텐츠. 7개 페이지 canonical이 자기 URL인지 확인 |
| 페이지가 색인되지 않음 | `noindex` 실수, sitemap 누락, 내부 링크 부족. URL 검사 → 실시간 테스트 |
| www가 색인됨 | Vercel 도메인에서 www → 루트 Redirect가 설정되지 않음 |
| 모바일에서 가로 스크롤 | 새 섹션 추가 시 `min-width: 0` 누락 가능. 390px에서 확인 |
| OG 이미지가 안 보임 | `og:image` 절대 URL, 1200×630, PNG/JPEG, 공개 접근 가능 여부 확인 |

---

## 10. 코드 수정 후 배포

```bash
cd reportist-video
npm run seo      # index.html, public/{locale}/index.html, sitemap.xml, sitemap-pages.xml generated
npm run build    # dist/ 생성
```

`npm run dev`와 `npm run build`는 `predev`/`prebuild`로 `seo`를 자동 실행합니다.
콘텐츠는 `seo/content.mjs`, HTML 구조·메타태그·JSON-LD는 `seo/template.mjs`만 수정하면 됩니다.
