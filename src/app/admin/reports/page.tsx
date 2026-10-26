import { ReportsExport } from "@/components/admin/reports-export";
import { can } from "@/lib/permissions";
import { todayInKenya } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function ReportsPage() {
  const user = await requireUser();
  if (!can(user.role, "exportReports")) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p role="alert" className="rounded-xl bg-vanilla p-4 text-sm">
          Only the shop owner can export reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Export sales, orders, customers or expenses for a selected period.
        </p>
      </header>
      <ReportsExport today={todayInKenya()} />
    </div>
  );
}
