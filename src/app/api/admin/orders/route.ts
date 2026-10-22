import { NextResponse } from "next/server";

import { listOrders } from "@/lib/admin-orders";
import { getStaffSession } from "@/lib/session";

/**
 * GET /api/admin/orders — the order list as JSON.
 *
 * The dashboard polls this so a new order shows up even when Realtime is not
 * available (see docs/DECISIONS.md). The session cookie decides what is
 * returned — Row Level Security applies to this read as well.
 */
export async function GET(req: Request) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }

  try {
    const orders = await listOrders(session.supabase);
    return NextResponse.json({ ok: true, orders });
  } catch (e) {
    console.error(`GET /api/admin/orders: ${(e as Error).message}`);
    return NextResponse.json(
      { ok: false, error: "The orders could not be loaded." },
      { status: 500 },
    );
  }
}
