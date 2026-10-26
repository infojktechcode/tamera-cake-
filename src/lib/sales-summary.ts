import { formatKES, todayInKenya } from "./format";

/**
 * The sales summary (spec §6.2): sales today, this week and this month, the
 * average order value, the best sellers and slow movers, and the earnings
 * projection ("sales so far divided by days elapsed, times days in month,
 * with a plain-language sentence").
 *
 * Everything here is pure — the server loader (`admin-sales.ts`) fetches the
 * rows, this module does the arithmetic, and the tests need no database.
 *
 * Two separate money ideas, both shown on the screen:
 *
 *   - **sales** is what the shop has *booked*: order totals, cancelled orders
 *     left out, bucketed by the Nairobi day the order was placed;
 *   - **paid** is what has actually *come in*: payments recorded in that
 *     window, refunds included (they are negative amounts).
 *
 * The screen never shows a cost price or a profit — those belong to the
 * finance screen, which is owner-only (spec §3).
 */

export interface SalesItemRow {
  name: string;
  quantity: number;
  lineTotal: number;
  /** Pastries carry their product; cakes carry their flavour instead. */
  productId: string | null;
  flavourId: string | null;
  flavourName: string | null;
}

export interface SalesOrderRow {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: SalesItemRow[];
}

export interface SalesPaymentRow {
  amount: number;
  paidAt: string;
}

/** One catalogue line that can be a slow mover. */
export interface CatalogueItem {
  key: string;
  name: string;
  kind: "pastry" | "flavour";
}

export interface SalesInput {
  orders: SalesOrderRow[];
  payments: SalesPaymentRow[];
  catalogue: CatalogueItem[];
}

export interface SalesPeriod {
  /** Booked order value, cancelled orders left out. */
  sales: number;
  orders: number;
  /** Payments recorded in the window, refunds included. */
  paid: number;
}

export interface DailySales {
  /** YYYY-MM-DD on the shop's clock. */
  day: string;
  /** Short label, e.g. "Tue 21". */
  label: string;
  sales: number;
}

export interface RankedItem {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
  kind: "cake" | "pastry";
}

export interface SlowItem {
  key: string;
  name: string;
  kind: "pastry" | "flavour";
  quantity: number;
}

export interface SalesProjection {
  salesSoFar: number;
  daysElapsed: number;
  daysInMonth: number;
  /** Average sales per day so far. */
  perDay: number;
  /** salesSoFar / daysElapsed * daysInMonth. */
  projected: number;
  monthLabel: string;
  sentence: string;
}

export interface SalesSummary {
  /** Today on the shop's clock, YYYY-MM-DD. */
  todayKey: string;
  today: SalesPeriod;
  week: SalesPeriod;
  month: SalesPeriod;
  averageOrderValue: number;
  daily: DailySales[];
  bestSellers: RankedItem[];
  slowMovers: SlowItem[];
  projection: SalesProjection;
}

/** How far back the best-seller and slow-mover lists look. */
export const SALES_WINDOW_DAYS = 30;

const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_LABEL = new Intl.DateTimeFormat("en-KE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Move a YYYY-MM-DD day key by `delta` days. */
export function shiftDayKey(dayKey: string, delta: number): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** The Monday of the week that contains `dayKey` (Monday-to-Sunday weeks). */
export function weekStartOn(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  // getUTCDay(): 0 = Sunday. Shift so Monday is 0.
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function inRange(dayKey: string, from: string, to: string): boolean {
  return dayKey >= from && dayKey <= to;
}

/** "Tue 21" — the label used on the seven-day strip. */
function dayLabel(dayKey: string): string {
  return WEEKDAY_LABEL.format(new Date(`${dayKey}T00:00:00Z`));
}

function emptyPeriod(): SalesPeriod {
  return { sales: 0, orders: 0, paid: 0 };
}

export function summariseSales(input: SalesInput, now: Date = new Date()): SalesSummary {
  const todayKey = todayInKenya(now);
  const weekStart = weekStartOn(todayKey);
  const monthStart = `${todayKey.slice(0, 8)}01`;
  const windowStart = shiftDayKey(todayKey, -(SALES_WINDOW_DAYS - 1));

  const live = input.orders.filter((order) => order.status !== "cancelled");

  const today = emptyPeriod();
  const week = emptyPeriod();
  const month = emptyPeriod();

  for (const order of live) {
    const dayKey = todayInKenya(new Date(order.createdAt));
    if (dayKey === todayKey) {
      today.sales += order.total;
      today.orders += 1;
    }
    if (inRange(dayKey, weekStart, todayKey)) {
      week.sales += order.total;
      week.orders += 1;
    }
    if (inRange(dayKey, monthStart, todayKey)) {
      month.sales += order.total;
      month.orders += 1;
    }
  }

  for (const payment of input.payments) {
    const dayKey = todayInKenya(new Date(payment.paidAt));
    if (dayKey === todayKey) today.paid += payment.amount;
    if (inRange(dayKey, weekStart, todayKey)) week.paid += payment.amount;
    if (inRange(dayKey, monthStart, todayKey)) month.paid += payment.amount;
  }

  // --- the seven-day strip (oldest first) ---
  const salesByDay = new Map<string, number>();
  for (const order of live) {
    const dayKey = todayInKenya(new Date(order.createdAt));
    salesByDay.set(dayKey, (salesByDay.get(dayKey) ?? 0) + order.total);
  }
  const daily: DailySales[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayKey = shiftDayKey(todayKey, -offset);
    daily.push({
      day: dayKey,
      label: dayLabel(dayKey),
      sales: salesByDay.get(dayKey) ?? 0,
    });
  }

  // --- best sellers: items sold in the window, ranked by quantity ---
  const ranked = new Map<string, RankedItem>();
  for (const order of live) {
    const dayKey = todayInKenya(new Date(order.createdAt));
    if (dayKey < windowStart) continue;
    for (const item of order.items) {
      const key = item.flavourId
        ? `flavour:${item.flavourId}`
        : item.productId
          ? `product:${item.productId}`
          : `name:${item.name}`;
      const label = item.flavourName ?? item.name;
      const kind: "cake" | "pastry" = item.flavourName ? "cake" : "pastry";
      const current = ranked.get(key) ?? { key, label, quantity: 0, revenue: 0, kind };
      current.quantity += item.quantity;
      current.revenue += item.lineTotal;
      ranked.set(key, current);
    }
  }
  const bestSellers = [...ranked.values()]
    .filter((item) => item.quantity > 0)
    // A line with no product id (an order placed before the catalogue link
    // existed, or a cake) keys on its name instead, so two entries can show
    // the same label. Readers see one product, so rank it as one.
    .reduce<RankedItem[]>((merged, item) => {
      const existing = merged.find(
        (entry) => entry.kind === item.kind && entry.label === item.label,
      );
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.revenue;
      } else {
        merged.push({ ...item });
      }
      return merged;
    }, [])
    .sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.revenue - a.revenue ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 5);

  // --- slow movers: catalogue lines that barely sold (zero included) ---
  const soldByKey = new Map<string, number>();
  // A line with no product id still names a catalogue product; count it there
  // so a stray unlinked row cannot make a seller look like a slow mover.
  const keyByName = new Map(
    input.catalogue.map((entry) => [entry.name.trim().toLowerCase(), entry.key]),
  );
  const countFor = (key: string | null, name: string, quantity: number) => {
    const target = key ?? keyByName.get(name.trim().toLowerCase());
    if (!target) return;
    soldByKey.set(target, (soldByKey.get(target) ?? 0) + quantity);
  };
  for (const order of live) {
    const dayKey = todayInKenya(new Date(order.createdAt));
    if (dayKey < windowStart) continue;
    for (const item of order.items) {
      countFor(item.productId ? `product:${item.productId}` : null, item.name, item.quantity);
      if (item.flavourId) {
        const key = `flavour:${item.flavourId}`;
        soldByKey.set(key, (soldByKey.get(key) ?? 0) + item.quantity);
      }
    }
  }
  const slowMovers = input.catalogue
    .map((item) => ({ ...item, quantity: soldByKey.get(item.key) ?? 0 }))
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name))
    .slice(0, 5);

  // --- earnings projection: sales so far / days elapsed * days in month ---
  const year = Number(todayKey.slice(0, 4));
  const monthNumber = Number(todayKey.slice(5, 7));
  const daysElapsed = Number(todayKey.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const perDay = Math.round(month.sales / daysElapsed);
  const projected = Math.round((month.sales / daysElapsed) * daysInMonth);
  const monthLabel = MONTH_LABEL.format(Date.UTC(year, monthNumber - 1, 1));

  const sentence =
    month.sales === 0
      ? `No sales yet this month — the projection appears with the first order.`
      : `Sales are running at about ${formatKES(perDay)} a day; at this pace ${monthLabel} will finish at ${formatKES(projected)}.`;

  return {
    todayKey,
    today,
    week,
    month,
    averageOrderValue: month.orders > 0 ? Math.round(month.sales / month.orders) : 0,
    daily,
    bestSellers,
    slowMovers,
    projection: {
      salesSoFar: month.sales,
      daysElapsed,
      daysInMonth,
      perDay,
      projected,
      monthLabel,
      sentence,
    },
  };
}
