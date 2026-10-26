import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The production calendar's data (spec §6.2).
 *
 * One row per day: the cakes due that day, the day's capacity use and
 * whether the shop has blocked the date.
 */

export interface CalendarCake {
  orderId: string;
  orderNumber: string;
  itemId: string;
  name: string;
  sizeKg: number | null;
  flavourName: string | null;
  designTierName: string | null;
  status: string;
  fulfilment: "pickup" | "delivery";
  customerName: string;
  /** The customer's reference photo, if they sent one. */
  referencePhoto: string | null;
  /** A quote the shop still has to price. */
  priceNeedsQuote: boolean;
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  blocked: boolean;
  reason: string | null;
  cakes: CalendarCake[];
  /** Cakes booked that day. */
  cakeCount: number;
  /** The shop's daily cake limit. */
  limit: number;
  /** True when the day is completely booked. */
  full: boolean;
}

interface CakeRow {
  id: string;
  order_number: string;
  status: string;
  fulfilment: "pickup" | "delivery";
  price_needs_quote: boolean;
  date_needed: string | null;
  customers: { name: string } | { name: string }[] | null;
  order_items: {
    id: string;
    name: string;
    cake_details:
      | {
          size_kg: number | null;
          flavour_name: string | null;
          design_tier_name: string | null;
          reference_photos: string[] | null;
        }
      | {
          size_kg: number | null;
          flavour_name: string | null;
          design_tier_name: string | null;
          reference_photos: string[] | null;
        }[]
      | null;
  }[];
}

function first<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** The daily cake limit from the shop settings. */
export async function getDailyCakeLimit(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("daily_cake_limit")
    .eq("id", 1)
    .maybeSingle();
  return (data?.daily_cake_limit as number | undefined) ?? 5;
}

/**
 * Every day between `from` and `to` (both YYYY-MM-DD), with the cakes due.
 *
 * Cancelled orders are left out — the shop is not baking them.
 */
export async function getProductionCalendar(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<CalendarDay[]> {
  const limit = await getDailyCakeLimit(supabase);

  const [ordersRes, blockedRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_number, status, fulfilment, price_needs_quote, date_needed,
         customers(name),
         order_items(id, name,
           cake_details(size_kg, flavour_name, design_tier_name, reference_photos))`,
      )
      .gte("date_needed", from)
      .lte("date_needed", to)
      .neq("status", "cancelled"),
    supabase.from("blocked_dates").select("date, reason"),
  ]);

  if (ordersRes.error) {
    throw new Error(`getProductionCalendar/orders: ${ordersRes.error.message}`);
  }
  if (blockedRes.error) {
    throw new Error(`getProductionCalendar/blocked_dates: ${blockedRes.error.message}`);
  }

  const blocked = new Map(
    (blockedRes.data ?? []).map((b) => [b.date as string, (b.reason as string | null) ?? null]),
  );

  const cakesByDate = new Map<string, CalendarCake[]>();
  for (const row of (ordersRes.data ?? []) as unknown as CakeRow[]) {
    const date = row.date_needed;
    if (!date) continue;
    const customer = first(row.customers);
    const list = cakesByDate.get(date) ?? [];
    for (const item of row.order_items ?? []) {
      const detail = first(item.cake_details);
      if (!detail) continue; // a pastry line — not a cake to bake
      list.push({
        orderId: row.id,
        orderNumber: row.order_number,
        itemId: item.id,
        name: item.name,
        sizeKg: detail.size_kg,
        flavourName: detail.flavour_name,
        designTierName: detail.design_tier_name,
        status: row.status,
        fulfilment: row.fulfilment,
        customerName: customer?.name ?? "Customer",
        referencePhoto: detail.reference_photos?.[0] ?? null,
        priceNeedsQuote: row.price_needs_quote,
      });
    }
    cakesByDate.set(date, list);
  }

  const days: CalendarDay[] = [];
  for (const date of eachDate(from, to)) {
    const cakes = cakesByDate.get(date) ?? [];
    const count = cakes.length;
    days.push({
      date,
      blocked: blocked.has(date),
      reason: blocked.get(date) ?? null,
      cakes,
      cakeCount: count,
      limit,
      full: count >= limit,
    });
  }

  return days;
}

/** Every date from `from` to `to`, inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
