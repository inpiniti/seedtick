import { NextResponse } from "next/server";
import { getStockTimelines } from "@/lib/server/publicCatalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getStockTimelines();
    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load stock timelines" },
      { status: 500 }
    );
  }
}
