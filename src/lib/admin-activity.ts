import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Activity log loader (spec §6.2 — owner only).
 *
 * The activity_log table has superadmin-only RLS (select policy uses
 * `is_superadmin()`), so this query runs with the signed-in owner's own
 * client. A manager would receive an empty set even if they bypassed the
 * path guard.
 *
 * Returns the most recent entries with pagination support.
 */

export interface ActivityEntry {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

export interface ActivityPage {
  entries: ActivityEntry[];
  /** Cursor for the next page (the created_at of the last entry). */
  nextCursor: string | null;
  hasMore: boolean;
}

const PAGE_SIZE = 50;

export async function getActivityLog(
  supabase: SupabaseClient,
  cursor?: string,
): Promise<ActivityPage> {
  let query = supabase
    .from("activity_log")
    .select(
      "id, created_at, user_id, action, table_name, record_id, old_value, new_value, profiles!inner(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getActivityLog: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    created_at: string;
    user_id: string | null;
    action: string;
    table_name: string;
    record_id: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    profiles: { full_name: string | null; email: string | null }[] | null;
  }>;

  const hasMore = rows.length > PAGE_SIZE;
  const entries = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? entries[entries.length - 1].created_at : null;

  return {
    entries: entries.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        createdAt: row.created_at,
        userId: row.user_id,
        userName: profile?.full_name ?? null,
        userEmail: profile?.email ?? null,
        action: row.action,
        tableName: row.table_name,
        recordId: row.record_id,
        oldValue: row.old_value,
        newValue: row.new_value,
      };
    }),
    nextCursor,
    hasMore,
  };
}

/**
 * Human-readable label for an action.
 */
export function formatAction(action: string): string {
  const map: Record<string, string> = {
    order_created: "Order placed",
    order_status_changed: "Order status changed",
    order_price_edited: "Order price edited",
    walk_in_sale: "Walk-in sale",
    date_blocked: "Day closed",
    date_unblocked: "Day opened",
    expense_recorded: "Expense recorded",
    expense_removed: "Expense removed",
    product_updated: "Product updated",
    product_deleted: "Product deleted",
    catalogue_updated: "Catalogue option updated",
    payment_recorded: "Payment recorded",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

/**
 * Human-readable label for a table.
 */
export function formatTable(table: string): string {
  const map: Record<string, string> = {
    orders: "Orders",
    order_items: "Order items",
    payments: "Payments",
    blocked_dates: "Closed days",
    expenses: "Expenses",
    products: "Products",
    cake_flavours: "Cake flavours",
    cake_sizes: "Cake sizes",
    design_tiers: "Design tiers",
    profiles: "Staff",
  };
  return map[table] ?? table;
}