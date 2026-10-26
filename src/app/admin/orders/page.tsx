import { cookies } from "next/headers";

import { OrdersBoard } from "@/components/admin/orders-board";
import { listOrders } from "@/lib/admin-orders";
import { getMessageTemplates } from "@/lib/message-templates";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The orders board (spec §6.2).
 *
 * Staff-only: the admin layout already guards the section, and this page
 * reads the orders with the signed-in member's own client, so RLS applies.
 */
export const instant = false;

export default async function AdminOrdersPage() {
  const user = await requireUser();
  const supabase = await createClient(await cookies());

  const [orders, templates] = await Promise.all([
    listOrders(supabase),
    getMessageTemplates(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Orders</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Newest first. Open an order to see the cake details, photos and payments.
          </p>
        </div>
      </header>

      <OrdersBoard
        initialOrders={orders}
        templates={templates as unknown as Record<string, string>}
        role={user.role}
      />
    </div>
  );
}
