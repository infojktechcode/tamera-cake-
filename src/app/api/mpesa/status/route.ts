import { NextResponse } from "next/server";

import { mpesaStatusLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/mpesa/status?token=<uuid> — the confirmation page's poll target.
 *
 * The high-entropy token is the authorization: knowing it is what lets a
 * customer (or whoever they share the link with) see the order's payment
 * state. No phone number is ever returned.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request): Promise<NextResponse> {
  const limit = mpesaStatusLimiter.check(req.headers);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false as const, error: "Too many requests." },
      { status: 429 },
    );
  }

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ ok: false as const, error: "Not found." }, { status: 404 });
  }

  const service = createServiceClient();
  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, status, deposit_required, amount_paid")
    .eq("public_token", token)
    .maybeSingle();
  if (orderError) {
    console.error(`[mpesa] status lookup failed: ${orderError.message}`);
    return NextResponse.json(
      { ok: false as const, error: "Something went wrong." },
      { status: 500 },
    );
  }
  if (!order) {
    return NextResponse.json({ ok: false as const, error: "Not found." }, { status: 404 });
  }

  // Latest M-Pesa attempt (cash/bank rows are recorded as completed and must
  // not masquerade as a live STK push).
  const { data: attempts, error: attemptsError } = await service
    .from("payments")
    .select("payment_status, mpesa_receipt_number, created_at")
    .eq("order_id", order.id)
    .eq("method", "mpesa")
    .order("created_at", { ascending: false })
    .limit(1);
  if (attemptsError) {
    console.error(`[mpesa] status attempt lookup failed: ${attemptsError.message}`);
    return NextResponse.json(
      { ok: false as const, error: "Something went wrong." },
      { status: 500 },
    );
  }

  const latest = attempts?.[0] as
    | { payment_status: string; mpesa_receipt_number: string | null }
    | undefined;

  const depositRequired = Number(order.deposit_required ?? 0);
  const amountPaid = Number(order.amount_paid ?? 0);

  return NextResponse.json({
    ok: true as const,
    status: order.status as string,
    deposit_required: depositRequired,
    amount_paid: amountPaid,
    deposit_paid: depositRequired > 0 && amountPaid >= depositRequired,
    attempt_status: latest?.payment_status ?? null,
    receipt: latest?.payment_status === "completed" ? (latest.mpesa_receipt_number ?? null) : null,
  });
}
