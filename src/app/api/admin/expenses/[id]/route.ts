import { NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * DELETE /api/admin/expenses/[id] — remove a mistaken expense (owner only).
 *
 * The row is read back before the delete so the activity log keeps what was
 * there; an id that does not exist is a 404, not a silent success, and the
 * owner's own client performs the delete under the same superadmin-only
 * Row Level Security that protects the table.
 */

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (!can(session.user.role, "viewExpenses")) {
    return NextResponse.json(
      { ok: false, error: "Only the owner can remove expenses." },
      { status: 403 },
    );
  }

  const { id } = await params;

  const existing = await session.supabase
    .from("expenses")
    .select("id, spent_on, category, description, amount")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ ok: false, error: "Expense not found." }, { status: 404 });
  }

  const removed = existing.data;

  const { error } = await session.supabase.from("expenses").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { error: logError } = await createServiceClient().from("activity_log").insert({
    user_id: session.user.id,
    action: "expense_removed",
    table_name: "expenses",
    record_id: id,
    new_value: {
      spentOn: removed.spent_on,
      category: removed.category,
      description: removed.description,
      amount: removed.amount,
    },
  });
  if (logError) {
    console.error(`activity_log (expense removed): ${logError.message}`);
  }

  return NextResponse.json({ ok: true, id });
}
