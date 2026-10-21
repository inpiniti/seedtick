import { NextResponse } from "next/server";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  if (!id) {
    return NextResponse.json(
      { success: false, message: "피드백 ID가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  const { user } = await authenticateServerRequest(req);
  const body = await req.json().catch(() => ({}));
  const clientId = body?.clientId ? String(body.clientId) : null;

  if (!user && !clientId) {
    return NextResponse.json(
      { success: false, message: "식별자(clientId 또는 로그인 세션)가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    // 1. 이미 공감했는지 확인
    let checkQuery = supabase
      .from("feedback_likes")
      .select("id")
      .eq("feedback_id", id);

    if (user && clientId) {
      checkQuery = checkQuery.or(`user_id.eq.${user.id},client_id.eq.${clientId}`);
    } else if (user) {
      checkQuery = checkQuery.eq("user_id", user.id);
    } else if (clientId) {
      checkQuery = checkQuery.eq("client_id", clientId);
    }

    const { data: existingLike } = await checkQuery.maybeSingle();

    if (existingLike) {
      // 이미 공감한 경우 -> 공감 취소
      await supabase.from("feedback_likes").delete().eq("id", existingLike.id);

      // like_count 1 감소 (최소 0)
      const { data: updated } = await supabase.rpc(
        "decrement_feedback_like",
        { p_feedback_id: id }
      );

      // RPC가 없을 경우 직접 UPDATE fallback
      let newCount: number | null = null;
      if (typeof updated === "number") {
        newCount = updated;
      } else {
        const { data: fb } = await supabase
          .from("feedbacks")
          .select("like_count")
          .eq("id", id)
          .single();
        const currentCount = Math.max(Number(fb?.like_count || 0) - 1, 0);
        await supabase
          .from("feedbacks")
          .update({ like_count: currentCount, updated_at: new Date().toISOString() })
          .eq("id", id);
        newCount = currentCount;
      }

      return NextResponse.json({
        success: true,
        hasLiked: false,
        likeCount: newCount,
        message: "공감을 취소했어요.",
      });
    }

    // 2. 신규 공감 등록
    const { error: insertErr } = await supabase.from("feedback_likes").insert({
      feedback_id: id,
      user_id: user?.id || null,
      client_id: clientId || null,
    });

    if (insertErr) {
      return NextResponse.json(
        { success: false, message: insertErr.message },
        { status: 500 }
      );
    }

    // like_count 1 증가
    const { data: fb } = await supabase
      .from("feedbacks")
      .select("like_count")
      .eq("id", id)
      .single();
    const currentCount = Number(fb?.like_count || 0) + 1;
    await supabase
      .from("feedbacks")
      .update({ like_count: currentCount, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      hasLiked: true,
      likeCount: currentCount,
      message: "공감을 표시했어요!",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "공감 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
