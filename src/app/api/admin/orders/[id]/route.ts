import { NextResponse } from "next/server";
import { z } from "zod";

import { canTransition, isOrderStatus } from "@/lib/order-status";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * PATCH /api/admin/orders/[id] — move an order through the status machine.
 *
 * The dashboard only offers the moves that are allowed, but the rule is
 * checked again here: the API is the boundary, the UI is a convenience.
 *
 * Reading and writing go through the signed-in staff member's own client, so
 * Row Level Security applies. The activity log is written with the service
 * client because staff may not insert into `activity_log` (only the owner may
 * read it).
 */

const bodySchema = z.strictObject({
  status: z.string().refine(isOrderStatus, "Unknown order status."),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  const { user, supabase } = session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parse = bodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: parse.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const nextStatus = parse.data.status;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status, fulfilment")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const current = order.status as Parameters<typeof canTransition>[0];
  const fulfilment = order.fulfilment as "pickup" | "delivery";

  const allowed = canTransition(current, nextStatus, { role: user.role, fulfilment });
  if (!allowed.ok) {
    return NextResponse.json(
      { ok: false, error: allowed.reason ?? "That move is not allowed." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  // The activity log is owner-only to read, so it is written server side.
  try {
    await createServiceClient().from("activity_log").insert({
      user_id: user.id,
      action: "order_status_changed",
      table_name: "orders",
      record_id: id,
      old_value: { status: current },
      new_value: { status: nextStatus },
    });
  } catch (e) {
    console.error(`activity_log (status change): ${(e as Error).message}`);
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
