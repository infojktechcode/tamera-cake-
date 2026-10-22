import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { computeOrder } from "@/lib/order-compute";
import { countCakesForDate } from "@/lib/cake-load";
import type {
  CatalogueRows,
  OrderSettings,
  ResolvedFlavour,
  ResolvedProduct,
  ResolvedSize,
  ResolvedTier,
  ResolvedZone,
} from "@/lib/order-compute";
import { normalizePhone } from "@/lib/phone";
import { orderLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { orderPayloadSchema, type OrderPayload } from "@/lib/validators/order.schema";

/**
 * POST /api/orders — the order security boundary.
 *
 * The browser sends ids and quantities only. Every price, deposit and date
 * decision below is computed here from the database, so a tampered payload
 * cannot change what the customer is charged.
 *
 * Inserts go through the service-role client (RLS blocks anonymous writes to
 * `orders`); the customer row is upserted by phone so returning customers keep
 * their history.
 */

function badRequest(message: string) {
  return NextResponse.json({ ok: false as const, error: message }, { status: 400 });
}

function internalError() {
  return NextResponse.json(
    { ok: false as const, error: "Something went wrong while placing the order. Please try again." },
    { status: 500 },
  );
}

async function loadCatalogue(
  service: ReturnType<typeof createServiceClient>,
): Promise<{ catalogue: CatalogueRows; settings: OrderSettings }> {
  const [sizes, flavours, tiers, zones, products, settingsRow] = await Promise.all([
    service.from("cake_sizes").select("id,kg").eq("available", true),
    service.from("cake_flavours").select("id,name,price_per_kg").eq("available", true),
    service.from("design_tiers").select("id,name,extra_fee,requires_quote"),
    service.from("delivery_zones").select("id,name,fee").eq("active", true),
    service.from("products").select("id,name,price").eq("available", true),
    service.from("settings")
      .select("min_lead_days,daily_cake_limit,deposit_percent,deposit_threshold_kg")
      .single(),
  ]);

  const firstError =
    sizes.error ?? flavours.error ?? tiers.error ?? zones.error ?? products.error ?? settingsRow.error;
  if (firstError) {
    throw new Error(`loadCatalogue: ${firstError.message}`);
  }

  const row = (settingsRow.data ?? {}) as Partial<OrderSettings>;

  return {
    catalogue: {
      sizes: (sizes.data ?? []).map((r) => ({ id: r.id, kg: Number(r.kg) })) satisfies ResolvedSize[],
      flavours: (flavours.data ?? []).map(
        (r) => ({ id: r.id, name: r.name, pricePerKg: r.price_per_kg }),
      ) satisfies ResolvedFlavour[],
      tiers: (tiers.data ?? []).map(
        (r) => ({
          id: r.id,
          name: r.name,
          extraFee: r.extra_fee,
          requiresQuote: r.requires_quote,
        }),
      ) satisfies ResolvedTier[],
      zones: (zones.data ?? []).map((r) => ({ id: r.id, name: r.name, fee: r.fee })) satisfies ResolvedZone[],
      products: (products.data ?? []).map(
        (r) => ({ id: r.id, name: r.name, unitPrice: r.price }),
      ) satisfies ResolvedProduct[],
    },
    settings: {
      min_lead_days: row.min_lead_days ?? 2,
      daily_cake_limit: row.daily_cake_limit ?? 5,
      deposit_percent: row.deposit_percent ?? 50,
      deposit_threshold_kg: row.deposit_threshold_kg ?? 3,
    },
  };
}

export async function POST(
  req: Request,
): Promise<NextResponse<{ ok: true; order_number: string } | { ok: false; error: string }>> {
  // --- 1. rate limit by IP (spec §10) ---
  const limit = orderLimiter.check(req.headers);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false as const, error: "Too many attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  // --- 2. parse + validate ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parse = orderPayloadSchema.safeParse(body);
  if (!parse.success) {
    return badRequest(parse.error.issues[0]?.message ?? "Please check your order details.");
  }
  const payload: OrderPayload = parse.data;

  const service = createServiceClient();

  try {
    // --- 3. load the catalogue + settings ---
    const { catalogue, settings } = await loadCatalogue(service);

    // --- 4. live date state ---
    const { data: blockedDates, error: blockedError } = await service
      .from("blocked_dates")
      .select("date");
    if (blockedError) {
      throw new Error(`blocked_dates: ${blockedError.message}`);
    }
    // The capacity check counts the cakes already booked for that date.
    const confirmedCountOnDate = await countCakesForDate(service, payload.dateNeeded);

    // --- 5. compute every price on the server ---
    const computed = computeOrder({
      payload,
      catalogue,
      settings,
      blockedDates: (blockedDates ?? []).map((d) => d.date as string),
      confirmedCountOnDate,
      now: new Date(),
    });
    if (!computed.ok) {
      return badRequest(computed.error);
    }
    const order = computed.order;

    // --- 6. resolve the customer ---
    const phone = normalizePhone(order.customer.phone);
    if (!phone) {
      return badRequest("Enter a valid Kenyan phone number.");
    }
    const customer = await upsertCustomer(service, {
      name: order.customer.name,
      phone,
    });

    // --- 7. the order number ---
    const numberResult = await service.rpc("next_order_number");
    if (numberResult.error) {
      throw new Error(`next_order_number: ${numberResult.error.message}`);
    }
    const orderNumber = numberResult.data as string;

    // --- 8. insert the order ---
    const { data: orderRow, error: orderError } = await service
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customer.id,
        type: order.lines.some((l) => l.kind === "cake")
          ? order.lines.every((l) => l.kind === "cake")
            ? "cake"
            : "mixed"
          : "pastry",
        status: "new",
        fulfilment: order.fulfilment.kind,
        delivery_zone_id:
          order.fulfilment.kind === "delivery" ? order.fulfilment.zoneId : null,
        delivery_address:
          order.fulfilment.kind === "delivery" ? order.fulfilment.address : null,
        delivery_fee: order.deliveryFee,
        date_needed: order.dateNeeded,
        time_needed: order.timeNeeded ?? null,
        subtotal: order.subtotal,
        total: order.total,
        deposit_required: order.depositRequired,
        amount_paid: 0,
        notes: order.notes || null,
        source: "online",
        price_needs_quote: order.priceNeedsQuote,
      })
      .select("id")
      .single();
    if (orderError) {
      throw new Error(`orders insert: ${orderError.message}`);
    }
    const orderId = (orderRow as { id: string }).id;

    // --- 9. insert the lines, and the cake detail rows ---
    for (const line of order.lines) {
      const { data: itemRow, error: itemError } = await service
        .from("order_items")
        .insert({
          order_id: orderId,
          product_id: line.kind === "pastry" ? line.refId : null,
          name: line.productName,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          line_total: line.lineTotal,
        })
        .select("id")
        .single();
      if (itemError) {
        throw new Error(`order_items insert: ${itemError.message}`);
      }

      if (line.kind !== "cake") continue;

      const { error: detailError } = await service.from("cake_details").insert({
        order_item_id: (itemRow as { id: string }).id,
        size_kg: line.sizeKg,
        flavour_id: line.refId,
        flavour_name: line.flavourName,
        design_tier_id: line.tierId,
        design_tier_name: line.tierName,
        design_description: line.designDescription || null,
        cake_message: line.cakeMessage || null,
        allergies: line.allergies || null,
        reference_photos: line.referencePhotos,
      });
      if (detailError) {
        throw new Error(`cake_details insert: ${detailError.message}`);
      }
    }

    // --- 10. activity log ---
    await service.from("activity_log").insert({
      user_id: null,
      action: "order_created",
      table_name: "orders",
      record_id: orderId,
      new_value: { order_number: orderNumber, total: order.total },
    });

    // --- 11. a booked cake changes what the public pages show ---
    // Next 16 requires a cache profile: "max" serves stale content while the
    // revalidation runs in the background.
    revalidateTag("catalog", "max");

    return NextResponse.json({ ok: true, order_number: orderNumber });
  } catch (e) {
    console.error(`POST /api/orders: ${(e as Error).message}`);
    return internalError();
  }
}

interface CustomerInput {
  name: string;
  phone: string;
}

async function upsertCustomer(
  service: ReturnType<typeof createServiceClient>,
  input: CustomerInput,
): Promise<{ id: string }> {
  const { data, error } = await service
    .from("customers")
    .upsert(
      {
        name: input.name,
        phone: input.phone,
        source: "online",
        consent: true,
      },
      { onConflict: "phone" },
    )
    .select("id")
    .single();
  if (error) {
    throw new Error(`customers upsert: ${error.message}`);
  }
  return data as { id: string };
}
