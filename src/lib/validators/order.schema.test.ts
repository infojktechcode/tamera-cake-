import { describe, it, expect } from "vitest";
import {
  orderPayloadSchema,
  type OrderPayload,
} from "./order.schema";

const ZONE_ID = "55555555-5555-4555-8555-555555555555";
const FLAVOUR_ID = "11111111-1111-4111-8111-111111111111";
const SIZE_ID = "22222222-2222-4222-8222-222222222222";
const TIER_ID = "33333333-3333-4333-8333-333333333333";
const PASTRY_ID = "44444444-4444-4444-8444-444444444444";

const VALID: OrderPayload = {
  idempotencyKey: "77777777-7777-4777-8777-777777777777",
  customer: {
    name: "Wanjiku",
    phone: "0712345678",
  },
  fulfilment: {
    kind: "delivery",
    zoneId: ZONE_ID,
    address: "Mwangaza Road, House 12",
  },
  dateNeeded: "2030-06-15",
  timeNeeded: "10:00",
  notes: "Please write Happy Birthday Wanjiku",
  items: [
    {
      kind: "cake",
      flavourId: FLAVOUR_ID,
      sizeId: SIZE_ID,
      tierId: TIER_ID,
      designDescription: "Two tiers, blush and gold",
      cakeMessage: "Happy Birthday Wanjiku",
      allergies: "Peanuts",
      referencePhotos: [],
    },
    {
      kind: "pastry",
      productId: PASTRY_ID,
      quantity: 2,
    },
  ],
};

describe("orderPayloadSchema", () => {
  it("accepts a well-formed payload", () => {
    const result = orderPayloadSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("rejects a payload that carries a client-side unit price", () => {
    const tampered = {
      ...VALID,
      items: [{ ...VALID.items[1], unitPrice: 1 }],
    };
    const result = orderPayloadSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it("rejects a payload that carries a client-side total", () => {
    const tampered = { ...VALID, total: 1 };
    const result = orderPayloadSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const tampered = { ...VALID, subtotal: 100 };
    const result = orderPayloadSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid phone number", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      customer: { ...VALID.customer, phone: "123" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty customer name", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      customer: { ...VALID.customer, name: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      dateNeeded: "15/06/2030",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      dateNeeded: "2030-02-30",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a pastry quantity below 1", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      items: [{ kind: "pastry", productId: PASTRY_ID, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a cake item with no flavour", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      items: [
        {
          kind: "cake",
          sizeId: "22222222-2222-4222-8222-222222222222",
          tierId: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires an address when fulfilment is delivery", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      fulfilment: { kind: "delivery", zoneId: ZONE_ID, address: "" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts pickup with no zone and no address", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      fulfilment: { kind: "pickup" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 3 reference photos", () => {
    const result = orderPayloadSchema.safeParse({
      ...VALID,
      items: [
        {
          ...VALID.items[0],
          referencePhotos: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty item list", () => {
    const result = orderPayloadSchema.safeParse({ ...VALID, items: [] });
    expect(result.success).toBe(false);
  });
});
