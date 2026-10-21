import { NextResponse } from "next/server";
import { getTimelineStats } from "@/lib/server/publicCatalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getTimelineStats();
    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load timeline stats" },
      { status: 500 }
    );
  }
}
