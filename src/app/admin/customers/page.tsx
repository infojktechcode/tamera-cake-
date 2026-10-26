import { cookies } from "next/headers";

import { CustomersTable } from "@/components/admin/customers-table";
import { listCustomers } from "@/lib/admin-customers";
import { formatKES } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The customer list (spec §6.2).
 *
 * Reads with the signed-in member's own client, so RLS applies.
 */
export const instant = false;

export default async function AdminCustomersPage() {
  await requireUser();
  const supabase = await createClient(await cookies());
  const customers = await listCustomers(supabase);

  const repeat = customers.filter((c) => c.repeat).length;
  const lifetime = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Customers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {customers.length} customer{customers.length === 1 ? "" : "s"} · {repeat} repeat ·{" "}
          {formatKES(lifetime)} lifetime
        </p>
      </header>

      <CustomersTable customers={customers} />
    </div>
  );
}
