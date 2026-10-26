import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * PATCH /api/admin/catalogue/[kind]/[id] — edit a cake flavour, a cake size or
 * a design tier from the products screen.
 *
 * `kind` is whitelisted to three tables; nothing from the browser ever reaches
 * the table name. A price change stays owner-only (a manager may still switch
 * a flavour or size off when the kitchen runs out).
 */

const KIND_TABLE = {
  flavours: {
    table: "cake_flavours",
    schema: z
      .strictObject({
        pricePerKg: z.number().int("Prices are whole shillings.").min(0).max(1_000_000).optional(),
        available: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, "Nothing to change."),
  },
  sizes: {
    table: "cake_sizes",
    schema: z
      .strictObject({
        available: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, "Nothing to change."),
  },
  tiers: {
    table: "design_tiers",
    schema: z
      .strictObject({
        extraFee: z.number().int("Fees are whole shillings.").min(0).max(1_000_000).optional(),
        requiresQuote: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, "Nothing to change."),
  },
} as const;

type Kind = keyof typeof KIND_TABLE;
type Params = { params: Promise<{ kind: string; id: string }> };

function isKind(value: string): value is Kind {
  return value in KIND_TABLE;
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  const { user, supabase } = session;

  if (!can(user.role, "manageProducts")) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }

  const { kind, id } = await params;
  if (!isKind(kind)) {
    return NextResponse.json({ ok: false, error: "Unknown catalogue table." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parse = KIND_TABLE[kind].schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: parse.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const input = parse.data as Record<string, unknown>;

  const touchesPrice = "pricePerKg" in input || "extraFee" in input;
  if (touchesPrice && !can(user.role, "editPrice")) {
    return NextResponse.json(
      { ok: false, error: "Only the owner can change prices." },
      { status: 403 },
    );
  }

  const table = KIND_TABLE[kind].table;

  const { data: original, error: readError } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }
  if (!original) {
    return NextResponse.json({ ok: false, error: "That item was not found." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof input.pricePerKg === "number") patch.price_per_kg = input.pricePerKg;
  if (typeof input.extraFee === "number") patch.extra_fee = input.extraFee;
  if (typeof input.available === "boolean") patch.available = input.available;
  if (typeof input.requiresQuote === "boolean") patch.requires_quote = input.requiresQuote;

  const { error: updateError } = await supabase.from(table).update(patch).eq("id", id);
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  revalidateTag("catalog", { expire: 0 });

  const { error: logError } = await createServiceClient().from("activity_log").insert({
    user_id: user.id,
    action: "catalogue_updated",
    table_name: table,
    record_id: id,
    old_value: original as Record<string, unknown>,
    new_value: input,
  });
  if (logError) {
    console.error(`activity_log (catalogue update): ${logError.message}`);
  }

  return NextResponse.json({ ok: true, id });
}
