-- ==============================================================================
-- Reportist Video User Feedback & Roadmap Schema (Supabase)
-- ==============================================================================

-- 1. 피드백 게시판 테이블 생성
CREATE TABLE IF NOT EXISTS public.feedback_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'improvement', -- 'bug', 'feature', 'improvement', 'other'
  status TEXT NOT NULL DEFAULT 'open',          -- 'open', 'in_progress', 'completed', 'closed'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '익명 사용자',
  image_urls TEXT[] DEFAULT '{}',
  device_info TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  admin_response TEXT,
  admin_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feedback_posts_created_at ON public.feedback_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_posts_status ON public.feedback_posts(status);
CREATE INDEX IF NOT EXISTS idx_feedback_posts_category ON public.feedback_posts(category);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE public.feedback_posts ENABLE ROW LEVEL SECURITY;

-- 4. 조회 정책: 모든 사용자에게 공개
CREATE POLICY "Feedback posts are viewable by everyone"
  ON public.feedback_posts FOR SELECT
  USING (true);

-- 5. 등록 정책: 누구나 피드백 등록 가능 (제목과 본문 필수)
CREATE POLICY "Feedback posts can be inserted by anyone"
  ON public.feedback_posts FOR INSERT
  WITH CHECK (length(title) > 0 AND length(content) > 0);

-- 6. 수정 정책: 좋아요 및 개발자 처리 내용 업데이트 허용
CREATE POLICY "Feedback posts can be updated by anyone"
  ON public.feedback_posts FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 7. 삭제 정책: 개발자/사용자 삭제 허용
CREATE POLICY "Feedback posts can be deleted by anyone"
  ON public.feedback_posts FOR DELETE
  USING (true);

-- 8. 원자적 좋아요 증가 RPC 함수
CREATE OR REPLACE FUNCTION public.increment_feedback_like(target_feedback_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.feedback_posts
  SET like_count = like_count + 1,
      updated_at = timezone('utc', now())
  WHERE id = target_feedback_id;
END;
$$;

-- 9. Storage 버킷 설정 안내
-- Supabase Storage 대시보드에서 'feedback-attachments' 버킷을 'Public'으로 생성하거나
-- 아래 SQL을 통해 버킷을 생성할 수 있습니다.
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 버킷 RLS 정책: 누구나 업로드 및 조회 가능
CREATE POLICY "Public Feedback Attachments Select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-attachments');

CREATE POLICY "Public Feedback Attachments Insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback-attachments');
