import { describe, expect, it } from "vitest";

import {
  summariseFinance,
  type FinanceCost,
  type FinanceExpense,
  type FinanceOrder,
} from "./finance";

// Wednesday 28 October 2026 — mid-week, mid-month, so every boundary (day,
// Monday-start week, month) is exercised by the same fixture.
const NOW = new Date("2026-10-28T09:00:00.000Z");
const TODAY = "2026-10-28";
const WEEK_START = "2026-10-26"; // Monday

function line(overrides: Partial<FinanceOrder["lines"][number]> = {}) {
  return {
    productId: "p-donut" as string | null,
    quantity: 1,
    lineTotal: 600,
    ...overrides,
  };
}

function order(overrides: Partial<FinanceOrder> = {}): FinanceOrder {
  return {
    id: "o1",
    status: "confirmed",
    total: 600,
    createdAt: `${TODAY}T08:00:00.000Z`,
    lines: [line()],
    ...overrides,
  };
}

function expense(overrides: Partial<FinanceExpense> = {}): FinanceExpense {
  return {
    id: "e1",
    spentOn: TODAY,
    category: "Ingredients",
    description: null,
    amount: 1200,
    ...overrides,
  };
}

const costs: FinanceCost[] = [{ productId: "p-donut", costPrice: 240 }];

describe("summariseFinance — period boundaries (Africa/Nairobi)", () => {
  it("counts an order made today in day, week and month", () => {
    const out = summariseFinance({ orders: [order()], costs, expenses: [] }, NOW);
    expect(out.todayKey).toBe(TODAY);
    expect(out.day.revenue).toBe(600);
    expect(out.week.revenue).toBe(600);
    expect(out.month.revenue).toBe(600);
    expect(out.day.orders).toBe(1);
  });

  it("keeps an order from Monday out of today but inside the week", () => {
    const monday = order({ id: "o-mon", createdAt: "2026-10-26T10:00:00.000Z" });
    const out = summariseFinance({ orders: [monday], costs, expenses: [] }, NOW);
    expect(out.day.revenue).toBe(0);
    expect(out.week.revenue).toBe(600);
    expect(out.month.revenue).toBe(600);
  });

  it("keeps an order from last month out of every period", () => {
    const lastMonth = order({ id: "o-sep", createdAt: "2026-09-30T10:00:00.000Z" });
    const out = summariseFinance({ orders: [lastMonth], costs, expenses: [] }, NOW);
    expect(out.day.revenue).toBe(0);
    expect(out.week.revenue).toBe(0);
    expect(out.month.revenue).toBe(0);
    // …but the daily table still shows it when it falls inside the 7-day strip.
    expect(out.daily.every((d) => d.revenue === 0)).toBe(true);
  });

  it("excludes cancelled orders from every period", () => {
    const cancelled = order({ id: "o-x", status: "cancelled" });
    const out = summariseFinance({ orders: [cancelled], costs, expenses: [] }, NOW);
    expect(out.day.revenue).toBe(0);
    expect(out.week.revenue).toBe(0);
    expect(out.month.revenue).toBe(0);
    expect(out.day.orders).toBe(0);
  });

  it("places a Nairobi-morning order on the right day", () => {
    // 03:00 UTC on the 28th is 06:00 Nairobi on the 28th — same day, but a
    // 21:00 UTC order on the 27th is already the 28th in Nairobi (24:00).
    const lateNight = order({
      id: "o-late",
      createdAt: "2026-10-27T21:30:00.000Z", // 00:30 Nairobi, 28 Oct
    });
    const out = summariseFinance({ orders: [lateNight], costs, expenses: [] }, NOW);
    expect(out.day.revenue).toBe(600);
    expect(out.daily.at(-1)?.revenue).toBe(600);
  });
});

describe("summariseFinance — cost of goods and coverage", () => {
  it("costs pastry lines at quantity × known cost price", () => {
    const pastry = order({
      total: 1800,
      lines: [line({ quantity: 3, lineTotal: 1800 })],
    });
    const out = summariseFinance({ orders: [pastry], costs, expenses: [] }, NOW);
    expect(out.month.costOfGoods).toBe(720); // 3 × 240
    expect(out.month.grossProfit).toBe(1800 - 720);
    expect(out.month.coverage).toBe(1);
    expect(out.month.partialCosts).toBe(false);
  });

  it("reports partial coverage when a line has no cost price (cake lines)", () => {
    const cake = order({
      id: "o-cake",
      total: 4500,
      lines: [line({ productId: null, quantity: 1, lineTotal: 4500 })],
    });
    const pastry = order({
      id: "o-pastry",
      total: 1200,
      lines: [line({ productId: "p-donut", quantity: 2, lineTotal: 1200 })],
    });
    const out = summariseFinance({ orders: [cake, pastry], costs, expenses: [] }, NOW);
    expect(out.month.revenue).toBe(5700);
    expect(out.month.costOfGoods).toBe(480); // only the donuts are costed
    // coverage = 1200 costed / 5700 of all line revenue
    expect(out.month.coverage).toBeCloseTo(1200 / 5700, 5);
    expect(out.month.partialCosts).toBe(true);
  });

  it("keeps coverage at 1 and profit whole when nothing is sold", () => {
    const out = summariseFinance({ orders: [], costs, expenses: [] }, NOW);
    expect(out.month.coverage).toBe(1);
    expect(out.month.partialCosts).toBe(false);
    expect(out.month.netProfit).toBe(0);
  });

  it("does not cost a product that has no product_costs row", () => {
    const mystery = order({
      total: 900,
      lines: [line({ productId: "p-uncosted", lineTotal: 900 })],
    });
    const out = summariseFinance({ orders: [mystery], costs, expenses: [] }, NOW);
    expect(out.month.costOfGoods).toBe(0);
    expect(out.month.coverage).toBe(0);
    expect(out.month.partialCosts).toBe(true);
  });
});

describe("summariseFinance — expenses", () => {
  it("buckets expenses by spent_on day into day, week and month", () => {
    const today = expense({ amount: 500 });
    const monday = expense({ id: "e2", spentOn: WEEK_START, amount: 300 });
    const lastMonth = expense({ id: "e3", spentOn: "2026-09-15", amount: 999 });
    const out = summariseFinance(
      { orders: [], costs, expenses: [today, monday, lastMonth] },
      NOW,
    );
    expect(out.day.expenses).toBe(500);
    expect(out.week.expenses).toBe(800);
    expect(out.month.expenses).toBe(800);
  });

  it("nets profit as revenue − cost − expenses", () => {
    const sale = order({ total: 3000, lines: [line({ quantity: 5, lineTotal: 3000 })] });
    const spend = expense({ amount: 400 });
    const out = summariseFinance({ orders: [sale], costs, expenses: [spend] }, NOW);
    expect(out.month.grossProfit).toBe(3000 - 1200); // 5 × 240
    expect(out.month.netProfit).toBe(3000 - 1200 - 400);
  });

  it("can show a loss when expenses exceed gross profit", () => {
    const sale = order({ total: 600 });
    const spend = expense({ amount: 5000 });
    const out = summariseFinance({ orders: [sale], costs, expenses: [spend] }, NOW);
    expect(out.month.netProfit).toBeLessThan(0);
  });
});

describe("summariseFinance — daily table", () => {
  it("returns seven rows, oldest first, ending today", () => {
    const out = summariseFinance({ orders: [], costs, expenses: [] }, NOW);
    expect(out.daily).toHaveLength(7);
    expect(out.daily[0]?.day).toBe("2026-10-22");
    expect(out.daily.at(-1)?.day).toBe(TODAY);
    expect(out.daily.map((d) => d.label)).toHaveLength(7);
  });

  it("shows revenue, expenses and net per day", () => {
    const early = order({ id: "o-early", createdAt: "2026-10-24T09:00:00.000Z" });
    const spend = expense({ id: "e-d", spentOn: "2026-10-24", amount: 150 });
    const out = summariseFinance({ orders: [early], costs, expenses: [spend] }, NOW);
    const sat = out.daily.find((d) => d.day === "2026-10-24");
    expect(sat?.revenue).toBe(600);
    expect(sat?.expenses).toBe(150);
    expect(sat?.netProfit).toBe(600 - 240 - 150); // costed donut + expense
    // today still has its own row with zeros
    expect(out.daily.at(-1)?.revenue).toBe(0);
  });

  it("reaches exactly seven days back across the month boundary", () => {
    const novNow = new Date("2026-11-02T09:00:00.000Z");
    const out = summariseFinance({ orders: [], costs, expenses: [] }, novNow);
    expect(out.daily[0]?.day).toBe("2026-10-27");
    expect(out.daily.at(-1)?.day).toBe("2026-11-02");
    // an order on 27 October belongs to last month but still appears
    const old = order({ total: 700, createdAt: "2026-10-27T09:00:00.000Z" });
    const out2 = summariseFinance({ orders: [old], costs, expenses: [] }, novNow);
    expect(out2.daily[0]?.revenue).toBe(700);
    expect(out2.month.revenue).toBe(0);
  });
});
