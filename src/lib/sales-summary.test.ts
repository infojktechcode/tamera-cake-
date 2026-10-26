import { describe, expect, it } from "vitest";

import {
  SALES_WINDOW_DAYS,
  shiftDayKey,
  summariseSales,
  weekStartOn,
  type CatalogueItem,
  type SalesItemRow,
  type SalesOrderRow,
  type SalesPaymentRow,
} from "./sales-summary";

// 26 October 2026 is a Monday, so the fixture sits mid-week: the week runs
// Monday 26 → Sunday 1 November and today is Wednesday the 28th.
const NOW = new Date("2026-10-28T09:00:00.000Z");

function item(overrides: Partial<SalesItemRow> = {}): SalesItemRow {
  return {
    name: "Chocolate cake 3kg",
    quantity: 1,
    lineTotal: 4500,
    productId: null,
    flavourId: null,
    flavourName: null,
    ...overrides,
  };
}

function order(overrides: Partial<SalesOrderRow> = {}): SalesOrderRow {
  return {
    id: "o1",
    status: "confirmed",
    total: 4500,
    createdAt: "2026-10-28T08:00:00.000Z",
    items: [item()],
    ...overrides,
  };
}

const pastryItem = item({
  name: "Donut",
  quantity: 2,
  lineTotal: 600,
  productId: "p-donut",
});
const flavourItem = item({
  name: "Red Velvet 2kg",
  quantity: 1,
  lineTotal: 3200,
  flavourId: "f-red",
  flavourName: "Red Velvet",
});

const catalogue: CatalogueItem[] = [
  { key: "product:p-donut", name: "Donut", kind: "pastry" },
  { key: "product:p-scone", name: "Scone", kind: "pastry" },
  { key: "flavour:f-red", name: "Red Velvet", kind: "flavour" },
];

describe("shiftDayKey and weekStartOn", () => {
  it("moves day keys across month boundaries", () => {
    expect(shiftDayKey("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDayKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDayKey("2026-10-26", 6)).toBe("2026-11-01");
  });

  it("finds the Monday of the week", () => {
    expect(weekStartOn("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(weekStartOn("2026-10-31")).toBe("2026-10-26"); // Saturday
    expect(weekStartOn("2026-11-01")).toBe("2026-10-26"); // Sunday
  });
});

describe("summariseSales — periods", () => {
  it("buckets sales into today, this week and this month", () => {
    const summary = summariseSales(
      {
        orders: [
          order(), // today
          order({ id: "o2", total: 2000, createdAt: "2026-10-27T10:00:00.000Z" }),
          order({ id: "o3", total: 900, createdAt: "2026-10-02T10:00:00.000Z" }),
        ],
        payments: [],
        catalogue: [],
      },
      NOW,
    );

    expect(summary.today).toEqual({ sales: 4500, orders: 1, paid: 0 });
    expect(summary.week).toEqual({ sales: 6500, orders: 2, paid: 0 });
    expect(summary.month).toEqual({ sales: 7400, orders: 3, paid: 0 });
  });

  it("counts an order on the Nairobi day, not the UTC day", () => {
    // 22:30 UTC on 27 October is already 01:30 on the 28th in Nairobi.
    const summary = summariseSales(
      {
        orders: [
          order({ createdAt: "2026-10-27T22:30:00.000Z" }),
          order({ id: "o2", createdAt: "2026-10-27T20:30:00.000Z" }), // 23:30 in Nairobi on the 27th
        ],
        payments: [],
        catalogue: [],
      },
      NOW,
    );

    expect(summary.today.orders).toBe(1);
    expect(summary.week.orders).toBe(2);
  });

  it("leaves cancelled orders out of every figure", () => {
    const summary = summariseSales(
      { orders: [order({ status: "cancelled", total: 9999 })], payments: [], catalogue: [] },
      NOW,
    );

    expect(summary.today).toEqual({ sales: 0, orders: 0, paid: 0 });
    expect(summary.projection.salesSoFar).toBe(0);
  });

  it("adds payments into paid, refunds included as negatives", () => {
    const payments: SalesPaymentRow[] = [
      { amount: 4500, paidAt: "2026-10-28T08:05:00.000Z" },
      { amount: -500, paidAt: "2026-10-28T09:00:00.000Z" },
      { amount: 300, paidAt: "2026-10-20T12:00:00.000Z" },
    ];
    const summary = summariseSales({ orders: [], payments, catalogue: [] }, NOW);

    expect(summary.today.paid).toBe(4000);
    expect(summary.week.paid).toBe(4000);
    expect(summary.month.paid).toBe(4300);
  });
});

describe("summariseSales — average order value", () => {
  it("is the month's sales divided by the month's orders", () => {
    const summary = summariseSales(
      {
        orders: [order({ total: 3000 }), order({ id: "o2", total: 5000, createdAt: "2026-10-20T10:00:00.000Z" })],
        payments: [],
        catalogue: [],
      },
      NOW,
    );
    expect(summary.averageOrderValue).toBe(4000);
  });

  it("is zero when nothing has been ordered", () => {
    const summary = summariseSales({ orders: [], payments: [], catalogue: [] }, NOW);
    expect(summary.averageOrderValue).toBe(0);
  });
});

describe("summariseSales — the seven-day strip", () => {
  it("always returns seven days ending today, oldest first", () => {
    const summary = summariseSales(
      { orders: [order()], payments: [], catalogue: [] },
      NOW,
    );

    expect(summary.daily).toHaveLength(7);
    expect(summary.daily[6].day).toBe("2026-10-28");
    expect(summary.daily[0].day).toBe("2026-10-22");
    expect(summary.daily[6].sales).toBe(4500);
    expect(summary.daily[0].sales).toBe(0);
    expect(summary.daily[6].label).toContain("28");
  });
});

describe("summariseSales — best sellers", () => {
  it("ranks pastries by product and cakes by flavour", () => {
    const summary = summariseSales(
      {
        orders: [
          order({
            items: [pastryItem, flavourItem],
          }),
          order({
            id: "o2",
            createdAt: "2026-10-24T10:00:00.000Z",
            items: [item({ productId: "p-scone", name: "Scone", quantity: 3, lineTotal: 900 })],
          }),
        ],
        payments: [],
        catalogue,
      },
      NOW,
    );

    expect(summary.bestSellers[0]).toMatchObject({
      key: "product:p-scone",
      quantity: 3,
      kind: "pastry",
    });
    expect(summary.bestSellers.map((entry) => entry.key)).toContain("flavour:f-red");
    expect(summary.bestSellers).toHaveLength(3);
  });

  it("ignores orders older than the window", () => {
    const tooOld = shiftDayKey("2026-10-26", -(SALES_WINDOW_DAYS + 1));
    const summary = summariseSales(
      { orders: [order({ createdAt: `${tooOld}T10:00:00.000Z` })], payments: [], catalogue: [] },
      NOW,
    );
    expect(summary.bestSellers).toEqual([]);
  });

  it("has nothing to rank when there are no sales", () => {
    const summary = summariseSales({ orders: [], payments: [], catalogue: [] }, NOW);
    expect(summary.bestSellers).toEqual([]);
  });

  it("counts one product once even when a line lost its product id", () => {
    const summary = summariseSales(
      {
        orders: [
          order({
            items: [
              item({ name: "Cinnamon roll", productId: "p-cin", quantity: 6, lineTotal: 3600 }),
              item({ name: "Cinnamon roll", productId: null, quantity: 4, lineTotal: 2400 }),
            ],
          }),
        ],
        payments: [],
        catalogue: [],
      },
      NOW,
    );

    expect(summary.bestSellers).toHaveLength(1);
    expect(summary.bestSellers[0]).toMatchObject({ label: "Cinnamon roll", quantity: 10 });
  });
});

describe("summariseSales — slow movers", () => {
  it("lists the catalogue lines that sold least, zeros first", () => {
    const summary = summariseSales(
      {
        orders: [
          order({ items: [item({ productId: "p-donut", name: "Donut", quantity: 7, lineTotal: 2100 })] }),
        ],
        payments: [],
        catalogue,
      },
      NOW,
    );

    expect(summary.slowMovers).toHaveLength(3);
    expect(summary.slowMovers[0].quantity).toBe(0);
    expect(summary.slowMovers[1].quantity).toBe(0);
    expect(summary.slowMovers[2]).toMatchObject({ key: "product:p-donut", quantity: 7 });
  });

  it("credits an unlinked line to the catalogue product of the same name", () => {
    const summary = summariseSales(
      {
        orders: [
          order({ items: [item({ name: "Scone", productId: null, quantity: 5, lineTotal: 1500 })] }),
        ],
        payments: [],
        catalogue,
      },
      NOW,
    );

    expect(summary.slowMovers.find((entry) => entry.key === "product:p-scone")?.quantity).toBe(5);
  });
});

describe("summariseSales — earnings projection", () => {
  it("is sales so far / days elapsed * days in month, with a plain sentence", () => {
    // 28 of 31 days elapsed in October.
    const summary = summariseSales(
      { orders: [order({ total: 6200 })], payments: [], catalogue: [] },
      NOW,
    );

    expect(summary.projection.salesSoFar).toBe(6200);
    expect(summary.projection.daysElapsed).toBe(28);
    expect(summary.projection.daysInMonth).toBe(31);
    expect(summary.projection.projected).toBe(Math.round((6200 / 28) * 31));
    expect(summary.projection.monthLabel).toBe("October 2026");
    expect(summary.projection.sentence).toContain("October 2026");
    expect(summary.projection.sentence).toContain("KES");
  });

  it("explains that the projection appears with the first order", () => {
    const summary = summariseSales({ orders: [], payments: [], catalogue: [] }, NOW);
    expect(summary.projection.projected).toBe(0);
    expect(summary.projection.sentence).toContain("No sales yet this month");
  });

  it("handles February in a non-leap month", () => {
    const summary = summariseSales(
      { orders: [], payments: [], catalogue: [] },
      new Date("2026-02-10T09:00:00.000Z"),
    );
    expect(summary.projection.daysInMonth).toBe(28);
    expect(summary.projection.monthLabel).toBe("February 2026");
  });
});
