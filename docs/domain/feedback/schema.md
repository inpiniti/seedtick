# Feedback 도메인 데이터베이스 스키마 (Database Schema)

## 1. 테이블 정의

### `public.feedbacks` (피드백 게시글)
| 컬럼명 | 데이터 타입 | Null 허용 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | 고유 식별자 |
| `user_id` | UUID | YES | NULL | 작성자 Supabase Auth UUID (게스트 시 null) |
| `author_name` | TEXT | NO | - | 작성자 닉네임 또는 프로필 이름 |
| `author_email` | TEXT | YES | NULL | 답변 알림용 이메일 |
| `category` | TEXT | NO | - | 카테고리 ('bug', 'feature', 'general') |
| `title` | TEXT | NO | - | 제목 (3~100자) |
| `content` | TEXT | NO | - | 본문 내용 (10~2,000자) |
| `status` | TEXT | NO | `'received'` | 상태 ('received', 'reviewing', 'in_progress', 'completed', 'resolved') |
| `admin_reply` | TEXT | YES | NULL | 운영진 공식 답변 |
| `replied_at` | TIMESTAMPTZ | YES | NULL | 공식 답변 등록 일시 |
| `like_count` | INTEGER | NO | `0` | 공감(나도 필요해요) 수 |
| `is_private` | BOOLEAN | NO | `false` | 비공개 글 여부 |
| `created_at` | TIMESTAMPTZ | NO | `timezone('utc', now())` | 생성 일시 |
| `updated_at` | TIMESTAMPTZ | NO | `timezone('utc', now())` | 최종 수정 일시 |

### `public.feedback_likes` (공감 기록)
| 컬럼명 | 데이터 타입 | Null 허용 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | 고유 식별자 |
| `feedback_id` | UUID | NO | - | 피드백 외래키 (ON DELETE CASCADE) |
| `user_id` | UUID | YES | NULL | 회원 유저 ID (ON DELETE CASCADE) |
| `client_id` | TEXT | YES | NULL | 비로그인 게스트 브라우저 토큰 |
| `created_at` | TIMESTAMPTZ | NO | `timezone('utc', now())` | 공감 일시 |
