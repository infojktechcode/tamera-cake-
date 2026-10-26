/**
 * Customer statistics — pure, so the client table and the server page share
 * the same arithmetic and the tests need no database.
 */

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  source: "online" | "walk_in";
  consent: boolean;
  createdAt: string;
}

export interface CustomerOrderRow {
  customer_id: string | null;
  total: number;
  status: string;
  created_at: string;
}

export interface CustomerSummary extends CustomerRow {
  /** Orders that were not cancelled. */
  ordersCount: number;
  /** What they have spent, cancelled orders left out. */
  totalSpent: number;
  lastOrderAt: string | null;
  /** More than one order — the shop's repeat customers. */
  repeat: boolean;
}

/**
 * Fold the orders into each customer. Pure, so the arithmetic is tested without
 * a database.
 */
export function summariseCustomers(
  customers: CustomerRow[],
  orders: CustomerOrderRow[],
): CustomerSummary[] {
  const totals = new Map<
    string,
    { count: number; spent: number; last: string | null }
  >();

  for (const order of orders) {
    if (!order.customer_id) continue;
    if (order.status === "cancelled") continue;
    const current = totals.get(order.customer_id) ?? { count: 0, spent: 0, last: null };
    current.count += 1;
    current.spent += order.total;
    if (!current.last || order.created_at > current.last) {
      current.last = order.created_at;
    }
    totals.set(order.customer_id, current);
  }

  return customers.map((customer) => {
    const stats = totals.get(customer.id) ?? { count: 0, spent: 0, last: null };
    return {
      ...customer,
      ordersCount: stats.count,
      totalSpent: stats.spent,
      lastOrderAt: stats.last,
      repeat: stats.count > 1,
    };
  });
}

/** Newest order first, then customers who never ordered, by name. */
export function sortCustomers(list: CustomerSummary[]): CustomerSummary[] {
  return [...list].sort((a, b) => {
    if (a.lastOrderAt && b.lastOrderAt) return b.lastOrderAt.localeCompare(a.lastOrderAt);
    if (a.lastOrderAt) return -1;
    if (b.lastOrderAt) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Search by name or phone. An empty query returns everyone. */
export function filterCustomers(list: CustomerSummary[], query: string): CustomerSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return list;
  return list.filter(
    (customer) =>
      customer.name.toLowerCase().includes(needle) ||
      customer.phone.toLowerCase().includes(needle),
  );
}
