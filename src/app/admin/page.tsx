import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

/**
 * Admin overview — Phase 1 placeholder.
 *
 * The KPI cards (new orders, cakes due today, sales today, balance owed) get
 * wired to real queries once the orders module lands; the profit card only
 * renders for the owner.
 */
const kpis = [
  { label: "New orders", value: "—", hint: "Arrived since yesterday" },
  { label: "Cakes due today", value: "—", hint: "In production + ready" },
  { label: "Sales today", value: "KES —", hint: "All payment methods" },
  { label: "Balance owed", value: "KES —", hint: "Unpaid order balances" },
];

export const instant = false;

export default async function AdminOverviewPage() {
  const user = await requireUser();
  const showProfit = can(user.role, "viewProfit");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-ink-muted">
            Welcome back, {user.fullName.split(" ")[0]}.
          </p>
        </div>
        <Badge variant="strawberry" className="capitalize">
          {user.role}
        </Badge>
      </header>

      <section
        aria-label="Key numbers"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs">{kpi.label}</CardDescription>
              <CardTitle className="text-xl">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-ink-muted">
              {kpi.hint}
            </CardContent>
          </Card>
        ))}
      </section>

      {showProfit ? (
        <Card className="border-pistachio/40 bg-pistachio/10">
          <CardHeader>
            <CardTitle>Profit (owner view)</CardTitle>
            <CardDescription>
              Cost prices, profit &amp; loss and expenses appear here once the
              finance module lands.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Newest orders</CardTitle>
          <CardDescription>
            The order list arrives with the orders module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-10 rounded-2xl bg-cocoa/5" />
          <div className="h-10 rounded-2xl bg-cocoa/5" />
          <div className="h-10 rounded-2xl bg-cocoa/5" />
        </CardContent>
      </Card>
    </div>
  );
}
