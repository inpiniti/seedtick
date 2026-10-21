# Feedback 도메인 (피드백 및 기능 제안)

## 1. 도메인 정의
Reportist Research 서비스 사용자로부터 **불편한 점(버그·오류)**과 **있었으면 하는 기능(기능 제안·개선 아이디어)**을 수집하고, 다른 사용자와의 공감(Upvote), 운영팀의 투명한 상태 라이프사이클(`접수됨` → `검토 중` → `개발 중` → `반영 완료`) 및 공식 답변을 통해 지속 가능한 프로덕트 개선 사이클을 구축하는 도메인입니다.

---

## 2. DDD 핵심 모델

### A. 엔티티 (Entities)
- **`Feedback` (Root Entity)**
  - `id`: UUID (고유 식별자)
  - `userId`: UUID? (로그인 유저 식별자, 비로그인 게스트인 경우 null)
  - `authorName`: String (작성자 표시명, 게스트 닉네임 또는 유저 닉네임)
  - `authorEmail`: String? (답변 알림 희망 시 선택 입력한 이메일)
  - `category`: `FeedbackCategory` ('bug' | 'feature' | 'general')
  - `title`: String (제목, 3자 이상 100자 이하)
  - `content`: String (상세 내용, 10자 이상 2,000자 이하)
  - `status`: `FeedbackStatus` ('received' | 'reviewing' | 'in_progress' | 'completed' | 'resolved')
  - `adminReply`: String? (관리자의 공식 검토/조치 답변)
  - `repliedAt`: Timestamp? (관리자 답변 작성 일시)
  - `likeCount`: Number (공감 및 추천 수)
  - `isPrivate`: Boolean (비공개 글 여부 - 작성자와 관리자만 열람 가능)
  - `createdAt`: Timestamp (등록 일시)
  - `updatedAt`: Timestamp (최종 수정 일시)

### B. 값 객체 (Value Objects)
- **`FeedbackCategory`**:
  - `feature` ("기능 제안"): 새로운 기능이나 분석 지표 추가 요청
  - `bug` ("불편한 점"): 서비스 이용 중 발생한 오류나 불편 사항
  - `general` ("기타 의견"): 서비스 칭찬, 문의 등 일반적인 피드백
- **`FeedbackStatus`**:
  - `received` ("접수됨"): 제안이 정상 등록되어 운영팀 확인 대기 중
  - `reviewing` ("검토하고 있어요"): 운영팀 및 개발팀에서 타당성 검토 중
  - `in_progress` ("개발하고 있어요"): 기능 개발 또는 버그 수정 진행 중
  - `completed` ("반영을 마쳤어요"): 서비스에 기능이 배포되거나 문제 해결 완료
- **`FeedbackLike`**:
  - `feedbackId`: UUID
  - `userId`: UUID? / `clientId`: String?
  - 동일 피드백에 대한 중복 공감 방지 가드

### C. 도메인 서비스 (Domain Services)
- **`FeedbackModerationService`**:
  - 관리자(`is_admin = true`) 권한 검증 후 상태 전이 및 공식 답변 등록
  - 부적절한 게시글 숨김/삭제 처리
- **`FeedbackValidationPolicy`**:
  - 제목 최소 3자, 본문 최소 10자 검증
  - 비공개 글의 권한별 노출 가드 (작성자 본인 또는 관리자만 열람 허용)

---

## 3. 핵심 비즈니스 불변식 (Invariants)

1. **게스트 작성 포용성**:
   - 오픈 베타 서비스 정책에 따라 로그인 없이도 닉네임 입력만으로 피드백을 등록할 수 있다.
   - 단, 로그인 사용자가 작성한 경우 자동으로 해당 사용자의 `user_id` 및 프로필 이름이 영구 귀속된다.
2. **비공개 게시글 보호 (Privacy Guard)**:
   - `is_private = true`인 피드백은 작성자 본인(`auth.uid() = user_id`)이거나 시스템 관리자(`is_admin = true`)가 아닌 제3자에게 상세 본문 및 작성자가 노출되어서는 안 된다.
3. **공감(Upvote) 멱등성**:
   - 동일한 사용자(로그인 유저는 `user_id`, 게스트는 브라우저 고유 토큰 `clientId`)는 단일 피드백에 대해 1회만 공감할 수 있으며, 중복 호출 시 공감 카운트가 부당하게 누적되지 않는다.
4. **상태 변경 및 관리자 답변 권한**:
   - 피드백의 상태(`status`) 변경과 공식 답변(`admin_reply`) 작성은 오직 시스템 관리자(`user_profiles.is_admin = true`)만이 수행할 수 있다.
5. **토스 스타일 UX 라이팅 준수**:
   - 사용자에게 노출되는 모든 상태 문구, 에러 안내, 완료 메시지는 '해요체'와 긍정형 동사를 사용한다.
