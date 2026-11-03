-- ==============================================================================
-- Reportist Video Share & Community Schema (Supabase)
-- ==============================================================================

-- 1. 영상 공유 테이블 생성
CREATE TABLE IF NOT EXISTS public.video_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. 인덱스 생성 (최신순 / 조회수순 / 유튜브 ID 검색)
CREATE INDEX IF NOT EXISTS idx_video_shares_created_at ON public.video_shares(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_shares_view_count ON public.video_shares(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_video_shares_youtube_id ON public.video_shares(youtube_video_id);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;

-- 4. 조회 정책: 모든 사용자(익명/비로그인 포함)에게 공개
CREATE POLICY "Public video shares are viewable by everyone"
  ON public.video_shares FOR SELECT
  USING (true);

-- 5. 등록 정책: 누구나 영상 공유 등록 가능 (유튜브 ID와 제목 필수)
CREATE POLICY "Public video shares can be inserted by anyone"
  ON public.video_shares FOR INSERT
  WITH CHECK (length(youtube_video_id) > 0 AND length(title) > 0);

-- 6. 수정 정책: 조회수 카운팅을 위한 UPDATE 허용
CREATE POLICY "Public video shares can be updated for view counts"
  ON public.video_shares FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 7. 원자적 조회수 증가 RPC 함수
CREATE OR REPLACE FUNCTION public.increment_video_share_view(target_video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.video_shares
  SET view_count = view_count + 1,
      updated_at = timezone('utc', now())
  WHERE id = target_video_id;
END;
$$;
