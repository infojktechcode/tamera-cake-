import { describe, it, expect, vi } from "vitest";

// Next's cacheTag/cacheLife throw outside cacheComponents config; mock them.
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

// Supabase query builder is a thenable — it chains but also resolves when awaited.
interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (val: unknown) => void) => void;
  _result: { data: unknown; error: unknown };
  _calls: { select: unknown[][]; eq: unknown[][]; order: unknown[][] };
}

function makeChain(): MockChain {
  const calls = { select: [] as unknown[][], eq: [] as unknown[][], order: [] as unknown[][] };
  const chain: MockChain = {
    select: vi.fn((...args: unknown[]) => {
      calls.select.push(args);
      return chain;
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.eq.push(args);
      return chain;
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.order.push(args);
      return chain;
    }),
    single: vi.fn(() => Promise.resolve(chain._result)),
    maybeSingle: vi.fn(() => Promise.resolve(chain._result)),
    then: (resolve) => resolve(chain._result),
    _result: { data: [{ id: "placeholder" }], error: null },
    _calls: calls,
  };
  return chain;
}

const sizesChain = makeChain();
const tiersChain = makeChain();
const zonesChain = makeChain();
const blockedChain = makeChain();
const settingsChain = makeChain();

// Mock the public client factory.
vi.mock("./supabase/public", () => ({
  getPublicClient: () => ({
    from: (table: string) => {
      if (table === "cake_sizes") return sizesChain;
      if (table === "design_tiers") return tiersChain;
      if (table === "delivery_zones") return zonesChain;
      if (table === "blocked_dates") return blockedChain;
      if (table === "settings") return settingsChain;
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const {
  getSizes,
  getDesignTiers,
  getDeliveryZones,
  getBlockedDates,
  getOrderSettings,
} = await import("./builder-data");

describe("getSizes", () => {
  it("filters available=true and orders by sort_order", async () => {
    sizesChain._result = {
      data: [{ id: "s1", kg: 1 }, { id: "s2", kg: 2 }],
      error: null,
    };
    sizesChain._calls.select = [];
    sizesChain._calls.eq = [];
    sizesChain._calls.order = [];
    sizesChain.select.mockClear().mockReturnThis();
    sizesChain.eq.mockClear().mockReturnThis();
    sizesChain.order.mockClear().mockReturnThis();

    const sizes = await getSizes();

    // select was called (arg check is loose since mock returns this)
    expect(sizesChain.select).toHaveBeenCalled();
    expect(sizesChain.eq).toHaveBeenCalledWith("available", true);
    expect(sizesChain.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(sizes).toEqual([{ id: "s1", kg: 1 }, { id: "s2", kg: 2 }]);
  });

  it("throws on supabase error", async () => {
    sizesChain._result = { data: null, error: { message: "DB down" } };
    await expect(getSizes()).rejects.toThrow("DB down");
  });
});

describe("getDesignTiers", () => {
  it("returns all tiers ordered by sort_order", async () => {
    tiersChain._result = {
      data: [
        { id: "t1", name: "Simple", extra_fee: 0, requires_quote: false, description: "x" },
        { id: "t2", name: "Themed", extra_fee: 1500, requires_quote: false, description: "y" },
      ],
      error: null,
    };
    tiersChain.select.mockClear().mockReturnThis();
    tiersChain.order.mockClear().mockReturnThis();

    const tiers = await getDesignTiers();

    expect(tiersChain.select).toHaveBeenCalledWith(
      "id,name,extra_fee,requires_quote,description,sort_order",
    );
    expect(tiersChain.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(tiers).toHaveLength(2);
    expect(tiers[1]).toEqual({
      id: "t2",
      name: "Themed",
      extra_fee: 1500,
      requires_quote: false,
      description: "y",
    });
  });
});

describe("getDeliveryZones", () => {
  it("filters active=true and orders by sort_order", async () => {
    zonesChain._result = {
      data: [
        { id: "z1", name: "Pickup", fee: 0 },
        { id: "z2", name: "Kitengela", fee: 200 },
      ],
      error: null,
    };
    zonesChain.select.mockClear().mockReturnThis();
    zonesChain.eq.mockClear().mockReturnThis();
    zonesChain.order.mockClear().mockReturnThis();

    const zones = await getDeliveryZones();

    expect(zonesChain.eq).toHaveBeenCalledWith("active", true);
    expect(zonesChain.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(zones[1].fee).toBe(200);
  });
});

describe("getBlockedDates", () => {
  it("returns array of YYYY-MM-DD strings", async () => {
    blockedChain._result = {
      data: [{ date: "2025-12-25" }, { date: "2025-01-01" }],
      error: null,
    };
    blockedChain.select.mockClear().mockReturnThis();
    blockedChain.order.mockClear().mockReturnThis();

    const dates = await getBlockedDates();
    expect(dates).toEqual(["2025-12-25", "2025-01-01"]);
  });
});

describe("getOrderSettings", () => {
  it("reads min_lead_days, daily_cake_limit, deposit_percent, deposit_threshold_kg", async () => {
    settingsChain._result = {
      data: {
        min_lead_days: 2,
        daily_cake_limit: 6,
        deposit_percent: 50,
        deposit_threshold_kg: 3,
      },
      error: null,
    };
    settingsChain.select.mockClear().mockReturnThis();

    const settings = await getOrderSettings();

    // getOrderSettings uses .single() — not in chain mock but resolves directly
    expect(settingsChain.select).toHaveBeenCalledWith(
      "min_lead_days,daily_cake_limit,deposit_percent,deposit_threshold_kg",
    );
    expect(settings).toEqual({
      min_lead_days: 2,
      daily_cake_limit: 6,
      deposit_percent: 50,
      deposit_threshold_kg: 3,
    });
  });
});
