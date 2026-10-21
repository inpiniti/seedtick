-- ==============================================================================
-- Reportist Feedback & Feature Request Schema (Supabase)
-- ==============================================================================

-- 1. 피드백 테이블 생성
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'reviewing', 'in_progress', 'completed', 'resolved')),
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  like_count INTEGER NOT NULL DEFAULT 0,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. 공감(Upvote) 테이블 생성
CREATE TABLE IF NOT EXISTS public.feedback_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT unique_feedback_user_like UNIQUE (feedback_id, user_id),
  CONSTRAINT unique_feedback_client_like UNIQUE (feedback_id, client_id)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_category_status ON public.feedbacks(category, status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_like_count ON public.feedbacks(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_likes_feedback_id ON public.feedback_likes(feedback_id);

-- 4. RLS 활성화
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_likes ENABLE ROW LEVEL SECURITY;

-- 5. 피드백 조회 정책
-- 공개 글이거나, 본인이 쓴 글이거나, 관리자인 경우 조회 가능
CREATE POLICY "Public feedbacks are viewable by everyone"
  ON public.feedbacks FOR SELECT
  USING (
    is_private = false
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 누구나 피드백 등록 가능 (게스트 포함)
CREATE POLICY "Anyone can insert feedbacks"
  ON public.feedbacks FOR INSERT
  WITH CHECK (true);

-- 작성자 또는 관리자만 피드백 수정/상태 갱신 가능
CREATE POLICY "Authors and admins can update feedbacks"
  ON public.feedbacks FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 공감 조회 정책
CREATE POLICY "Feedback likes are viewable by everyone"
  ON public.feedback_likes FOR SELECT
  USING (true);

-- 공감 등록 정책
CREATE POLICY "Anyone can insert feedback likes"
  ON public.feedback_likes FOR INSERT
  WITH CHECK (true);
