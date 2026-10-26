import { createHash } from "node:crypto";
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
): Promise<NextResponse<{ ok: true; confirmation_token: string } | { ok: false; error: string }>> {
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
    const phone = normalizePhone(payload.customer.phone);
    if (!phone) {
      return badRequest("Enter a valid Kenyan phone number.");
    }
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          ...payload,
          customer: { ...payload.customer, phone },
        }),
      )
      .digest("hex");
    const versionedRequestHash = `v2:${requestHash}`;

    const { data: lookupData, error: lookupError } = await service.rpc(
      "lookup_public_order_by_idempotency",
      {
        p_idempotency_key: payload.idempotencyKey,
        p_request_hash: versionedRequestHash,
      },
    );
    if (lookupError) {
      throw new Error(`lookup_public_order_by_idempotency: ${lookupError.message}`);
    }
    if (!lookupData || typeof lookupData !== "object" || !("ok" in lookupData)) {
      throw new Error("lookup_public_order_by_idempotency returned an invalid result.");
    }
    const lookup = lookupData as {
      ok: boolean;
      found?: boolean;
      legacy?: boolean;
      legacy_total?: number;
      confirmation_token?: string;
      error?: string;
    };
    if (!lookup.ok) {
      return badRequest(lookup.error ?? "This checkout request was already used.");
    }
    if (lookup.found) {
      if (!lookup.confirmation_token) {
        throw new Error("lookup_public_order_by_idempotency returned no confirmation token.");
      }
      return NextResponse.json({
        ok: true,
        confirmation_token: lookup.confirmation_token,
      });
    }

    if (lookup.legacy) {
      if (
        typeof lookup.legacy_total !== "number" ||
        !Number.isSafeInteger(lookup.legacy_total) ||
        lookup.legacy_total < 0
      ) {
        throw new Error("lookup_public_order_by_idempotency returned an invalid legacy total.");
      }
      const legacyRequestHash = createHash("sha256")
        .update(JSON.stringify({ payload, normalizedPhone: phone, total: lookup.legacy_total }))
        .digest("hex");
      const { data: legacyData, error: legacyError } = await service.rpc(
        "verify_legacy_public_order_retry",
        {
          p_idempotency_key: payload.idempotencyKey,
          p_request_hash: legacyRequestHash,
        },
      );
      if (legacyError) {
        throw new Error(`verify_legacy_public_order_retry: ${legacyError.message}`);
      }
      if (!legacyData || typeof legacyData !== "object" || !("ok" in legacyData)) {
        throw new Error("verify_legacy_public_order_retry returned an invalid result.");
      }
      const legacyResult = legacyData as {
        ok: boolean;
        found?: boolean;
        confirmation_token?: string;
        error?: string;
      };
      if (!legacyResult.ok) {
        return badRequest(legacyResult.error ?? "This checkout request was already used.");
      }
      if (legacyResult.found) {
        if (!legacyResult.confirmation_token) {
          throw new Error("verify_legacy_public_order_retry returned no confirmation token.");
        }
        return NextResponse.json({
          ok: true,
          confirmation_token: legacyResult.confirmation_token,
        });
      }
    }

    // --- 3. load the catalogue + settings ---
    const { catalogue, settings } = await loadCatalogue(service);

    // --- 4. live date state ---
    let blockedDateValues: string[] = [];
    let confirmedCountOnDate = 0;
    if (payload.items.some((item) => item.kind === "cake")) {
      const [blockedResult, cakeCount] = await Promise.all([
        service.from("blocked_dates").select("date"),
        countCakesForDate(service, payload.dateNeeded),
      ]);
      if (blockedResult.error) {
        throw new Error(`blocked_dates: ${blockedResult.error.message}`);
      }
      blockedDateValues = (blockedResult.data ?? []).map((date) => date.date);
      confirmedCountOnDate = cakeCount;
    }

    // --- 5. compute every price on the server ---
    const computed = computeOrder({
      payload,
      catalogue,
      settings,
      blockedDates: blockedDateValues,
      confirmedCountOnDate,
      now: new Date(),
    });
    if (!computed.ok) {
      return badRequest(computed.error);
    }
    const order = computed.order;

    // The database function creates the customer, order, lines, cake details
    // and activity record in one transaction. It also serializes capacity
    // checks per date and makes retried submissions idempotent.
    const type = order.lines.some((line) => line.kind === "cake")
      ? order.lines.every((line) => line.kind === "cake")
        ? "cake"
        : "mixed"
      : "pastry";
    const { data, error } = await service.rpc("create_public_order", {
      p_idempotency_key: payload.idempotencyKey,
      p_request_hash: versionedRequestHash,
      p_customer: { name: order.customer.name, phone },
      p_date_needed: order.dateNeeded,
      p_lines: order.lines,
      p_order: {
        type,
        fulfilment: order.fulfilment.kind,
        delivery_zone_id:
          order.fulfilment.kind === "delivery" ? order.fulfilment.zoneId : null,
        delivery_address:
          order.fulfilment.kind === "delivery" ? order.fulfilment.address : null,
        delivery_fee: order.deliveryFee,
        time_needed: order.timeNeeded ?? null,
        subtotal: order.subtotal,
        total: order.total,
        deposit_required: order.depositRequired,
        notes: order.notes || null,
        price_needs_quote: order.priceNeedsQuote,
      },
    });
    if (error) {
      throw new Error(`create_public_order: ${error.message}`);
    }
    if (!data || typeof data !== "object" || !("ok" in data)) {
      throw new Error("create_public_order returned an invalid result.");
    }
    const result = data as { ok: boolean; confirmation_token?: string; error?: string };
    if (!result.ok) {
      return badRequest(result.error ?? "That date is no longer available.");
    }
    if (!result.confirmation_token) {
      throw new Error("create_public_order did not return a confirmation token.");
    }

    // A booked cake changes what the public pages show.
    // Next 16 requires a cache profile: "max" serves stale content while the
    // revalidation runs in the background.
    revalidateTag("catalog", "max");

    return NextResponse.json({ ok: true, confirmation_token: result.confirmation_token });
  } catch (e) {
    console.error(`POST /api/orders: ${(e as Error).message}`);
    return internalError();
  }
}
