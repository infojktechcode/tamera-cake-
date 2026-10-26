import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { eachDate, getProductionCalendar } from "./admin-calendar";

interface FakeOptions {
  orders?: unknown[];
  blocked?: { date: string; reason: string | null }[];
  dailyCakeLimit?: number;
}

/** A tiny stand-in for the Supabase client: every filter is a no-op. */
function fakeSupabase({ orders = [], blocked = [], dailyCakeLimit = 5 }: FakeOptions) {
  const client = {
    from(table: string) {
      const data =
        table === "orders" ? orders : table === "blocked_dates" ? blocked : null;
      const builder = {
        select: () => builder,
        gte: () => builder,
        lte: () => builder,
        neq: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: table === "settings" ? { daily_cake_limit: dailyCakeLimit } : null,
          error: null,
        }),
        then: (
          resolve: (value: { data: unknown; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data, error: null as null }).then(resolve, reject),
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

function cakeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    order_number: "TCB-0001",
    status: "confirmed",
    fulfilment: "pickup",
    price_needs_quote: false,
    date_needed: "2026-11-10",
    customers: { name: "Wanjiku" },
    order_items: [
      {
        id: "i1",
        name: "Vanilla cake",
        cake_details: {
          size_kg: 2,
          flavour_name: "Vanilla",
          design_tier_name: "Simple",
          reference_photos: ["cakes/a.jpg"],
        },
      },
    ],
    ...overrides,
  };
}

describe("eachDate", () => {
  it("returns every day, both ends included", () => {
    expect(eachDate("2026-11-10", "2026-11-13")).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
    ]);
  });

  it("crosses a month boundary", () => {
    expect(eachDate("2026-10-31", "2026-11-02")).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("returns one day when from equals to", () => {
    expect(eachDate("2026-11-10", "2026-11-10")).toEqual(["2026-11-10"]);
  });
});

describe("getProductionCalendar", () => {
  it("puts each cake on its day with the customer and the photo", async () => {
    const days = await getProductionCalendar(
      fakeSupabase({ orders: [cakeOrder()] }),
      "2026-11-10",
      "2026-11-11",
    );

    expect(days).toHaveLength(2);
    expect(days[0].cakeCount).toBe(1);
    expect(days[0].cakes[0]).toMatchObject({
      orderNumber: "TCB-0001",
      customerName: "Wanjiku",
      flavourName: "Vanilla",
      sizeKg: 2,
      referencePhoto: "cakes/a.jpg",
      priceNeedsQuote: false,
    });
    expect(days[1].cakes).toHaveLength(0);
  });

  it("counts the cakes on a day and marks the day full at the limit", async () => {
    const orders = [
      cakeOrder(),
      cakeOrder({
        id: "o2",
        order_number: "TCB-0002",
        order_items: [
          {
            id: "i2",
            name: "Chocolate cake",
            cake_details: {
              size_kg: 1,
              flavour_name: "Chocolate",
              design_tier_name: "Standard",
              reference_photos: null,
            },
          },
        ],
      }),
    ];

    const days = await getProductionCalendar(
      fakeSupabase({ orders, dailyCakeLimit: 2 }),
      "2026-11-10",
      "2026-11-10",
    );

    expect(days[0].cakeCount).toBe(2);
    expect(days[0].limit).toBe(2);
    expect(days[0].full).toBe(true);
  });

  it("marks a blocked day and keeps its reason", async () => {
    const days = await getProductionCalendar(
      fakeSupabase({
        orders: [],
        blocked: [{ date: "2026-11-11", reason: "Public holiday" }],
      }),
      "2026-11-10",
      "2026-11-11",
    );

    expect(days[0].blocked).toBe(false);
    expect(days[1].blocked).toBe(true);
    expect(days[1].reason).toBe("Public holiday");
  });

  it("leaves pastry lines out of the bake list", async () => {
    const order = cakeOrder({
      order_items: [
        {
          id: "i1",
          name: "Vanilla cake",
          cake_details: {
            size_kg: 2,
            flavour_name: "Vanilla",
            design_tier_name: "Simple",
            reference_photos: null,
          },
        },
        { id: "i2", name: "Glazed donut", cake_details: null },
      ],
    });

    const days = await getProductionCalendar(
      fakeSupabase({ orders: [order] }),
      "2026-11-10",
      "2026-11-10",
    );

    expect(days[0].cakeCount).toBe(1);
    expect(days[0].cakes[0].name).toBe("Vanilla cake");
  });

  it("still lists an order whose customer row is missing", async () => {
    const days = await getProductionCalendar(
      fakeSupabase({ orders: [cakeOrder({ customers: null })] }),
      "2026-11-10",
      "2026-11-10",
    );

    expect(days[0].cakes[0].customerName).toBe("Customer");
  });
});
