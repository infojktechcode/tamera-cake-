import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/admin/expenses — record an expense (spec §6.2, owner only).
 *
 * The expenses table carries superadmin-only Row Level Security, so the
 * insert runs through the owner's own client and a manager could not write
 * one even with a hand-made request. The activity log follows the same
 * pattern as blocked dates: written with the service key, because staff may
 * not insert into it themselves.
 */

const bodySchema = z.strictObject({
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  category: z.string().trim().min(1, "Choose a category.").max(60),
  description: z.string().trim().max(300).optional(),
  amount: z
    .number()
    .int("Enter whole shillings.")
    .refine((v) => v > 0, "Enter an amount above zero."),
});

export async function POST(req: Request) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (!can(session.user.role, "viewExpenses")) {
    return NextResponse.json(
      { ok: false, error: "Only the owner can record expenses." },
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

  const { spentOn, category, description, amount } = parse.data;

  const { data, error } = await session.supabase
    .from("expenses")
    .insert({
      spent_on: spentOn,
      category,
      description: description ?? null,
      amount,
      recorded_by: session.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Could not save the expense." },
      { status: 500 },
    );
  }

  const { error: logError } = await createServiceClient().from("activity_log").insert({
    user_id: session.user.id,
    action: "expense_recorded",
    table_name: "expenses",
    record_id: data.id as string,
    new_value: { spentOn, category, description: description ?? null, amount },
  });
  if (logError) {
    console.error(`activity_log (expense): ${logError.message}`);
  }

  return NextResponse.json({ ok: true, id: data.id });
}
