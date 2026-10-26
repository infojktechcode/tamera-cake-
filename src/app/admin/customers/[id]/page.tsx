import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { StatusPill } from "@/components/admin/status-pill";
import { getCustomer } from "@/lib/admin-customers";
import { formatDateKenya, formatKES, formatKenyanPhone } from "@/lib/format";
import { isOrderStatus } from "@/lib/order-status";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { waHrefSafe } from "@/lib/whatsapp";

/**
 * One customer's record: who they are, what they have ordered and what they
 * have spent (spec §6.2).
 */
export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCustomerPage({ params }: PageProps) {
  await requireUser();
  const supabase = await createClient(await cookies());

  const { id } = await params;
  const result = await getCustomer(supabase, id);
  if (!result) notFound();

  const { customer, orders } = result;
  const live = orders.filter((o) => o.status !== "cancelled");
  const spent = live.reduce((sum, o) => sum + o.total, 0);
  const last = live[0] ?? null;
  const whatsapp = waHrefSafe(
    customer.phone,
    `Hi ${customer.name.split(" ")[0]}, this is Tamera's Cakes & Bakery.`,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/customers"
            prefetch={false}
            className="text-sm font-medium text-strawberry underline-offset-4 hover:underline"
          >
            ← All customers
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold">{customer.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatKenyanPhone(customer.phone)} · joined {formatDateKenya(customer.createdAt)}
            {live.length > 1 && (
              <span className="ml-2 rounded-full bg-blush px-2 py-0.5 text-[10px] font-semibold text-cocoa">
                repeat customer
              </span>
            )}
            {customer.source === "walk_in" && (
              <span className="ml-2 rounded-full bg-cocoa/10 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                walk-in
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <a
            href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex min-h-11 items-center rounded-full border border-cocoa/20 px-4 text-sm font-medium text-cocoa transition hover:border-cocoa/40"
          >
            Call
          </a>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-full bg-pistachio px-4 text-sm font-semibold text-cocoa transition hover:bg-pistachio/80"
            >
              WhatsApp
            </a>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-cocoa/10 bg-white p-4">
          <dt className="text-xs text-ink-muted">Orders</dt>
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
            {live.length}
          </dd>
        </div>
        <div className="rounded-2xl border border-cocoa/10 bg-white p-4">
          <dt className="text-xs text-ink-muted">Spent</dt>
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
            {formatKES(spent)}
          </dd>
        </div>
        <div className="rounded-2xl border border-cocoa/10 bg-white p-4">
          <dt className="text-xs text-ink-muted">Last order</dt>
          <dd className="mt-1 font-display text-xl font-semibold">
            {last ? formatDateKenya(last.createdAt) : "—"}
          </dd>
        </div>
      </dl>

      {customer.notes && (
        <div className="rounded-2xl border border-cocoa/10 bg-vanilla/50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-cocoa">{customer.notes}</p>
        </div>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold">Order history</h2>
        {orders.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-cocoa/20 bg-white/60 p-6 text-sm text-ink-muted">
            No orders yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-cocoa/10 bg-white p-3"
              >
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-display font-semibold text-cocoa underline-offset-4 hover:underline"
                >
                  {order.orderNumber}
                </Link>
                {isOrderStatus(order.status) && <StatusPill status={order.status} />}
                <span className="text-sm text-ink-muted">
                  {order.dateNeeded ? `for ${formatDateKenya(order.dateNeeded)}` : "no date"}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{formatKES(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!customer.consent && (
        <p className="text-xs text-ink-muted">
          This customer has not agreed to marketing messages — order updates only.
        </p>
      )}
    </div>
  );
}
