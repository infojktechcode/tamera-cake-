import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { todayInKenya } from "@/lib/format";
import { getStaffSession } from "@/lib/session";
import { adminReadLimiter } from "@/lib/rate-limit";

const querySchema = z.strictObject({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function nairobiMidnightUtc(day: string): string {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  // Rate limit: 60 read requests per minute per IP
  const rateLimitResult = await adminReadLimiter.check(request.headers);
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds ?? 60) } },
    );
  }

  const session = await getStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (!can(session.user.role, "viewProfit")) {
    return NextResponse.json({ error: "Only the owner can view profit reports." }, { status: 403 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const { from, to } = parsed.data;
  const fromTimestamp = nairobiMidnightUtc(from);
  const untilTimestamp = nairobiMidnightUtc(nextDay(to));

  try {
    // 1. Fetch orders with items (non-cancelled only)
    const { data: orders, error: ordersError } = await session.supabase
      .from("orders")
      .select(`
        id, total, created_at,
        order_items!inner(quantity, line_total, product_id)
      `)
      .gte("created_at", fromTimestamp)
      .lt("created_at", untilTimestamp)
      .neq("status", "cancelled");

    if (ordersError) throw new Error(ordersError.message);

    // 2. Fetch current product costs (superadmin RLS allows this)
    const { data: costs, error: costsError } = await session.supabase
      .from("product_costs")
      .select("product_id, cost_price");

    if (costsError) throw new Error(costsError.message);

    // 3. Build cost lookup map
    const costMap = new Map<string, number>();
    for (const c of costs ?? []) {
      costMap.set(c.product_id, c.cost_price);
    }

    // 4. Compute per-order COGS first (avoids fan-out), then aggregate daily
    const daily = new Map<string, { revenue: number; cogs: number; orders: number; missingCostItems: string[] }>();

    for (const order of orders ?? []) {
      const day = todayInKenya(new Date(order.created_at));
      const bucket = daily.get(day) ?? { revenue: 0, cogs: 0, orders: 0, missingCostItems: [] };

      let orderCogs = 0;
      let orderHasMissingCost = false;

      for (const item of order.order_items ?? []) {
        const cost = costMap.get(item.product_id ?? "");
        if (cost !== undefined && cost !== null) {
          orderCogs += cost * item.quantity;
        } else if (item.product_id) {
          orderHasMissingCost = true;
          bucket.missingCostItems.push(`${item.product_id} (qty ${item.quantity})`);
        }
      }

      bucket.revenue += order.total;
      bucket.cogs += orderCogs;
      bucket.orders += 1;
      daily.set(day, bucket);
    }

    // 5. Format response
    const rows = [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, totals]) => ({
        day,
        orders: totals.orders,
        revenue: totals.revenue,
        cogs: totals.cogs,
        profit: totals.revenue - totals.cogs,
        missingCostItems: totals.missingCostItems.length > 0 ? totals.missingCostItems : undefined,
      }));

    return NextResponse.json(
      { from, to, rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(`GET /api/admin/reports/profit: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Could not load profit report." }, { status: 500 });
  }
}