# Reportist Chat

OpenRouter의 최신 무료(:free) AI 모델들과 대화할 수 있는 토스 디자인 스타일의 경량 웹 채팅 애플리케이션입니다.

## ✨ 주요 기능

1. **OpenRouter 17개 무료 모델 실시간 연동**:
   - `recursive/flint-v1.0:free`, `xingchen-agi/xing4.0-29b-a4b:free`, `nvidia/nemotron-3.5-super-vl:free` 등
   - 모델 선택 팝업에서 **출시 시점(N일 전)**, **지능/아키텍처 티어(MoE, 플래그십, 멀티모달)**, **파라미터 수(120B/12B 등)**, **컨텍스트 윈도우(256K, 1M)** 간편 확인.
2. **추론 노력(Reasoning Effort) 단계별 설정**:
   - `기본(none)`, `낮음(low)`, `중간(medium)`, `높음(high)`, `엑스트라(extra)`, `최대(max)`
   - 상단 세그먼트 컨트롤로 즉시 전환.
3. **실시간 스트리밍 & 사고 과정(Reasoning/Thinking) 분리 표시**:
   - 모델의 생각 과정을 실시간으로 아코디언 토글 형태로 확인 가능.
   - 답변 텍스트는 마크다운 구문 강조 및 원클릭 코드 복사 지원.
4. **대화 세션 관리**:
   - 로컬스토리지 영구 저장 및 새 대화 생성/삭제 지원.
5. **토스(Toss) 디자인 가이드 적용**:
   - Pretendard 폰트, `#3182f6` 포인트 컬러, 부드러운 그림자, 친절한 해요체 문구.

## 🚀 실행 방법

### 1. AI 게이트웨이 실행
```bash
cd ../reportist-ai-gateway
bun run dev # http://localhost:3000
```

### 2. 챗 프론트엔드 실행
```bash
cd reportist-chat
bun run dev # http://localhost:5174
```
브라우저에서 `http://localhost:5174`로 접속하면 즉시 채팅을 시작할 수 있습니다.
