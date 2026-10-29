import { describe, it, expect, vi } from "vitest";

// Next's cacheTag/cacheLife throw outside cacheComponents config; mock them.
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

// Supabase query builder is a thenable — it chains but also resolves when awaited.
interface MockChain {
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  _result: { data: unknown; error: unknown };
  _calls: { select: unknown[][] };
}

function makeChain(): MockChain {
  const calls = { select: [] as unknown[][] };
  const chain: MockChain = {
    select: vi.fn((...args: unknown[]) => {
      calls.select.push(args);
      return chain;
    }),
    single: vi.fn(() => Promise.resolve(chain._result)),
    _result: { data: {}, error: null },
    _calls: calls,
  };
  return chain;
}

const settingsChain = makeChain();

vi.mock("./supabase/public", () => ({
  getPublicClient: () => ({
    from: (table: string) => {
      if (table === "settings") return settingsChain;
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { getPublicSettings } = await import("./catalog");

/** Reset the mock chain between tests. */
function primeSettings(data: unknown) {
  settingsChain._result = { data, error: null };
  settingsChain.select.mockClear().mockReturnThis();
}

describe("getPublicSettings", () => {
  it("selects all public columns (and excludes sms_enabled/sms_provider)", async () => {
    primeSettings({
      shop_name: "Tamera's",
      whatsapp_number: "254700000000",
      address: "Kitengela",
      opening_hours: {},
      social_links: {},
      faq_items: [],
      delivery_policy: null,
      payment_policy: null,
      cancellation_policy: null,
      brand_colours: {},
      logo_url: null,
    });

    await getPublicSettings();

    const selectArg = settingsChain.select.mock.calls[0]?.[0] as string;
    expect(selectArg).toContain("shop_name");
    expect(selectArg).toContain("social_links");
    expect(selectArg).toContain("faq_items");
    expect(selectArg).toContain("delivery_policy");
    expect(selectArg).toContain("payment_policy");
    expect(selectArg).toContain("cancellation_policy");
    expect(selectArg).toContain("brand_colours");
    expect(selectArg).toContain("logo_url");
    // Must NOT leak SMS config to the public client.
    expect(selectArg).not.toContain("sms_enabled");
    expect(selectArg).not.toContain("sms_provider");
  });

  it("returns all new fields", async () => {
    primeSettings({
      shop_name: "Tamera's",
      whatsapp_number: "254700000000",
      address: "Kitengela",
      opening_hours: { mon: { open: "08:00", close: "20:00" } },
      social_links: { facebook: "https://facebook.com/tameras" },
      faq_items: [{ question: "Q?", answer: "A." }],
      delivery_policy: "Delivered within Kitengela.",
      payment_policy: "Pay via M-Pesa.",
      cancellation_policy: "24h notice.",
      brand_colours: { primary: "#5D3A2A" },
      logo_url: "/logo.png",
    });

    const settings = await getPublicSettings();

    expect(settings.social_links).toEqual({ facebook: "https://facebook.com/tameras" });
    expect(settings.faq_items).toEqual([{ question: "Q?", answer: "A." }]);
    expect(settings.delivery_policy).toBe("Delivered within Kitengela.");
    expect(settings.payment_policy).toBe("Pay via M-Pesa.");
    expect(settings.cancellation_policy).toBe("24h notice.");
    expect(settings.brand_colours).toEqual({ primary: "#5D3A2A" });
    expect(settings.logo_url).toBe("/logo.png");
  });

  it("degrades malformed social_links to an empty object", async () => {
    primeSettings({
      shop_name: "T",
      whatsapp_number: "1",
      address: null,
      opening_hours: {},
      social_links: "not-an-object",
      faq_items: [],
      delivery_policy: null,
      payment_policy: null,
      cancellation_policy: null,
      brand_colours: {},
      logo_url: null,
    });

    const settings = await getPublicSettings();
    expect(settings.social_links).toEqual({});
  });

  it("degrades malformed faq_items to an empty array", async () => {
    primeSettings({
      shop_name: "T",
      whatsapp_number: "1",
      address: null,
      opening_hours: {},
      social_links: {},
      faq_items: "nope",
      delivery_policy: null,
      payment_policy: null,
      cancellation_policy: null,
      brand_colours: {},
      logo_url: null,
    });

    const settings = await getPublicSettings();
    expect(settings.faq_items).toEqual([]);
  });

  it("degrades malformed brand_colours to an empty object", async () => {
    primeSettings({
      shop_name: "T",
      whatsapp_number: "1",
      address: null,
      opening_hours: {},
      social_links: {},
      faq_items: [],
      delivery_policy: null,
      payment_policy: null,
      cancellation_policy: null,
      brand_colours: 42,
      logo_url: null,
    });

    const settings = await getPublicSettings();
    expect(settings.brand_colours).toEqual({});
  });

  it("throws on supabase error", async () => {
    settingsChain._result = { data: null, error: { message: "DB down" } };
    settingsChain.select.mockClear().mockReturnThis();
    await expect(getPublicSettings()).rejects.toThrow("DB down");
  });
});
