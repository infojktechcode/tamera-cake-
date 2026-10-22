import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderDetailPanel } from "@/components/admin/order-detail-panel";
import { getOrderDetail } from "@/lib/admin-orders";
import { getMessageTemplates } from "@/lib/message-templates";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * One order (spec §6.2): items, cake details with the reference photos, the
 * payments panel, the notes and the activity trail, plus the WhatsApp
 * templates the shop uses to talk to the customer.
 */
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const supabase = await createClient(await cookies());
  const [order, templates] = await Promise.all([
    getOrderDetail(supabase, id),
    getMessageTemplates(),
  ]);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/orders"
          className="text-sm font-medium text-strawberry underline underline-offset-4"
        >
          ← All orders
        </Link>
      </div>

      <OrderDetailPanel
        order={order}
        templates={templates as unknown as Record<string, string>}
        role={user.role}
      />
    </div>
  );
}
