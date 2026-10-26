import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { todayInKenya } from "./format";
import {
  summariseFinance,
  type FinanceCost,
  type FinanceExpense,
  type FinanceOrder,
  type FinanceSummary,
} from "./finance";
import { SALES_WINDOW_DAYS, shiftDayKey } from "./sales-summary";

/**
 * The finance screen's reads (spec §6.2 — owner only).
 *
 * Every table here (`product_costs`, `expenses`) is behind superadmin-only
 * Row Level Security, so this loader runs with the signed-in owner's own
 * client and a manager would receive nothing even if the page guard were
 * bypassed. The page checks `can(role, "viewExpenses")` first; this module
 * trusts RLS as the second lock, exactly like the products screen.
 *
 * The window is the wider of the last `SALES_WINDOW_DAYS` days and the month
 * so far — the month P&L and the seven-day table are then both complete.
 */

export type { FinanceSummary };

interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string;
  order_items: { quantity: number; line_total: number; product_id: string | null }[];
}

/**
 * Profit & loss for today, this week and this month, plus the seven-day
 * daily table and the expenses the P&L buckets were built from (the screen
 * renders them as the log, so they are fetched once).
 */
export async function getFinanceSummary(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ summary: FinanceSummary; expenses: FinanceExpense[] }> {
  const todayKey = todayInKenya(now);
  const monthStart = `${todayKey.slice(0, 8)}01`;
  const windowStart = shiftDayKey(todayKey, -(SALES_WINDOW_DAYS - 1));
  const from = new Date(`${windowStart < monthStart ? windowStart : monthStart}T00:00:00Z`);

  const [ordersRes, costsRes, expensesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total, created_at, order_items(quantity, line_total, product_id)")
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true })
      .limit(1000),
    supabase.from("product_costs").select("product_id, cost_price"),
    supabase
      .from("expenses")
      .select("id, spent_on, category, description, amount")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  for (const [label, result] of [
    ["orders", ordersRes],
    ["costs", costsRes],
    ["expenses", expensesRes],
  ] as const) {
    if (result.error) {
      throw new Error(`getFinanceSummary/${label}: ${result.error.message}`);
    }
  }

  const orders: FinanceOrder[] = (ordersRes.data ?? []).map((row) => ({
    id: row.id as string,
    status: row.status as string,
    total: row.total as number,
    createdAt: row.created_at as string,
    lines: ((row.order_items ?? []) as unknown as OrderRow["order_items"]).map((item) => ({
      productId: item.product_id,
      quantity: item.quantity,
      lineTotal: item.line_total,
    })),
  }));

  const costs: FinanceCost[] = (costsRes.data ?? []).map((row) => ({
    productId: row.product_id as string,
    costPrice: row.cost_price as number,
  }));

  const expenses: FinanceExpense[] = (expensesRes.data ?? []).map((row) => ({
    id: row.id as string,
    spentOn: row.spent_on as string,
    category: row.category as string,
    description: row.description,
    amount: row.amount as number,
  }));

  return { summary: summariseFinance({ orders, costs, expenses }, now), expenses };
}
