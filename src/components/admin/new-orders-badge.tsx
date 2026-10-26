"use client";

import { useNewOrders } from "./new-orders-provider";

/**
 * The badge on the sidebar's "Orders" link.
 *
 * It counts the orders that arrived while the shop was looking at another
 * screen. Colour is never the only signal — the number is written out.
 */
export function NewOrdersBadge() {
  const { count } = useNewOrders();
  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} new order${count === 1 ? "" : "s"}`}
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-strawberry px-1.5 text-[11px] font-bold text-white"
    >
      {count}
    </span>
  );
}
