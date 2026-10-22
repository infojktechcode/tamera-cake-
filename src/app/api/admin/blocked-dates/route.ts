import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST   /api/admin/blocked-dates — block a day (the shop is closed).
 * DELETE /api/admin/blocked-dates — open the day again.
 *
 * A blocked day cannot be chosen by a customer and the shop cannot confirm
 * an order for it. Only the owner may close or open a day — it changes what the
 * whole shop can sell. The blocked_dates table is writable through RLS, so the
 * change goes through the staff member's own client; the activity log is
 * written with the service key (staff may not insert into it themselves).
 */

const bodySchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (session.user.role !== "superadmin") {
    return NextResponse.json(
      { ok: false, error: "Only the owner can close a day." },
      { status: 403 },
    );
  }

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

  const { date, reason } = parse.data;

  const { error } = await session.supabase.from("blocked_dates").upsert(
    { date, reason: reason ?? null },
    { onConflict: "date" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  try {
    await createServiceClient().from("activity_log").insert({
      user_id: session.user.id,
      action: "date_blocked",
      table_name: "blocked_dates",
      record_id: null,
      new_value: { date, reason: reason ?? null },
    });
  } catch (e) {
    console.error(`activity_log (blocked date): ${(e as Error).message}`);
  }

  return NextResponse.json({ ok: true, date, blocked: true });
}

export async function DELETE(req: Request) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (session.user.role !== "superadmin") {
    return NextResponse.json(
      { ok: false, error: "Only the owner can open a day." },
      { status: 403 },
    );
  }

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

  const { error } = await session.supabase
    .from("blocked_dates")
    .delete()
    .eq("date", parse.data.date);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  try {
    await createServiceClient().from("activity_log").insert({
      user_id: session.user.id,
      action: "date_unblocked",
      table_name: "blocked_dates",
      record_id: null,
      new_value: { date: parse.data.date },
    });
  } catch (e) {
    console.error(`activity_log (unblocked date): ${(e as Error).message}`);
  }

  return NextResponse.json({ ok: true, date: parse.data.date, blocked: false });
}
