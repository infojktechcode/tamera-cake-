import { cookies } from "next/headers";

import { ExpenseLog } from "@/components/admin/expense-log";
import { FinanceView } from "@/components/admin/finance-view";
import { can } from "@/lib/permissions";
import { getFinanceSummary } from "@/lib/admin-finance";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Finance screen (spec §6.2): expenses log and profit & loss by day, week
 * and month.
 *
 * Owner only — the path is blocked for managers by the proxy and the nav;
 * this page adds a `can()` check as a second lock, matching the products
 * screen pattern. The loader reads `product_costs` and `expenses`, which
 * both have superadmin-only RLS, so a manager would receive nothing even
 * if they somehow reached the component.
 */
export const instant = false;

export default async function AdminFinancePage() {
  const user = await requireUser();
  if (!can(user.role, "viewExpenses")) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold">Finance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            This section is for the shop owner only.
          </p>
        </header>
        <div className="rounded-xl border border-cocoa/10 bg-vanilla p-6 text-center">
          <p className="text-cocoa">You do not have permission to view finances.</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient(await cookies());
  const { summary, expenses } = await getFinanceSummary(supabase);

  const monthStart = summary.todayKey.slice(0, 8) + "01";
  const monthTotal = expenses
    .filter((e) => e.spentOn >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Finance</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Profit & loss on Nairobi days, plus the expenses log. Cost prices cover
          pastries only — cake flavours have no cost price yet, so cake profit is
          shown as an upper figure.
        </p>
      </header>

      <FinanceView summary={summary} />

      <ExpenseLog expenses={expenses} monthStart={monthStart} monthTotal={monthTotal} />
    </div>
  );
}