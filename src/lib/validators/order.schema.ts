import { z } from "zod";

/**
 * The order payload the browser sends to `POST /api/orders`.
 *
 * The schema is the trust boundary: it accepts **ids and quantities only**.
 * No money crosses this boundary — the server recomputes every price from the
 * database, so a tampered `unitPrice` or `total` is rejected outright rather
 * than silently corrected.
 */

const uuid = z.uuid();

const cakeItemSchema = z.strictObject({
  kind: z.literal("cake"),
  flavourId: uuid,
  sizeId: uuid,
  tierId: uuid,
  designDescription: z.string().max(2000).optional().default(""),
  cakeMessage: z.string().max(300).optional().default(""),
  allergies: z.string().max(500).optional().default(""),
  /** Storage paths of uploaded reference photos — resolved by /api/upload. */
  referencePhotos: z.array(z.string().max(500)).max(3).optional().default([]),
});

const pastryItemSchema = z.strictObject({
  kind: z.literal("pastry"),
  productId: uuid,
  quantity: z.number().int().min(1).max(99),
});

const customerSchema = z.strictObject({
  name: z.string().trim().min(1, "Please tell us your name.").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?254|0)?[17]\d{8}$/, "Enter a valid Kenyan phone number."),
});

const deliveryFulfilmentSchema = z.strictObject({
  kind: z.literal("delivery"),
  zoneId: uuid,
  address: z.string().trim().min(1, "We need an address for delivery.").max(400),
});

const pickupFulfilmentSchema = z.strictObject({
  kind: z.literal("pickup"),
});

export const orderPayloadSchema = z
  .strictObject({
    customer: customerSchema,
    fulfilment: z.discriminatedUnion("kind", [
      deliveryFulfilmentSchema,
      pickupFulfilmentSchema,
    ]),
    /** YYYY-MM-DD */
    dateNeeded: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
    /** HH:MM (24h) */
    timeNeeded: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a valid time.")
      .optional(),
    notes: z.string().trim().max(1000).optional().default(""),
    items: z
      .array(z.discriminatedUnion("kind", [cakeItemSchema, pastryItemSchema]))
      .min(1, "Your cart is empty.")
      .max(30),
  })
  .strict();

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
export type OrderCakeItem = z.infer<typeof cakeItemSchema>;
export type OrderPastryItem = z.infer<typeof pastryItemSchema>;
