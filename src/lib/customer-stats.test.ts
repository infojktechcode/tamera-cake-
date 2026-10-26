import { describe, expect, it } from "vitest";

import {
  filterCustomers,
  sortCustomers,
  summariseCustomers,
  type CustomerOrderRow,
  type CustomerRow,
} from "./customer-stats";

function customer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "c1",
    name: "Wanjiku Kamau",
    phone: "0712000111",
    notes: null,
    source: "online",
    consent: true,
    createdAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

function order(overrides: Partial<CustomerOrderRow> = {}): CustomerOrderRow {
  return {
    customer_id: "c1",
    total: 5000,
    status: "completed",
    created_at: "2026-10-10T09:00:00.000Z",
    ...overrides,
  };
}

describe("summariseCustomers", () => {
  it("counts the orders and adds the totals", () => {
    const [summary] = summariseCustomers(
      [customer()],
      [order({ total: 5000 }), order({ total: 2500, created_at: "2026-10-12T09:00:00.000Z" })],
    );

    expect(summary.ordersCount).toBe(2);
    expect(summary.totalSpent).toBe(7500);
    expect(summary.repeat).toBe(true);
  });

  it("keeps the newest order date", () => {
    const [summary] = summariseCustomers(
      [customer()],
      [
        order({ created_at: "2026-10-05T09:00:00.000Z" }),
        order({ created_at: "2026-10-20T09:00:00.000Z" }),
        order({ created_at: "2026-10-12T09:00:00.000Z" }),
      ],
    );

    expect(summary.lastOrderAt).toBe("2026-10-20T09:00:00.000Z");
  });

  it("leaves cancelled orders out of the count and the spending", () => {
    const [summary] = summariseCustomers(
      [customer()],
      [order({ total: 5000 }), order({ total: 9000, status: "cancelled" })],
    );

    expect(summary.ordersCount).toBe(1);
    expect(summary.totalSpent).toBe(5000);
    expect(summary.repeat).toBe(false);
  });

  it("gives a customer with no orders zeroes", () => {
    const [summary] = summariseCustomers([customer({ id: "c2" })], [order()]);

    expect(summary.ordersCount).toBe(0);
    expect(summary.totalSpent).toBe(0);
    expect(summary.lastOrderAt).toBeNull();
    expect(summary.repeat).toBe(false);
  });

  it("ignores an order with no customer", () => {
    const [summary] = summariseCustomers([customer()], [order({ customer_id: null })]);

    expect(summary.ordersCount).toBe(0);
  });
});

describe("sortCustomers", () => {
  it("puts the most recent order first and never-ordered customers last", () => {
    const customers = summariseCustomers(
      [
        customer({ id: "old", name: "A" }),
        customer({ id: "new", name: "B" }),
        customer({ id: "none", name: "C" }),
      ],
      [
        order({ customer_id: "old", created_at: "2026-10-01T09:00:00.000Z" }),
        order({ customer_id: "new", created_at: "2026-10-20T09:00:00.000Z" }),
      ],
    );

    expect(sortCustomers(customers).map((c) => c.id)).toEqual(["new", "old", "none"]);
  });
});

describe("filterCustomers", () => {
  const list = summariseCustomers(
    [
      customer({ id: "c1", name: "Wanjiku Kamau", phone: "0712000111" }),
      customer({ id: "c2", name: "Jared Kip", phone: "0722333444" }),
    ],
    [],
  );

  it("returns everyone for an empty query", () => {
    expect(filterCustomers(list, "  ")).toHaveLength(2);
  });

  it("matches a name, case-insensitively", () => {
    expect(filterCustomers(list, "wanjiku").map((c) => c.id)).toEqual(["c1"]);
  });

  it("matches a phone number", () => {
    expect(filterCustomers(list, "7223").map((c) => c.id)).toEqual(["c2"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterCustomers(list, "zzz")).toHaveLength(0);
  });
});
