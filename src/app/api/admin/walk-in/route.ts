import { NextResponse } from "next/server";
import { z } from "zod";

import { timeInKenya, todayInKenya } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { getStaffSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";
import { computeWalkIn, type WalkInProduct } from "@/lib/walk-in";

/**
 * POST /api/admin/walk-in — a shop customer buying pastries over the counter
 * (spec §6.2).
 *
 * The browser sends product ids and quantities; every price is read from the
 * catalogue and the total is computed here, exactly like the online route.
 * The sale is saved as a completed order paid in full:
 *
 *   1. the order is inserted as `new` (no stock moves),
 *   2. the payment is recorded (the database keeps amount_paid in step),
 *   3. the order moves to `confirmed` — the stock trigger takes the pastries
 *      off the shelf,
 *   4. the order moves to `completed`.
 *
 * Going through `confirmed` means the stock rule lives in one place (the
 * database trigger) instead of being copied into this route.
 */

const itemSchema = z.strictObject({
  productId: z.uuid("Pick a product from the catalogue."),
  quantity: z.number().int("Whole numbers only.").min(1, "At least one.").max(50),
});

const bodySchema = z.strictObject({
  customer: z.strictObject({
    name: z.string().trim().min(2, "Enter the customer's name.").max(80),
    phone: z.string().trim().min(7, "Enter a phone number.").max(20),
    /** The customer agreed to WhatsApp messages. */
    consent: z.boolean().default(false),
  }),
  items: z.array(itemSchema).min(1, "Add at least one item.").max(30),
  payment: z.strictObject({
    method: z.enum(["cash", "mpesa", "bank"]),
    reference: z.string().trim().max(60).optional(),
  }),
  notes: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const session = await getStaffSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
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

  const input = parse.data;
  const phone = normalizePhone(input.customer.phone);
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid Kenyan phone number." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  try {
    // --- the catalogue prices, not the browser's ---
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const { data: productRows, error: productError } = await service
      .from("products")
      .select("id, name, price, available, track_stock, stock_qty")
      .in("id", productIds);

    if (productError) {
      return NextResponse.json({ ok: false, error: productError.message }, { status: 500 });
    }

    const computed = computeWalkIn(input.items, (productRows ?? []) as WalkInProduct[]);
    if (!computed.ok) {
      return NextResponse.json({ ok: false, error: computed.error }, { status: 400 });
    }

    // --- the customer, merged by phone ---
    const { data: existing } = await session.supabase
      .from("customers")
      .select("id, consent")
      .eq("phone", phone)
      .maybeSingle();

    let customerId: string;
    if (existing) {
      // A previous consent is never taken away by a walk-in.
      const { error } = await session.supabase
        .from("customers")
        .update({
          name: input.customer.name,
          consent: Boolean(existing.consent) || input.customer.consent,
        })
        .eq("id", existing.id);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      customerId = existing.id as string;
    } else {
      const { data, error } = await session.supabase
        .from("customers")
        .insert({
          name: input.customer.name,
          phone,
          source: "walk_in",
          consent: input.customer.consent,
        })
        .select("id")
        .single();
      if (error || !data) {
        return NextResponse.json(
          { ok: false, error: error?.message ?? "The customer could not be saved." },
          { status: 500 },
        );
      }
      customerId = data.id as string;
    }

    // --- the order number ---
    const numberResult = await service.rpc("next_order_number");
    if (numberResult.error) {
      return NextResponse.json(
        { ok: false, error: "The order number could not be created." },
        { status: 500 },
      );
    }
    const orderNumber = numberResult.data as string;

    // --- the sale ---
    const { data: orderRow, error: orderError } = await session.supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        type: "pastry",
        status: "new",
        fulfilment: "pickup",
        date_needed: todayInKenya(),
        time_needed: timeInKenya(),
        subtotal: computed.total,
        total: computed.total,
        deposit_required: 0,
        amount_paid: 0,
        notes: input.notes || null,
        source: "walk_in",
        price_needs_quote: false,
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (orderError || !orderRow) {
      return NextResponse.json(
        { ok: false, error: orderError?.message ?? "The sale could not be saved." },
        { status: 500 },
      );
    }
    const orderId = orderRow.id as string;

    const { error: itemsError } = await session.supabase.from("order_items").insert(
      computed.lines.map((line) => ({
        order_id: orderId,
        product_id: line.productId,
        name: line.name,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        line_total: line.lineTotal,
      })),
    );
    if (itemsError) {
      // Leave the half-made sale visible rather than silently losing it.
      return NextResponse.json(
        { ok: false, error: `The items could not be saved: ${itemsError.message}` },
        { status: 500 },
      );
    }

    const { error: paymentError } = await session.supabase.from("payments").insert({
      order_id: orderId,
      method: input.payment.method,
      amount: computed.total,
      reference_code: input.payment.reference || null,
      recorded_by: session.user.id,
      reason: "walk-in sale",
    });
    if (paymentError) {
      return NextResponse.json(
        { ok: false, error: `The payment could not be recorded: ${paymentError.message}` },
        { status: 500 },
      );
    }

    // Confirming is what moves the stock: keep one rule, in the trigger.
    const { error: confirmError } = await session.supabase
      .from("orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", orderId);
    if (confirmError) {
      return NextResponse.json(
        { ok: false, error: `The sale was saved but not confirmed: ${confirmError.message}` },
        { status: 500 },
      );
    }

    const { error: completeError } = await session.supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderId);
    if (completeError) {
      return NextResponse.json(
        { ok: false, error: `The sale was saved but not completed: ${completeError.message}` },
        { status: 500 },
      );
    }

    // Staff cannot insert activity rows through RLS; the service key writes it.
    // PostgREST reports failures in `error`, it does not throw.
    const { error: logError } = await service.from("activity_log").insert({
      user_id: session.user.id,
      action: "walk_in_sale",
      table_name: "orders",
      record_id: orderId,
      new_value: { order_number: orderNumber, total: computed.total },
    });
    if (logError) {
      console.error(`activity_log (walk-in): ${logError.message}`);
    }

    return NextResponse.json({
      ok: true,
      id: orderId,
      order_number: orderNumber,
      total: computed.total,
    });
  } catch (e) {
    console.error(`POST /api/admin/walk-in: ${(e as Error).message}`);
    return NextResponse.json(
      { ok: false, error: "Something went wrong while saving the sale." },
      { status: 500 },
    );
  }
}
