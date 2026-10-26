import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateKenya, formatKES } from "@/lib/format";
import { SALES_WINDOW_DAYS, type SalesPeriod, type SalesSummary } from "@/lib/sales-summary";

/**
 * The sales screen (spec §6.2): today, this week and this month, the average
 * order value, the best sellers and slow movers, and the earnings projection
 * with its plain-language sentence.
 *
 * Presentational only — the arithmetic lives in `sales-summary.ts`, so this
 * component renders the numbers it is given. Cost prices and profit never
 * reach this screen; the owner's finance screen is a separate page.
 */

interface Props {
  summary: SalesSummary;
}

function PeriodCard({
  title,
  hint,
  period,
}: {
  title: string;
  hint: string;
  period: SalesPeriod;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-1">
        <CardDescription className="text-xs">{title}</CardDescription>
        <CardTitle className="text-xl">{formatKES(period.sales)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5 p-4 pt-0 text-xs text-ink-muted">
        <p>
          {period.orders} order{period.orders === 1 ? "" : "s"} · {formatKES(period.paid)} paid
        </p>
        <p>{hint}</p>
      </CardContent>
    </Card>
  );
}

export function SalesSummaryView({ summary }: Props) {
  const peak = Math.max(...summary.daily.map((day) => day.sales), 1);

  return (
    <div className="space-y-6">
      <section aria-label="Sales totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PeriodCard
          title="Today"
          hint={formatDateKenya(summary.todayKey)}
          period={summary.today}
        />
        <PeriodCard title="This week" hint="Monday to today" period={summary.week} />
        <PeriodCard
          title="This month"
          hint={summary.projection.monthLabel}
          period={summary.month}
        />
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs">Average order</CardDescription>
            <CardTitle className="text-xl">{formatKES(summary.averageOrderValue)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-ink-muted">
            {summary.month.orders} order{summary.month.orders === 1 ? "" : "s"} this month
          </CardContent>
        </Card>
      </section>

      <Card className="border-pistachio/40 bg-pistachio/10">
        <CardHeader>
          <CardTitle>Earnings projection</CardTitle>
          <CardDescription>
            {summary.projection.monthLabel}: {formatKES(summary.projection.salesSoFar)} so far over{" "}
            {summary.projection.daysElapsed} of {summary.projection.daysInMonth} days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-display text-2xl font-semibold text-cocoa">
            {formatKES(summary.projection.projected)}
          </p>
          <p className="text-sm text-ink-muted">{summary.projection.sentence}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Last 7 days</CardTitle>
          <CardDescription>Booked order value by day, on Nairobi time.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex h-40 items-end gap-2" role="list">
            {summary.daily.map((day) => {
              const height =
                day.sales === 0 ? 4 : Math.max(8, Math.round((day.sales / peak) * 112));
              return (
                <li
                  key={day.day}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 text-center"
                  title={`${day.label}: ${formatKES(day.sales)}`}
                >
                  <span className="text-[10px] whitespace-nowrap text-ink-muted">
                    {day.sales > 0 ? day.sales.toLocaleString("en-KE") : "—"}
                  </span>
                  <div
                    aria-hidden="true"
                    className={`w-full rounded-t-md ${day.sales === 0 ? "bg-cocoa/10" : "bg-strawberry/70"}`}
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[10px] text-ink-muted">{day.label}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best sellers</CardTitle>
            <CardDescription>Last {SALES_WINDOW_DAYS} days, by items sold.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.bestSellers.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No sales in the last {SALES_WINDOW_DAYS} days yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {summary.bestSellers.map((item, index) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-ink-muted">{index + 1}.</span>
                      <span className="truncate">{item.label}</span>
                      <Badge variant={item.kind === "cake" ? "caramel" : "default"}>
                        {item.kind}
                      </Badge>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-semibold">{item.quantity}</span>
                      <span className="ml-1 text-xs text-ink-muted">sold</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slow movers</CardTitle>
            <CardDescription>
              Catalogue lines that sold the least in the last {SALES_WINDOW_DAYS} days —
              including the ones that sold nothing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.slowMovers.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing on the menu yet.</p>
            ) : (
              <ul className="space-y-2">
                {summary.slowMovers.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{item.name}</span>
                      <Badge variant={item.kind === "flavour" ? "caramel" : "default"}>
                        {item.kind}
                      </Badge>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={item.quantity === 0 ? "text-strawberry-deep" : "font-semibold"}>
                        {item.quantity}
                      </span>
                      <span className="ml-1 text-xs text-ink-muted">sold</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
