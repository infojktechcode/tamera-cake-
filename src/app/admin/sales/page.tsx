import { cookies } from "next/headers";

import { SalesSummaryView } from "@/components/admin/sales-summary";
import { getSalesSummary } from "@/lib/admin-sales";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The sales screen (spec §6.2): sales today, this week and this month, the
 * average order value, the best sellers and slow movers, and the earnings
 * projection with a plain-language sentence.
 *
 * Sales figures and the projection are a manager-level view (spec §3) — the
 * path is open to both roles and the query only touches orders, items,
 * payments and the catalogue, which RLS already allows either role to read.
 * Cost prices and profit live on the owner-only finance screen.
 */
export const instant = false;

export default async function AdminSalesPage() {
  await requireUser();
  const supabase = await createClient(await cookies());
  const summary = await getSalesSummary(supabase);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Sales</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Booked sales, money paid in, what sells and what does not — plus where the month is
          heading.
        </p>
      </header>

      <SalesSummaryView summary={summary} />
    </div>
  );
}
