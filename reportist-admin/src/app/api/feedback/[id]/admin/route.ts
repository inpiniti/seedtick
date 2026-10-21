import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/subscription/admin";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { FeedbackStatus } from "@/types/feedback";

/**
 * PATCH /api/feedback/[id]/admin
 * 관리자 전용: 피드백 상태 변경 및 공식 답변 등록/수정
 */
export async function PATCH(
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

  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: gate.message },
      { status: gate.status }
    );
  }

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
        { success: false, message: "수정할 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) {
      const validStatuses: FeedbackStatus[] = [
        "received",
        "reviewing",
        "in_progress",
        "completed",
        "resolved",
      ];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, message: "유효하지 않은 상태값입니다." },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    if (typeof body.adminReply === "string") {
      updates.admin_reply = body.adminReply.trim();
      updates.replied_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from("feedbacks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { success: false, message: error?.message || "피드백 수정 실패" },
        { status: 500 }
      );
    }

    const mappedFeedback = {
      id: String(updated.id),
      userId: (updated.user_id as string) || null,
      authorName: (updated.author_name as string) || "",
      authorEmail: (updated.author_email as string) || null,
      category: updated.category,
      title: String(updated.title),
      content: String(updated.content),
      status: updated.status,
      adminReply: (updated.admin_reply as string) || null,
      repliedAt: (updated.replied_at as string) || null,
      likeCount: Number(updated.like_count || 0),
      isPrivate: Boolean(updated.is_private),
      createdAt: (updated.created_at as string) || "",
      updatedAt: (updated.updated_at as string) || "",
    };

    return NextResponse.json({
      success: true,
      feedback: mappedFeedback,
      message: "답변 및 상태를 성공적으로 반영했어요.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "관리자 업데이트 실패",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feedback/[id]/admin
 * 관리자 전용: 부적절한 게시글 삭제
 */
export async function DELETE(
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

  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: gate.message },
      { status: gate.status }
    );
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  try {
    const { error } = await supabase.from("feedbacks").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "게시글을 삭제했어요.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "게시글 삭제 실패",
      },
      { status: 500 }
    );
  }
}
