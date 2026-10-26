import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/admin/orders/[id]/payments — record a payment.
 *
 * The `payments_sync` trigger keeps `orders.amount_paid` equal to the sum of
 * the payments, so the running balance never has to be computed by hand.
 *
 * A refund is a negative amount with a reason (spec §4).
 */

const bodySchema = z.strictObject({
  method: z.enum(["mpesa", "cash", "bank"]),
  /** Negative for a refund. */
  amount: z.number().int().refine((v) => v !== 0, "Enter an amount."),
  referenceCode: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(300).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
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
  const { method, amount, referenceCode, reason } = parse.data;
  if (amount < 0 && !reason) {
    return NextResponse.json(
      { ok: false, error: "A refund needs a reason." },
      { status: 400 },
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("payments").insert({
    order_id: id,
    method,
    amount,
    reference_code: referenceCode ?? null,
    reason: reason ?? null,
    recorded_by: user.id,
  });

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  try {
    await createServiceClient().from("activity_log").insert({
      user_id: user.id,
      action: amount < 0 ? "payment_refunded" : "payment_recorded",
      table_name: "payments",
      record_id: id,
      new_value: { order: order.order_number, method, amount, referenceCode: referenceCode ?? null },
    });
  } catch (e) {
    console.error(`activity_log (payment): ${(e as Error).message}`);
  }

  return NextResponse.json({ ok: true });
}
