import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { todayInKenya } from "./format";
import {
  SALES_WINDOW_DAYS,
  shiftDayKey,
  summariseSales,
  type CatalogueItem,
  type SalesItemRow,
  type SalesOrderRow,
  type SalesPaymentRow,
  type SalesSummary,
} from "./sales-summary";

/**
 * The sales screen's reads (spec §6.2).
 *
 * Runs with the signed-in member's own client, so Row Level Security applies:
 * a manager reads orders, items, payments and the catalogue exactly as the
 * dashboard does, and never touches costs or expenses — those live behind the
 * owner-only finance screen. Nothing this module fetches is role-gated, which
 * is why the same query is safe for both roles.
 */

export type { SalesSummary };

interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string;
  order_items: {
    name: string;
    quantity: number;
    line_total: number;
    product_id: string | null;
    cake_details:
      | { flavour_id: string | null; flavour_name: string | null }
      | { flavour_id: string | null; flavour_name: string | null }[]
      | null;
  }[];
}

function first<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toItem(row: OrderRow["order_items"][number]): SalesItemRow {
  const detail = first(row.cake_details ?? null);
  return {
    name: row.name,
    quantity: row.quantity,
    lineTotal: row.line_total,
    productId: row.product_id,
    flavourId: detail?.flavour_id ?? null,
    flavourName: detail?.flavour_name ?? null,
  };
}

/**
 * Today, this week, this month, the best sellers, the slow movers and the
 * earnings projection.
 *
 * The window is the wider of the last `SALES_WINDOW_DAYS` days and the month
 * so far, so the projection and the rankings are both complete without
 * scanning the whole order history.
 */
export async function getSalesSummary(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<SalesSummary> {
  const todayKey = todayInKenya(now);
  const monthStart = `${todayKey.slice(0, 8)}01`;
  const windowStart = shiftDayKey(todayKey, -(SALES_WINDOW_DAYS - 1));
  const from = new Date(`${windowStart < monthStart ? windowStart : monthStart}T00:00:00Z`);

  const [ordersRes, paymentsRes, productsRes, flavoursRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, status, total, created_at,
         order_items(name, quantity, line_total, product_id,
           cake_details(flavour_id, flavour_name))`,
      )
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true })
      .limit(1000),
    supabase
      .from("payments")
      .select("amount, paid_at")
      .gte("paid_at", from.toISOString())
      .limit(2000),
    supabase.from("products").select("id, name, available").order("name"),
    supabase.from("cake_flavours").select("id, name, available").order("name"),
  ]);

  for (const [label, result] of [
    ["orders", ordersRes],
    ["payments", paymentsRes],
    ["products", productsRes],
    ["cake_flavours", flavoursRes],
  ] as const) {
    if (result.error) {
      throw new Error(`getSalesSummary/${label}: ${result.error.message}`);
    }
  }

  const orders: SalesOrderRow[] = (ordersRes.data ?? []).map((row) => ({
    id: row.id as string,
    status: row.status as string,
    total: row.total as number,
    createdAt: row.created_at as string,
    items: ((row.order_items ?? []) as unknown as OrderRow["order_items"]).map(toItem),
  }));

  const payments: SalesPaymentRow[] = (paymentsRes.data ?? []).map((row) => ({
    amount: row.amount as number,
    paidAt: row.paid_at as string,
  }));

  // Slow movers are catalogue lines: only what the shop can still sell, so
  // switched-off products and flavours stay off the list.
  const catalogue: CatalogueItem[] = [
    ...(productsRes.data ?? [])
      .filter((row) => row.available)
      .map((row) => ({
        key: `product:${row.id as string}`,
        name: row.name as string,
        kind: "pastry" as const,
      })),
    ...(flavoursRes.data ?? [])
      .filter((row) => row.available)
      .map((row) => ({
        key: `flavour:${row.id as string}`,
        name: row.name as string,
        kind: "flavour" as const,
      })),
  ];

  return summariseSales({ orders, payments, catalogue }, now);
}
