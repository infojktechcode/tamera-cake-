// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// --- stub the DB boundary before the route module is imported ---

const insertedOrders: Record<string, unknown>[] = [];
const insertedItems: Record<string, unknown>[] = [];
const insertedCakeDetails: Record<string, unknown>[] = [];
const insertedActivity: Record<string, unknown>[] = [];
const upsertedCustomers: Record<string, unknown>[] = [];
const createdIdempotencyKeys: string[] = [];
const storedIdempotency = new Map<
  string,
  { hash: string; token: string; legacy?: boolean; total?: number }
>();

const FLAVOUR_ID = "11111111-1111-4111-8111-111111111111";
const SIZE_ID_1_5KG = "12121212-1212-4121-8121-121212121212";
const SIZE_ID = "22222222-2222-4222-8222-222222222222";
const TIER_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const ZONE_ID = "55555555-5555-4555-8555-555555555555";

const TABLE_ROWS: Record<string, Record<string, unknown>[]> = {
  cake_sizes: [
    { id: SIZE_ID_1_5KG, kg: 1.5, available: true },
    { id: SIZE_ID, kg: 2, available: true },
  ],
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

const rpcMock = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  if (fn === "lookup_public_order_by_idempotency") {
    const key = String(args.p_idempotency_key);
    const existing = storedIdempotency.get(key);
    if (!existing) return { data: { ok: true, found: false }, error: null };
    if (existing.legacy) {
      return {
        data: { ok: true, found: false, legacy: true, legacy_total: existing.total },
        error: null,
      };
    }
    if (existing.hash !== args.p_request_hash) {
      return {
        data: {
          ok: false,
          error: "This checkout request was already used for a different order.",
        },
        error: null,
      };
    }
    return {
      data: { ok: true, found: true, confirmation_token: existing.token },
      error: null,
    };
  }
  if (fn === "verify_legacy_public_order_retry") {
    const existing = storedIdempotency.get(String(args.p_idempotency_key));
    if (!existing) return { data: { ok: true, found: false }, error: null };
    if (!existing.legacy || existing.hash !== args.p_request_hash) {
      return {
        data: {
          ok: false,
          error: "This checkout request was already used for a different order.",
        },
        error: null,
      };
    }
    return {
      data: { ok: true, found: true, confirmation_token: existing.token },
      error: null,
    };
  }
  if (fn === "create_public_order") {
    if (typeof args.p_idempotency_key !== "string") {
      throw new Error("create_public_order requires an idempotency key.");
    }
    const key = args.p_idempotency_key;
    const hash = String(args.p_request_hash);
    const existing = storedIdempotency.get(key);
    if (existing) {
      return existing.hash === hash
        ? {
            data: { ok: true, confirmation_token: existing.token },
            error: null,
          }
        : {
            data: {
              ok: false,
              error: "This checkout request was already used for a different order.",
            },
            error: null,
          };
    }
    const token = "66666666-6666-4666-8666-666666666666";
    storedIdempotency.set(key, { hash, token });
    createdIdempotencyKeys.push(key);
    return {
      data: {
        ok: true,
        confirmation_token: token,
      },
      error: null,
    };
  }

  throw new Error(`unexpected rpc: ${fn}`);
});

function latestCreateOrderArgs(): Record<string, unknown> {
  const call = rpcMock.mock.calls.filter(([name]) => name === "create_public_order").at(-1);
  if (!call) {
    throw new Error("create_public_order was not called.");
  }
  return call[1];
}

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
    idempotencyKey: "77777777-7777-4777-8777-777777777777",
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

function legacyRequestHash(payload: ReturnType<typeof validPayload>, total: number): string {
  return createHash("sha256")
    .update(JSON.stringify({ payload, normalizedPhone: "254712345678", total }))
    .digest("hex");
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
  createdIdempotencyKeys.length = 0;
  storedIdempotency.clear();
  bookedCakes = [];
  TABLE_ROWS.cake_sizes = [
    { id: SIZE_ID_1_5KG, kg: 1.5, available: true },
    { id: SIZE_ID, kg: 2, available: true },
  ];
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

  it("rejects a checkout without an idempotency key", async () => {
    const body = validPayload();
    delete (body as Partial<typeof body>).idempotencyKey;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
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

  it("returns a random confirmation token on success", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.confirmation_token).toBe("66666666-6666-4666-8666-666666666666");
  });

  it("stores the server-computed prices, not the client payload", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    const order = latestCreateOrderArgs().p_order as Record<string, unknown>;
    // 3200/kg * 2kg = 6400 cake + 450 * 2 = 900 pastry + 500 delivery
    expect(order.subtotal).toBe(7300);
    expect(order.delivery_fee).toBe(500);
    expect(order.total).toBe(7800);
    expect(order.deposit_required).toBe(0);
  });

  it("prices a 1.5 kg cake at KES 4,800 and persists its fractional size", async () => {
    const body = validPayload();
    body.items = [body.items[0]];
    body.items[0].sizeId = SIZE_ID_1_5KG;
    body.fulfilment = { kind: "pickup" } as unknown as typeof body.fulfilment;

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const args = latestCreateOrderArgs();
    const line = (args.p_lines as Record<string, unknown>[])[0];
    const order = args.p_order as Record<string, unknown>;

    expect(line).toMatchObject({
      sizeKg: 1.5,
      unitPrice: 4800,
      lineTotal: 4800,
    });
    expect(order.subtotal).toBe(4800);
    expect(order.total).toBe(4800);
  });

  it("rejects an unknown cake size before creating an order", async () => {
    const body = validPayload();
    body.items = [body.items[0]];
    body.items[0].sizeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unknown cake size/i);
    expect(createdIdempotencyKeys).toHaveLength(0);
  });

  it("normalises the phone number before calling the transactional writer", async () => {
    await POST(makeRequest(validPayload()));
    expect(latestCreateOrderArgs().p_customer).toEqual({
      name: "Wanjiku",
      phone: "254712345678",
    });
  });

  it("passes one server-priced database line per cart line", async () => {
    await POST(makeRequest(validPayload()));
    const lines = latestCreateOrderArgs().p_lines as Record<string, unknown>[];
    expect(lines).toHaveLength(2);
    expect(lines[0].unitPrice).toBe(6400);
    expect(lines[0].lineTotal).toBe(6400);
    expect(lines[1].unitPrice).toBe(450);
    expect(lines[1].lineTotal).toBe(900);
    expect(lines[1].quantity).toBe(2);
  });

  it("includes cake details only on the cake line passed to the database", async () => {
    await POST(makeRequest(validPayload()));
    const lines = latestCreateOrderArgs().p_lines as Record<string, unknown>[];
    expect(lines[0]).toMatchObject({
      kind: "cake",
      sizeKg: 2,
      flavourName: "Red Velvet",
      tierName: "Simple",
    });
    expect(lines[1].kind).toBe("pastry");
  });

  it("records the fulfilment mode on the order", async () => {
    await POST(makeRequest(validPayload()));
    expect(latestCreateOrderArgs().p_order).toMatchObject({
      fulfilment: "delivery",
      delivery_zone_id: ZONE_ID,
      delivery_address: "Mwangaza Road, House 12",
    });
  });

  it("records pickup with no zone and no delivery fee", async () => {
    const body = validPayload();
    body.fulfilment = { kind: "pickup" } as unknown as typeof body.fulfilment;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(latestCreateOrderArgs().p_order).toMatchObject({
      fulfilment: "pickup",
      delivery_fee: 0,
      delivery_zone_id: null,
    });
  });

  it("uses one transactional database call for a successful order", async () => {
    await POST(makeRequest(validPayload()));
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_public_order",
      expect.objectContaining({
        p_customer: expect.any(Object),
        p_order: expect.any(Object),
        p_lines: expect.any(Array),
        p_date_needed: "2099-06-15",
        p_idempotency_key: expect.any(String),
        p_request_hash: expect.any(String),
      }),
    );
  });

  it("returns the original result for a same-key, same-payload retry", async () => {
    const body = validPayload();
    const first = await POST(makeRequest(body));
    const retry = await POST(makeRequest(body));

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    expect(createdIdempotencyKeys).toHaveLength(1);
  });

  it("replays a legacy retry using its original total despite changed availability and capacity", async () => {
    const body = validPayload();
    const token = "88888888-8888-4888-8888-888888888888";
    storedIdempotency.set(body.idempotencyKey, {
      hash: legacyRequestHash(body, 7800),
      token,
      legacy: true,
      total: 7800,
    });
    TABLE_ROWS.cake_sizes = TABLE_ROWS.cake_sizes.map((size) => ({ ...size, available: false }));
    bookedCakes = Array.from({ length: 5 }, (_, i) => ({
      orderId: `order-${i}`,
      itemId: `item-${i}`,
      date: "2099-06-15",
      status: "confirmed",
    }));

    const retry = await POST(makeRequest(body));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ ok: true, confirmation_token: token });
    expect(rpcMock).toHaveBeenCalledWith(
      "verify_legacy_public_order_retry",
      expect.objectContaining({
        p_idempotency_key: body.idempotencyKey,
        p_request_hash: legacyRequestHash(body, 7800),
      }),
    );
    expect(rpcMock).not.toHaveBeenCalledWith("create_public_order", expect.anything());
    expect(createdIdempotencyKeys).toHaveLength(0);
  });

  it("rejects a changed payload when retrying a legacy idempotency key", async () => {
    const body = validPayload();
    storedIdempotency.set(body.idempotencyKey, {
      hash: legacyRequestHash(body, 7800),
      token: "88888888-8888-4888-8888-888888888888",
      legacy: true,
      total: 7800,
    });

    const retry = await POST(makeRequest({ ...body, notes: "Changed request" }));
    expect(retry.status).toBe(400);
    expect((await retry.json()).error).toMatch(/different order/i);
    expect(rpcMock).not.toHaveBeenCalledWith("create_public_order", expect.anything());
    expect(createdIdempotencyKeys).toHaveLength(0);
  });

  it("returns the same legacy order for concurrent identical retries", async () => {
    const body = validPayload();
    const token = "88888888-8888-4888-8888-888888888888";
    storedIdempotency.set(body.idempotencyKey, {
      hash: legacyRequestHash(body, 7800),
      token,
      legacy: true,
      total: 7800,
    });

    const [first, second] = await Promise.all([
      POST(makeRequest(body)),
      POST(makeRequest(body)),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, confirmation_token: token });
    expect(await second.json()).toEqual({ ok: true, confirmation_token: token });
    expect(rpcMock).toHaveBeenCalledTimes(4);
    expect(createdIdempotencyKeys).toHaveLength(0);
  });

  it("rejects reuse of an idempotency key with a changed payload", async () => {
    const body = validPayload();
    await POST(makeRequest(body));
    const changed = { ...body, notes: "Changed after first submission" };

    const retry = await POST(makeRequest(changed));
    expect(retry.status).toBe(400);
    expect((await retry.json()).error).toMatch(/different order/i);
    expect(createdIdempotencyKeys).toHaveLength(1);
  });

  it("replays a successful request before changed availability or capacity checks", async () => {
    const body = validPayload();
    const first = await POST(makeRequest(body));
    expect(first.status).toBe(200);

    TABLE_ROWS.cake_sizes[0].available = false;
    TABLE_ROWS.cake_sizes[1].available = false;
    bookedCakes = Array.from({ length: 5 }, (_, i) => ({
      orderId: `order-${i}`,
      itemId: `item-${i}`,
      date: "2099-06-15",
      status: "confirmed",
    }));

    const retry = await POST(makeRequest(body));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    expect(createdIdempotencyKeys).toHaveLength(1);
  });

  it("creates only one order when identical requests race", async () => {
    const body = validPayload();
    const [first, second] = await Promise.all([
      POST(makeRequest(body)),
      POST(makeRequest(body)),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
    expect(createdIdempotencyKeys).toHaveLength(1);
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
    expect(rpcMock).toHaveBeenCalledWith(
      "lookup_public_order_by_idempotency",
      expect.any(Object),
    );
    expect(createdIdempotencyKeys).toHaveLength(0);
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
    expect(createdIdempotencyKeys).toHaveLength(0);
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
