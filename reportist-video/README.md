# PenguinCut (penguincut.com)

> **AI 기반 극적 영상 하이라이트 생성기**
> 여러 개의 영상에서 AI가 가장 극적이고 결정적인 순간만 정확하게 탐색하여, 브라우저에서 직접 이어붙여 하나의 완성된 하이라이트 영상으로 만들어주는 웹 애플리케이션입니다.

- 마케팅 랜딩: `https://penguincut.com/` (+ `/ko/`, `/ja/`, `/zh/`, `/es/`, `/fr/`, `/de/`)
- 앱(스튜디오): `https://penguincut.com/studio`

---

## 🌟 주요 특징

1. **순수 브라우저 처리 (100% Client-Side Privacy)**
   - 대용량 원본 영상을 외부 서버로 업로드하지 않고 브라우저 로컬 메모리(Blob URL)에서 안전하게 처리합니다.
2. **비디오 전용 LLM 모델 & 추론 노력(Reasoning Effort) 선택**
   - AI Gateway(`reportist-ai-gateway`)에서 비디오 모달리티를 지원하는 고성능 비전 모델(`Thinking Machines Inkling`, `Dots Studio Dots3-Note` 등)만 선별 제공합니다.
   - 추론 노력(High, Medium, Low) 옵션을 통해 분석의 깊이를 조절할 수 있습니다.
3. **고속 브라우저 캔버스 압축 (Vercel 4.5MB Serverless 제한 준수)**
   - 원본 비디오를 HTML5 Canvas 기반 초경량 비디오로 빠르게 리샘플링하여 AI Gateway로 순차 전송합니다.
4. **극적 구간 JSON 자동 추출 및 검증**
   - 최소 1초 이상(`duration >= 1.0s`), 겹침 없는 타임스탬프 구간을 엄격히 파싱 및 클러스터링합니다.
5. **순수 브라우저단 영상 컷 & 이어붙이기 (Stitching)**
   - `HTML5 Canvas + MediaRecorder API + Web Audio API`를 사용하여 원본 영상의 고화질 극적 구간들을 매끄럽게 하나의 영상 파일로 병합합니다.
6. **Reportist Admin / Toss 스타일 프리미엄 UI**
   - Pretendard & Inter 폰트, 직관적인 단계별 파이프라인 진행률, 하이라이트 챕터 인덱스 바, 원클릭 다운로드를 지원합니다.

---

## 🚀 로컬 실행 방법

```bash
# 의존성 설치
bun install
# 또는 npm install

# 개발 서버 실행 (포트 5175)
bun run dev

# 프로덕션 빌드
bun run build
```

개발/빌드 전에 `npm run seo`가 자동 실행되어 랜딩 페이지와 sitemap을 재생성합니다.

---

## 🌐 penguincut.com 도메인 연결 가이드

### 1단계: Vercel 프로젝트 생성
1. [Vercel 대시보드](https://vercel.com)에서 **Add New...** → **Project** 클릭
2. 본 레포지토리의 `reportist-video` 디렉토리를 루트로 지정하여 배포합니다.
3. 프로젝트 **Settings** → **Domains** 메뉴로 이동합니다.
4. 도메인 입력란에 **`penguincut.com`** 입력 후 **Add**를 누릅니다.
5. **`www.penguincut.com`** 도 추가한 뒤, `penguincut.com`으로 **Redirect** 되도록 설정합니다.
6. Vercel이 표시해 주는 DNS 레코드 값을 확인합니다.

### 2단계: 도메인 등록업체 DNS 설정
1. 도메인 등록업체의 **DNS 설정** 화면으로 이동합니다.
2. 루트 도메인 레코드를 추가합니다.
   - **타입**: `A`
   - **호스트**: `@`
   - **값**: Vercel이 안내한 IP (예: `76.76.21.21`)
3. `www` 레코드를 추가합니다.
   - **타입**: `CNAME`
   - **호스트**: `www`
   - **값**: `cname.vercel-dns.com`
4. 저장 후 DNS 전파(보통 10분~48시간)를 기다립니다.
5. `https://penguincut.com/` 접속과 HTTPS 인증서 발급을 확인합니다.

> Vercel 네임서버를 사용하는 방식이 더 간단할 수 있습니다. 등록업체에서 네임서버를 `ns1.vercel-dns.com`, `ns2.vercel-dns.com`으로 변경하면 DNS 레코드를 Vercel에서 관리할 수 있습니다.

---

## 🔍 SEO / Search Console

- 전체 운영 가이드: [`docs/seo/README.md`](docs/seo/README.md)
- 랜딩 콘텐츠/메타데이터: `seo/content.mjs`
- HTML/JSON-LD 템플릿: `seo/template.mjs`
- sitemap: `https://penguincut.com/sitemap.xml`
- 검증 토큰은 `seo/content.mjs`의 `SITE.verification`에 넣고 `npm run seo`를 실행하세요.
