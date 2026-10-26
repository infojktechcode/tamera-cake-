import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateKenya, formatKES } from "@/lib/format";
import type { FinanceSummary, Pnl } from "@/lib/finance";

/**
 * Profit & loss for today, this week and this month (spec §6.2), plus the
 * seven-day daily table. Owner only — the page, the proxy and RLS all gate
 * before this component is reached.
 *
 * Presentational: every figure is computed in `finance.ts` and fetched by
 * `admin-finance.ts`. The one thing this screen must never do is imply more
 * precision than the database holds, so the cost coverage sits next to the
 * profit it qualifies, in words, before the number itself.
 */

interface Props {
  summary: FinanceSummary;
}

function coverageNote(pnl: Pnl): string | null {
  if (!pnl.partialCosts) return null;
  const pct = Math.round(pnl.coverage * 100);
  return `Cost prices cover ${pct}% of this period's sales. Cake flavours have no cost price yet, so their ingredient cost is not subtracted — the profit below is an upper figure until flavours carry one.`;
}

function PnlCard({ title, hint, pnl }: { title: string; hint: string; pnl: Pnl }) {
  const note = coverageNote(pnl);
  const negative = pnl.netProfit < 0;

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardDescription className="text-xs">{title}</CardDescription>
        <CardTitle
          className={`text-xl ${negative ? "text-strawberry-deep" : "text-cocoa"}`}
        >
          {formatKES(pnl.netProfit)}
        </CardTitle>
        <p className="text-[11px] text-ink-muted">net profit</p>
      </CardHeader>
      <CardContent className="space-y-1 p-4 pt-0 text-xs">
        <dl className="space-y-1 text-ink-muted">
          <div className="flex justify-between gap-3">
            <dt>Sales</dt>
            <dd className="font-medium text-cocoa">{formatKES(pnl.revenue)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Cost of goods</dt>
            <dd className="font-medium text-cocoa">−{formatKES(pnl.costOfGoods)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Gross profit</dt>
            <dd className="font-medium text-cocoa">{formatKES(pnl.grossProfit)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Expenses</dt>
            <dd className="font-medium text-cocoa">−{formatKES(pnl.expenses)}</dd>
          </div>
        </dl>
        <p className="pt-1 text-[11px] text-ink-muted">
          {pnl.orders} order{pnl.orders === 1 ? "" : "s"} · {hint}
        </p>
        {note && (
          <p className="rounded-xl bg-vanilla p-2 text-[11px] leading-snug text-cocoa/80">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function FinanceView({ summary }: Props) {
  return (
    <div className="space-y-6">
      <section aria-label="Profit and loss" className="grid gap-3 lg:grid-cols-3">
        <PnlCard
          title="Today"
          hint={formatDateKenya(summary.todayKey)}
          pnl={summary.day}
        />
        <PnlCard title="This week" hint="Monday to today" pnl={summary.week} />
        <PnlCard title="This month" hint="Month to date" pnl={summary.month} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Last 7 days</CardTitle>
          <CardDescription>
            Sales, expenses and profit by day, on Nairobi time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-cocoa/10 text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 font-medium">
                    Day
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Sales
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Expenses
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.daily.map((day) => (
                  <tr key={day.day} className="border-b border-cocoa/5">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span>{day.label}</span>
                        <span className="text-xs text-ink-muted">
                          {day.day.slice(8)}/{day.day.slice(5, 7)}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 text-right">{formatKES(day.revenue)}</td>
                    <td className="py-2 text-right">
                      {day.expenses > 0 ? (
                        <span className="text-strawberry-deep">
                          −{formatKES(day.expenses)}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td
                      className={`py-2 text-right font-medium ${
                        day.netProfit < 0 ? "text-strawberry-deep" : "text-cocoa"
                      }`}
                    >
                      {formatKES(day.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            <Badge variant="caramel">costs partial</Badge>
            Pastry sales are costed from the product cost price; cake sales are
            not costed yet. Cancelled orders are excluded throughout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
