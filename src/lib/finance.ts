import { todayInKenya } from "./format";
import { SALES_WINDOW_DAYS, shiftDayKey, weekStartOn } from "./sales-summary";

/**
 * Profit & loss for the finance screen (spec §6.2: "expenses log and profit
 * and loss by day, week and month"). Owner-only — nothing in here may reach a
 * manager, so the page, the loader and the API all check the role first.
 *
 * **The cost of goods is only partly knowable.** `product_costs` carries a
 * cost price for every product (pastries and showcase cakes), but a cake
 * ordered through the builder is a flavour + size + tier and flavours have no
 * cost column — the database simply does not record what a cake costs to
 * make. Rather than invent a number, this module reports the *coverage*: the
 * share of line revenue whose cost price is known. Profit is labelled and
 * shown alongside that coverage, so an upper figure can never be read as an
 * exact one.
 *
 * Money is integer shillings throughout. Every figure is pure and tested;
 * `admin-finance.ts` does the fetching.
 */

export interface FinanceLine {
  productId: string | null;
  quantity: number;
  lineTotal: number;
}

export interface FinanceOrder {
  id: string;
  status: string;
  /** Order total, delivery fee included — the income the shop booked. */
  total: number;
  createdAt: string;
  lines: FinanceLine[];
}

export interface FinanceCost {
  productId: string;
  costPrice: number;
}

export interface FinanceExpense {
  id: string;
  /** The day it was spent, YYYY-MM-DD. */
  spentOn: string;
  category: string;
  description: string | null;
  amount: number;
}

export interface Pnl {
  /** Booked income, cancelled orders left out. */
  revenue: number;
  /** Quantity × known cost price, pastry lines only. */
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  orders: number;
  /**
   * Share of line revenue whose cost price is known (0…1). The rest is cake
   * revenue, which has no recorded cost, so `netProfit` counts it in full.
   */
  coverage: number;
  /** True when some line revenue has no known cost. */
  partialCosts: boolean;
}

export interface DailyPnl {
  day: string;
  label: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface FinanceSummary {
  todayKey: string;
  day: Pnl;
  week: Pnl;
  month: Pnl;
  /** The last seven days, oldest first, for the daily table. */
  daily: DailyPnl[];
}

export interface FinanceInput {
  orders: FinanceOrder[];
  costs: FinanceCost[];
  expenses: FinanceExpense[];
}

const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

function emptyPnl(): Pnl {
  return {
    revenue: 0,
    costOfGoods: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    orders: 0,
    coverage: 1,
    partialCosts: false,
  };
}

/** Nairobi day key of an expense's date — `spent_on` is already a plain date. */
function inRange(dayKey: string, from: string, to: string): boolean {
  return dayKey >= from && dayKey <= to;
}

function dayLabel(dayKey: string): string {
  return WEEKDAY_LABEL.format(new Date(`${dayKey}T00:00:00Z`));
}

export function summariseFinance(input: FinanceInput, now: Date = new Date()): FinanceSummary {
  const todayKey = todayInKenya(now);
  const weekStart = weekStartOn(todayKey);
  const monthStart = `${todayKey.slice(0, 8)}01`;
  const windowStart = shiftDayKey(todayKey, -(SALES_WINDOW_DAYS - 1));
  const fetchFrom = windowStart < monthStart ? windowStart : monthStart;

  const costByProduct = new Map<string, number>();
  for (const cost of input.costs) {
    costByProduct.set(cost.productId, cost.costPrice);
  }

  const live = input.orders.filter((order) => order.status !== "cancelled");

  const day = emptyPnl();
  const week = emptyPnl();
  const month = emptyPnl();

  const tally = (pnl: Pnl, order: FinanceOrder, periodStart: string) => {
    if (!inRange(todayInKenya(new Date(order.createdAt)), periodStart, todayKey)) return;
    pnl.revenue += order.total;
    pnl.orders += 1;
    for (const line of order.lines) {
      const cost = line.productId ? costByProduct.get(line.productId) : undefined;
      if (cost === undefined) continue;
      pnl.costOfGoods += cost * line.quantity;
    }
  };

  for (const order of live) {
    tally(day, order, todayKey);
    tally(week, order, weekStart);
    tally(month, order, monthStart);
  }

  // Expenses are spent on a plain calendar day, so no timezone maths.
  const expensesByDay = new Map<string, number>();
  for (const expense of input.expenses) {
    expensesByDay.set(expense.spentOn, (expensesByDay.get(expense.spentOn) ?? 0) + expense.amount);
    if (expense.spentOn === todayKey) day.expenses += expense.amount;
    if (inRange(expense.spentOn, weekStart, todayKey)) week.expenses += expense.amount;
    if (inRange(expense.spentOn, monthStart, todayKey)) month.expenses += expense.amount;
  }

  // Coverage: of the line revenue we can see in the period, how much belongs
  // to a product that has a cost price? Delivery fees and cake lines are
  // revenue with no known cost.
  const coverageFor = (pnl: Pnl, periodStart: string) => {
    let costed = 0;
    let lines = 0;
    for (const order of live) {
      if (!inRange(todayInKenya(new Date(order.createdAt)), periodStart, todayKey)) continue;
      for (const line of order.lines) {
        lines += line.lineTotal;
        if (line.productId && costByProduct.has(line.productId)) costed += line.lineTotal;
      }
    }
    pnl.coverage = lines === 0 ? 1 : costed / lines;
    pnl.partialCosts = lines > 0 && costed < lines;
    pnl.grossProfit = pnl.revenue - pnl.costOfGoods;
    pnl.netProfit = pnl.grossProfit - pnl.expenses;
  };
  coverageFor(day, todayKey);
  coverageFor(week, weekStart);
  coverageFor(month, monthStart);

  // The daily table: revenue and expenses by day for the last seven days.
  const revenueByDay = new Map<string, { revenue: number; cost: number }>();
  for (const order of live) {
    const dayKey = todayInKenya(new Date(order.createdAt));
    if (dayKey < fetchFrom || dayKey > todayKey) continue;
    const bucket = revenueByDay.get(dayKey) ?? { revenue: 0, cost: 0 };
    bucket.revenue += order.total;
    for (const line of order.lines) {
      const cost = line.productId ? costByProduct.get(line.productId) : undefined;
      if (cost !== undefined) bucket.cost += cost * line.quantity;
    }
    revenueByDay.set(dayKey, bucket);
  }

  const daily: DailyPnl[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayKey = shiftDayKey(todayKey, -offset);
    const revenue = revenueByDay.get(dayKey);
    const expenses = expensesByDay.get(dayKey) ?? 0;
    const net = (revenue?.revenue ?? 0) - (revenue?.cost ?? 0) - expenses;
    daily.push({
      day: dayKey,
      label: dayLabel(dayKey),
      revenue: revenue?.revenue ?? 0,
      expenses,
      netProfit: net,
    });
  }

  return { todayKey, day, week, month, daily };
}
