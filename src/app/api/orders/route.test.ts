// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- stub the DB boundary before the route module is imported ---

const insertedOrders: Record<string, unknown>[] = [];
const insertedItems: Record<string, unknown>[] = [];
const insertedCakeDetails: Record<string, unknown>[] = [];
const insertedActivity: Record<string, unknown>[] = [];
const upsertedCustomers: Record<string, unknown>[] = [];

const FLAVOUR_ID = "11111111-1111-4111-8111-111111111111";
const SIZE_ID = "22222222-2222-4222-8222-222222222222";
const TIER_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_ID = "55555555-5555-4555-8555-555555555555";

const TABLE_ROWS: Record<string, Record<string, unknown>[]> = {
  cake_sizes: [{ id: SIZE_ID, kg: 2, available: true }],
  cake_flavours: [
    { id: FLAVOUR_ID, name: "Red Velvet", price_per_kg: 3200, available: true },
  ],
  design_tiers: [{ id: TIER_ID, name: "Simple", extra_fee: 0, requires_quote: false }],
  delivery_zones: [{ id: ZONE_ID, name: "Kitengela", fee: 500, active: true }],
  products: [{ id: PRODUCT_ID, name: "Scone", price: 450, available: true }],
};

/**
 * Cakes already booked for a date — the capacity check counts them.
 *
 * The route reads them with three queries (orders → order_items →
 * cake_details), so the stub has to answer all three the way PostgREST does.
 */
let bookedCakes: { orderId: string; itemId: string; date: string; status: string }[] = [];

function rowsFor(table: string): Record<string, unknown>[] {
  if (table === "orders") {
    return bookedCakes.map((c) => ({
      id: c.orderId,
      date_needed: c.date,
      status: c.status,
    }));
  }
  if (table === "order_items") {
    return bookedCakes.map((c) => ({ id: c.itemId, order_id: c.orderId }));
  }
  if (table === "cake_details") {
    return bookedCakes.map((c) => ({ order_item_id: c.itemId }));
  }
  return TABLE_ROWS[table] ?? [];
}

type Filter = { op: "eq" | "neq" | "in"; column: string; value: unknown };

function applyFilters(rows: Record<string, unknown>[], filters: Filter[]) {
  return rows.filter((row) =>
    filters.every((f) => {
      const value = row[f.column];
      if (f.op === "eq") return value === f.value;
      if (f.op === "neq") return value !== f.value;
      return Array.isArray(f.value) && f.value.includes(value);
    }),
  );
}

/** A minimal chainable Supabase query builder over a fixed row set. */
function makeQuery(table: string) {
  const filters: Filter[] = [];
  let head = false;
  let exactCount = false;

  const builder = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      head = opts?.head === true;
      exactCount = opts?.count === "exact";
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ op: "eq", column, value });
      return builder;
    },
    neq: (column: string, value: unknown) => {
      filters.push({ op: "neq", column, value });
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      filters.push({ op: "in", column, value: values });
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    single: async () => {
      if (table === "settings") {
        return {
          data: {
            min_lead_days: 2,
            daily_cake_limit: 5,
            deposit_percent: 50,
            deposit_threshold_kg: 3,
          },
          error: null,
        };
      }
      const rows = applyFilters(rowsFor(table), filters);
      return { data: rows[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => unknown) => {
      const rows = applyFilters(rowsFor(table), filters);
      const result = {
        data: head ? null : rows,
        count: exactCount ? rows.length : null,
        error: null,
      };
      return Promise.resolve(result).then(resolve);
    },
  };
  return builder;
}

const fromMock = vi.fn((table: string) => {
  if (table === "orders") {
    return {
      ...makeQuery(table),
      insert: (row: Record<string, unknown>) => {
        insertedOrders.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "order-uuid", ...row }, error: null }),
          }),
        };
      },
    };
  }
  if (table === "order_items") {
    return {
      ...makeQuery(table),
      insert: (row: Record<string, unknown>) => {
        insertedItems.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "item-uuid", ...row }, error: null }),
          }),
        };
      },
    };
  }
  if (table === "cake_details") {
    return {
      ...makeQuery(table),
      insert: (row: Record<string, unknown>) => {
        insertedCakeDetails.push(row);
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      },
    };
  }
  if (table === "activity_log") {
    return {
      ...makeQuery(table),
      insert: (row: Record<string, unknown>) => {
        insertedActivity.push(row);
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      },
    };
  }
  if (table === "customers") {
    return {
      ...makeQuery(table),
      upsert: (row: Record<string, unknown>) => {
        upsertedCustomers.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "customer-uuid", ...row }, error: null }),
          }),
        };
      },
    };
  }
  if (table === "blocked_dates") {
    return {
      ...makeQuery(table),
      select: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      }),
    };
  }
  return makeQuery(table);
});

const rpcMock = vi.fn(async (fn: string) => {
  if (fn === "next_order_number") return { data: "TCB-0001", error: null };
  throw new Error(`unexpected rpc: ${fn}`);
});

const serviceClient = { from: fromMock, rpc: rpcMock };

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => serviceClient,
}));

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string, profile: string) => revalidateTagMock(tag, profile),
}));

const { POST } = await import("./route");

function validPayload() {
  return {
    customer: { name: "Wanjiku", phone: "0712345678" },
    fulfilment: {
      kind: "delivery" as const,
      zoneId: ZONE_ID,
      address: "Mwangaza Road, House 12",
    },
    dateNeeded: "2099-06-15",
    timeNeeded: "10:00",
    notes: "",
    items: [
      {
        kind: "cake" as const,
        flavourId: FLAVOUR_ID,
        sizeId: SIZE_ID,
        tierId: TIER_ID,
        designDescription: "Two tiers",
        cakeMessage: "Happy Birthday",
        allergies: "",
        referencePhotos: [],
      },
      { kind: "pastry" as const, productId: PRODUCT_ID, quantity: 2 },
    ],
  };
}

let requestCounter = 0;

/**
 * Each request carries a unique client IP: the route rate-limits per IP, and
 * a test file that made 15 requests from one IP would trip the limiter.
 */
function makeRequest(body: unknown) {
  requestCounter += 1;
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${requestCounter}`,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insertedOrders.length = 0;
  insertedItems.length = 0;
  insertedCakeDetails.length = 0;
  insertedActivity.length = 0;
  upsertedCustomers.length = 0;
  bookedCakes = [];
  vi.clearAllMocks();
});

describe("POST /api/orders", () => {
  it("rejects a payload with a tampered unit price", async () => {
    const body = validPayload();
    // A tampered client tries to force a price of KES 1.
    (body.items[1] as unknown as { unitPrice: number }).unitPrice = 1;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(insertedOrders).toHaveLength(0);
  });

  it("rejects a payload with a tampered total", async () => {
    const res = await POST(makeRequest({ ...validPayload(), total: 1 }));
    expect(res.status).toBe(400);
    expect(insertedOrders).toHaveLength(0);
  });

  it("rejects a payload with an invalid phone number", async () => {
    const body = validPayload();
    body.customer.phone = "123";
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(insertedOrders).toHaveLength(0);
  });

  it("rejects a non-JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/orders", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns the order number on success", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.order_number).toBe("TCB-0001");
  });

  it("stores the server-computed prices, not the client payload", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(insertedOrders).toHaveLength(1);
    const order = insertedOrders[0];
    // 3200/kg * 2kg = 6400 cake + 450 * 2 = 900 pastry + 500 delivery
    expect(order.subtotal).toBe(7300);
    expect(order.delivery_fee).toBe(500);
    expect(order.total).toBe(7800);
    expect(order.deposit_required).toBe(0);
  });

  it("normalises the phone number before upserting the customer", async () => {
    await POST(makeRequest(validPayload()));
    expect(upsertedCustomers).toHaveLength(1);
    expect(upsertedCustomers[0].phone).toBe("254712345678");
  });

  it("inserts one order item per cart line", async () => {
    await POST(makeRequest(validPayload()));
    expect(insertedItems).toHaveLength(2);
    expect(insertedItems[0].unit_price).toBe(6400);
    expect(insertedItems[0].line_total).toBe(6400);
    expect(insertedItems[1].unit_price).toBe(450);
    expect(insertedItems[1].line_total).toBe(900);
    expect(insertedItems[1].quantity).toBe(2);
  });

  it("inserts cake details for the cake line only", async () => {
    await POST(makeRequest(validPayload()));
    expect(insertedCakeDetails).toHaveLength(1);
    expect(insertedCakeDetails[0].size_kg).toBe(2);
    expect(insertedCakeDetails[0].flavour_name).toBe("Red Velvet");
    expect(insertedCakeDetails[0].design_tier_name).toBe("Simple");
  });

  it("links the cake detail to its order item", async () => {
    await POST(makeRequest(validPayload()));
    expect(insertedCakeDetails[0].order_item_id).toBe("item-uuid");
  });

  it("writes an activity log row", async () => {
    await POST(makeRequest(validPayload()));
    expect(insertedActivity.length).toBeGreaterThan(0);
    expect(insertedActivity[0].action).toBe("order_created");
  });

  it("records the fulfilment mode on the order", async () => {
    await POST(makeRequest(validPayload()));
    expect(insertedOrders[0].fulfilment).toBe("delivery");
    expect(insertedOrders[0].delivery_zone_id).toBe(ZONE_ID);
    expect(insertedOrders[0].delivery_address).toBe("Mwangaza Road, House 12");
  });

  it("records pickup with no zone and no delivery fee", async () => {
    const body = validPayload();
    body.fulfilment = { kind: "pickup" } as unknown as typeof body.fulfilment;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(insertedOrders[0].fulfilment).toBe("pickup");
    expect(insertedOrders[0].delivery_fee).toBe(0);
    expect(insertedOrders[0].delivery_zone_id).toBeNull();
  });

  it("revalidates the catalogue cache after a successful order", async () => {
    await POST(makeRequest(validPayload()));
    expect(revalidateTagMock).toHaveBeenCalledWith("catalog", "max");
  });

  it("rejects an order whose date is inside the lead time", async () => {
    const body = validPayload();
    body.dateNeeded = "2020-01-01";
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(insertedOrders).toHaveLength(0);
  });

  it("rejects an order for a day that already holds the maximum number of cakes", async () => {
    // The daily limit is 5 in the stubbed settings.
    bookedCakes = Array.from({ length: 5 }, (_, i) => ({
      orderId: `order-${i}`,
      itemId: `item-${i}`,
      date: "2099-06-15",
      status: "confirmed",
    }));

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/fully booked/i);
    expect(insertedOrders).toHaveLength(0);
  });

  it("ignores cakes booked for another date when checking capacity", async () => {
    bookedCakes = Array.from({ length: 5 }, (_, i) => ({
      orderId: `order-${i}`,
      itemId: `item-${i}`,
      date: "2099-07-01",
      status: "confirmed",
    }));

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
  });

  it("ignores cancelled orders when checking capacity", async () => {
    bookedCakes = Array.from({ length: 5 }, (_, i) => ({
      orderId: `order-${i}`,
      itemId: `item-${i}`,
      date: "2099-06-15",
      status: "cancelled",
    }));

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
  });
});
