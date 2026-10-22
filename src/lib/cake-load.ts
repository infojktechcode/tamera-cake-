import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How many cakes are already booked for a date.
 *
 * The capacity check (spec §5) has to work before an order exists, on the
 * public route, with the service client — so the count is computed from the
 * tables here instead of through the `cake_load_for_date` SQL function.
 *
 * Why not the function: PostgREST matches RPC arguments by the *parameter
 * name* declared in SQL, and the live database's function is declared as
 * `cake_load_for_date(d date)`. Calling it with `{ date: ... }` fails with
 * PGRST202, and a 500 on the order route means the shop cannot take any
 * orders at all. Three indexed queries are cheap and cannot break that way.
 *
 * The counting rule matches the function: every cake on a non-cancelled order
 * for that date holds a slot, whatever the order's status.
 */
export async function countCakesForDate(
  service: SupabaseClient,
  date: string,
): Promise<number> {
  const { data: orders, error: ordersError } = await service
    .from("orders")
    .select("id")
    .eq("date_needed", date)
    .neq("status", "cancelled");

  if (ordersError) {
    throw new Error(`countCakesForDate/orders: ${ordersError.message}`);
  }
  if (!orders || orders.length === 0) return 0;

  const { data: items, error: itemsError } = await service
    .from("order_items")
    .select("id")
    .in(
      "order_id",
      orders.map((o) => o.id as string),
    );

  if (itemsError) {
    throw new Error(`countCakesForDate/order_items: ${itemsError.message}`);
  }
  if (!items || items.length === 0) return 0;

  const { count, error: countError } = await service
    .from("cake_details")
    .select("order_item_id", { count: "exact", head: true })
    .in(
      "order_item_id",
      items.map((i) => i.id as string),
    );

  if (countError) {
    throw new Error(`countCakesForDate/cake_details: ${countError.message}`);
  }

  return count ?? 0;
}
