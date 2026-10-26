import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * PATCH /api/admin/orders/[id]/price — correct an item's price.
 *
 * Used when the shop quotes a design: the browser sends the new unit price,
 * the server recomputes the line total, the subtotal and the total from the
 * order's own rows, and the change is written to the activity log.
 *
 * Who may edit: the owner always; a manager only while the order is still
 * open — a manager cannot edit past sales (spec §1).
 */

const bodySchema = z.strictObject({
  itemId: z.uuid(),
  unitPrice: z.number().int().min(0).max(10_000_000),
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
  const { itemId, unitPrice } = parse.data;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status, delivery_fee, subtotal, total")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const finished = order.status === "completed" || order.status === "cancelled";
  if (user.role !== "superadmin" && finished) {
    return NextResponse.json(
      { ok: false, error: "A finished order cannot be edited. Ask the owner to change it." },
      { status: 403 },
    );
  }

  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .select("id, name, quantity, unit_price, line_total")
    .eq("id", itemId)
    .eq("order_id", id)
    .maybeSingle();

  if (itemError) {
    return NextResponse.json({ ok: false, error: itemError.message }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ ok: false, error: "That item is not on this order." }, { status: 404 });
  }

  const lineTotal = unitPrice * item.quantity;

  const { error: itemUpdateError } = await supabase
    .from("order_items")
    .update({ unit_price: unitPrice, line_total: lineTotal })
    .eq("id", itemId);

  if (itemUpdateError) {
    return NextResponse.json({ ok: false, error: itemUpdateError.message }, { status: 500 });
  }

  // Recompute the order totals from its own rows.
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("line_total")
    .eq("order_id", id);

  if (itemsError) {
    return NextResponse.json({ ok: false, error: itemsError.message }, { status: 500 });
  }

  const subtotal = (items ?? []).reduce((sum, i) => sum + (i.line_total as number), 0);
  const total = subtotal + (order.delivery_fee as number);

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({ subtotal, total })
    .eq("id", id);

  if (orderUpdateError) {
    return NextResponse.json({ ok: false, error: orderUpdateError.message }, { status: 500 });
  }

  try {
    await createServiceClient().from("activity_log").insert({
      user_id: user.id,
      action: "order_price_edited",
      table_name: "orders",
      record_id: id,
      old_value: { item: item.name, unit_price: item.unit_price, total: order.total },
      new_value: { item: item.name, unit_price: unitPrice, total },
    });
  } catch (e) {
    console.error(`activity_log (price edit): ${(e as Error).message}`);
  }

  return NextResponse.json({ ok: true, subtotal, total, lineTotal });
}
