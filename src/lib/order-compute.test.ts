import { describe, it, expect } from "vitest";

import { computeOrder, type CatalogueRows, type OrderSettings } from "./order-compute";
import type { OrderPayload } from "./validators/order.schema";

const FLAVOUR_ID = "11111111-1111-4111-8111-111111111111";
const SIZE_ID_2KG = "22222222-2222-4222-8222-222222222222";
const SIZE_ID_3KG = "33333333-3333-4333-8333-333333333333";
const TIER_SIMPLE = "44444444-4444-4444-8444-444444444444";
const TIER_THEMED = "55555555-5555-4555-8555-555555555555";
const TIER_QUOTE = "66666666-6666-4666-8666-666666666666";
const PRODUCT_ID = "77777777-7777-4777-8777-777777777777";
const ZONE_ID = "88888888-8888-4888-8888-888888888888";

const SETTINGS: OrderSettings = {
  min_lead_days: 2,
  daily_cake_limit: 5,
  deposit_percent: 50,
  deposit_threshold_kg: 3,
};

const CATALOGUE: CatalogueRows = {
  sizes: [
    { id: SIZE_ID_2KG, kg: 2 },
    { id: SIZE_ID_3KG, kg: 3 },
  ],
  flavours: [{ id: FLAVOUR_ID, name: "Red Velvet", pricePerKg: 3200 }],
  tiers: [
    { id: TIER_SIMPLE, name: "Simple", extraFee: 0, requiresQuote: false },
    { id: TIER_THEMED, name: "Themed", extraFee: 1500, requiresQuote: false },
    { id: TIER_QUOTE, name: "Signature", extraFee: 5000, requiresQuote: true },
  ],
  zones: [{ id: ZONE_ID, name: "Kitengela", fee: 500 }],
  products: [{ id: PRODUCT_ID, name: "Scone", unitPrice: 450 }],
};

function payload(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    customer: { name: "Wanjiku", phone: "0712345678" },
    fulfilment: { kind: "delivery", zoneId: ZONE_ID, address: "Mwangaza Road" },
    dateNeeded: "2030-06-15",
    timeNeeded: "10:00",
    notes: "",
    items: [
      {
        kind: "cake",
        flavourId: FLAVOUR_ID,
        sizeId: SIZE_ID_2KG,
        tierId: TIER_SIMPLE,
        designDescription: "Two tiers",
        cakeMessage: "Happy Birthday",
        allergies: "",
        referencePhotos: [],
      },
    ],
    ...overrides,
  };
}

function compute(overrides: Partial<OrderPayload> = {}, rows: Partial<CatalogueRows> = {}) {
  return computeOrder({
    payload: payload(overrides),
    catalogue: { ...CATALOGUE, ...rows },
    settings: SETTINGS,
    blockedDates: [],
    confirmedCountOnDate: 0,
    now: new Date("2030-06-01T08:00:00+03:00"),
  });
}

describe("computeOrder", () => {
  it("prices a cake from the database rows, not the payload", () => {
    const result = compute();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 3200/kg * 2kg + 0 tier fee
    expect(result.order.lines[0].lineTotal).toBe(6400);
    expect(result.order.subtotal).toBe(6400);
    expect(result.order.deliveryFee).toBe(500);
    expect(result.order.total).toBe(6900);
  });

  it("adds the tier extra fee on top of the base price", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_2KG,
          tierId: TIER_THEMED,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.lines[0].lineTotal).toBe(6400 + 1500);
  });

  it("prices a pastry line from the database unit price times quantity", () => {
    const result = compute({
      items: [{ kind: "pastry", productId: PRODUCT_ID, quantity: 3 }],
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.lines[0].lineTotal).toBe(1350);
    expect(result.order.subtotal).toBe(1350);
    expect(result.order.deliveryFee).toBe(500);
  });

  it("prices a mixed order as cake plus pastries", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_2KG,
          tierId: TIER_SIMPLE,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
        { kind: "pastry", productId: PRODUCT_ID, quantity: 2 },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.subtotal).toBe(6400 + 900);
    expect(result.order.total).toBe(6400 + 900 + 500);
  });

  it("charges no delivery fee for pickup", () => {
    const result = compute({ fulfilment: { kind: "pickup" } });
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.deliveryFee).toBe(0);
    expect(result.order.total).toBe(6400);
  });

  it("requires no deposit for a 2 kg Simple cake", () => {
    const result = compute();
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.depositRequired).toBe(0);
  });

  it("requires a deposit for a 2 kg Themed cake", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_2KG,
          tierId: TIER_THEMED,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    // 6400 base + 1500 tier + 500 delivery = 8400; 50% deposit.
    expect(result.order.depositRequired).toBe(4200);
  });

  it("requires a deposit for a 3 kg Simple cake (threshold is about kg, not tier)", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_3KG,
          tierId: TIER_SIMPLE,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.depositRequired).toBe(Math.round(0.5 * (9600 + 500)));
  });

  it("computes no deposit for a quote-only cake", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_3KG,
          tierId: TIER_QUOTE,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.order.priceNeedsQuote).toBe(true);
    expect(result.order.depositRequired).toBe(0);
  });

  it("keeps a quote-only cake at the base price, before the tier markup", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_3KG,
          tierId: TIER_QUOTE,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    // 3200/kg * 3kg — the 5000 tier fee is excluded until the shop quotes.
    expect(result.order.lines[0].lineTotal).toBe(9600);
    expect(result.order.total).toBe(9600 + 500);
  });

  it("rejects a date that is blocked", () => {
    const result = computeOrder({
      payload: payload(),
      catalogue: CATALOGUE,
      settings: SETTINGS,
      blockedDates: ["2030-06-15"],
      confirmedCountOnDate: 0,
      now: new Date("2030-06-01T08:00:00+03:00"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/closed/i);
  });

  it("rejects a date inside the lead time", () => {
    const result = computeOrder({
      payload: payload({ dateNeeded: "2030-06-02" }),
      catalogue: CATALOGUE,
      settings: SETTINGS,
      blockedDates: [],
      confirmedCountOnDate: 0,
      now: new Date("2030-06-01T08:00:00+03:00"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/lead time/i);
  });

  it("rejects a date whose daily cake limit is reached", () => {
    const result = computeOrder({
      payload: payload(),
      catalogue: CATALOGUE,
      settings: SETTINGS,
      blockedDates: [],
      confirmedCountOnDate: 5,
      now: new Date("2030-06-01T08:00:00+03:00"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/fully booked/i);
  });

  it("rejects a cake whose flavour is not in the catalogue", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: "99999999-9999-4999-8999-999999999999",
          sizeId: SIZE_ID_2KG,
          tierId: TIER_SIMPLE,
          designDescription: "",
          cakeMessage: "",
          allergies: "",
          referencePhotos: [],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/flavour/i);
  });

  it("rejects a pastry whose product is not in the catalogue", () => {
    const result = compute({
      items: [{ kind: "pastry", productId: "99999999-9999-4999-8999-999999999999", quantity: 1 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/product/i);
  });

  it("rejects a delivery order for a zone that is not in the catalogue", () => {
    const result = compute({
      fulfilment: { kind: "delivery", zoneId: "99999999-9999-4999-8999-999999999999", address: "x" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/zone/i);
  });

  it("carries the design description, message and allergies onto the cake line", () => {
    const result = compute({
      items: [
        {
          kind: "cake",
          flavourId: FLAVOUR_ID,
          sizeId: SIZE_ID_2KG,
          tierId: TIER_SIMPLE,
          designDescription: "Two tiers, blush and gold",
          cakeMessage: "Happy Birthday Wanjiku",
          allergies: "Peanuts",
          referencePhotos: ["refs/a.jpg"],
        },
      ],
    });
    if (!result.ok) throw new Error("expected ok");
    const line = result.order.lines[0];
    expect(line.designDescription).toBe("Two tiers, blush and gold");
    expect(line.cakeMessage).toBe("Happy Birthday Wanjiku");
    expect(line.allergies).toBe("Peanuts");
    expect(line.referencePhotos).toEqual(["refs/a.jpg"]);
  });

  it("marks the order as needing a quote only when a tier requires it", () => {
    const plain = compute();
    if (!plain.ok) throw new Error("expected ok");
    expect(plain.order.priceNeedsQuote).toBe(false);
  });
});
