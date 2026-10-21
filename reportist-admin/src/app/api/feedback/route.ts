import { NextResponse } from "next/server";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";
import { FeedbackCategory, FeedbackItem, FeedbackStatus } from "@/types/feedback";

/**
 * DB Row를 프론트엔드 FeedbackItem 규격으로 변환
 */
function mapFeedbackRow(
  row: Record<string, unknown>,
  likedIds?: Set<string>
): FeedbackItem {
  const id = String(row.id || "");
  return {
    id,
    userId: (row.user_id as string) || null,
    authorName: (row.author_name as string) || "익명의 사용자",
    authorEmail: (row.author_email as string) || null,
    category: (row.category as FeedbackCategory) || "feature",
    title: (row.title as string) || "",
    content: (row.content as string) || "",
    status: (row.status as FeedbackStatus) || "received",
    adminReply: (row.admin_reply as string) || null,
    repliedAt: (row.replied_at as string) || null,
    likeCount: Number(row.like_count || 0),
    isPrivate: Boolean(row.is_private),
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
    hasLiked: likedIds ? likedIds.has(id) : false,
  };
}

/**
 * GET /api/feedback
 * 피드백 목록 및 상태별 카운트 조회
 */
export async function GET(req: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") || "latest"; // 'latest' | 'popular'
  const clientId = searchParams.get("clientId");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "50"), 1), 100);

  // 현재 사용자 인증 확인 (선택적)
  const { user } = await authenticateServerRequest(req);
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = Boolean((profile as { is_admin?: boolean })?.is_admin);
  }

  try {
    let query = supabase.from("feedbacks").select("*");

    // 비관리자 및 비작성자에게는 비공개 글 숨김
    if (!isAdmin) {
      if (user) {
        query = query.or(`is_private.eq.false,user_id.eq.${user.id}`);
      } else {
        query = query.eq("is_private", false);
      }
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (sort === "popular") {
      query = query.order("like_count", { ascending: false }).order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.limit(limit);

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // 공감 여부(hasLiked) 체크
    const likedFeedbackIds = new Set<string>();
    if (user || clientId) {
      let likeQuery = supabase.from("feedback_likes").select("feedback_id");
      if (user && clientId) {
        likeQuery = likeQuery.or(`user_id.eq.${user.id},client_id.eq.${clientId}`);
      } else if (user) {
        likeQuery = likeQuery.eq("user_id", user.id);
      } else if (clientId) {
        likeQuery = likeQuery.eq("client_id", clientId);
      }
      const { data: likes } = await likeQuery;
      if (likes) {
        for (const l of likes) {
          if (l.feedback_id) likedFeedbackIds.add(String(l.feedback_id));
        }
      }
    }

    const feedbacks = (rows || []).map((r) => mapFeedbackRow(r, likedFeedbackIds));

    // 요약 집계 카운트 계산
    const { data: allStatsRows } = await supabase
      .from("feedbacks")
      .select("category,status,is_private,user_id");

    const counts = {
      total: 0,
      received: 0,
      reviewing: 0,
      inProgress: 0,
      completed: 0,
      feature: 0,
      bug: 0,
      general: 0,
    };

    for (const r of allStatsRows || []) {
      const isPriv = Boolean(r.is_private);
      const isOwner = user && r.user_id === user.id;
      if (isPriv && !isAdmin && !isOwner) continue;

      counts.total += 1;
      if (r.status === "received") counts.received += 1;
      else if (r.status === "reviewing") counts.reviewing += 1;
      else if (r.status === "in_progress") counts.inProgress += 1;
      else if (r.status === "completed" || r.status === "resolved") counts.completed += 1;

      if (r.category === "feature") counts.feature += 1;
      else if (r.category === "bug") counts.bug += 1;
      else if (r.category === "general") counts.general += 1;
    }

    return NextResponse.json({
      success: true,
      feedbacks,
      total: counts.total,
      counts,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "피드백 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feedback
 * 새로운 피드백 등록
 */
export async function POST(req: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: "요청 본문이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const category = String(body.category || "").trim();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const rawAuthorName = String(body.authorName || "").trim();
    const authorEmail = body.authorEmail ? String(body.authorEmail).trim() : null;
    const isPrivate = Boolean(body.isPrivate);

    // 유효성 검사
    if (!["feature", "bug", "general"].includes(category)) {
      return NextResponse.json(
        { success: false, message: "올바른 카테고리를 선택해 주세요." },
        { status: 400 }
      );
    }
    if (title.length < 3 || title.length > 100) {
      return NextResponse.json(
        { success: false, message: "제목은 3자 이상 100자 이하로 작성해 주세요." },
        { status: 400 }
      );
    }
    if (content.length < 10 || content.length > 2000) {
      return NextResponse.json(
        { success: false, message: "내용은 10자 이상 2,000자 이하로 자세히 적어주세요." },
        { status: 400 }
      );
    }

    // 사용자 인증 확인 (선택적)
    const { user } = await authenticateServerRequest(req);
    let authorName = rawAuthorName || "익명의 투자자";
    let userId: string | null = null;

    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name,email")
        .eq("id", user.id)
        .maybeSingle();

      const profileName = (profile as { display_name?: string })?.display_name;
      authorName = profileName || user.email?.split("@")[0] || rawAuthorName || "회원";
    }

    const { data: inserted, error } = await supabase
      .from("feedbacks")
      .insert({
        user_id: userId,
        author_name: authorName,
        author_email: authorEmail,
        category,
        title,
        content,
        status: "received",
        is_private: isPrivate,
        like_count: 0,
      })
      .select()
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { success: false, message: error?.message || "피드백 등록에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback: mapFeedbackRow(inserted),
      message: "소중한 의견을 등록했어요. 꼼꼼히 살펴볼게요!",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "피드백 등록 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
