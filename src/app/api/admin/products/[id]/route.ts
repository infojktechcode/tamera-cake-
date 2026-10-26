import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { isValidProductImagePath } from "@/lib/product-edit";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * PATCH /api/admin/products/[id] — edit one product from the dashboard.
 * DELETE /api/admin/products/[id] — remove a product (owner only).
 *
 * The dashboard hides what a role may not do, but the role check is repeated
 * here: this route is the boundary. In particular a manager may edit a photo,
 * a description, availability and stock, but not a price, a cost or a delete
 * (`permissions.ts`).
 *
 * Reads and writes use the staff member's own client so RLS applies; the
 * activity log is written with the service client because staff may not insert
 * into it.
 */

const bodySchema = z
  .strictObject({
    name: z.string().trim().min(1, "A product needs a name.").max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    price: z.number().int("Prices are whole shillings.").min(0).max(1_000_000).optional(),
    available: z.boolean().optional(),
    trackStock: z.boolean().optional(),
    stockQty: z.number().int("Stock is a whole number.").min(0).max(100_000).optional(),
    lowStockLevel: z.number().int("The low-stock level is a whole number.").min(0).max(100_000).optional(),
    /** Owner-only: what the shop paid for one unit. */
    costPrice: z.number().int("Costs are whole shillings.").min(0).max(1_000_000).optional(),
    /** A stored path, or null to remove the photo. */
    imageUrl: z.string().trim().max(300).nullable().optional(),
    /** The current row, so two tabs cannot silently overwrite each other. */
    updatedAt: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nothing to change.");

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  const { user, supabase } = session;

  if (!can(user.role, "manageProducts")) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }

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
  const input = parse.data;

  if (input.price !== undefined && !can(user.role, "editPrice")) {
    return NextResponse.json(
      { ok: false, error: "Only the owner can change prices." },
      { status: 403 },
    );
  }
  if (input.costPrice !== undefined && !can(user.role, "viewCostPrice")) {
    return NextResponse.json(
      { ok: false, error: "Only the owner can change cost prices." },
      { status: 403 },
    );
  }
  if (input.imageUrl !== undefined && input.imageUrl !== null) {
    if (!isValidProductImagePath(input.imageUrl)) {
      return NextResponse.json(
        { ok: false, error: "Upload the photo from this screen." },
        { status: 400 },
      );
    }
  }

  const { data: original, error: readError } = await supabase
    .from("products")
    .select(
      "id, name, description, price, available, track_stock, stock_qty, low_stock_level, image_url",
    )
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }
  if (!original) {
    return NextResponse.json({ ok: false, error: "Product not found." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.price !== undefined) patch.price = input.price;
  if (input.available !== undefined) patch.available = input.available;
  if (input.trackStock !== undefined) patch.track_stock = input.trackStock;
  if (input.stockQty !== undefined) patch.stock_qty = input.stockQty;
  if (input.lowStockLevel !== undefined) patch.low_stock_level = input.lowStockLevel;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("products").update(patch).eq("id", id);
    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }
  }

  if (input.costPrice !== undefined) {
    const { error: costError } = await supabase
      .from("product_costs")
      .upsert({ product_id: id, cost_price: input.costPrice }, { onConflict: "product_id" });
    if (costError) {
      return NextResponse.json({ ok: false, error: costError.message }, { status: 500 });
    }
  }

  // The public pages and the order route read the catalogue through this tag.
  revalidateTag("catalog", { expire: 0 });

  const { error: logError } = await createServiceClient().from("activity_log").insert({
    user_id: user.id,
    action: "product_updated",
    table_name: "products",
    record_id: id,
    old_value: {
      name: original.name,
      price: original.price,
      available: original.available,
      track_stock: original.track_stock,
      stock_qty: original.stock_qty,
      low_stock_level: original.low_stock_level,
      image_url: original.image_url,
    },
    new_value: input,
  });
  if (logError) {
    console.error(`activity_log (product update): ${logError.message}`);
  }

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  const { user, supabase } = session;

  if (!can(user.role, "deleteProducts")) {
    return NextResponse.json(
      { ok: false, error: "Only the owner can delete a product." },
      { status: 403 },
    );
  }

  const { id } = await params;

  const { data: original, error: readError } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }
  if (!original) {
    return NextResponse.json({ ok: false, error: "Product not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("products").delete().eq("id", id);
  if (deleteError) {
    // Order history keeps pointing at the product it sold (order_items has a
    // restricting foreign key), so an old product is switched off, not erased.
    if (deleteError.code === "23503") {
      return NextResponse.json(
        {
          ok: false,
          error: "That product is on past orders. Switch it off instead of deleting it.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  revalidateTag("catalog", { expire: 0 });

  const { error: logError } = await createServiceClient().from("activity_log").insert({
    user_id: user.id,
    action: "product_deleted",
    table_name: "products",
    record_id: id,
    old_value: { name: original.name, price: original.price },
  });
  if (logError) {
    console.error(`activity_log (product delete): ${logError.message}`);
  }

  return NextResponse.json({ ok: true });
}
